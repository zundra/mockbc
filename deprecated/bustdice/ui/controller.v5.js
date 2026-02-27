// ==UserScript==
// @name         Bustadice Controller V5
// @namespace    http://tampermonkey.net/
// @version      2025-04-07
// @description  try to take over the world!
// @author       Zundra Daniel
// @match        https://bustadice.com/play
// @grant        none
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bc.game
// @require https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// ==/UserScript==

;(function () {
  "use strict"

  let lastRollSet = []
  let currentRollSet = []
  const rollEngine = initRollEngine()
  let newWindow = null

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
        return `<option value="${val}" ${
          val === 7 ? "selected" : ""
        }>${val}</option>`
      }).join("")}
      </select>
   </div>
   <h4>Win Rate Score Thresholds</h4>
   <div class="control-group">
      <label>Min Payout</label>
      <input type="number" id="min-payout" value="1.5" />
   </div>
   <div class="control-group">
      <label>Max Payout</label>
      <input type="number" id="max-payout" value="20" />
   </div>
   <div class="control-group">
      <label>Short WR Lookback</label>
      <select id="short-lookback">
      ${Array.from({ length: 5 }, (_, i) => {
        let val = 5 + i * 5
        return `<option value="${val}" ${
          val === 5 ? "selected" : ""
        }>${val}</option>`
      }).join("")}
      </select>
   </div>
   <div class="control-group">
      <label>Mid WR Lookback</label>
      <select id="mid-lookback">
      ${Array.from({ length: 5 }, (_, i) => {
        let val = 5 + i * 5
        return `<option value="${val}" ${
          val === 10 ? "selected" : ""
        }>${val}</option>`
      }).join("")}
      </select>
   </div>
   <div class="control-group">
      <label>Long WR Lookback</label>
      <select id="long-lookback">
      ${Array.from({ length: 5 }, (_, i) => {
        let val = 5 + i * 5
        return `<option value="${val}" ${
          val === 20 ? "selected" : ""
        }>${val}</option>`
      }).join("")}
      </select>
   </div>
   <div class="control-group">
      <label>Winrate Score Threshold</label>
      <select id="score-threshold">
      ${Array.from({ length: 10 }, (_, i) => {
        let val = 100 * (i + 1)
        return `<option value="${val}" ${
          val === 100 ? "selected" : ""
        }>${val}</option>`
      }).join("")}
      </select>
   </div>

         <div class="control-group">
      <label>Strength Threshold</label>
      <select id="strength-threshold">
      ${Array.from({ length: 10 }, (_, i) => {
        let val = 1 * (i + 1)
        return `<option value="${val}" ${
          val === 6 ? "selected" : ""
        }>${val}</option>`
      }).join("")}
      </select>
   </div>
