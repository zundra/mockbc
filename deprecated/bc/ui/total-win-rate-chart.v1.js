// ==UserScript==
// @name         bc.game windup-sum chart (ΔWR% vs TEO, summed)
// @namespace    http://tampermonkey.net/
// @version      2
// @description  Sum over payouts of (winrate% – TEO%) as a single wind-up metric, with extremes
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

  // ---------- Tunables ----------
  const WINDOW_SIZE = 200;
  const MAX_POINTS  = 1000;
  const Y_MIN       = -5;
  const Y_MAX       =  5;

  // ---------- State ----------
  let lastRollSet = [];
  let currentRollSet = [];
  let rollNum = 0;
  let windupChart;
  let minSeen = Infinity;
  let maxSeen = -Infinity;

  // ---------- Utils ----------
  const cap = (arr, max = MAX_POINTS) => {
    if (arr.length > max) arr.splice(0, arr.length - max);
    return arr;
  };
  function arraysAreEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
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
  function waitForSelector(selector) {
    const pause = 10;
    let maxTime = 50000;
    return new Promise((resolve, reject) => {
      (function inner() {
        if (maxTime <= 0) {
          reject(new Error("Timeout: Element not found: " + selector));
          return;
        }
        const el = document.querySelector(selector);
        if (el) { resolve(el); return; }
        maxTime -= pause;
        setTimeout(inner, pause);
      })();
    });
  }

  // ---------- Aggregator ----------
  function initDataAggregator() {
    class DataAggregator {
      constructor() {
        this.targets = this.generateTargets();
        this.lastAvg = 0;
      }
      getAvgDelta = () => this.lastAvg;
      push(result) {
        let sum = 0, count = 0;
        for (let t of this.targets) {
          t.push(result);
          const d = t.deltaPercentOfTEO();
          if (d !== null) { sum += d; count++; }
        }
        this.lastAvg = count > 0 ? sum / count : 0;
      }
      generateTargets = () => {
        class Target {
          constructor(payout) {
            this.payout = payout;
            this.results = [];
            this.window = WINDOW_SIZE;
            this.wins = 0;
          }
          push(result) {
            this.results.push(result);
            if (result >= this.payout) this.wins++;
            if (this.results.length > this.window) {
              const removed = this.results.shift();
              if (removed >= this.payout) this.wins--;
            }
          }
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
        return Array.from({ length: 300 }, (_, k) => new Target(2 + k * 0.5));
      }
    }
    return new DataAggregator();
  }
  const aggregator = initDataAggregator();

  // ---------- Chart ----------
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
            type: "linear",
            position: "left",
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

  function renderChartPoint() {
    const windupVal = aggregator.getAvgDelta();
    rollNum++;

    if (rollNum < 100) return;

    // update extremes
    if (isFinite(windupVal)) {
      minSeen = Math.min(minSeen, windupVal);
      maxSeen = Math.max(maxSeen, windupVal);
    }

    windupChart.data.labels.push(rollNum);
    cap(windupChart.data.labels);

    const ds = windupChart.data.datasets[0];
    ds.data.push(windupVal);
    cap(ds.data);

    // update annotation lines
    const annos = {};
    if (isFinite(minSeen)) {
      annos["minLine"] = {
        type: "line",
        yMin: minSeen,
        yMax: minSeen,
        borderColor: "cyan",
        borderDash: [4, 4],
        borderWidth: 1
      };
    }
    if (isFinite(maxSeen)) {
      annos["maxLine"] = {
        type: "line",
        yMin: maxSeen,
        yMax: maxSeen,
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

  // ---------- Observer ----------
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
        const result = getRollResult();
        if (result === -1) return;
        aggregator.push(result);
        renderChartPoint();
      }
    });
    observer.observe(gridElement, { childList: true, subtree: true });
  }

  // ---------- UI ----------
  function injectUI() {
    $("<style>").prop("type", "text/css").html(`
      #windup-sum-chart {
          height: 400px;
          width: 600px;

        position: absolute;
        top: 120px;
        left: 120px;
        z-index: 9999;
        background: black;
        border-radius: 8px;
        padding: 8px;
      }
      #windup-sum-chart .chart-area { width: 100%; height: 100%; }
    `).appendTo("head");

    const html = `
      <div id="windup-sum-chart" class="ui-widget-content">
        <div class="chart-area">
          <canvas id="windupSumChart"></canvas>
        </div>
      </div>`;
    $("body").prepend(html);

    $("#windup-sum-chart").draggable({ scroll: false });
    initWindupChart();
  }

  // ---------- Boot ----------
  (async function boot() {
    injectUI();
    observeRollChanges();
  })();

})();


let mbc;
if (getIsTestMode()) {
  mbc = new MockBC(
    0,
    "Y83TpC2hj2SnjiNEDJwN",
    "9b98254e8986dd95349fc754b4b087b5d0ddf9771026d68fe4ed661c869420b4"
  );
}