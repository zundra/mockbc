/* Start Script */
// ==UserScript==
// @name         bc.game squeeze roll v2
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://*.game/game/limbo?fast-roll=true
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bc.game
// @require https://code.jquery.com/jquery-3.6.0.min.js
// @require https://omnipotent.net/jquery.sparkline/2.1.2/jquery.sparkline.min.js
// @grant        none
// ==/UserScript==

(function() {
    "use strict";

    let lastRollSet = [];
    let currentRollSet = [];
    let rollCount = 0;
    let losingStreak = 0;
    let stopped = true;
    let hitCount = 0;
    let squeezeTarget = 0;
    let squeezeWager = 0;
    let squeezeAttemptCount = 1;
    const MIN_WAGER = 0.0001;

    const highHit = {
        payout: 0,
        round: 0,
        getSummary(rollCount) {
            return `${highHit.payout} || Delta: ${highHit.getRollDelta(rollCount)}`;
        },
        getRollDelta(rollCount) {
            return rollCount - highHit.round;
        },

        getDeltaColor(rollCount) {
            if (highHit.getRollDelta(rollCount) >= (highHit.payout * 2)) {
                return "red";
            }
            return "transparent";
        },
        reset() {
            highHit.payout = 0;
            highHit.round = 0;
        }
    }

    let teo = 0;

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



        <div id="stats" class="stats-box" style="
            margin: 12px 0;
            background-color: #444;
            padding: 10px;
            border-radius: 6px;
            color: white;
            font-size: 0.9rem;
            text-align: center;
        ">
        <div>Roll Count: <span id="roll-count"></span></div>
        <div>Hit Count: <span id="hit-count"></span></div>
        <div>High Hit: <span id="high-hit"></span></div>
        <div>Win Rate: <span id="win-rate"></span></div>
        <div>Losing Streak: <span id="losing-streak"></span></div>
        </div>

           <div class="control-group">
            <label>Hit Count Target</label>
            <input type="number" id="hit-count-target" value="0" />
            </div>

          <div class="control-group">
             <div class="control-group">
      <label>Squeeze Bet</label>
      <input id="squeeze-bet" type="checkbox"/>
   </div>

           <div class="control-group">
            <label>Default Squeeze Target</label>
            <input type="number" id="default-squeeze-target" value="10000" />
            </div>


            <label>Losing Streak Multiplier</label>
  <select id="ls-multiplier">
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
            <label>Max Rolls Multiplier</label>
  <select id="max-rolls-multiplier">
    <option value="0">0</option>
    <option value="0.05">0.05</option>
    <option value="0.1">0.1</option>
    <option value="0.2">0.2</option>
    <option value="0.3">0.3</option>
    <option value="0.4">0.4</option>
    <option value="0.5">0.5</option>
    <option value="1" selected>1</option>
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

    </div>
`;

    $("body").prepend(html);

    function evalResult(result) {
        rollCount++;
        if (result >= getPayout()) {
            hitCount++;
            losingStreak = 0;
        } else {
            losingStreak++;
        }

        if (result > highHit.payout) {
            highHit.payout = result;
            highHit.round = rollCount;
        }

        checkHalts(result);
        updateUI();
    }

    function checkHalts(result) {

        if (isSqueezeBet()){

        if (result >= getPayout()) {
            setMessage(`Target hit during squeeze ${getPayout()} setting to ${Math.ceil(highHit.payout)}`);
            setSqueeze(MIN_WAGER, Math.ceil(highHit.payout))
            highHit.reset();
             return;
        } else if (result >= Math.floor(squeezeTarget / 2)) {
             setMessage(`Lower squeeze target hit, resetting to ${Math.ceil(result)}`);
             const multiplier = rollCount < getMaxRolls() ? 1.5 : 2;
             setSqueeze(squeezeWager * multiplier, Math.ceil(result))
             return;
        } else if (highHit.payout !== 0 && rollCount >= highHit.payout) {
            const t = Math.max(10, Math.floor(highHit.payout / 2));
             setMessage(`Roll count exceeded during squeeze, resetting to ${t}`);
            setSqueeze(squeezeWager * 2, t)
             return;
        }
    }


    }

    function setSqueeze(wager, payout) {
        squeezeTarget = payout;
        squeezeWager = wager;
        setWager(squeezeWager)
        setPayout(squeezeTarget);
        rollCount = 0;
    }

    function updateUI() {
        const winRate = hitCount / rollCount;
        const wrtdiff = winRate - teo;

        $("#roll-count").html(rollCount);
              $("#hit-count").html(hitCount);
              $("#win-rate").html(`${(winRate.toFixed(2))} | ${(teo).toFixed(2)} | ${(wrtdiff).toFixed(2)}`);


      $("#high-hit").html(`${highHit.getSummary(rollCount)}`).css({backgroundColor: highHit.getDeltaColor(rollCount)});
      $("#losing-streak").html(`${losingStreak} (${(getPayout() - losingStreak).toFixed(2)})`);

    }

    function halt(stopMessage) {
        console.log(stopMessage)
        setMessage(stopMessage)
        stopMessage = ""
        stopBetting()
        return
    }

    function setMessage(message) {
        $("#message").text(message);
    }

    function getMaxRolls() {
                if (isSqueezeBet()) {
            return Math.floor(squeezeTarget);
        }

        return Math.ceil(getMaxRollMultiplier() * getPayout());
    }

    function isSqueezeBet() {
        return $("#squeeze-bet").prop("checked");
    }

    function getMaxRollMultiplier() {

        return  Number($("#max-rolls-multiplier").val());
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

  function getDefaultSqueezeTarget() {
    return Number($("#default-squeeze-target").val())
  }


  function getHitCountTarget() {
    return Number($("#hit-count-target").val())
  }

    function getLosingStreakMultiplier(payout) {
        return Number($("#ls-multiplier").val())
    }


    // Utility function: Get current roll data
    function getCurrentRollData() {
        return $(".grid.grid-auto-flow-column div span")
            .map(function() {
                return $(this).text();
            }).get();
    }

       function getTeo() {
        return 1 / (getPayout() * 1.05)
      }

    // Function to start the betting process
    function startBetting() {
        if (isSqueezeBet()) {
            squeezeTarget = Math.floor(getPayout() / 2);
                squeezeWager = getWager();
        }

        rollCount = 0;
        highHit.payout = 0;
        highHit.round = 0;
        teo = getTeo();
        hitCount = 0;
        losingStreak = 0;
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

    function getWager() {
        const payoutFieldGroup = $('div[role="group"]').has(
            'label:contains("Amount")',
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

    function initPrototypes() {
        Array.prototype.last = function() {
            return this[this.length - 1];
        };
        Array.prototype.first = function() {
            return this[0];
        };
    }

    function bindHotKeys() {
        $(document).on("keypress", function(e) {
            if (e.which === 122) {
                if (stopped) {
                    startBetting();
                } else {
                    stopBetting();
                }
            }
        });
    }

    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function doInit() {
        bindHotKeys();
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
            .map(function() {
                return Number($(this).text().replace("x", ""));
            }).get();

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

doInit()
    // Initialize MutationObserver
})()