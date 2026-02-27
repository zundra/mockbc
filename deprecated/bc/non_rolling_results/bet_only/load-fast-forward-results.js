/* Start Script */
// ==UserScript==
// @name         bc.game roller v17
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

;(function () {
  "use strict"

  let lastRollSet = []
  let currentRollSet = []
  const rollEngine = initRollEngine()
  
  loadFastForwardResults();

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
<div id="control-panel">
   <div id="message" class="message-box">Welcome! Configure your settings to begin.</div>
   <div id="stats" class="message-box">
      <div>Hit Count/Roll Count: <span id="hit-count-roll-count"></span></div>
      <div>Win Rate/TEO: <span id="win-rate-teo"></span></div>
      <div>P/L: <span id="profit-loss"></span></div>
   </div>
   <div class="button-group">
      <button id="start-betting-btn">Start Betting</button>
      <button id="stop-betting-btn" style="display: none;">Stop Betting</button>
      <button id="set-risk-on-btn">Risk On</button>
      <button id="set-risk-off-btn">Risk Off</button>
      <button id="set-wager-btn">Set Wager</button>
      <button id="double-wager-btn">Double Wager</button>
      <button id="half-wager-btn">Half Wager</button>
   </div>
   <div class="control-group">
      <label>Roll Mode</label>
      <select id='roll-mode'>
         <option value="none">None</option>
         <option value="explicit">Explicit</option>
         <option value="half-target">Half Target</option>
         <option value="full-target">Full Target</option>
      </select>
   </div>
   <div class="control-group">
      <label>Base Wager</label>
      <input type="number" id="base-wager" value="0.01" />
   </div>
   <div class="control-group">
      <label>Risk On</label>
      <input id="risk-on" type="checkbox"/>
   </div>
   <div class="control-group">
      <label>Load Fast Forward Results</label>
      <input id="load-fast-forward-results" type="checkbox"/>
   </div>
   <div class="control-group">
      <label>Profit Target</label>
      <input type="number" id="profit-target" value="0" />
   </div>
   <div class="control-group">
      <label>Hit Count Target</label>
      <input type="number" id="hit-count-target" value="0" />
   </div>
   <div class="control-group" id="roll-mode-control-wrapper" style="display: none">
      <label>Max Rolls</label>
      <input type="number" id="max-rolls" value="100" />
   </div>
   <div class="control-group">
      <label>LS Multiplier</label>
      <select id="selected-payout-ls-multiplier">
      ${Array.from({ length: 10 }, (_, i) => {
        let val = i + 1
        return `<option value="${val}" ${
          val === 7 ? "selected" : ""
        }>${val}</option>`
      }).join("")}
      </select>
   </div>
      <div class="control-group">
      <label>Consecutive Strength Threshold</label>
      <select id="consecutive-strength-threshold">
      ${Array.from({ length: 10 }, (_, i) => {
        let val = (4.5 + (i / 2));
        return `<option value="${val}" ${
          val === 3 ? "selected" : ""
        }>${val}</option>`
      }).join("")}
      </select>
    </div>
          <div class="control-group">
      <label>Consecutive Strength Count</label>
      <select id="consecutive-strength-count">
      ${Array.from({ length: 10 }, (_, i) => {
        let val = (5 + i);
        return `<option value="${val}" ${
          val === 5 ? "selected" : ""
        }>${val}</option>`
      }).join("")}
      </select>
      </div>

        <div class="control-group">
      <label>Strength Threshold</label>
      <select id="strength-threshold">
      ${Array.from({ length: 10 }, (_, i) => {
        let val = (4.5 + (i / 2));
        return `<option value="${val}" ${
          val === 6 ? "selected" : ""
        }>${val}</option>`
      }).join("")}
      </select>
      </div>
      <div class="control-group">
   <label>Low Strength Threshold</label>
    <select id="low-strength-threshold">
      ${Array.from({ length: 10 }, (_, i) => {
        let val = (4.5 + (i / 2));
        return `<option value="${val}" ${
          val === 9 ? "selected" : ""
        }>${val}</option>`
      }).join("")}
      </select>
   </div>
</div>
    `

    // Append the control panel to the body
    $("body").append(html)
    initWindowEvents()
  })

  function evalResult(result) {
    rollEngine.sessionHandler.addResult(result, getWager(), getRollConfig(), getRiskOn())
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
        return $(this).text()
      })
      .get()
  }

  function doInit() {
    observeRollChanges()
    initPrototypes()
    bindHotKeys()

  }

  function initWindowEvents() {
    $("#set-risk-on-btn").click(function () {
      setWager($("#base-wager").val())
      $("#risk-on").prop("checked", true)
      $("#roll-mode").val("none")
      $("#profit-target").val(0.01)
    })

    $("#set-risk-off-btn").click(function () {
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

    $("#set-wager-btn").click(function () {
      setWager(Math.max(0.01, $("#base-wager").val()))
    })

    $("#start-betting-btn").click(function () {
      startBetting()
    })

    $("#stop-betting-btn").click(function () {
      stopBetting()
    })

      $("#control-panel").draggable({
        containment: "window",
        scroll: false,
      })

      $("#statsPane").draggable({
        containment: "window",
        scroll: false,
      })
  }

  function bindHotKeys() {
    $(document).on("keypress", function (e) {
      if (e.which === 122) {
        if (rollEngine.sessionHandler.isStopped()) {
          startBetting()
        } else {
          stopBetting()
        }
      }
    })
  }

  function initPrototypes() {
    Array.prototype.last = function () {
      return this[this.length - 1]
    }
    Array.prototype.first = function () {
      return this[0]
    }

    Array.prototype.median = function () {
      if (this.length === 0) return null // Handle empty array case

      const medianIndex = Math.floor((this.length - 1) / 2) // Get the median index
      return this[medianIndex] // Return the median element
    }
  }

  function startBetting() {
    if (!runSafetyChecks()) {
      e.preventDefault();
      return;
    }

    $("#message").text("")
    $("#start-betting-btn").hide();
    $("#stop-betting-btn").show();

      rollEngine.sessionHandler.start(getRollConfig())
    doBet()
  }

function runSafetyChecks() {
  const wager = getWager();
  const payout = getPayout();
  const balance = getBalance();


  const exposure = wager * payout;
  const exposurePercent = (exposure / balance) * 100;

  // Safety thresholds
  const maxSafeExposure = 0.2;  // 20% of balance
  const maxAbsoluteExposure = 0.5; // 50% of balance

  if (wager > balance) {
    alert("Wager exceeds your current balance.");
    return false;
  }

  if (exposure > balance * maxAbsoluteExposure) {
    alert(`Your exposure is ${exposurePercent.toFixed(1)}% of your bankroll. That's too high.`);
    return false;
  }

  if (exposure > balance * maxSafeExposure) {
    const confirmRisk = confirm(
      `This bet exposes ${exposurePercent.toFixed(1)}% of your bankroll.\nAre you sure you want to proceed?`
    );
    if (!confirmRisk) return false;
  }

  return true;
}

