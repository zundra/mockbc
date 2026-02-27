// ==UserScript==
// @name         bc.game ratio chart v1
// @namespace    http://tampermonkey.net/
// @version      6
// @description  rolling ratio chart with dynamic target switching
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
  const MAX_RESULTS = 1000;
  const PLOT_1_LABEL = "Total Ratio";
  const PLOT_1_Y_SCALE = "yRatio";

  const dataAggregator = initDataAggregator();
  let lastRollSet = [];
  let currentRollSet = [];
  let cumulativeWins = [0]; // prefix sum of wins for current target
  let ratioChart;
  let rollNum = 0;
  let maxSeen = 0;
  let minSeen = 1000000;
  let lastRatio = 0;
  let mark1 = null;
  let lastPopRoll = null;
  const popEvents = []; // {roll, result, ratio}

  const PULLBACK_THRESHOLD = -200; // Mark-1 when ratio <= this
  const POP_UP_THRESHOLD = 50; // Mark-2 when ratio >= this
  const MAX_LOG_ITEMS = 20; // cap the tape length

  let pendingPop = null; // { m1Roll, m1Ratio }
  // -------------------------------------------------------------------
  // Main entry
  // -------------------------------------------------------------------
  injectUI();

  // -------------------------------------------------------------------
  // Roll handling
  // -------------------------------------------------------------------
  function evalResult(result) {
    if (result === -1) return; // no new roll

    dataAggregator.push(result);

    const ratioVal = dataAggregator.getRatio();
    updatePopDetector(result, ratioVal, rollNum + 1); // <-- new FSM logic

    renderChart(ratioVal);
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

  function renderChart(ratioVal) {
    rollNum++;

    ratioChart.data.labels.push(rollNum);
    cap(ratioChart.data.labels);

    const ratio = ratioChart.data.datasets.find(
      (ds) => ds.label === PLOT_1_LABEL
    );

    ratio.data.push(ratioVal);
    cap(ratio.data);

    updateExtremes(ratio, ratioVal);

    // Build annotations for each dataset’s extremes
    const annos = {};
    [ratio].forEach((ds) => {
      const { min, max, zero } = getExtremes(ds);
      if (!isFinite(min) || !isFinite(max)) return;
      annos[`${ds.label}-min`] = {
        type: "line",
        yMin: min,
        yMax: min,
        borderColor: ds.borderColor,
        borderDash: [4, 4],
        borderWidth: 1
      };
      annos[`${ds.label}-max`] = {
        type: "line",
        yMin: max,
        yMax: max,
        borderColor: ds.borderColor,
        borderDash: [4, 4],
        borderWidth: 1
      };
      annos[`${ds.label}-zero`] = {
        type: "line",
        yMin: zero,
        yMax: zero,
        borderColor: "gray",
        borderWidth: 1
      };
    });

    ratioChart.options.plugins.annotation.annotations = annos;
    ratioChart.update();
  }

  function updatePopDetector(result, ratioVal, currentRoll) {
    if (!pendingPop) {
      // Look for Mark-1 (pullback below threshold)
      if (ratioVal <= PULLBACK_THRESHOLD && lastRatio > PULLBACK_THRESHOLD) {
        pendingPop = { m1Roll: currentRoll, m1Ratio: ratioVal };
        lastPopRoll = currentRoll;

        const event = createEvent(
          ratioVal,
          result,
          pendingPop,
          lastPopRoll,
          true
        );
        appendPopRow(event); // add as pending
        addPopAnnotations(event, true);
      }
    } else {
      // Look for Mark-2 (pop back above threshold)
      if (ratioVal >= POP_UP_THRESHOLD && lastRatio < POP_UP_THRESHOLD) {
        const event = createEvent(
          ratioVal,
          result,
          pendingPop,
          currentRoll,
          false
        );
        resolvePopRow(event); // flip from pending → resolved
        popEvents.unshift(event);
        if (popEvents.length > MAX_LOG_ITEMS) popEvents.pop();

        addPopAnnotations(event, false);

        pendingPop = null;
        lastPopRoll = null;
      } else if (lastPopRoll !== null) {
        // Update pending row live
        const event = createEvent(
          ratioVal,
          result,
          pendingPop,
          currentRoll,
          true
        );
        updatePopRow(event);
      }
    }
    lastRatio = ratioVal;
  }

  function createEvent(ratioVal, result, pending, currentRoll, isPending) {
    return {
      m1Roll: pending.m1Roll,
      m1Ratio: pending.m1Ratio,
      m2Ratio: ratioVal,
      payout: result,
      currentRoll: currentRoll,
      deltaRolls: currentRoll - pending.m1Roll,
      isPending: isPending
    };
  }

  function appendPopRow(ev) {
    const li = document.createElement("li");
    li.setAttribute("id", `pop-item-${ev.m1Roll}`);
    li.classList.add("pending");

    li.style.display = "flex";
    li.style.justifyContent = "space-between";
    li.style.gap = "6px";
    li.style.fontFamily = "monospace";
    li.style.color = "#ccc";

    li.innerHTML = formatPopRow(ev);

    const list = document.getElementById("pop-list");
    list.prepend(li);
    if (list.childElementCount > MAX_LOG_ITEMS) {
      list.removeChild(list.lastChild);
    }
  }

  function updatePopRow(ev) {
    const li = document.getElementById(`pop-item-${ev.m1Roll}`);
    if (!li) return;
    li.innerHTML = formatPopRow(ev);
  }

  function resolvePopRow(ev) {
    const li = document.getElementById(`pop-item-${ev.m1Roll}`);
    if (!li) return;

    // Decide success (payout big enough to cover ΔRolls)
    const success = ev.payout >= ev.deltaRolls;
    li.classList.remove("pending");
    li.style.color = success ? "#6f6" : "#f66";
    li.innerHTML = formatPopRow(ev);
  }

  function formatPopRow(ev) {
    return `
    <span>#${ev.currentRoll}</span>
    <span>${ev.payout.toFixed(2)}x</span>
    <span>${ev.m1Ratio.toFixed(1)} → ${ev.m2Ratio.toFixed(1)}</span>
    <span>${ev.deltaRolls}</span>
  `;
  }

  function addPopAnnotations(ev, isPending) {
    const annos = ratioChart.options.plugins.annotation.annotations || {};

    if (isPending) {
      annos[`m1-${ev.m1Roll}`] = {
        type: "line",
        xMin: ev.m1Roll,
        xMax: ev.m1Roll,
        borderColor: "rgba(255,255,0,0.7)",
        borderDash: [4, 4],
        borderWidth: 1,
        label: {
          enabled: true,
          content: `M1 ${ev.m1Ratio.toFixed(1)}`,
          position: "start",
          backgroundColor: "rgba(0,0,0,0.8)",
          color: "#fff",
          font: { size: 10 }
        }
      };
    } else {
      annos[`m2-${ev.currentRoll}`] = {
        type: "line",
        xMin: ev.currentRoll,
        xMax: ev.currentRoll,
        borderColor: "purple",
        borderWidth: 2,
        label: {
          enabled: true,
          content: `${ev.payout.toFixed(2)}x | M2 ${ev.m2Ratio.toFixed(1)}`,
          position: "end",
          backgroundColor: "rgba(0,0,0,0.8)",
          color: "#fff",
          font: { size: 10 }
        }
      };
    }

    ratioChart.options.plugins.annotation.annotations = annos;
  }

  function getExtremes(/* ds */) {
    return { min: minSeen, max: maxSeen, zero: 0 };
  }

  function updateExtremes(ds, val) {
    if (val === null || isNaN(val)) return;
    minSeen = Math.min(minSeen, val);
    maxSeen = Math.max(maxSeen, val);
    ds.min = Math.min(ds.min ?? val, val);
    ds.max = Math.max(ds.max ?? val, val);
  }

  function resetChartData() {
    if (!ratioChart) return;
    ratioChart.data.labels = [];
    ratioChart.data.datasets.forEach((ds) => (ds.data = []));
    ratioChart.update();
  }

  function initDataAggregator() {
    class DataAggregator {
      constructor() {
        this.ratio = 0;
        this.targets = this.generateTargets();
      }
      getRatio = () => this.ratio;
      push(result) {
        this.ratio = 0;
        for (let i = 0; i < this.targets.length; i++) {
          const target = this.targets[i];
          target.push(result);
          this.ratio += target.getRatio();
        }
      }
      generateTargets = () => {
        class Target {
          constructor(payout) {
            this.streak = 0;
            this.payout = payout;
          }
          push = (result) => {
            if (result >= this.payout) {
              this.streak = Math.max(this.streak + 1, 1);
            } else {
              this.streak = Math.min(this.streak - 1, -1);
            }

            this.losingStreak = this.streak < 0 ? Math.abs(this.streak) : 0;
          };

          getStreakDelta = () => this.streak + this.payout;
          getRatio = () => this.getStreakDelta() / this.payout;
        }
        return this.generatePayouts().map((payout) => new Target(payout));
      };

      generatePayouts() {
        return Array.from(
          {
            length: 300
          },
          (v, k) => 2 + k * 0.5
        );
      }
    }
    return new DataAggregator();
  }
  // -------------------------------------------------------------------
  // Chart setup
  // -------------------------------------------------------------------
  function initRatioChart() {
    const ctx = document.getElementById("ratioChart").getContext("2d");

    if (ratioChart) ratioChart.destroy();
    /*
const datasets = [{
  label: PLOT_1_LABEL,
  data: [],
  borderWidth: 2,
  pointRadius: 0,
  yAxisID: "yRatio",
  fill: false,
  tension: 0.1,
  segment: {
    borderColor: ctx => {
      const y = ctx.p1.parsed.y;
      return y >= 0 ? "green" : "red";
    }
  }
}];
*/
    const datasets = [
      {
        label: PLOT_1_LABEL,
        data: [],
        borderWidth: 2,
        pointRadius: 0,
        yAxisID: "yRatio",
        fill: false,
        tension: 0.1,
        segment: {
          borderColor: (ctx) => {
            const y = ctx.p1.parsed.y;
            return y >= 0 ? "green" : "red";
          }
        }
      }
    ];

    ratioChart = new Chart(ctx, {
      type: "line",
      data: { labels: [], datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        devicePixelRatio: 2,
        scales: {
          yRatio: {
            type: "linear",
            position: "left",
            min: -1000,
            max: 1000,
            title: { display: true, text: "Ratio" }
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
    $("#ratio-chart").draggable({
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
      .html(`
      #ratio-chart {
          height: 400px;
          width: 600px;
        display: flex;
        flex-direction: row;
        gap: 12px;
        position: absolute;
        top: 300px;
        left: 470px;
        z-index: 9999;
        background: black;
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

      #ratio-chart .chart-area {
        flex: 1;
      }

      #pop-log {
        width: 250px;
        height: 100%;
        overflow-y: auto;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        font-size: 12px;
        padding: 8px;
        border-radius: 6px;
        font-family: monospace;
      }
      #pop-log .pop-log-header {
        display: flex;
        justify-content: space-between;
        gap: 6px;
        font-weight: bold;
        border-bottom: 1px solid #666;
        margin-bottom: 4px;
      }

      #pop-list {
        list-style: none;
        padding: 0;
        margin: 0;
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
`).appendTo("head");

    const uiHTML = `<div id="ratio-chart" class="container">
    <div class="chart-area">
      <canvas id="ratioChart"></canvas>
    </div>
    <div id="pop-log">
      <div class="pop-log-header">
        <span>Roll</span>
        <span>Payout</span>
        <span>M1→M2</span>
        <span>ΔRolls</span>
      </div>
      <ul id="pop-list"></ul>
    </div>
  </div>

`;

    $("body").prepend(uiHTML);

    // init order: chart → events → observer
    initRollingWindows();
    initWindowEvents();
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
