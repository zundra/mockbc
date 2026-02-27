/* Start Script */
// ==UserScript==
// @name         bc.game win rates v1
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

(function () {
  "use strict";

  let [start, end] = [0, 49];

  const STOP_HIT_SEQ = ["stop", "hit"];
  const TARGET_HIT_SEQ = ["target", "hit"];
  let WATCH_PAYOUTS = [];
  populateWatchPayouts();

  let lastRollSet = [];
  let currentRollSet = [];
  let rollCount = 0;
  let rollStartTime = null; // in ms
  let losingStreak = 0;
  let hitCount = 0;
  let profit = 0;
  let highHit = 0;
  let highHitRound = 0;
  let highHitLosingStreak = 0;

  let teo = 0;
  $("<style>")
    .prop("type", "text/css")
    .html(
      `
            #control-panel-header, #win-rates-panel-header {
                background: #333;
                padding: 12px;
                font-weight: bold;
                text-align: center;
                border-radius: 8px 8px 0 0;
                font-size: 16px;
                cursor: grab;
            }

            #control-panel, #win-rates-panel {
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
                height: 800px;
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

  const statsPanel = `<div id="win-rates-panel" style="
   position: fixed;
   top: 300px;
   left: 500px;
   z-index: 9999;
   background: #1e1e1e;
   color: #fff;
   padding: 16px;
   width: 400px;
   border-radius: 10px;
   box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
   font-family: Arial, sans-serif;
   font-size: 14px;
   line-height: 1.6;
   cursor: grab;
   ">
   <div id="win-rates-panel-header" style="
      background: #333;
      padding: 10px;
      font-weight: bold;
      text-align: center;
      border-radius: 8px 8px 0 0;
      cursor: grab;
      ">⚙️ Win Rates</div>
   <div id="stats" class="stats-box" style="
      margin: 12px 0;
      background-color: #444;
      padding: 10px;
      border-radius: 6px;
      color: white;
      font-size: 0.9rem;
      text-align: center;
      ">
      <div style="background-color: #1e1e1e; border: 1px solid #333; border-radius: 6px; padding: 10px; margin-top: 10px; color: #ccc; font-family: sans-serif; font-size: 15px; overflow-x: auto;">
         <table style="width: 100%; border-collapse: collapse;" id="win-rates-table">
            <thead>
               <tr>
                  <th style="position: sticky; left: 0; background-color: #1e1e1e; z-index: 1; text-align: left; padding: 6px; white-space: nowrap;">
                     Payout
                  </th>
                  <th style="position: sticky; left: 0; background-color: #1e1e1e; z-index: 1; text-align: left; padding: 6px; white-space: nowrap;">
                     Win Rate
                  </th>
                  <th style="position: sticky; left: 0; background-color: #1e1e1e; z-index: 1; text-align: left; padding: 6px; white-space: nowrap;">
                     Teo
                  </th>
                  <th style="position: sticky; left: 0; background-color: #1e1e1e; z-index: 1; text-align: left; padding: 6px; white-space: nowrap;">
                     Diff
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
    recordRoll();

    if (result > highHit) {
      highHit = result;
      highHitRound = rollCount;
      highHitLosingStreak = 0;
    } else {
      highHitLosingStreak++;
    }

    let payout = getPayout();

    if (result >= payout) {
      hitCount++;
      profit += payout * getWager() - getWager();
    } else {
      losingStreak++;
      profit -= getWager();
    }

    setStreaks(result);
    updateUI();
  }

  function recordRoll() {
    const now = Date.now();

    if (rollStartTime === null) {
      rollStartTime = now;
    }

    rollCount++;
  }

  function getRollsPerSecond() {
    if (rollStartTime === null || rollCount === 0) return "0.00";

    const elapsedSeconds = (Date.now() - rollStartTime) / 1000;
    return (rollCount / elapsedSeconds).toFixed(2);
  }

  function setStreaks(result) {
    WATCH_PAYOUTS.forEach((entry) => {
      const payout = entry.payout;
      if (result >= payout) {
        entry.hitCount++;
        entry.winRate = entry.hitCount / rollCount;
        entry.diff = entry.teo - entry.winRate;
      }
    });
  }

  function updateUI() {
    $("#hit-count").text(hitCount);
    $("#profit-loss")
      .html(profit.toFixed(4))
      .css({ backgroundColor: `${profit > 0 ? "green" : "red"}` });

    const rps = getRollsPerSecond();
    $("#roll-count").html(`${rollCount} | ${rps}`);
    $("#high-hit")
      .html(
        `${highHit} | ${highHitLosingStreak} | ${Math.round(
          rollCount - highHit
        )}`
      )
      .css({
        backgroundColor:
          highHitLosingStreak > highHit * 3 ? "red" : "transparent"
      });

   renderWatchTargetTable();
  }

  function initWindowEvents() {
        $("#win-rates-panel").draggable({
      containment: "window",
      scroll: false
    });


    populateWatchPayouts();
    renderWatchTargetTable();
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
    WATCH_PAYOUTS = payouts.map((p) => ({ payout: p, hitCount: 0, winRate: 0, teo: calculateTeo(p) }));
  }

  function sanitizeId(payout) {
    return payout
      .toString()
      .replace(/\./g, "_")
      .replace(/[^\w-]/g, "");
  }

  function renderWatchTargetTable() {
    const $tbody = $("#win-rates-table tbody");
    $tbody.empty();

    WATCH_PAYOUTS.forEach((entry) => {
      const payout = entry.payout;
      const winRate = entry.winRate;
      const teo = entry.teo;
      const diff = entry.winRate - entry.teo;
      const sanitized = sanitizeId(payout);

      let rowColor = "transparent";

      if (diff < -0.05) {
        rowColor = "red";
      } else if (diff >= 0.05) {
        rowColor = "green"
      }

      const row = `
      <tr style='background-color: ${rowColor}'>
        <td style="position: sticky; left: 0; background-color: #1e1e1e; text-align: left; padding: 4px 6px; white-space: nowrap;">
          ${payout.toFixed(2)}x
        </td>
        <td><span id="win-rate-${sanitized}">${winRate.toFixed(2)}</span></td>
        <td><span id="win-rate-${sanitized}-ratio">${teo.toFixed(
        2
      )}</span></td>
        <td><span id="win-rate-${sanitized}-diff">${diff.toFixed(
        2
      )}</span></td>
      </tr>
    `;
      $tbody.append(row);
    });
  }

  
  function getPayout() {
    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Payout")'
    );
    const inputField = payoutFieldGroup.find("input");

    return Number(inputField.val());
  }

    function getWager() {
    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Amount")'
    );
    const inputField = payoutFieldGroup.find("input");

    return Number(inputField.val());
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
    if (firstLoad || getResetOnStart()) {
      firstLoad = false;
      rollCount = 0;
      highHit = 0;
      highHitLosingStreak = 0;
      highHitRound = 0;
    }

    doBet(); // Start the async loop
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function doInit() {
    observeRollChanges();
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

  setInterval(() => {
    if (performance.memory) {
      console.log(
        "Used JS Heap:",
        (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + " MB"
      );
    }
  }, 5000);

  // Initialize MutationObserver
})();