</div>
    `

    // Append the control panel to the body
    $("body").append(html)
    initDraggable();
  })

  function evalResult(result) {
    rollEngine.sessionHandler.addResult(result, getWager(), getRollConfig(), getRiskOn())
  }

  // Utility function: Get current roll data
  function getCurrentRollData() {
    return Array.from(
      document.querySelectorAll("table tbody tr td:nth-child(4)"),
    ).map((cell) => cell.textContent.trim())
  }

  function doInit() {
    observeRollChanges()
    initPrototypes()
  }

  function initDraggable() {
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


  function getWager() {
    return 100
  }

  function getPayout() {
    return 1.98
  }

  function getRiskOn() {
    return $("#risk-on").prop("checked")
  }

  function getStrengthThreshold() {
    return Number($("#strength-threshold").val())
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
    return Number($("#min-payout").val());
  }

  function getMaxPayout() {
    return Number($("#max-payout").val());
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
        this.minPayout = 0
     this.maxPayout = 0
        this.shortLookback = 0
        this.midLookback = 0
        this.longLookback = 0
        this.scoreThreshold = 0
        this.strengthThreshold = 0
        this.stopOnWin = false
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
        this.checkStopOnWatchTarget(result)
        this.checkStopOnExpectedHits()

        if (!isRiskOn) {
          this.checkWindUpHalt()
          this.checkSelectedPayoutLosingStreak()
          this.checkStrengthThreshold()
          this.checkScoreThreshold();
        }
      }

      setRollConfigVariables(rollConfig) {
        this.watchTarget = rollConfig.watchTarget
        this.payout = rollConfig.payout
        this.maxRolls = rollConfig.maxRolls
        this.hitCountTarget = rollConfig.hitCountTarget
        this.profitTarget = rollConfig.profitTarget
        this.rollMode = rollConfig.rollMode
        this.stopOnExpectedHits = rollConfig.stopOnExpectedHits
        this.selectedPayoutLSMultiplier = rollConfig.selectedPayoutLSMultiplier
        this.minPayout = rollConfig.minPayout
        this.maxPayout = rollConfig.maxPayout
        this.shortLookback = rollConfig.shortLookback
        this.midLookback = rollConfig.midLookback
        this.longLookback = rollConfig.longLookback
        this.scoreThreshold = rollConfig.scoreThreshold
        this.strengthThreshold = rollConfig.strengthThreshold
      }

      checkWindUpHalt() {
        if (!this.isWindUp()) return
        this.stop(`Wind up halt triggered`)
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
          this.minPayout,
          this.maxPayout,
          -this.strengthThreshold)

        if (results.length !== 0) {
          const names = results.map((t) => t.getPayout()).join(", ")
          const message = `🟡 The following targets exceeded strength threshold:\n\n${names}\n\n🛑 Session halted for review.`
          this.stop(message, true)
        }
      }

      checkScoreThreshold() {
        const results = this.getTargetsExceedingRiskScoreThreshold(
          this.minPayout,
          this.maxPayout,
          -this.scoreThreshold
        )

        if (results.length !== 0) {
          const names = results.map((t) => t.getPayout()).join(", ")
          const message = `🟡 The following targets exceeded risk score thresholds:\n\n${names}\n\n🛑 Session halted for review.`
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

      checkStopOnWatchTarget(result) {
        if (this.watchTarget === 0) return
        if (result < this.watchTarget) return

        this.stop(`Watch target ${this.watchTarget} hit)`)
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

    getTargetsExceedingStrengthThreshold(minPayout, maxPayout, threshold) {
      if (this.rollCount < 100) return []
      return targets.filter(
        (target) =>
          target.getPayout() >= minPayout &&
          target.getPayout() <= maxPayout &&
          target.exceedsStrengthThreshold(threshold)
      )
    }

    


    getTargetsExceedingRiskScoreThreshold(minPayout, maxPayout, threshold) {
      if (this.rollCount < 100) return []
      return targets.filter(
        (target) =>
          target.getPayout() >= minPayout &&
          target.getPayout() <= maxPayout &&
          target.exceedsRiskScoreThreshold(threshold)
      )
    }

          stop(reason = "", notify = false) {
        this.state.reason = reason
        this.state.stopped = true
        console.log(reason)
        $("#message").html(reason)
        document.querySelector(".btn.btn-danger")?.click()
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

        losingStreakExceedsN = (n) => this.getLSRatioAbs() > n * this.stats.getPayout()

 getStrengthScaled = () =>
    this.applyPercentChange(
      this.getStrength(),
      this.averageWinRatePercentOfTeo()
    );

  averageWinRatePercentOfTeo() {
    const data = this.getWinRatePercentsOfTeo();
    const len = data.length;

    return data.reduce((a, b) => a + b, 0) / len;
  }
  
  applyPercentChange(value, percent) {
    return value * (1 + (100 - percent) / 100);
  }


    applyCompoundChange(value, percent, steps) {
      const factor = 1 + percent / 100;
      return value * Math.pow(factor, steps);
    }

    getStrengthThreshold(threshold) {
      return this.applyCompoundChange(
        threshold,
        this.getWinRatePercentOfTeo(),
        1
      );
    }
        getWinRatePercentsOfTeo = () => {
          return this.getLookbacks().map((lookback) =>
            this.getWinRatePercentOfTeo(lookback),
          )
        }

        getRiskScore () {
        const shortLookback = this.getShortLookback();
        const midLookback = this.getMidLookback();
        const longLookback = this.getLongLookback();
        const shortScore = this.getHitPoolDeviationScoreLookback(shortLookback);
        const midScore = this.getHitPoolDeviationScoreLookback(midLookback);
        const longScore = this.getHitPoolDeviationScoreLookback(longLookback);
        const stdDevScores = [shortScore, midScore, longScore];
        const streak = this.getStreak();
        const scoreAvg = ((shortScore + midScore + longScore) / 3);
        return scoreAvg;

        }

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

        exceedsStrengthThreshold = (threshold) => {
          if (this.getRollCount() < this.payout * 10) return false
          const strength = this.getStrengthScaled()
          return strength < threshold
        }

        exceedsRiskScoreThreshold = (threshold) => {
          if (this.getRollCount() < this.payout * 10) return false
          const riskScore = this.getRiskScore()
          return riskScore < threshold
        }


         getWinRatePercentOfTeoUIData() {
        const winRatePercentsOfTeo = this.getWinRatePercentsOfTeo();
        const riskScore = this.getRiskScore();

       let riskScoreBGColor = "transparent";

        if (riskScore > 100) {
          riskScoreBGColor = "green";
        } else if (riskScore < -100) {
          riskScoreBGColor = "red";
        }

        let idx = 0;

        return winRatePercentsOfTeo.map((wrpot) => {
          return {
            pot: wrpot,
            riskScore: riskScore,
            riskScoreBGColor: riskScoreBGColor,
            foregroundColor: "",
            backgroundColor: wrpot < 70 ? "red" : "transparent"
          };
        });
      }


      getStreakUIData() {
        const streak = this.getStreak();
        const pstreak = this.getPreviousStreak();
        const payout = this.getPayout();
        const good_m = 1.5;
        const bad_m = 3.0;
        const skew_e = 0.75;
        const teo = 1 / payout;
        const evd = (1 - teo) / teo;

        let foregroundColor = "";
        let backgroundColor = "";

        let greenThreshold = Math.max(
          5,
          Math.ceil((evd * good_m) / Math.pow(payout, skew_e))
        );

        let redThreshold = -Math.ceil(evd * bad_m * Math.pow(payout, skew_e));

        if (streak >= greenThreshold) {
          backgroundColor = "green";
        } else if (streak <= redThreshold) {
          backgroundColor = "red";
        } else {
          backgroundColor = "transparent";
        }

        foregroundColor = "white";

        if (backgroundColor === "transparent") {
          if (streak > 0) {
            if (streak + pstreak > payout) {
              foregroundColor = "green";
            } else {
              foregroundColor = "#AAAAAA"
            }

          } else {
            if (Math.abs(streak + pstreak) > payout) {
              foregroundColor = "red";
            } else {
              foregroundColor = "#AAAAAA"
            }
          }
        }

        return {
          value: streak,
          foregroundColor: foregroundColor,
          backgroundColor: backgroundColor
        };
      }

      getStrengthUIData() {
        const strength = this.getStrengthScaled();

        let foregroundColor = "transparent";
        let backgroundColor = "transparent";

        if (strength > 3) {
          backgroundColor = "green";
        } else if (strength < -3) {
          backgroundColor = "red";
        }

        return {
          value: strength,
          foregroundColor: foregroundColor,
          backgroundColor: backgroundColor,
        };
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
    const watchTarget = getWatchTarget()
    const profitTarget = getProfitTarget()
    const selectedPayoutLSMultiplier = getSelectedPayoutLosingStreakMultiplier()
    const minPayout = getMinPayout()
    const maxPayout = getMaxPayout()
    const shortLookback = getShortLookback()
    const midLookback = getMidLookback()
    const longLookback = getLongLookback()
    const scoreThreshold = getScoreThreshold()
    const strengthThreshold = getStrengthThreshold()

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
      maxPayout: maxPayout,
      shortLookback: shortLookback,
      midLookback: midLookback,
      longLookback: longLookback,
      scoreThreshold: scoreThreshold,
      strengthThreshold: strengthThreshold,
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
        this.updateTable()
        this.updateStats()
      }

      updateTable() {
        const MAX_STRENGTH_BLOCKS = 50
        const MAX_BLOCKS = 15
        const SCALE_FACTOR = 2 // ✅ 2 bars per 1 ratio unit
        const winRateContainer = getNewWindowHTMLNode("#winRateContainer")

        if (!winRateContainer || winRateContainer.length === 0) {
          console.error("Win rate container not found in new window!")
          return
        }

        // Ensure the table structure exists
        let table = winRateContainer.find(".win-rate-table")
        if (table.length === 0) {
          table = $("<table>").addClass("win-rate-table").append("<tbody>")
          winRateContainer.append(table)
        }

        this.targets.forEach((entry) => {
          const target = entry.getPayout()

          const winRatePercentsOfTeoUIData =
            entry.getWinRatePercentOfTeoUIData()
          const streakUIData = entry.getStreakUIData()
          const strengthUIData = entry.getStrengthUIData()

          const strength = strengthUIData.value
          const streak = streakUIData.value
          const riskScore = winRatePercentsOfTeoUIData[0].riskScore

          const winRateChangeShort = winRatePercentsOfTeoUIData[0].pot
          const winRateChangeMed = winRatePercentsOfTeoUIData[1].pot
          const winRateChangeLong = winRatePercentsOfTeoUIData[2].pot

          // const strength = entry.getStrength();

          const sanitizedTarget = `${target}`.replace(/\./g, "_")
          let row = table.find(`#row-${sanitizedTarget}`)

          if (row.length === 0) {
            row = $("<tr>")
              .addClass("win-rate-row")
              .attr("id", `row-${sanitizedTarget}`)

            const targetLabel = $("<td>")
              .addClass("win-rate-label")
              .text(`Target: ${target}`)

            const strengthContainer = $("<td>")
              .addClass("strength-col")
              .text(`${strength.toFixed(2)}`)
              .css({ backgroundColor: strengthUIData.backgroundColor })

            const wrpot0 = $("<span>")
              .addClass("win-rate-pot-0")
              .text(winRatePercentsOfTeoUIData[0].pot.toFixed(2))
              .css({
                backgroundColor: winRatePercentsOfTeoUIData[0].backgroundColor,
              })
            const wrpot1 = $("<span>")
              .addClass("win-rate-pot-1")
              .text(winRatePercentsOfTeoUIData[1].pot.toFixed(2))
              .css({
                backgroundColor: winRatePercentsOfTeoUIData[1].backgroundColor,
              })
            const wrpot2 = $("<span>")
              .addClass("win-rate-pot-2")
              .text(winRatePercentsOfTeoUIData[2].pot.toFixed(2))
              .css({
                backgroundColor: winRatePercentsOfTeoUIData[2].backgroundColor,
              })

            const winRatePercentOfTeoContainer = $("<td>")
              .append(wrpot0)
              .append("<span> | </span>")
              .append(wrpot1)
              .append("<span> | </span>")
              .append(wrpot2)

            const riskScoreContainer = $("<td>")
              .addClass("risk-score-col")
              .text(`${riskScore.toFixed(2)}`)
              .css({
                backgroundColor: winRatePercentsOfTeoUIData[0].riskScoreBGColor,
              })

            const blockContainer = $("<td>").addClass("streak-blocks").css({
              display: "flex",
              gap: "2px",
              minWidth: "250px",
            })

            const strengthMeterContainer = $("<td>")
              .addClass("strength-meter")
              .css({
                display: "flex",
                gap: "2px",
                minWidth: "100px",
                minHeight: "14px",
                justifyContent: "flex-start",
              })

            const winRateContainerShort = $("<td>")
              .addClass("win-rate-meter-short")
              .css({
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "120px",
                position: "relative",
              })

            const winRateContainerMed = $("<td>")
              .addClass("win-rate-meter-med")
              .css({
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "120px",
                position: "relative",
              })

            const winRateContainerLong = $("<td>")
              .addClass("win-rate-meter-long")
              .css({
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "120px",
                position: "relative",
              })

            row.append(
              targetLabel,
              strengthContainer,
              blockContainer,
              strengthMeterContainer,
              winRateContainerShort,
              winRateContainerMed,
              winRateContainerLong,
              winRatePercentOfTeoContainer,
              riskScoreContainer
            )
            table.append(row)
          }

          const blockContainer = row.find(".streak-blocks")
          const strengthContainer = row.find(".strength-col")
          const strengthMeterContainer = row.find(".strength-meter")
          const winRateContainerShort = row.find(".win-rate-meter-short")
          const winRateContainerMed = row.find(".win-rate-meter-med")
          const winRateContainerLong = row.find(".win-rate-meter-long")
          const blocks = blockContainer.find(".streak-block")
          const riskScoreContainer = row.find(".risk-score-col")

          const wrpot0 = row.find(".win-rate-pot-0")
          const wrpot1 = row.find(".win-rate-pot-1")
          const wrpot2 = row.find(".win-rate-pot-2")

          strengthContainer
            .text(`${strength.toFixed(2)}`)
            .css({ backgroundColor: strengthUIData.backgroundColor })

          wrpot0.text(winRateChangeShort.toFixed(2)).css({
            backgroundColor: winRatePercentsOfTeoUIData[0].backgroundColor,
          })
          wrpot1.text(winRateChangeMed.toFixed(2)).css({
            backgroundColor: winRatePercentsOfTeoUIData[1].backgroundColor,
          })
          wrpot2.text(winRateChangeLong.toFixed(2)).css({
            backgroundColor: winRatePercentsOfTeoUIData[2].backgroundColor,
          })

          if (blocks.length >= MAX_BLOCKS) {
            blocks.last().remove()
          }

          const needsNewBlock =
            entry.getStreakSignFlipped() || blocks.length === 0

          riskScoreContainer.text(`${riskScore.toFixed(2)}`).css({
            backgroundColor: winRatePercentsOfTeoUIData[0].riskScoreBGColor,
          })

          if (needsNewBlock) {
            const streakBlock = $("<div>")
              .addClass("streak-block")
              .css({
                backgroundColor: streakUIData.backgroundColor,
                color: streakUIData.foregroundColor,
                padding: "4px",
                margin: "1px",
                borderRadius: "4px",
                textAlign: "center",
                fontSize: "15px",
                fontWeight: "bold",
                minWidth: "30px",
              })
              .text(`${streak}`)

            blockContainer.prepend(streakBlock)
          } else {
            const firstBlock = blocks.first()
            firstBlock
              .css({
                backgroundColor: streakUIData.backgroundColor,
                color: streakUIData.foregroundColor,
              })
              .text(`${streak}`)
          }

          // **Ensure Strength Meter is Cleared and Updated**
          strengthMeterContainer.empty()

          let strengthBars = Math.abs(strength) * SCALE_FACTOR
          let fullBars = Math.floor(strengthBars)
          let fractionalPart = strengthBars - fullBars
          fullBars = Math.min(fullBars, MAX_STRENGTH_BLOCKS)

          // Render full bars
          for (let i = 0; i < fullBars; i++) {
            strengthMeterContainer.append(
              $("<div>")
                .addClass("strength-bar")
                .css({
                  width: "8px",
                  height: "14px",
                  backgroundColor: strength > 0 ? "lightgreen" : "red",
                  borderRadius: "2px",
                }),
            )
          }

          // Render the fractional bar (if any)
          if (fractionalPart > 0) {
            strengthMeterContainer.append(
              $("<div>")
                .addClass("strength-bar")
                .css({
                  width: `${fractionalPart * 8}px`, // Scale based on remainder
                  height: "14px",
                  backgroundColor: strength > 0 ? "lightgreen" : "red",
                  borderRadius: "2px",
                }),
            )
          }

          this.createWinRateBar(winRateContainerShort, winRateChangeShort)
          this.createWinRateBar(winRateContainerMed, winRateChangeMed)
          this.createWinRateBar(winRateContainerLong, winRateChangeLong)
        })
      }

      updateStats(rollHandler) {
        function setColor(id, value, threshold) {
          let $element = $("#" + id) // Select element with jQuery
          $element.text(value.toFixed(2)) // Update text
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
        setColor("median1000", stats1000Mean, 1.92)
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
    const row = document.querySelector("table tbody tr")
    if (!row || row.children.length < 4) return -1

    const outcomeCell = row.children[2] // 0-indexed
    const resultText = outcomeCell.textContent.trim()
    return Number(resultText.replace(/[x,]/g, ""))
  }

  // Observer for Bustadice "My Bets" table
  let observer = null

  function isMeTabActive() {
    const wrapper = document.querySelector('div[class*="wagerHistory"]')
    if (!wrapper) return false

    const tabs = wrapper.querySelector('div[class^="_tabs"]')
    if (!tabs) return false

    const meTab = Array.from(tabs.querySelectorAll("a")).find(
      (el) => el.textContent.trim().toLowerCase() === "me",
    )

    if (!meTab) return false

    return Array.from(meTab.classList).some((cls) =>
      cls.startsWith("_activeTab"),
    )
  }

  async function observeRollChanges() {
    const tableBody = await waitForSelector("#root table tbody")
    let previousRollData = getCurrentRollData()

    if (observer) observer.disconnect()

    observer = new MutationObserver((mutationsList) => {
      let result = getRollResult()

      if (result === -1 || result === NaN || !isMeTabActive()) return
      evalResult(result)
    })

    observer.observe(tableBody, {
      childList: true,
      subtree: true,
    })
  }

  function getNewWindowHTMLNode(hook) {
    return $(newWindow.document).find(hook)
  }

  function arraysAreEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false
    return arr1.every((value, index) => value === arr2[index])
  }

  async function fetchBTCPrice() {
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
      )
      const data = await res.json()
      return data.bitcoin.usd
    } catch (e) {
      console.error("Failed to fetch BTC price:", e)
      return 0
    }
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

  window.addEventListener("beforeunload", function () {
    if (newWindow && !newWindow.closed) {
      newWindow.close()
    }
  })

  window.addEventListener(
    "load",
    function () {
      ;(function () {
        // Open a new floating window with specified dimensions
        newWindow = window.open("", "", "width=800, height=1200")

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
      display: flex;
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
      .win-rate-table {
      width: 100%;
      border-collapse: collapse;
      border: none; /* ✅ Removes the ugly gray border */
      }
      .win-rate-row td {
      padding: 4px;
      vertical-align: middle;
      border: none; /* ✅ Removes individual cell borders */
      }
      .streak-blocks {
      display: flex;
      gap: 2px;
      min-width: 250px;
      }
      .strength-meter {
      display: flex;
      gap: 2px;
      min-width: 100px;
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
      <div id="winRateContainer">
         <table class="win-rate-table">
            <tbody>
            </tbody>
         </table>
      </div>
   </div>
   </div>
</body>
</html>
`

        // Write the content to the new window
        newWindow.document.write(htmlContent)
        newWindow.document.close()
      })()
    },
    false,
  )
  doInit()
})()