function loadFastForwardResults() {
  const fastForwardResults = getFastForwardResults();

  for (let i = 0; i < fastForwardResults.length; i++) {
    const result = fastForwardResults[i];
    rollEngine.sessionHandler.addResult(result, 0, getRollConfig(), false);
  }

  //clearResults();
}

  function clearResults() {
    localStorage.removeItem("fastForwardResults");
    console.log("Fast-forward results cleared.");
  }

function getFastForwardResults() {
  const raw = localStorage.getItem("fastForwardResults");
  if (!raw) {
    console.warn("No fast-forward results found.");
    return null;
  }

  try {
    const data = JSON.parse(raw);
    console.log(`Loaded ${data.count} fast-forward results from ${new Date(data.timestamp).toLocaleString()}`);
    return data.results;
  } catch (e) {
    console.error("Failed to parse fast-forward results:", e);
    return null;
  }
}


 async function doBet() {
    while (rollEngine.sessionHandler.isRunning()) {
      // Trigger the button click

      $(".button-brand:first").trigger("click")

      // Wait for 1 second (1000 ms) before clicking again
      await delay(10)

      // Stop condition check inside the loop
      if (rollEngine.sessionHandler.isStopped()) {
        return // Break the loop if stop is true
      }
    }
  }

  function stopBetting() {
    $("#start-betting-btn").show();
    $("#stop-betting-btn").hide();
    rollEngine.sessionHandler.stop()
  }

  function getPayout() {
    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Payout")',
    )
    const inputField = payoutFieldGroup.find("input")

    return Number(inputField.val())
  }

  function getWager() {
    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Amount")',
    )
    const inputField = payoutFieldGroup.find("input")

    return Number(inputField.val())
  }

  function getPayout() {
    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Payout")',
    )
    const inputField = payoutFieldGroup.find("input")

    return Number(inputField.val())
  }

  function getRiskOn() {
    return $("#risk-on").prop("checked")
  }

  function getLoadFastForwardResults() {
    return $("#load-fast-forward-results").prop("checked")
  }

  function getConsecutiveStrengthThreshold() {
    return Number($("#consecutive-strength-threshold").val())
  }
    function getConsecutiveStrengthCount() {
    return Number($("#consecutive-strength-count").val())
  }

  function getStrengthThreshold() {
    return Number($("#strength-threshold").val())
  }

  function getLowStrengthThreshold() {
    return Number($("#low-strength-threshold").val())
  }


  function getHitCountTarget() {
    return Number($("#hit-count-target").val())
  }

  function getSelectedPayoutLosingStreakMultiplier() {
    return Number($("#selected-payout-ls-multiplier").val())
  }

  function getRollMode() {
    return $("#roll-mode").val()
  }

  function getMaxRolls() {
    switch (getRollMode()) {
      case "explicit":
        return Number($("#max-rolls").val())
      case "full-target":
        return Math.floor(getPayout())
      case "half-target":
        return Math.floor(getPayout() / 2)
      default:
        return -1
    }
  }

  function getProfitTarget() {
    return Number($("#profit-target").val())
  }

  function getShortLookback() {
    return 5;
  }

  function getMidLookback() {
    return 10;
  }

  function getLongLookback() {
    return 20;
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  function initRollEngine() {
    let rollCount = 0
    const targets = generateTargets()
    const rollingStats = initRollingStats()
    const highHits = initHighHits()
    const ui = initUI(targets, rollingStats, highHits)

    class SessionHandler {
      constructor(rollHandler) {
        this.state = {
          stopped: true,
          reason: "",
        }
        this.losingStreak = 0
        this.rollHandler = rollHandler
        this.losingStreakTargetDelta = 0
        this.hitCount = 0
        this.rollCount = 0
        this.rollMode = ""
        this.stopOnExpectedHits = false
        this.expectedHitsMaxRolls = 0
        this.stopOnMaxRolls = false
        this.payout = 0
        this.wagerRatio = 0
        this.profitLoss = 0
        this.maxRolls = 0
        this.expectedHitsMaxRolls = 0
        this.selectedPayoutLSMultiplier = 0
        this.shortLookback = 0
        this.midLookback = 0
        this.longLookback = 0
        this.strengthThreshold = 0
        this.stopOnWin = false
        this.lowStrengthThreshold = 0;
        this.cStrengthCount = 0
        this.cStrengthThreshold = 0
      }

      getWinRate() {
        return this.hitCount / this.rollCount
      }

      getTeo() {
        return 1 / (this.payout * 1.05)
      }

      getMean(lookback) {
        return rollingStats.getMean(lookback)
      }

      getMedian(lookback) {
        return rollingStats.getMedian(lookback)
      }

      getVariance(lookback) {
        return rollingStats.getVariance(lookback)
      }

      getStandardDeviation(lookback) {
        return rollingStats.getStandardDeviation(lookback)
      }

      start(rollConfig) {
        this.reset()
        this.setRollConfigVariables(rollConfig)
        this.state.stopped = false
        this.losingStreakTargetDelta = 0
        this.profitLoss = 0
        this.expectedHits = 0
        this.expectedHitsMaxRolls = 0
      }

      reset() {
        this.state.stopped = true
        this.state.reason = ""
        this.rollCount = 0
        this.losingStreak = 0
        this.hitCount = 0
        this.wagerRatio = 1
      }

      isStopped() {
        return this.state.stopped
      }

      getStopReason() {
        return this.state.reason
      }

      isRunning() {
        return !this.isStopped()
      }

      addResult(result, wager, rollConfig, isRiskOn) {
        this.setRollConfigVariables(rollConfig)
        rollingStats.push(result)
        highHits.addResult(result)
        this.rollCount++
        rollCount++
        targets.forEach((target) => target.addResult(result))

        if (result >= this.payout) {
          this.hitCount++
          this.profitLoss += this.payout * wager - wager
          const diff = this.payout - this.losingStreak
          this.wagerRatio = Math.min(1, 1 - diff / this.payout)
          this.losingStreakTargetDelta = this.payout - this.losingStreak
          this.losingStreak = 0
        } else {
          this.profitLoss -= wager
          this.losingStreak++
          this.wagerRatio = 1
        }

         ui.update()

        this.checkStopOnProfitTarget(result)
        this.checkStopOnHitCount()
        this.checkStopOnMaxRolls()
        this.checkStopOnExpectedHits()

        if (!isRiskOn) {
          this.checkSelectedPayoutLosingStreak()
          this.checkStrengthThreshold()
          this.checkLowStrengthThreshold()
          this.checkConsecutiveBelowStrength()
        }
      }

      setRollConfigVariables(rollConfig) {
        this.payout = rollConfig.payout
        this.maxRolls = rollConfig.maxRolls
        this.hitCountTarget = rollConfig.hitCountTarget
        this.profitTarget = rollConfig.profitTarget
        this.rollMode = rollConfig.rollMode
        this.stopOnExpectedHits = rollConfig.stopOnExpectedHits
        this.selectedPayoutLSMultiplier = rollConfig.selectedPayoutLSMultiplier
        this.shortLookback = rollConfig.shortLookback
        this.midLookback = rollConfig.midLookback
        this.longLookback = rollConfig.longLookback
        this.strengthThreshold = rollConfig.strengthThreshold
        this.lowStrengthThreshold = rollConfig.lowStrengthThreshold
        this.cStrengthThreshold = rollConfig.cStrengthThreshold
        this.cStrengthCount = rollConfig.cStrengthCount
      }

      checkSelectedPayoutLosingStreak() {
        if (
          this.losingStreak >=
          this.payout * this.selectedPayoutLSMultiplier
        ) {
          this.stop(
            `Selected payout hit max losing streak multiplier: ${this.losingStreak}`,
            true,
          )
        }
      }

      checkStrengthThreshold() {
        const results = this.getTargetsExceedingStrengthThreshold(
          this.shortLookback,
          this.midLookback,
          this.longLookback,
          -this.strengthThreshold,
        )

        if (results.length !== 0) {
          const names = results.map((t) => t.getPayout()).join(", ")
          const message = `🟡 The following targets exceeded strength threshold:\n\n${names}\n\n🛑 Session halted for review.`
          this.stop(message, true)
        }
      }


      checkLowStrengthThreshold() {
        const results = this.getTargetsExceedingLowStrengthThreshold(
          this.shortLookback,
          this.midLookback,
          this.longLookback,
          -this.lowStrengthThreshold,
        )

        if (results.length !== 0) {
          const names = results.map((t) => t.getPayout()).join(", ")
          const message = `🟡 The following low targets exceeded strength threshold:\n\n${names}\n\n🛑 Session halted for review.`
          this.stop(message, true)
        }
      }

      checkConsecutiveBelowStrength() {
        const results = this.getConsecutiveNegativeStrengthTargets(
          this.cStrengthCount,
          this.shortLookback,
          this.midLookback,
          this.longLookback,
          -this.cStrengthThreshold,
        )

        if (results.length !== 0) {
          const names = results.first().map((t) => t.getPayout()).join(", ")
          const message = `🟡 The following targets exceeded consecutive strength threshold:\n\n${names}\n\n🛑 Session halted for review.`
          this.stop(message, true)
        }
      }

      checkStopOnExpectedHits() {
        if (this.rollMode !== "expected-hits") return
        const expectedHits =
          (this.getTeo() / 100) * this.expectedHitsMaxRolls * 100

        if (this.stopOnExpectedHits && this.hitCount >= expectedHits) {
          this.stop(
            `Target hit or exceeded expected hits: ${this.hitCount} / ${expectedHits.toFixed(
              2,
            )} over ${this.rollCount} rolls`,
          )
        } else if (this.rollCount >= this.expectedHitsMaxRolls) {
          this.stop(
            `Target hit max rolls during expected hits mode: ${this.hitCount} / ${expectedHits.toFixed(
              2,
            )} over ${this.rollCount} rolls`,
          )
        }
      }

      checkStopOnHitCount() {
        if (this.hitCountTarget === 0) return
        if (this.hitCount < this.hitCountTarget) return

        this.stop(
          `Target ${this.payout} hit ${this.hitCount} times, Delta: (${this.losingStreakTargetDelta})`,
        )
      }

      checkStopOnMaxRolls() {
        if (this.maxRolls === -1) return
        if (this.rollCount >= this.maxRolls) {
          this.stop(`Stopped on max rolls ${this.rollCount}`)
        }
      }

      checkStopOnProfitTarget() {
        if (this.profitTarget === 0) return
        if (this.profitLoss < this.profitTarget) return

        this.stop(
          `Stopped on profit target Profit Target: ${this.profitTarget}, Profit: ${this.profitLoss.toFixed(5)}`,
        )
      }

      isWindUp() {
        if (rollCount < 100) return false

        const minStableStdDev = 10
        const mean10 = this.getMean(10)
        const mean100 = this.getMean(10)
        const median10 = this.getMedian(10)
        const median100 = this.getMedian(100)
        const median1000 = this.getMedian(1000)
        const stdDev10 = this.getStandardDeviation(10)
        const stdDev100 = this.getStandardDeviation(100)

        return (
          stdDev100 < minStableStdDev && // Environment is not chaotic
          stdDev10 < stdDev100 * 0.75 && // Compression happening
          mean10 < mean100 * 0.75 && // Payout suppression
          mean10 < median10 * 1.25 && // No big outliers skewing mean
          median10 < 1.3 &&
          median100 < 1.5 &&
          median1000 < 1.8
        )
      }

      isWindUpTight() {
        if (rollCount < 100) return false

        const mean10 = this.getMean(10)
        const median10 = this.getMedian(10)
        const stdDev10 = this.getStandardDeviation(10)
        const stdDev100 = this.getStandardDeviation(100)
        const variance10 = this.getVariance(10)

        return (
          stdDev10 < 0.1 &&
          variance10 < 0.5 &&
          mean10 < median10 * 1.25 &&
          median10 < 1.5
        )
      }

      getTargetsExceedingStrengthThreshold(
        shortLookback,
        midLookback,
        longLookback,
        threshold,
      ) {
        if (rollCount < longLookback) return []
        return targets.filter(
          (target) =>
            target.getPayout() >= 3 &&
            target.exceedsStrengthThreshold(
              shortLookback,
              midLookback,
              longLookback,
              threshold,
            ),
        )
      }

      getTargetsExceedingLowStrengthThreshold(
        shortLookback,
        midLookback,
        longLookback,
        threshold,
      ) {
        if (rollCount < longLookback) return []
        return targets.filter(
          (target) =>
            target.getPayout() < 2 &&
            target.exceedsStrengthThreshold(
              shortLookback,
              midLookback,
              longLookback,
              threshold,
            ),
        )
      }

    getConsecutiveNegativeStrengthTargets(
      countThreshold,
      shortLookback,
      midLookback,
      longLookback,
      cStrengthThreshold
    ) {
      const result = [];
      for (let i = 0; i < targets.length; i++) {
        const group = [];
        while (i < targets.length && targets[i].getStrength() < cStrengthThreshold) {
          group.push(targets[i]);
          i++;
        }
        if (group.length > countThreshold) {
          result.push(group);
        }
      }
      return result;
    }

    stop(reason = "", notify = false) {
        this.state.reason = reason
        this.state.stopped = true
        console.log(reason)
        $("#message").html(reason)
        if (notify) this.notify()
      }

      async notify() {
        const path =
          "https://www.myinstants.com/media/sounds/ding-sound-effect_2.mp3"

        var audio = new Audio(path)
        audio.type = "audio/wav"

        try {
          await audio.play()
        } catch (err) {
          console.log("Failed to play..." + err)
        }
      }
    }

    class RollEngine {
      constructor() {
        this.sessionHandler = new SessionHandler()
      }
    }

    function generateTargets() {
      class Stats {
        constructor(size, payout) {
          this.size = size
          this.payout = payout
          this.streak = 0
          this.pstreak = 0
          this.hitCount = 0
          this.losingStreak = 0
          this.streakSignFlipped = 0

          this.buffer = new Array(size).fill(null)
          this.index = 0
          this.count = 0
          this.sum = 0
        }

        push = (result) => {
          rollCount++
          this.updateStreak(result)
          const isHit = result >= this.payout ? 1 : 0

          if (this.count >= this.size) {
            const old = this.buffer[this.index]
            this.sum -= old ?? 0
          } else {
            this.count++
          }

          this.buffer[this.index] = isHit
          this.sum += isHit
          this.index = (this.index + 1) % this.size
        }

        updateStreak = (result) => {
          if (result >= this.payout) {
            this.hitCount++
            if (this.streak < 0) {
              this.streakSignFlipped = true
              this.pstreak = this.streak
            } else {
              this.streakSignFlipped = false
            }
            this.streak = Math.max(this.streak + 1, 1)
          } else {
            if (this.streak > 0) {
              this.streakSignFlipped = true
              this.pstreak = this.streak
            } else {
              this.streakSignFlipped = false
            }
            this.streak = Math.min(this.streak - 1, -1)
          }

          this.losingStreak = this.streak < 0 ? this.streak : 0
        }

        getRate = (lastN = this.count) => {
          const count = Math.min(lastN, this.count)
          if (count === 0) return 0

          let sum = 0
          const start = (this.index - count + this.size) % this.size
          for (let i = 0; i < count; i++) {
            const idx = (start + i + this.size) % this.size
            sum += this.buffer[idx] ?? 0
          }
          return sum / count
        }

        getWinRate = (lookback = 10) => this.getRate(lookback)

        getTeo = () => 1 / (this.getPayout() * 1.05)

        getSum = (lastN = this.count) => {
          const count = Math.min(lastN, this.count)
          if (count === 0) return 0

          let sum = 0
          const start = (this.index - count + this.size) % this.size
          for (let i = 0; i < count; i++) {
            const idx = (start + i + this.size) % this.size
            sum += this.buffer[idx] ?? 0
          }
          return sum
        }

        getDeviation = () => {
          const expectedRate = 1 / this.payout
          return (this.getRate() - expectedRate) * this.count * 100
        }

        reset() {
          rollCount = 0
          this.rollCount = 0
        }

        getHitCount = () => this.hitCount
        getRollCount = () => rollCount
        getStreak = () => this.streak
        getPreviousStreak = () => this.pstreak
        getLosingStreak = () =>
          this.losingStreak < 0 ? Math.abs(this.losingStreak) : 0
        getStreakSignFlipped = () => this.streakSignFlipped
        getCount = () => this.count
        getPayout = () => this.payout
        getStrength = () => this.getTeo() * this.getStreak()
        getLSRatio = () => Math.floor(this.getLosingStreak() / this.payout)
        getLSRatioAbs = () => Math.abs(this.getLSRatio())
      }

      class Target {
        constructor(payout, lookbackMultipliers = [5, 10, 20]) {
          this.stats = new Stats(Math.ceil(payout * 20), payout)
          this.payout = payout
          this.lookbacks = lookbackMultipliers.map((multiplier) =>
            Math.ceil(payout * multiplier),
          )
        }

        addResult = (result) => {
          this.stats.push(result)
        }

        getTeo = () => this.stats.getTeo()
        getLookbacks = () => this.lookbacks
        getShortLookback = () => this.lookbacks[0]
        getMidLookback = () => this.lookbacks[1]
        getLongLookback = () => this.lookbacks[2]

        getPayout = () => this.stats.getPayout()
        getHitCount = () => this.stats.getHitCount()
        getRollCount = () => this.stats.getRollCount()
        getStreak = () => this.stats.getStreak()
        getPreviousStreak = () => this.stats.getPreviousStreak()
        getLosingStreak = () => this.stats.getLosingStreak()
        getStreakSignFlipped = () => this.stats.getStreakSignFlipped()
        getCount = () => this.stats.getCount()
        getLSRatioAbs = () => this.stats.getLSRatioAbs()
        getLSRatio = () => this.stats.getLSRatio()
        getStrength = () => this.stats.getStrength()
        losingStreakExceedsN = (n) =>
          this.getLSRatioAbs() > n * this.stats.getPayout()

        getWinRatePercentOfTeo = (lookback = 100) => {
          return (this.stats.getWinRate(lookback) / this.getTeo()) * 100
        }

        getWinRateChange = (lookback) => {
          const winRate = this.stats.getWinRate(lookback)
          const teo = this.getTeo()
          return ((winRate - teo) / teo) * 100
        }

        getHitPoolDeviationScoreLookback = (lookback) => {
          const teo = 1 / this.payout
          const windowSize = Math.min(lookback, this.getCount())
          if (windowSize === 0) return 0

          const expected = windowSize * teo
          const actual = this.stats.getSum(windowSize)

          const balance = expected - actual
          const ratio = balance / expected

          const capped = Math.max(-1, Math.min(1, ratio))
          return -capped * 100
        }

        exceedsStrengthThreshold = (
          shortLookback,
          midLookback,
          longLookback,
          threshold,
        ) => {
          if (this.getRollCount() < this.payout * 10) return false
          const ls = this.getLSRatioAbs()
          const short = this.stats.getWinRate(shortLookback)
          const mid = this.stats.getWinRate(midLookback)
          const long = this.stats.getWinRate(longLookback)
          const strength = this.getStrength()
          return short < 90 && mid < 90 && long < 90 && strength < threshold
        }

        getWinRatePercentsOfTeo = () => {
          return this.getLookbacks().map((lookback) =>
            this.getWinRatePercentOfTeo(lookback),
          )
        }
      }
      return generatePayouts().map((payout) => new Target(payout))
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
        ...Array.from({ length: 10 }, (_, k) => 10 + k * 10),
      ]
    }
    return new RollEngine()
  }

  function getRollConfig() {
    const payout = getPayout()
    const maxRolls = getMaxRolls()
    const hitCountTarget = getHitCountTarget()
    const profitTarget = getProfitTarget()
    const selectedPayoutLSMultiplier = getSelectedPayoutLosingStreakMultiplier()
    const shortLookback = getShortLookback()
    const midLookback = getMidLookback()
    const longLookback = getLongLookback()
    const strengthThreshold = getStrengthThreshold()
    const lowStrengthThreshold = getLowStrengthThreshold()
    const cStrengthThreshold = getConsecutiveStrengthThreshold()
    const cStrengthCount = getConsecutiveStrengthCount()

    const rollMode = getRollMode()

    return {
      payout: payout,
      maxRolls: maxRolls,
      hitCountTarget: hitCountTarget,
      profitTarget: profitTarget,
      rollMode: rollMode,
      selectedPayoutLSMultiplier: selectedPayoutLSMultiplier,
      shortLookback: shortLookback,
      midLookback: midLookback,
      longLookback: longLookback,
      strengthThreshold: strengthThreshold,
      lowStrengthThreshold: lowStrengthThreshold,
      cStrengthThreshold: cStrengthThreshold,
      cStrengthCount: cStrengthCount
    }
  }

  function initRollingStats() {
    class RollingStats {
      constructor(size) {
        this.size = size
        this.buffer = new Array(size).fill(null)
        this.index = 0
        this.count = 0
      }

      push = (value) => {
        if (this.count >= this.size) {
          // Overwrite old value
          this.buffer[this.index] = value
        } else {
          this.buffer[this.index] = value
          this.count++
        }

        this.index = (this.index + 1) % this.size
      }

      getValues = (lookback = this.count) => {
        const count = Math.min(lookback, this.count)
        const values = []
        const start = (this.index - count + this.size) % this.size
        for (let i = 0; i < count; i++) {
          const idx = (start + i + this.size) % this.size
          values.push(this.buffer[idx])
        }
        return values
      }

      getMean = (lookback = this.count) => {
        const vals = this.getValues(lookback)
        if (vals.length === 0) return 0
        const sum = vals.reduce((a, b) => a + b, 0)
        return sum / vals.length
      }

      getVariance = (lookback = this.count) => {
        const vals = this.getValues(lookback)
        if (vals.length <= 1) return 0
        const mean = this.getMean(lookback)
        const sumOfSquares = vals.reduce((sum, v) => sum + (v - mean) ** 2, 0)
        return sumOfSquares / (vals.length - 1)
      }

      getStandardDeviation = (lookback = this.count) => {
        return Math.sqrt(this.getVariance(lookback))
      }

      getMedian = (lookback = this.count) => {
        const vals = this.getValues(lookback)
        if (vals.length === 0) return null
        const sorted = [...vals].sort((a, b) => a - b)
        const mid = Math.floor(sorted.length / 2)
        return sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid]
      }
    }

    return new RollingStats(10000)
  }

  function initUI(targets, rollingStats, highHits) {
    function getNewWindowHTMLNode(hook) {
      return $(newWindow.document).find(hook)
    }

    class UI {
      constructor(targets, rollingStats, highHits) {
        this.targets = targets;
        this.rollingStats = rollingStats;
        this.highHits = highHits;
      }

      update(result) {
        this.updateStats()
      }

      updateStats(rollHandler) {
        function setColor(id, value, threshold) {
          let $element = $("#" + id) // Select element with jQuery
          $element.css("color", value < threshold ? "red" : "white") // Apply color conditionally
        }

        const stats10Mean = this.rollingStats.getMean(10)
        const stats100Mean = this.rollingStats.getMean(100)
        const stats1000Mean = this.rollingStats.getMean(1000)

        const stats10variance = this.rollingStats.getVariance(10)
        const stats100variance = this.rollingStats.getVariance(100)
        const stats1000variance = this.rollingStats.getVariance(1000)

        const stats10median = this.rollingStats.getMedian(10)
        const stats100median = this.rollingStats.getMedian(100)
        const stats1000median = this.rollingStats.getMedian(1000)

        const stats10StdDev = this.rollingStats.getStandardDeviation(10)
        const stats100StdDev = this.rollingStats.getStandardDeviation(100)
        const stats1000StdDev = this.rollingStats.getStandardDeviation(1000)

        $("#hit-count-roll-count").text(
          `${rollEngine.sessionHandler.hitCount}/${rollEngine.sessionHandler.rollCount}`,
        )
        $("#win-rate-teo").text(
          `${rollEngine.sessionHandler.getWinRate().toFixed(2)}/${rollEngine.sessionHandler.getTeo().toFixed(2)}`,
        )

        $("#mean10").text(stats10Mean.toFixed(2))
        $("#variance10").text(stats10variance.toFixed(2))
        $("#stddev10").text(stats10StdDev.toFixed(2))
        $("#median10").text(stats10median.toFixed(2))

        $("#mean100").text(stats100Mean.toFixed(2))
        $("#variance100").text(stats100variance.toFixed(2))
        $("#stddev100").text(stats100StdDev.toFixed(2))
        $("#median100").text(stats100median.toFixed(2))

        $("#mean1000").text(stats1000Mean.toFixed(2))
        $("#variance1000").text(stats1000variance.toFixed(2))
        $("#stddev1000").text(stats1000StdDev.toFixed(2))
        $("#median1000").text(stats1000median.toFixed(2))

        const highHits = this.highHits.getResults()

        $("#highHit-hit")
          .text(`${highHits.highHit.hit}`)
          .css({
            backgroundColor:
              highHits.highHit.hitDelta < 0 ? "red" : "transparent",
          })
        $("#highHit-remaining").text(`${highHits.highHit.rollsRemaining}`)
        $("#highHit-delta").text(`${highHits.highHit.hitDelta.toFixed(2)}`)

        $("#highHit50-hit")
          .text(`${highHits.highHit50.hit}`)
          .css({
            backgroundColor:
              highHits.highHit50.hitDelta < 0 ? "red" : "transparent",
          })
        $("#highHit50-remaining").text(`${highHits.highHit50.rollsRemaining}`)
        $("#highHit50-delta").text(`${highHits.highHit50.hitDelta.toFixed(2)}`)

        $("#highHit100-hit")
          .text(`${highHits.highHit100.hit}`)
          .css({
            backgroundColor:
              highHits.highHit100.hitDelta < 0 ? "red" : "transparent",
          })
        $("#highHit100-remaining").text(`${highHits.highHit100.rollsRemaining}`)
        $("#highHit100-delta").text(
          `${highHits.highHit100.hitDelta.toFixed(2)}`,
        )

        $("#highHit1000-hit")
          .text(`${highHits.highHit1000.hit}`)
          .css({
            backgroundColor:
              highHits.highHit1000.hitDelta < 0 ? "red" : "transparent",
          })
        $("#highHit1000-remaining").text(
          `${highHits.highHit1000.rollsRemaining}`,
        )
        $("#highHit1000-delta").text(
          `${highHits.highHit1000.hitDelta.toFixed(2)}`,
        )

        $("#highHit10000-hit")
          .text(`${highHits.highHit10000.hit}`)
          .css({
            backgroundColor:
              highHits.highHit10000.hitDelta < 0 ? "red" : "transparent",
          })
        $("#highHit10000-remaining").text(
          `${highHits.highHit10000.rollsRemaining}`,
        )
        $("#highHit10000-delta").text(
          `${highHits.highHit10000.hitDelta.toFixed(2)}`,
        )

        // Last 10 Rolls
        setColor("mean10", stats10Mean, stats100Mean - 1)
        setColor("variance10", stats10variance, 0.5)
        setColor("stddev10", stats10StdDev, 1)
        setColor("median10", stats10Mean, 1.92)

        // Last 100 Rolls
        setColor("mean100", stats100Mean, stats1000Mean - 1)
        setColor("variance100", stats100variance, 0.5)
        setColor("stddev100", stats100StdDev, 1)
        setColor("median100", stats100median, 1.92)

        // Last 1000 Rolls
        setColor("mean1000", stats1000Mean, 1.92)
        setColor("variance1000", stats1000variance, 0.5)
        setColor("stddev1000", stats1000StdDev, 1)
        setColor("median1000", stats1000median, 1.92)
      }

      createWinRateBar(winRateContainer, percentOfTeo) {
        winRateContainer.empty()

        const winRateChange = percentOfTeo - 100
        const fullBarWidth = 200
        const halfBarWidth = fullBarWidth / 2
        const fillPct = Math.min(Math.abs(winRateChange), 100) / 100
        const leftWidth = `${fillPct * halfBarWidth}px`
        const rightWidth = `${fillPct * halfBarWidth}px`

        const winRateBar = $("<div>")
          .addClass("win-rate-bar")
          .css({
            position: "relative",
            width: `${fullBarWidth}px`,
            height: "12px",
            background: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            borderRadius: "4px",
            overflow: "hidden",
            boxShadow: "0 0 5px rgba(0, 255, 0, 0.2)",
          })

        const winRateCenter = $("<div>").addClass("win-rate-bar-center").css({
          position: "absolute",
          left: "50%",
          width: "2px",
          height: "100%",
          background: "#fff",
          transform: "translateX(-50%)",
          boxShadow: "0 0 5px rgba(255, 255, 255, 0.5)",
        })

        const winRateLeft = $("<div>")
          .addClass("win-rate-bar-left")
          .css({
            background: "rgba(255, 0, 0, 0.8)", // 🔴 solid red
            height: "100%",
            position: "absolute",
            right: "50%",
            width: winRateChange < 0 ? leftWidth : "0",
            transition: "width 0.3s ease-in-out",
          })

        const winRateRight = $("<div>")
          .addClass("win-rate-bar-right")
          .css({
            background: "rgba(0, 255, 0, 0.8)", // 🟢 solid green
            height: "100%",
            position: "absolute",
            left: "50%",
            width: winRateChange > 0 ? rightWidth : "0",
            transition: "width 0.3s ease-in-out",
          })

        winRateBar.append(winRateLeft, winRateRight, winRateCenter)
        winRateContainer.append(winRateBar)
      }
    }

    return new UI(targets, rollingStats, highHits)
  }

  function initHighHits() {
    class HighHits {
      constructor() {
        this.rollCount = 0
        this.highHit = 0
        this.round = 0

        this.intervals = [50, 100, 1000, 10000]
        this.data = new Map()

        for (const interval of this.intervals) {
          this.data.set(interval, {
            highHit: 0,
            round: 0,
          })
        }
      }

      addResult(result) {
        this.rollCount++

        // Update global high hit
        if (result > this.highHit) {
          this.highHit = result
          this.round = this.rollCount
        }

        for (const interval of this.intervals) {
          if (this.rollCount % interval === 0) {
            this.data.set(interval, { highHit: 0, round: 0 })
          }

          const entry = this.data.get(interval)
          if (result > entry.highHit) {
            this.data.set(interval, {
              highHit: result,
              round: this.rollCount,
            })
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
            rollsRemaining: Infinity,
          },
        }

        for (const interval of this.intervals) {
          const { highHit, round } = this.data.get(interval)
          const roundDelta = this.rollCount - round
          const rollsRemaining = Math.max(0, interval - roundDelta)

          results[`highHit${interval}`] = {
            hit: highHit,
            round,
            roundDelta,
            hitDelta: highHit - roundDelta,
            rollsRemaining,
          }
        }

        return results
      }
    }
    return new HighHits()
  }

  // Utility function: Extract the last roll result

  function getRollResult() {
    const temp = lastRollSet
    lastRollSet = currentRollSet
    currentRollSet = temp
    currentRollSet.length = 0

    currentRollSet = $(".grid.grid-auto-flow-column div span")
      .map(function () {
        return Number($(this).text().replace("x", ""))
      })
      .get()

    if (arraysAreEqual(currentRollSet, lastRollSet)) {
      return -1
    }

    return currentRollSet[currentRollSet.length - 1]
  }

  // Observer for Bustadice "My Bets" table
  let observer = null

  async function observeRollChanges() {
    const gridElement = await waitForSelector(".grid.grid-auto-flow-column")
    let previousRollData = getCurrentRollData()

    // If an observer already exists, disconnect it before creating a new one
    if (observer) {
      observer.disconnect()
    }

    observer = new MutationObserver((mutationsList) => {
      let rollDataChanged = false

      for (const mutation of mutationsList) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          const currentRollData = getCurrentRollData()
          if (!arraysAreEqual(previousRollData, currentRollData)) {
            rollDataChanged = true
            previousRollData = currentRollData
          }
        }
      }

      if (rollDataChanged) {
        evalResult(getRollResult())
      }
    })

    observer.observe(gridElement, {
      childList: true,
      subtree: true,
    })
  }

  function arraysAreEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false
    return arr1.every((value, index) => value === arr2[index])
  }

  function waitForSelector(selector) {
    const pause = 10 // Interval between checks (milliseconds)
    let maxTime = 50000 // Maximum wait time (milliseconds)

    return new Promise((resolve, reject) => {
      function inner() {
        if (maxTime <= 0) {
          reject(
            new Error("Timeout: Element not found for selector: " + selector),
          )
          return
        }

        // Try to find the element using the provided selector
        const element = document.querySelector(selector)
        if (element) {
          resolve(element)
          return
        }

        maxTime -= pause
        setTimeout(inner, pause)
      }

      inner()
    })
  }

  doInit()
})()
