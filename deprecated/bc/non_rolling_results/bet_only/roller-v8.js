/* Start Script */
// ==UserScript==
// @name         bc.game roller v8
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

    const SESSION = defaultSession()

    let lastRollSet = []
    let currentRollSet = []
    let currentRiskOnTarget = null
    let ROLL_HANDLER = initRollHandler()

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
        `,
        )
            .appendTo("head")

        // Define the control panel HTML
        let html = `
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
                <input type="number" id="base-wager" value="0.5" />
            </div>

            <div class="control-group">
                <label>Risk On</label>
                <input id="risk-on" type="checkbox"/>
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
                <label>Stop On Pull Through Target</label>
                <input id="stop-on-pull-through-target" type="checkbox" />
            </div>

            <div class="control-group">
                <label>Pull Through Target</label>
                <input type="number" id="pull-through-target" value="100" />
            </div>

            <div class="control-group">
                <label>Roll Mode</label>

              <select id='roll-mode'-rolls'>
                <option value="none">None</option>
                <option value="watch-mode">Watch</option>
                <option value="explicit">Explicit</option>
                <option value="full-target">Full Target</option>
                <option value="half-target">Half Target</option>
              </select>
            </div>

            <div id="watch-mode-control-wrapper" style="display: none;">
                <div class="control-group">
                    <label>Stop Watch Mode On Expected Hits</label>
                    <input id="watch-mode-stop-on-expected-hits" type="checkbox"/>
                </div>

                <div class="control-group">
                    <label>Watch Mode Max Rolls</label>
                    <input type="number" id="watch-mode-max-rolls" value="100" />
                </div>
            </div>

            <div class="control-group" id="max-rolls-wrapper" style="display: none;">
                <label>Max Rolls</label>
                <input type="number" id="max-rolls" value="1000" />
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
                <label>Stop On Miss</label>
                <input id="stop-on-miss" type="checkbox" />
            </div>

            <div class="control-group">
                <label>Reduce On Hit</label>
                <input id="reduce-on-hit" type="checkbox" />
            </div>

            <div class="control-group">
                <label>Stop Ratio</label>
                <select id="stop-ratio">
                    ${Array.from({ length: 10 }, (_, i) => {
                        let val = (i + 1) * 1
                        return `<option value="${val}" ${val === 9 ? "selected" : ""}>${val}</option>`
                    }).join("")}
                </select>
            </div>

          <div class="control-group">
                <label>Cluster Stop Ratio</label>
                <select id="cluster-stop-ratio">
                    ${Array.from({ length: 10 }, (_, i) => {
                        let val = (i + 1) * 1
                        return `<option value="${val}" ${val === 4 ? "selected" : ""}>${val}</option>`
                    }).join("")}
                </select>
            </div>

     <div class="control-group">
                <label>Min Strength Cluster Size</label>
                <select id="min-strength-clusters">
                    ${Array.from({ length: 5 }, (_, i) => {
                        let val = (i + 1) * 1
                        return `<option value="${val}" ${val === 4 ? "selected" : ""}>${val}</option>`
                    }).join("")}
                </select>
            </div>

            <div class="control-group">
                <label>Strength Ratio</label>
                <select id="strength-percent-limit">
                    ${Array.from({ length: 10 }, (_, i) => {
                        let val = parseFloat(((i + 1) *  0.1).toFixed(1))
                        return `<option value="${val}"}>${val}</option>`
                    }).reverse().join("")}
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

        if (getReduceOnHit() && SESSION.getIsEarlyHit()) {
            adjustWager()
        }
        updateUI();
        evalHalts()
    }

    function updateUI() {
        $("#hit-count-roll-count").text(`${SESSION.hitCount}/${SESSION.sessionRollCount}`)
        $("#win-rate-teo").text(`${SESSION.getWinRate().toFixed(2)}/${SESSION.getTeo().toFixed(2)}`)
        $("#profit-loss").text(`${SESSION.getPL().toFixed(5)}`)
    }

    function adjustWager() {
        if (getWager() === 0) return;

        let wager = Math.max(0.0001, getWager() * SESSION.getWagerRatio())
        setWager(wager)
    }

    function evalHalts(result) {
        if (getRiskOn()) return;

        const haltTarget = ROLL_HANDLER.lowStrengthClusterParent(getMinStrengthClusters(), getMinClusterRatio());
        if (haltTarget) {
            const message = `Target ${haltTarget.getPayout()} is the parent of siblings with low pressure`;
            console.log(message);
            SESSION.stop(message, true);
            return;
        }

        const stopTarget = ROLL_HANDLER.getTargetsWithStrengthBelowThreshold(getStopRatio()).first();
        if (stopTarget) {
            const message = `Target ${stopTarget.getPayout()} exceeded min strength ratio`;
            console.log(message);
            SESSION.stop(message, true);
            return;
        }

        if (ROLL_HANDLER.supressedTargetsExceedThreshold(ROLL_HANDLER.getTargets(), 2, getStrengthPercentLimit())) {
            const message = `Supressed targets exceeds threshold ${getStrengthPercentLimit()}`;
            console.log(message);
            SESSION.stop(message, true);
            return;
        }
    }


    function setMessage(message) {
        $("#message").html(message)
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
            rollMode: '',
            watchModeMaxrolls: 0,
            watchModeStopOnExpectedHits: false,
            stopOnMaxRolls: false,
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
                this.watchModeMaxrolls = rollConfig.watchModeMaxrolls;
                this.watchModeStopOnExpectedHits = rollConfig.watchModeStopOnExpectedHits;

                this.sessionRollCount++
                this.globalRollCount++

                if (result >= this.payout) {
                    this.hitCount++
                    this.profitLoss += this.payout * wager - wager
                    const diff = this.payout - this.losingStreak
                    this.wagerRatio = Math.min(1, 1 - diff / this.payout)
                    this.losingStreakTargetDelta = (this.payout - this.losingStreak);
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
                this.checkStopOnWatchMode();
                this.checkStopOnPullThroughTarget(result);
            },
            getWinRate() {
                return this.hitCount / this.sessionRollCount
            },
            getTeo() {
                return 1 / (this.payout * 1.05);
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
                this.losingStreakTargetDelta = 0;
                this.profitLoss = 0
                this.watchModeMaxrolls = rollConfig.watchModeMaxrolls;
                this.watchModeStopOnExpectedHits = rollConfig.watchModeStopOnExpectedHits;
                this.stopOnPullThroughTarget = rollConfig.stopOnPullThroughTarget;
                this.pullThroughTarget = rollConfig.pullThroughTarget;
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
            checkStopOnWatchMode: function() {
                if (this.rollMode !== "watch-mode") return;
                const expectedHits = (this.getTeo() / 100) * this.watchModeMaxrolls * 100;

                if (this.watchModeStopOnExpectedHits) {


                    if (this.hitCount >= expectedHits) {
                        this.stop(
                            `Target hit or exceeded expected hits: ${this.hitCount} / ${expectedHits.toFixed(2)} over ${this.sessionRollCount} rolls`,
                        )
                        return;
                    }
                }


                if (this.sessionRollCount >= this.watchModeMaxrolls) {
                    this.stop(
                        `Target hit max rolls during watch mode: ${this.hitCount} / ${expectedHits.toFixed(2)} over ${this.sessionRollCount} rolls`,
                    )
                    return;
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

                this.stop(`Target ${this.payout} hit ${this.hitCount} times, Delta: (${this.losingStreakTargetDelta})`)
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
            stop(reason = "", notify = false) {
                this.state.reason = reason
                this.state.stopped = true
                 $("#message").html(reason)                
                if (notify) this.notify();
            },
            async notify() {
                const path = "https://www.myinstants.com/media/sounds/ding-sound-effect_2.mp3"

                var audio = new Audio(path)
                audio.type = "audio/wav"

                try {
                    await audio.play()
                } catch (err) {
                    console.log("Failed to play..." + err)
                }
            }

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
        const rollMode = getRollMode();
        const watchModeStopOnExpectedHits = getStopWatchModeOnHits();
        const watchModeMaxrolls = getWatchModeMaxRolls();

        return {
            payout: payout,
            maxRolls: maxRolls,
            stopOnHitCount: stopOnHitCount,
            hitCountTarget: hitCountTarget,
            stopOnProfit: stopOnProfit,
            profitTarget: profitTarget,
            stopOnMiss: stopOnMiss,
            rollMode: rollMode,
            watchModeMaxrolls: watchModeMaxrolls,
            watchModeStopOnExpectedHits: watchModeStopOnExpectedHits,
            stopOnPullThroughTarget: stopOnPullThroughTarget,
            pullThroughTarget: pullThroughTarget
        }
    }
    function getScaledWager(scalingFactor = 1.5) {
        const baseWager = getBaseWager()
        const payout = getPayout()

        return baseWager * Math.pow(1.92 / payout, scalingFactor)
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

    function getWatchModeMaxRolls() {
        return Number($("#watch-mode-max-rolls").val())
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

    function getStopRatio() {
        return Number($("#stop-ratio").val())
    }

    function getMinClusterRatio() {
        return Number($("#cluster-stop-ratio").val())
    }

    function getMinStrengthClusters() {
        return Number($("#min-strength-clusters").val())
    }

    function getStrengthPercentLimit() {
        return Number($("#strength-percent-limit").val())
    }

    function getReduceOnHit() {
        return $("#reduce-on-hit").prop("checked")
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
        $("#message").text('');
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
                handle: "#control-panel-header",
                containment: "window",
                scroll: false,
            })
        })
    }

    function initWindowEvents() {
        $("#set-risk-on-btn").click(function () {
            $("#risk-on").prop("checked", true)
        })

        $("#roll-mode").change(function () {
            if ($(this).val() === "watch-mode") {
                $("#watch-mode-control-wrapper").show()
            } else {
                $("#watch-mode-control-wrapper").hide()
            }
        })

        $("#roll-mode").change(function () {
            if ($(this).val() === "explicit") {
                $("#max-rolls-wrapper").show()
            } else {
                $("#max-rolls-wrapper").hide()
            }
        })

        $("#set-risk-off-btn").click(function () {
            $("#risk-on").prop("checked", false)
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

        const payouts = [...[1.5, 1.6, 1.7, 1.8, 1.9, 2, 3, 4, 5, 6, 7, 8, 9], ...Array.from(
            {
                length: 10,
            },
            (v, k) => 10 + k * 10,
        )]

        class HistoricalHit {
            constructor(lookback) {
                this.lookback = lookback
                this.hitCount = 0
                this.rollCount = 0
            }

            setHit(targetHit) {
                if (this.rollCount % this.lookback === 0) {
                    this.rollCount = 0;
                    this.hitCount = 0
                }

                this.rollCount++
                if (targetHit) this.hitCount++
            }

            getWinRate() {
                return this.hitCount / this.rollCount
            }
        }

        class Target {
            constructor(payout) {
                this.payout = payout;
                this.streak = 0;
                this.pstreak = 0;
                this.historicalHits = this.generateHistoricalHits();
                this.hitCount = 0;
                this.rollCount = 0;
                this.leftTarget = null;
                this.rightTarget = null;
                this.strengthHistory = [];
                this.historySize = 5;
            }


            updateStrengthHistory() {
                const strength = Math.ceil(this.payout + this.streak) / this.payout;
                this.strengthHistory.push(strength);
                if (this.strengthHistory.length > this.historySize) {
                    this.strengthHistory.shift(); // Keep buffer size small
                }
            }

            generateHistoricalHits() {
                const lookbacks = [100, 1000, 10000, 100000]
                const hitHistory = {};
                lookbacks.forEach((lookback) => hitHistory[lookback] = new HistoricalHit(lookback))
                return hitHistory;
            }

            getPayout() {
                return this.payout;
            }

            setLeftTarget(target) {
                this.leftTarget = target;
            }

            setRightTarget(target) {
                this.rightTarget = target;
            }

            getLeftTarget() {
                return this.leftTarget;
            }

            getRightTarget() {
                return this.rightTarget;
            }

            addResult(result) {
                this.rollCount++;
                this.updateStreak(result);
                this.updateStrengthHistory();
            }

            updateStreak(result) {
                if (result >= this.payout) {
                    this.hitCount++;
                    this.incrementHits(true);
                    if (this.streak < 0) this.pstreak = this.streak;
                    this.streak = Math.max(this.streak + 1, 1);
                } else {
                    this.incrementHits(false);
                    if (this.streak > 0) this.pstreak = this.streak;
                    this.streak = Math.min(this.streak - 1, -1);
                }
            }

            incrementHits(targetHit) {
                Object.values(this.historicalHits).forEach((historicalHit => historicalHit.setHit(targetHit)))
            }

            getStreak() {
                return this.streak;
            }

            getLosingStreak() {
                return this.streak < 0 ? this.streak : 0;
            }

            getLSRatio() {
                return Math.floor(this.getLosingStreak() / this.payout);
            }

            getLSRatioAbs() {
                return Math.abs(this.getLSRatio());
            }

            getWinRatePercentOfTeo(lookback = 100) {
                return (this.getWinRate(lookback) / this.getTeo()) * 100
            }

            getCurrentWinRate() {
                return this.hitCount / this.rollCount
            }

            getWinRate(lookback) {
                if (lookback === undefined) return this.getCurrentWinRate();
                return this.historicalHits[lookback].getWinRate();
            }

            getWindowSize() {
                const minWindow = 100;
                const expectedWindow = Math.ceil(100 / this.getTeoPercent());
                return this.payout <= 100 ? Math.max(minWindow, expectedWindow) : expectedWindow;
            }

            getExpectedHits() {
                return (this.getTeoPercent() / 100) * this.getWindowSize();
            }

            getRequiredHitRate() {
                const neededHits = this.getExpectedHits() - this.getHitCount();
                const remainingRolls = this.getWindowSize() - this.getRollCount();
                return neededHits / remainingRolls;
            }

            getHitCount() {
                return this.hitCount;
            }

            getRollCount() {
                return this.rollCount;
            }

            getTeoPercent(target) {
                return this.getTeo() * 100;
            }

            getTeo() {
                return 1 / (this.payout * 1.05);
            }

            getStrength() {
                return Math.ceil(this.payout + this.streak) / this.payout;
            }

            getExpectedStrength() {
                const e = adjustmentFactor();
                return Math.ceil(e + this.streak) / this.payout;
            }

            adjustedExpectedGap() {
                const teo = this.getTeo();
                const actualWinRate = this.getWinRate();

                let expectedGap = 1 / teo - 1;

                if (actualWinRate === 0) return expectedGap;

                let adjustmentFactor = actualWinRate >= teo ? actualWinRate / teo : teo / actualWinRate;

                return expectedGap * adjustmentFactor;
            }
        }

        class RollHandler {
            constructor(targets) {
                this.targets = targets;
                this.lowTargets = this.targets.filter((target) => target.getPayout() < 3)
                this.midTargets = this.targets.filter((target) => target.getPayout() >= 3 && target.getPayout() < 10)
                this.highTargets = this.targets.filter((target) => target.getPayout() >= 10)
            }

            getTargets() {
                return this.targets;
            }

            getLowTargets() {
                return this.lowTargets;
            }

            getMidTargets() {
                return this.midTargets;
            }

            getHighTargets() {
                return this.highTargets;
            }

            addResult(result) {
                this.targets.forEach((target) => target.addResult(result))
            }

            getRiskConditionStopTarget(ratio) {
                return this.targets
                    .filter(
                    (target) =>
                    target.getLSRatioAbs() >= ratio &&
                    target.getWinRate() < target.getTeo() &&
                    target.adjustedExpectedGap() <= target.getPayout(),
                )
                    .sort((a, b) => b.getLSRatioAbs() - a.getLSRatioAbs())
                    .last()
            }

            getWinRate(lookback = 100) {
                if (this.rollHistory.length < lookback) return 0;

                // Get last `lookback` rolls
                const recentRolls = this.rollHistory.slice(-lookback);

                // Count wins (rolls greater than or equal to their target payout)
                const wins = recentRolls.filter(roll =>
                                                this.targets.some(target => roll >= target.getPayout())
                                               ).length;

                return wins / lookback; // Win rate as a decimal (0.00 - 1.00)
            }

            getTotalStrength() {
                return this.targets.reduce(
                    (sum, target) => sum + target.getStrength(),
                    0,
                )
            }

            getStrengthBelowZeroCount() {
                return this.targets.filter((target) => target.getStrength() < 0).length
            }

            getSupressedTargetCount(targets, strenthThreshold = -1) {
                return targets.filter((target) => target.getStrength() < -strenthThreshold).length
            }

            supressedTargetsExceedThreshold(targets, strenthThreshold, percentMatchedThreshold) {
                return this.getSupressedTargetCount(targets, strenthThreshold) / targets.length >= percentMatchedThreshold
            }


            getTargetsWithStrengthBelowThreshold(strengthThreshold) {
                return this.targets.filter((target) => target.getStrength() < -strengthThreshold)
            }

            getSmoothedStrength(target, lookback = 3) {
                if (target.strengthHistory.length < lookback) return target.getStrength(); // Not enough data
                const recentStrengths = target.strengthHistory.slice(-lookback);
                return recentStrengths.reduce((sum, s) => sum + s, 0) / lookback;
            }

            countLowStrengthSiblings(target, sum = 0) {
                const leftTarget = target.getLeftTarget();

                if (leftTarget && this.getSmoothedStrength(leftTarget, 3) < 0) {
                    sum++;
                    return this.countLowStrengthSiblings(leftTarget, sum)
                }

                return sum;
            }

            lowStrengthClusterParent(minClusterSize = 2, strengthThreshold = 2, lookback = 3) {
                let targets = this.getTargetsWithStrengthBelowThreshold(strengthThreshold);

                for (let i = 0; i < targets.length; i++) {
                    const count = this.countLowStrengthSiblings(targets[i]);
                    if (count >= minClusterSize) return targets[i];
                }
                return null;
            }
        }

        // Initialize targets and link them efficiently
        const targets = payouts.map((payout) => new Target(payout))

        targets.forEach((target, index) => {
            if (index > 0) target.setLeftTarget(targets[index - 1])
            if (index < targets.length - 1) target.setRightTarget(targets[index + 1])
        })

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
