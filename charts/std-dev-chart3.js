// ==UserScript==
// @name         Volatility Regime Detector + Time-To-10
// @namespace    http://tampermonkey.net/
// @version      7
// @description  Detect compression exits and measure rolls to 10x
// @author       You
// @match        https://stake.us/casino/games/limbo
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://cdn.jsdelivr.net/npm/chart.js@4.5.0/dist/chart.umd.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const MAX_POINTS = 1000;
  const VIEW_WINDOW = 300;

  const SHORT_WINDOW = 10;
  const MID_WINDOW = 100;

  const COMPRESS_THRESHOLD = 1;
  const TEN_THRESHOLD = 10;
  const MAX_WAIT = 50; // max rolls to wait for 10x

  let rollNum = 0;
  let regimeChart;

  let wasCompressed = false;
  let currentRun = 0;

  let activeCompressionEvents = [];
  let completedEvents = [];

  // ---------------------------
  // Rolling Std Dev
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
            label: "Short Std",
            data: [],
            borderColor: "green",
            borderWidth: 1,
            tension: 0,
            pointRadius: 0
          },
          {
            label: "Mid Std",
            data: [],
            borderColor: "red",
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
        interaction: {
          mode: "nearest",
          intersect: false
        },
        scales: {
          x: { type: "linear" },
          y: { beginAtZero: false }
        }
      }
    });
  }

  function cap(arr) {
    if (arr.length > MAX_POINTS) {
      arr.splice(0, arr.length - MAX_POINTS);
    }
  }

  function renderChart(result) {
    const stdShort = rollingStats.getStd(SHORT_WINDOW);
    const stdMid = rollingStats.getStd(MID_WINDOW);
    const ratio = stdMid === 0 ? 1 : stdShort / stdMid;

    const isCompressed = stdShort < COMPRESS_THRESHOLD;

    // ---------------------------
    // Compression Exit Detection
    // ---------------------------

    if (!isCompressed && wasCompressed) {
      activeCompressionEvents.push({
        triggerRoll: rollNum,
        triggerResult: result,
        runLength: currentRun,
        rollsWaiting: 0,
        hit: false
      });

      console.log(
        `[COMPRESSION EXIT] Roll ${rollNum} | Run Length: ${currentRun}`
      );
    }

    if (isCompressed) {
      currentRun++;
    } else {
      currentRun = 0;
    }

    wasCompressed = isCompressed;

    // ---------------------------
    // Track Active Events
    // ---------------------------

    activeCompressionEvents.forEach(event => {
      event.rollsWaiting++;

      if (!event.hit && result >= TEN_THRESHOLD) {
        event.hit = true;
        event.rollsTo10 = event.rollsWaiting;
      }
    });

    // ---------------------------
    // Finalize Events
    // ---------------------------

    const finished = activeCompressionEvents.filter(
      e => e.hit || e.rollsWaiting >= MAX_WAIT
    );

    activeCompressionEvents = activeCompressionEvents.filter(
      e => !(e.hit || e.rollsWaiting >= MAX_WAIT)
    );

    finished.forEach(e => {
      completedEvents.push({
        triggerRoll: e.triggerRoll,
        runLength: e.runLength,
        rollsTo10: e.hit ? e.rollsTo10 : null,
        hit: e.hit,
        timestamp: new Date().toISOString()
      });

      if (completedEvents.length > 20) {
        completedEvents.shift();
      }

      console.log(
        `[RESULT] Exit @ ${e.triggerRoll} | Run ${e.runLength} | ` +
        (e.hit
          ? `Hit 10x in ${e.rollsTo10} rolls`
          : `No 10x within ${MAX_WAIT}`)
      );

      console.table(completedEvents);
    });

    // ---------------------------
    // Chart Update
    // ---------------------------

    regimeChart.data.labels.push(rollNum);
    regimeChart.data.datasets[0].data.push(ratio);
    regimeChart.data.datasets[1].data.push(stdShort);
    regimeChart.data.datasets[2].data.push(stdMid);

    cap(regimeChart.data.labels);
    cap(regimeChart.data.datasets[0].data);
    cap(regimeChart.data.datasets[1].data);
    cap(regimeChart.data.datasets[2].data);

    regimeChart.options.scales.x.min = Math.max(0, rollNum - VIEW_WINDOW);
    regimeChart.options.scales.x.max = rollNum;

    regimeChart.update("none");
  }

  // ---------------------------
  // Fetch Hook
  // ---------------------------

  function observeRollChanges() {
    const origFetch = window.fetch;

    window.fetch = function (...args) {
      const p = origFetch.apply(this, args);

      p.then(res => {
        try {
          const url =
            typeof args[0] === "string" ? args[0] : args[0]?.url;

          if (!url || !url.includes("/_api/casino/") || !url.includes("/bet"))
            return;

          const clone = res.clone();

          clone.json().then(data => {
            const result =
              data?.limboBet?.state?.result ??
              data?.diceBet?.state?.result ??
              data?.plinkoBet?.state?.result ??
              data?.crashBet?.state?.result;

            if (Number.isFinite(result)) {
              rollNum++;
              rollingStats.push(result);
              renderChart(result);
            }
          }).catch(()=>{});
        } catch {}
      });

      return p;
    };
  }

  // ---------------------------
  // UI
  // ---------------------------

  function injectUI() {
    $("<style>")
      .html(`
        #draggable-regime-container {
          position: absolute;
          top: 120px;
          left: 120px;
          z-index: 9999;
        }

        .container {
          width: 1400px;
          height: 400px;
          background: #1e2323;
          position: relative;
        }

        canvas {
          width: 100% !important;
          height: 100% !important;
        }
      `)
      .appendTo("head");

    $("body").prepend(`
      <div id="draggable-regime-container">
        <div class="container">
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
