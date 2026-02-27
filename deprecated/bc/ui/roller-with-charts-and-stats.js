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
  let lastPopRoll = null;
  const popEvents = []; // {roll, result, ratio}
  const PULLBACK_THRESHOLD = -200; // Mark-1 when ratio <= this
  const POP_UP_THRESHOLD = 50; // Mark-2 when ratio >= this
  const MAX_LOG_ITEMS = 20; // cap the tape length
  let pendingPop = null; // { m1Roll, m1Ratio }

  // Wind up chart input
  const Y_MIN = -5;
  const Y_MAX = 5;
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
    "WR-200": { min: Infinity, max: -Infinity },
    Leash: { min: Infinity, max: -Infinity }
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
    renderTable();
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
    const ratioData = dataAggregator.getRatioData();
    const ratioVal = ratioData.ratio;

    updatePopDetector(result, ratioData, rollNum + 1); // <-- new FSM logic

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

    ratioChart.update();
  }

  function updatePopDetector(result, ratioData, currentRoll) {
    const ratioVal = ratioData.ratio;
    const minRatioPayout = ratioData.minRatioPayout;

    if (!pendingPop) {
      // Look for Mark-1 (pullback below threshold)
      if (ratioVal <= PULLBACK_THRESHOLD && lastRatio > PULLBACK_THRESHOLD) {
        pendingPop = { m1Roll: currentRoll, m1Ratio: ratioVal };
        lastPopRoll = currentRoll;

        const event = createEvent(
          ratioData,
          result,
          pendingPop,
          lastPopRoll,
          true
        );
        appendPopRow(event); // add as pending
        addPopAnnotations(event, true);
      }
    } else {
      if (
        result >= minRatioPayout ||
        (ratioVal >= POP_UP_THRESHOLD && lastRatio < POP_UP_THRESHOLD)
      ) {
        const event = createEvent(
          ratioData,
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
          ratioData,
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

  function createEvent(ratioData, result, pending, currentRoll, isPending) {
    return {
      m1Roll: pending.m1Roll,
      m1Ratio: pending.m1Ratio,
      m2Ratio: ratioData.ratio,
      payout: result,
      minRatioPayout: ratioData.minRatioPayout,
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
    const success = ev.minRatioPayout >= ev.deltaRolls;
    li.classList.remove("pending");
    li.style.color = success ? "#6f6" : "#f66";
    li.innerHTML = formatPopRow(ev);
  }

  function formatPopRow(ev) {
    return `
    <span>#${ev.currentRoll}</span>
    <span>${ev.payout.toFixed(2)}x</span>
    <span>${ev.minRatioPayout.toFixed(2)}x</span>
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
            type: "linear",
            position: "right",
            min: -500,
            max: 500,
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
        datasets: [
          {
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
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        devicePixelRatio: 2,
        scales: {
          yWindup: {
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
            min: 0,
            max: 3,
            title: { display: true, text: "Win Rate (%)" }
          },
          x: { title: { display: true, text: "Roll #" } }
        }
      }
    });
  }

  function getStreakColor(streak) {
    // streak < 0 = losing streak (cold), streak > 0 = winning streak (hot)
    const absStreak = Math.abs(streak);

    // Logistic squash: tames big streaks, emphasizes near-threshold
    const intensity = 1 / (1 + Math.exp(-0.6 * (absStreak - 3)));

    // Choose base color (red = losing, blue = winning)
    const baseColor = streak < 0 ? [200, 50, 50] : [50, 100, 220];

    // Map intensity into RGBA alpha
    const alpha = Math.min(1, intensity);

    return `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${alpha})`;
  }

  function renderTable() {
    const $tbody = $("#output-table tbody");
    $tbody.empty();

    dataAggregator.targets.forEach((entry) => {
      const payout = entry.getPayout();
      const streakUIData = entry.getStreakUIData();
      const streak = streakUIData.streak;
      const streakColor = streakUIData.streakColor;
      const sanitized = entry.getHTMLID();
      const strengthUIData = entry.getStrengthUIData();

      const row = `
      <tr>
        <td style="position: sticky; left: 0; background-color: #1e1e1e; text-align: left; padding: 4px 6px; white-space: nowrap;">
          ${payout.toFixed(2)}x
        </td>
        <td style='background-color: ${streakColor}'><span id="losing-streak-${sanitized}">${streak}</span></td>
        <td style='color: white; background-color: ${
          strengthUIData.bgColor
        }'><span id="strength-${sanitized}">${strengthUIData.value.toFixed(
        2
      )}</span></td>
      </tr>
    `;
      $tbody.append(row);
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
        this.minRatioTarget = null;
      }
      getAvgDelta = () => this.lastAvg;
      getRatio = () => this.ratio;
      getRatioData() {
        return {
          ratio: this.ratio,
          minRatioPayout: this.minRatioTarget.getPayout()
        };
      }

      minRatioPayout = () => this.minRatioPayout;

      getLowestRatioTarget() {
        if (!this.targets || this.targets.length === 0) return null;

        return this.targets.reduce((lowest, current) =>
          current.getRatio() < lowest.getRatio() ? current : lowest
        );
      }
      push(result) {
        this.rollingStats.push(result);
        let sum = 0,
          count = 0;
        this.ratio = 0;

        for (let i = 0; i < this.targets.length; i++) {
          const target = this.targets[i];
          target.push(result);
          const d = target.deltaPercentOfTEO();
          if (d !== null) {
            sum += d;
            count++;
          }
          this.ratio += target.getRatio();
          if (this.ratio > -POP_UP_THRESHOLD) {
            this.minRatioTarget = null;
          }
        }

        this.setMinRatioTarget();

        this.lastAvg = count > 0 ? sum / count : 0;
      }
      setMinRatioTarget() {
        const target = this.getLowestRatioTarget();

        if (
          this.minRatioTarget &&
          this.minRatioTarget.getPayout() < target.getPayout()
        )
          return;

        this.minRatioTarget = this.getLowestRatioTarget();
      }
      generateTargets = () => {
        class Target {
          constructor(payout, houseEdge = 0.04) {
            this.streak = 0;
            this.payout = payout;
            this.results = [];
            this.window = WINDOW_SIZE;
            this.wins = 0;
            this.teo = (1 / payout) * (1 - houseEdge); // true expected outcome

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
          getTeo = () => this.teo;
          getStreak = () => this.streak;
          getStreakDelta = () => this.streak + this.payout;
          getRatio = () => this.getStreakDelta() / this.payout;
          getWinRatePercent() {
            if (this.results.length === 0) return null;
            return (this.wins / this.results.length) * 100;
          }
          getPayout = () => this.payout;
          getTEO() {
            return (1 / this.payout) * 100;
          }
          deltaPercentOfTEO() {
            const wr = this.getWinRatePercent();
            if (wr === null) return null;
            return wr - this.getTEO();
          }

          getStrength = () => this.getTeo() * this.getStreak();

   getStreakColor() {
    const streak = this.getStreak();
    const absStreak = Math.abs(streak);

    // Logistic squash: tames big streaks, emphasizes near-threshold
    const intensity = 1 / (1 + Math.exp(-0.6 * (absStreak - 3)));

    // Choose base color (red = losing, blue = winning)
    const baseColor = streak < 0 ? [200, 50, 50] : [50, 100, 220];

    // Map intensity into RGBA alpha
    const alpha = Math.min(1, intensity);

    return `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${alpha})`;
  }
          getStrengthColor(strength) {
            const absStrength = Math.abs(strength);

            // Logistic squash: tames big streaks, emphasizes near-threshold
            const intensity = 1 / (1 + Math.exp(-0.6 * (absStrength - 3)));

            // Choose base color (red = losing, blue = winning)
            const baseColor = strength < 0 ? [200, 50, 50] : [50, 100, 220];

            // Map intensity into RGBA alpha
            const alpha = Math.min(1, intensity);

            return `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${alpha})`;
          }

          getStreakUIData() {
            const streak = this.getStreak();
            const streakColor = this.getStreakColor();
            return {streak, streakColor}
          }

          getStrengthUIData() {
            const strength = this.getStrength();

            let fgColor = "transparent";
            let bgColor = this.getStrengthColor(strength);
            return {
              value: strength,
              fgColor: fgColor,
              bgColor: bgColor
            };
          }

          getHTMLID = () =>
            this.payout
              .toString()
              .replace(/\./g, "_")
              .replace(/[^\w-]/g, "");
        }
        return this.generatePayouts().map((payout) => new Target(payout));
      };

      generatePayouts() {
        return Array.from(
          {
            length: 30
          },
          (v, k) => 2 + k * 1
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
            const sumOfSquares = vals.reduce(
              (sum, v) => sum + (v - mean) ** 2,
              0
            );
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
    .html(`
      #draggable-charts-container {
        position: absolute;
        top: 120px;
        left: 120px;
        z-index: 9999;
          overflow: auto;
  max-width: 100vw;
  max-height: 100vh;
      }


