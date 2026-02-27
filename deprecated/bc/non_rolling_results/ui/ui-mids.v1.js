/* Start Script */
// ==UserScript==
// @name         bc.game (UI) mids v1
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

    let lastRollSet = []
    let currentRollSet = []
    let ROLL_HANDLER = initRollHandler();
    let newWindow = null


    function evalResult(result) {
        ROLL_HANDLER.addResult(result);
        updateUI();
    }


function updateUI() {
    const targets = ROLL_HANDLER.getTargets();
    const MAX_STRENGTH_BLOCKS = 25;
    const MAX_BLOCKS = 10;
    const SCALE_FACTOR = 2; // ✅ 2 bars per 1 ratio unit
    const winRateContainer = getNewWindowHTMLNode("#winRateContainer");

    if (!winRateContainer || winRateContainer.length === 0) {
        console.error("Win rate container not found in new window!");
        return;
    }

    // Ensure the table structure exists
    let table = winRateContainer.find(".win-rate-table");
    if (table.length === 0) {
        table = $("<table>").addClass("win-rate-table").append("<tbody>");
        winRateContainer.append(table);
    }

    targets.forEach(entry => {
        const target = entry.getPayout();
        const winRate = entry.getWinRate();
        const streak = entry.getStreak();
        const ratio = entry.getRatio();
        const strength = entry.getExpectedStrength();
        const winRateChange = entry.getWinRateChange();
        const expectedGap = entry.adjustedExpectedGap();

        const sanitizedTarget = `${target}`.replace(/\./g, "_");
        let row = table.find(`#row-${sanitizedTarget}`);

        if (row.length === 0) {
            row = $("<tr>")
                .addClass("win-rate-row")
                .attr("id", `row-${sanitizedTarget}`);


            const targetLabel = $("<td>")
                .addClass("win-rate-label")
                .text(`Target: ${target}`);

            const expectedGapContainer = $("<td>")
                .addClass("expected-gap-col")
                .text(`${expectedGap}`);

            const streakCol = $("<td>")
                .addClass("streak-col")
                .text(`${streak} | ${ratio}`);

            const blockContainer = $("<td>")
                .addClass("win-rate-blocks")
                .css({
                    display: "flex",
                    gap: "2px",
                    minWidth: "250px",
                });

            const strengthContainer = $("<td>")
                .addClass("strength-meter")
                .css({
                    display: "flex",
                    gap: "2px",
                    minWidth: "100px",
                    minHeight: "14px",
                    justifyContent: "flex-start",
                });

            const teoContainer = $("<td>")
                .addClass("teo-meter")
                .css({
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: "120px",
                    position: "relative",
                });

            row.append(targetLabel, expectedGapContainer, streakCol, blockContainer, strengthContainer, teoContainer);
            table.append(row);
        }

        const blockContainer = row.find(".win-rate-blocks");
        const expectedGapContainer = row.find(".expected-gap-col");
        const strengthContainer = row.find(".strength-meter");
        const streakContainer = row.find(".streak-col");
        const teoContainer = row.find(".teo-meter");

        streakContainer.text(`${streak} | ${ratio}`);
        expectedGapContainer.text(expectedGap)

        const blocks = blockContainer.find(".win-rate-block");
        if (blocks.length >= MAX_BLOCKS) {
            blocks.first().remove();
        }

        const intensity = Math.min(Math.abs(winRate) / 20, 1);
        const backgroundColor = winRate > 0 ?
            `rgba(0, 255, 0, ${intensity})` :
            `rgba(255, 0, 0, ${intensity})`;

        const streakIntensity = Math.min(Math.abs(streak) / (target * 4), 1);
        const fontColor = streak > 0 ?
            `rgba(0, 255, 255, ${streakIntensity})` :
            `rgba(255, 255, 0, ${streakIntensity})`;

        const winRateBlock = $("<div>")
            .addClass("win-rate-block")
            .css({
                backgroundColor: backgroundColor,
                color: fontColor,
                padding: "4px",
                margin: "1px",
                borderRadius: "4px",
                textAlign: "center",
                fontSize: "10px",
                fontWeight: "bold",
                minWidth: "30px",
            })
            .text(`${winRate.toFixed(2)} | ${streak}`);

        blockContainer.append(winRateBlock);

        // **Ensure Strength Meter is Cleared and Updated**
        strengthContainer.empty();

        let strengthBars = Math.min(Math.abs(strength) * SCALE_FACTOR, MAX_STRENGTH_BLOCKS);

        for (let i = 0; i < Math.max(1, strengthBars); i++) {
            strengthContainer.append(
                $("<div>")
                .addClass("strength-bar")
                .css({
                    width: "8px",
                    height: "14px",
                    backgroundColor: strength > 0 ? "lightgreen" : "red",
                    borderRadius: "2px",
                })
            );
        }

        // ✅ Ensure TEO meter is cleared and updated
        teoContainer.empty();

        const teoBar = $("<div>").addClass("teo-bar").css({
            position: "relative",
            width: "100px",
            height: "12px",
            background: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            borderRadius: "4px",
            overflow: "hidden",
            boxShadow: "0 0 5px rgba(0, 255, 0, 0.2)",
        });

        const teoCenter = $("<div>").addClass("teo-center").css({
            position: "absolute",
            left: "50%",
            width: "2px",
            height: "100%",
            background: "#fff",
            transform: "translateX(-50%)",
            boxShadow: "0 0 5px rgba(255, 255, 255, 0.5)",
        });

        const teoLeft = $("<div>").addClass("teo-left").css({
            background: "linear-gradient(to left, rgba(255, 0, 0, 0.8), rgba(255, 0, 0, 0.2))",
            height: "100%",
            position: "absolute",
            right: "50%",
            width: winRateChange < 0 ? `${Math.abs(winRateChange) * 2}%` : "0",
            boxShadow: "0 0 5px rgba(255, 0, 0, 0.8)",
            transition: "width 0.3s ease-in-out",
        });

        const teoRight = $("<div>").addClass("teo-right").css({
            background: "linear-gradient(to right, rgba(0, 255, 0, 0.8), rgba(0, 255, 0, 0.2))",
            height: "100%",
            position: "absolute",
            left: "50%",
            width: winRateChange > 0 ? `${winRateChange * 2}%` : "0",
            boxShadow: "0 0 5px rgba(0, 255, 0, 0.8)",
            transition: "width 0.3s ease-in-out",
        });

        teoBar.append(teoLeft, teoRight, teoCenter);
        teoContainer.append(teoBar);
    });
}




    // Utility function: Get current roll data
    function getCurrentRollData() {
        return $(".grid.grid-auto-flow-column div span")
            .map(function() {
                return $(this).text()
            })
            .get()
    }

    function stopBetting() {
        SESSION.stop();
    }

    function doInit() {
        observeRollChanges()
        initPrototypes()
    }

    function initRollHandler() {
        const payouts = [3, 4, 5, 6, 7, 8, 9]

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

            getStrength() {
                return Math.ceil(this.payout + this.streak) / this.payout//;
            }

            getRatio() {
                  return Math.floor(this.streak / this.payout);
            }
            getLSRatio() {
                return Math.floor((this.getLosingStreak() + this.getPayout()) / this.payout);
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

            getExpectedStrength() {
                const e = this.adjustedExpectedGap();
                return Math.ceil(e + this.streak) / this.payout;
            }

            adjustedExpectedGap() {
                const teo = this.getTeo();
                const actualWinRate = this.getWinRate();

                let expectedGap = (1 / teo) - 1; // Base expected gap assuming perfect TEO

                if (actualWinRate === 0) return Math.ceil(expectedGap); // Prevent division by zero

                let adjustmentFactor = actualWinRate >= teo
                ? actualWinRate / teo  // Expand gap when actual win rate is higher
                : teo / actualWinRate;  // Shrink gap when actual win rate is lower

                return Math.ceil(expectedGap * adjustmentFactor);
            }

            getWinRateChange() {
    const winRate = this.getWinRate();
    const teo = this.getTeo(); // Expected win rate

    if (teo === 0) return 0; // Prevent division by zero

    return ((winRate - teo) / teo) * 100;
}

        }

        class RollHandler {
            constructor(targets) {
                this.targets = targets;
            }
            getTargets() {
                return this.targets;
            }

            addResult(result) {
                this.targets.forEach(target => target.addResult(result));
            }

            getRiskConditionStopTarget(ratio) {
                return this.targets
                    .filter(target => target.getLSRatioAbs() >= ratio && target.getWinRate() < target.getTeo())
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


    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms))
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

    function getNewWindowHTMLNode(hook) {
        return $(newWindow.document).find(hook);
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

    window.addEventListener("beforeunload", function() {
        if (newWindow && !newWindow.closed) {
            newWindow.close()
        }
    })

    window.addEventListener(
        "load",
        function() {
            (function() {
                // Open a new floating window with specified dimensions
                newWindow = window.open("", "", "width=600, height=600");

                // Define the HTML content for the new window
                const htmlContent = `
<!DOCTYPE html>
<html lang="en">
   <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Target Streaks</title>
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
         /* Draggable Stats Pane */
         .stats-pane {
         position: absolute;
         top: 60px;
         left: 10px;
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
         .message-box {
         margin-bottom: 10px;
         background-color: #333;
         padding: 10px;
         border-radius: 4px;
         color: white;
         font-size: 0.9rem;
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

.win-rate-blocks {
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
                <tr id="row-1_5">
                </tr>
            </tbody>
        </table>
</div>
         <!-- Draggable Stats Pane -->
         <div class="stats-pane" id="statsPane" style="display:none;">
            <div class="message-box" id="message">Welcome! Configure your settings to begin.</div>
            <h2>Statistics</h2>
            <div>Global Roll Count: <span id="global-rollcount">0</span></div>
            <div>Session Roll Count: <span id="rollcount">0</span></div>
            <div>Rolls Remaining: <span id="rolls-remaining">100</span></div>
            <div>Hit Count: <span id="hitcount">0</span></div>
            <div>Win Rate: <span id="win-rate">NaN</span></div>
            <div>High Hit 1000: <span id="high-hit-1000">0</span></div>
            <div>High Hit 100: <span id="high-hit-100">0</span></div>
            <div>High Hit 10: <span id="high-hit-10">0</span></div>
            <hr />
          <div>10 Std: <span id="std-dev-10">0</span></div>
          <div>50 Std: <span id="std-dev-50">0</span></div>
          <div>100 Std: <span id="std-dev-100">0</span></div>
          <hr />
          <div>10 Med: <span id="med-10">0</span></div>
          <div>50 Med: <span id="med-50">0</span></div>
          <div>100 Med: <span id="med-100">0</span></div>
          <hr />
         </div>


         </div>
      </div>
      <script>
         const statsPane = document.getElementById('statsPane');

         // Enable dragging for the stats pane
         let offsetX = 0, offsetY = 0, isDragging = false;

         statsPane.addEventListener('mousedown', (e) => {
           isDragging = true;
           offsetX = e.clientX - statsPane.offsetLeft;
           offsetY = e.clientY - statsPane.offsetTop;
         });

         document.addEventListener('mousemove', (e) => {
           if (!isDragging) return;
           statsPane.style.left = \`\${e.clientX - offsetX}px\`;
           statsPane.style.top = \`\${e.clientY - offsetY}px\`;
         });

         document.addEventListener('mouseup', () => {
           isDragging = false;
         });
      </script>
   </body>
</html>
`;


                // Write the content to the new window
                newWindow.document.write(htmlContent);
                newWindow.document.close();
            })();
        },
        false
    );
    doInit();
})()