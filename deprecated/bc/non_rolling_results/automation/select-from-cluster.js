/* Start Script */
// ==UserScript==
// @name         bc.game pick-lowest-strength
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

    let maxTotalStrengthBelowZero = { max: 0 }
    const ROLL_HANDLER = initRollHandler();
    const SESSION = defaultSession()
    const TEST_MODE = true

    let lastRollSet = []
    let currentRollSet = []

    let currentRiskOnTarget = null
    let riskOnReTryCount = 0
    let maxRatio = 0



    function evalResult(result) {
        if (SESSION.globalRollCount % 500 === 0) {
            console.log(`Roll Count: ${SESSION.globalRollCount}, P/L: ${ROLL_HANDLER.getPL()}`)
        }

        SESSION.addRoll(result)
        ROLL_HANDLER.addResult(result)
        evalRiskState(result)
        setNextRiskTarget(result)
        printSummary()
        updateUI()
    }

    function printSummary() {
        if (!currentRiskOnTarget) return
        // console.log(`📊 Current Risk-On Target: ${currentRiskOnTarget.getPayout()}`);
    }

    function setNextRiskTarget(result) {
        if (!currentRiskOnTarget)
            currentRiskOnTarget = ROLL_HANDLER.getNextRiskTarget()

        if (!currentRiskOnTarget) return
        debugger;
        let wager = 0
        const payout = currentRiskOnTarget.getPayout()

        if (!currentRiskOnTarget.isRiskOn()) {
            // No need for extra check—selection guarantees it's valid
            let wager = getTieredWager(currentRiskOnTarget);
            // console.log(`🔥 Going RISK-ON with target ${currentRiskOnTarget.getPayout()} and wager ${wager}`);
            currentRiskOnTarget.goRiskOn(wager);
        }



        else {
            wager = currentRiskOnTarget.getWager()
            //   console.log(`🔄 Updating Risk-On Target ${payout}, New Wager: ${wager}`);
        }

        setNextBet(payout, wager)
    }

    function evalRiskState(result) {
        if (!currentRiskOnTarget) return

        if (currentRiskOnTarget.isDispose()) {
            printSummary()
            ROLL_HANDLER.updateBankRoll()
            currentRiskOnTarget.goRiskOff()
            currentRiskOnTarget = null
            setNextBet(0, 1.01)
            maxRatio = 0
        }
    }

    function updateUI() {
        $("#automation-bankRoll").text(ROLL_HANDLER.getBankRollBalance())
        $("#automation-profitLoss").text(ROLL_HANDLER.getPL())
        $("#automation-rollCount").text(SESSION.getGlobalRollCount())
        if (currentRiskOnTarget)
            $("#automation-risk-on-losing-streak").text(
                currentRiskOnTarget.riskOnLosingStreak,
            )
    }
    function setNextBet(payout, wager) {
        if (isTestMode()) return

        setPayout(payout)
        setWager(wager)
    }

    function getStartingBankRoll() {
        return 100;
        return Number($("#automation-bank-roll-start").val())
    }

    function getLosingTopTargetInLosingStreak() {
        const lsm = getLosingStreakMultiplier()

        const results = TARGETS.sort(
            (a, b) => Math.abs(b.getRatio()) - Math.abs(a.getRatio()),
        )

        if (results.length < 2) return null

        return results.first()
    }

    function getTieredWager(target) {
        maxRatio = Math.max(maxRatio, Math.max(Math.abs(target.getRatio()), 1))
        return getScaledWager(target) * maxRatio
    }

    function getScaledWager(target, scalingFactor = 1.5) {
        const baseWager = getBaseWager()
        return baseWager * Math.pow(1.92 / target.getPayout(), scalingFactor)
    }

    function isTestMode() {
        return TEST_MODE
    }

    function setMessage(message) {
        $("#message").html(message)
    }

    function getMaxRolls() {
        return getPayout() - 1
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

    function getPayout() {
        const payoutFieldGroup = $('div[role="group"]').has(
            'label:contains("Payout")',
        )
        const inputField = payoutFieldGroup.find("input")

        return Number(inputField.val())
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

    /********************* Framework *********************/
    function defaultSession() {
        return {
            state: {
                stopped: true,
                reason: "",
            },
            sessionRollCount: 0,
            globalRollCount: 0,
            addRoll: function (result) {
                this.sessionRollCount++
                this.globalRollCount++
            },
            getGlobalRollCount: function () {
                return this.globalRollCount
            },
            getSessionRollCount: function () {
                return this.sessionRollCount
            },
            start: function () {
                this.reset()
                this.state.stopped = false
            },
            reset: function () {
                this.state.stopped = true
                this.state.reason = ""
                this.sessionRollCount = 0
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
            stop(reason = "") {
                this.state.reason = reason
                this.state.stopped = true
            },
        }
    }
    /* Configuration */
    function getStopOnWin() {
        return $("#stop-on-win").prop("checked")
    }

    function getLosingStreakMultiplier() {
        return Number($("#ls-multiplier").val())
    }

    function getBaseWager() {
        return 0.05 // Number($("#base-wager").val());
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
        SESSION.start()
        if (!isTestMode()) {
            doBet()
        }
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

    function initRollHandler() {
        const p1 = [5, 6, 7, 8, 9]
        const p2 = Array.from({ length: 10 }, (_, k) => 10 + 1)

        const payouts = [...p1, ...p2]
        class Target {
            constructor(payout) {
                this.payout = payout
                this.losingStreak = 0
                this.hitCount = 0
                this.rollCount = 0
                this.streak = 0
                this.pstreak = 0
                this.profitLoss = 0
                this.wager = 0
                this.baseWager = 0

                this.riskState = 0
                this.riskOnLosingStreak = 0
                this.riskOnHitCount = 0
                this.riskOnLosingStreakDelta = 0
                this.riskOnWinRate = 0
                this.riskOnRollCount = 0

                this.longStreakCount = 0
                this.burstHits = 0
                this.isLongStreakActive = false
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

            addResult(result) {
                this.updateStats(result)
                                this.updateStrengthHistory();
            }

            updateStats(result) {
                if (this.isRiskOn()) this.updateRiskOnStats(result)
                this.updateGlobalStats(result)
            }

            updateRiskOnStats(result) {
                this.riskOnRollCount++

                if (result >= this.payout) {
                    this.riskOnLosingStreakDelta = this.payout - this.riskOnLosingStreak
                    this.riskOnHitCount++
                    this.riskOnLosingStreak = 0
                    this.setWager()
                } else {
                    this.riskOnLosingStreak++
                }

                this.updatePL(result)
                this.evalRiskState(result)
            }

            shouldEnterRisk() {
                return this.isLongStreakActive && this.burstHits === 0
            }

            evalRiskState(result) {
                /*  console.log("Risk on PL", this.getPL()); */

                // ✅ Exit if profit is positive
                if (this.getPL() > 0) {
                    this.disposeRiskOn();
                    console.log("GOING RISK OFF - Profit target reached", this.getPL());
                    return;
                }

                // // ✅ Exit if too many risk-on rolls (safety limit)
                // if (this.riskOnRollCount >= this.getPayout() * 3) {
                //     this.disposeRiskOn();
                //     console.log("GOING RISK OFF - Too many rolls, stopping.");
                //     return;
                // }

                // // ✅ Exit on burst of hits
                // if (this.burstHits >= 2) {  
                //     this.disposeRiskOn();
                //     console.log("GOING RISK OFF - Burst of wins detected.");
                //     return;
                // }

                // // ✅ Exit if loss delta has normalized
                // if (this.riskOnLosingStreakDelta >= 0) {
                //     this.disposeRiskOn();
                //     console.log("GOING RISK OFF - Loss delta normalized.");
                //     return;
                // }
            }

            updateGlobalStats(result) {
                this.rollCount++

                if (result >= this.payout) {
                    this.hitCount++
                    if (this.streak < 0) this.pstreak = this.streak
                    this.streak = this.streak >= 1 ? this.streak + 1 : 1
                } else {
                    if (this.streak > 0) this.pstreak = this.streak
                    this.streak = this.streak > 0 ? -1 : this.streak - 1
                }

                if (Math.abs(this.streak) > (this.payout * 2)  && !this.isLongStreakActive) {
                    this.isLongStreakActive = true
                    //   console.log("🚨 Long Losing Streak Detected");
                }
            }

            updatePL(result) {
                if (result >= this.payout) {
                    this.profitLoss += this.wager * this.payout - this.wager
                    return
                }

                this.profitLoss -= this.wager
            }

            getPL() {
                return this.profitLoss
            }

            setWager() {
                if (this.riskOnLosingStreakDelta > 0) return
                let baseWager = this.baseWager || 0.0001 // Ensure a base wager is set

                // Exponential scaling: 2^(delta / payout)
                let scalingFactor = Math.pow(
                    2,
                    this.riskOnLosingStreakDelta / this.payout,
                )

                // Compute new wager
                this.wager = baseWager * scalingFactor
            }

            getWager() {
                return this.wager
            }

            getPLGTRisk() {
                return this.profitLoss >= this.baseWager
            }

            goRiskOn(wager) {
                this.riskState = 1
                this.wager = wager
                this.baseWager = wager
                this.riskOnRollCount = 0
            }

            goRiskOff() {
                this.riskState = -1
                this.wager = 0
                this.attemptCount = 0
                this.riskOnLosingStreak = 0
            }

            isRiskOn() {
                return this.riskState === 1
            }

            disposeRiskOn() {
                this.riskState = -1
            }

            isDispose() {
                return this.riskState === -1
            }

            getStreak() {
                return this.streak
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

            getPayout() {
                return this.payout
            }

            getLosingStreak() {
                if (this.streak >= 0) return 0
                return this.streak
            }

            getLosingStreakAbs() {
                return Math.abs(this.getLosingStreak())
            }

            getRatio() {
                return Math.floor(this.getStreak() / this.payout)
            }

            getLSRatio() {
                return Math.floor(this.getLosingStreak() / this.payout)
            }

            getLSRatioAbs() {
                return Math.abs(this.getLSRatio())
            }

            getTeo() {
                return 1 / (this.payout * 1.05)
            }

            getWinRate() {
                return this.hitCount / this.rollCount
            }

            getStrength() {
                return Math.ceil(this.payout + this.streak) / this.payout
            }

            getExpectedStrength() {
                const e = adjustmentFactor()
                return Math.ceil(e + this.streak) / this.payout
            }

            adjustedExpectedGap() {
                const teo = this.getTeo()
                const actualWinRate = this.getWinRate()

                let expectedGap = 1 / teo - 1

                if (actualWinRate === 0) return expectedGap

                let adjustmentFactor =
                    actualWinRate >= teo ? actualWinRate / teo : teo / actualWinRate

                return expectedGap * adjustmentFactor
            }
        }

        class RollHandler {
            constructor(targets, bankRoll) {
                this.bankRoll = bankRoll
                this.targets = targets
            }

            addResult(result) {
                for (let i = 0; i < this.targets.length; i++)
                    this.targets[i].addResult(result)
            }

            getBankRollBalance() {
                return this.bankRoll
            }

            getPL() {
                return this.targets.reduce((sum, target) => sum + target.profitLoss, 0)
            }

            updateBankRoll() {
                this.bankRoll += this.getPL()
            }

            getTargetsWithStrengthBelowThreshold(strengthThreshold) {
                return this.targets.filter((target) => target.getStrength() < -strengthThreshold)
            }

            getSmoothedStrength(target, lookback = 3) {
                if (target.strengthHistory.length < lookback) return target.getStrength(); // Not enough data
                const recentStrengths = target.strengthHistory.slice(-lookback);
                return recentStrengths.reduce((sum, s) => sum + s, 0) / lookback;
            }

            countLowStrengthSiblings(target) {
                return this.getLowStrengthSiblings(target).length;
            }

            getLowStrengthSiblings(target, siblings = []) {
            	if (!target) return []
                const leftTarget = target.getLeftTarget();

                if (siblings.length === 0) {
                    siblings.push(target);
                }

                if (leftTarget && this.getSmoothedStrength(leftTarget, 3) < 0) {
                    siblings.push(leftTarget)
                    return this.getLowStrengthSiblings(leftTarget, siblings)
                }

                return siblings;
            }

            lowStrengthClusterParent(minClusterSize = 2, strengthThreshold = 2, lookback = 3) {
                let targets = this.getTargetsWithStrengthBelowThreshold(strengthThreshold);

                for (let i = 0; i < targets.length; i++) {
                    const count = this.countLowStrengthSiblings(targets[i]);
                    if (count >= minClusterSize) return targets[i];
                }
                return null;
            }

            getNextRiskTarget() {
                const parentTarget = this.lowStrengthClusterParent(1, 3);

                return this.getLowStrengthSiblings(parentTarget).sort((a, b) => a.getPayout() - b.getPayout()).first();
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
        }


        // Initialize targets and link them efficiently
        const targets = payouts.map((payout) => new Target(payout))

        targets.forEach((target, index) => {
            if (index > 0) target.setLeftTarget(targets[index - 1])
            if (index < targets.length - 1) target.setRightTarget(targets[index + 1])
        })

        return new RollHandler(targets)
    }

    function initUI() {
        $(document).ready(function () {
            var body = $("body")

            let html = `
    <div id="control-panel" style="
        position: fixed;
        top: 0px;
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
        <div id="automation-stats-panel">
            <div id="automation-stats-panel-header">⚙️ Stats Panel</div>
            <div class="message-box">
            <div>Bank Roll: <span id="automation-bankRoll"></span></div>
            <br />
                        <div>Roll Count: <span id="automation-rollCount"></span></div>
            <br />
            <div>Profit Loss: <span id="automation-profitLoss"></span></div>
            <br />
            <div>Losing Streak: <ul id="automation-risk-on-losing-streak"></div>
        </div>
            <label>Bank Roll Start</label>
            <input type="number" id="automation-bank-roll-start" value="50" />
           
            <label>Base Wager</label>
            <input type="number" id="automation-base-wager" value="0.001" />
            
            <label>Losing Streak Multiplier</label>
            <select id="automation-ls-multiplier" style="color: black;">
            <option value="1">1</option>
            <option value="1.5">1.5</option>
            <option value="2">2</option>
            <option value="2.5">2.5</option>
            <option value="3" selected>3</option>
            <option value="3.5">3.5</option>
            <option value="4">4</option>
            <option value="4.5">4.5</option>
            <option value="5">5</option>
            <option value="5.5">5.5</option>
            <option value="6">6</option>
            <option value="6.5">6.5</option>
            <option value="7">7</option>
            <option value="7.5">7.5</option>
            <option value="8">8</option>
            <option value="8.5">8.5</option>
            <option value="9">9</option>
            <option value="9.5">9.5</option>
            <option value="10">10</option>
            </select>
        </div>`

      body.prepend($(html))

        $("#control-panel").draggable({
            handle: "#control-panel-header",
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
