/* Start Script */
// ==UserScript==
// @name         bc.game fast roll
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

(function () {
  "use strict";

  let firstLoad = true;
  let lastRollSet = [];
  let currentRollSet = [];
  let rollCount = 0;
  let losingStreak = 0;
  let stopped = true;
  let hitCount = 0;
  let profit = 0;

  // Fields
  let lsField = null;
  let highHitThresholdField = null;
  let hitCountTargetField = null;
  let maxRollField = null;
  let restHighHitField = null;
  let highHitResetThresholdField = null;

  const highHit = {
    rollCount: 0,
    payout: 0,
    round: 0,
    push(result, highHitThreshold) {
      highHit.rollCount++;
      
      if (result > highHit.payout) {
        highHit.payout = result;
        highHit.round = highHit.rollCount;
      }
    },
    reset() {
      highHit.rollCount = 0;
      highHit.payout = 0;
      highHit.round = 0;
    },
    getSummary(rollCount) {
      return `${highHit.payout} || Delta: ${highHit.getRollDelta(rollCount)}`;
    },
    getRollDelta() {
      return highHit.rollCount - highHit.round;
    },
    getDeltaColor() {
      if (highHit.getRollDelta() >= highHit.payout * 3) {
        return "red";
      }
      return "transparent";
    },
    shouldHalt(threshold) {
      if (highHit.round === 0) return;
      return highHit.isThresholdExceeded(threshold);
    },
    isThresholdExceeded(threshold) {
      return highHit.getRollDelta() > highHit.payout * threshold;
    }
  };

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
        `,
      )
      .appendTo("head")
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
        <div>Profit / Loss: <span id="profit-loss"></span></div>
        <div>Roll Count: <span id="roll-count"></span></div>
        <div>Hit Count: <span id="hit-count"></span></div>
        <div>High Hit: <span id="high-hit"></span></div>
        <div>Win Rate: <span id="win-rate"></span></div>
        <div>Losing Streak: <span id="losing-streak"></span></div>
        </div>
   <div class="button-group">
      <button id="start-betting-btn">Start Betting</button>
      <button id="stop-betting-btn" style="display: none;">Stop Betting</button>
      <button id="set-risk-on-btn" style="display: none;"">Risk On</button>
      <button id="set-risk-off-btn">Risk Off</button>
      <button id="zero-wager-btn">Zero Wager</button>
      <button id="double-wager-btn">Double Wager</button>
      <button id="half-wager-btn">Half Wager</button>
   </div>
      <div class="control-group">
            <label>Reset On Start</label>
            <input id="reset-on-start" type="checkbox" checked="checked"/>
         </div>


   <div class="control-group">
      <label>Reset High Hit on Big Hit</label>
      <input id="reset-high-hit-on-big-hit" type="checkbox" checked/>
   </div>


           <div class="control-group">
            <label>High Hit Reset Threshold</label>
            <input type="number" id="high-hit-reset-threshold" value="100"  />
            </div>

           <div class="control-group">
            <label>Hit Count Target</label>
            <input type="number" id="hit-count-target" value="0"  />
            </div>

           <div class="control-group">
            <label>Profit Target</label>
            <input type="number" id="profit-target" value="0"  />
            </div>

          <div class="control-group">
            <label>Losing Streak Multiplier</label>
  <select id="ls-multiplier" >
    <option value="0" selected>0</option>
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
            <label>High Hit Threshold</label>
  <select id="high-hit-threshold"  >
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
    <option value="3.5" selected>3.5</option>
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
  <select id="max-rolls-multiplier"  >
    <option value="0" selected>0</option>
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

    </div>
`;

  $("body").prepend(html);
  initWindowEvents();

  function evalResult(result) {
    rollCount++;
    if (result >= getPayout()) {
      hitCount++;
      losingStreak = 0;
      profit += (getPayout() * getWager()) - getWager();
    } else {
      losingStreak++;
      profit -= getWager();
    }

    highHit.push(result, getHighHitResetThreshold());

    checkHalts(result);
    updateUI();
  }

  function checkHalts(result) {
    if (highHit.shouldHalt(getHighHitThreshold())) {
      halt("Roll count exceeded high hit threshold");
      return;
    }

    if (
      getStopOnLosingStreak() &&
      losingStreak >= getPayout() * getLosingStreakMultiplier()
    ) {
      halt("Losing streak threshold hit");
      return;
    }

    if (getStopOnHitCount() && hitCount >= getHitCountTarget()) {
      halt("Target hit");
      return;
    }


    if (getStopOnProfit() && profit >= getProfitTarget()) {
      halt(`Profit target hit ${profit.toFixed(4)}`);
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
        $("#profit-loss").html(profit.toFixed(4));
    $("#win-rate").html(
      `${winRate.toFixed(2)} | ${teo.toFixed(2)} | ${wrtdiff.toFixed(2)}`
    );

    $("#high-hit")
      .html(`${highHit.getSummary(rollCount)}`)
      .css({ backgroundColor: highHit.getDeltaColor(rollCount) });
    $("#losing-streak").html(
      `${losingStreak} (${(getPayout() - losingStreak).toFixed(2)})`
    );
  }

  function halt(stopMessage) {
    console.log(stopMessage);
    $("#message").text(stopMessage);
    stopMessage = "";
    stopBetting();
    return;
  }

  function getMaxRolls() {
    return Math.ceil(getMaxRollMultiplier() * getPayout());
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

  function getStopOnProfit() {
    return getProfitTarget() !== 0;
  }

    function getProfitTarget() {
    return Number($("#profit-target").val())
  }

  function getResetHighHitOnBigHit() {
    return $("#reset-high-hit-on-big-hit").prop("checked");
  }

  function getResetOnStart() {
    return $("#reset-on-start").prop("checked");
  }

  function getHighHitResetThreshold() {
    if (!highHitResetThresholdField) {
      highHitResetThresholdField = $("#high-hit-reset-threshold");
    }
    return Number(highHitResetThresholdField.val());
  }

  function getHitCountTarget() {
    if (!hitCountTargetField) {
      hitCountTargetField = $("#hit-count-target");
    }
    return Number(hitCountTargetField.val());
  }

  function getMaxRollMultiplier() {
    if (!maxRollField) {
      maxRollField = $("#max-rolls-multiplier");
    }
    return Number(maxRollField.val());
  }

  function getLosingStreakMultiplier() {
    if (!lsField) {
      lsField = $("#ls-multiplier");
    }
    return Number(lsField.val());
  }

  function getHighHitThreshold() {
    if (!highHitThresholdField) {
      highHitThresholdField = $("#high-hit-threshold");
    }
    return Number(highHitThresholdField.val());
  }

  function initWindowEvents() {
     $("#set-risk-on-btn").click(function () {
      $("#set-risk-on-btn").hide();
      $("#set-risk-off-btn").show();
      setWager(getScaledWager())
      $("#risk-on").prop("checked", true)
      $("#roll-mode").val("half-target")
      $("#profit-target").val(0.01)
    })

    $("#set-risk-off-btn").click(function () {
      $("#set-risk-on-btn").show();
      $("#set-risk-off-btn").hide();
      $("#risk-on").prop("checked", false)
      $("#roll-mode").val("none")
     $("#hit-count-target").val(0)
      setWager(0)
    })

    $("#double-wager-btn").click(function () {
      setWager(Math.min(1, getWager() * 2))
    })

    $("#half-wager-btn").click(function () {
      setWager(Math.max(0.0001, getWager() / 2))
    })

    $("#zero-wager-btn").click(function () {
      setWager(0)
    })

    $("#start-betting-btn").click(function () {
      startBetting()
    })

    $("#stop-betting-btn").click(function () {
      stopBetting()
    })
    $(document).on("keypress", function (e) {
      if (e.which === 122) {
        if (stopped) {
          startBetting();
        } else {
          stopBetting();
        }
      }
    });

    $("#control-panel").draggable({
      containment: "window",
      scroll: false
    });
  }


function getScaledWager(scalingFactor = 0.9) {
  const target = getPayout();
  const baseWager = getBaseWager();
  return baseWager * Math.pow(1.01 / target, scalingFactor);
}

  function getBaseWager() {
    return getBalance() * 0.01;
  }
  function getWager() {
    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Amount")',
    )
    const inputField = payoutFieldGroup.find("input")

    return Number(inputField.val())
  }


   function getBalance() {
        let rawText = $(".ml-3 .font-extrabold").text().trim()
        return parseFloat(rawText.replace(/[^\d.]/g, ""))
    }

  function setWager(amount) {
    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Amount")',
    )
    const inputField = payoutFieldGroup.find("input")

    if (inputField.length) {
      const currentValue = parseFloat(inputField.val())

      if (currentValue !== amount) {
        // Only set if different
        let nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        ).set

        nativeSetter.call(inputField[0], amount)
        inputField[0].dispatchEvent(
          new Event("input", {
            bubbles: true,
          }),
        )
        inputField[0].dispatchEvent(
          new Event("change", {
            bubbles: true,
          }),
        )
        // console.log(`Wager set to: ${amount}`);
      }
    } else {
      console.error("Wager input field not found!")
    }
  }


  // Utility function: Get current roll data
  function getCurrentRollData() {
    return $(".grid.grid-auto-flow-column div span")
      .map(function () {
        return $(this).text();
      })
      .get();
  }

  function getTeo() {
    return 1 / (getPayout() * 1.05);
  }

  // Function to start the betting process
  function startBetting() {
    if (firstLoad || getResetOnStart()) {
      firstLoad = false;
      rollCount = 0;
      highHit.reset()
      hitCount = 0;
      losingStreak = 0;
    }


profit = 0;
  hitCount = 0;
    teo = getTeo();
    stopped = false;
    doBet(); // Start the async loop
  }

  function isWagering() {
    return getWager() !== 0;
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
