// ==UserScript==
// @name         Std Dev Chart (Self-Healing)
// @namespace    http://tampermonkey.net/
// @version      8
// @description  Rolling standard deviation chart (auto-normalizing)
// @author       You
// @match        https://*/game/limbo
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://cdn.jsdelivr.net/npm/chart.js@4.5.0/dist/chart.umd.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @require      https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.0.1/dist/chartjs-plugin-annotation.min.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const MAX_POINTS = 1000;
  const VIEW_WINDOW = 300;

  const STD_WINDOWS = {
    SHORT: 10,
    MID: 100,
    LONG: 1000
  };

  let rollNum = 0;
  let lastRollSet = [];
  let currentRollSet = [];
  let stdDevChart;

  // ---------------------------------------------------------
  // Utility
  // ---------------------------------------------------------

  function cap(arr, max = MAX_POINTS) {
    if (arr.length > max) {
      arr.splice(0, arr.length - max);
    }
    return arr;
  }

  function arraysAreEqual(a, b) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
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

  // ---------------------------------------------------------
  // Rolling Stats
  // ---------------------------------------------------------

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

    getStandardDeviation(lookback) {
      const vals = this.getValues(lookback);
      if (vals.length <= 1) return 0;

      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance =
        vals.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
        (vals.length - 1);

      return Math.sqrt(variance);
    }
  }

  const rollingStats = new RollingStats(1000);

  // ---------------------------------------------------------
  // Chart Setup
  // ---------------------------------------------------------

  function initStdDevChart() {
    const ctx = document.getElementById("stdDevChart").getContext("2d");

    stdDevChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "STD-SHORT",
            data: [],
            borderColor: "#00ff88",
            borderWidth: 1.5,
            tension: 0.2
          },
          {
            label: "STD-MID",
            data: [],
            borderColor: "#ffaa00",
            borderWidth: 1.5,
            tension: 0.2
          },
          {
            label: "STD-LONG",
            data: [],
            borderColor: "#ff4444",
            borderWidth: 1.5,
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: { type: "linear" },
          y: { beginAtZero: false }
        },
        plugins: {
          annotation: { annotations: {} }
        }
      }
    });
  }

  function getWindowExtremes(dataset) {
    const data = dataset.data;
    const start = Math.max(0, data.length - VIEW_WINDOW);
    const slice = data.slice(start).filter(v => v !== null && !isNaN(v));

    if (slice.length === 0) return null;

    return {
      min: Math.min(...slice),
      max: Math.max(...slice)
    };
  }

  function renderStdDevChart() {
    const stdShort = rollingStats.getStandardDeviation(STD_WINDOWS.SHORT);
    const stdMid   = rollingStats.getStandardDeviation(STD_WINDOWS.MID);
    const stdLong  = rollingStats.getStandardDeviation(STD_WINDOWS.LONG);

    stdDevChart.data.labels.push(rollNum);
    cap(stdDevChart.data.labels);

    const [dsShort, dsMid, dsLong] = stdDevChart.data.datasets;

    dsShort.data.push(rollNum >= STD_WINDOWS.SHORT ? stdShort : null);
    dsMid.data.push(rollNum >= STD_WINDOWS.MID ? stdMid : null);
    dsLong.data.push(rollNum >= STD_WINDOWS.LONG ? stdLong : null);

    cap(dsShort.data);
    cap(dsMid.data);
    cap(dsLong.data);

    // Build rolling annotations
    const annos = {};
    [dsShort, dsMid, dsLong].forEach(ds => {
      const extremes = getWindowExtremes(ds);
      if (!extremes) return;

      annos[ds.label + "-min"] = {
        type: "line",
        yMin: extremes.min,
        yMax: extremes.min,
        borderDash: [4,4],
        borderWidth: 1
      };

      annos[ds.label + "-max"] = {
        type: "line",
        yMin: extremes.max,
        yMax: extremes.max,
        borderDash: [4,4],
        borderWidth: 1
      };
    });

    stdDevChart.options.plugins.annotation.annotations = annos;

    // Dynamic Y clamp to visible window
    const visibleValues = [
      ...dsShort.data.slice(-VIEW_WINDOW),
      ...dsMid.data.slice(-VIEW_WINDOW),
      ...dsLong.data.slice(-VIEW_WINDOW)
    ].filter(v => v !== null && !isNaN(v));

    if (visibleValues.length > 0) {
      const min = Math.min(...visibleValues);
      const max = Math.max(...visibleValues);

      stdDevChart.options.scales.y.min = min * 0.9;
      stdDevChart.options.scales.y.max = max * 1.1;
    }

    stdDevChart.options.scales.x.min = Math.max(0, rollNum - VIEW_WINDOW);
    stdDevChart.options.scales.x.max = rollNum;

    stdDevChart.update("none");
  }

  // ---------------------------------------------------------
  // Roll Observer
  // ---------------------------------------------------------


  function getRollResult() {
    lastRollSet = currentRollSet;

    currentRollSet = $(".grid.grid-auto-flow-column div span")
      .map(function () {
        return Number($(this).text().replace("x", ""));
      })
      .get();

    if (arraysAreEqual(currentRollSet, lastRollSet)) return -1;
    return currentRollSet[currentRollSet.length - 1];
  }

  async function observeRollChanges() {
    const grid = await waitForSelector(".grid.grid-auto-flow-column");

    const observer = new MutationObserver(() => {
      const result = getRollResult();
      if (result !== -1) {
        rollNum++;
        rollingStats.push(result);
        renderStdDevChart();
      }
    });

    observer.observe(grid, { childList: true, subtree: true });
  }

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------

  function injectUI() {
    $("<style>")
      .html(`
        #draggable-charts-container {
          position: absolute;
          top: 120px;
          left: 120px;
          z-index: 9999;
        }

        .container {
          width: 500px;
          height: 500px;
          background: #1e2323;
          display: flex;
          flex-direction: column;
        }

        .chartContainer {
          position: relative;
          width: 100%;
          height: 100%;
        }
      `)
      .appendTo("head");

    $("body").prepend(`
      <div id="draggable-charts-container">
        <div class="container">
          <div class="chartContainer">
            <canvas id="stdDevChart"></canvas>
          </div>
        </div>
      </div>
    `);

    $("#draggable-charts-container").draggable({ scroll: false });

    initStdDevChart();
    observeRollChanges();
  }

  injectUI();

})();


// ---------------------------------------------------------
// Your junk test block (kept exactly as requested)
// ---------------------------------------------------------

function getIsTestMode() {
  // const inputField = $("#test-mode");
  // return inputField.length !== 0 && inputField.prop("checked");
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