#main-layout {
  display: flex;
  flex-direction: row;
  gap: 10px;
  background: #000;
  color: white;
  font-family: Arial, sans-serif;
  width: 60vw;          /* responsive width */
  max-width: 1600px;    /* cap for big screens */
  max-height: 90vh;     /* keep it inside the viewport */
  border: 1px solid #333;
  border-radius: 6px;
  overflow: hidden;
}

      /* Left streaks panel */
      #streaks-panel {
        flex: 0 0 350px;       /* fixed-ish width */
        overflow-y: auto;
        border-right: 1px solid #333;
        background: #111;
      }

      #output-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      #output-table th, #output-table td {
        padding: 4px;
        text-align: right;
      }
      #output-table th {
        background: #1e1e1e;
        position: sticky;
        top: 0;
        z-index: 1;
      }

      /* Right charts + controls */
      #charts-panel {
        flex: 1;
        display: flex;
        flex-direction: column;
        background: #1e1e1e;
      }

      .control-group {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #292929;
        padding: 6px;
        font-size: 13px;
      }
      .control-group label {
        color: #ccc;
      }
      .control-group select {
        background: #444;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 4px;
      }
      .control-group input[type="checkbox"] {
        transform: scale(1.2);
        margin-right: 4px;
      }

.chartContainer {
  flex: 1;
  min-height: 200px;
  height: auto;         /* let it grow with content */
  width: 100%;          /* expand fully */
  overflow: visible;    /* prevent cutoff */
}

      /* Pops log */
      #pop-log {
        flex: 0 0 auto;
        max-height: 200px;
        overflow-y: auto;
        background: rgba(0,0,0,0.7);
        border-top: 1px solid #333;
        font-family: monospace;
        font-size: 12px;
        padding: 6px;
      }
      #pop-log .pop-log-header {
        display: flex;
        justify-content: space-between;
        font-weight: bold;
        border-bottom: 1px solid #666;
        margin-bottom: 4px;
      }
      #pop-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }
    `)
    .appendTo("head");

  const uiHTML = `
    <div id="draggable-charts-container">
      <div id="main-layout">
        <!-- Streaks column -->
        <div id="streaks-panel">
          <table id="output-table">
            <thead>
              <tr>
                <th>Payout</th>
                <th>Streak</th>
                <th>Strength</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>

        <!-- Charts column -->
        <div id="charts-panel">
          <div class="control-group">
            <label>Target</label>
            <select id="current-target"></select>
          </div>
          <div class="control-group">
            <label><input type="checkbox" id="toggle-50" checked> WR-50</label>
            <label><input type="checkbox" id="toggle-100" checked> WR-100</label>
            <label><input type="checkbox" id="toggle-200" checked> WR-200</label>
          </div>

          <div class="chartContainer"><canvas id="winrateChart"></canvas></div>
          <div class="chartContainer"><canvas id="windupSumChart"></canvas></div>
          <div class="chartContainer"><canvas id="medianChart"></canvas></div>
          <div class="chartContainer"><canvas id="ratioChart"></canvas></div>

          <!-- Pops log -->
          <div id="pop-log">
            <div class="pop-log-header">
              <span>Roll</span>
              <span>Payout</span>
              <span>Pivot Payout</span>
              <span>M1→M2</span>
              <span>ΔRolls</span>
            </div>
            <ul id="pop-list"></ul>
          </div>
        </div>
      </div>
    </div>
  `;

  $("body").prepend(uiHTML);

  // Init order: charts → events → observer
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
