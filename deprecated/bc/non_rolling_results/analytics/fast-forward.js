/* Start Script */
// ==UserScript==
// @name         bc.game fast forward
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://*.game/game/limbo?fast-roll=true
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bc.game
// @require https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @grant        none
// ==/UserScript==

(function() {
    "use strict";

    const RESULTS = [];

    let lastRollSet = [];
    let currentRollSet = [];
    let rollCount = 0;
    let losingStreak = 0;
    let stopped = true;
    let hitCount = 0;
    const highHit = {
        payout: 0,
        round: 0,
        getSummary(rollCount) {
            return `${highHit.payout} || Delta: ${highHit.getRollDelta(rollCount)}`;
        },
        getRollDelta(rollCount) {
            return rollCount - highHit.round;
        },

        getDeltaColor(rollCount) {
            if (highHit.getRollDelta(rollCount) >= (highHit.payout * 2)) {
                return "red";
            }
            return "transparent";
        }
    }

    let teo = 0;

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

            #control-panel {
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
        `,
      )
      .appendTo("head")

    let html = `
    <div id="control-panel" style="
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 9999;
        background: #1e1e1e;
        color: #fff;
        padding: 16px;
        width: 340px;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
        font-family: Arial, sans-serif;
        font-size: 14px;
        line-height: 1.6;
        cursor: grab;
    ">
        <div id="control-panel-header" style="
            background: #333;
            padding: 10px;
            font-weight: bold;
            text-align: center;
            border-radius: 8px 8px 0 0;
            cursor: grab;
        ">⚙️ Control Panel</div>

   <div class="button-group">
      <button id="clear-results">Clear Resuls</button>
   </div>

        <div id="message" class="message-box" style="
            margin: 12px 0;
            background-color: #444;
            padding: 10px;
            border-radius: 6px;
            color: white;
            font-size: 0.9rem;
            text-align: center;
        ">Welcome! Configure your settings to begin.</div>



        <div id="stats" class="stats-box" style="
            margin: 12px 0;
            background-color: #444;
            padding: 10px;
            border-radius: 6px;
            color: white;
            font-size: 0.9rem;
            text-align: center;
        ">
        <div>Roll Count: <span id="roll-count"></span></div>
        <div>Hit Count: <span id="hit-count"></span></div>
        <div>High Hit: <span id="high-hit"></span></div>
        <div>Win Rate: <span id="win-rate"></span></div>
        <div>Losing Streak: <span id="losing-streak"></span></div>
        </div>

           <div class="control-group">
            <label>Watch Target</label>
            <input type="number" id="watch-target" value="10000" />
            </div>



          <div class="control-group">
            <label>Max Rolls</label>
  <input id="max-rolls" value="10000">
  </div>

    </div>
`;

    $("body").prepend(html);
   initWindowEvents()

    function evalResult(result) {
        RESULTS.push(result);
        rollCount++;
        if (result >= getPayout()) {
            hitCount++;
            losingStreak = 0;
        } else {
            losingStreak++;
        }

        if (result > highHit.payout) {
            highHit.payout = result;
            highHit.round = rollCount;
        }

        checkHalts(result);
        updateUI();
    }

    function checkHalts(result) {
        if (getStopOnMaxRolls() && rollCount >= getMaxRolls()) {
            persistResults();
            halt("Max rolls hit");
            return;
        }

        if (result >= getWatchTarget()) {
            halt("Watch target hit");
            return;
        }
    }

    function updateUI() {
        const winRate = hitCount / rollCount;
        const wrtdiff = winRate - teo;

        $("#roll-count").html(rollCount);
        $("#hit-count").html(hitCount);
        $("#win-rate").html(`${(winRate.toFixed(2))} | ${(teo).toFixed(2)} | ${(wrtdiff).toFixed(2)}`);


      $("#high-hit").html(`${highHit.getSummary(rollCount)}`).css({backgroundColor: highHit.getDeltaColor(rollCount)});
      $("#losing-streak").html(`${losingStreak} (${(getPayout() - losingStreak).toFixed(2)})`);

    }

      function persistResults() {
        try {
          localStorage.setItem("fastForwardResults", JSON.stringify({
            timestamp: Date.now(),
            results: RESULTS,
            count: rollCount
          }));
        } catch (e) {
          console.error("Failed to persist results:", e);
        }
      }

    function halt(stopMessage) {
        console.log(stopMessage)
        $("#message").text(stopMessage);
        stopMessage = ""
        stopBetting()
        return
    }

    function getMaxRolls() {
        return  Number($("#max-rolls").val());
    }

  function getStopOnMaxRolls() {
    return getMaxRolls() !== 0;
  }

  function getHitCountTarget() {
    return Number($("#hit-count-target").val())
  }

    function getWatchTarget() {
        return Number($("#watch-target").val())
    }



  function initWindowEvents() {
        $(document).on("keypress", function(e) {
            if (e.which === 122) {
                if (stopped) {
                    startBetting();
                } else {
                    stopBetting();
                }
            }
        });

$("#clear-results").click(clearResults)
      $("#control-panel").draggable({
        containment: "window",
        scroll: false,
      })
  }

  function clearResults() {
          localStorage.removeItem("fastForwardResults");
  console.log("Fast-forward results cleared.");
  }

    // Utility function: Get current roll data
    function getCurrentRollData() {
        return $(".grid.grid-auto-flow-column div span")
            .map(function() {
                return $(this).text();
            }).get();
    }

       function getTeo() {
        return 1 / (getPayout() * 1.05)
      }

    // Function to start the betting process
    function startBetting() {
        clearResults();
        rollCount = 0;
        highHit.payout = 0;
        highHit.round = 0;
        teo = getTeo();
        hitCount = 0;
        losingStreak = 0;
        stopped = false;
        doBet(); // Start the async loop
    }

    function stopBetting() {
        stopped = true;
    }

    function getPayout() {
        const payoutFieldGroup = $('div[role="group"]').has(
            'label:contains("Payout")'
        );
        const inputField = payoutFieldGroup.find("input");

        return Number(inputField.val());
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

    // Utility function: Extract the last roll result
    function getRollResult() {
        const temp = lastRollSet;
        lastRollSet = currentRollSet;
        currentRollSet = temp;
        currentRollSet.length = 0;

        currentRollSet = $(".grid.grid-auto-flow-column div span")
            .map(function() {
                return Number($(this).text().replace("x", ""));
            }).get();

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

doInit()
    // Initialize MutationObserver
})()