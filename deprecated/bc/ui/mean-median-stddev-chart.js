// ==UserScript==
// @name         bc.game median v1
// @namespace    http://tampermonkey.net/
// @version      6
// @description  rolling median chart with dynamic target switching
// @author       You
// @match        https://*/game/limbo
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://cdn.jsdelivr.net/npm/chart.js@4.5.0/dist/chart.umd.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @require https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.0.1/dist/chartjs-plugin-annotation.min.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";
  let ROLLING_STATS = initRollingStats(1000);
  const MAX_RESULTS = 500;
  let lastRollSet = [];
  let currentRollSet = [];
  let resultsHistory = []; // raw results (multipliers)
  let cumulativeWins = [0]; // prefix sum of wins for current target
  const ROLLING_SMA = initRollingSMA(10);
  let rollNum = 0;
  let newWindow = null;
  let medianChart;
  let currentTarget = 0;

  const extremes = {
    "MED-50": { min: Infinity, max: -Infinity },
    "MED-100": { min: Infinity, max: -Infinity },
    "MED-200": { min: Infinity, max: -Infinity }
  };

  // -------------------------------------------------------------------
  // Main entry
  // -------------------------------------------------------------------
  injectUI();

  // -------------------------------------------------------------------
  // Roll handling
  // -------------------------------------------------------------------
  function evalResult(result) {
    if (result === -1) return; // no new roll
    recordRoll(result);
    renderChart();
  }

  function recordRoll(result) {
    rollNum++;
    ROLLING_STATS.push(result);
    cap(resultsHistory);
  }

  // -------------------------------------------------------------------
  // Chart drawing
  // -------------------------------------------------------------------
  const MAX_POINTS = 1000; // adjust as needed

  function cap(arr, max = MAX_POINTS) {
    if (arr.length > max) {
      arr.splice(0, arr.length - max);
    }
    return arr;
  }

  // Track extremes each render (or precompute if you persist stats)
  function getExtremes(ds) {
    const vals = ds.data.filter((v) => v !== null && !isNaN(v));
    return {
      min: Math.min(...vals),
      max: Math.max(...vals)
    };
  }

  function renderChart() {
    const med50 = getWinRate(50, rollNum);
    const med100 = getWinRate(100, rollNum);
    const med200 = getWinRate(200, rollNum);

    medianChart.data.labels.push(rollNum);
    cap(medianChart.data.labels);

    const dsMED50 = medianChart.data.datasets.find(
      (ds) => ds.label === "MED-50"
    );
    const dsMED100 = medianChart.data.datasets.find(
      (ds) => ds.label === "MED-100"
    );
    const dsMED200 = medianChart.data.datasets.find(
      (ds) => ds.label === "MED-200"
    );

    dsMED50.data.push(rollNum >= 50 ? med50 : null);
    cap(dsMED50.data);
    updateExtremes(dsMED50, med50);
    dsMED100.data.push(rollNum >= 100 ? med100 : null);
    cap(dsMED100.data);
    updateExtremes(dsMED100, med100);
    dsMED200.data.push(rollNum >= 200 ? med200 : null);
    cap(dsMED200.data);
    updateExtremes(dsMED200, med200);

    // Build annotations for each dataset’s extremes
    const annos = {};
    [dsMED50, dsMED100, dsMED200].forEach((ds) => {
      const { min, max } = getExtremes(ds);
      if (!isFinite(min) || !isFinite(max)) return;
      annos[`${ds.label}-min`] = {
        type: "line",
        yMin: extremes[ds.label].min,
        yMax: extremes[ds.label].min,
        borderColor: ds.borderColor,
        borderDash: [4, 4],
        borderWidth: 1
      };
      annos[`${ds.label}-max`] = {
        type: "line",
        yMin: extremes[ds.label].max,
        yMax: extremes[ds.label].max,
        borderColor: ds.borderColor,
        borderDash: [4, 4],
        borderWidth: 1
      };
    });

    medianChart.options.plugins.annotation.annotations = annos;

    const windowSize = 300; // number of rolls visible
    medianChart.options.scales.x.min = Math.max(0, rollNum - windowSize);
    medianChart.options.scales.x.max = rollNum;
    medianChart.update();
  }

  function getExtremes(ds) {
    const vals = ds.data.filter((v) => v !== null && !isNaN(v));
    return {
      min: Math.min(...vals),
      max: Math.max(...vals)
    };
  }

  function updateExtremes(labelObject, val) {
    const label = labelObject.label;

    extremes[label].min = Math.min(extremes[label].min, val);
    extremes[label].max = Math.max(extremes[label].max, val);
  }

  function getWinRate(windowSize, rollIndex) {
    return ROLLING_STATS.getMedian(windowSize);
  }

  function resetChartData() {
    if (!medianChart) return;
    medianChart.data.labels = [];
    medianChart.data.datasets.forEach((ds) => (ds.data = []));
    medianChart.update();
  }

  function rebuildCumulativeWins() {
    cumulativeWins = [0];
    for (let i = 0; i < resultsHistory.length; i++) {
      const win = resultsHistory[i] >= currentTarget ? 1 : 0;
      cumulativeWins.push(cumulativeWins[i] + win);
    }
  }

  function refreshChartForTarget() {
    if (!medianChart) return;
    rebuildCumulativeWins();
    resetChartData();

    for (let i = 1; i <= resultsHistory.length; i++) {
      medianChart.data.labels.push(i);
      medianChart.data.datasets
        .find((ds) => ds.label === "MED-50")
        .data.push(getWinRate(50, i));
      medianChart.data.datasets
        .find((ds) => ds.label === "MED-100")
        .data.push(getWinRate(100, i));
      medianChart.data.datasets
        .find((ds) => ds.label === "MED-200")
        .data.push(getWinRate(200, i));
    }

    rollNum = resultsHistory.length;
    medianChart.update();
  }

  // -------------------------------------------------------------------
  // Chart setup
  // -------------------------------------------------------------------
  function initRollingWindows() {
    const ctx = document.getElementById("medianChart").getContext("2d");
    debugger;
    if (medianChart) medianChart.destroy();

    const datasets = [
      { label: "MED-50", borderColor: "green" },
      { label: "MED-100", borderColor: "blue" },
      { label: "MED-200", borderColor: "red" }
    ].map((cfg) => ({
      label: cfg.label,
      data: [],
      borderColor: cfg.borderColor,
      borderWidth: 1,
      pointRadius: 0,
      yAxisID: "yWinRate",
      fill: false,
      tension: 0.1
    }));

    medianChart = new Chart(ctx, {
      type: "line",
      data: { labels: [], datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        devicePixelRatio: 2,
        scales: {
          yWinRate: {
            type: "linear",
            position: "left",
            min: 0,
            max: 3,
            title: { display: true, text: "Win Rate (%)" }
          },
          x: { title: { display: true, text: "Roll #" } }
        }
      }
    });
  }

  function initRollingStats() {
    class RollingStats {
      constructor(size) {
        this.size = size;
        this.buffer = new Array(size).fill(null);
        this.index = 0;
        this.count = 0;
      }

      push = (value) => {
        if (this.count >= this.size) {
          // Overwrite old value
          this.buffer[this.index] = value;
        } else {
          this.buffer[this.index] = value;
          this.count++;
        }

        this.index = (this.index + 1) % this.size;
      };

      getValues = (lookback = this.count) => {
        const count = Math.min(lookback, this.count);
        const values = [];
        const start = (this.index - count + this.size) % this.size;
        for (let i = 0; i < count; i++) {
          const idx = (start + i + this.size) % this.size;
          values.push(this.buffer[idx]);
        }
        return values;
      };

      getMean = (lookback = this.count) => {
        const vals = this.getValues(lookback);
        if (vals.length === 0) return 0;
        const sum = vals.reduce((a, b) => a + b, 0);
        return sum / vals.length;
      };

      getVariance = (lookback = this.count) => {
        const vals = this.getValues(lookback);
        if (vals.length <= 1) return 0;
        const mean = this.getMean(lookback);
        const sumOfSquares = vals.reduce((sum, v) => sum + (v - mean) ** 2, 0);
        return sumOfSquares / (vals.length - 1);
      };

      getStandardDeviation = (lookback = this.count) => {
        return Math.sqrt(this.getVariance(lookback));
      };

      getMedian = (lookback = this.count) => {
        const vals = this.getValues(lookback);
        if (vals.length === 0) return null;
        const sorted = [...vals].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
      };
    }

    return new RollingStats(1000);
  }

  // -------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------

  function initWindowEvents() {
    const htmlNode = $("#current-target");
    currentTarget = parseFloat(htmlNode.val());

    htmlNode.on("change", () => {
      currentTarget = parseFloat(htmlNode.val());
      refreshChartForTarget();
    });

    const toggles = [
      { id: "#toggle-50", label: "MED-50" },
      { id: "#toggle-100", label: "MED-100" },
      { id: "#toggle-200", label: "MED-200" }
    ];

    toggles.forEach((t) => {
      const el = $(t.id);
      el.on("change", () => {
        const ds = medianChart.data.datasets.find((d) => d.label === t.label);
        ds.hidden = !el.prop("checked");
        medianChart.update();
      });
    });

    $("#median-chart").draggable({
      scroll: false
    });
  }

  // -------------------------------------------------------------------
  // Observer for rolls
  // -------------------------------------------------------------------
  async function observeRollChanges() {
    const gridElement = await waitForSelector(".grid.grid-auto-flow-column");
    let previousRollData = getCurrentRollData();

    const observer = new MutationObserver((mutationsList) => {
      let rollDataChanged = false;
      for (const mutation of mutationsList) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          const currentRollData = getCurrentRollData();
          if (!arraysAreEqual(previousRollData, currentRollData)) {
            rollDataChanged = true;
            previousRollData = currentRollData;
          }
        }
      }
      if (rollDataChanged) {
        evalResult(getRollResult());
      }
    });

    observer.observe(gridElement, { childList: true, subtree: true });
  }

  function getCurrentRollData() {
    return $(".grid.grid-auto-flow-column div span")
      .map(function () {
        return $(this).text();
      })
      .get();
  }

  function cap(arr, max = MAX_RESULTS) {
    if (arr.length > max) {
      // remove exactly the overflow in one splice (faster than repeated shift)
      arr.splice(0, arr.length - max);
    }
    return arr;
  }

  function initRollingSMA(period) {
    class RollingSMA {
      constructor(period) {
        this.period = period;
        this.buffer = new Array(period).fill(0);
        this.index = 0;
        this.count = 0;
        this.sum = 0;
      }

      update(value) {
        // remove the value that's falling out of the window
        this.sum -= this.buffer[this.index];

        // insert the new value
        this.buffer[this.index] = value;
        this.sum += value;

        // move the index forward (circular buffer)
        this.index = (this.index + 1) % this.period;

        // keep track of how many values we've seen so far
        if (this.count < this.period) {
          this.count++;
        }

        // return the current SMA
        return this.sum / this.count;
      }
    }
    return new RollingSMA(period);
  }
  function getRollResult() {
    const temp = lastRollSet;
    lastRollSet = currentRollSet;
    currentRollSet = temp;
    currentRollSet.length = 0;

    currentRollSet = $(".grid.grid-auto-flow-column div span")
      .map(function () {
        return Number($(this).text().replace("x", ""));
      })
      .get();

    if (arraysAreEqual(currentRollSet, lastRollSet)) return -1;
    return currentRollSet[currentRollSet.length - 1];
  }

  function arraysAreEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((value, index) => value === arr2[index]);
  }

  function waitForSelector(selector) {
    const pause = 10;
    let maxTime = 50000;
    return new Promise((resolve, reject) => {
      (function inner() {
        if (maxTime <= 0) {
          reject(new Error("Timeout: Element not found: " + selector));
          return;
        }
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
          return;
        }
        maxTime -= pause;
        setTimeout(inner, pause);
      })();
    });
  }

  // -------------------------------------------------------------------
  // Window + init
  // -------------------------------------------------------------------
  function injectUI() {
    // if (getIsTestMode()) return;
    $("<style>")
      .prop("type", "text/css")
      .html(
        `
        #median-chart {
          height: 400px;
          width: 600px;
      position: absolute;
              top: 300px;
              left: 470px;
        background: black;
     z-index: 9999;
        }
                .container {
      font-family: Arial, sans-serif;
      background-color: black;
      color: white;
      margin: 0;
      padding: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

#chartContainer {
  width: 100%;
  height: 600px;   /* or calc(100vh - controlsHeight) */
}
            .button-group {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                justify-content: center;
            }

            .button-group button {
                flex: 1;
                background: #2d89ef;
                color: white;
                border: none;
                padding: 8px 12px;
                font-size: 13px;
                font-weight: bold;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease-in-out;
                text-align: center;
                min-width: 80px;
            }

            .button-group button:hover {
                background: #1c6ac9;
            }

            .button-group button:active {
                transform: scale(0.95);
            }

            .control-group {
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: #292929;
                padding: 8px;
                border-radius: 6px;
            }

            .control-group label {
                font-size: 13px;
                color: #ccc;
            }

            .control-group input[type="number"],
            .control-group select {
                width: 80px;
                padding: 6px;
                border-radius: 4px;
                border: none;
                text-align: right;
                font-size: 13px;
                background: #444;
                color: white;
            }

            .control-group input[type="checkbox"] {
                transform: scale(1.2);
            }`
      )
      .appendTo("head");

    const uiHTML = `<div id="median-chart" class="container">
    <div class="control-group">
      <label>Target</label><br/>
     <select id="current-target"></select>
<script>
  (function populateTargets() {
    const sel = document.getElementById("current-target");

    // 1.5–1.92
    [1.5, 1.6, 1.7, 1.8, 1.92].forEach(v => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    });

    // 2–20 (step 1)
    for (let v = 2; v <= 20; v++) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    }

    // 25–100 (step 5)
    for (let v = 25; v <= 100; v += 5) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    }

    // 200, 500, 1000
    [200, 500, 1000].forEach(v => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    });

    // default select 1.5
    sel.value = "1.5";
  })();
</script>

    </div>
    <div class="control-group">
  <label><input type="checkbox" id="toggle-50" checked> Show MED-50</label><br/>
  <label><input type="checkbox" id="toggle-100" checked> Show MED-100</label><br/>
  <label><input type="checkbox" id="toggle-200" checked> Show MED-200</label>
</div>
<div id="chartContainer">
  <canvas id="medianChart"></canvas>
</div>
  </div>`;

    $("body").prepend(uiHTML);

    // init order: chart → events → observer
    initRollingWindows();
    initWindowEvents();
    refreshChartForTarget();
    observeRollChanges();
  }
})();

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
