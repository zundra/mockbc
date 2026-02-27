/* Start Script */
// ==UserScript==
// @name         bc.game roller v4
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


(function() {
    "use strict"

    const SESSION = defaultSession();

    let lastRollSet = []
    let currentRollSet = []
    let currentRiskOnTarget = null
    let ROLL_HANDLER = initRollHandler();

    $(document).ready(function () {
        // Inject styles using jQuery
        $("<style>")
            .prop("type", "text/css")
            .html(`
            #control-panel {
                position: fixed;
                top: 500px;
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
        `)
            .appendTo("head");

        // Define the control panel HTML
        let html = `
        <div id="control-panel">
            <div id="control-panel-header">⚙️ Control Panel</div>

            <div id="message" class="message-box">Welcome! Configure your settings to begin.</div>

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
                <label>Stop on Max Rolls</label>
              
              <select id='stop-on-max-rolls'>
                <option value="none">None</option>
                <option value="explicit">Explicit</option>
                <option value="full-target">Full Target</option>
                <option value="half-target">Half Target</option>
              </select>
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
                        let val = (i + 1) * 1;
                        return `<option value="${val}" ${val === 8 ? "selected" : ""}>${val}</option>`;
                    }).join("")}
                </select>
            </div>
        </div>
    `;

        // Append the control panel to the body
        $("body").append(html);
        initWindowEvents();
    });


    function evalResult(result) {
        SESSION.addRoll(result, getWager());
        ROLL_HANDLER.addResult(result);

        if (getReduceOnHit() && SESSION.getIsEarlyHit()) {
            adjustWager()
        }
        evalHalts()
    }

    function adjustWager() {
        let wager = Math.max(0.0001, getWager() * SESSION.getWagerRatio());
        setWager(wager)
    }

    function evalHalts(result) {
        if (getRiskOn()) return;

        if (SESSION.isStopped()) {
            setMessage(SESSION.getStopReason())
            return;
        }

        const target = ROLL_HANDLER.getRiskConditionStopTarget(getStopRatio());

        if (target) {
            SESSION.stop(`Target ${target.getPayout()} hit losing streak ${target.getLosingStreak()}`)
        }

        if (SESSION.isStopped()) {
            setMessage(SESSION.getStopReason())
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
                reason: ""
            },
            losingStreak: 0,
            hitCount: 0,
            sessionRollCount: 0,
            globalRollCount: 0,
            stopOnMiss: false,
            stopOnMaxRolls: false,
            payout: 0,
            wagerRatio: 0,
            profitLoss: 0,
            maxRolls: 0,
            stopOnWin: false,
            addRoll: function(result, wager) {
                this.sessionRollCount++;
                this.globalRollCount++;

                if (result >= this.payout) {
                    this.hitCount++;
                    this.profitLoss += (this.payout * wager) - wager;
                    const diff = this.payout - this.losingStreak;
                    this.wagerRatio = Math.min(1, 1 - diff / this.payout);
                    this.losingStreak = 0;
                } else {
                    this.profitLoss -= wager;
                    this.losingStreak++;
                    this.wagerRatio = 1;
                }

                this.checkStopOnProfitTarget(result);
                this.checkStopOnMiss(result);
                this.checkStopOnHitCount();
                this.checkStopOnMaxRolls();
            },
            getPL() {
                return this.profitLoss;
            },
            getIsEarlyHit() {
                return this.wagerRatio < 1;
            },
            getWagerRatio() {
                return this.wagerRatio;
            },
            getWinRate() {
                return this.hitCount / this.sessionRollCount;
            },
            getGlobalRollCount: function() {
                return this.globalRollCount;
            },
            getSessionRollCount: function() {
                return this.sessionRollCount;
            },
            start: function(payout, maxRolls, stopOnHitCount, hitCountTarget, stopOnProfit, profitTarget, stopOnMiss) {
                this.reset();
                this.state.stopped = false;
                this.payout = payout;
                this.maxRolls = maxRolls;
                this.stopOnHitCount = stopOnHitCount;
                this.hitCountTarget = hitCountTarget;
                this.stopOnProfit = stopOnProfit;
                this.profitTarget = profitTarget;
                this.stopOnMiss = stopOnMiss;
                this.profitLoss = 0;

            },
            reset: function() {
                this.state.stopped = true;
                this.state.reason = ""
                this.sessionRollCount = 0;
                this.losingStreak = 0;
                this.hitCount = 0;
                this.wagerRatio = 1;
            },
            isStopped: function() {
                return this.state.stopped;
            },
            getStopReason: function() {
                return this.state.reason;
            },
            isRunning: function() {
                return !this.isStopped()
            },
            checkStopOnMiss: function() {
                if (!this.stopOnMiss || this.losingStreak < this.payout) return;
                this.stop(`Target missed during cycle with LS greater $ {this.losingStreak} than payout $ {this.payout}`);
            },
            checkStopOnHitCount: function(result) {
                if (!this.stopOnHitCount) return;

                if (this.hitCount < this.hitCountTarget) return;

                this.stop(`Target ${this.payout} hit ${this.hitCount} times`);
            },
            checkStopOnMaxRolls() {
                if (this.maxRolls === -1) return;

                if (this.sessionRollCount >= this.maxRolls) {
                    this.stop(`Stopped on max rolls ${this.sessionRollCount}`);
                }
            },
            checkStopOnProfitTarget() {
                if (!this.stopOnProfit) return;

                if (this.profitLoss < this.profitTarget)
                    return;

                this.stop(`Stopped on profit target Profit Target: ${this.profitTarget}, Profit: ${this.profitLoss.toFixed(5)}`);

            },
            stop(reason = "") {
                this.state.reason = reason;
                this.state.stopped = true;
            },
        }
    }
    /* Configuration */
    function getScaledWager(scalingFactor = 1.5) {
        const baseWager = getBaseWager()
        const payout = getPayout();

        return baseWager * Math.pow(1.92 / payout, scalingFactor);
    }

    function getBaseWager() {
        return Number($("#base-wager").val());
    }

    function getRiskOn() {
        return $("#risk-on").prop("checked");
    }

    function getStopOnHitCount() {
        return $("#stop-on-hit-count").prop("checked");
    }

    function getHitCountTarget() {
        return Number($("#hit-count-target").val());
    }

    function getStopOnMaxRolls() {
        return $("#stop-on-max-rolls").val()
    }

    function getMaxRolls() {
        switch (getStopOnMaxRolls()) {
            case "explicit":
                return Number($("#max-rolls").val());
            case "full-target":
                return Math.floor(getPayout());
            case "half-target":
                return Math.floor(getPayout() / 2);
            default:
                return -1;
        }
    }

    function getStopOnProfit() {
        return $("#stop-on-profit").prop("checked");
    }

    function getProfitTarget() {
        return Number($("#profit-target").val());
    }

    function getStopOnMiss() {
        return $("#stop-on-miss").prop("checked");
    }

    function getStopRatio() {
        return Number($("#stop-ratio").val());
    }

    function getReduceOnHit() {
        return $("#reduce-on-hit").prop("checked");
    }

    // Utility function: Get current roll data
    function getCurrentRollData() {
        return $(".grid.grid-auto-flow-column div span")
            .map(function() {
            return $(this).text()
        })
            .get()
    }

    // Function to start the betting process

    function startBetting() {
        const payout = getPayout();

        const maxRolls = getMaxRolls();

        const stopOnHitCount = getStopOnHitCount()
        const hitCountTarget = getHitCountTarget()

        const stopOnProfit = getStopOnProfit()
        const profitTarget = getProfitTarget()


        const stopOnMiss = getStopOnMiss();

        SESSION.start(payout, maxRolls, stopOnHitCount, hitCountTarget, stopOnProfit, profitTarget, stopOnMiss);
        doBet();
    }

    function stopBetting() {
        SESSION.stop();
    }

    function doInit() {
        observeRollChanges()
        initPrototypes()
        initUI();

        bindHotKeys()
    }


    function initUI() {
        $(document).ready(function() {
            $("#control-panel").draggable({
                handle: "#control-panel-header",
                containment: "window",
                scroll: false
            });
        });
    }

    function initWindowEvents() {
        $("#set-risk-on-btn").click(function() {
            const wager = getScaledWager();
            $("#risk-on").prop("checked", true);
            $("#stop-on-profit").prop("checked", true);
            $("#stop-on-max-rolls").val("none").trigger("change");
            $("#profit-target").val(0.0001);
            setWager(wager);
        })

        $("#stop-on-max-rolls").change(function() {
            if ($(this).val() === "explicit") {
                $("#max-rolls-wrapper").show();
            } else {
                $("#max-rolls-wrapper").hide();
            }
        });

        $("#set-risk-off-btn").click(function() {
            $("#risk-on").prop("checked", false);
            $("#stop-on-profit").prop("checked", false);
            $("#stop-on-max-rolls").val("none").trigger("change");
            $("#profit-target").val(0.0001);
            setWager(0);
        })

        $("#double-wager-btn").click(function() {
            setWager(Math.min(1, getWager() * 2))
        })

        $("#half-wager-btn").click(function() {
            setWager(Math.max(0.0001, getWager() / 2))
        })

        $("#set-wager-btn").click(function() {
            setWager(Number($("#wager-amount").val()))
        })

        $("#start-betting-btn").click(function() {
            startBetting()
        })

        $("#stop-betting-btn").click(function() {
            stopBetting()
        })
    }

    function initPrototypes() {
        Array.prototype.last = function() {
            return this[this.length - 1];
        };
        Array.prototype.first = function() {
            return this[0];
        };

        Array.prototype.median = function() {
            if (this.length === 0) return null; // Handle empty array case

            const medianIndex = Math.floor((this.length - 1) / 2); // Get the median index
            return this[medianIndex]; // Return the median element
        };
    }


    function initRollHandler() {
        const p1 = [1.92, 2, 3, 4, 5, 6, 7, 8, 9];
        const p2 = Array.from({ length: 100 }, (_, k) => 10 + k);
        const p3 = [100, 200, 500, 1000, 5000, 10000];

        const payouts = [...p1, ...p2, ...p3];

        class Target {
            constructor(payout) {
                this.payout = payout;
                this.streak = 0;
                this.pstreak = 0;
                this.hitCount = 0;
                this.rollCount = 0;
                this.leftTarget = null;
                this.rightTarget = null;
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

            addResult(result) {
                this.rollCount++;
                this.updateStreak(result);
            }

            updateStreak(result) {
                if (result >= this.payout) {
                    this.hitCount++;
                    if (this.streak < 0) this.pstreak = this.streak;
                    this.streak = Math.max(this.streak + 1, 1);
                } else {
                    if (this.streak > 0) this.pstreak = this.streak;
                    this.streak = Math.min(this.streak - 1, -1);
                }
            }

            getStreak() {
                return this.streak;
            }

            getLosingStreak() {
                return this.streak < 0 ? this.streak : 0;
            }

            getRatio() {
                return Math.floor((this.streak + this.payout) / this.payout);
            }

            getLSRatio() {
                return Math.floor(this.getLosingStreak() / this.payout);
            }

            getLSRatioAbs() {
                return Math.abs(this.getLSRatio());
            }

            getWinRate() {
                return this.rollCount > 0 ? this.hitCount / this.rollCount : 0;
            }

            getTeo() {
                return 1 / (this.payout * 1.05);
            }

            adjustedExpectedGap() {
                const teo = this.getTeo();
                const actualWinRate = this.getWinRate();

                let expectedGap = (1 / teo) - 1;

                if (actualWinRate === 0) return expectedGap;

                let adjustmentFactor = actualWinRate >= teo 
                ? actualWinRate / teo 
                : teo / actualWinRate;

                return expectedGap * adjustmentFactor;
            }

        }

        class RollHandler {
            constructor(targets) {
                this.targets = targets;
            }

            addResult(result) {
                this.targets.forEach(target => target.addResult(result));
            }

            getRiskConditionStopTarget(ratio) {
                return this.targets
                    .filter(target => target.getLSRatioAbs() >= ratio && target.getWinRate() < target.getTeo() && target.adjustedExpectedGap() <= target.getPayout())
                    .sort((a, b) => b.getLSRatioAbs() - a.getLSRatioAbs())
                    .last();
            }
        }

        // Initialize targets and link them efficiently
        const targets = payouts.map(payout => new Target(payout));

        targets.forEach((target, index) => {
            if (index > 0) target.setLeftTarget(targets[index - 1]);
            if (index < targets.length - 1) target.setRightTarget(targets[index + 1]);
        });

        return new RollHandler(targets);
    }


    function setWager(amount) {
        const payoutFieldGroup = $('div[role="group"]').has(
            'label:contains("Amount")'
        );
        const inputField = payoutFieldGroup.find("input");

        if (inputField.length) {
            const currentValue = parseFloat(inputField.val());

            if (currentValue !== amount) { // Only set if different
                let nativeSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype,
                    "value"
                ).set;

                nativeSetter.call(inputField[0], amount);
                inputField[0].dispatchEvent(new Event("input", {
                    bubbles: true
                }));
                inputField[0].dispatchEvent(new Event("change", {
                    bubbles: true
                }));
                // console.log(`Wager set to: ${amount}`);
            }
        } else {
            console.error("Wager input field not found!");
        }
    }

    function bindHotKeys() {
        $(document).on("keypress", function(e) {
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
            .map(function() {
            return Number($(this).text().replace("x", ""))
        })
            .get()

        if (arraysAreEqual(currentRollSet, lastRollSet)) {
            return -1
        }

        return currentRollSet[currentRollSet.length - 1]
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

    doInit();
})()