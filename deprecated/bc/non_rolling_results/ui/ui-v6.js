/* Start Script */
// ==UserScript==
// @name         bc.game (UI) v6
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

    const RESULTS = [];

    let lastRollSet = []
    let currentRollSet = []
    let ROLL_HANDLER = initRollHandler(RESULTS);
    let newWindow = null
    let Stats10 = new RollingStats(10);
    let Stats100 = new RollingStats(100);
    let Stats1000 = new RollingStats(1000);

    function evalResult(result) {
        ROLL_HANDLER.addResult(result);
        updateUI();
    }


    function getWinRateColor(payout, streak, wrpot) {
        if (wrpot > 100)
        {
            if (wrpot > 150) {
                return "green"
            }
            return "transparent";
        } else {
            if (Math.abs(streak) > payout && wrpot < 50) {
                return "red";
            }
        }

        return "transparent"
    }
function getTextColor(streak, target) {
    if (streak >= -target + 1) {
        return 'limegreen'; // Good, including positive or mild negative
    }

    if (streak >= -target * 2) {
        return '#AAAAAA'; // Neutral gray
    }

    return 'red'; // Bad: much worse than target
}


    function updateUI() {
        const targets = ROLL_HANDLER.getTargets();
        const MAX_STRENGTH_BLOCKS = 50;
        const MAX_BLOCKS = 15;
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
            const winRate = entry.getWinRate(5);
            const winRatePoT = entry.getWinRatePercentOfTeo(5);
            const winRateChangeShort = entry.getWinRateChange(5);
            const winRateChangeLong = entry.getWinRateChange(10);

            const streak = entry.getStreak();
            const pstreak = entry.getPreviousStreak();
            const ratio = entry.getRatio();
            const strength = entry.getStrength();

            const missingHits = entry.getHitBalance();

            const sanitizedTarget = `${target}`.replace(/\./g, "_");
            let row = table.find(`#row-${sanitizedTarget}`);

            if (row.length === 0) {
                row = $("<tr>")
                    .addClass("win-rate-row")
                    .attr("id", `row-${sanitizedTarget}`);


                const targetLabel = $("<td>")
                .addClass("win-rate-label")
                .text(`Target: ${target}`);

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

                const winRateContainerShort = $("<td>")
                .addClass("win-rate-meter-short")
                .css({
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: "120px",
                    position: "relative",
                });

                const winRateContainerLong = $("<td>")
                .addClass("win-rate-meter-long")
                .css({
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: "120px",
                    position: "relative",
                });

                row.append(targetLabel, blockContainer, strengthContainer, winRateContainerShort, winRateContainerLong);
                table.append(row);
            }

            const blockContainer = row.find(".streak-blocks");
            const strengthContainer = row.find(".strength-meter");
            const winRateContainerShort = row.find(".win-rate-meter-short");
            const winRateContainerLong = row.find(".win-rate-meter-long");

            const blocks = blockContainer.find(".streak-block");

            if (blocks.length >= MAX_BLOCKS) {
                blocks.last().remove();
            }

            const backgroundColor = getWinRateColor(target, streak, winRatePoT)
            const textColor = backgroundColor === "transparent" ? getTextColor(streak, target) : "white";
            const needsNewBlock = entry.getStreakSignFlipped() || blocks.length === 0;


            if (needsNewBlock) {
                const streakBlock = $("<div>")
                .addClass("streak-block")
                .css({
                    backgroundColor: backgroundColor,
                    color: textColor,
                    padding: "4px",
                    margin: "1px",
                    borderRadius: "4px",
                    textAlign: "center",
                    fontSize: "12px",
                    fontWeight: "bold",
                    minWidth: "30px",
                })
                .text(`${streak}`);

                blockContainer.prepend(streakBlock);
            } else {
                const firstBlock = blocks.first();
                firstBlock.css({
                    backgroundColor,
                    color: textColor,
                }).text(`${streak}`);
            }

            // **Ensure Strength Meter is Cleared and Updated**
            strengthContainer.empty();

            let strengthBars = Math.abs(strength) * SCALE_FACTOR;
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

            createWinRateBar(winRateContainerShort, winRateChangeShort);
            createWinRateBar(winRateContainerLong, winRateChangeLong);

        });
    }


    function createWinRateBar(winRateContainer, winRateChange) {
            // ✅ Ensure TEO meter is cleared and updated
            winRateContainer.empty();

            const winRateBar = $("<div>").addClass("win-rate-bar").css({
                position: "relative",
                width: "100px",
                height: "12px",
                background: "rgba(255, 255, 255, 0.1)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                borderRadius: "4px",
                overflow: "hidden",
                boxShadow: "0 0 5px rgba(0, 255, 0, 0.2)",
            });

            const winRateCenter = $("<div>").addClass("win-rate-bar-center").css({
                position: "absolute",
                left: "50%",
                width: "2px",
                height: "100%",
                background: "#fff",
                transform: "translateX(-50%)",
                boxShadow: "0 0 5px rgba(255, 255, 255, 0.5)",
            });

            const winRateLeft = $("<div>").addClass("win-rate-bar-left").css({
                background: "linear-gradient(to left, rgba(255, 0, 0, 0.8), rgba(255, 0, 0, 0.2))",
                height: "100%",
                position: "absolute",
                right: "50%",
                width: winRateChange < 0 ? `${Math.abs(winRateChange) * 2}%` : "0",
                boxShadow: "0 0 5px rgba(255, 0, 0, 0.8)",
                transition: "width 0.3s ease-in-out",
            });

            const winRateRight = $("<div>").addClass("win-rate-bar-right").css({
                background: "linear-gradient(to right, rgba(0, 255, 0, 0.8), rgba(0, 255, 0, 0.2))",
                height: "100%",
                position: "absolute",
                left: "50%",
                width: winRateChange > 0 ? `${winRateChange * 2}%` : "0",
                boxShadow: "0 0 5px rgba(0, 255, 0, 0.8)",
                transition: "width 0.3s ease-in-out",
            });

            winRateBar.append(winRateLeft, winRateRight, winRateCenter);
            winRateContainer.append(winRateBar);
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

    function initRollHandler(results) {
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
            constructor(payout, results) {
                this.payout = payout;
                this.results = results;
                this.streak = 0;
                this.hitBalance = 0;
                this.pstreak = 0;
                this.hitCount = 0;
                this.windowHitCount = 0;
                this.windowRollCount = 0;
                this.rollCount = 0;
                this.leftTarget = null;
                this.rightTarget = null;
                this.streakHistory = [];
                this.streakHistorySize = 10;;
                this.streakSignFlipped = false;
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
                    if (this.streak < 0) {
                        this.streakSignFlipped = true;
                        this.pstreak = this.streak;
                    } else {
                        this.streakSignFlipped = false;
                    }
                    this.streak = Math.max(this.streak + 1, 1);
                } else {
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

            getWinRateChange(lookback = 10) {
                const winRate = this.getWinRate(lookback);
                const teo = this.getTeo(); // Expected win rate

                if (teo === 0) return 0; // Prevent division by zero

                return ((winRate - teo) / teo) * 100;
            }

            getExpectedStrength() {
                const e = adjustmentFactor();
                return Math.ceil(e + this.streak) / this.payout;
            }
        }

        class RollHandler {
            constructor(targets, results) {
                this.results = results;
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
                this.results.push(result);
                
                if (this.results.length === 100) this.results.shift;

                Stats10.addValue(result);
                Stats100.addValue(result);
                Stats1000.addValue(result);
                this.targets.forEach((target) => target.addResult(result))
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
        const targets = payouts.map(payout => new Target(payout, results));

        targets.forEach((target, index) => {
            if (index > 0) target.setLeftTarget(targets[index - 1]);
            if (index < targets.length - 1) target.setRightTarget(targets[index + 1]);
        });

        return new RollHandler(targets, results);
    }


    function RollingStats(windowSize) {
        this.windowSize = windowSize;
        this.values = []; // Store last N values
        this.mean = 0;
        this.sumOfSquares = 0;

        this.addValue = function(value) {
            this.values.push(value);

            if (this.values.length > this.windowSize) {
                let removed = this.values.shift(); // Remove oldest value
                this.updateStats(-removed, removed); // Subtract old value from stats
            }

            this.updateStats(value, null); // Add new value to stats
        };

        this.updateStats = function(value, removed) {
            let count = this.values.length;

            // Update Mean
            let oldMean = this.mean;
            this.mean = this.values.reduce((sum, v) => sum + v, 0) / count;

            // Update Variance (numerically stable formula)
            this.sumOfSquares = this.values.reduce((sum, v) => sum + (v - this.mean) ** 2, 0);
        };

        this.getMean = function() {
            return this.mean;
        };

        this.getVariance = function() {
            let count = this.values.length;
            return count > 1 ? this.sumOfSquares / (count - 1) : 0;
        };

        this.getStandardDeviation = function() {
            return Math.sqrt(this.getVariance());
        };

        this.getMedian = function() {
            if (this.values.length === 0) return null;
            let sorted = [...this.values].sort((a, b) => a - b);
            let mid = Math.floor(sorted.length / 2);

            return sorted.length % 2 === 0
                ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
        };
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
               <tr id="row-1_5">
               </tr>
            </tbody>
         </table>
      </div>
   </div>
   </div>
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