/* Start Script */
// ==UserScript==
// @name         bc.game simple automation
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
    const ROLLS = [];

    let lastRollSet = []
    let currentRollSet = []
    let wagerTiers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    let currentRiskOnTarget = null
    let TARGETS = generateTargets();
    let riskOnLosingStreak = 0;
    let riskOnReTryCount = 0;
    let maxRatio = 0;

    var body = $('body');

    let html = `
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

            <label>Base Wager</label>
            <input type="number" id="base-wager" value="0.001" />
            
            <label>Losing Streak Multiplier</label>
            <select id="ls-multiplier" style="color: black;">
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
        </div>
`;

    body.prepend($(html));

    function evalResult(result) {
        SESSION.addRoll(result);

    }

    function setMessage(message) {
        $("#message").html(message)
    }

    function setPayout(amount) {
        const payoutFieldGroup = $('div[role="group"]').has(
            'label:contains("Payout")'
        );
        const inputField = payoutFieldGroup.find("input");

        if (inputField.length) {
            let nativeSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                "value"
            ).set;

            nativeSetter.call(inputField[0], amount); // Update input field value

            let event = new Event("input", {
                bubbles: true
            });
            inputField[0].dispatchEvent(event);

            let reactEvent = new Event("change", {
                bubbles: true
            });
            inputField[0].dispatchEvent(reactEvent); // React listens for change events

            // console.log(`Payout set to: ${amount}`);
        } else {
            console.error("Payout input field not found!");
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

    /********************* Framework *********************/
    function defaultSession() {
        return {
            state: {
                stopped: true,
                reason: ""
            },
            sessionRollCount: 0,
            globalRollCount: 0,
            addRoll: function(result) {
                this.sessionRollCount++;
                this.globalRollCount++;
            },
            getGlobalRollCount: function() {
                return this.globalRollCount;
            },
            getSessionRollCount: function() {
                return this.sessionRollCount;
            },
            start: function() {
                this.reset();
                this.state.stopped = false;
            },
            reset: function() {
                this.state.stopped = true;
                this.state.reason = ""
                this.sessionRollCount = 0;
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
            stop(reason = "") {
                this.state.reason = reason;
                this.state.stopped = true;
            }
        }
    }
    /* Configuration */
    function getStopOnWin() {
        return $("#stop-on-win").prop("checked");
    }

    function getLosingStreakMultiplier() {
        return Number($("#ls-multiplier").val());
    }

    function getBaseWager() {
        return Number($("#base-wager").val());
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
        riskOnTarget = generateTarget();
        riskOnTarget.setPayout(getBasePayout())
        riskOnTarget.setWager(getBaseWager())
        setWager(riskOnTarget.getWager())
        setPayout(riskOnTarget.getPayout())
        SESSION.start();
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


    function generateTarget() {
        class Target {
            constructor() {
                this.payout = 0;
                this.wager = 0;
            }

            setWager = (wager) => this.wager = wager;
            setPayout = (payout) => this.payout = payout;
            getWager = () => this.wager;
            getPayout = () => this.payout;
        }
        return new Target();
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