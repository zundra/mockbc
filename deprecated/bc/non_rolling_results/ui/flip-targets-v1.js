/* Start Script */
// ==UserScript==
// @name         bc.game flip targets v1
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
        <table id="summary-table" class="summary-table">
          <thead></thead>
          <tbody></tbody>
        </table>
      </div>
   </div>
</div>`;

  $("body").prepend(statsPanel);

  const scenarios = {
    baseline: (target) => ({
      riskOnCheck: () =>
        target.stats.getLosingStreak() > target.getPayout() * 2 &&
        target.getOverheadUnderPressureCount() > 3,
      riskOffCheck: () => target.isProfitable(),
      progressiveBet: () => false
    }),
    winRate: (target) => ({
      riskOnCheck: () =>
        target.getWinRatePercentOfTeo(100) < 50 &&
        Math.abs(target.stats.getWinRateSensitiveLosingStreak()) >=
          target.payout &&
        target.getOverheadUnderPressureCount() >= 5,
      riskOffCheck: () =>
        target.getOverheadUnderPressureCount() === 0 ||
        target.getPL() >= target.getPayout() * target.getWager() * 2,
      progressiveBet: () => false
    }),

    losingStreak: (target) => ({
      riskOnCheck: () =>
        target.getRiskOnLosingStreak() === 0 &&
        Math.abs(target.getLosingStreak()) >= target.payout * 2 &&
        target.getOverheadUnderPressureCount() >= 5,
      riskOffCheck: () =>
        target.getOverheadUnderPressureCount() === 0 ||
        target.getPL() >= target.getPayout() * target.getWager() * 2,
      progressiveBet: () => false
    }),
    losingStreak2: (target) => ({
      riskOnCheck: () =>
        target.stats.getWinRateSensitiveLosingStreak() > target.getPayout() * 2,
      riskOffCheck: () => target.getRiskOnLosingStreak() > target.getPayout(),
      progressiveBet: () => false
    }),
    overheadratio: (target) => ({
      riskOnCheck: () =>
        Math.abs(target.getLosingStreak()) > target.payout * 2 &&
        target.getOverheadUnderPressureCount() > 3,
      riskOffCheck: () =>
        Math.abs(target.getRiskOnLosingStreak()) > target.payout,
      progressiveBet: () => false
    })
  };

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

  /*
  *
  *
  *
  *
    TARGET MANAGER
  *
  *
  *
  */

  tm = initTargetManager(scenarios.baseline);

  initWindowEvents();

  function evalResult(result) {
    lastResult = result;
    rollCount++;

    tm.push(result);

    tm.renderRunSummaryToTable();
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

  function initTargetManager(scenario) {
    function generatePayouts() {
      return Array.from(
        {
          length: 100
        },
        (v, k) => 5 + k * 1
      );
    }

    class Stats {
      constructor(size, payout) {
        this.size = size;
        this.payout = payout;
        this.streak = 0;
        this.pstreak = 0;
        this.hitCount = 0;
        this.losingStreak = 0;
        this.winRateAtStreakStart = 0;
        this.buffer = new Array(size).fill(null);
        this.index = 0;
        this.count = 0;
        this.sum = 0;
        this.rollCount = 0;
        this.ratio = 0;
        this.breachRatio = 0;
        this.nextTarget = null;
        this.previousTarget = null;
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
          if (this.payout === 100) this.breachRatio = this.ratio;

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

        this.losingStreak = this.streak < 0 ? Math.abs(this.streak) : 0;

        if (this.losingStreak === 1) {
          this.winRateWasLowWhenStreakStarted =
            this.getWinRatePercentOfTeo(100) < 80;
        } else if (this.losingStreak === 0) {
          this.winRateWasLowWhenStreakStarted = false;
        }

        this.ratio = this.getStreakDiff() / this.payout;
      };

      getWinRatePercentOfTeo = (lookback = 100) =>
        (this.getWinRate(lookback) / this.getTeo()) * 100;

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
      getWinRateSensitiveLosingStreak = () =>
        this.winRateWasLowWhenStreakStarted ? this.getLosingStreak() : 0;
      getPayout = () => this.payout;
      getStreakDiff = () => this.streak + this.payout;
      getRatio = () => this.ratio;
    }

    class Target {
      constructor(payout, scenarioFn) {
        this.payout = payout;
        this.stats = new Stats(100, payout);
        this.rollCount = 0;
        this.nextTarget = null;
        this.previousTarget = null;
        this.losingStreak = 0;
        this.pstreak = 0;
        this.streakID = 1;
        this.streakIDSet = false;
        this.riskOffStreakID = 0;
        this.profit = 0;
        this.wager = 0;
        this.baseWager = 0;
        this.riskOn = false;
        this.isFlip = false;
        this.flipResolved = false;
        this.isBuoy = false;

        if (scenarioFn) {
          const { riskOnCheck, riskOffCheck, progressiveBet } = scenarioFn(
            this
          );
          this.riskOnCheck = riskOnCheck;
          this.riskOffCheck = riskOffCheck;
          this.progressiveBet = progressiveBet;
        } else {
          this.riskOnCheck = () => false;
          this.riskOffCheck = () => false;
          this.progressiveBet = () => false;
        }

        // How many times this this target to risk on
        this.riskOnCount = 0;

        // How many times did the target roll over during the risk on cycle
        // this is reset when going risk on/off and the total is aggregated in the
        // totalRiskOnCycles variable
        this.riskOnCycle = 0;

        // Summation of the cycles
        this.totalRiskOnCycleCount = 0;

        // Count of exit with profit
        this.winCount = 0;

        // Count of exit with loss
        this.loseCount = 0;
      }

      isProfitable() {
        return this.getPL() > 0;
      }

      getWager = () => this.wager;

      setNextTarget(target) {
        this.nextTarget = target;
      }
      setPreviousTarget(target) {
        this.previousTarget = target;
      }

      getNextTarget = () => this.nextTarget;

      getOverheadRatioSum() {
        const nextTarget = this.getNextTarget();

        if (!nextTarget) return this.getRatio();
        return this.getRatio() + nextTarget.getOverheadRatioSum();
      }

      getOverheadCount() {
        const next = this.getNextTarget();
        if (!next) return 1; // count self
        return 1 + next.getOverheadCount();
      }

      getOverheadUnderPressureCount() {
        const next = this.getNextTarget();
        const selfCount = this.getRatio() < 0 ? 1 : 0;

        if (!next) return selfCount;

        return selfCount + next.getOverheadUnderPressureCount();
      }

      getOverheadRatioAvg() {
        if (this.getOverheadCount() === 0) return this.getOverheadRatioSum();
        return this.getOverheadRatioSum() / this.getOverheadCount();
      }

      getPreviousTarget = () => this.previousTarget;

      getPayout() {
        return this.payout;
      }

      getRiskOnLosingStreak = () => this.losingStreak;

      isDifferentRiskOnCycle = () => this.getRiskOnLosingStreak() === 0;

      push(result, stopLimit) {
        this.updateStreak(result);
        this.stats.push(result);
      }

      updateStreak(result) {
        if (!this.isRiskOn() && this.losingStreak === 0) return; // Continue to count the losing steak even if it goes risk off

        if (result >= this.payout) {
          if (this.losingStreak > 0) this.pstreak = this.losingStreak;
          this.losingStreak = 0;
        } else {
          this.losingStreak++;
        }
      }

      getPL = () => this.profit;

      getLSEqualsPayoutMod(divisor = 1) {
        if (this.losingStreak === 0) return false;

        return this.losingStreak % Math.floor(this.payout / divisor) === 0;
      }

      getScaledWager(cycle) {
        const decrementor = cycle / 100;
        const baseFactor = 1.5;
        const scalingFactor = baseFactor - decrementor;
        return (
          this.baseWager * Math.pow(1.92 / this.getPayout(), scalingFactor)
        );
      }

      shouldGoRiskOff() {
        // return this.getRiskOnLosingStreak() === 0 || tm.getTotalRatio() > 50;
        // return this.isProfitable() || this.riskOffCheck() || tm.getTotalRatio() > 100
        return this.isProfitable() || tm.getTotalRatio() > 100;
      }

      goRiskOn(wager) {
        this.wager = wager;
        this.baseWager = wager;
        this.profit = 0;
        this.losingStreak = 0;
        this.riskOnCycle = 0;
        this.riskOn = true;
        this.riskOnCount++;
      }

      goRiskOff() {
        if (this.profit > 0) {
          this.winCount++;
        } else {
          this.loseCount++;
        }
        this.totalRiskOnCycleCount += this.riskOnCycle;
        this.losingStreak = 0;
        this.riskOn = false;
        this.wager = 0;
        this.riskOnCycle = 0;
        this.profit = 0;
      }

      getRiskOnCount = () => this.riskOnCount;
      getTotalRiskOnCycleCount = () => this.totalRiskOnCycleCount;
      getWinCount = () => this.winCount;
      getLoseCount = () => this.loseCount;
      getWinLoseRatio() {
        if (this.loseCount === 0) return 1;
        return this.winCount / this.loseCount;
      }
      isRiskOn = () => this.riskOn;
      getWinRatePercentOfTeo = (lookback = 100) =>
        this.stats.getWinRatePercentOfTeo(lookback);
      getStreak = () => this.stats.getStreak();
      getLosingStreak = () => this.stats.getLosingStreak();
      getPreviousLosingStreak = () => this.pstreak;
      getTeo = () => this.stats.getTeo();
      getHitCount = () => this.stats.getHitCount();
      getRollCount = () => this.rollCount;
      getRatio = () => this.stats.getRatio();
    }

    class TargetManager {
      constructor(targets) {
        this.targets = targets;
        this.previousTotalRatio = 0;
        this.totalRatio = 0;
        this.totalRatioHistory = [];
        this.ratioThresholdBreached = false;
        this.riskOnChecksPassed = false;
        this.totalRatioPhase = "positive";
        this.currentFlips = [];
        this.previousFlips = [];
        this.flipsDelta = [];
      }

      renderRunSummaryToTable() {
        const tableData = this.targets.map((target) => ({
          Payout: target.getPayout(),
          Rolls: target.getRollCount(),
          "Losing Streak": target.getLosingStreak(),
          Ratio: target.getRatio().toFixed(3),
          "Negative Overhead Ratio": target.getOverheadUnderPressureCount(),
          _highlightFlip: target.isFlip,
          _highlightBuoy: target.isBuoy,
          _flipResolved: target.flipResolved
        }));

        const tableEl = document.getElementById("summary-table");
        if (!tableEl) return;

        const headers = Object.keys(tableData[0] || {}).filter(
          (h) => h !== "_highlight"
        );

        tableEl.innerHTML = `
    <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>
      ${tableData
        .map((row) => {
          let style = "";

          if (row._highlightBuoy) {
            style = `style="background-color: red; color: #222; font-weight: bold;"`;
          } else if (row._highlightFlip) {
            style = `style="background-color: lightblue; color: #222; font-weight: bold;"`;
          } else if (row._flipResolved) {
            style = `style="background-color: green; color: #222; font-weight: bold;"`;
          }

          return `<tr ${style}>${headers
            .map((h) => `<td>${row[h]}</td>`)
            .join("")}</tr>`;
        })
        .join("")}
    </tbody>
  `;
      }

      getTotalRatio = () => this.totalRatio;

      getNextRiskTarget2() {
        const totalRatio = this.getTotalRatio();
        const slope = this.getRatioSlope();

        if (
          this.totalRatioPhase === "negative" &&
          totalRatio < -90 &&
          slope > 1.5
        ) {
          console.log({
            totalRatio,
            slope,
            selectedTarget: this.getBestRewardToPressureTarget()?.getPayout()
          });
          return this.getBestRewardToPressureTarget();
        }

        return null;
      }

      setRecoveryFlips() {
        const totalRatio = this.getTotalRatio();
        if (totalRatio >= 0) return { flipsRequired: 0, targets: [] };

        const negativeTargets = this.targets
          .filter((t) => t.getRatio() < 0)
          .sort((a, b) => a.getRatio() - b.getRatio()); // more negative first

        let sumToFlip = 0;
        let flips = [];
        let buoyTarget = null;

        for (const target of negativeTargets) {
          sumToFlip += -target.getRatio(); // flipping this removes this much drag
          flips.push(target);
          if (sumToFlip >= Math.abs(totalRatio)) {
            buoyTarget = target;
            break;
          }
        }

        // Clear flags
        this.targets.forEach((t) => {
          t.isFlip = false;
          t.isBuoy = false;
        });

        // Mark flags
        flips.forEach((t) => (t.isFlip = true));
        if (buoyTarget) buoyTarget.isBuoy = true;

        this.previousFlips = this.currentFlips.slice();
        this.currentFlips = flips.map((t) => t.getPayout());
        this.flipsDelta = this.currentFlips.filter(
          (x) => !this.previousFlips.includes(x)
        );
      }

      getFlipsDeltaAfterReversion() {
        if (!this.flipsReverted()) return [];
        return this.getFlipsDelta();
      }

      flipsReverted() {
        return this.totalRatio > 0 && this.previousTotalRatio < 0;
      }
      getFlipsDelta() {
        return this.flipsDelta;
      }

      getNextRiskTarget() {
        return targets.find((target) => target.isBuoy);
      }

      getRatioSlope(windowSize = 5) {
        const recent = this.totalRatioHistory.slice(-windowSize);
        if (recent.length < 2) return 0;

        // Compute slope via least squares
        const n = recent.length;
        const sumX = (n * (n - 1)) / 2;
        const sumX2 = ((n - 1) * n * (2 * n - 1)) / 6;
        let sumY = 0;
        let sumXY = 0;

        for (let i = 0; i < n; i++) {
          const x = i;
          const y = recent[i];
          sumY += y;
          sumXY += x * y;
        }

        const numerator = n * sumXY - sumX * sumY;
        const denominator = n * sumX2 - sumX * sumX;
        return denominator === 0 ? 0 : numerator / denominator;
      }

      getLowestRatioTarget() {
        if (!this.targets || this.targets.length === 0) return null;

        return this.targets.reduce((lowest, current) =>
          current.getRatio() < lowest.getRatio() ? current : lowest
        );
      }

      updateRatioPhase() {
        const totalRatio = this.getTotalRatio();

        if (this.totalRatioPhase === "positive" && totalRatio < -90) {
          this.totalRatioPhase = "negative";
        }

        if (this.totalRatioPhase === "negative" && totalRatio > 0) {
          this.totalRatioPhase = "positive";
        }
      }

      getBestRewardToPressureTarget() {
        if (!this.targets || this.targets.length === 0) return null;

        return this.targets.reduce((best, current) => {
          const currentScore =
            current.getPayout() / Math.abs(current.getRatio() || 0.001);
          const bestScore =
            best.getPayout() / Math.abs(best.getRatio() || 0.001);
          return currentScore > bestScore ? current : best;
        });
      }

      shouldExitPosition(currentTarget) {
        const totalRatio = this.getTotalRatio();
        const slope = this.getRatioSlope();

        if (totalRatio > 0 && slope < 0.5) {
          return true;
        }

        if (currentTarget.getRatio() > 0) {
          return true;
        }

        return false;
      }

      push(result, stopLimit) {
        this.previousTotalRatio = this.totalRatio;
        this.totalRatio = 0;
        this.totalBreachRatio = 0;

        for (let i = 0; i < this.targets.length; i++) {
          const t = this.targets[i];

          if (t.getLosingStreak() >= t.getPayout()) {
            t.flipResolved = false;
          }

          t.flipResolved = false;

          if (t.isFlip && result >= t.payout) {
            t.flipResolved = true;
          }

          t.isFlip = false;
          t.isBuoy = false;
          t.push(result, stopLimit);
          this.totalRatio += t.getRatio();
        }

        this.setRecoveryFlips();

        const delta = this.getFlipsDeltaAfterReversion();

        if (delta.length > 0) {
          console.log("FLIPS DELTA", delta);
        }

        if (this.totalRatioHistory.length === 500)
          this.totalRatioHistory.shift();

        this.totalRatioHistory.push(this.totalRatio);
      }
    }

    const targets = generatePayouts().map(
      (payout) => new Target(payout, scenario)
    );

    for (let i = 0; i < targets.length; i++) {
      const current = targets[i];
      const next = targets[i + 1] || null;
      const prev = targets[i - 1] || null;

      current.setNextTarget(next);
      current.setPreviousTarget(prev);
    }

    return new TargetManager(targets);
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
