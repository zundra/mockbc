/* Start Script */
// ==UserScript==
// @name         bc.game stats v1
// @namespace    http://tampermonkey.net/
// @version      0.1
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

  let lastRollSet = [];
  let currentRollSet = [];
  const rollEngine = initRollEngine();

  $(document).ready(function () {
    // Inject styles using jQuery
    $("<style>")
      .prop("type", "text/css")
      .html(
        `
            #stats-panel-header {
                background: #333;
                padding: 12px;
                font-weight: bold;
                text-align: center;
                border-radius: 8px 8px 0 0;
                font-size: 16px;
                cursor: grab;
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
        `
      )
      .appendTo("head");

    // Define the control panel HTML
    let html = `
<div class="stats-pane" id="statsPane">
   <h2 id="stats-title">Rolling Statistics</h2>
   <div class="stats-block">
      <h3>Last 10 Rolls</h3>
      <p>Mean: <span id="mean10">0</span></p>
      <p>Variance: <span id="variance10">0</span></p>
      <p>Std Dev: <span id="stddev10">0</span></p>
      <p>Median: <span id="median10">0</span></p>
   </div>
   <div class="stats-block">
      <h3>Last 100 Rolls</h3>
      <p>Mean: <span id="mean100">0</span></p>
      <p>Variance: <span id="variance100">0</span></p>
      <p>Std Dev: <span id="stddev100">0</span></p>
      <p>Median: <span id="median100">0</span></p>
   </div>
   <div class="stats-block">
      <h3>Last 1000 Rolls</h3>
      <p>Mean: <span id="mean1000">0</span></p>
      <p>Variance: <span id="variance1000">0</span></p>
      <p>Std Dev: <span id="stddev1000">0</span></p>
      <p>Median: <span id="median1000">0</span></p>
   </div>
   <div class="stats-block">
      <h3>High Hits</h3>
      <table style="font-size: 11px; width: 100%; text-align: right;">
         <thead>
            <tr style="text-align: center;">
               <th style="width: 25%;">Rolls</th>
               <th style="width: 25%;">Hit</th>
               <th style="width: 25%;">Δ</th>
               <th style="width: 25%;">Left</th>
            </tr>
         </thead>
         <tbody>
            <tr>
               <td>50</td>
               <td><span id="highHit50-hit"></span></td>
               <td><span id="highHit50-delta"></span></td>
               <td><span id="highHit50-remaining"></span></td>
            </tr>
            <tr>
               <td>100</td>
               <td><span id="highHit100-hit">0</span></td>
               <td><span id="highHit100-delta">0</span></td>
               <td><span id="highHit100-remaining">0</span></td>
            </tr>
            <tr>
               <td>1000</td>
               <td><span id="highHit1000-hit">0</span></td>
               <td><span id="highHit1000-delta">0</span></td>
               <td><span id="highHit1000-remaining">0</span></td>
            </tr>
            <tr>
               <td>10000</td>
               <td><span id="highHit10000-hit">0</span></td>
               <td><span id="highHit10000-delta">0</span></td>
               <td><span id="highHit10000-remaining">0</span></td>
            </tr>
            <tr>
               <td>Global</td>
               <td><span id="highHit-hit">0</span></td>
               <td><span id="highHit-delta">0</span></td>
               <td><span id="highHit-remaining">0</span></td>
            </tr>
         </tbody>
      </table>
   </div>
</div>
    `;

    // Append the control panel to the body
    $("body").append(html);
    initWindowEvents();
  });

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

  function initWindowEvents() {
    $("#statsPane").draggable({
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

    Array.prototype.median = function () {
      if (this.length === 0) return null; // Handle empty array case

      const medianIndex = Math.floor((this.length - 1) / 2); // Get the median index
      return this[medianIndex]; // Return the median element
    };
  }

  function initRollEngine() {
    let rollCount = 0;
    const rollingStats = initRollingStats();
    const highHits = initHighHits();
    const ui = initUI(rollingStats, highHits);

    class SessionHandler {
      constructor(rollHandler) {
        this.rollHandler = rollHandler;
      }

      addResult(result) {
        rollingStats.push(result);
        highHits.addResult(result);
        ui.update();
      }
    }

    class RollEngine {
      constructor() {
        this.sessionHandler = new SessionHandler();
      }
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

    return new RollingStats(100);
  }

  function initUI(rollingStats, highHits) {
    class UI {
      constructor(rollingStats, highHits) {
        this.rollingStats = rollingStats;
        this.highHits = highHits;
      }

      update(result) {
        this.updateStats();
      }

      updateStats(rollHandler) {
        function setColor(id, value, threshold) {
          let $element = $("#" + id); // Select element with jQuery
          $element.css("color", value < threshold ? "red" : "white"); // Apply color conditionally
        }

        const stats10Mean = this.rollingStats.getMean(10);
        const stats100Mean = this.rollingStats.getMean(100);
        const stats1000Mean = this.rollingStats.getMean(1000);

        const stats10variance = this.rollingStats.getVariance(10);
        const stats100variance = this.rollingStats.getVariance(100);
        const stats1000variance = this.rollingStats.getVariance(1000);

        const stats10median = this.rollingStats.getMedian(10);
        const stats100median = this.rollingStats.getMedian(100);
        const stats1000median = this.rollingStats.getMedian(1000);

        const stats10StdDev = this.rollingStats.getStandardDeviation(10);
        const stats100StdDev = this.rollingStats.getStandardDeviation(100);
        const stats1000StdDev = this.rollingStats.getStandardDeviation(1000);

        $("#hit-count-roll-count").text(
          `${rollEngine.sessionHandler.hitCount}/${rollEngine.sessionHandler.rollCount}`
        );

        $("#mean10").text(stats10Mean.toFixed(2));
        $("#variance10").text(stats10variance.toFixed(2));
        $("#stddev10").text(stats10StdDev.toFixed(2));
        $("#median10").text(stats10median.toFixed(2));

        $("#mean100").text(stats100Mean.toFixed(2));
        $("#variance100").text(stats100variance.toFixed(2));
        $("#stddev100").text(stats100StdDev.toFixed(2));
        $("#median100").text(stats100median.toFixed(2));

        $("#mean1000").text(stats1000Mean.toFixed(2));
        $("#variance1000").text(stats1000variance.toFixed(2));
        $("#stddev1000").text(stats1000StdDev.toFixed(2));
        $("#median1000").text(stats1000median.toFixed(2));

        const highHits = this.highHits.getResults();

        $("#highHit-hit")
          .text(`${highHits.highHit.hit}`)
          .css({
            backgroundColor:
              highHits.highHit.hitDelta < 0 ? "red" : "transparent"
          });
        $("#highHit-remaining").text(`${highHits.highHit.rollsRemaining}`);
        $("#highHit-delta").text(`${highHits.highHit.hitDelta.toFixed(2)}`);

        $("#highHit50-hit")
          .text(`${highHits.highHit50.hit}`)
          .css({
            backgroundColor:
              highHits.highHit50.hitDelta < 0 ? "red" : "transparent"
          });
        $("#highHit50-remaining").text(`${highHits.highHit50.rollsRemaining}`);
        $("#highHit50-delta").text(`${highHits.highHit50.hitDelta.toFixed(2)}`);

        $("#highHit100-hit")
          .text(`${highHits.highHit100.hit}`)
          .css({
            backgroundColor:
              highHits.highHit100.hitDelta < 0 ? "red" : "transparent"
          });
        $("#highHit100-remaining").text(
          `${highHits.highHit100.rollsRemaining}`
        );
        $("#highHit100-delta").text(
          `${highHits.highHit100.hitDelta.toFixed(2)}`
        );

        $("#highHit1000-hit")
          .text(`${highHits.highHit1000.hit}`)
          .css({
            backgroundColor:
              highHits.highHit1000.hitDelta < 0 ? "red" : "transparent"
          });
        $("#highHit1000-remaining").text(
          `${highHits.highHit1000.rollsRemaining}`
        );
        $("#highHit1000-delta").text(
          `${highHits.highHit1000.hitDelta.toFixed(2)}`
        );

        $("#highHit10000-hit")
          .text(`${highHits.highHit10000.hit}`)
          .css({
            backgroundColor:
              highHits.highHit10000.hitDelta < 0 ? "red" : "transparent"
          });
        $("#highHit10000-remaining").text(
          `${highHits.highHit10000.rollsRemaining}`
        );
        $("#highHit10000-delta").text(
          `${highHits.highHit10000.hitDelta.toFixed(2)}`
        );

        // Last 10 Rolls
        setColor("mean10", stats10Mean, stats100Mean - 1);
        setColor("variance10", stats10variance, 0.5);
        setColor("stddev10", stats10StdDev, 1);
        setColor("median10", stats10Mean, 1.92);

        // Last 100 Rolls
        setColor("mean100", stats100Mean, stats1000Mean - 1);
        setColor("variance100", stats100variance, 0.5);
        setColor("stddev100", stats100StdDev, 1);
        setColor("median100", stats100median, 1.92);

        // Last 1000 Rolls
        setColor("mean1000", stats1000Mean, 1.92);
        setColor("variance1000", stats1000variance, 0.5);
        setColor("stddev1000", stats1000StdDev, 1);
        setColor("median1000", stats1000median, 1.92);
      }
    }

    return new UI(rollingStats, highHits);
  }

  function initHighHits() {
    class HighHits {
      constructor() {
        this.rollCount = 0;
        this.highHit = 0;
        this.round = 0;

        this.intervals = [50, 100, 1000, 10000];
        this.data = new Map();

        for (const interval of this.intervals) {
          this.data.set(interval, {
            highHit: 0,
            round: 0
          });
        }
      }

      addResult(result) {
        this.rollCount++;

        // Update global high hit
        if (result > this.highHit) {
          this.highHit = result;
          this.round = this.rollCount;
        }

        for (const interval of this.intervals) {
          if (this.rollCount % interval === 0) {
            this.data.set(interval, { highHit: 0, round: 0 });
          }

          const entry = this.data.get(interval);
          if (result > entry.highHit) {
            this.data.set(interval, {
              highHit: result,
              round: this.rollCount
            });
          }
        }
      }

      getResults() {
        const results = {
          highHit: {
            hit: this.highHit,
            round: this.round,
            roundDelta: this.rollCount - this.round,
            hitDelta: this.highHit - (this.rollCount - this.round),
            rollsRemaining: Infinity
          }
        };

        for (const interval of this.intervals) {
          const { highHit, round } = this.data.get(interval);
          const roundDelta = this.rollCount - round;
          const rollsRemaining = Math.max(0, interval - roundDelta);

          results[`highHit${interval}`] = {
            hit: highHit,
            round,
            roundDelta,
            hitDelta: highHit - roundDelta,
            rollsRemaining
          };
        }

        return results;
      }
    }
    return new HighHits();
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

  // Observer for Bustadice "My Bets" table
  let observer = null;

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

  function observeWagerInput(callback) {
    const observer = new MutationObserver(() => {
      const input = $('div[role="group"]')
        .has('label:contains("Amount")')
        .find("input");
      if (input.length) {
        observer.disconnect();
        callback(input);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

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
