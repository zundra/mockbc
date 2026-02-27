// ==UserScript==
// @name         bc.game stats charts
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
  const WINDOW_SIZE = 200;
  const MAX_RESULTS = 500;
  const dataAggregator = initDataAggregator();
  let lastRollSet = [];
  let currentRollSet = [];

  // Ratio chart input
  const PLOT_1_LABEL = "Total Ratio";
  const PLOT_1_Y_SCALE = "yRatio";
  let ratioChart;
  let minSeenRatio = Infinity;
  let maxSeenRatio = -Infinity;
  let lastRatio = 0;
  let mark1 = null;
  // let lastPopRoll = null;
  const popEvents = []; // {roll, result, ratio}
  const PULLBACK_THRESHOLD = -200; // Mark-1 when ratio <= this
  const POP_UP_THRESHOLD = 50; // Mark-2 when ratio >= this
  const MAX_LOG_ITEMS = 20; // cap the tape length
  // let pendingPop = null; // { m1Roll, m1Ratio }

  // Wind up chart input
  const Y_MIN       = -5;
  const Y_MAX       =  5;
  let windupChart;
  let minSeenWindUp = Infinity;
  let maxSeenWindUp = -Infinity;

  // Win rate charts input
  let resultsHistory = []; // raw results (multipliers)
  let cumulativeWins = [0]; // prefix sum of wins for current target
  const ROLLING_SMA = initRollingSMA(10);
  let rollNum = 0;
  let newWindow = null;
  let winrateChart;
  let currentTarget = 0;

  const extremes = {
    "WR-50": { min: Infinity, max: -Infinity },
    "WR-100": { min: Infinity, max: -Infinity },
    "WR-200": { min: Infinity, max: -Infinity }
  };


  //Median chart input
  let medianChart;
    const medianExtremes = {
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
    rollNum++;
    recordRoll(result);
    dataAggregator.push(result);
    renderWinRateChart();
    renderWindUpChart();
    renderRatioChart(result);
    renderMedianChart();
  }

  function recordRoll(result) {
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
      max: Math.max(...vals)
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

    return result[result.length - 1];
  }

  function renderRatioChart(result) {
    const ratioVal = dataAggregator.getRatio();
    //updatePopDetector(result, ratioVal, rollNum + 1); // <-- new FSM logic

    // update extremes
    if (isFinite(ratioVal)) {
      minSeenRatio = Math.min(minSeenRatio, ratioVal);
      maxSeenRatio = Math.max(maxSeenRatio, ratioVal);
    }

    ratioChart.data.labels.push(rollNum);
    cap(ratioChart.data.labels);

    const ratio = ratioChart.data.datasets.find(
      (ds) => ds.label === PLOT_1_LABEL
    );

    ratio.data.push(ratioVal);
    cap(ratio.data);

    // update annotation lines
    const annos = {};
    if (isFinite(minSeenRatio)) {
      annos["minLine"] = {
        type: "line",
        yMin: minSeenRatio,
        yMax: minSeenRatio,
        borderColor: "cyan",
        borderDash: [4, 4],
        borderWidth: 1
      };
    }
    if (isFinite(maxSeenRatio)) {
      annos["maxLine"] = {
        type: "line",
        yMin: maxSeenRatio,
        yMax: maxSeenRatio,
        borderColor: "orange",
        borderDash: [4, 4],
        borderWidth: 1
      };
    }
    annos["zeroLine"] = {
      type: "line",
      yMin: 0,
      yMax: 0,
      borderColor: "white",
      borderWidth: 1
    };
    ratioChart.options.plugins.annotation.annotations = annos;
    ratioChart.update();
  }

  // function updatePopDetector(result, ratioVal, currentRoll) {
  //   if (!pendingPop) {
  //     // Look for Mark-1 (pullback below threshold)
  //     if (ratioVal <= PULLBACK_THRESHOLD && lastRatio > PULLBACK_THRESHOLD) {
  //       pendingPop = { m1Roll: currentRoll, m1Ratio: ratioVal };
  //       lastPopRoll = currentRoll;

  //       const event = createEvent(
  //         ratioVal,
  //         result,
  //         pendingPop,
  //         lastPopRoll,
  //         true
  //       );
  //       appendPopRow(event); // add as pending
  //       addPopAnnotations(event, true);
  //     }
  //   } else {
  //     // Look for Mark-2 (pop back above threshold)
  //     if (ratioVal >= POP_UP_THRESHOLD && lastRatio < POP_UP_THRESHOLD) {
  //       const event = createEvent(
  //         ratioVal,
  //         result,
  //         pendingPop,
  //         currentRoll,
  //         false
  //       );
  //       resolvePopRow(event); // flip from pending → resolved
  //       popEvents.unshift(event);
  //       if (popEvents.length > MAX_LOG_ITEMS) popEvents.pop();

  //       addPopAnnotations(event, false);

  //       pendingPop = null;
  //       lastPopRoll = null;
  //     } else if (lastPopRoll !== null) {
  //       // Update pending row live
  //       const event = createEvent(
  //         ratioVal,
  //         result,
  //         pendingPop,
  //         currentRoll,
  //         true
  //       );
  //       updatePopRow(event);
  //     }
  //   }
  //   lastRatio = ratioVal;
  // }

 // function createEvent(ratioVal, result, pending, currentRoll, isPending) {
 //    return {
 //      m1Roll: pending.m1Roll,
 //      m1Ratio: pending.m1Ratio,
 //      m2Ratio: ratioVal,
 //      payout: result,
 //      currentRoll: currentRoll,
 //      deltaRolls: currentRoll - pending.m1Roll,
 //      isPending: isPending
 //    };
 //  }

  // function appendPopRow(ev) {
  //   const li = document.createElement("li");
  //   li.setAttribute("id", `pop-item-${ev.m1Roll}`);
  //   li.classList.add("pending");

  //   li.style.display = "flex";
  //   li.style.justifyContent = "space-between";
  //   li.style.gap = "6px";
  //   li.style.fontFamily = "monospace";
  //   li.style.color = "#ccc";

  //   li.innerHTML = formatPopRow(ev);

  //   const list = document.getElementById("pop-list");
  //   list.prepend(li);
  //   if (list.childElementCount > MAX_LOG_ITEMS) {
  //     list.removeChild(list.lastChild);
  //   }
  // }

  // function updatePopRow(ev) {
  //   const li = document.getElementById(`pop-item-${ev.m1Roll}`);
  //   if (!li) return;
  //   li.innerHTML = formatPopRow(ev);
  // }

  // function resolvePopRow(ev) {
  //   const li = document.getElementById(`pop-item-${ev.m1Roll}`);
  //   if (!li) return;

  //   // Decide success (payout big enough to cover ΔRolls)
  //   const success = ev.payout >= ev.deltaRolls;
  //   li.classList.remove("pending");
  //   li.style.color = success ? "#6f6" : "#f66";
  //   li.innerHTML = formatPopRow(ev);
  // }

  // function formatPopRow(ev) {
  //   return `
  //   <span>#${ev.currentRoll}</span>
  //   <span>${ev.payout.toFixed(2)}x</span>
  //   <span>${ev.m1Ratio.toFixed(1)} → ${ev.m2Ratio.toFixed(1)}</span>
  //   <span>${ev.deltaRolls}</span>
  // `;
  // }

  // function addPopAnnotations(ev, isPending) {
  //   const annos = ratioChart.options.plugins.annotation.annotations || {};

  //   if (isPending) {
  //     annos[`m1-${ev.m1Roll}`] = {
  //       type: "line",
  //       xMin: ev.m1Roll,
  //       xMax: ev.m1Roll,
  //       borderColor: "rgba(255,255,0,0.7)",
  //       borderDash: [4, 4],
  //       borderWidth: 1,
  //       label: {
  //         enabled: true,
  //         content: `M1 ${ev.m1Ratio.toFixed(1)}`,
  //         position: "start",
  //         backgroundColor: "rgba(0,0,0,0.8)",
  //         color: "#fff",
  //         font: { size: 10 }
  //       }
  //     };
  //   } else {
  //     annos[`m2-${ev.currentRoll}`] = {
  //       type: "line",
  //       xMin: ev.currentRoll,
  //       xMax: ev.currentRoll,
  //       borderColor: "purple",
  //       borderWidth: 2,
  //       label: {
  //         enabled: true,
  //         content: `${ev.payout.toFixed(2)}x | M2 ${ev.m2Ratio.toFixed(1)}`,
  //         position: "end",
  //         backgroundColor: "rgba(0,0,0,0.8)",
  //         color: "#fff",
  //         font: { size: 10 }
  //       }
  //     };
  //   }

  //   ratioChart.options.plugins.annotation.annotations = annos;
  // }

  function renderWindUpChart() {
    const windupVal = dataAggregator.getAvgDelta();

    if (rollNum < 100) return;

    // update extremes
    if (isFinite(windupVal)) {
      minSeenWindUp = Math.min(minSeenWindUp, windupVal);
      maxSeenWindUp = Math.max(maxSeenWindUp, windupVal);
    }

    windupChart.data.labels.push(rollNum);
    cap(windupChart.data.labels);

    const ds = windupChart.data.datasets[0];
    ds.data.push(windupVal);
    cap(ds.data);

    // update annotation lines
    const annos = {};
    if (isFinite(minSeenWindUp)) {
      annos["minLine"] = {
        type: "line",
        yMin: minSeenWindUp,
        yMax: minSeenWindUp,
        borderColor: "cyan",
        borderDash: [4, 4],
        borderWidth: 1
      };
    }
    if (isFinite(maxSeenWindUp)) {
      annos["maxLine"] = {
        type: "line",
        yMin: maxSeenWindUp,
        yMax: maxSeenWindUp,
        borderColor: "orange",
        borderDash: [4, 4],
        borderWidth: 1
      };
    }
    annos["zeroLine"] = {
      type: "line",
      yMin: 0,
      yMax: 0,
      borderColor: "white",
      borderWidth: 1
    };
    windupChart.options.plugins.annotation.annotations = annos;

    windupChart.update();
  }

  function renderWinRateChart() {
    const wr50 = getWinRate(50, rollNum);
    const wr100 = getWinRate(100, rollNum);
    const wr200 = getWinRate(200, rollNum);
    const teo = (1 / currentTarget) * 100;

    winrateChart.data.labels.push(rollNum);
    cap(winrateChart.data.labels);

    const dsTEO = winrateChart.data.datasets.find((ds) => ds.label === "TEO");
    const dsWR50 = winrateChart.data.datasets.find(
      (ds) => ds.label === "WR-50"
    );
    const dsWR100 = winrateChart.data.datasets.find(
      (ds) => ds.label === "WR-100"
    );
    const dsWR200 = winrateChart.data.datasets.find(
      (ds) => ds.label === "WR-200"
    );

    dsTEO.data.push(teo);
    cap(dsTEO.data);
    dsWR50.data.push(rollNum >= 50 ? wr50 : null);
    cap(dsWR50.data);
    updateExtremes(dsWR50, wr50);
    dsWR100.data.push(rollNum >= 100 ? wr100 : null);
    cap(dsWR100.data);
    updateExtremes(dsWR100, wr100);
    dsWR200.data.push(rollNum >= 200 ? wr200 : null);
    cap(dsWR200.data);
    updateExtremes(dsWR200, wr200);

    // Build annotations for each dataset’s extremes
    const annos = {};
    [dsWR50, dsWR100, dsWR200].forEach((ds) => {
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

    winrateChart.options.plugins.annotation.annotations = annos;

    const windowSize = 300; // number of rolls visible
    winrateChart.options.scales.x.min = Math.max(0, rollNum - windowSize);
    winrateChart.options.scales.x.max = rollNum;
    winrateChart.update();
    winrateChart.update();
  }


  function renderMedianChart() {
    const med50 = dataAggregator.rollingStats.getMedian(50);
    const med100 = dataAggregator.rollingStats.getMedian(100);
    const med200 = dataAggregator.rollingStats.getMedian(200);

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
    updateMedianExtremes(dsMED50, med50);
    dsMED100.data.push(rollNum >= 100 ? med100 : null);
    cap(dsMED100.data);
    updateMedianExtremes(dsMED100, med100);
    dsMED200.data.push(rollNum >= 200 ? med200 : null);
    cap(dsMED200.data);
    updateMedianExtremes(dsMED200, med200);

    // Build annotations for each dataset’s extremes
    const annos = {};
    [dsMED50, dsMED100, dsMED200].forEach((ds) => {
      const { min, max } = getExtremes(ds);
      if (!isFinite(min) || !isFinite(max)) return;
      annos[`${ds.label}-min`] = {
        type: "line",
        yMin: medianExtremes[ds.label].min,
        yMax: medianExtremes[ds.label].min,
        borderColor: ds.borderColor,
        borderDash: [4, 4],
        borderWidth: 1
      };
      annos[`${ds.label}-max`] = {
        type: "line",
        yMin: medianExtremes[ds.label].max,
        yMax: medianExtremes[ds.label].max,
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
    const teo = (1 / currentTarget) * 100;
    const tolerance = 20; // % points

    if (val > teo - tolerance && val < teo + tolerance) {
      extremes[label].min = Math.min(extremes[label].min, val);
      extremes[label].max = Math.max(extremes[label].max, val);
    }
  }

    function updateMedianExtremes(labelObject, val) {
    const label = labelObject.label;

    medianExtremes[label].min = Math.min(medianExtremes[label].min, val);
    medianExtremes[label].max = Math.max(medianExtremes[label].max, val);
  }

  // function updateRatioExtremes(ds, val) {
  //   if (val === null || isNaN(val)) return;
  //   minSeen = Math.min(minSeen, val);
  //   maxSeen = Math.max(maxSeen, val);
  //   ds.min = Math.min(ds.min ?? val, val);
  //   ds.max = Math.max(ds.max ?? val, val);
  // }

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
    }

    rollNum = resultsHistory.length;
    winrateChart.update();
  }

  // -------------------------------------------------------------------
  // Chart setup
  // -------------------------------------------------------------------
  function initWinRateChart() {
    const ctx = document.getElementById("winrateChart").getContext("2d");
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
            position: "right",
            ticks: {
              color: "#fff",
            },
            min: 0,
            max: 100,
            title: { display: true, text: "Win Rate (%)" }
          },
          x: { title: { display: true, text: "Roll #" } }
        }
      }
    });
  }


 function initRatioChart() {
    const ctx = document.getElementById("ratioChart").getContext("2d");

    if (ratioChart) ratioChart.destroy();

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
            ticks: {
              color: "#fff",
            },
            type: "linear",
            position: "right",
            min: -1000,
            max: 1000,
            title: { display: true, text: "Ratio" }
          },
          x: { title: { display: true, text: "Roll #" } }
        }
      }
    });
  }

    function initWindupChart() {
    const ctx = document.getElementById("windupSumChart").getContext("2d");
    if (windupChart) windupChart.destroy();

    windupChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          label: "Σ ΔWR% vs TEO",
          data: [],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.1,
          yAxisID: "yWindup",
          segment: {
            borderColor: (ctx) => (ctx.p1.parsed.y >= 0 ? "green" : "red")
          }
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        devicePixelRatio: 2,
        scales: {
          yWindup: {
            ticks: {
              color: "#fff",
            },
            type: "linear",
            position: "right",
            min: Y_MIN,
            max: Y_MAX,
            title: { display: true, text: "Σ ΔWR% vs TEO" }
          },
          x: { title: { display: true, text: "Roll #" } }
        },
        plugins: { annotation: { annotations: {} } }
      }
    });
  }

    function initMedDevChart() {
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
            position: "right",
            ticks: {
              color: "#fff",
            },
            min: 0,
            max: 3,
            title: { display: true, text: "Win Rate (%)" }
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

    $("#draggable-charts-container").draggable({
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

  function initDataAggregator() {
    class DataAggregator {
      constructor() {
        this.ratio = 0;
        this.lastAvg = 0;
        this.targets = this.generateTargets();
        this.rollingStats = this.generateRollingStats();
      }
      getAvgDelta = () => this.lastAvg;
      getRatio = () => this.ratio;
      push(result) {
      this.rollingStats.push(result);
      let sum = 0, count = 0;
        this.ratio = 0;
        for (let i = 0; i < this.targets.length; i++) {
          const target = this.targets[i];
          target.push(result);
          const d = target.deltaPercentOfTEO();
          if (d !== null) { sum += d; count++; }
          this.ratio += target.getRatio();
        }
        this.lastAvg = count > 0 ? sum / count : 0;
      }
      generateTargets = () => {
        class Target {
          constructor(payout) {
            this.streak = 0;
            this.payout = payout;
            this.results = [];
            this.window = WINDOW_SIZE;
            this.wins = 0;
          }
          push = (result) => {
            this.results.push(result);
            if (result >= this.payout) this.wins++;
            if (this.results.length > this.window) {
              const removed = this.results.shift();
              if (removed >= this.payout) this.wins--;
            }

            if (result >= this.payout) {
              this.streak = Math.max(this.streak + 1, 1);
            } else {
              this.streak = Math.min(this.streak - 1, -1);
            }

            this.losingStreak = this.streak < 0 ? Math.abs(this.streak) : 0;
          };

          getStreakDelta = () => this.streak + this.payout;
          getRatio = () => this.getStreakDelta() / this.payout;
          getWinRatePercent() {
            if (this.results.length === 0) return null;
            return (this.wins / this.results.length) * 100;
          }
          getTEO() { return (1 / this.payout) * 100; }
          deltaPercentOfTEO() {
            const wr = this.getWinRatePercent();
            if (wr === null) return null;
            return wr - this.getTEO();
          }
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

      generateRollingStats() {
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
    }
    return new DataAggregator();
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
    $("<style>")
      .prop("type", "text/css")
      .html(
        `
        #draggable-charts-container {
      position: absolute;
        top: 120px;
        left: 120px;
                z-index: 9999;
        }
      .container {
        font-family: Arial, sans-serif;
        color: white;
        margin: 0;
        padding: 0;
      }

      .chartContainer {
        width: 100%;
        flex: 1;             /* let charts share available space */
        min-height: 400px;   /* fallback minimum size */
      }

      /* Optional: weight charts differently */
      #winrateChart { flex: 2; }   /* Winrate takes 2 parts */
      #windupSumChart { flex: 1; } /* Windup takes 1 part */
      #ratioChart { flex: 1; }     /* Ratio takes 1 part */

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
      }

      .control-group input[type="checkbox"] {
        transform: scale(1.2);
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
`
      )
      .appendTo("head");

    const uiHTML = `<div class="container" id="draggable-charts-container" style="background-color: black">
    <table>
      <tr colspan="2">
        <td>
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
           sel.value = "1.92";
         })();
      </script>
   </div>
        </td>
      </tr>
      <tr>
        <td>
           <div class="chartContainer">
              <canvas id="winrateChart"></canvas>
           </div>
        </td>      
        <td>
           <div class="chartContainer">
              <canvas id="ratioChart"></canvas>
           </div>
        </td>
      </tr>
      <tr>
        <td>
           <div class="chartContainer">
          <canvas id="medianChart"></canvas>
           </div>
        </td>      
        <td>
           <div class="chartContainer">
              <canvas id="windupSumChart"></canvas>
           </div>
        </td>
      </tr>
    </div>`;

    $("body").prepend(uiHTML);

    // init order: chart → events → observer
    initWinRateChart();
    initWindupChart();
    initRatioChart();
    initMedDevChart();
    initWindowEvents();
    refreshChartForTarget();
    observeRollChanges();
  }
})();

function getIsTestMode() {
  // const inputField = $("#test-mode");
  // return inputField.length !== 0 && inputField.prop("checked");
  return false;
}

let mbc;
if (getIsTestMode()) {
  mbc = new MockBC(
    0,
    "Y83TpC2hj2SnjiNEDJwN",
    "9b98254e8986dd95349fc754b4b087b5d0ddf9771026d68fe4ed661c869420b4"
  );
}
