/* Start Script */
// ==UserScript==
// @name         bc.game streaks V2
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  try to take over the world!
// @author       You
// @match        https://*.game/game/limbo
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bc.game
// @require https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const LOOBKACKS = [20, 100, 1000]
  let lastRollSet = [];
  let currentRollSet = [];
  const rollEngine = initRollEngine();

  let newWindow = null;

  function evalResult(result) {
    rollEngine.sessionHandler.addResult(result);
  }

  // Utility function: Get current roll data
  function getCurrentRollData() {
    return $(".grid.grid-auto-flow-column div span")
      .map(function () {
        return $(this).text();
      })
      .get();
  }

  function doInit() {
    observeRollChanges();
    initPrototypes();
  }

  function initDraggable() {
    $(document).ready(function () {
      $("#control-panel").draggable({
        containment: "window",
        scroll: false
      });

      $("#statsPane").draggable({
        containment: "window",
        scroll: false
      });
    });
  }

  function initPrototypes() {
    Array.prototype.last = function () {
      return this[this.length - 1];
    };
    Array.prototype.first = function () {
      return this[0];
    };

    Array.prototype.median = function () {
      if (this.length === 0) return null; // Handle empty array case

      const medianIndex = Math.floor((this.length - 1) / 2); // Get the median index
      return this[medianIndex]; // Return the median element
    };
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function initRollEngine() {
    let rollCount = 0;
    const targets = generateTargets();
    const rollingStats = initRollingStats();
    const ui = initUI(targets, rollingStats);

    class SessionHandler {
      constructor(rollHandler) {}

      getWinRate() {
        return this.hitCount / this.rollCount;
      }

      getTeo() {
        return 1 / (this.payout * 1.05);
      }

      getMean(lookback) {
        return rollingStats.getMean(lookback);
      }

      getMedian(lookback) {
        return rollingStats.getMedian(lookback);
      }

      getVariance(lookback) {
        return rollingStats.getVariance(lookback);
      }

      getStandardDeviation(lookback) {
        return rollingStats.getStandardDeviation(lookback);
      }

      addResult(result) {
        rollCount++;
        targets.forEach((target) => target.addResult(result));
        ui.update();
      }
    }

    class RollEngine {
      constructor() {
        this.sessionHandler = new SessionHandler();
      }
    }

    function generateTargets() {
      class Stats {
        constructor(payout, lookbacks = LOOBKACKS) {
          this.lookbacks = lookbacks;
          this.payout = payout;
          this.teo = 1 / (this.getPayout() * 1.04);
          this.streak = 0;
          this.weightedStreak = 0;
          this.cWeightedStreak = 0;
          this.incrementor = this.payout - 1;
          this.decrementor = 1;
          this.pstreak = 0;

          this.streakSignFlipped = false;
          this.globalRolls = 0;
          this.globalHits = 0;
          this.losingStreak = 0;

          // Init EMA trackers per lookback
          this.emaTrackers = {};
          for (const lb of lookbacks) {
            this.emaTrackers[lb] = { value: 0, alpha: 2 / (lb + 1) };
          }
        }

        push(result) {
          this.updateStats(result);
        }

        updateStats = (result) => {
          const hit = result >= this.payout;
          this.globalRolls++;

          // Always update EMA with alpha=1 (just raw value, we'll smooth later)
          this.ema = hit ? 1 : 0;

          if (result >= this.payout) {
            this.hitCount++;
            if (this.streak < 0) {
              this.streakSignFlipped = true;
              this.pstreak = this.streak;
            } else {
              this.streakSignFlipped = false;
            }
            this.streak = Math.max(this.streak + 1, 1);
            this.weightedStreak = this.streak * this.incrementor;
          } else {
            if (this.streak > 0) {
              this.streakSignFlipped = true;
              this.pstreak = this.streak;
            } else {
              this.streakSignFlipped = false;
            }
            this.streak = Math.min(this.streak - 1, -1);
            this.weightedStreak = this.streak * this.decrementor;
          }

          this.losingStreak = this.streak < 0 ? this.streak : 0;

          for (const lb in this.emaTrackers) {
            const tracker = this.emaTrackers[lb];
            tracker.value =
              tracker.alpha * (hit ? 1 : 0) +
              (1 - tracker.alpha) * tracker.value;
          }
        };

        // Pass a lookback length and compute an EMA on the fly
        getWindowWinRate(lookback) {
          return this.emaTrackers[lookback]
            ? this.emaTrackers[lookback].value * 100
            : null;
        }

        getPreviousStreak = () => this.pstreak;

        getStreak = () => this.streak;

        getRollCount = () => this.globalRolls;

        getWinRate(lookback) {
          return this.getWindowWinRate(lookback);
        }

        getWindowWinRates() {
          return this.lookbacks.map((lookback) =>
            this.getWindowWinRate(lookback)
          );
        }

        getWindowWinRatePercentsOfTeo() {
          return this.lookbacks.map(
            (lookback) =>
              (this.getWindowWinRate(lookback) / 100 / this.getTeo()) * 100
          );
        }

        getTotalWinRate() {
          return (this.globalHits / this.globalRolls) * 100;
        }

        // (1.5 - 1) * 2
        getWeightedStreak = () => this.weightedStreak;
        getLosingStreak = () => this.losingStreak;
        getRatio = () => this.getWeightedStreak() / this.payout;
        getWinRatePercentOfTeo() {
          return (this.getTotalWinRate() / this.getTeo()) * 100;
        }
        getStreakSignFlipped = () => this.streakSignFlipped;
        getPayout = () => this.payout;
        getTeo = () => this.teo;
      }

      class Target {
        constructor(payout, lookbacks = LOOBKACKS) {
          this.stats = new Stats(payout);
          this.payout = payout;
          this.lookbacks = lookbacks;
          this.deltaBalance = 0;
          this.pratio = 0;
          this.streakColors = {}
        }

        addResult = (result) => {
          this.pratio = this.getRatio();
          this.stats.push(result);
          this.setStreakColors();
          this.updateDeltaBalance();
        };

        getTeo = () => this.stats.getTeo();
        getLookbacks = () => this.lookbacks;
        getShortLookback = () => this.lookbacks[0];
        getMidLookback = () => this.lookbacks[1];
        getLongLookback = () => this.lookbacks[2];

        getPayout = () => this.stats.getPayout();
        getHitCount = () => this.stats.getHitCount();
        getRollCount = () => this.stats.getRollCount();
        getStreak = () => this.stats.getStreak();
        getPreviousStreak = () => this.pstreak;
        getLosingStreak = () => this.stats.getLosingStreak();
        getStreakSignFlipped = () => this.stats.getStreakSignFlipped();
        getLSRatioAbs = () => this.stats.getLSRatioAbs();
        getLSRatio = () => this.stats.getLSRatio();
        getStrength = () => this.getTeo() * this.getStreak();
        getTotalWinRate = () => this.stats.getTotalWinRate();
        getWinRate = (lookback) => this.stats.getWinRate(lookback);
        getRatio = () => this.stats.getRatio();
        losingStreakExceedsN = (n) =>
          this.getLSRatioAbs() > n * this.stats.getPayout();

        getStrengthScaled = () =>
          this.applyPercentChange(
            this.getStrength(),
            this.averageWinRatePercentOfTeo()
          );

        averageWinRatePercentOfTeo() {
          const data = this.getWinRatePercentsOfTeo();
          const len = data.length;

          return data.reduce((a, b) => a + b, 0) / len;
        }

        applyPercentChange(value, percent) {
          return value * (1 + (100 - percent) / 100);
        }

        applyCompoundChange(value, percent, steps) {
          const factor = 1 + percent / 100;
          return value * Math.pow(factor, steps);
        }

        getStrengthThreshold(threshold) {
          return this.applyCompoundChange(
            threshold,
            this.getWinRatePercentOfTeo(),
            1
          );
        }
        getWinRatePercentsOfTeo = () => {
          const lookbacks = this.getLookbacks().slice();
          lookbacks.push(Infinity);
          return lookbacks.map((lookback) =>
            this.getWinRatePercentOfTeo(lookback)
          );
        };

        getWinRatePercentOfTeo = (lookback = 100) => {
          return (
            (this.stats.getWinRate(lookback) / (this.getTeo() * 100)) * 100
          );
        };

        getWinRateChange = (lookback) => {
          const winRate = this.stats.getWinRate(lookback);
          const teo = this.getTeo();
          return ((winRate - teo) / teo) * 100;
        };

        exceedsStrengthThreshold = (threshold) => {
          if (this.getRollCount() < this.payout * 10) return false;
          const strength = this.getStrengthScaled();
          return strength < threshold;
        };

        updateDeltaBalance() {
          const expected = this.getTeo(); // per roll
          const actual = this.getLosingStreak() === 0 ? 1 : 0;

          if (!this.deltaBalance) this.deltaBalance = 0;
          this.deltaBalance += expected - actual;
        }

       setStreakColors() {
        // Logistic squash for smooth scaling
        const ratio = this.getRatio();
        const absRatio = Math.abs(ratio);

        if (absRatio < 1 && (ratio - this.pratio > 0)) return;

        const intensity = 1 / (1 + Math.exp(-8 * (absRatio - 1)));

        // Cold (negative ratio) = red, Hot (positive ratio) = blue
        const baseColor = ratio < 0 ? [200, 50, 50] : [50, 100, 220];

        const fgColor = "white";
        let bgColor = "transparent";
        bgColor = `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${Math.min(
          1,
          intensity
        )})`;

        
        
        this.streakColors = {bgColor, fgColor}
      }

        getWinRatePercentOfTeoUIData() {
          const winRatePercentsOfTeo = this.getWinRatePercentsOfTeo();

          let idx = 0;

          return winRatePercentsOfTeo.map((wrpot) => {
            return {
              pot: wrpot,
              foregroundColor: "",
              backgroundColor: wrpot < 70 ? "red" : "transparent"
            };
          });
        }

        getStreakUIData() {
          const streak = this.getStreak();
      
          const colors = this.streakColors;
          const backgroundColor = colors.bgColor;
          const foregroundColor = colors.fgColor;
        const absRatio = this.getRatio();
          return {
            value: `${streak}|${absRatio.toFixed(2)}`,
            foregroundColor: foregroundColor,
            backgroundColor: backgroundColor
          };
        }

        getStrengthUIData() {
          const strength = this.getStrengthScaled();

          let foregroundColor = "transparent";
          let backgroundColor = "transparent";

          if (strength > 3) {
            backgroundColor = "green";
          } else if (strength < -3) {
            backgroundColor = "red";
          }

          return {
            value: strength,
            foregroundColor: foregroundColor,
            backgroundColor: backgroundColor
          };
        }
      }
      return generatePayouts().map((payout) => new Target(payout));
    }

    function generatePayouts() {
      return [
        1.01,
        1.2,
        1.3,
        1.4,
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
        ...Array.from({ length: 10 }, (_, k) => 10 + k * 10)
      ];
    }
    return new RollEngine();
  }

  function initRollingStats() {
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

    return new RollingStats(10000);
  }

  function initUI(targets, rollingStats) {
    function getNewWindowHTMLNode(hook) {
      return $(newWindow.document).find(hook);
    }

    class UI {
      constructor(targets, rollingStats) {
        this.targets = targets;
        this.rollingStats = rollingStats;
      }

      update(result) {
        this.updateTable();
      }

      updateTable() {
        const MAX_STRENGTH_BLOCKS = 50;
        const MAX_BLOCKS = 15;
        const SCALE_FACTOR = 2; // ✅ 2 bars per 1 ratio unit
        const winRateContainer = getNewWindowHTMLNode("#winRateContainer");

        if (!winRateContainer || winRateContainer.length === 0) {
          console.error("Win rate container not found in new window!");
          return;
        }

        // Ensure the table structure exists
        let table = winRateContainer.find(".win-rate-table");
        if (table.length === 0) {
          table = $("<table>").addClass("win-rate-table").append("<tbody>");
          winRateContainer.append(table);
        }

        this.targets.forEach((entry) => {
          const target = entry.getPayout();

          const streakUIData = entry.getStreakUIData();
          const strengthUIData = entry.getStrengthUIData();

          const strength = strengthUIData.value;
          const streak = streakUIData.value;

          const sanitizedTarget = `${target}`.replace(/\./g, "_");
          let row = table.find(`#row-${sanitizedTarget}`);

          if (row.length === 0) {
            row = $("<tr>")
              .addClass("win-rate-row")
              .attr("id", `row-${sanitizedTarget}`);

            const targetLabel = $("<td>")
              .addClass("win-rate-label")
              .text(`Target: ${target}`);

            const blockContainer = $("<td>").addClass("streak-blocks").css({
              display: "flex",
              gap: "2px",
              minWidth: "250px"
            });

            const strengthMeterContainer = $("<td>")
              .addClass("strength-meter")
              .css({
                display: "flex",
                gap: "2px",
                minWidth: "100px",
                minHeight: "14px",
                justifyContent: "flex-start"
              });

            row.append(
              targetLabel,
              blockContainer,
              strengthMeterContainer
            );
            table.append(row);
          }

          const blockContainer = row.find(".streak-blocks");
          const strengthMeterContainer = row.find(".strength-meter");
          const blocks = blockContainer.find(".streak-block");

          if (blocks.length >= MAX_BLOCKS) {
            blocks.last().remove();
          }

          const needsNewBlock =
            entry.getStreakSignFlipped() || blocks.length === 0;

          if (needsNewBlock) {
            const streakBlock = $("<div>")
              .addClass("streak-block")
              .css({
                backgroundColor: streakUIData.backgroundColor,
                color: streakUIData.foregroundColor,
                padding: "4px",
                margin: "1px",
                borderRadius: "4px",
                textAlign: "center",
                fontSize: "15px",
                fontWeight: "bold",
                minWidth: "30px"
              })
              .text(`${streak}`);

            blockContainer.prepend(streakBlock);
          } else {
            const firstBlock = blocks.first();
            firstBlock
              .css({
                backgroundColor: streakUIData.backgroundColor,
                color: streakUIData.foregroundColor
              })
              .text(`${streak}`);
          }

          // **Ensure Strength Meter is Cleared and Updated**
          strengthMeterContainer.empty();

          let strengthBars = Math.abs(strength) * SCALE_FACTOR;
          let fullBars = Math.floor(strengthBars);
          let fractionalPart = strengthBars - fullBars;
          fullBars = Math.min(fullBars, MAX_STRENGTH_BLOCKS);

          // Render full bars
          for (let i = 0; i < fullBars; i++) {
            strengthMeterContainer.append(
              $("<div>")
                .addClass("strength-bar")
                .css({
                  width: "8px",
                  height: "14px",
                  backgroundColor: strength > 0 ? "lightgreen" : "red",
                  borderRadius: "2px"
                })
            );
          }

          // Render the fractional bar (if any)
          if (fractionalPart > 0) {
            strengthMeterContainer.append(
              $("<div>")
                .addClass("strength-bar")
                .css({
                  width: `${fractionalPart * 8}px`, // Scale based on remainder
                  height: "14px",
                  backgroundColor: strength > 0 ? "lightgreen" : "red",
                  borderRadius: "2px"
                })
            );
          }
        });
      }
    }

    return new UI(targets, rollingStats);
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

  function getNewWindowHTMLNode(hook) {
    return $(newWindow.document).find(hook);
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

  window.addEventListener("beforeunload", function () {
    if (newWindow && !newWindow.closed) {
      newWindow.close();
    }
  });

  window.addEventListener(
    "load",
    function () {
      (function () {
        // Open a new floating window with specified dimensions
        newWindow = window.open("", "", "width=800, height=1200");

        // Define the HTML content for the new window
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
      .container {
      height: 100%;
      }
      /* Blocks Section */
      .blocks-wrapper {
      flex: 3;
      overflow-y: auto;
      padding: 10px;
      display: flex;
      flex-direction: column;
      }
      #stateBlockContainer {
      display: flex;
      flex-direction: column;
      gap: 10px;
      }
      .state-block-row {
      display: flex;
      align-items: center;
      gap: 5px;
      }
      .state-block {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      background-color: #444;
      cursor: pointer;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
      }
      .lookback-label {
      font-size: 0.9rem;
      color: #aaa;
      margin-right: 8px;
      }

      .message-box {
      margin-bottom: 10px;
      background-color: #333;
      padding: 10px;
      border-radius: 4px;
      color: white;
      font-size: 0.9rem;
      }
      .stats-block {
      margin-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      padding-bottom: 5px;
      }
      /* Collapsible Panel */
      .panel-wrapper {
      position: absolute;  /* ✅ Sticks it to the right */
      top: 0;
      right: 0;  /* ✅ Ensures it stays attached to the right */
      height: 100vh; /* ✅ Full height */
      width: 300px; /* ✅ Default expanded width */
      background-color: #2a2d2e;
      border-left: 1px solid #444;
      padding: 10px;
      overflow-y: auto;
      transition: width 0.3s ease-in-out; /* ✅ Smooth transition */
      }
      .panel-collapsed {
      width: 0px !important;
      padding: 0;
      overflow: hidden;
      border-left: none; /* ✅ Hides border when collapsed */
      }
      /* ✅ Left Content Fills Available Space */
      .main-content {
      margin-right: 300px; /* ✅ Prevents overlap when panel is open */
      transition: margin-right 0.3s ease-in-out;
      }
      .main-content.panel-collapsed {
      margin-right: 0px; /* ✅ Expands when panel collapses */
      }
      .panel-wrapper.collapsed {
      transform: translateX(100%);
      }
      .panel h2 {
      font-size: 1.2rem;
      margin-bottom: 0.5rem;
      color: #00bcd4;
      }
      .panel label {
      display: block;
      margin-bottom: 5px;
      color: white;
      }
      .panel input,
      .panel select {
      width: 100%;
      margin-bottom: 10px;
      padding: 5px;
      background-color: #333;
      color: white;
      border: 1px solid #555;
      border-radius: 4px;
      }
      .panel button {
      background-color: #555;
      border: none;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      }
      .panel button:hover {
      background-color: #777;
      }
      /* Toggle Button */
      .toggle-panel-button {
      position: fixed;
      top: 10px;
      right: 10px;
      width: 30px;
      height: 30px;
      background-color: #00bcd4;
      border: none;
      color: white;
      border-radius: 50%;
      cursor: pointer;
      font-size: 1.2rem;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1001;
      }
      .toggle-panel-button:hover {
      background-color: #0097a7;
      }
      .win-rate-table {
      width: 100%;
      border-collapse: collapse;
      border: none; /* ✅ Removes the ugly gray border */
      }
      .win-rate-row td {
      padding: 4px;
      vertical-align: middle;
      border: none; /* ✅ Removes individual cell borders */
      }
      .streak-blocks {
      display: flex;
      gap: 2px;
      }
      .strength-meter {
      display: flex;
      gap: 2px;

      min-height: 14px;
      justify-content: flex-start;
      }
      .strength-bar {
      width: 8px;
      height: 14px;
      border-radius: 2px;
      }
   </style>
</head>
<body>
   <div class="container">
      <!-- Blocks Section -->
      <div id="winRateContainer">
         <table class="win-rate-table">
            <tbody>
            </tbody>
         </table>
      </div>
   </div>
   </div>
</body>
</html>
`;

        // Write the content to the new window
        newWindow.document.write(htmlContent);
        newWindow.document.close();
      })();
    },
    false
  );
  doInit();
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
