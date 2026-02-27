/* Start Script */
// ==UserScript==
// @name         bc.game roller v13
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

  const RESULTS = [];
  const SESSION = defaultSession()
  let lastRollSet = []
  let currentRollSet = []
  let minStrengthObserved = 0
  const ROLL_HANDLER = initRollHandler(RESULTS)
  let RISK_ON_POOL = null;

  const Stats10 = new RollingStats(10)
  const Stats100 = new RollingStats(100)
  const Stats1000 = new RollingStats(1000)

  $(document).ready(function () {
    // Inject styles using jQuery
    $("<style>")
      .prop("type", "text/css")
      .html(
        `
            #stats-panel {
                position: fixed;
                top: 300px;
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
                top: 300px;
                left: 100px;
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

            #control-panel-header {
                background: #333;
                padding: 12px;
                font-weight: bold;
                text-align: center;
                border-radius: 8px 8px 0 0;
                font-size: 16px;
                cursor: grab;
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
              top: 500px;
              right: 100px;
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
              <!-- Draggable Stats Pane -->
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
      </div>
        <div id="control-panel">
            <div id="control-panel-header">⚙️ Control Panel</div>

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
                <label>Base Wager</label>
                <input type="number" id="base-wager" value="0.01" />
            </div>

            <div class="control-group">
                <label>Risk On</label>
                <input id="risk-on" type="checkbox"/>
            </div>
            <div class="control-group">
                <label>Stop On Profit</label>
                <input id="stop-on-profit" type="checkbox" />
            </div>

            <div class="control-group">
                <label>Profit Target</label>
                <input type="number" id="profit-target" value="0.0001" />
            </div>
            <div class="control-group">
                <label>Stop On Hit Count</label>
                <input id="stop-on-hit-count" type="checkbox" />
            </div>

            <div class="control-group">
                <label>Hit Count Target</label>
                <input type="number" id="hit-count-target" value="1" />
            </div>

            <div class="control-group">
                <label>Use Dynamic Wagering</label>
                <input id="use-dynamic-wagering" type="checkbox" />
            </div>

         <div class="control-group">
                <label>Stop On Pull Through Target</label>
                <input id="stop-on-pull-through-target" type="checkbox" />
            </div>

            <div class="control-group">
                <label>Pull Through Target</label>
                <input type="number" id="pull-through-target" value="100" />
            </div>

            <div class="control-group">
                <label>Roll Mode</label>

              <select id='roll-mode'>
                <option value="none">None</option>
                <option value="watch-mode">Watch</option>
                <option value="explicit">Explicit</option>
                <option value="full-target">Full Target</option>
                <option value="half-target">Half Target</option>
              </select>
            </div>

            <div class="control-group" id="watch-mode-control-wrapper" style="display: none">
                <label>Max Rolls</label>
                <input type="number" id="max-rolls" value="100" />
            </div>

        
            <div class="control-group" id="roll-over-multiplier-wrapper">
                <div class="control-group">
                    <label>Watch Mode Roll Over Multiplier</label>
                    <select id="watch-mode-roll-over-multiplier">
                        ${Array.from({ length: 10 }, (_, i) => {
                          let val = (i + 1)
                          return `<option value="${val}" ${val === 3 ? "selected" : ""}>${val}</option>`
                        }).join("")}
                    </select>
                </div>
            </div>



            <div class="control-group">
                <label>Stop On Miss</label>
                <input id="stop-on-miss" type="checkbox" />
            </div>


            <div class="control-group">
                <label>Long Streak Limit</label>
                <select id="long-streak-limit">
                    ${Array.from({ length: 10 }, (_, i) => {
                      let val = (i + 1)
                      return `<option value="${val}" ${val === 5 ? "selected" : ""}>${val}</option>`
                    }).join("")}
                </select>
            </div>

            <div class="control-group">
                <label>Stort Win Rate Lookback</label>
                <select id="short-win-rate-lookback">
                    ${Array.from({ length: 3 }, (_, i) => {
                      let val = (5 + (i * 5))
                      return `<option value="${val}" ${val === 5 ? "selected" : ""}>${val}</option>`
                    }).join("")}
                </select>
            </div>


            <div class="control-group">
                <label>Stort Win Rate Threshold</label>
                <select id="short-win-rate-threshold">
                    ${Array.from({ length: 10 }, (_, i) => {
                    let val = (50 + (i * 10))
                      return `<option value="${val}" ${val === 50 ? "selected" : ""}>${val}</option>`
                    }).join("")}
                </select>
            </div>


            <div class="control-group">
                <label>Long Win Rate Lookback</label>
                <select id="long-win-rate-lookback">
                    ${Array.from({ length: 3 }, (_, i) => {
                      let val = (5 + (i * 5))
                      return `<option value="${val}" ${val === 10 ? "selected" : ""}>${val}</option>`
                    }).join("")}
                </select>
            </div>


            <div class="control-group">
                <label>Long Win Rate Threshold</label>
                <select id="long-win-rate-threshold">
                    ${Array.from({ length: 10 }, (_, i) => {
                    let val = (50 + (i * 10))
                      return `<option value="${val}" ${val === 90 ? "selected" : ""}>${val}</option>`
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
    SESSION.addRoll(result, getWager(), getRollConfig())
    ROLL_HANDLER.addResult(result)

    updateStats()
    evalHalts()
  }

  function updateStats() {
    RISK_ON_POOL.maintain()
    function setColor(id, value, threshold) {
      let $element = $("#" + id) // Select element with jQuery
      $element.text(value.toFixed(2)) // Update text
      $element.css("color", value < threshold ? "red" : "white") // Apply color conditionally
    }

    $("#hit-count-roll-count").text(
      `${SESSION.hitCount}/${SESSION.sessionRollCount}`,
    )
    $("#win-rate-teo").text(
      `${SESSION.getWinRate().toFixed(2)}/${SESSION.getTeo().toFixed(2)}`,
    )
    $("#profit-loss").text(`${SESSION.getPL().toFixed(5)}`)

    $("#mean10").text(Stats10.getMean().toFixed(2))
    $("#variance10").text(Stats10.getVariance().toFixed(2))
    $("#stddev10").text(Stats10.getStandardDeviation().toFixed(2))
    $("#median10").text(Stats10.getMedian().toFixed(2))

    $("#mean100").text(Stats100.getMean().toFixed(2))
    $("#variance100").text(Stats100.getVariance().toFixed(2))
    $("#stddev100").text(Stats100.getStandardDeviation().toFixed(2))
    $("#median100").text(Stats100.getMedian().toFixed(2))

    $("#mean1000").text(Stats1000.getMean().toFixed(2))
    $("#variance1000").text(Stats1000.getVariance().toFixed(2))
    $("#stddev1000").text(Stats1000.getStandardDeviation().toFixed(2))
    $("#median1000").text(Stats1000.getMedian().toFixed(2))

    // Last 10 Rolls
    setColor("mean10", Stats10.getMean(), Stats100.getMean() - 1)
    setColor("variance10", Stats10.getVariance(), 0.5)
    setColor("stddev10", Stats10.getStandardDeviation(), 1)
    setColor("median10", Stats10.getMedian(), 1.92)

    // Last 100 Rolls
    setColor("mean100", Stats100.getMean(), Stats1000.getMean() - 1)
    setColor("variance100", Stats100.getVariance(), 0.5)
    setColor("stddev100", Stats100.getStandardDeviation(), 1)
    setColor("median100", Stats100.getMedian(), 1.92)

    // Last 1000 Rolls
    setColor("mean1000", Stats1000.getMean(), 1.92)
    setColor("variance1000", Stats1000.getVariance(), 0.5)
    setColor("stddev1000", Stats1000.getStandardDeviation(), 1)
    setColor("median1000", Stats1000.getMedian(), 1.92)

    $("#stats-title").css("color", isWindUp() ? "red" : "white")
  }

  function evalHalts(result) {
    if (getRiskOn()) return



const filteredRiskOnTargets = RISK_ON_POOL.getOverlappingTargets();

if (filteredRiskOnTargets.length > 0) {
    const names = filteredRiskOnTargets.map(t => t.getPayout()).join(", ");
    const message = `🟡 Risk-On Signal Triggered!\nThe following targets exceeded thresholds:\n\n${names}\n\n🛑 Session halted for review.`;

    SESSION.stop(message, true);
    return;
}


    if (isWindUpTight() && isWindUp()) {
      const mean100 = Stats100.getMean()
      const mean1000 = Stats100.getMean()
      const meanDiff = (mean1000 + mean100) / 2

      const message = `🛑 Halt: Stats10 below threshold!
            - Mean: ${Stats10.getMean().toFixed(2)} (Expected: ${Stats100.getMean().toFixed(2)})
            - Variance: ${Stats10.getVariance().toFixed(2)}
            - Std Dev: ${Stats10.getStandardDeviation().toFixed(2)}
            - Median: ${Stats10.getMedian().toFixed(2)}
            - Mean 100/1000 Avg: ${mean1000.toFixed(2)}`

      SESSION.stop(message, true)
      return
    }
  }

  function isWindUpTight() {
    if (SESSION.globalRollCount < 100) return false

    const mean10 = Stats10.getMean()
    const median10 = Stats10.getMedian()
    const stdDev10 = Stats10.getStandardDeviation()
    const stdDev100 = Stats100.getStandardDeviation()
    const variance10 = Stats10.getVariance()

    return (
      stdDev10 < 0.1 &&
      variance10 < 0.5 &&
      mean10 < median10 * 1.25 &&
      median10 < 1.5
    )
  }

  function isWindUp() {
    if (SESSION.globalRollCount < 100) return false

    const minStableStdDev = 10

    const mean10 = Stats10.getMean()
    const mean100 = Stats100.getMean()
    const median10 = Stats10.getMedian()
    const stdDev10 = Stats10.getStandardDeviation()
    const stdDev100 = Stats100.getStandardDeviation()

    return (
      stdDev100 < minStableStdDev && // Environment is not chaotic
      stdDev10 < stdDev100 * 0.75 && // Compression happening
      mean10 < mean100 * 0.75 && // Payout suppression
      mean10 < median10 * 1.25 // No big outliers skewing mean
    )
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
  function defaultSession() {
    return {
      state: {
        stopped: true,
        reason: "",
      },
      losingStreak: 0,
      losingStreakTargetDelta: 0,
      hitCount: 0,
      sessionRollCount: 0,
      globalRollCount: 0,
      stopOnMiss: false,
      rollMode: "",
      watchModeRollCount: 0,
      watchModeStopOnExpectedHits: false,
      stopOnExpectedHits: false,
      expectedHitsMaxRolls: 0,
      stopOnMaxRolls: false,
      watchModeRollOverMultiplier: 0,
      watchModeMaxrolls: 0,
      watchModeStreak: 0,
      payout: 0,
      wagerRatio: 0,
      profitLoss: 0,
      maxRolls: 0,
      stopOnWin: false,
      addRoll: function (result, wager, rollConfig) {
        this.payout = rollConfig.payout
        this.maxRolls = rollConfig.maxRolls
        this.stopOnHitCount = rollConfig.stopOnHitCount
        this.hitCountTarget = rollConfig.hitCountTarget
        this.payout = rollConfig.payout
        this.profitTarget = rollConfig.profitTarget
        this.stopOnMiss = rollConfig.stopOnMiss
        this.rollMode = rollConfig.rollMode
        this.stopOnProfit = rollConfig.stopOnProfit
        this.stopOnExpectedHits = rollConfig.stopOnExpectedHits;
        this.expectedHitsMaxRolls = rollConfig.watchModeMaxrolls;
        this.watchModeRollOverMultiplier = rollConfig.watchModeRollOverMultiplier;


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
        this.checkStopOnMiss(result)
        this.checkStopOnHitCount()
        this.checkStopOnMaxRolls()
        this.checkStopOnWatchMode(result)
        this.checkStopOnPullThroughTarget(result)
        this.checkStopOnExpectedHits();
      },
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
        this.state.stopped = false
        this.payout = rollConfig.payout
        this.maxRolls = rollConfig.maxRolls
        this.stopOnHitCount = rollConfig.stopOnHitCount
        this.hitCountTarget = rollConfig.hitCountTarget
        this.payout = rollConfig.payout
        this.profitTarget = rollConfig.profitTarget
        this.stopOnProfit = rollConfig.stopOnProfit
        this.stopOnMiss = rollConfig.stopOnMiss
        this.rollMode = rollConfig.rollMode
        this.losingStreakTargetDelta = 0
        this.watchModeStreak = 0;
        this.watchModeRollCount  = 0;
        this.profitLoss = 0
        this.expectedHits = 0;
        this.stopOnPullThroughTarget = rollConfig.stopOnPullThroughTarget
        this.pullThroughTarget = rollConfig.pullThroughTarget
        this.watchModeRollOverMultiplier = rollConfig.watchModeRollOverMultiplier;

        if (this.isWatchMode()) {
            this.watchModeMaxrolls = Math.floor(this.watchModeRollOverMultiplier * this.payout)
        }
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
      checkStopOnWatchMode: function (result) {
        if (!this.isWatchMode()) return


        if (result >= this.payout) {
            const diff = Math.ceil(this.payout - this.watchModeStreak);
            
            // if (diff > 0) {
            //     this.watchModeMaxrolls += diff;
            // } else if (this.watchModeMaxrolls > Math.floor(this.watchModeRollOverMultiplier * this.payout)) {
            //     this.watchModeMaxrolls += diff;
            // }
            this.watchModeStreak = 0;
            this.watchModeRollCount = 0;
        } else {
            this.watchModeStreak++;
            this.watchModeRollCount++;            
        }

        console.log("this.watchModeRollCount", this.watchModeRollCount, "this.watchModeMaxrolls", this.watchModeMaxrolls)

        if (this.watchModeRollCount >= this.watchModeMaxrolls) {
          this.stop(
            `Target hit max rolls during watch mode: ${this.watchModeRollCount} rolls`,
          )
          return
        }
      },

      checkStopOnExpectedHits: function () {
        if (this.rollMode !== "expected-hits") return
        const expectedHits =
          (this.getTeo() / 100) * this.watchModeMaxrolls * 100

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

      checkStopOnMiss: function () {
        if (!this.stopOnMiss || this.losingStreak < this.payout) return
        this.stop(
          `Target missed during cycle with LS greater $ {this.losingStreak} than payout $ {this.payout}`,
        )
      },
      checkStopOnHitCount: function (result) {
        if (!this.stopOnHitCount) return

        if (this.hitCount < this.hitCountTarget) return

        this.stop(
          `Target ${this.payout} hit ${this.hitCount} times, Delta: (${this.losingStreakTargetDelta})`,
        )
      },
      checkStopOnPullThroughTarget: function (result) {
        if (!this.stopOnPullThroughTarget) return

        if (result < this.pullThroughTarget) return

        this.stop(`Pull through target ${this.pullThroughTarget} hit)`)
      },
      checkStopOnMaxRolls() {
        if (this.maxRolls === -1) return

        if (this.sessionRollCount >= this.maxRolls) {
          this.stop(`Stopped on max rolls ${this.sessionRollCount}`)
        }
      },
      checkStopOnProfitTarget() {
        if (!this.stopOnProfit) return

        if (this.profitLoss < this.profitTarget) return

        this.stop(
          `Stopped on profit target Profit Target: ${this.profitTarget}, Profit: ${this.profitLoss.toFixed(5)}`,
        )
      },
      isWatchMode() {
        return (this.rollMode === "watch-mode");
      },
      stop(reason = "", notify = false) {
        this.state.reason = reason
        this.state.stopped = true
        console.log(reason);
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
    const stopOnHitCount = getStopOnHitCount()
    const hitCountTarget = getHitCountTarget()
    const stopOnProfit = getStopOnProfit()
    const pullThroughTarget = getPullThroughTarget()
    const stopOnPullThroughTarget = getStopOnPullThroughTarget()
    const profitTarget = getProfitTarget()

    const stopOnMiss = getStopOnMiss()
    const rollMode = getRollMode()
    const watchModeStopOnExpectedHits = getStopWatchModeOnHits()
    const watchModeRollOverMultiplier = getWatchModeRollOverMultiplier()

    return {
      payout: payout,
      maxRolls: maxRolls,
      stopOnHitCount: stopOnHitCount,
      hitCountTarget: hitCountTarget,
      stopOnProfit: stopOnProfit,
      profitTarget: profitTarget,
      stopOnMiss: stopOnMiss,
      rollMode: rollMode,
      watchModeRollOverMultiplier: watchModeRollOverMultiplier,
      watchModeStopOnExpectedHits: watchModeStopOnExpectedHits,
      stopOnPullThroughTarget: stopOnPullThroughTarget,
      pullThroughTarget: pullThroughTarget,
    }
  }

  function getBaseWager() {
    return Number($("#base-wager").val())
  }

  function getRiskOn() {
    return $("#risk-on").prop("checked")
  }

  function getStopOnHitCount() {
    return $("#stop-on-hit-count").prop("checked")
  }

  function getHitCountTarget() {
    return Number($("#hit-count-target").val())
  }

  function getStopOnPullThroughTarget() {
    return $("#stop-on-pull-through-target").prop("checked")
  }

  function getPullThroughTarget() {
    return Number($("#pull-through-target").val())
  }

  function getWatchModeRollOverMultiplier() {
    return Number($("#watch-mode-roll-over-multiplier").val())
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

  function getStopWatchModeOnHits() {
    return $("#watch-mode-stop-on-expected-hits").prop("checked")
  }

  function getStopOnProfit() {
    return $("#stop-on-profit").prop("checked")
  }

  function getProfitTarget() {
    return Number($("#profit-target").val())
  }

  function getStopOnMiss() {
    return $("#stop-on-miss").prop("checked")
  }

  function getLongStreakLimit() {
    return Number($("#long-streak-limit").val())
  }

  function getShortWinRateThreshold() {
    return Number($("#short-win-rate-threshold").val())
  }

  function getShortWinRateLookback() {
    return Number($("#short-win-rate-lookback").val())
  }

  function getLongWinRateThreshold() {
    return Number($("#long-win-rate-threshold").val())
  }

  function getLongWinRateLookback() {
    return Number($("#long-win-rate-lookback").val())
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
    RISK_ON_POOL = initRiskOnPool();
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
        $("#stop-on-profit").prop("checked", true)
    })

    $("#roll-mode").change(function () {
      if ($(this).val() === "watch-mode") {
        $("#watch-mode-control-wrapper").show()
      } else {
        $("#watch-mode-control-wrapper").hide()
      }
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

  function initRollHandler(results) {
    const payouts = [
      ...[1.5, 1.6, 1.7, 1.8, 1.9, 2, 3, 4, 5, 6, 7, 8, 9],
      ...Array.from(
        {
          length: 10,
        },
        (v, k) => 10 + k * 10,
      ),
    ]

    class Target {
      constructor(payout, results) {
        this.results = results;
        this.payout = payout
        this.streak = 0
        this.pstreak = 0
        this.hitCount = 0
        this.rollCount = 0
      }

      getPayout() {
        return this.payout
      }

      addResult(result) {
        this.rollCount++
        this.updateStreak(result)
      }

      updateStreak(result) {
        if (result >= this.payout) {
          this.hitCount++
          if (this.streak < 0) this.pstreak = this.streak
          this.streak = Math.max(this.streak + 1, 1)
        } else {
          if (this.streak > 0) this.pstreak = this.streak
          this.streak = Math.min(this.streak - 1, -1)
        }
      }

      isWinRateBelowTeo(lookback, threshold) {
        return this.getWinRatePercentOfTeo(lookback) < threshold
      }

      isWinRateAboveTeo(lookback, threshold) {
        return this.getWinRatePercentOfTeo(lookback) > threshold
      }

      getStreak() {
        return this.streak
      }

      getLosingStreak() {
        return this.streak < 0 ? this.streak : 0
      }

      losingStreakExceedsN(n) {
        return this.getLSRatioAbs() > (n * this.getPayout());
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
        return this.hitCount / this.rollCount;
    }

    getWinRate(lookback = 10) {
        // Use total if:
        // - Results aren't long enough for smoothing
        // - Payout is large enough to favor longer horizon anyway
        if (
            this.results.length < Math.floor(this.payout * 5) ||
            lookback > this.results.length
        ) {
            return this.getTotalWinRate();
        }

        // Aggregate recent results
        const recent = this.results.slice(-lookback * this.payout);
        const hits = recent.filter(result => result >= this.payout).length;

        return hits / (lookback * this.payout);
    }

      getHitCount() {
        return this.hitCount
      }

      getRollCount() {
        return this.rollCount
      }

      getTeoPercent(target) {
        return this.getTeo() * 100
      }

      getTeo() {
        return 1 / (this.payout * 1.05)
      }

      getStrength() {
        return Math.ceil(this.payout + this.streak) / this.payout
      }
    }

    class RollHandler {
      constructor(targets, results) {
        this.targets = targets
        this.results = results;
      }

      getTargets() {
        return this.targets
      }

      getFilterTargets() {
        return this.targets.filter(target => target.payout >= 3)
      }

      addResult(result) {
        Stats10.addValue(result)
        Stats100.addValue(result)
        Stats1000.addValue(result)
        RESULTS.push(result);

        if (RESULTS.length === 100) RESULTS.shift();

        this.targets.forEach((target) => {
          target.addResult(result)
        })
      }
    }

    // Initialize targets and link them efficiently
    const targets = payouts.map((payout) => new Target(payout, results));

    return new RollHandler(targets, results)
  }

  function initRiskOnPool() {
    class SignalFilter {
      constructor(name, predicate) {
        this.name = name
        this.predicate = predicate // (target) => true/false
        this.targets = new Set() // Holds current matching targets
      }

      update(targets) {
        const nextSet = new Set()

        targets.forEach((target) => {
          if (this.predicate(target)) {
            nextSet.add(target)
            if (!this.targets.has(target)) {
              this.onAdd?.(target)
            }
          } else if (this.targets.has(target)) {
            this.onRemove?.(target)
          }
        })

        this.targets = nextSet
      }

      getTargets() {
        return Array.from(this.targets)
      }

      intersectsWith(otherFilter) {
        return Array.from(this.targets).filter((t) =>
          otherFilter.targets.has(t),
        )
      }
    }

    class RiskOnPool {
      constructor(rollHandler, shortLookback, shortThreshold, longLookback, longThreshold, streakLimit) {
        this.rollHandler = rollHandler
        this.shortLookback = shortLookback
        this.shortThreshold = shortThreshold
        this.longLookback = longLookback
        this.longThreshold = longThreshold
        this.streakLimit = streakLimit

        this.filters = {
          belowWinRateShort: new SignalFilter("belowWinRateShort", (target) =>
            target.isWinRateBelowTeo(this.shortLookback, this.shortThreshold),
          ),
          belowWinRateLong: new SignalFilter("belowWinRateLong", (target) =>
            target.isWinRateBelowTeo(this.longLookback, this.longThreshold),
          ),
          longStreak: new SignalFilter("longStreak", (target) =>
            target.losingStreakExceedsN(this.streakLimit),
          ),
          // Add more filters here as needed
        }
      }

      updateAllFilters() {
        Object.values(this.filters).forEach((filter) => {
          filter.update(this.rollHandler.getFilterTargets())
        })
      }

      getOverlappingTargets() {
        const i = this.getIntersection(["belowWinRateShort", "belowWinRateLong", "longStreak"])

        return i;
      }

        getIntersection(filterNames) {
            if (filterNames.length === 0) return [];

            const sets = filterNames.map(name => this.filters[name]?.targets || new Set());
            const [first, ...rest] = sets;

            return [...first].filter(target =>
                rest.every(set => set.has(target))
            );
        }


      maintain() {
        this.updateAllFilters()
      }
    }
    return new RiskOnPool(ROLL_HANDLER, getShortWinRateLookback(), getShortWinRateThreshold(), getLongWinRateLookback(), getLongWinRateThreshold(), getLongStreakLimit())
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

