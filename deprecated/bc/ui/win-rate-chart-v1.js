// ==UserScript==
// @name         bc.game ui v6 (winrate chart)
// @namespace    http://tampermonkey.net/
// @version      6
// @description  rolling winrate chart with dynamic target switching
// @author       You
// @match        https://*/game/limbo
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://cdn.jsdelivr.net/npm/chart.js@4.5.0/dist/chart.umd.min.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  let lastRollSet = [];
  let currentRollSet = [];
  let resultsHistory = [];       // raw results (multipliers)
  let cumulativeWins = [0];      // prefix sum of wins for current target
  let rollNum = 0;
  let newWindow = null;
  let winrateChart;
  let currentTarget = 0;

  // -------------------------------------------------------------------
  // Main entry
  // -------------------------------------------------------------------
  initFloatingWindow();

  // -------------------------------------------------------------------
  // Roll handling
  // -------------------------------------------------------------------
  function evalResult(result) {
    if (result === -1) return; // no new roll
    console.log("result", result)
    recordRoll(result);
    renderChart();
  }

  function recordRoll(result) {
    rollNum++;
    resultsHistory.push(result);

    // compute win for current target
    const win = (result >= currentTarget) ? 1 : 0;
    cumulativeWins.push(cumulativeWins[cumulativeWins.length - 1] + win);
  }

  // -------------------------------------------------------------------
  // Chart drawing
  // -------------------------------------------------------------------
  function renderChart() {
    const wr50  = getWinRate(50,  rollNum);
    const wr100 = getWinRate(100, rollNum);
    const wr200 = getWinRate(200, rollNum);
    const teo   = (1 / currentTarget) * 100;


    
    winrateChart.data.labels.push(rollNum);

    winrateChart.data.datasets.find(ds => ds.label === "TEO").data.push(teo);
    
 winrateChart.data.datasets.find(ds => ds.label === "WR-50").data.push(
    rollNum >= 50 ? wr50 : null
  );
  winrateChart.data.datasets.find(ds => ds.label === "WR-100").data.push(
    rollNum >= 100 ? wr100 : null
  );
  winrateChart.data.datasets.find(ds => ds.label === "WR-200").data.push(
    rollNum >= 200 ? wr200 : null
  );

  winrateChart.data.datasets.find(ds => ds.label === "TEO").data.push(teo);

  // Leash (only valid once both WR-50 and WR-200 exist)
  if (rollNum >= 200) {
    winrateChart.data.datasets.find(ds => ds.label === "Leash").data.push(wr50 - wr200);
  } else {
    winrateChart.data.datasets.find(ds => ds.label === "Leash").data.push(null);
  }

  winrateChart.update();
    winrateChart.update();
  }

  function getWinRate(windowSize, rollIndex) {
    if (rollIndex < windowSize) return 0;
    const wins = cumulativeWins[rollIndex] - cumulativeWins[rollIndex - windowSize];
    return (wins / windowSize) * 100;
  }

  function resetChartData() {
    if (!winrateChart) return;
    winrateChart.data.labels = [];
    winrateChart.data.datasets.forEach(ds => ds.data = []);
    winrateChart.update();
  }

  function rebuildCumulativeWins() {
    cumulativeWins = [0];
    for (let i = 0; i < resultsHistory.length; i++) {
      const win = (resultsHistory[i] >= currentTarget) ? 1 : 0;
      cumulativeWins.push(cumulativeWins[i] + win);
    }
  }

  function refreshChartForTarget() {
    if (!winrateChart) return;
    rebuildCumulativeWins();
    resetChartData();

    for (let i = 1; i <= resultsHistory.length; i++) {
      winrateChart.data.labels.push(i);
      winrateChart.data.datasets.find(ds => ds.label === "WR-50").data.push(getWinRate(50, i));
      winrateChart.data.datasets.find(ds => ds.label === "WR-100").data.push(getWinRate(100, i));
      winrateChart.data.datasets.find(ds => ds.label === "WR-200").data.push(getWinRate(200, i));
      winrateChart.data.datasets.find(ds => ds.label === "TEO").data.push((1 / currentTarget) * 100);
      winrateChart.data.datasets.find(ds => ds.label === "Leash").data.push(getWinRate(50, i) - getWinRate(200, i));
    }

    rollNum = resultsHistory.length;
    winrateChart.update();

  
  }

  // -------------------------------------------------------------------
  // Chart setup
  // -------------------------------------------------------------------
  function initRollingWindows() {
    const ctx = newWindow.document.getElementById("winrateChart").getContext("2d");
    if (winrateChart) winrateChart.destroy();

    const datasets = [
      { label: "WR-50",  borderColor: "green" },
      { label: "WR-100", borderColor: "blue"  },
      { label: "WR-200", borderColor: "red"   }
    ].map(cfg => ({
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
  function getNewWindowHTMLNode(hook) {
    return $(newWindow.document).find(hook);
  }

  function initWindowEvents() {
   const htmlNode = getNewWindowHTMLNode("#current-target");
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

  toggles.forEach(t => {
    const el = getNewWindowHTMLNode(t.id);
    el.on("change", () => {
      const ds = winrateChart.data.datasets.find(d => d.label === t.label);
      ds.hidden = !el.prop("checked");
      winrateChart.update();
    });
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
    return $(".grid.grid-auto-flow-column div span").map(function () {
      return $(this).text();
    }).get();
  }

  function getRollResult() {
    const temp = lastRollSet;
    lastRollSet = currentRollSet;
    currentRollSet = temp;
    currentRollSet.length = 0;

    currentRollSet = $(".grid.grid-auto-flow-column div span")
      .map(function () { return Number($(this).text().replace("x", "")); })
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
        if (element) { resolve(element); return; }
        maxTime -= pause;
        setTimeout(inner, pause);
      })();
    });
  }

  // -------------------------------------------------------------------
  // Window + init
  // -------------------------------------------------------------------
  function initFloatingWindow() {
    window.addEventListener("beforeunload", () => {
      if (newWindow && !newWindow.closed) newWindow.close();
    });

    window.addEventListener("load", () => {
      newWindow = window.open("", "", "width=800,height=600");
      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #1e2323;
      color: white;
      margin: 0;
      padding: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .container { height: 100%; }
  </style>
</head>
<body>
  <div class="container">
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
    <div style="width:100%; height:400px;">
      <canvas id="winrateChart"></canvas>
    </div>
  </div>
</body>
</html>`;
      newWindow.document.write(htmlContent);
      newWindow.document.close();

      // init order: chart → events → observer
      initRollingWindows();
      initWindowEvents();
      refreshChartForTarget();
      observeRollChanges();
    });
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
