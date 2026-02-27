/* Start Script */
// ==UserScript==
// @name         bc.game combined v6
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

  const STOP_HIT_SEQ = ["stop", "hit"]
  const TARGET_HIT_SEQ = ["target", "hit"]
  let WATCH_PAYOUTS = []

  // Audio Map
  const alertSounds = {
    1: new Audio("https://zundra.github.io/script-alerts/1.mp3"),
    2: new Audio("https://zundra.github.io/script-alerts/2.mp3"),
    3: new Audio("https://zundra.github.io/script-alerts/3.mp3"),
    4: new Audio("https://zundra.github.io/script-alerts/4.mp3"),
    5: new Audio("https://zundra.github.io/script-alerts/5.mp3"),
    6: new Audio("https://zundra.github.io/script-alerts/6.mp3"),
    7: new Audio("https://zundra.github.io/script-alerts/7.mp3"),
    8: new Audio("https://zundra.github.io/script-alerts/8.mp3"),
    9: new Audio("https://zundra.github.io/script-alerts/9.mp3"),
    10: new Audio("https://zundra.github.io/script-alerts/10.mp3"),
    20: new Audio("https://zundra.github.io/script-alerts/20.mp3"),
    30: new Audio("https://zundra.github.io/script-alerts/30.mp3"),
    40: new Audio("https://zundra.github.io/script-alerts/40.mp3"),
    50: new Audio("https://zundra.github.io/script-alerts/50.mp3"),
    60: new Audio("https://zundra.github.io/script-alerts/60.mp3"),
    70: new Audio("https://zundra.github.io/script-alerts/70.mp3"),
    80: new Audio("https://zundra.github.io/script-alerts/80.mp3"),
    90: new Audio("https://zundra.github.io/script-alerts/90.mp3"),
    100: new Audio("https://zundra.github.io/script-alerts/100.mp3"),
    200: new Audio("https://zundra.github.io/script-alerts/200.mp3"),
    300: new Audio("https://zundra.github.io/script-alerts/300.mp3"),
    400: new Audio("https://zundra.github.io/script-alerts/400.mp3"),
    500: new Audio("https://zundra.github.io/script-alerts/500.mp3"),
    600: new Audio("https://zundra.github.io/script-alerts/600.mp3"),
    700: new Audio("https://zundra.github.io/script-alerts/700.mp3"),
    800: new Audio("https://zundra.github.io/script-alerts/800.mp3"),
    900: new Audio("https://zundra.github.io/script-alerts/900.mp3"),
    hundred: new Audio("https://zundra.github.io/script-alerts/hundred.mp3"),
    thousand: new Audio("https://zundra.github.io/script-alerts/thousand.mp3"),
    million: new Audio("https://zundra.github.io/script-alerts/million.mp3"),
    hit: new Audio("https://zundra.github.io/script-alerts/hit.mp3"),
    target: new Audio("https://zundra.github.io/script-alerts/target.mp3"),
    stop: new Audio("https://zundra.github.io/script-alerts/stop.mp3"),
    roll: new Audio("https://zundra.github.io/script-alerts/roll.mp3")
  };

  function playNumberAlert(value, prefix = "hit") {
    const sequence = [];
    sequence.push(prefix);

    if (value >= 1_000_000 && alertSounds["million"]) {
      const millions = Math.floor(value / 1_000_000);
      if (alertSounds[millions]) sequence.push(millions);
      sequence.push("million");
      value %= 1_000_000;
    }

    if (value >= 1_000 && alertSounds["thousand"]) {
      const thousands = Math.floor(value / 1_000);
      if (alertSounds[thousands]) sequence.push(thousands);
      sequence.push("thousand");
      value %= 1_000;
    }

    const hundreds = Math.floor(value / 100) * 100;
    if (hundreds > 0 && alertSounds[hundreds]) {
      sequence.push(hundreds);
      value %= 100;
    }

    if (value > 0 && alertSounds[value]) {
      sequence.push(value);
    }

    playSequence(sequence);
  }

  function playSequence(seq, index = 0) {
    if (index >= seq.length) return;
    const sound = alertSounds[seq[index]];
    if (sound) {
      sound.currentTime = 0;
      sound.play();
      sound.onended = () => playSequence(seq, index + 1);
    } else {
      playSequence(seq, index + 1);
    }
  }

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
  let maxLossField = null;
  let alertThresholdField = null;
  let rollModField = null;
  let watchPayout1Field = null;
  let watchPayout2Field = null;
  let watchPayout3Field = null;
  let watchPayout4Field = null;
  let watchPayout5Field = null;
  let losingStreak1 = 0;
  let losingStreak2 = 0;
  let losingStreak3 = 0;
  let losingStreak4 = 0;
  let losingStreak5 = 0;

  let highHit = 0;
  let highHitRound = 0;
  let highHitLosingStreak = 0;

  let teo = 0;
  $("<style>")
    .prop("type", "text/css")
    .html(
      `
            #control-panel-header, #stats-panel-header {
                background: #333;
                padding: 12px;
                font-weight: bold;
                text-align: center;
                border-radius: 8px 8px 0 0;
                font-size: 16px;
                cursor: grab;
            }

            #control-panel, #stats-panel {
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
  let controlPanel = `<div id="control-panel" style="
   position: fixed;
   top: 300px;
   left: 0px;
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
   <div id="control-panel-header" style="
      background: #333;
      padding: 10px;
      font-weight: bold;
      text-align: center;
      border-radius: 8px 8px 0 0;
      cursor: grab;
      ">⚙️ Control Panel</div>
   <div class="button-group">
      <button id="start-betting-btn">Start Betting</button>
      <button id="stop-betting-btn" style="display: none;">Stop Betting</button>
      <button id="set-risk-on-btn" style="display: none;">Risk On</button>
      <button id="set-risk-off-btn">Risk Off</button>
      <button id="zero-wager-btn">Zero Wager</button>
      <button id="double-wager-btn">Double Wager</button>
      <button id="half-wager-btn">Half Wager</button>
   </div>
   <div class="control-group">
      <label>Play Alert</label>
      <input id="play-alert" type="checkbox" checked/>
   </div>
   <div class="control-group">
      <label>Risk On</label>
      <input id="risk-on" type="checkbox"/>
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
      <label>Watch Configuration</label>
      <select id="watch-configuration"  >
         <option value="low-watch" selected>Low Watch</option>
         <option value="mid-watch" selected>Mid Watch</option>
         <option value="high-watch" selected>High Watch</option>
         <option value="split-watch" selected>Split Watch</option>
         <option value="recovery-watch" selected>Recovery Watch</option>
      </select>
   </div>
   <div class="control-group">
      <label>Alert Threshold</label>
      <input type="number" id="high-hit-alert-threshold" value="10000"  />
   </div>
   <div class="control-group">
      <label>Roll Annoucement Mod</label>
      <input type="number" id="roll-announcement-mod" value="1000"  />
   </div>
   <div class="control-group">
      <label>Reset On Start</label>
      <input id="reset-on-start" type="checkbox"/>
   </div>
   <div class="control-group">
      <label>Reset High Hit on Big Hit</label>
      <input id="reset-high-hit-on-big-hit" type="checkbox" checked/>
   </div>
   <div class="control-group">
      <label>Use Progressive Wager</label>
      <input id="use-progressive-wager" type="checkbox"/>
   </div>
   <div class="control-group">
      <label>Max Loss</label>
      <input type="number" id="max-loss" value="1"  />
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
         <option value="3.5">3.5</option>
         <option value="4">4</option>
         <option value="4.5">4.5</option>
         <option value="5">5</option>
         <option value="5.5">5.5</option>
         <option value="6">6</option>
         <option value="6.5" >6.5</option>
         <option value="7" selected>7</option>
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
</div>`;

  const statsPanel = `<div id="stats-panel" style="
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
   <div id="stats-panel-header" style="
      background: #333;
      padding: 10px;
      font-weight: bold;
      text-align: center;
      border-radius: 8px 8px 0 0;
      cursor: grab;
      ">⚙️ Stats Panel</div>
   <div id="message" class="message-box" style="
      margin: 12px 0;
      background-color: #444;
      padding: 10px;
      border-radius: 6px;
      color: white;
      font-size: 0.9rem;
      text-align: center;
      "></div>
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
      <div style="background-color: #1e1e1e; border: 1px solid #333; border-radius: 6px; padding: 10px; margin-top: 10px; color: #ccc; font-family: sans-serif; font-size: 15px; overflow-x: auto;">
         <table style="width: 100%; border-collapse: collapse;" id="watch-target-table">
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
               </tr>
            </thead>
            <tbody></tbody>
         </table>
      </div>
   </div>
</div>`

  $("body").prepend(controlPanel);
  $("body").prepend(statsPanel);

  initWindowEvents();

  function evalResult(result) {
    rollCount++;

    if (result > highHit) {
      highHit = result;
      highHitRound = rollCount;
      highHitLosingStreak = 0;
    } else {
      highHitLosingStreak++;
    }

    rollCount++;

    let payout = getPayout();

    if (result >= payout) {
      hitCount++;
      losingStreak = 0;
      profit += payout * getWager() - getWager();
    } else {
      losingStreak++;
      profit -= getWager();
    }

    setStreaks(result);

    tryPlayRollAnnoucment(rollCount);
    tryPlayHitAnnouncement(result);
    updateUI();
    checkHalts(result);
  }


function setStreaks(result) {
    WATCH_PAYOUTS.forEach(entry => {
        const payout = entry.payout;
        const sanitized = sanitizeId(payout);

        if (result >= payout) {
            entry.streak = 0;
        } else {
            entry.streak++;
        }

        const diff = payout - entry.streak;
        const ratio = diff / payout;

        $(`#losing-streak-${sanitized}`).text(entry.streak);
        $(`#losing-streak-${sanitized}-ratio`).text((diff).toFixed(2));
        $(`#losing-streak-${sanitized}-diff`).text((ratio).toFixed(2));

        const diffCell = $(`#losing-streak-${sanitized}-diff`);
        if ((diff < 0 && Math.abs(diff)) >= payout * 3) {
            diffCell.css("background-color", "red");
        } else {
            diffCell.css("background-color", "");
        }
    });
}



  function tryPlayRollAnnoucment(result) {
    if (!getPlayAlert()) return;
    if (result % getRollAnnoucmentMod() !== 0) return;
    playNumberAlert(result, "roll");
  }

  function tryPlayHitAnnouncement(result) {
    if (!getPlayAlert()) return;
    if (result < getAlertThreshold()) return;
    playNumberAlert(result, "hit");
  }

  function checkHalts(result) {
    if (getStopOnMaxLoss() && maxLossExceeded()) {
      riskOff("Max loss exceeded, entering recovery mode:", profit);
      return;
    }


    if (getStopOnProfit() && profit >= getProfitTarget()) {
      halt(`Profit target hit ${profit.toFixed(4)}`, TARGET_HIT_SEQ);
      return;
    }

    if (getStopOnHitCount() && hitCount >= getHitCountTarget()) {
      halt(`Target hit ${hitCount} times`, TARGET_HIT_SEQ);
      return;
    }

    if (getStopOnMaxRolls() && rollCount >= getMaxRolls()) {
      halt("Max rolls hit");
      return;
    }



    if (
      getStopOnLosingStreak() &&
      losingStreak >= getPayout() * getLosingStreakMultiplier()
    ) {
      halt("Losing streak threshold hit");
      return;
    }

    if (getRiskOn()) return;

   
    if (getStopOnLosingStreak()) {
    WATCH_PAYOUTS.forEach(entry => {
            const payout = entry.payout;
            const streak = entry.streak;
            const threshold = payout * getLosingStreakMultiplier();

            if (streak >= threshold) {
                halt(`Target ${payout} hit losing streak threshold ${streak}`);
                return;
            }
        });
    }
  }

  function halt(stopMessage, seq = STOP_HIT_SEQ) {
    console.log(stopMessage);
    $("#message").text(stopMessage);
    stopMessage = "";
    if (getPlayAlert()) playSequence(seq);
    stopBetting();
    return;
  }


  function riskOff(stopMessage, seq = STOP_HIT_SEQ) {
    console.log(stopMessage);
    $("#message").text(stopMessage);
    stopMessage = "";
    configureRiskOffMode();
    return;
  }

  function updateUI() {
    $("#roll-count").html(rollCount);
    $("#profit-loss").html(profit.toFixed(4)).css({backgroundColor: `${profit > 0 ? "green" : "red"}`})
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
    return Number($("#profit-target").val());
  }

  function getStopOnMaxLoss() {
    return getMaxLoss() !== 0;
  }

  function getMaxLoss() {
    if (!maxLossField) {
      maxLossField = $("#max-loss");
    }
    return Number(maxLossField.val());
  }

  function getRiskOn() {
    return $("#risk-on").prop("checked");
  }

  function getPlayAlert() {
    return $("#play-alert").prop("checked") && !stopped;
  }

  function getUseProgressiveWager() {
    return $("#use-progressive-wager").prop("checked");
  }

  function getResetHighHitOnBigHit() {
    return $("#reset-high-hit-on-big-hit").prop("checked");
  }

  function getResetOnStart() {
    return $("#reset-on-start").prop("checked");
  }

  function getAlertThreshold() {
    if (!alertThresholdField) {
      alertThresholdField = $("#high-hit-alert-threshold");
    }
    return Number(alertThresholdField.val());
  }

  function getRollAnnoucmentMod() {
    if (!rollModField) {
      rollModField = $("#roll-announcement-mod");
    }
    return Number(rollModField.val());
  }

  function getWatchPayout1() {
    if (!watchPayout1Field) {
      watchPayout1Field = $("#watch-payout-1");
    }
    return Number(watchPayout1Field.val());
  }

  function getWatchPayout2() {
    if (!watchPayout2Field) {
      watchPayout2Field = $("#watch-payout-2");
    }
    return Number(watchPayout2Field.val());
  }

  function getWatchPayout3() {
    if (!watchPayout3Field) {
      watchPayout3Field = $("#watch-payout-3");
    }
    return Number(watchPayout3Field.val());
  }

  function getWatchPayout4() {
    if (!watchPayout4Field) {
      watchPayout4Field = $("#watch-payout-4");
    }
    return Number(watchPayout4Field.val());
  }

  function getWatchPayout5() {
    if (!watchPayout5Field) {
      watchPayout5Field = $("#watch-payout-5");
    }
    return Number(watchPayout5Field.val());
  }

  function getRollAnnoucmentMod() {
    if (!rollModField) {
      rollModField = $("#roll-announcement-mod");
    }
    return Number(rollModField.val());
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

$("#watch-configuration").change(function () {
    const mode = $(this).val();

    if (mode === "low-watch") {
        configureLowPayouts();
    } else if (mode === "mid-watch") {
        configureMidPayouts();
    } else if (mode === "high-watch") {
        configureHighPayouts();
    } else if (mode === "split-watch") {
        configureSplitPayouts();
    } else if (mode === "recovery-watch") {
        configureRecoveryPayouts();
    }

    renderWatchTargetTable();
});



    $("#set-risk-on-btn").click(function () {
      $("#set-risk-on-btn").hide();
      $("#set-risk-off-btn").show();
      setWager(getScaledWager());
      $("#risk-on").prop("checked", true);
      $("#roll-mode").val("half-target");
      $("#hit-count-target").val(1);
      $("#profit-target").val(0.01);
    });

    $("#set-risk-off-btn").click(function () {
      $("#set-risk-on-btn").show();
      $("#set-risk-off-btn").hide();
      $("#risk-on").prop("checked", false);
      $("#roll-mode").val("none");
      $("#hit-count-target").val(0);
      $("#profit-target").val(0);
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

    $("#stats-panel").draggable({
      containment: "window",
      scroll: false
    });

    initWatchTable();
  }

  function configureLowPayouts() {
    WATCH_PAYOUTS = [1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.45, 1.5, 1.55, 1.6, 1.65, 1.7, 1.75, 1.8, 1.85, 1.9, 1.95, 2].map(p => ({ payout: p, streak: 0 }));
    renderWatchTargetTable();
  }

  function configureMidPayouts() {
    WATCH_PAYOUTS = [5, 10, 15, 20, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100].map(p => ({ payout: p, streak: 0 }));
    renderWatchTargetTable();
  }

  function configureHighPayouts() {
    WATCH_PAYOUTS = [100, 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 20000, 50000, 100000, 500000, 10000000].map(p => ({ payout: p, streak: 0 }));
    renderWatchTargetTable();
  }

  function configureSplitPayouts() {
    WATCH_PAYOUTS = [1.5, 2, 5, 10, 20, 50, 100, 500, 1000, 5000, 10000, 20000, 50000, 100000, 500000, 10000000].map(p => ({ payout: p, streak: 0 }));
    renderWatchTargetTable();
  }

  function configureRecoveryPayouts() {
    WATCH_PAYOUTS = [1.5, 1.6, 1.7, 1.8, 1.9, 2, 2.5, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 15, 20, 25].map(p => ({ payout: p, streak: 0 }));
    renderWatchTargetTable();
  }

  function configureRiskOffMode() {
      configureRecoveryPayouts();
     $("#ls-multiplier").val(6);
      setWager(0);
      profit = 0;
     $("#risk-on").prop("checked", false);
     $("#hit-count-target").val(1)
     $("#max-loss").val(0)
  }

  function maxLossExceeded() {
    if (profit >= 0) return;

    return Math.abs(profit) >= getMaxLoss();
  }
  function getScaledWager(scalingFactor = 0.9) {
    const target = getPayout();
    const baseWager = getBaseWager();
    return Math.max(0.0001, baseWager * Math.pow(1.01 / target, scalingFactor));
  }

  function getBaseWager() {
    return getBalance() * 0.01;
  }

function initWatchTable() {
    configureLowPayouts();
}

function sanitizeId(payout) {
    return payout.toString().replace(/\./g, "_").replace(/[^\w-]/g, "");
}

function renderWatchTargetTable() {
    const $tbody = $("#watch-target-table tbody");
    $tbody.empty();

    WATCH_PAYOUTS.forEach(entry => {
        const sanitized = sanitizeId(entry.payout);
        const row = `
            <tr>
                <td style="position: sticky; left: 0; background-color: #1e1e1e; padding: 4px 6px;">
                    Payout ${entry.payout}x
                </td>
                <td><span id="losing-streak-${sanitized}">${entry.streak}</span></td>
                <td><span id="losing-streak-${sanitized}-ratio"></span></td>
                <td><span id="losing-streak-${sanitized}-diff"></span></td>
            </tr>
        `;
        $tbody.append(row);
    });
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
      highHit = 0;
      highHitLosingStreak = 0;
      highHitRound = 0;
      losingStreak1 = 0;
      losingStreak2 = 0;
      losingStreak3 = 0;
      losingStreak4 = 0;
      losingStreak5 = 0;
    }

    losingStreak = 0;
    profit = 0;
    hitCount = 0;
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

  doInit();

  setInterval(() => {
  if (performance.memory) {
    console.log("Used JS Heap:", (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + " MB");
  }
}, 5000);

  // Initialize MutationObserver
})();
