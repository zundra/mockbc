/* Start Script */
// ==UserScript==
// @name         bc.game hit-velocity v1
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://*.game/game/limbo?analytics=true
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bc.game
// @require https://code.jquery.com/jquery-3.6.0.min.js
// @require https://omnipotent.net/jquery.sparkline/2.1.2/jquery.sparkline.min.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const targets = generateTargets();
  let lastRollSet = [];
  let currentRollSet = [];

  let html = `
  <div id="target-dashboard" style="position:fixed;top:10px;right:10px;background:#111;color:#fff;padding:10px;font-family:monospace;z-index:9999;max-height:90vh;overflow-y:auto;border-radius:6px;width:300px;">
    <h4 style="margin-top:0;margin-bottom:10px;">🎯 Target Watch</h4>
    <div id="target-stats"></div>
  </div>
`;
  $("body").prepend(html);

  function evalResult(result) {
    updateUI();
  }

function updateUI() {
  const container = $("#target-stats");
  let html = "";

  targets.forEach((target) => {
    if (!target.lastSnapshot) return;

    const { performanceRatio, zScore, borderColor, bgColor } = target.lastSnapshot;


    html += `
      <div style="margin-bottom:8px;padding:4px;background:${bgColor};border-left:4px solid ${borderColor};">
        PR: ${performanceRatio}, Z: ${zScore}
      </div>
    `;
  });

  container.html(html);
}


  // Utility function: Get current roll data
  function getCurrentRollData() {
    return $(".grid.grid-auto-flow-column div span")
      .map(function () {
        return $(this).text();
      })
      .get();
  }

  function initPrototypes() {
    Array.prototype.last = function () {
      return this[this.length - 1];
    };
    Array.prototype.first = function () {
      return this[0];
    };
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function doInit() {
    bindHotKeys();
    observeRollChanges();
  }

  class Target {
    constructor(payout) {
      this.payout = payout;
      this.teo = 1 / (this.payout * 1.05); // Adjusted for edge
      this.streak = 0;
      this.pstreak = 0;
      this.hitCount = 0;
      this.rollCount = 0;

      // Snapshot stats
      this.lastSnapshot = null;
      this.snapshotHitCount = 0;
      this.snapshotRollCount = 0;
      this.snapshotWindowStart = Date.now();
      this.SNAPSHOT_WINDOW_MS = 5000; // 5-second window
    }

    getPayout() {
      return this.payout;
    }

    addResult(result) {
      this.rollCount++;
      this.updateStreak(result);

      // Snapshot logic
      const now = Date.now();
      const isHit = result >= this.payout;

      this.snapshotRollCount++;
      if (isHit) this.snapshotHitCount++;

      if (now - this.snapshotWindowStart >= this.SNAPSHOT_WINDOW_MS) {
        this.evaluateSnapshot(now);
        this.resetSnapshotWindow(now);
      }
    }

    updateStreak(result) {
      if (result >= this.payout) {
        this.hitCount++;
        if (this.streak < 0) this.pstreak = this.streak;
        this.streak = Math.max(this.streak + 1, 1);
      } else {
        if (this.streak > 0) this.pstreak = this.streak;
        this.streak = Math.min(this.streak - 1, -1);
      }
    }

    evaluateSnapshot(now) {
      const durationSec = (now - this.snapshotWindowStart) / 1000;
      const expectedHits = this.snapshotRollCount * this.teo;
      const actualHitsPerSec = this.snapshotHitCount / durationSec;
      const expectedHitsPerSec =
        (this.snapshotRollCount / durationSec) * this.teo;
      const performanceRatio =
        expectedHits > 0 ? this.snapshotHitCount / expectedHits : 0;

      const p = this.teo;
      const n = this.snapshotRollCount;
      const x = this.snapshotHitCount;
      const zScore = n > 0 ? (x - n * p) / Math.sqrt(n * p * (1 - p)) : 0;

      let status = "normal";
      if (
        (performanceRatio < 0.6 && n > 100) ||
        (zScore < -2.0 && n > 30) ||
        (expectedHits >= 3 && x === 0)
      ) {
        status = "cold";
      }

    const color = status === "cold" ? "red" : "#0f0";
    const bg = status === "cold" ? "#330000" : "#002200";

    this.lastSnapshot = {
        time: new Date(this.snapshotWindowStart).toLocaleTimeString(),
        payout: this.payout,
        rollCount: n,
        hitCount: x,
        expectedHits: expectedHits.toFixed(2),
        performanceRatio: performanceRatio.toFixed(2),
        zScore: zScore.toFixed(2),
        bgColor: bg,
        borderColor: color,
        status
      };
    }

    resetSnapshotWindow(now) {
      this.snapshotRollCount = 0;
      this.snapshotHitCount = 0;
      this.snapshotWindowStart = now;
    }

    getStreak = () => this.streak;
    getLosingStreak = () => (this.streak < 0 ? this.streak : 0);
    getTeo = () => this.teo;
    getHitCount = () => this.hitCount;
    getRollCount = () => this.rollCount;
  }

  function generateTargets() {
    return generatePayouts().map((payout) => new Target(payout));
  }

  function populateWatchPayouts() {
    const payouts = [
      1.5,
      1.6,
      1.7,
      1.8,
      1.9,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      15,
      20,
      25,
      30,
      40,
      50,
      60,
      70,
      80,
      90,
      100,
      200,
      300,
      400,
      500,
      1000,
      2000,
      3000,
      4000,
      5000,
      10000,
      25000,
      50000,
      100000,
      500000,
      1000000
    ];
    return payouts.map((p) => ({ payout: p, streak: 0 }));
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
