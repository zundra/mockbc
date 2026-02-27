/* Start Script */
// ==UserScript==
// @name         bc.game (UI) v5
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
        const MAX_STRENGTH_BLOCKS = 10;
        const MAX_BLOCKS = 15;
        const SCALE_FACTOR = 3; // ✅ 2 bars per 1 ratio unit
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
            const pstreak = entry.getPreviousStreak();
            const ratio = entry.getRatio();
            const strength = entry.getStrength();
            const winRateChange = entry.getWinRateChange();
            const missingHits = entry.getHitBalance();
            const expectedHits = entry.getExpectedHits();

            const sanitizedTarget = `${target}`.replace(/\./g, "_");
            let row = table.find(`#row-${sanitizedTarget}`);

            if (row.length === 0) {
                row = $("<tr>")
                    .addClass("win-rate-row")
                    .attr("id", `row-${sanitizedTarget}`);


                const targetLabel = $("<td>")
                .addClass("win-rate-label")
                .text(`Target: ${target}`);

                const expectedContainer = $("<td>")
                .addClass("expected-gap-col")
                .text(`${missingHits.toFixed(2)}`);

                const blockContainer = $("<td>")
                .addClass("streak-blocks")
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

                row.append(targetLabel, expectedContainer, blockContainer, strengthContainer, teoContainer);
                table.append(row);
            }

            const blockContainer = row.find(".streak-blocks");
            const expectedContainer = row.find(".expected-gap-col");
            const strengthContainer = row.find(".strength-meter");
            const teoContainer = row.find(".teo-meter");

            expectedContainer.text(`${missingHits.toFixed(2)}`);
            const blocks = blockContainer.find(".streak-block");
            
            if (blocks.length >= MAX_BLOCKS) {
                blocks.last().remove();
            }

            const intensity = Math.min(Math.abs(strength) / 20, 1);
            const backgroundColor = strength > 0 ?
                  `rgba(0, 255, 0, ${intensity})` :
            `rgba(255, 0, 0, ${intensity})`;

            const needsNewBlock = entry.getStreakSignFlipped();

            if (needsNewBlock) {
                const streakBlock = $("<div>")
                .addClass("streak-block")
                .css({
                    backgroundColor: backgroundColor,
                    color: "white",
                    padding: "4px",
                    margin: "1px",
                    borderRadius: "4px",
                    textAlign: "center",
                    fontSize: "10px",
                    fontWeight: "bold",
                    minWidth: "30px",
                })
                .text(`${streak}`);

                blockContainer.prepend(streakBlock);
            } else {
            const firstBlock = blocks.first();
                firstBlock.css({
                    backgroundColor,
                }).text(`${streak}`);       
            }

            // **Ensure Strength Meter is Cleared and Updated**
            strengthContainer.empty();

            let strengthBars = Math.abs(strength);
            let fullBars = Math.floor(strengthBars);
            let fractionalPart = strengthBars - fullBars;
            fullBars = Math.min(fullBars, MAX_STRENGTH_BLOCKS);

            // Render full bars
            for (let i = 0; i < fullBars; i++) {
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

            // Render the fractional bar (if any)
            if (fractionalPart > 0) {
                strengthContainer.append(
                    $("<div>")
                    .addClass("strength-bar")
                    .css({
                        width: `${fractionalPart * 8}px`, // Scale based on remainder
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
        const p1 = [1.01, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2, 3, 4, 5, 6, 7, 8, 9]

        const p2 = Array.from({
            length: 20,
        },
                              (v, k) => 10 + k * 10,
                             )
        const p3 = [100, 200, 500, 1000, 5000, 10000, 100000, 1000000];

        const payouts = [...p1, ...p2, ...p3];
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
            constructor(payout, historySize = 5) {
                this.payout = payout;
                this.streak = 0;
                this.hitBalance = 0;
                this.pstreak = 0;
                this.historicalHits = this.generateHistoricalHits();
                this.hitCount = 0;
                this.windowHitCount = 0;
                this.windowRollCount = 0;
                this.rollCount = 0;
                this.leftTarget = null;
                this.rightTarget = null;
                this.streakHistory = [];
                this.streakHistorySize = 10;;
                this.streakSignFlipped = false;

                this.historySize = historySize;
                this.setWindowSize();
            }

            generateHistoricalHits() {
                const lookbacks = [100, 1000, 10000, 100000]
                const hitHistory = {};
                lookbacks.forEach((lookback) => hitHistory[lookback] = new HistoricalHit(lookback))
                return hitHistory;
            }

            updateStreakHistory() {
                const streak = this.getStreak();
                const pstreak = this.getPreviousStreak();

                if (this.getStreakSignFlipped()) {
                    this.streakHistory.push(streak);
                } else {
                    this.streakHistory.pop();
                   this.streakHistory.push(streak);
                }

                if (this.streakHistory.length > this.streakHistorySize) {
                    this.streakHistory.shift();
                }
            }

            getStreakHistory() {
                return this.streakHistory;
            }

            getStreakSignFlipped() {
                return this.streakSignFlipped;
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
                this.updateStreakHistory();
            }

            updateStreak(result) {
                if (this.rollCount % this.windowSize === 0) {
                    this.windowRollCount = 0;
                    this.windowHitCount = 0;
                }

                const cycleImpact = 1 / (this.getTeo() * this.getPayout()) / this.getPayout();

                if (result >= this.payout) {
                    this.windowHitCount++;
                    this.hitCount++;
                    this.incrementHits(true);
                    if (this.streak < 0) {
                        this.streakSignFlipped = true;
                        this.pstreak = this.streak;
                    } else {
                        this.streakSignFlipped = false;
                    }
                    this.streak = Math.max(this.streak + 1, 1);
                } else {
                    this.incrementHits(false);
                    if (this.streak > 0) {
                        this.streakSignFlipped = true;
                        this.pstreak = this.streak;
                    } else {
                        this.streakSignFlipped = false;
                    }
                    this.streak = Math.min(this.streak - 1, -1);
                }


            const edgeCompensation = 1 - this.getTeo() * this.getPayout()

                if (this.streak >= 0) {
                  this.hitBalance += this.getPayout() - 1 + edgeCompensation
                } else {
                  this.hitBalance -= 1 - edgeCompensation
                }
            }

            incrementHits(targetHit) {
                Object.values(this.historicalHits).forEach((historicalHit => historicalHit.setHit(targetHit)))
            }

            getStreak() {
                return this.streak;
            }

            getPreviousStreak() {
                return this.pstreak;
            }

            getLosingStreak() {
                return this.streak < 0 ? this.streak : 0;
            }

            getLosingStreakAbs() {
                return Math.abs(this.getLosingStreak())
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

            setWindowSize() {
                const baseFactor = 500;  // Increased from 100 to smooth scaling
                const expectedWindow = Math.ceil(baseFactor / this.getTeoPercent());
                const minWindow = Math.ceil(expectedWindow * 10);
                this.windowSize = this.payout <= 100 ? Math.max(minWindow, expectedWindow) : expectedWindow;
            }

            getWindowSize() {
                return this.windowSize;
            }

            getHitBalance() {
                return this.hitBalance;
            }

            getExpectedHits() {
                return (this.getTeoPercent() / 100) * this.getWindowSize();
            }

            getMissingHits() {
                return this.getExpectedHits() - this.getWindowHitCount();
            }

            getRequiredHitRate() {
                const neededHits = getMissingHits();
                const remainingRolls = this.getWindowSize() - this.getWindowRollCount();
                return neededHits / remainingRolls;
            }

            getWindowHitCount() {
                return this.windowHitCount;
            }

            getWindowRollCount() {
                this.getWindowHitCount;
            }

            getHitCount() {
                return this.hitCount;
            }

            getRollCount() {
                return this.rollCount;
            }

            hitRateExceedsExpectedRate(threshold) {
                return this.getRequiredHitRate() >= this.getTeo() * threshold;
            }

            getTeoPercent(target) {
                return this.getTeo() * 100;
            }

            getTeo() {
                return 1 / (this.payout * 1.05);
            }

            getStrength() {
                return Math.ceil(this.payout + this.streak) / this.payout
            }
            
            getRatio() {
                return Math.floor(this.streak / this.payout);
            }

            getWinRateChange() {
                const winRate = this.getWinRate();
                const teo = this.getTeo(); // Expected win rate

                if (teo === 0) return 0; // Prevent division by zero

                return ((winRate - teo) / teo) * 100;
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

            getWaveTargets() {
                const negativeTargets = this.targets.filter(target => target.getStrength() < 0);
                const trendingDown = negativeTargets.filter(target => target.isTrendingDown());

                return trendingDown.length >= Math.floor(negativeTargets.length * 0.7) ? trendingDown : [];
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

            countTargetSiblingsBelowThreshold(target, strengthThreshold, sum = 0) {
                const leftTarget = target.getLeftTarget();

                if (leftTarget && leftTarget.getStrength() < -strengthThreshold) {
                    sum++;
                    return this.countTargetSiblingsBelowThreshold(leftTarget, strengthThreshold, sum)
                }

                return sum;
            }

            getTargetsWithStrengthBelowThreshold(strengthThreshold) {
                return this.targets.filter((target) => target.getStrength() < -strengthThreshold)
            }

            getSupressedTargetCount(targets, strenthThreshold = 1) {
                return getTargetsWithStrengthBelowThreshold(strengthThreshold).length
            }

            getCRPTargets() {
                return this.targets.filter(target => target.hitRateExceedsExpectedRate(3)); // 3x CRP threshold
            }

            getCRPTarget() {
                return this.targets
                    .filter(target => target.hitRateExceedsExpectedRate(3) && target.getStrength() < -3) // 3x CRP threshold
                    .reduce((mostDivergent, target) => {
                    const divergence = target.getRequiredHitRate() / target.getTeo();
                    return !mostDivergent || divergence > mostDivergent.divergence
                        ? { target, divergence }
                    : mostDivergent;
                }, null)?.target || null;
            }

            getMaxNegativeStrengthTarget() {
                return this.targets.filter((target) => target.getStrength() < 0).sort((a, b) => b.getStrength() - a.getStrength()).first()
            }

            detectWave(target, depth = 0, waveCluster = [], maxDepth = 10, lookback = 3) {
                if (!target) return waveCluster; // Stop if non-negative
                if (depth >= maxDepth) return waveCluster; // Prevent infinite recursion

                // Use smoothed strength instead of raw value
                const smoothedStrength = this.getSmoothedStrength(target, lookback);
                if (smoothedStrength >= 0) return waveCluster; // Ensure trend is consistently negative

                // Add to wave cluster
                waveCluster.push(target);

                // Recursively check left and right targets
                let leftWave = this.detectWave(target.leftTarget, depth + 1, [...waveCluster], maxDepth, lookback);
                let rightWave = this.detectWave(target.rightTarget, depth + 1, [...waveCluster], maxDepth, lookback);

                return leftWave.length > rightWave.length ? leftWave : rightWave;
            }

            lowStrengthClusterParent(minClusterSize = 3, strengthThreshold = 2, lookback = 3) {
                let targets = this.getTargetsWithStrengthBelowThreshold(strengthThreshold);

                for (let i = 0; i < targets.length; i++) {
                    const count = this.countTargetSiblingsBelowThreshold(targets[i], strengthThreshold);
                    if (count >= minClusterSize) return targets[i];
                }
                return null;
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
                newWindow = window.open("", "", "width=800, height=1200");

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