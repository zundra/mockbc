/* Start Script */
// ==UserScript==
// @name         bc.game wager manager
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

    let RISK_ON_TARGET = null;
    let SESSION = defaultSession()


    function evalResult(result) {
        if (SESSION.globalRollCount % 50 === 0) {
            console.log(
                `Roll Count: ${SESSION.globalRollCount}, P/L: ${SESSION.getPL()}`,
            )
        }

        RISK_ON_TARGET.addResult(result)
        SESSION.addRoll(result)
        updateUI()
        checkHalts();
        setNextBet(result >= getPayout())
    }

    function updateUI() {
        $("#automation-profitLoss").text(SESSION.getPL().toFixed(4))
        $("#automation-rollCount").text(SESSION.getGlobalRollCount())
    }

    function checkHalts() {
        if (SESSION.isStopped()) return;
    }

    function setNextBet(outcome) {
        const wager = RISK_ON_TARGET.getWager(outcome);
        const payout = RISK_ON_TARGET.getPayout();

        if (getAutomationTestMode()) return
        setPayout(payout);
        setWager(wager);
    }

    function setMessage(message) {
        $("#automation-message").html(message)
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
            }
        } else {
            console.error("Wager input field not found!")
        }
    }

    function getBalance() {
        let rawText = $(".ml-3 .font-extrabold").text().trim()
        return parseFloat(rawText.replace(/[^\d.]/g, ""))
    }

    function defaultSession() {
        class BankRoll {
          constructor() {
            this.initialBalance = 0;
            this.currentBalance = 0;
            this.stopThreshold = 0;
          }

          getPL() {
            return this.initialBalance - this.getBalance();
          }

          lossThresholdExceeded() {
            this.currentBalance = getBalance()
            return (this.currentBalance <= this.stopThreshold);
          }

          getBalance() {
            let rawText = $(".ml-3 .font-extrabold").text().trim()
            return parseFloat(rawText.replace(/[^\d.]/g, ""))
          }

          doInit() {
            this.initialBalance = this.currentBalance = getBalance();
            this.stopThreshold = this.initialBalance * 0.099;
          }
        }
        
        const bankRoll = new BankRoll();

        return {
            state: {
                stopped: true,
                reason: "",
            },
            sessionRollCount: 0,
            globalRollCount: 0,
            bankRoll: bankRoll,
            addRoll: function (result) {
                this.sessionRollCount++
                this.globalRollCount++
                this.checkBankRoll();
            },
            getPL() {
                return this.bankRoll.getPL();
            },
            checkBankRoll: function() {
                if (this.bankRoll.lossThresholdExceeded()) {
                    this.stop("Stopping: Bankroll declined by 10%");
                }
            },
            getGlobalRollCount: function () {
                return this.globalRollCount
            },
            getSessionRollCount: function () {
                return this.sessionRollCount
            },
            start: function () {
                this.bankRoll.doInit();
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
            stop(reason = "", notify = false) {
                this.state.reason = reason
                this.state.stopped = true
                $("#automation-message").html(reason)
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
    function getAutomationTestMode() {
        return $("#automation-test-mode").prop("checked")
    }

    function getStopOnProfit() {
        return $("#stop-on-profit").prop("checked")
    }

    function getProfitTarget() {
        return Number($("#profit-target").val())
    }

    function getLosingStreakMultiplier() {
        return Number($("#automation-ls-multiplier").val())
    }

    function getBaseWager() {
        return Number($("#automation-base-wager").val());
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
        RISK_ON_TARGET = initTarget();
        setWager(0);
        SESSION.start()
        if (!getAutomationTestMode()) {
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

    function initTarget() {
class WagerManager {
    constructor() {
        this.wagers = [0, 0.0001, 0.0005, 0.001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1, 0.5];
        this.wagerIndex = 0; // Start at the lowest wager
    }

    getWager() {
        return this.wagers[this.wagerIndex];
    }

    setWagerIndex(ratio) {
        if (ratio < 0) {
            // Loss scenario: Increase wager index based on floor value of absolute ratio
            this.wagerIndex += Math.floor(Math.abs(ratio));
        } else {
            // Win scenario: Step down dynamically
            let reduction = Math.max(1, Math.ceil(this.wagerIndex * 0.33)); // Reduce by 33% but at least 1 step
            this.wagerIndex -= reduction;
        }

        // Ensure wagerIndex stays within valid bounds
        this.wagerIndex = Math.max(0, Math.min(this.wagerIndex, this.wagers.length - 1));
    }
}



        class RiskOnTarget {
            constructor() {
                this.wagerManager = new WagerManager();
                this.wager = 0;
                this.payout = 0;
                this.wager = 0;
                this.state = 0;
                this.streak = 0;
                this.hitCount = 0;
                this.rollCount = 0;
                this.profitLoss = 0;
                this.currentProfitLoss = 0;
                this.previousProfitLoss = 0;
                this.revokeMessage = "";
                this.maxRatio = 0;
                this.wagerIncreaseDivisor = 1;
                this.cycle = 0;
            }

            invoke(payout) {
                this.payout = payout;
                this.state = 1;
                this.streak = 0;
                this.hitCount = 0;
                this.rollCount = 0;
                this.profitLoss = 0;
                this.revokeMessage = "";
                this.wagerIncreaseDivisor = 1;
                this.maxRatio = 0;
                this.cycle = 0;
            }

            revoke(message) {
                if (this.isNotInvoked()) throw "Must invoke target before calling revoke";
                this.state = -1;
                this.revokeMessage = message;
            }

            getRevokeMessage() {
                return this.revokeMessage;
            }

            addResult(result) {
                this.rollCount++;

                if (result >= this.payout) {
                    this.wagerManager.setWagerIndex(this.getStreak() / this.payout)
                    this.hitCount++;
                    this.streak = Math.max(this.streak + 1, 1);
                    this.profitLoss += (this.wager * this.payout) - this.wager;
                } else {
                    this.streak = Math.min(this.streak - 1, -1);
                    this.profitLoss -= this.wager;
                }
            }

            getRollCount() {
                return this.rollCount;
            }

            getPL() {
                return this.profitLoss;
            }

            resetPL() {
              this.profitLoss = 0;
            }

            getPayout() {
                return this.payout;
            }

            getWager(outcome) {
                return this.wagerManager.getWager(outcome);
            }

            getStreak() {
                return this.streak;
            }

            getLosingStreak() {
              if (this.streak >= 0) return 0;
              return this.streak;
            }

            getLosingStreakAbs() {
              return Math.abs(this.getLosingStreak());
            }

            getRatio() {
                return Math.floor(this.getStreak() / this.payout)
            }

            getRatioAbs() {
                return Math.abs(this.getRatio());
            }

            getRollCount() {
                return this.rollCount
            }

            getHitCount() {
                return this.hitCount
            }

            getWinRate() {
                return this.hitCount / this.rollCount;
            }

            getTeoPercent() {
                return this.getTeo() * 100
            }

            getTeo() {
                return 1 / (this.payout * 1.05)
            }

            getHitCount() {
                return this.hitCount
            }

            isNotInvoked() {
                return this.isRevoked() || this.isIdle();
            }

            isIdle() {
                return this.state === 0;
            }

            isRevoked() {
                return this.state === -1;
            }

            isInvoked() {
                return this.state === 1;
            }
        }


        const t = new RiskOnTarget()
        t.invoke(10, 100);
        return t;
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
            border-radius: 8px 8px 0 0;z
            cursor: grab;
        ">⚙️ Control Panel</div>

        <div id="automation-message" class="message-box" style="
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
            <div>Roll Count: <span id="automation-rollCount"></span></div>
            <br />
            <div>Profit Loss: <span id="automation-profitLoss"></span></div>
            <br />
            <div>Losing Streak: <ul id="automation-risk-on-losing-streak"></div>
        </div>
             <label>Test Mode</label>
            <input id="automation-test-mode" type="checkbox" checked />
            <br/>
           <br/>
             <label>Stop On Profit Mode</label>
            <input id="stop-on-profit" type="checkbox" checked />
            <br/>
            <div class="control-group">
                <label>Profit Target</label>
                <input type="number" id="profit-target" value="0.10" />
            </div>
            <label>Base Wager</label>
            <input type="number" id="automation-base-wager" value="0.0001" />
                  <br/>
            <label>Losing Streak Multiplier</label>
            <select id="automation-ls-multiplier" style="color: black;">
            <option value="1">1</option>
            <option value="1.5">1.5</option>
            <option value="2" selected>2</option>
            <option value="2.5">2.5</option>
            <option value="3">3</option>
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


    /********************* Framework *********************/
    let lastRollSet = []
    let currentRollSet = []

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