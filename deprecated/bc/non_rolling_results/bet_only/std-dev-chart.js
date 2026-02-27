// ==UserScript==
// @name         Volatility Regime Detector + Compression Stats 3
// @namespace    http://tampermonkey.net/
// @version      6
// @description  rolling winrate chart with dynamic target switching
// @author       You
// @match        https://stake.us/casino/games/limbo
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://cdn.jsdelivr.net/npm/chart.js@4.5.0/dist/chart.umd.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @require https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.0.1/dist/chartjs-plugin-annotation.min.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const MAX_POINTS = 1000;
  const VIEW_WINDOW = 300;

  const SHORT_WINDOW = 10;
  const MID_WINDOW = 100;

  const COMPRESS_THRESHOLD = 1;

  let rollNum = 0;
  let lastRollSet = [];
  let currentRollSet = [];
  let regimeChart;

  // ---------------------------
  // Compression Run Tracking
  // ---------------------------

  let currentRun = 0;
  let runs = [];

  function finalizeRun() {
    if (currentRun > 0) {
      runs.push(currentRun);
      if (runs.length > 500) runs.shift();
      currentRun = 0;
    }
  }

  function percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.floor((p / 100) * (sorted.length - 1));
    return sorted[idx];
  }

  function getRunStats() {
    if (runs.length === 0) return { avg: 0, p50: 0, p90: 0, max: 0 };

    const sum = runs.reduce((a, b) => a + b, 0);
    return {
      avg: (sum / runs.length).toFixed(2),
      p50: percentile(runs, 50),
      p90: percentile(runs, 90),
      max: Math.max(...runs)
    };
  }

  function updateHUD() {
    const stats = getRunStats();
    const hud = document.getElementById("compressHud");

    const isTail = currentRun > stats.p90 && stats.p90 > 0;

    hud.innerHTML = `
      Run: <b style="color:${
        isTail ? "#ff4444" : "#00ff88"
      }">${currentRun}</b><br>
      Avg: ${stats.avg}<br>
      P50: ${stats.p50}<br>
      P90: ${stats.p90}<br>
      Max: ${stats.max}
    `;
  }

  // ---------------------------
  // Rolling Stats
  // ---------------------------

  class RollingStats {
    constructor(size) {
      this.size = size;
      this.buffer = new Array(size).fill(null);
      this.index = 0;
      this.count = 0;
    }

    push(value) {
      this.buffer[this.index] = value;
      if (this.count < this.size) this.count++;
      this.index = (this.index + 1) % this.size;
    }

    getValues(lookback) {
      const count = Math.min(lookback, this.count);
      const values = [];
      const start = (this.index - count + this.size) % this.size;

      for (let i = 0; i < count; i++) {
        const idx = (start + i) % this.size;
        values.push(this.buffer[idx]);
      }
      return values;
    }

    getStd(lookback) {
      const vals = this.getValues(lookback);
      if (vals.length <= 1) return 0;

      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance =
        vals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (vals.length - 1);

      return Math.sqrt(variance);
    }
  }

  const rollingStats = new RollingStats(1000);

  // ---------------------------
  // Chart
  // ---------------------------

  function initChart() {
    const ctx = document.getElementById("regimeChart").getContext("2d");

    regimeChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Volatility Ratio (Short / Mid)",
            data: [],
            borderColor: "#00ff88",
            borderWidth: 1,
            tension: 0,
            pointRadius: 0
          },
          {
            label: "Short",
            data: [],
            borderColor: "green",
            borderWidth: 1,
            tension: 0,
            pointRadius: 0
          },
          {
            label: "Long",
            data: [],
            borderColor: "red",
            borderWidth: 1,
            tension: 0,
            pointRadius: 0
          },
          {
            label: "Baseline",
            data: [],
            borderColor: "#888",
            borderDash: [5, 5],
            borderWidth: 1,
            tension: 0,
            pointRadius: 0
          },
          {
            label: "RunLine",
            data: [],
            borderColor: "#F00",
            borderDash: [5, 5],
            borderWidth: 1,
            tension: 0,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: { type: "linear" },
          y: {
            beginAtZero: false,
            grace: "10%"
          }
        }
      }
    });
  }

  function cap(arr) {
    if (arr.length > MAX_POINTS) {
      arr.splice(0, arr.length - MAX_POINTS);
    }
  }

  function renderChart() {
    let stdShort = rollingStats.getStd(SHORT_WINDOW);
    const stdMid = rollingStats.getStd(MID_WINDOW);

    const ratio = stdMid === 0 ? 1 : stdShort / stdMid;

    // Compression logic
    if (stdShort < COMPRESS_THRESHOLD) {
      currentRun++;
    } else {
      finalizeRun();
    }

    updateHUD();

    regimeChart.data.labels.push(rollNum);
    // regimeChart.data.datasets[0].data.push(ratio);
    stdShort = stdShort > 5 ? 5 : stdShort;

    regimeChart.data.datasets[1].data.push(stdShort);
    // regimeChart.data.datasets[2].data.push(stdMid);
    regimeChart.data.datasets[3].data.push(1);
    regimeChart.data.datasets[4].data.push(0.5);

    cap(regimeChart.data.labels);
    cap(regimeChart.data.datasets[0].data);
    cap(regimeChart.data.datasets[1].data);
    cap(regimeChart.data.datasets[2].data);

    regimeChart.options.scales.x.min = Math.max(0, rollNum - VIEW_WINDOW);
    regimeChart.options.scales.x.max = rollNum;

    regimeChart.update("none");
  }

  // ---------------------------
  // Roll Observer
  // ---------------------------
  async function observeRollChanges() {
    (function () {
      const origFetch = window.fetch;

      window.fetch = function (...args) {
        const p = origFetch.apply(this, args);

        p.then((res) => {
          try {
            const url = typeof args[0] === "string" ? args[0] : args[0]?.url;

            if (!url || !url.includes("/_api/casino/") || !url.includes("/bet"))
              return;

            const clone = res.clone();

            clone.text().then((text) => {
              if (!text) return;

              let data;
              try {
                data = JSON.parse(text);
              } catch {
                return;
              }

              const result =
                data?.limboBet?.state?.result ??
                data?.diceBet?.state?.result ??
                data?.plinkoBet?.state?.result ??
                data?.crashBet?.state?.result;

              if (Number.isFinite(result)) {
                rollNum++;
                rollingStats.push(result);
                renderChart();
              }
            });
          } catch {}
        });

        return p;
      };
    })();
  }

  function waitForSelector(selector) {
    const pause = 10;
    let maxTime = 50000;

    return new Promise((resolve, reject) => {
      (function inner() {
        if (maxTime <= 0) {
          reject(new Error("Timeout: " + selector));
          return;
        }
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        maxTime -= pause;
        setTimeout(inner, pause);
      })();
    });
  }

  // ---------------------------
  // UI
  // ---------------------------

  function injectUI() {
    $("<style>")
      .html(
        `
        #draggable-regime-container {
          position: absolute;
          top: 120px;
          left: 120px;
          z-index: 9999;
        }

        .container {
          width: 1500px;
          height: 400px;
          background: #1e2323;
          position: relative;
        }

        #compressHud {
          position: absolute;
          top: 10px;
          right: 10px;
          font-size: 12px;
          color: #ccc;
          text-align: right;
        }

        canvas {
          width: 100% !important;
          height: 100% !important;
        }
      `
      )
      .appendTo("head");

    $("body").prepend(`
      <div id="draggable-regime-container">
        <div class="container">
          <div id="compressHud"></div>
          <canvas id="regimeChart"></canvas>
        </div>
      </div>
    `);

    $("#draggable-regime-container").draggable({ scroll: false });

    initChart();
    observeRollChanges();
  }

  injectUI();
})();

// ---------------------------------------------------------
// Your junk test block (kept exactly as requested)
// ---------------------------------------------------------

function getIsTestMode() {
  return true;
}

let mbc;
if (getIsTestMode()) {
  mbc = new MockBC(
    0,
    "Y83TpC2hj2SnjiNEDJwN",
    "9b98254e8986dd95349fc754b4b087b5d0ddf9771026d68fe4ed661c869420b4"
  );
}
