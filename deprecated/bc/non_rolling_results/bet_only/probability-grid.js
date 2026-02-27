/* Start Script */
// ==UserScript==
// @name         bc.game probability grid
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

  $(document).ready(function () {
    // Inject styles using jQuery
    $("<style>")
      .prop("type", "text/css")
      .html(
        `

            table {
      border-collapse: collapse;
      font-family: sans-serif;
      margin: 20px auto;
    }
    td, th {
      border: 1px solid #ccc;
      padding: 8px;
      min-width: 60px;
      text-align: center;
      font-size: 12px;
    }
    .highlight {
      background: rgba(0, 255, 0, 0.1);
    }
    
    .highlight-hit {
      background-color: green;
    }
    
   .highlight-miss {
      background-color: red;
    }

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
              #probability-grid-wrapper {
              position: absolute;
              top: 380px;
              left: 470px;
              background-color: rgba(42, 45, 46, 0.95);
              padding: 15px;
              border-radius: 8px;
              box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
              z-index: 1000;
              cursor: move;
              }
        `,
      )
      .appendTo("head")

    // Define the control panel HTML
  
    let html = `
    <div id="probability-grid-wrapper">
        <h3 style="text-align: center">🎯 Payout Grid Tracker</h3>
        <table id="grid">
          <tr><th></th><th>0</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th></tr>
        </table>
    </div>
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
            <label>Hit Count Target</label>
            <input type="number" id="hit-count-target" value="0" />
            </div>

          <div class="control-group">
            <label>Losing Streak Multiplier</label>
  <select id="ls-multiplier">
    <option value="0">0</option>
    <option value="0.05">0.05</option>
    <option value="0.1">0.1</option>
    <option value="0.2">0.2</option>
    <option value="0.3">0.3</option>
    <option value="0.4">0.4</option>
    <option value="0.5">0.5</option>
    <option value="1">1</option>
    <option value="1.5">1.5</option>
    <option value="2">2</option>
    <option value="2.5">2.5</option>
    <option value="3">3</option>
    <option value="3.5">3.5</option>
    <option value="4">4</option>
    <option value="4.5">4.5</option>
    <option value="5">5</option>
    <option value="5.5">5.5</option>
    <option value="6">6</option>
    <option value="6.5" >6.5</option>
    <option value="7">7</option>
    <option value="7.5">7.5</option>
    <option value="8">8</option>
    <option value="8.5">8.5</option>
    <option value="9">9</option>
    <option value="9.5">9.5</option>
    <option value="10">10</option>
  </select>
            </div>




          <div class="control-group">
            <label>Max Rolls Multiplier</label>
  <select id="max-rolls-multiplier">
    <option value="0">0</option>
    <option value="0.05">0.05</option>
    <option value="0.1">0.1</option>
    <option value="0.2">0.2</option>
    <option value="0.3">0.3</option>
    <option value="0.4">0.4</option>
    <option value="0.5">0.5</option>
    <option value="1" selected>1</option>
    <option value="1.5">1.5</option>
    <option value="2">2</option>
    <option value="2.5">2.5</option>
    <option value="3">3</option>
    <option value="3.5">3.5</option>
    <option value="4">4</option>
    <option value="4.5">4.5</option>
    <option value="5">5</option>
    <option value="5.5">5.5</option>
    <option value="6">6</option>
    <option value="6.5" >6.5</option>
    <option value="7">7</option>
    <option value="7.5">7.5</option>
    <option value="8">8</option>
    <option value="8.5">8.5</option>
    <option value="9">9</option>
    <option value="9.5">9.5</option>
    <option value="10">10</option>
  </select>
            </div>

    </div>
`;


    // Append the control panel to the body
    $("body").append(html)
    initWindowEvents();
  })


    function evalResult(result) {
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
        updateProbabilityTable(result)
    }

    function updateProbabilityTable(result) {
        if (rollCount % 100 === 0) {
            $(".highlight-hit").removeClass('highlight-hit').addClass('highlight-miss')
        }

        if (result < 2) {
            const teo = getTeo(result);
            const className = `.cell-${sanitizedPayout(result)}`;
            const cell = $(className);
            const current = parseFloat(cell.text()) || 0;
            const updated = current + teo;
            cell.text(updated.toFixed(2));
            cell.addClass('highlight');
            cell.addClass('highlight-hit');
            cell.removeClass('highlight-miss')
            setTimeout(() => cell.removeClass('highlight'), 300);
        }
    }

    function checkHalts(result) {
 
         if (getStopOnLosingStreak() && (losingStreak >= (getPayout() * getLosingStreakMultiplier()))) {
            halt("Losing streak threshold hit");
            return;
        }


        if (getStopOnHitCount() && hitCount >= getHitCountTarget()) {
            halt("Target hit");
            return;
        }

        if (getStopOnMaxRolls() && rollCount >= getMaxRolls()) {
            halt("Max rolls hit");
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

    function halt(stopMessage) {
        console.log(stopMessage)
        $("#message").text(stopMessage);
        stopMessage = ""
        stopBetting()
        return
    }

  function sanitizedPayout(p) {
    return p.toFixed(2).replace(".", "-")
  }
    function getMaxRolls() {
        return Math.ceil(getMaxRollMultiplier() * getPayout());
    }

    function getMaxRollMultiplier() {
        return  Number($("#max-rolls-multiplier").val());
    }

  function getStopOnMaxRolls() {
    return getMaxRollMultiplier() !== 0;
  }

  function getStopOnLosingStreak() {
    return getLosingStreakMultiplier() !== 0;
  }

  function getStopOnHitCount() {
    return getHitCountTarget() !== 0;
  }

  function getHitCountTarget() {
    return Number($("#hit-count-target").val())
  }

    function getLosingStreakMultiplier(payout) {
        return Number($("#ls-multiplier").val())
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


    function initPrototypes() {
        Array.prototype.last = function() {
            return this[this.length - 1];
        };
        Array.prototype.first = function() {
            return this[0];
        };
    }

    function bindHotKeys() {
        $(document).on("keypress", function(e) {
            if (e.which === 122) {
                if (stopped) {
                    startBetting();
                } else {
                    stopBetting();
                }
            }
        });
    }

    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

  function createTable() {
    const payouts = Array.from({ length: 100 }, (_, k) => 1 + k * 0.01)
    let row = null

    for (let i = 0; i < payouts.length; i++) {
      const payout = payouts[i]

      if (i % 10 === 0) {
        if (row !== null) {
          $("#grid").append(row)
        }
        row = $("<tr>")
        row.append(`<th>${payout.toFixed(2)}+</th>`)
      }
            const col = $("<td>0.00</td>")
      col.addClass(`cell-${sanitizedPayout(payouts[i])}`)
            col.addClass("highlight-miss")
          row.append(col)

    }

    if (row !== null) {
      $("#grid").append(row)
    }
  }

    function doInit() {
        bindHotKeys();
        observeRollChanges();
    }

    function initWindowEvents () {
        invokeDraggable();
        createTable();
    }
    function invokeDraggable() {
        $("#control-panel").draggable({
            containment: "window",
            scroll: false,
        })

        $("#probability-grid-wrapper").draggable({
            containment: "window",
            scroll: false,
        })
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