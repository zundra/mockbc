/* Start Script */
// ==UserScript==
// @name         bc.game wind up
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

  let targets = generateTargets();
  let compressionZone = generateCompressionZone();
  /* end testing */
  let lastRollSet = [];
  let currentRollSet = [];
  let rollCount = 0;
  let losingStreak = 0;
  let stopped = true;
  let hitCount = 0;

  // Fields
  let lsField = null;
  let highHitThresholdField = null;
  let hitCountTargetField = null;
  let maxRollField = null;
  let restHighHitField = null;
  let highHitResetThresholdField = null;
  let newWindow = null;
  let analyticsWrapper = null;
  let riskOnField = null;

  let profit = 0;
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
      if (highHit.getRollDelta(rollCount) >= highHit.payout * 2) {
        return "red";
      }
      return "transparent";
    },
    shouldHalt(rollCount, threshold) {
      if (highHit.round === 0) return;

      return rollCount - highHit.round > highHit.payout * threshold;
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
        `
    )
    .appendTo("head");
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
      <label>Risk On</label>
      <input id="risk-on" type="checkbox" checked/>
   </div>

   <div class="control-group">
      <label>Reset High Hit on Big Hit</label>
      <input id="reset-high-hit-on-big-hit" type="checkbox" checked/>
   </div>


           <div class="control-group">
            <label>High Hit Reset Threshold</label>
            <input type="number" id="high-hit-reset-threshold" value="100" />
            </div>
          <div class="control-group">
            <label>Profit Target</label>
            <input type="number" id="profit-target" value="0.01"  />
            </div>

           <div class="control-group">
            <label>Hit Count Target</label>
            <input type="number" id="hit-count-target" value="0" />
            </div>

          <div class="control-group">
            <label>Losing Streak Multiplier</label>
  <select id="ls-multiplier">
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
  <select id="high-hit-threshold" >
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
    <option value="3.5" >3.5</option>
    <option value="4">4</option>
    <option value="4.5">4.5</option>
    <option value="5">5</option>
    <option value="5.5">5.5</option>
    <option value="6" selected>6</option>
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
  <select id="max-rolls-multiplier" >
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
    const haltedTargets = [];

    for (const t of targets) {
      t.push(result); // must always happen
        compressionZone.tryAdd(t)
      
      if (t.hasHalted()) {
        haltedTargets.push(t); // optional post-check
      }
    }

    rollCount++;
    if (result >= getPayout()) {
      hitCount++;
      losingStreak = 0;
      profit += getPayout() * getWager() - getWager();
    } else {
      losingStreak++;
      profit -= getWager();
    }

    if (result > highHit.payout) {
      if (result >= getHighHitResetThreshold() && getResetHighHitOnBigHit()) {
        highHit.payout = 0;
        highHit.round = 0;
      } else {
        highHit.payout = result;
        highHit.round = rollCount;
      }
    }
    checkHalts(result, haltedTargets);
    updateUI();
    
    if (compressionZone.isReady()) {
      console.log("e.getBase()", compressionZone.getBase(), compressionZone.getLength(), compressionZone.isFull(),     compressionZone.getTargets())
    }
  }

  function checkHalts(result, haltedTargets) {
    function resetHalts(haltedTargets) {
      haltedTargets.forEach((t) => t.resetHalt());
    }
    if (getStopOnProfit() && profit >= getProfitTarget()) {
      halt(`Profit target hit ${profit.toFixed(4)}`);
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

    if (getStopOnMaxRolls() && rollCount >= getMaxRolls()) {
      halt("Max rolls hit");
      return;
    }

    if (getRiskOn()) return;

    if (highHit.shouldHalt(rollCount, getHighHitThreshold())) {
      halt("Roll count exceeded high hit threshold");
      return;
    }

    if (haltedTargets.length > 0) {
      const msg = haltedTargets.map((t) => t.getHaltMessage()).join("\n");
      resetHalts(haltedTargets);
      halt(`Halts triggered:\n${msg}`);
    }


if (compressionZone.isReady()) {
  // Signal detected: strong low-target squeeze zone
  console.log("🔥 Low expansion squeeze forming at base:", lowExp.getBase());
}
  }

  function updateUI() {
    // Render new UI Element
    updateStats();
    updateTable();
  }

  function updateTable() {
    const MAX_BLOCKS = 15;
    const SCALE_FACTOR = 2;

    if (!analyticsWrapper) {
      analyticsWrapper = getNewWindowHTMLNode("#analytics-wrapper");
      //const analyticsWrapper = $("#analytics-wrapper");
    }

    // Ensure the table structure exists
    let table = analyticsWrapper.find("#output-table");

    targets.forEach((entry) => {
      const target = entry.getPayout();

      const windUpData = entry.getWindUpBalance();
      const sanitizedTarget = `${target}`.replace(/\./g, "_");
      let row = table.find(`#row-${sanitizedTarget}`);

      if (row.length === 0) {
        row = $("<tr>")
          .addClass("target-row")
          .attr("id", `row-${sanitizedTarget}`);

        const targetLabel = $("<td>")
          .addClass("target-label")
          .text(`Target: ${target}`)
          .css({color: "white"})


        const averagePressureCol = $("<td>")
          .addClass("average-pressure-col")
          .text(`${windUpData.average.toFixed(2)}`)
          .css({backgroundColor: windUpData.colors.avgColor})

        const blockContainer = $("<td>").addClass("row-blocks").css({
          display: "flex",
          gap: "2px",
          minWidth: "250px"
        });

        row.append(targetLabel, averagePressureCol, blockContainer);
        table.append(row);
      }

      const blockContainer = row.find(".row-blocks");
      const blocks = blockContainer.find(".row-block");
      const targetLabel = row.find(".target-label")
      const averagePressureCol = row.find(".average-pressure-col")

        averagePressureCol
        .text(`${windUpData.average.toFixed(2)}`)
        .css({backgroundColor: windUpData.colors.avgColor})
        
        targetLabel.css({
            backgroundColor: windUpData.colors.bgColor,
            color: windUpData.colors.fgColor
          })


      if (blocks.length > MAX_BLOCKS) {
        blocks.last().remove();
      }

      const needsNewBlock = entry.signFlipped() || blocks.length === 0;

      if (needsNewBlock) {
        const streakBlock = $("<div>")
          .addClass("row-block")
          .css({
            padding: "4px",
            margin: "1px",
            backgroundColor: windUpData.colors.bgColor,
            color: windUpData.colors.fgColor,
            borderRadius: "4px",
            textAlign: "center",
            fontSize: "15px",
            fontWeight: "bold",
            minWidth: "30px"
          })
          .text(`${entry.getStreak()} | ${windUpData.balance.toFixed(4)}`);

        blockContainer.prepend(streakBlock);
      } else {
        const firstBlock = blocks.first();
        firstBlock
          .css({
            backgroundColor: windUpData.colors.bgColor,
            color: windUpData.colors.fgColor
          })
          .text(`${entry.getStreak()} | ${windUpData.balance.toFixed(4)}`);
      }

      table.append(row);
    });
  }
  function updateStats() {
    const winRate = hitCount / rollCount;
    const wrtdiff = winRate - teo;

    $("#roll-count").html(rollCount);
    $("#hit-count").html(hitCount);
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

  function getRiskOn() {
    if (!riskOnField) {
      riskOnField = $("#risk-on");
    }

    return riskOnField.prop("checked");
  }

  function getResetHighHitOnBigHit() {
    return $("#reset-high-hit-on-big-hit").prop("checked");
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

  function getStopOnProfit() {
    return getProfitTarget() !== 0;
  }

  function getProfitTarget() {
    return Number($("#profit-target").val());
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
      setWager(getScaledWager());
      $("#risk-on").prop("checked", true);
      $("#ls-multiplier").val(0.5);
      $("#profit-target").val(0.01);
    });

    $("#set-risk-off-btn").click(function () {
      $("#set-risk-on-btn").show();
      $("#set-risk-off-btn").hide();
      $("#risk-on").prop("checked", false);
      $("#ls-multiplier").val(0);
      $("#hit-count-target").val(0);
      setWager(0);
    });

    $("#double-wager-btn").click(function () {
      setWager(Math.min(1, getWager() * 2));
    });

    $("#half-wager-btn").click(function () {
      setWager(Math.max(0.0001, getWager() / 2));
    });

    $("#zero-wager-btn").click(function () {
      setWager(0);
    });

    $("#start-betting-btn").click(function () {
      startBetting();
    });

    $("#stop-betting-btn").click(function () {
      stopBetting();
    });
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

  function getScaledWager(scalingFactor = 1.5) {
    const target = getPayout();
    const baseWager = getBaseWager();
    return Math.max(0.0001, baseWager * Math.pow(1.01 / target, scalingFactor));
  }

  function getBaseWager() {
    return getBalance() * 0.01;
  }
  function getWager() {
    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Amount")'
    );
    const inputField = payoutFieldGroup.find("input");

    return Number(inputField.val());
  }

  function getBalance() {
    let rawText = $(".ml-3 .font-extrabold").text().trim();
    return parseFloat(rawText.replace(/[^\d.]/g, ""));
  }

  function setWager(amount) {
    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Amount")'
    );
    const inputField = payoutFieldGroup.find("input");

    if (inputField.length) {
      const currentValue = parseFloat(inputField.val());

      if (currentValue !== amount) {
        // Only set if different
        let nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        ).set;

        nativeSetter.call(inputField[0], amount);
        inputField[0].dispatchEvent(
          new Event("input", {
            bubbles: true
          })
        );
        inputField[0].dispatchEvent(
          new Event("change", {
            bubbles: true
          })
        );
        // console.log(`Wager set to: ${amount}`);
      }
    } else {
      console.error("Wager input field not found!");
    }
  }
  // Function to start the betting process
  function startBetting() {
    rollCount = 0;
    highHit.payout = 0;
    highHit.round = 0;
    teo = getTeo();
    hitCount = 0;
    losingStreak = 0;
    profit = 0;
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

  function generateTargets() {
    class Target {
      constructor(payout) {
        this.streak = 0;
        this.pstreak = 0;
        this.losingStreak = 0;
        this.winningStreak = 0;
        this.downWindUp = 0;
        this.upWindUp = 0;
        this.windUpHistory = [];
        this.streakSignFlipped = false;
        this.totalWindup = 0;
        this.payout = payout;
        this.teo = this.getTeo();
        this.haltReason = null;
      }

      getPayout() {
        return this.payout;
      }

      getStreak() {
        return this.streak;
      }

      push(result) {
        this.updateStreak(result);
        let limit = 0;

        if (this.payout <= 2) {
          limit = 7;
        } else if (this.payout <= 10) {
          limit = 6;
        } else {
          limit = 5;
        }

        if (this.getDownWindUp() > limit) {
          this.haltReason = `Target ${this.getPayout()} wind-up below threshold: ${this.getDownWindUp().toFixed(
            2
          )}`;
        }
      }

      hasHalted() {
        return this.haltReason !== null;
      }

      resetHalt() {
        this.haltReason = null;
      }

      getHaltMessage() {
        return this.haltReason;
      }

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
        this.winningStreak = this.streak > 0 ? this.streak : 0;
        this.setWindUpHistory(this.losingStreak === 0);
      };

      signFlipped() {
        return this.streakSignFlipped;
      }

      setWindUpHistory(isHit) {
        const lastWindUp = this.windUpHistory[this.windUpHistory.length - 1];
        const up = this.getUpWindUp();
        const down = this.getDownWindUp();
        const balance = up - down;
        
        if (balance > 0) {
          if (lastWindUp && lastWindUp > 0) {
            this.windUpHistory.pop();
            this.windUpHistory.push(balance);
            return;
          }
          this.windUpHistory.push(balance);
          return;
        }

        if (lastWindUp && lastWindUp < 0) {
          this.windUpHistory.pop();
          this.windUpHistory.push(balance);
          return;
        }
        this.windUpHistory.push(balance);
        if (this.windUpHistory.length === 100) this.windUpHistory.shift();
      }

      getAveragePressure() {
         if (this.windUpHistory.length === 0) return 0;
      return this.windUpHistory.reduce((a, b) => a + b, 0) / this.windUpHistory.length;
      }

      getWindUpColor(balance, avgPressure) {
        let base = "";
        let ratio = 0;
        let fgBase = ""

        if (balance < -1) {
          fgBase = "255 255 255"
          base = "255 0 0"; // RED for negative wind-up (underperformance)
          ratio = Math.min(1, Math.abs(balance + 1) / 4); // fade in from -0.25 down
        } else if (balance > 1) {
          fgBase = "0 0 0"
          base = "0 255 0"; // GREEN for positive wind-up (overperformance)
          ratio = Math.min(1, (balance - 1) / 4); // fade in from +0.25 up
        } else {
          return {fgColor: "rgb(255, 255, 255, 0.1)", bgColor: "transparent"}
        }

        const alpha = 0.2 + 0.8 * ratio;
        return {bgColor: `rgb(${base} / ${alpha})`, fgColor: `rgb(${fgBase} / ${alpha})`, avgColor: avgPressure < 0 ? "red" : "green"}
      }

      getExpectedStreak() {
        return 1 / this.getTeo(); // e.g. ~100 for 1.01x, ~2 for 2x, etc
      }

      getTeo() {
        return 1 / (this.payout * 1.05);
      }

      getDownWindUp() {
        const streak =
          this.losingStreak === 0 ? this.pstreak : this.losingStreak;

        const expected = this.getExpectedStreak(); // Use this instead

        if (Math.abs(streak) < expected) return 0;

        const normalized = Math.abs(streak) / expected - 1;
        return normalized > 0 ? normalized : 0;
      }

      getUpWindUp() {
        const streak =
          this.winningStreak === 0 ? this.pstreak : this.winningStreak;
        const expected = 1 / this.getTeo(); // expected hits in a cycle

        if (streak < expected) return 0;

        const normalized = streak / expected - 1;
        return normalized > 0 ? normalized : 0;
      }

      getWindUpBalance() {
        const up = this.getUpWindUp(); // streak * payout
        const down = this.getDownWindUp(); // streak / payout
        const avgPressure = this.getAveragePressure();
        const streak = this.getStreak();
        const balance = up - down;
        const whichWindUp = streak < 0 ? -down : up;
        const colors = this.getWindUpColor(whichWindUp, avgPressure);

        return { balance: balance, average: avgPressure, colors: colors };
      }
    }

    return generatePayouts().map((payout) => new Target(payout));
  }
  
