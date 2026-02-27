/* Start Script */
// ==UserScript==
// @name         bc.game roller v14
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

  const MAX_WAGER = 0.64

  let lastRollSet = []
  let currentRollSet = []
  let minStrengthObserved = 0
  const ROLL_HANDLER = initRollHandler()
  const SESSION = defaultSession(ROLL_HANDLER)

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
      <button id="stop-betting-btn">Stop Betting</button>
      <button id="set-risk-on-btn">Risk On</button>
      <button id="set-risk-off-btn">Risk Off</button>
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
      <label>Profit Target</label>
      <input type="number" id="profit-target" value="0" />
   </div>
   <div class="control-group">
      <label>Hit Count Target</label>
      <input type="number" id="hit-count-target" value="0" />
   </div>
   <div class="control-group">
      <label>Watch Target</label>
      <input type="number" id="watch-target" value="0" />
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
      return `<option value="${val}" ${val === 7 ? "selected" : ""}>${val}</option>`
      }).join("")}
      </select>
   </div>
   <h4>Win Rate Score Thresholds</h4>
   <div class="control-group">
      <label>Min Payout</label>
      <input type="number" id="min-payout" value="3" />
   </div>
   <div class="control-group">
      <label>Short WR Lookback</label>
      <select id="short-lookback">
      ${Array.from({ length: 5 }, (_, i) => {
      let val = 5 + i * 5
      return `<option value="${val}" ${val === 5 ? "selected" : ""}>${val}</option>`
      }).join("")}
      </select>
   </div>
   <div class="control-group">
      <label>Mid WR Lookback</label>
      <select id="mid-lookback">
      ${Array.from({ length: 5 }, (_, i) => {
      let val = 5 + i * 5
      return `<option value="${val}" ${val === 10 ? "selected" : ""}>${val}</option>`
      }).join("")}
      </select>
   </div>
   <div class="control-group">
      <label>Long WR Lookback</label>
      <select id="long-lookback">
      ${Array.from({ length: 5 }, (_, i) => {
      let val = 5 + i * 5
      return `<option value="${val}" ${val === 20 ? "selected" : ""}>${val}</option>`
      }).join("")}
      </select>
   </div>
   <div class="control-group">
      <label>Winrate Score Threshold</label>
      <select id="score-threshold">
      ${Array.from({ length: 10 }, (_, i) => {
      let val = 100 * (i + 1)
      return `<option value="${val}" ${val === 600 ? "selected" : ""}>${val}</option>`
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
    ROLL_HANDLER.addResult(result)
    updateStats()
    SESSION.addRoll(result, getWager(), getRollConfig(), getRiskOn())
    evalHalts()
  }

  function updateStats() {
    function setColor(id, value, threshold) {
      let $element = $("#" + id) // Select element with jQuery
      $element.text(value.toFixed(2)) // Update text
      $element.css("color", value < threshold ? "red" : "white") // Apply color conditionally
    }

    const highHits = ROLL_HANDLER.getHighHits();
    const stats10Mean = ROLL_HANDLER.Stats10.getMean();
    const stats100Mean = ROLL_HANDLER.Stats100.getMean(); 
    const stats1000Mean = ROLL_HANDLER.Stats1000.getMean();  
    
    const stats10variance = ROLL_HANDLER.Stats10.getVariance();
    const stats100variance = ROLL_HANDLER.Stats10.getVariance();
    const stats1000variance = ROLL_HANDLER.Stats10.getVariance();

    const stats10median = ROLL_HANDLER.Stats10.getMedian();
    const stats100median = ROLL_HANDLER.Stats10.getMedian();
    const stats1000median = ROLL_HANDLER.Stats10.getMedian();

    const stats10StdDev = ROLL_HANDLER.Stats10.getStandardDeviation();
    const stats100StdDev = ROLL_HANDLER.Stats10.getStandardDeviation();
    const stats1000StdDev = ROLL_HANDLER.Stats10.getStandardDeviation();

    $("#hit-count-roll-count").text(
      `${SESSION.hitCount}/${SESSION.sessionRollCount}`,
    )
    $("#win-rate-teo").text(
      `${SESSION.getWinRate().toFixed(2)}/${SESSION.getTeo().toFixed(2)}`,
    )
    $("#profit-loss").text(`${SESSION.getPL().toFixed(5)}`)

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

    $("#highHit-hit").text(`${highHits.highHit.hit}`).css({backgroundColor: highHits.highHit.hitDelta < 0 ? "red" : "transparent"})
    $("#highHit-remaining").text(`${highHits.highHit.rollsRemaining}`)
    $("#highHit-delta").text(`${highHits.highHit.hitDelta.toFixed(2)}`);

    $("#highHit50-hit").text(`${highHits.highHit50.hit}`).css({backgroundColor: highHits.highHit50.hitDelta < 0 ? "red" : "transparent"})
    $("#highHit50-remaining").text(`${highHits.highHit50.rollsRemaining}`)
    $("#highHit50-delta").text(`${highHits.highHit50.hitDelta.toFixed(2)}`);
    
    $("#highHit100-hit").text(`${highHits.highHit100.hit}`).css({backgroundColor: highHits.highHit100.hitDelta < 0 ? "red" : "transparent"})
    $("#highHit100-remaining").text(`${highHits.highHit100.rollsRemaining}`)
    $("#highHit100-delta").text(`${highHits.highHit100.hitDelta.toFixed(2)}`);;

    $("#highHit1000-hit").text(`${highHits.highHit1000.hit}`).css({backgroundColor: highHits.highHit1000.hitDelta < 0 ? "red" : "transparent"})
    $("#highHit1000-remaining").text(`${highHits.highHit1000.rollsRemaining}`)
    $("#highHit1000-delta").text(`${highHits.highHit1000.hitDelta.toFixed(2)}`);

    $("#highHit10000-hit").text(`${highHits.highHit10000.hit}`).css({backgroundColor: highHits.highHit10000.hitDelta < 0 ? "red" : "transparent"})
    $("#highHit10000-remaining").text(`${highHits.highHit10000.rollsRemaining}`)
    $("#highHit10000-delta").text(`${highHits.highHit10000.hitDelta.toFixed(2)}`);


    // Last 10 Rolls
    setColor("mean10", stats10Mean, stats100Mean - 1)
    setColor("variance10", ROLL_HANDLER.Stats10.getVariance(), 0.5)
    setColor("stddev10", ROLL_HANDLER.Stats10.getStandardDeviation(), 1)
    setColor("median10", ROLL_HANDLER.Stats10.getMedian(), 1.92)

    // Last 100 Rolls
    setColor("mean100", stats100Mean, stats1000Mean - 1)
    setColor("variance100", ROLL_HANDLER.Stats100.getVariance(), 0.5)
    setColor("stddev100", ROLL_HANDLER.Stats100.getStandardDeviation(), 1)
    setColor("median100", ROLL_HANDLER.Stats100.getMedian(), 1.92)

    // Last 1000 Rolls
    setColor("mean1000", ROLL_HANDLER.Stats1000.getMean(), 1.92)
    setColor("variance1000", ROLL_HANDLER.Stats1000.getVariance(), 0.5)
    setColor("stddev1000", ROLL_HANDLER.Stats1000.getStandardDeviation(), 1)
    setColor("median1000", ROLL_HANDLER.Stats1000.getMedian(), 1.92)

    $("#stats-title").css("color", ROLL_HANDLER.isWindUp() ? "red" : "white")
  }

  function evalHalts(result) {
    if (getRiskOn()) return

    if (!ROLL_HANDLER.isMicroTargetsPullBack()) return

    if (ROLL_HANDLER.isWindUpTight() && ROLL_HANDLER.isWindUp()) {
      const message = `🛑 Halt: Stats10 below threshold!`
      SESSION.stop(message, true)
      return
    }
  }

  function setMessage(message) {
    $("#message").html(message)
  }

  function getBalance() {
    let rawText = $(".ml-3 .font-extrabold").text().trim()
    return parseFloat(rawText.replace(/[^\d.]/g, ""))
  }

  function getPayout() {
    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Payout")',
    )
    const inputField = payoutFieldGroup.find("input")

    return Number(inputField.val())
  }

  function setPayout(amount) {
    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Payout")',
    )
    const inputField = payoutFieldGroup.find("input")

    if (inputField.length) {
      let nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set

      nativeSetter.call(inputField[0], amount) // Update input field value

      let event = new Event("input", {
        bubbles: true,
      })
      inputField[0].dispatchEvent(event)

      let reactEvent = new Event("change", {
        bubbles: true,
      })
      inputField[0].dispatchEvent(reactEvent) // React listens for change events

      // console.log(`Payout set to: ${amount}`);
    } else {
      console.error("Payout input field not found!")
    }
  }
  function getWager() {
    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Amount")',
    )
    const inputField = payoutFieldGroup.find("input")

    return Number(inputField.val())
  }

  /********************* Framework *********************/
  function defaultSession(rollHandler) {
    return {
      state: {
        stopped: true,
        reason: "",
      },
      losingStreak: 0,
      rollHandler: rollHandler,
      losingStreakTargetDelta: 0,
      hitCount: 0,
      sessionRollCount: 0,
      globalRollCount: 0,
      rollMode: "",
      stopOnExpectedHits: false,
      expectedHitsMaxRolls: 0,
      stopOnMaxRolls: false,
      payout: 0,
      wagerRatio: 0,
      profitLoss: 0,
      maxRolls: 0,
      expectedHitsMaxRolls: 0,
      selectedPayoutLSMultiplier: 0,
      minPayout: 0,
      shortLookback: 0,
      midLookback: 0,
      longLookback: 0,
      scoreThreshold: 0,
      stopOnWin: false,
      getWinRate() {
        return this.hitCount / this.sessionRollCount
      },
      getTeo() {
        return 1 / (this.payout * 1.05)
      },
      getPL() {
        return this.profitLoss
      },
      getIsEarlyHit() {
        return this.wagerRatio < 1
      },
      getWagerRatio() {
        return this.wagerRatio
      },
      getCurrentWinRate() {
        return this.hitCount / this.sessionRollCount
      },
      getGlobalRollCount: function () {
        return this.globalRollCount
      },
      getSessionRollCount: function () {
        return this.sessionRollCount
      },
      start: function (rollConfig) {
        this.reset()
        this.setRollConfigVariables(rollConfig)
        this.state.stopped = false
        this.losingStreakTargetDelta = 0
        this.profitLoss = 0
        this.expectedHits = 0
        this.expectedHitsMaxRolls = 0
      },
      reset: function () {
        this.state.stopped = true
        this.state.reason = ""
        this.sessionRollCount = 0
        this.losingStreak = 0
        this.hitCount = 0
        this.wagerRatio = 1
      },
      isStopped: function () {
        return this.state.stopped
      },
      getStopReason: function () {
        return this.state.reason
      },
      isRunning: function () {
        return !this.isStopped()
      },
      addRoll: function (result, wager, rollConfig, isRiskOn) {
        this.setRollConfigVariables(rollConfig)

        this.sessionRollCount++
        this.globalRollCount++

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

        this.checkStopOnProfitTarget(result)
        this.checkStopOnHitCount()
        this.checkStopOnMaxRolls()
        this.checkStopOnWatchTarget(result)
        this.checkStopOnExpectedHits()

        if (isRiskOn) return

        this.checkWindUpHalt();
        this.checkSelectedPayoutLosingStreak()
        this.checkScoreThreshold()
      },
      setRollConfigVariables(rollConfig) {
        this.watchTarget = rollConfig.watchTarget
        this.payout = rollConfig.payout
        this.maxRolls = rollConfig.maxRolls
        this.hitCountTarget = rollConfig.hitCountTarget
        this.payout = rollConfig.payout
        this.profitTarget = rollConfig.profitTarget
        this.rollMode = rollConfig.rollMode
        this.stopOnExpectedHits = rollConfig.stopOnExpectedHits
        this.selectedPayoutLSMultiplier = rollConfig.selectedPayoutLSMultiplier

        this.minPayout = rollConfig.minPayout
        this.shortLookback = rollConfig.shortLookback
        this.midLookback = rollConfig.midLookback
        this.longLookback = rollConfig.longLookback
        this.scoreThreshold = rollConfig.scoreThreshold
      },

        checkWindUpHalt() {
            if (!ROLL_HANDLER.isWindUp()) return;
        
            this.stop(`Wind up halt triggered`)
            return;
        },
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
      },

      checkScoreThreshold() {
        const targets = rollHandler.getTargetsExceedingScoreThreshold(
          this.minPayout,
          this.shortLookback,
          this.midLookback,
          this.longLookback,
          this.scoreThreshold
        )

        if (targets.length != 0) {
          const names = targets.map((t) => t.getPayout()).join(", ")
          const message = `🟡 The following targets exceeded win rate score threholds:\n\n${names}\n\n🛑 Session halted for review.`

          this.stop(message, true)
          return
        }
      },

      checkStopOnExpectedHits: function () {
        if (this.rollMode !== "expected-hits") return
        const expectedHits =
          (this.getTeo() / 100) * this.expectedHitsMaxRolls * 100

        if (this.stopOnExpectedHits) {
          if (this.hitCount >= expectedHits) {
            this.stop(
              `Target hit or exceeded expected hits: ${this.hitCount} / ${expectedHits.toFixed(2)} over ${this.sessionRollCount} rolls`,
            )
            return
          }
        }

        if (this.sessionRollCount >= this.expectedHitsMaxRolls) {
          this.stop(
            `Target hit max rolls during expected hits mode: ${this.hitCount} / ${expectedHits.toFixed(2)} over ${this.sessionRollCount} rolls`,
          )
          return
        }
      },

      checkStopOnHitCount: function (result) {
        if (this.hitCountTarget === 0) return

        if (this.hitCount < this.hitCountTarget) return

        this.stop(
          `Target ${this.payout} hit ${this.hitCount} times, Delta: (${this.losingStreakTargetDelta})`,
        )
      },
      checkStopOnWatchTarget: function (result) {
        if (this.watchTarget === 0) return

        if (result < this.watchTarget) return

        this.stop(`Watch target ${this.watchTarget} hit)`)
      },
      checkStopOnMaxRolls() {
        if (this.maxRolls === -1) return

        if (this.sessionRollCount >= this.maxRolls) {
          this.stop(`Stopped on max rolls ${this.sessionRollCount}`)
        }
      },
      checkStopOnProfitTarget() {
        if (this.profitTarget === 0) return

        if (this.profitLoss < this.profitTarget) return

        this.stop(
          `Stopped on profit target Profit Target: ${this.profitTarget}, Profit: ${this.profitLoss.toFixed(5)}`,
        )
      },
      stop(reason = "", notify = false) {
        this.state.reason = reason
        this.state.stopped = true
        console.log(reason)
        $("#message").html(reason)
        if (notify) this.notify()
      },
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
      },
    }
  }
  /* Configuration */
  function getRollConfig() {
    const payout = getPayout()
    const maxRolls = getMaxRolls()
    const hitCountTarget = getHitCountTarget()
    const watchTarget = getWatchTarget()
    const profitTarget = getProfitTarget()
    const selectedPayoutLSMultiplier = getSelectedPayoutLosingStreakMultiplier()
    const minPayout = getMinPayout()
    const shortLookback = getShortLookback()
    const midLookback = getMidLookback()
    const longLookback = getLongLookback()
    const scoreThreshold = getScoreThreshold();

    const rollMode = getRollMode()

    return {
      payout: payout,
      maxRolls: maxRolls,
      hitCountTarget: hitCountTarget,
      profitTarget: profitTarget,
      rollMode: rollMode,
      watchTarget: watchTarget,
      selectedPayoutLSMultiplier: selectedPayoutLSMultiplier,
      minPayout: minPayout,
      shortLookback: shortLookback,
      midLookback: midLookback,
      longLookback: longLookback,
      scoreThreshold: scoreThreshold,
    }
  }

  function getBaseWager() {
    return Number($("#base-wager").val())
  }


  function getRiskOn() {
    return $("#risk-on").prop("checked")
  }

  function getHitCountTarget() {
    return Number($("#hit-count-target").val())
  }

  function getWatchTarget() {
    return Number($("#watch-target").val())
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

  function getMinPayout() {
    return Number($("#min-payout").val())
  }

  function getShortLookback() {
    return Number($("#short-lookback").val())
  }

  function getMidLookback() {
    return Number($("#mid-lookback").val())
  }

  function getLongLookback() {
    return Number($("#long-lookback").val())
  }

  function getScoreThreshold() {
    return Number($("#score-threshold").val())
  }

  // Utility function: Get current roll data
  function getCurrentRollData() {
    return $(".grid.grid-auto-flow-column div span")
      .map(function () {
        return $(this).text()
      })
      .get()
  }

  // Function to start the betting process

  function startBetting() {
    $("#message").text("")
    SESSION.start(getRollConfig())
    doBet()
  }

  function stopBetting() {
    SESSION.stop()
  }

  function doInit() {
    observeRollChanges()
    initPrototypes()
    initUI()

    bindHotKeys()
  }

  function initUI() {
    $(document).ready(function () {
      $("#control-panel").draggable({
        containment: "window",
        scroll: false,
      })

      $("#statsPane").draggable({
        containment: "window",
        scroll: false,
      })
    })
  }

  function initWindowEvents() {
    $("#set-risk-on-btn").click(function () {
      setWager($("#base-wager").val())
      $("#risk-on").prop("checked", true)
      $("#roll-mode").val("full-target")
      $("#profit-target").val(0.01)
    })

    $("#set-risk-off-btn").click(function () {
      $("#risk-on").prop("checked", false)
      $("#roll-mode").val("none")
      setWager(0)
    })

    $("#double-wager-btn").click(function () {
      setWager(Math.min(1, getWager() * 2))
    })

    $("#half-wager-btn").click(function () {
      setWager(Math.max(0.0001, getWager() / 2))
    })

    $("#set-wager-btn").click(function () {
      setWager(Number($("#wager-amount").val()))
    })

    $("#start-betting-btn").click(function () {
      startBetting()
    })

    $("#stop-betting-btn").click(function () {
      stopBetting()
    })
  }

  function RollingStats(windowSize) {
    this.windowSize = windowSize
    this.values = [] // Store last N values
    this.mean = 0
    this.sumOfSquares = 0

    this.addValue = function (value) {
      this.values.push(value)

      if (this.values.length > this.windowSize) {
        let removed = this.values.shift() // Remove oldest value
        this.updateStats(-removed, removed) // Subtract old value from stats
      }

      this.updateStats(value, null) // Add new value to stats
    }

    this.updateStats = function (value, removed) {
      let count = this.values.length

      // Update Mean
      let oldMean = this.mean
      this.mean = this.values.reduce((sum, v) => sum + v, 0) / count

      // Update Variance (numerically stable formula)
      this.sumOfSquares = this.values.reduce(
        (sum, v) => sum + (v - this.mean) ** 2,
        0,
      )
    }

    this.getMean = function () {
      return this.mean
    }

    this.getVariance = function () {
      let count = this.values.length
      return count > 1 ? this.sumOfSquares / (count - 1) : 0
    }

    this.getStandardDeviation = function () {
      return Math.sqrt(this.getVariance())
    }

    this.getMedian = function () {
      if (this.values.length === 0) return null
      let sorted = [...this.values].sort((a, b) => a - b)
      let mid = Math.floor(sorted.length / 2)

      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid]
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
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

  function initRollHandler() {
    const payouts = [
      ...[1.5, 1.6, 1.7, 1.8, 1.9, 2, 3, 4, 5, 6, 7, 8, 9],
      ...Array.from(
        {
          length: 10,
        },
        (v, k) => 10 + k * 10,
      ),
    ]

    class RollingWindow {
      constructor(size, payout) {
        this.size = size
        this.payout = payout
        this.buffer = new Array(size).fill(null)
        this.index = 0
        this.count = 0
        this.sum = 0
      }

      push(result) {
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

      getRate(lastN = this.count) {
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

      getDeviation() {
        const expectedRate = 1 / this.payout
        return (this.getRate() - expectedRate) * this.count * 100
      }

    getSum(lastN = this.count) {
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
      getCount() {
        return this.count
      }
    }

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


    class Target {
      constructor(payout) {
        this.rollingWindow = new RollingWindow(Math.ceil(payout * 20), payout)
        this.payout = payout
        this.losingStreak = 0
        this.hitCount = 0
        this.rollCount = 0
      }

      addResult(result) {
        this.rollingWindow.push(result);

        if (result >= this.payout) {
          this.losingStreak = 0;
        } else {
          this.losingStreak++;
        }
      }

      getPayout() {
        return this.payout
      }

      isWinRateBelowTeo(lookback, threshold) {
        return this.getWinRatePercentOfTeo(lookback) < threshold
      }

      isWinRateChangeBelow(lookback, threshold) {
        return this.getWinRateChange(lookback) < -threshold
      }

      getWinRateChange(lookback) {
        const winRate = this.getWinRate(lookback)
        const teo = this.getTeo()
        return ((winRate - teo) / teo) * 100
      }

      isWinRateAboveTeo(lookback, threshold) {
        return this.getWinRatePercentOfTeo(lookback) > threshold
      }

      exceedsAllThresholds(
        shortLookback,
        midLookback,
        longLookback,
        scoreThreshold,
      ) {
        if (ROLL_HANDLER.rollCount < this.payout * 10) return false
          const ls = this.getLSRatioAbs();
          const short = this.getHitPoolDeviationScoreLookback(shortLookback);
          const mid = this.getHitPoolDeviationScoreLookback(midLookback);
          const long = this.getHitPoolDeviationScoreLookback(longLookback)
          const score = ((short + mid + long) / 3) * ls;
          return score < -scoreThreshold;
      }

      getLosingStreak() {
        return this.losingStreak;
      }

      losingStreakExceedsN(n) {
        return this.getLSRatioAbs() > n * this.getPayout()
      }

      getLSRatio() {
        return Math.floor(this.getLosingStreak() / this.payout)
      }

      getLSRatioAbs() {
        return Math.abs(this.getLSRatio())
      }

      getWinRatePercentOfTeo(lookback = 100) {
        return (this.getWinRate(lookback) / this.getTeo()) * 100
      }

      getTotalWinRate() {
        return this.hitCount / ROLL_HANDLER.rollCount
      }

      getWinRate(lookback = 10) {
        return this.rollingWindow.getRate()
      }

    getHitPoolDeviationScoreLookback(lookbackMultiplier = 500) {
      const lookback = Math.ceil(this.getPayout() * lookbackMultiplier)
      const teo = 1 / this.payout

      const windowSize = Math.min(lookback, this.rollingWindow.getCount())
      if (windowSize === 0) return 0

      const expected = windowSize * teo
      const actual = this.rollingWindow.getSum(windowSize) // actual hits over that window

      const balance = expected - actual
      const ratio = balance / expected

      const capped = Math.max(-1, Math.min(1, ratio)) // clamp to [-1, +1]
      return -capped * 100
    }

      getHitCount() {
        return this.hitCount
      }

      getTeoPercent(target) {
        return this.getTeo() * 100
      }

      getTeo() {
        return 1 / (this.payout * 1.05)
      }

    }

    class RollHandler {
      constructor(targets) {
        this.Stats10 = new RollingStats(10)
        this.Stats100 = new RollingStats(100)
        this.Stats1000 = new RollingStats(1000)

        this.targets = targets
        this.microTargets = this.targets.filter(
          (target) => target.getPayout() < 1.7,
        )
        this.lowTargets = this.targets.filter(
          (target) => target.getPayout() < 3,
        )
        this.midTargets = this.targets.filter(
          (target) => target.getPayout() >= 3 && target.getPayout() < 10,
        )
        this.highTargets = this.targets.filter(
          (target) => target.getPayout() >= 10,
        )
        this.highHits = new HighHits();
        this.rollCount = 0;
      }

      getTargets() {
        return this.targets
      }

      getMicroTargets() {
        return this.microTargets
      }

      getHighHits() {
        return this.highHits.getResults();
      }

      isMicroTargetsPullBack() {
        return (
          this.getMicroTargets().filter((target) =>
            target.losingStreakExceedsN(1),
          ).length > 0
        )
      }

    isWindUp() {
        if (this.rollCount < 100) return false

        const minStableStdDev = 10
        const mean10 = this.Stats10.getMean()
        const mean100 = this.Stats100.getMean()
        const median10 = this.Stats10.getMedian()
        const median100 = this.Stats100.getMedian()
        const median1000 = this.Stats1000.getMedian()
        const stdDev10 = this.Stats10.getStandardDeviation()
        const stdDev100 = this.Stats100.getStandardDeviation()

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
        if (this.rollCount < 100) return false

        const mean10 = this.Stats10.getMean()
        const median10 = this.Stats10.getMedian()
        const stdDev10 = this.Stats10.getStandardDeviation()
        const stdDev100 = this.Stats100.getStandardDeviation()
        const variance10 = this.Stats10.getVariance()

        return (
          stdDev10 < 0.1 &&
          variance10 < 0.5 &&
          mean10 < median10 * 1.25 &&
          median10 < 1.5
        )
      }

      getTargetsExceedingScoreThreshold(
        minPayout,
        shortLookback,
        midLookback,
        longLookback,
        scoreThreshold
      ) {
        if (ROLL_HANDLER.rollCount < longLookback) return []
        return this.targets.filter(
          (target) =>
            target.getPayout() >= minPayout &&
            target.exceedsAllThresholds(
              shortLookback,
              midLookback,
              longLookback,
              scoreThreshold
            ),
        )
      }

      addResult(result) {
        this.rollCount++
        this.highHits.addResult(result);
        this.targets.forEach((target) => {
          target.addResult(result)
        })

        this.Stats10.addValue(result)
        this.Stats100.addValue(result)
        this.Stats1000.addValue(result)
      }
    }

    // Initialize targets and link them efficiently
    const targets = payouts.map((payout) => new Target(payout))

    return new RollHandler(targets)
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

  function bindHotKeys() {
    $(document).on("keypress", function (e) {
      if (e.which === 122) {
        if (SESSION.isStopped()) {
          startBetting()
        } else {
          stopBetting()
        }
      }
    })
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async function doBet() {
    while (SESSION.isRunning()) {
      // Trigger the button click

      $(".button-brand:first").trigger("click")

      // Wait for 1 second (1000 ms) before clicking again
      await delay(10)

      // Stop condition check inside the loop
      if (SESSION.isStopped()) {
        return // Break the loop if stop is true
      }
    }
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

  // Observer to monitor roll changes in the grid
  let observer = null // Store observer globally

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
