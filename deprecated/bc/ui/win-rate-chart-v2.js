// ==UserScript==
// @name         bc.game win rate chart v2
// @namespace    http://tampermonkey.net/
// @version      6
// @description  rolling winrate chart with dynamic target switching
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
const MAX_RESULTS = 500;
  let lastRollSet = [];
  let currentRollSet = [];
  let resultsHistory = []; // raw results (multipliers)
  let cumulativeWins = [0]; // prefix sum of wins for current target
  let leashValues = [];
  const ROLLING_SMA = initRollingSMA(10);
  let rollNum = 0;
  let newWindow = null;
  let winrateChart;
  let currentTarget = 0;

const extremes = {
  "WR-50": { min: Infinity, max: -Infinity },
  "WR-100": { min: Infinity, max: -Infinity },
  "WR-200": { min: Infinity, max: -Infinity },
  "Leash": { min: Infinity, max: -Infinity }
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
    resultsHistory.push(result);
    cap(resultsHistory);
    // compute win for current target
    const win = result >= currentTarget ? 1 : 0;
    cumulativeWins.push(cumulativeWins[cumulativeWins.length - 1] + win);
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
    max: Math.max(...vals),
  };
}

function simpleMovingAverage(values, period) {
  const result = [];
  let sum = 0;

  for (let i = 0; i < values.length; i++) {
    sum += values[i];

    if (i >= period) {
      sum -= values[i - period];
      result.push(sum / period);
    } else {
      // average of all values seen so far
      result.push(sum / (i + 1));
    }
  }

  return result[result.length - 1]
}


function renderChart() {
  const wr50 = getWinRate(50, rollNum);
  const wr100 = getWinRate(100, rollNum);
  const wr200 = getWinRate(200, rollNum);
  const teo = (1 / currentTarget) * 100;

  const leashVal = ROLLING_SMA.update(rollNum >= 200 ? wr50 - wr200 : null);

  winrateChart.data.labels.push(rollNum);
  cap(winrateChart.data.labels);

  const dsTEO   = winrateChart.data.datasets.find((ds) => ds.label === "TEO");
  const dsWR50  = winrateChart.data.datasets.find((ds) => ds.label === "WR-50");
  const dsWR100 = winrateChart.data.datasets.find((ds) => ds.label === "WR-100");
  const dsWR200 = winrateChart.data.datasets.find((ds) => ds.label === "WR-200");
  const dsLeash = winrateChart.data.datasets.find((ds) => ds.label === "Leash");


  dsTEO.data.push(teo);        cap(dsTEO.data);
  dsWR50.data.push(rollNum >= 50  ? wr50  : null); cap(dsWR50.data);
  updateExtremes(dsWR50, wr50);
  dsWR100.data.push(rollNum >= 100 ? wr100 : null); cap(dsWR100.data);
  updateExtremes(dsWR100, wr100);
  dsWR200.data.push(rollNum >= 200 ? wr200 : null); cap(dsWR200.data);
  updateExtremes(dsWR200, wr200);
  dsLeash.data.push(leashVal); cap(dsLeash.data);




  // Build annotations for each dataset’s extremes
  const annos = {};
  [dsWR50, dsWR100, dsWR200].forEach((ds) => {
    const {min, max} = getExtremes(ds);
    if (!isFinite(min) || !isFinite(max)) return;
    annos[`${ds.label}-min`] = {
      type: "line",
      yMin: extremes[ds.label].min,
      yMax: extremes[ds.label].min,
      borderColor: ds.borderColor,
      borderDash: [4, 4],
      borderWidth: 1,
    };
    annos[`${ds.label}-max`] = {
      type: "line",
      yMin: extremes[ds.label].max,
      yMax: extremes[ds.label].max,
      borderColor: ds.borderColor,
      borderDash: [4, 4],
      borderWidth: 1,
    };
  });

  winrateChart.options.plugins.annotation.annotations = annos;

  const windowSize = 300; // number of rolls visible
  winrateChart.options.scales.x.min = Math.max(0, rollNum - windowSize);
  winrateChart.options.scales.x.max = rollNum;
  winrateChart.update()
  winrateChart.update();
}

function getExtremes(ds) {
  const vals = ds.data.filter((v) => v !== null && !isNaN(v));
  return {
    min: Math.min(...vals),
    max: Math.max(...vals),
  };
}

