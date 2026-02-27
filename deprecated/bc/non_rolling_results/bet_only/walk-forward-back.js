/* Start Script */
// ==UserScript==
// @name         bc.game walk forward/back v1
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
  let previousLosingStreak = 0;
  let winningStreak = 0;
  let streak = 0;
  let pstreak = 0;
  let stopped = true;
  let hitCount = 0;
  let payout = 0;
  let wager = 0;
  let baseWager = 0;
  // Fields
  let lsField = null;
  let highHitThresholdField = null;
  let hitCountTargetField = null;
  let maxRollField = null;
  let restHighHitField = null;
  let highHitResetThresholdField = null;
  const ratioHistory = [];
  const MAX_WAGER = 0.1;
  const MIN_WAGER = 0.0001;

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
        <div>Ratio: <span id="ratio"></span></div>
        <div>Previous Ratio: <span id="pratio"></span></div>
        <div>High Hit: <span id="high-hit"></span></div>
        <div>Win Rate: <span id="win-rate"></span></div>
        <div>Losing Streak: <span id="losing-streak"></span></div>
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
            <input type="number" id="high-hit-reset-threshold" value="100"  style="color: black"/>
            </div>

           <div class="control-group">
            <label>Hit Count Target</label>
            <input type="number" id="hit-count-target" value="0"  style="color: black"/>
            </div>

          <div class="control-group">
            <label>Losing Streak Multiplier</label>
  <select id="ls-multiplier" style="color: black">
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
  <select id="high-hit-threshold"  style="color: black">
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
  <select id="max-rolls-multiplier"  style="color: black">
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

    updateStreak(result);

    if (result > highHit.payout) {
      if (result >= getHighHitResetThreshold() && getResetHighHitOnBigHit()) {
        highHit.payout = 0;
        highHit.round = 0;
      } else {
        highHit.payout = result;
        highHit.round = rollCount;
      }
    }

    checkHalts(result);
    updateUI();
  }

  function setNextBet(result) {
    const pratio = getPRatio();
console.log("pratio", pratio)
    // if (result > payout && wager === MAX_WAGER) {
    //   wager = baseWager;
    // } else if (pratio < -1) {
    //   wager = Math.min(MAX_WAGER, wager * 2);
    // } else if (pratio > -0.5) {
    //   if (wager === MAX_WAGER) {
    //     wager = baseWager;
    //   } else {
    //     wager = Math.max(0.0001, (wager /= 2));
    //   }
    // }
    const tempWager1 = wager * pratio;
    const tempWager2 = Math.max(tempWager1, MIN_WAGER);
    wager = Math.min(tempWager2, MAX_WAGER);

    setWager(wager);
  }

  function updateStreak(result) {
    if (result >= payout) {
      hitCount++;
      if (losingStreak < 0) {
        previousLosingStreak = losingStreak;
      }

      if (streak < 0) {
        pstreak = streak;
      }
      streak = Math.max(streak + 1, 1);
      setNextBet(result);
    } else {
      if (streak > 0) {
        pstreak = streak;
      }
      streak = Math.min(streak - 1, -1);
    }

    losingStreak = streak < 0 ? streak : 0;
    winningStreak = streak > 0 ? streak : 0;
    setRatioHistory(losingStreak === 0);
  }

  function setRatioHistory(isHit) {
    const lastWindUp = ratioHistory[ratioHistory.length - 1];

    if (isHit) {
      if (lastWindUp && lastWindUp > 0) {
        ratioHistory.pop();
        ratioHistory.push(getUpWindUp());
        return;
      }
      ratioHistory.push(getUpWindUp());
      return;
    }

    if (lastWindUp && lastWindUp < 0) {
      ratioHistory.pop();
      ratioHistory.push(getDownWindUp());
      return;
    }
    ratioHistory.push(getDownWindUp());
  }

  function getDownWindUp() {
    const lastStreak = losingStreak === 0 ? pstreak : losingStreak;
    return lastStreak * payout;
  }

  function getUpWindUp() {
    const lastStreak = winningStreak === 0 ? pstreak : winningStreak;
    return lastStreak * payout;
  }

  function checkHalts(result) {
    if (highHit.shouldHalt(rollCount, getHighHitThreshold())) {
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
    $("#ratio").html(getRatio().toFixed(2));
    $("#pratio").html(getPRatio().toFixed(2));
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

  function getTeo() {
    return teo;
  }

  function getRatio() {
    return streak / payout;
  }

  function getPRatio() {
    if (ratioHistory.length < 2) {
      return 0;
    }

    return ratioHistory[ratioHistory.length - 2]
  }

  function initWindowEvents() {
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

  function getWager() {
    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Amount")'
    );
    const inputField = payoutFieldGroup.find("input");

    return Number(inputField.val());
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
      highHit.payout = 0;
      highHit.round = 0;
      hitCount = 0;
      losingStreak = 0;
    }

    hitCount = 0;
    baseWager = wager = getWager();
    teo = getTeo();
    payout = getPayout();
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