function generateCompressionZone() {
  class CompressionZone {
    constructor() {
      this.maxSize = 8;
      this.targets = {}; // payout → pressure
      this.base = 0;
    }

    getTargets() {
      return this.targets;
    }

    getBase() {
      return this.base;
    }

    getLength() {
      return Object.keys(this.targets).length;
    }

    isFull() {
      return this.getLength() === this.maxSize;
    }

    isGreaterThanBase(payout) {
      return payout > this.base;
    }

    removeTarget(payout) {
      delete this.targets[payout];
      if (this.getLength() === 0) this.base = 0;
    }

    tryAdd(target) {
      const payout = target.getPayout();

      if (payout > 2) return;

      if (target.getWindUpBalance().balance > -2) {
        this.removeTarget(payout);
        return;
      }

      if (this.isFull()) return;

      const pressure = target.getDownWindUp();

      if (this.isGreaterThanBase(payout)) {
        this.base = payout;
        this.targets = {};
        this.targets[payout] = pressure;
        return;
      }

      this.targets[payout] = pressure;
    }

    getAveragePressure() {
      const values = Object.values(this.targets);
      if (values.length === 0) return 0;
      return values.reduce((a, b) => a + b, 0) / values.length;
    }

    isReady(threshold = -2) {
      return this.isFull() && this.getAveragePressure() <= threshold;
    }
  }

  return new CompressionZone();
}


  function generatePayouts() {
    const p1 = [
      1.01,
      1.1,
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
      9
    ];

    const p2 = Array.from(
      {
        length: 10
      },
      (v, k) => 10 + k * 10
    );

    const p3 = Array.from(
      {
        length: 10
      },
      (v, k) => 100 + k * 100
    );



    const p4 = Array.from(
      {
        length: 10
      },
      (v, k) => 1000 + k * 1000
    );

    const p5 = Array.from(
      {
        length: 10
      },
      (v, k) => 10000 + k * 10000
    )

    return [...p1, ...p2, ...p3, ...p4, ...p5];
  }
  function getNewWindowHTMLNode(hook) {
    return $(newWindow.document).find(hook);
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
        newWindow = window.open("", "", "width=1100, height=1200");

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
      .output-table {
      width: 100%;
      border-collapse: collapse;
      border: none; /* ✅ Removes the ugly gray border */
      }
      .target-row td {
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
      <div id="analytics-wrapper">
         <table id="output-table">
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
  // Initialize MutationObserver
})();