function updateExtremes(labelObject, val) {
    const label = labelObject.label;
const teo = (1 / currentTarget) * 100;
const tolerance = 20; // % points

if (val > teo - tolerance && val < teo + tolerance) {
  extremes[label].min = Math.min(extremes[label].min, val);
  extremes[label].max = Math.max(extremes[label].max, val);
}
}

  function getWinRate(windowSize, rollIndex) {
    if (rollIndex < windowSize) return 0;
    const wins =
      cumulativeWins[rollIndex] - cumulativeWins[rollIndex - windowSize];
    return (wins / windowSize) * 100;
  }

  function resetChartData() {
    if (!winrateChart) return;
    winrateChart.data.labels = [];
    winrateChart.data.datasets.forEach((ds) => (ds.data = []));
    winrateChart.update();
  }

  function rebuildCumulativeWins() {
    cumulativeWins = [0];
    for (let i = 0; i < resultsHistory.length; i++) {
      const win = resultsHistory[i] >= currentTarget ? 1 : 0;
      cumulativeWins.push(cumulativeWins[i] + win);
    }
  }

  function refreshChartForTarget() {
    if (!winrateChart) return;
    rebuildCumulativeWins();
    resetChartData();

    for (let i = 1; i <= resultsHistory.length; i++) {
      winrateChart.data.labels.push(i);
      winrateChart.data.datasets
        .find((ds) => ds.label === "WR-50")
        .data.push(getWinRate(50, i));
      winrateChart.data.datasets
        .find((ds) => ds.label === "WR-100")
        .data.push(getWinRate(100, i));
      winrateChart.data.datasets
        .find((ds) => ds.label === "WR-200")
        .data.push(getWinRate(200, i));
      winrateChart.data.datasets
        .find((ds) => ds.label === "TEO")
        .data.push((1 / currentTarget) * 100);
      winrateChart.data.datasets
        .find((ds) => ds.label === "Leash")
        .data.push(getWinRate(50, i) - getWinRate(200, i));
    }

    rollNum = resultsHistory.length;
    winrateChart.update();
  }

  // -------------------------------------------------------------------
  // Chart setup
  // -------------------------------------------------------------------
  function initRollingWindows() {
    const ctx = document.getElementById("winrateChart").getContext("2d");
    debugger;
    if (winrateChart) winrateChart.destroy();

    const datasets = [
      { label: "WR-50", borderColor: "green" },
      { label: "WR-100", borderColor: "blue" },
      { label: "WR-200", borderColor: "red" }
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

    datasets.push({
      label: "TEO",
      data: [],
      borderColor: "white",
      borderDash: [5, 5],
      borderWidth: 1,
      pointRadius: 0,
      yAxisID: "yWinRate",
      fill: false,
      tension: 0
    });

    datasets.push({
      label: "Leash",
      data: [],
      borderColor: "purple",
      borderWidth: 1,
      pointRadius: 0,
      yAxisID: "yLeash",
      fill: false,
      tension: 0.1
    });

    winrateChart = new Chart(ctx, {
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
            max: 100,
            title: { display: true, text: "Win Rate (%)" }
          },
          yLeash: {
            type: "linear",
            position: "right",
            min: -50,
            max: 50,
            grid: { drawOnChartArea: false },
            title: { display: true, text: "Leash (WR-50 – WR-200)" }
          },
          x: { title: { display: true, text: "Roll #" } }
        }
      }
    });
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
      { id: "#toggle-50", label: "WR-50" },
      { id: "#toggle-100", label: "WR-100" },
      { id: "#toggle-200", label: "WR-200" }
    ];

    toggles.forEach((t) => {
      const el = $(t.id);
      el.on("change", () => {
        const ds = winrateChart.data.datasets.find((d) => d.label === t.label);
        ds.hidden = !el.prop("checked");
        winrateChart.update();
      });
    });

    $("#win-rates-chart").draggable({
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
 return new RollingSMA(period)
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
        #win-rates-chart {
          height: 1000px;
          width: 1000px;
      position: absolute;
              top: 300px;
              left: 470px;
     z-index: 9999;
        }
                .container {
      font-family: Arial, sans-serif;
      background-color: #1e2323;
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
            }


             /* Draggable Stats Pane */
              .stats-pane {
              position: absolute;
              top: 300px;
              left: 470px;
              background-color: rgba(42, 45, 46, 0.95);
              padding: 15px;
              border-radius: 8px;
              box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
              z-index: 1000;
              cursor: move;
              width: 300px;
              }
              .stats-pane h2 {
              font-size: 1rem;
              color: #00bcd4;
              margin-bottom: 10px;
              }
              .stats-pane div {
              margin-bottom: 5px;
              font-size: 0.9rem;
              }
              .stats-pane span {
              color: #fff;
              font-weight: bold;
              }
                    .stats-block {
      margin-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      padding-bottom: 5px;
      }
      #watch-target-table th,
      #watch-target-table td {
        text-align: left;
      }`
      )
      .appendTo("head");

    const uiHTML = `<div id="win-rates-chart" class="container">
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
  <label><input type="checkbox" id="toggle-50" checked> Show WR-50</label><br/>
  <label><input type="checkbox" id="toggle-100" checked> Show WR-100</label><br/>
  <label><input type="checkbox" id="toggle-200" checked> Show WR-200</label>
</div>
<div id="chartContainer">
  <canvas id="winrateChart"></canvas>
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
  const inputField = $("#test-mode");
  return inputField.length !== 0 && inputField.prop("checked");
}

let mbc;
if (getIsTestMode()) {
  mbc = new MockBC(
    0,
    "Y83TpC2hj2SnjiNEDJwN",
    "9b98254e8986dd95349fc754b4b087b5d0ddf9771026d68fe4ed661c869420b4"
  );
}
