/* Start Script */
// ==UserScript==
// @name         bc.game baseline stats v1
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  try to take over the world!
// @author       You
// @match        https://*.game/game/limbo?fastest-roll=true
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bc.game
// @require https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @grant        none
// ==/UserScript==

var tm;

(function () {
  "use strict";

  let firstLoad = true;
  let lastRollSet = [];
  let currentRollSet = [];
  let rollCount = 0;
  let losingStreak = 0;
  let stopped = true;
  let hitCount = 0;
  let prevProfit = 0;
  let cycleProfit = 0;
  let cycleStarted = false;
  let cycleRollCount = 0;
  let riskOnTarget = null;
  let lastResult = 0;

  const targets = generateTargets();

  initWindowEvents();

  function evalResult(result) {
    lastResult = result;
    rollCount++;

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      t.push(result);
    }

    renderRunSummaryToTable();
  }

  function initWindowEvents() {
    Array.prototype.last = function () {
      return this[this.length - 1];
    };

    Array.prototype.first = function () {
      return this[0];
    };

    $("#sv-stats-panel").draggable({
      containment: "window",
      scroll: false
    });
  }

  // Utility function: Get current roll data
  function getCurrentRollData() {
    return $(".grid.grid-auto-flow-column div span")
      .map(function () {
        return $(this).text();
      })
      .get();
  }

  function calculateTeo(payout) {
    return 1 / (payout * 1.04);
  }

  // Function to start the betting process
  function startBetting() {
    setWager(0);
    setPayout(0);
    losingStreak = 0;
    hitCount = 0;
    stopped = false;
    doBet(); // Start the async loop
  }

  function stopBetting() {
    stopped = true;
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function doInit() {
    observeRollChanges();
  }

  async function doBet() {
    while (!stopped) {
      // Trigger the button click

      $(".button-brand:first").trigger("click");

      // Wait for 1 second (1000 ms) before clicking again
      await delay(10);

      // Stop condition check inside the loop
      if (stopped) {
        console.log("Stopped betting.");
        return; // Break the loop if stop is true
      }
    }
  }

  function renderRunSummaryToTable() {
    const tableData = targets.map((target) => ({
      Payout: target.getPayout(),
      "Losing Streak": target.getLosingStreak(),
      "Max Streak": target.getMaxLosingStreak()
    }));

    const tableEl = document.getElementById("summary-table");
    if (!tableEl) return;

    const headers = Object.keys(tableData[0]);

    tableEl.innerHTML = `
    <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>
      ${tableData
        .map((row) => {
          let style = "";

          return `<tr>${headers
            .map((h) => `<td>${row[h]}</td>`)
            .join("")}</tr>`;
        })
        .join("")}
    </tbody>
  `;
  }

  function generateTargets() {
    function generatePayouts() {
      return Array.from(
        {
          length: 100
        },
        (v, k) => 1.1 + k * 0.01
      );
    }

    class Target {
      constructor(payout) {
        this.payout = payout;
        this.rollCount = 0;
        this.losingStreak = 0;
        this.hitCount = 0;
        this.maxWinRate = 0;
        this.minWinRate = 0;
        this.maxLosingStreak = 0;
        this._teo = this.generateTeo();
      }

      push(result, stopLimit) {
        this.updateStreak(result);
      }

      updateStreak(result) {
        if (result >= this.payout) {
          this.hitCount++;
          this.losingStreak = 0;
        } else {
          this.losingStreak++;
          this.maxLosingStreak = Math.max(
            this.losingStreak,
            this.maxLosingStreak
          );
        }

        this.winRate = this.hitCount / this.rollCount;
        this.minWinRate = Math.min(Math.max(0, this.winRate), this.minWinRate);
        this.maxWinRate = Math.max(this.winRate, this.minWinRate);
      }

      getPayout = () => this.payout;
      generateTeo = () => 1 / (this.payout * 1.04);
      getLosingStreak = () => this.losingStreak;
      getWinRate = () => this.winRate;
      getMaxLosingStreak = () => this.maxLosingStreak;
      getMaxWinRate = () => this.maxWinRate;
      getMinWinRate = () => this.minWinRate;
      getTeo = () => this._teo;
      getHitCount = () => this.hitCount;
      getRollCount = () => this.rollCount;
    }

    return generatePayouts().map((payout) => new Target(payout));

    for (let i = 0; i < targets.length; i++) {
      const current = targets[i];
      const next = targets[i + 1] || null;
      const prev = targets[i - 1] || null;

      current.setNextTarget(next);
      current.setPreviousTarget(prev);
    }
  }

  function deepEqual(obj1, obj2) {
    return JSON.stringify(obj1) === JSON.stringify(obj2); // quick and dirty
  }

  // Utility function: Extract the last roll result
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

    if (arraysAreEqual(currentRollSet, lastRollSet)) {
      return -1;
    }

    return currentRollSet[currentRollSet.length - 1];
  }

  // Observer to monitor roll changes in the grid
  let observer = null; // Store observer globally

  async function observeRollChanges() {
    const gridElement = await waitForSelector(".grid.grid-auto-flow-column");
    let previousRollData = getCurrentRollData();

    // If an observer already exists, disconnect it before creating a new one
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver((mutationsList) => {
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

    observer.observe(gridElement, {
      childList: true,
      subtree: true
    });
  }

  function arraysAreEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((value, index) => value === arr2[index]);
  }

  function waitForSelector(selector) {
    const pause = 10; // Interval between checks (milliseconds)
    let maxTime = 50000; // Maximum wait time (milliseconds)

    return new Promise((resolve, reject) => {
      function inner() {
        if (maxTime <= 0) {
          reject(
            new Error("Timeout: Element not found for selector: " + selector)
          );
          return;
        }

        // Try to find the element using the provided selector
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
          return;
        }

        maxTime -= pause;
        setTimeout(inner, pause);
      }

      inner();
    });
  }

  doInit();

  // Initialize MutationObserver
})();

const mbc = new MockBC(
  0,
  "Y83TpC2hj2SnjiNEDJwN",
  "9b98254e8986dd95349fc754b4b087b5d0ddf9771026d68fe4ed661c869420b4"
);
