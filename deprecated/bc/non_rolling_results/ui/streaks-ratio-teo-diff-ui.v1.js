/* Start Script */
// ==UserScript==
// @name         bc.game streaks velocity v1
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://*.game/game/limbo?fastest-roll=true
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bc.game
// @require https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const targets = generateTargets();
  let lastRollSet = [];
  let currentRollSet = [];

  $("<style>")
    .prop("type", "text/css")
    .html(
      `
             #sv-stats-panel-header {
                background: #333;
                padding: 12px;
                font-weight: bold;
                text-align: center;
                border-radius: 8px 8px 0 0;
                font-size: 16px;
                cursor: grab;
            }

            #sv-stats-panel {
                position: fixed;
                top: 200px;
                right: 100px;
                z-index: 9999;
                background: #1e1e1e;
                color: #fff;
                padding: 16px;
                width: 350px;
                border-radius: 10px;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
                font-family: Arial, sans-serif;
                font-size: 14px;
                line-height: 1.6;
                cursor: grab;
                display: flex;
                flex-direction: column;
                gap: 10px;
                height: 1000px;
                overflow: scroll;
            }

            .message-box {
                margin: 12px 0;
                background-color: #444;
                padding: 10px;
                border-radius: 6px;
                color: white;
                font-size: 0.9rem;
                text-align: center;
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
      }

        `
    )
    .appendTo("head");

  const statsPanel = `<div id="sv-stats-panel" style="
   position: fixed;
   top: 300px;
   left: 500px;
   z-index: 9999;
   background: #1e1e1e;
   color: #fff;
   padding: 16px;
   width: 900px;
   border-radius: 10px;
   box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
   font-family: Arial, sans-serif;
   font-size: 14px;
   line-height: 1.6;
   cursor: grab;
   ">
   <div id="sv-stats-panel-header" style="
      background: #333;
      padding: 10px;
      font-weight: bold;
      text-align: center;
      border-radius: 8px 8px 0 0;
      cursor: grab;
      ">⚙️ Losing Streaks</div>
      <div style="background-color: #1e1e1e; border: 1px solid #333; border-radius: 6px; padding: 10px; margin-top: 10px; color: #ccc; font-family: sans-serif; font-size: 15px; overflow-x: auto;">
         <table style="width: 100%; border-collapse: collapse;" id="output-table">
            <thead>
               <tr>
                  <th style="position: sticky; left: 0; background-color: #1e1e1e; z-index: 1; text-align: left; padding: 6px; white-space: nowrap;">
                     Payout
                  </th>
                  <th style="position: sticky; left: 0; background-color: #1e1e1e; z-index: 1; text-align: left; padding: 6px; white-space: nowrap;">
                     Streak
                  </th>
                  <th style="position: sticky; left: 0; background-color: #1e1e1e; z-index: 1; text-align: left; padding: 6px; white-space: nowrap;">
                     Ratio
                  </th>
                  <th style="position: sticky; left: 0; background-color: #1e1e1e; z-index: 1; text-align: left; padding: 6px; white-space: nowrap;">
                     Diff
                  </th>
                  <th style="position: sticky; left: 0; background-color: #1e1e1e; z-index: 1; text-align: left; padding: 6px; white-space: nowrap;">
                     Velocity
                  </th>
               </tr>
            </thead>
            <tbody></tbody>
         </table>
      </div>
   </div>
</div>`;

  $("body").prepend(statsPanel);

  initWindowEvents();

  function evalResult(result) {
    if (result === -1) return;

    targets.forEach((target) => {
      target.addResult(result);
    });

    updateUI();
  }

  function updateUI() {
    renderTable();
  }

  function renderTable() {
    const $tbody = $("#output-table tbody");
    $tbody.empty();

    targets.forEach((entry) => {
      const payout = entry.getPayout();
      const streak = entry.getStreak();
      const sanitized = entry.getHTMLID();
      const diff = streak + payout;
      const ratio = diff / payout;

      let streakColor = "transparent";
      let ratioColor = "transparent";
      let diffColor = "transparent";

      if ((streak < 0 && Math.abs(streak)) >= payout * 5) {
        streakColor = "red";
      }

      if ((diff < 0 && Math.abs(diff)) >= payout * 3) {
        ratioColor = "red";
      }

      if (diff < 0) {
        diffColor = "red";
      }

      const row = `
      <tr>
        <td style="position: sticky; left: 0; background-color: #1e1e1e; text-align: left; padding: 4px 6px; white-space: nowrap;">
          ${payout.toFixed(2)}x
        </td>
        <td style='background-color: ${streakColor}'><span id="losing-streak-${sanitized}">${streak}</span></td>
        <td style='background-color: ${ratioColor}'><span id="losing-streak-${sanitized}-ratio">${ratio.toFixed(
        2
      )}</span></td>
        <td style='background-color: ${diffColor}'><span id="losing-streak-${sanitized}-diff">${diff.toFixed(
        2
      )}</span></td>
      <td>${getVelocityData(entry)}</td>
      </tr>
    `;
      $tbody.append(row);
    });
  }

  function getVelocityData(target) {
    const stats = target.stats;
    if (!stats) return "";

    const winRate = stats.getWinRate(50); // recent 50-roll window
    const teo = stats.getTeo();
    const ls = stats.getLosingStreak();
    const pr = winRate / teo;

    let relativeSpeed = "near";
    if (pr < 0.85) relativeSpeed = "below";
    if (pr > 1.15) relativeSpeed = "above";

    const isSlow = relativeSpeed === "below";
    const isStuck = isSlow && ls <= -(target.getPayout() * 5);

    // Visuals
    const color = isStuck ? "red" : isSlow ? "orange" : "#0f0";
    const bg = isStuck ? "#330000" : isSlow ? "#332000" : "#002200";

    // Gauge (winRate as % of TEO)
    const gaugeBar = "▁▂▃▄▅▆▇█";
    const prClamped = Math.min(2, pr); // max 2x speed
    const index = Math.min(
      gaugeBar.length - 1,
      Math.floor((prClamped / 2) * gaugeBar.length)
    );
    const gauge = gaugeBar.slice(0, index + 1).padEnd(gaugeBar.length, "·");

    // Optional recovery insight
    let recoveryHtml = "";
    if (isSlow && stats.getRollCount() > 30) {
      if (!stats.getSum) {
        debugger;
      }
      const currentHits = stats.getSum(50);
      const expectedHits = 50 * teo;
      const deficit = expectedHits - currentHits;
      const recoveryRate = teo * 1.5;
      const futureRolls = Math.ceil(deficit / recoveryRate);
      const requiredRate = deficit / futureRolls;
      const feasible = requiredRate <= teo * 2;

      recoveryHtml = `
      <br><span style="color:${feasible ? "#ffcc00" : "#ff4444"}">
        🔁 Recover in ~${futureRolls} rolls<br>
        ⏫ Need ${(requiredRate * 100).toFixed(2)}% hit rate (${(
        requiredRate / teo
      ).toFixed(2)}× TEO)
      </span>`;
    }

    const html = `
    <div style="margin-bottom:8px;padding:4px;background:${bg};border-left:4px solid ${color};">
      Win Rate: ${(winRate * 100).toFixed(2)}% (TEO: ${(teo * 100).toFixed(
      2
    )}%) Speed: ${(pr * 100).toFixed(1)}%
    </div>
  `;

    return html;
  }

  // Utility function: Get current roll data
  function getCurrentRollData() {
    return $(".grid.grid-auto-flow-column div span")
      .map(function () {
        return $(this).text();
      })
      .get();
  }

  function initWindowEvents() {
    $("#sv-stats-panel").draggable({
      containment: "window",
      scroll: false
    });
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
    observeRollChanges();
  }

  function generateTargets() {
    class Stats {
      constructor(size, payout) {
        this.size = size;
        this.payout = payout;
        this.streak = 0;
        this.pstreak = 0;
        this.hitCount = 0;
        this.losingStreak = 0;
        this.buffer = new Array(size).fill(null);
        this.index = 0;
        this.count = 0;
        this.sum = 0;
        this.rollCount = 0;
      }

      push = (result) => {
        this.rollCount++;
        this.updateStreak(result);
        const isHit = result >= this.payout ? 1 : 0;

        if (this.count >= this.size) {
          const old = this.buffer[this.index];
          this.sum -= old ?? 0;
        } else {
          this.count++;
        }

        this.buffer[this.index] = isHit;
        this.sum += isHit;
        this.index = (this.index + 1) % this.size;
      };

      updateStreak = (result) => {
        if (result >= this.payout) {
          this.hitCount++;
          if (this.streak < 0) {
            this.streakSignFlipped = true;
            this.pstreak = this.streak;
          } else {
            this.streakSignFlipped = false;
          }
          this.streak = Math.max(this.streak + 1, 1);
        } else {
          if (this.streak > 0) {
            this.streakSignFlipped = true;
            this.pstreak = this.streak;
          } else {
            this.streakSignFlipped = false;
          }
          this.streak = Math.min(this.streak - 1, -1);
        }

        this.losingStreak = this.streak < 0 ? this.streak : 0;
      };

      getRate = (lastN = this.count) => {
        const count = Math.min(lastN, this.count);
        if (count === 0) return 0;

        let sum = 0;
        const start = (this.index - count + this.size) % this.size;
        for (let i = 0; i < count; i++) {
          const idx = (start + i + this.size) % this.size;
          sum += this.buffer[idx] ?? 0;
        }
        return sum / count;
      };

      getWinRate = (lookback = 10) => this.getRate(lookback);

      getTeo = () => 1 / (this.getPayout() * 1.05);

      getSum = (lastN = this.count) => {
        const count = Math.min(lastN, this.count);
        if (count === 0) return 0;

        let sum = 0;
        const start = (this.index - count + this.size) % this.size;
        for (let i = 0; i < count; i++) {
          const idx = (start + i + this.size) % this.size;
          sum += this.buffer[idx] ?? 0;
        }
        return sum;
      };

      getWinRate = () => this.hitCount / this.rollCount;
      getTeo = () => 1 / (this.getPayout() * 1.04);
      getHitCount = () => this.hitCount;
      getRollCount = () => this.rollCount;
      getStreak = () => this.streak;
      getPreviousStreak = () => this.pstreak;
      getLosingStreak = () => this.losingStreak;
      getPayout = () => this.payout;
      getStreakDiff = () => this.payout - this.streak;
      getRatio = () => this.getStreakDiff() / this.payout;
    }

    class ScalarStats {
      constructor(payout) {
        this.rollCount = 0;
        this.payout = payout;
        this.streak = 0;
        this.pstreak = 0;
        this.hitCount = 0;
        this.losingStreak = 0;
      }

      push = (result) => {
        this.rollCount++;
        this.updateStreak(result);
      };

      updateStreak = (result) => {
        if (result >= this.payout) {
          this.hitCount++;
          if (this.streak < 0) {
            this.pstreak = this.streak;
          }
          this.streak = Math.max(this.streak + 1, 1);
        } else {
          if (this.streak > 0) {
            this.pstreak = this.streak;
          }
          this.streak = Math.min(this.streak - 1, -1);
        }

        this.losingStreak = this.streak < 0 ? this.streak : 0;
      };

      getSum = () => this.hitCount;
      getWinRate = () => this.hitCount / this.rollCount;
      getTeo = () => 1 / (this.getPayout() * 1.04);
      getHitCount = () => this.hitCount;
      getRollCount = () => this.rollCount;
      getStreak = () => this.streak;
      getPreviousStreak = () => this.pstreak;
      getLosingStreak = () => this.losingStreak;
      getPayout = () => this.payout;
      getStreakDiff = () => this.payout - this.streak;
      getRatio = () => this.getStreakDiff() / this.payout;
    }

    class Target {
      constructor(payout) {
        this.payout = payout;
        this.stats =
          this.payout <= 96 ? new Stats(100, payout) : new ScalarStats(payout);
        this.teo = 1 / (this.payout * 1.05); // Adjusted for edge
        this.streak = 0;
        this.pstreak = 0;
        this.hitCount = 0;
        this.rollCount = 0;

        // Snapshot stats
        this.lastSnapshot = null;

        // Snapshot tracking
        this.SNAPSHOT_ROLL_COUNT = 50;
        this.snapshotRollCount = 0;
        this.snapshotHitCount = 0;
      }

      getPayout() {
        return this.payout;
      }

      addResult(result) {
        this.rollCount++;
        this.stats.push(result);
        this.updateStreak(result);

        // Snapshot logic
        const isHit = result >= this.payout;
        this.snapshotRollCount++;
        if (isHit) this.snapshotHitCount++;

        if (this.snapshotRollCount >= this.SNAPSHOT_ROLL_COUNT) {
          this.evaluateSnapshot();
          this.resetSnapshotWindow();
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

      evaluateSnapshot() {
        const n = this.snapshotRollCount;
        const x = this.snapshotHitCount;
        const p = this.teo;

        const expectedHits = n * p;
        const winRate = n > 0 ? x / n : 0;
        const performanceRatio = expectedHits > 0 ? x / expectedHits : 0;
        const percentOfTeo = p > 0 ? winRate / p : 0;
        const zScore =
          n > 0 ? (x - expectedHits) / Math.sqrt(n * p * (1 - p)) : 0;

        this.lastSnapshot = {
          payout: this.payout,
          rollCount: n,
          hitCount: x,
          expectedHits,
          winRate,
          performanceRatio,
          percentOfTeo,
          zScore
        };
      }

      getSpeedStatus() {
        if (!this.lastSnapshot) return null;

        const pr = parseFloat(this.lastSnapshot.performanceRatio);
        const speedLimit = 1.0;
        const margin = 0.1;

        let relativeSpeed;
        if (pr < speedLimit - margin) {
          relativeSpeed = "below";
        } else if (pr > speedLimit + margin) {
          relativeSpeed = "above";
        } else {
          relativeSpeed = "near";
        }

        return {
          ratio: pr,
          speedLimit,
          relativeSpeed
        };
      }

      getRecoveryProjection() {
        const currentRolls = this.snapshotRollCount;
        const currentHits = this.snapshotHitCount;
        const teo = this.teo;

        if (currentRolls === 0) return null;

        const expectedNow = currentRolls * teo;
        const deficit = expectedNow - currentHits;

        // No deficit → nothing to recover
        if (deficit <= 0)
          return {
            currentRolls,
            currentHits,
            deficit: "0.00",
            futureRolls: 0,
            hitsToRecover: "0.00",
            requiredFutureHitRate: "0.000",
            teo: teo.toFixed(3),
            recoveryFeasible: true
          };

        const recoveryRate = teo * 1.5; // assume you'll recover faster than average
        const futureRolls = Math.ceil(deficit / recoveryRate);
        const hitsToRecover = deficit;
        const requiredFutureHitRate = hitsToRecover / futureRolls;

        return {
          currentRolls,
          currentHits,
          deficit: deficit.toFixed(2),
          futureRolls,
          hitsToRecover: hitsToRecover.toFixed(2),
          requiredFutureHitRate: requiredFutureHitRate.toFixed(3),
          teo: teo.toFixed(3),
          recoveryFeasible: requiredFutureHitRate <= teo * 2
        };
      }

      resetSnapshotWindow() {
        this.snapshotRollCount = 0;
        this.snapshotHitCount = 0;
      }

      getStreak = () => this.streak;
      getLosingStreak = () => (this.streak < 0 ? this.streak : 0);
      getTeo = () => this.teo;
      getHitCount = () => this.hitCount;
      getRollCount = () => this.rollCount;
      getHTMLID = () =>
        this.payout
          .toString()
          .replace(/\./g, "_")
          .replace(/[^\w-]/g, "");
    }

    return generatePayouts().map((payout) => new Target(payout));
  }

  function generatePayouts() {
    return [
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
