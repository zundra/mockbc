/* Start Script */
// ==UserScript==
// @name         bc.game Analytics (UI With Strength Bars) v1
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://*.game/game/limbo*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bc.game
// @require https://code.jquery.com/jquery-3.6.0.min.js
// @grant        none
// ==/UserScript==


(function() {
    "use strict"

    if (!Array.prototype.last) {
        Array.prototype.last = function() {
            return this[this.length - 1];
        };
    }

    const PAYOUTS = generatePayouts()

    let STOP_CANDIDATES = [];
    const WIN_RATE_DIFFS_1 = [];
    const WIN_RATE_DIFFS_2 = [];
    const WIN_RATE_DIFFS_3 = [];
    const WIN_RATE_AVG_1 = [];
    const WIN_RATE_AVG_2 = [];
    const WIN_RATE_AVG_3 = [];
    let rollStopCount = 0
    let rollsRemaining = 0
    let soundTriggered = false;
    let totalWinRateAvg = 0;
    class RollHandler {
        constructor() {
            this.results = []
        }

        addResult(result) {
            if (this.results.length === 200) this.results.shift();

            this.results.push(result)
        }

        getResults() {
            return this.results
        }

        getLosingStreak(target) {
            let streak = 0

            for (let i = this.results.length - 1; i >= 0; i--) {
                if (this.results[i] < target) {
                    streak++
                } else {
                    break
                }
            }

            return streak
        }


        // Calculate Y needed to bring median back to 1.98
        calculateMinimumY(lookback) {
            const target = 1.98;
            const array = this.results.slice(lookback)
                // Step 1: Sort the array
            array.sort((a, b) => a - b);

            // Step 2: Remove the smallest element (shift)
            array.shift();

            // Step 3: Current middle elements
            let index5 = array[4]; // 5th element in the sorted array
            let index6 = array[5]; // 6th element in the sorted array

            // Step 4: Calculate y for each case
            let yCase1 = target; // If y replaces one of the middle elements
            let yCase2 = 2 * target - index5; // If y shifts the 6th element

            // Step 5: Find the minimum y needed
            let y = Math.max(yCase1, yCase2);
            return parseFloat(y.toFixed(2)); // Return rounded to 2 decimal places
        }

        getWinLoseStreaks(target) {
            const streaks = [];
            let currentStreak = 0;

            for (const result of this.results) {
                if (result < target) {
                    if (currentStreak > 0) {
                        streaks.push({
                            streak: currentStreak,
                            ratio: -(Math.floor(Math.abs(currentStreak) / target)),
                            strength: (Math.floor(currentStreak / target))
                        });
                        currentStreak = 0;
                    }
                    currentStreak--;
                } else {
                    if (currentStreak < 0) {
                        streaks.push({
                            streak: currentStreak,
                            ratio: (Math.floor(currentStreak / target)),
                            strength:(Math.floor(currentStreak / target))
                        });
                        currentStreak = 0;
                    }
                    currentStreak++;
                }
            }

            if (currentStreak !== 0) {
                streaks.push({
                    streak: currentStreak,
                    ratio: (Math.floor(currentStreak / target)),
                    strength: (Math.floor(currentStreak / target))
                });
            }

            return streaks;
        }


        getWinRates(target, lookbacks = []) {
            const totals = Array(lookbacks.length).fill(0); // Initialize total wins for each lookback
            let totalGames = 0;

            // Adjust lookbacks to not exceed available data
            const adjustedLookbacks = lookbacks.map(lb => Math.min(lb, this.results.length));

            // Iterate backward through the results array
            for (let i = this.results.length - 1; i >= 0; i--) {
                const result = this.results[i];
                totalGames++;

                // Update win counts for all relevant lookbacks
                for (let j = 0; j < adjustedLookbacks.length; j++) {
                    if (totalGames <= adjustedLookbacks[j]) {
                        if (result >= target) totals[j]++;
                    }
                }

                // Early exit: stop once we have processed the largest lookback
                if (totalGames >= Math.max(...adjustedLookbacks)) break;
            }

            // Calculate win rates for each lookback
            const winRates = adjustedLookbacks.map((lookback, index) => ({
                lookback,
                winRate: (totals[index] / Math.min(lookback, totalGames)) * 100
            }));

            return winRates;
        }


        getStdDevs(lookbacks = []) {
            const results = []; // Store the calculated standard deviations
            const totals = Array(lookbacks.length).fill(0); // Total sum for each lookback
            const totalsSquared = Array(lookbacks.length).fill(0); // Sum of squares for each lookback
            const counts = Array(lookbacks.length).fill(0); // Count of elements for each lookback

            // Adjust lookbacks to not exceed available data
            const adjustedLookbacks = lookbacks.map(lb => Math.min(lb, this.results.length));

            // Iterate backward through the results array
            for (let i = this.results.length - 1; i >= 0; i--) {
                const value = this.results[i];

                for (let j = 0; j < adjustedLookbacks.length; j++) {
                    if (counts[j] < adjustedLookbacks[j]) {
                        totals[j] += value;
                        totalsSquared[j] += value * value;
                        counts[j]++;

                        // Compute stdDev when the lookback window is fully populated
                        if (counts[j] === adjustedLookbacks[j]) {
                            const mean = totals[j] / counts[j];
                            const variance = totalsSquared[j] / counts[j] - mean * mean;

                            results.push({
                                lookback: adjustedLookbacks[j],
                                stdDev: Math.sqrt(variance),
                            });
                        }
                    }
                }
            }

            return results;
        }

        getMedians(lookbacks = []) {
            const results = []; // Store the calculated medians
            const buffers = Array(lookbacks.length).fill(null).map(() => []); // Buffers for each lookback

            // Adjust lookbacks to not exceed available data
            const adjustedLookbacks = lookbacks.map(lb => Math.min(lb, this.results.length));

            // Iterate backward through the results array
            for (let i = this.results.length - 1; i >= 0; i--) {
                const value = this.results[i];

                for (let j = 0; j < adjustedLookbacks.length; j++) {
                    const buffer = buffers[j];

                    // Add the current value to the buffer
                    buffer.push(value);

                    // Keep only the required lookback size
                    if (buffer.length > adjustedLookbacks[j]) {
                        buffer.shift();
                    }

                    // Calculate the median once the buffer matches the lookback size
                    if (buffer.length === adjustedLookbacks[j]) {
                        const sortedBuffer = [...buffer].sort((a, b) => a - b);
                        const mid = Math.floor(sortedBuffer.length / 2);
                        const median =
                            sortedBuffer.length % 2 === 0 ?
                            (sortedBuffer[mid - 1] + sortedBuffer[mid]) / 2 :
                            sortedBuffer[mid];

                        results.push({
                            lookback: adjustedLookbacks[j],
                            median,
                        });
                    }
                }
            }

            return results;
        }
    }

    const ROLL_HANDLER = new RollHandler()
    let newWindow = null

    function calculateTeo(target) {
        return (100 / (target * 1.05));
    }

    function getWinCountStop(target, rollCount) {
        const teo = calculateTeo(target)
        return Math.ceil((teo / 100) * rollCount);
    }

    function aggregateWinRates() {
        const winRates = {};

        PAYOUTS.forEach((target) => {
            winRates[target] = ROLL_HANDLER.getWinRates(target, getLookBacks(target))
        });

        return winRates;
    }

    let lastRollSet = []
    let currentRollSet = []
    let medians = [];
    let stdDevs = [];

    const ANALYTICS = defaultAnalytics();

    // Utility function: Get current roll data
    function getCurrentRollData() {
        return $(".grid.grid-auto-flow-column div span")
            .map(function() {
                return $(this).text()
            })
            .get()
    }

    function getLSBackgroundColor(target, streak) {
        if (streak > 0) return "";
        const ratio = (target / Math.abs(streak));
        const alpha = 1 - (1 * ratio);
        return `background-color: rgb(255 0 0 / ${alpha})`;
    }

    function getRBGRatio(target, streak) {
        return (255 - Math.max(0, Math.floor(255 * (target / Math.abs(streak)))));
    }

    function getLookBacks(target) {
        return [50, 100, 200]

        if (target <= 2) {
            return [10, 20, 100]
        }

        if (target <= 10) {
            return [50, 100, 200]
        }

        return [100, 200, 1000]
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
    async function observeRollChanges() {
        const gridElement = await waitForSelector(".grid.grid-auto-flow-column")
        let previousRollData = getCurrentRollData()

        const observer = new MutationObserver((mutationsList) => {
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
                let result = getRollResult();
                ROLL_HANDLER.addResult(result);
                updateData(result);
                printOutput();

            }
        })

        observer.observe(gridElement, {
            childList: true,
            subtree: true,
        })
    }

    /* End BC Embedded */
    function generatePayouts(start, step, length) {
        return [1.01, 1.05, 1.10, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.45, 1.5, 1.55, 1.6, 1.65, 1.7, 1.75, 1.8, 1.85, 1.9, 1.95, 2]
        // const p1 = [1.92, 2, 3, 4, 5, 6, 7, 8, 9]

        // const p2 = Array.from({
        //         length: 20,
        //     },
        //     (v, k) => 10 + k * 5,
        // )
        // const p3 = [100, 200, 500, 1000, 5000, 10000];

        // return [...p1, ...p2, ...p3];
    }

    function arraysAreEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false
        return arr1.every((value, index) => value === arr2[index])
    }

    const UI_DATA = [];

    function updateData(result) {
        const payout = getPayout();
        WIN_RATE_DIFFS_1.length = 0;
        WIN_RATE_DIFFS_2.length = 0;
        WIN_RATE_DIFFS_3.length = 0;
        WIN_RATE_AVG_1.length = 0;
        WIN_RATE_AVG_2.length = 0;
        WIN_RATE_AVG_3.length = 0;
        UI_DATA.length = 0;
        const lookbacks = getLookBacks();
        for (let i = 0; i < PAYOUTS.length; i++) {

            const teo = calculateTeo(PAYOUTS[i])
            const winRates = ROLL_HANDLER.getWinRates(PAYOUTS[i], lookbacks);
            const streakObject = ROLL_HANDLER.getWinLoseStreaks(PAYOUTS[i]).last();
            const streak = streakObject.streak;
            const strength = streakObject.strength;

            WIN_RATE_DIFFS_1.push(winRates[0].winRate - teo);
            WIN_RATE_DIFFS_2.push(winRates[1].winRate - teo);
            WIN_RATE_DIFFS_3.push(winRates[2].winRate - teo);

            const uiDataObject = {};

            uiDataObject[PAYOUTS[i]] = {
                winRate: (winRates[1].winRate - teo),
                streak: streak,
                strength: strength
            };
            UI_DATA.push(uiDataObject);
        }


        WIN_RATE_AVG_1.push(getAverage(WIN_RATE_DIFFS_1));
        WIN_RATE_AVG_2.push(getAverage(WIN_RATE_DIFFS_2));
        WIN_RATE_AVG_3.push(getAverage(WIN_RATE_DIFFS_3));
        const lb1 = lookbacks[0];
        const lb2 = lookbacks[1];
        const lb3 = lookbacks[2];

        const averageData = {};

        averageData[lb1] = WIN_RATE_AVG_1;
        averageData[lb2] = WIN_RATE_AVG_2;
        averageData[lb3] = WIN_RATE_AVG_3;

        updateStateBlocksForAverages(averageData)
        updateUI(UI_DATA);

        totalWinRateAvg = getAverage(WIN_RATE_DIFFS_1);

        medians = ROLL_HANDLER.getMedians(lookbacks);
        stdDevs = ROLL_HANDLER.getStdDevs(lookbacks);

        if (result >= payout) ANALYTICS.hitCount++;

        ANALYTICS.rollCount++;
        ANALYTICS.globalRollCount.count++;

        setHighHit(ANALYTICS.highHits.allTime, result);
        setHighHit(ANALYTICS.highHits.thousand, result);
        setHighHit(ANALYTICS.highHits.hundred, result);
        setHighHit(ANALYTICS.highHits.ten, result);
    }

    function printOutput() {

        if (stdDevs.length >= 1) {
            getNewWindowHTMLNode("#std-dev-10").html(
                `<span style="color: ${stdDevs[0].stdDev < 1 ? "red" : "white"}">${stdDevs[0].stdDev.toFixed(2)}</span>`,
            )
        }

        if (stdDevs.length >= 2) {
            getNewWindowHTMLNode("#std-dev-50").html(
                `<span style="color: ${stdDevs[1].stdDev < 1 ? "red" : "white"}">${stdDevs[1].stdDev.toFixed(2)}</span>`,
            )
        }

        if (stdDevs.length >= 3) {
            getNewWindowHTMLNode("#std-dev-100").html(
                `<span style="color: ${stdDevs[2].stdDev < 1 ? "red" : "white"}">${stdDevs[2].stdDev.toFixed(2)}</span>`,
            )
        }

        if (medians.length >= 1) {
            getNewWindowHTMLNode("#med-10").html(
                `<span style="color: ${$}{medians[0].median < 1.9 ? "red" : "white"}">${medians[0].median.toFixed(2)}</span>`,
            )
        }

        if (medians.length >= 2) {
            getNewWindowHTMLNode("#med-50").html(
                `<span style="color: ${medians[1].median < 1.9 ? "red" : "white"}">${medians[1].median.toFixed(2)}</span>`,
            )
        }

        if (medians.length >= 3) {
            getNewWindowHTMLNode("#med-100").html(
                `<span style="color: ${medians[2].median < 1.9 ? "red" : "white"}">${medians[2].median.toFixed(2)}</span>`,
            )
        }
        getNewWindowHTMLNode("#global-rollcount").html(ANALYTICS.globalRollCount.count)


        getNewWindowHTMLNode("#win-rate").html(`${(ANALYTICS.hitCount / ANALYTICS.rollCount * 100).toFixed(2)} (${calculateTeo(getPayout()).toFixed(2)})`)
        getNewWindowHTMLNode("#total-win-rate-avg").html(`${(totalWinRateAvg).toFixed(2)}`)
        getNewWindowHTMLNode("#rollcount").html(ANALYTICS.rollCount)
        getNewWindowHTMLNode("#hitcount").html(ANALYTICS.hitCount)

        getNewWindowHTMLNode("#global-ath-diff").html(Math.round(ANALYTICS.highHits.allTime.payout - ANALYTICS.globalRollCount.count))
        getNewWindowHTMLNode("#session-ath-diff").html(Math.round(ANALYTICS.highHits.allTime.payout - ANALYTICS.highHits.allTime.rollCount))

        getNewWindowHTMLNode("#all-time-high").html(ANALYTICS.highHits.allTime.payout)
        getNewWindowHTMLNode("#all-time-high-rounds-ago").html(ANALYTICS.highHits.allTime.rollCount)
        getNewWindowHTMLNode("#all-time-high-rounds-ago-diff").html(getRoundAgoDiff(ANALYTICS.highHits.allTime))


        getNewWindowHTMLNode("#high-hit-10").html(ANALYTICS.highHits.ten.payout)
        getNewWindowHTMLNode("#high-hit-10-rounds-ago").html(ANALYTICS.highHits.ten.rollCount)
        getNewWindowHTMLNode("#high-hit-10-rounds-ago-diff").html(getRoundAgoDiff(ANALYTICS.highHits.ten))


        getNewWindowHTMLNode("#high-hit-100").html(ANALYTICS.highHits.hundred.payout)
        getNewWindowHTMLNode("#high-hit-100-rounds-ago").html(ANALYTICS.highHits.hundred.rollCount)
        getNewWindowHTMLNode("#high-hit-100-rounds-ago-diff").html(getRoundAgoDiff(ANALYTICS.highHits.hundred))

        getNewWindowHTMLNode("#high-hit-1000").html(ANALYTICS.highHits.thousand.payout)
        getNewWindowHTMLNode("#high-hit-1000-rounds-ago").html(ANALYTICS.highHits.thousand.rollCount)
        getNewWindowHTMLNode("#high-hit-1000-rounds-ago-diff").html(getRoundAgoDiff(ANALYTICS.highHits.thousand))

    }

    function getPayout() {
        const payoutFieldGroup = $('div[role="group"]').has(
            'label:contains("Payout")',
        )
        const inputField = payoutFieldGroup.find("input")

        return Number(inputField.val())
    }

    function updateStateBlocksForAverages(averageData) {
        return;
        // Neutral threshold to define the range for neutrality
        const NEUTRAL_THRESHOLD = 0.1;

        // Maximum number of blocks per row
        const MAX_BLOCKS = 30;

        // Reference the container for state blocks
        const stateBlockContainer = getNewWindowHTMLNode("#stateBlockContainer");

        // Ensure the container exists
        if (!stateBlockContainer || stateBlockContainer.length === 0) {
            console.error("State block container not found!");
            return;
        }

        // Iterate over each lookback key in the averageData object
        Object.entries(averageData).forEach(([lookback, averages]) => {
            // Check if the row for this lookback already exists
            let rowContainer = stateBlockContainer.find(`#row-${lookback}`);
            if (rowContainer.length === 0) {
                // Create a row container for this lookback
                rowContainer = $("<div>")
                    .addClass("state-block-row")
                    .attr("id", `row-${lookback}`)
                    .append(`<div class="lookback-label">Lookback: ${lookback}</div>`); // Add a label
                stateBlockContainer.append(rowContainer);
            }

            // Keep track of the last block and its state
            let lastBlock = rowContainer.children(".state-block").last();
            let previousState = lastBlock.data("state") || null;

            averages.forEach(avg => {
                let currentState;

                // Determine the current state with neutral threshold consideration
                if (avg > NEUTRAL_THRESHOLD) {
                    currentState = "positive";
                } else if (avg < -NEUTRAL_THRESHOLD) {
                    currentState = "negative";
                } else {
                    currentState = "neutral";
                }

                // Normalize intensity based on max threshold
                let intensity = Math.min(Math.abs(avg) / 5, 1);

                // Define colors based on state
                let color;
                if (currentState === "positive") {
                    color = `rgba(0, 255, 0, ${intensity})`; // Green for positive
                } else if (currentState === "negative") {
                    color = `rgba(255, 0, 0, ${intensity})`; // Red for negative
                } else {
                    color = "rgba(200, 200, 200, 0.5)"; // Neutral (grayish)
                }

                if (currentState === previousState) {
                    // Update the gradient intensity of the existing block
                    lastBlock.css("background", color).attr("title", `State: ${currentState}, Average: ${avg.toFixed(2)}`);
                } else {
                    // Create a new block only when the state fully shifts
                    const newBlock = $("<div>")
                        .addClass("state-block")
                        .css("background", color)
                        .attr("title", `State: ${currentState}, Average: ${avg.toFixed(2)}`)
                        .data("state", currentState); // Save the state in the block

                    // Append the new block to the row
                    rowContainer.append(newBlock);

                    // Update lastBlock and previousState
                    lastBlock = newBlock;
                    previousState = currentState;

                    // Ensure the row doesn't exceed the maximum number of blocks
                    if (rowContainer.children(".state-block").length > MAX_BLOCKS) {
                        rowContainer.children(".state-block").first().remove(); // Remove the oldest block
                    }
                }
            });
        });
    }


function updateUI(uiData) {
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

    uiData.forEach(entry => {
        const target = Object.keys(entry)[0];
        const { winRate, streak, strength: ratio } = Object.values(entry)[0]; // ✅ Now using ratio instead of strength

        const sanitizedTarget = target.replace(/\./g, "_");
        let row = table.find(`#row-${sanitizedTarget}`);

        if (row.length === 0) {
            row = $("<tr>")
                .addClass("win-rate-row")
                .attr("id", `row-${sanitizedTarget}`);

            const streakCol = $("<td>")
                .addClass("streak-col")
                .text(`${streak} | ${ratio}`);

            const targetLabel = $("<td>")
                .addClass("win-rate-label")
                .text(`Target: ${target}`);

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

            row.append(targetLabel, streakCol, blockContainer, strengthContainer);
            table.append(row);
        }

        const blockContainer = row.find(".win-rate-blocks");
        const strengthContainer = row.find(".strength-meter");
        const streakContainer = row.find(".streak-col");

        streakContainer.text(`${streak} | ${ratio}`);

        const blocks = blockContainer.find(".win-rate-block");
        if (blocks.length >= MAX_BLOCKS) {
            blocks.first().remove();
        }

        const intensity = Math.min(Math.abs(winRate) / 20, 1);
        const backgroundColor = winRate > 0
            ? `rgba(0, 255, 0, ${intensity})`
            : `rgba(255, 0, 0, ${intensity})`;

        const streakIntensity = Math.min(Math.abs(streak) / (target * 4), 1);
        const fontColor = streak > 0
            ? `rgba(0, 255, 255, ${streakIntensity})`
            : `rgba(255, 255, 0, ${streakIntensity})`;

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

        // ✅ Scale the strength bars properly
        let strengthBars = Math.min(Math.abs(ratio) * SCALE_FACTOR, MAX_BLOCKS);

        for (let i = 0; i < Math.max(1, strengthBars); i++) {
            strengthContainer.append(
                $("<div>")
                    .addClass("strength-bar")
                    .css({
                        width: "8px",
                        height: "14px",
                        backgroundColor: Math.abs(streak) < target ? "lightgreen" : "red", // ✅ Green if under target, Red if over
                        borderRadius: "2px",
                    })
            );
        }
    });
}



    // Binomial Probability Function
    function binomialProbability(k, n, p) {
        function factorial(num) {
            return num <= 1 ? 1 : num * factorial(num - 1);
        }

        function combination(n, k) {
            return factorial(n) / (factorial(k) * factorial(n - k));
        }
        return combination(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
    }

    // Helper function to map normalized value [0, 1] to a color
    function getColorForValue(normalized) {
        const r = Math.floor(255 * (1 - normalized)); // Red decreases as normalized increases
        const g = Math.floor(255 * normalized); // Green increases as normalized increases
        const b = 0; // No blue in the color mapping
        return `rgb(${r}, ${g}, ${b})`; // Return RGB color
    }


    // Helper function to map normalized value [0, 1] to a color
    function getColorForValue(normalized) {
        const r = Math.floor(255 * (1 - normalized)); // Red decreases as normalized increases
        const g = Math.floor(255 * normalized); // Green increases as normalized increases
        const b = 0; // No blue in the color mapping
        return `rgb(${r}, ${g}, ${b})`; // Return RGB color
    }


    // Helper function to map normalized value [0, 1] to a color
    function getColorForValue(normalized) {
        const r = Math.floor(255 * (1 - normalized)); // Red decreases as normalized increases
        const g = Math.floor(255 * normalized); // Green increases as normalized increases
        const b = 0; // No blue in the color mapping
        return `rgb(${r}, ${g}, ${b})`; // Return RGB color
    }


    // Helper function to map normalized value [0, 1] to a color
    function getColorForValue(normalized) {
        const r = Math.floor(255 * (1 - normalized)); // Red decreases as normalized increases
        const g = Math.floor(255 * normalized); // Green increases as normalized increases
        const b = 0; // No blue in the color mapping
        return `rgb(${r}, ${g}, ${b})`; // Return RGB color
    }


    function getRoundAgoDiff(highHit) {
        return Math.round(highHit.payout - highHit.rollCount)
    }

    function getRollsRemaining() {
        return getMaxRolls() - ANALYTICS.rollCount
    }

    function getAverage(numbers) {
        if (!Array.isArray(numbers) || numbers.length === 0) {
            return null; // Return null if input is not a valid array or is empty
        }

        const sum = numbers.reduce((acc, num) => acc + num, 0);
        return sum / numbers.length;
    }


    function setHighHit(highHit, result) {
        if (highHit.base != -1 && highHit.rollCount % highHit.base === 0) {
            highHit.rollCount = 0;
            highHit.payout = 0;
        }

        if (result > highHit.payout) {
            highHit.payout = result;
        }

        highHit.rollCount++;
    }

    function setMessage(message) {
        getNewWindowHTMLNode("#message").html(message)
    }

    function getMinRollCount() {
        return 10; //Number($("#min-roll-count").val())
    }

    function maxRollsExceeded() {
        return ANALYTICS.rollsRemaining == 1
    }

    function getWinRatePercent(payout) {
        if (payout <= 1.5) {
            return -60;
        }
        return -60;
    }

    function getStopOnRollCount() {
        return getMaxRolls() != 0
    }

    function getNewWindowHTMLNode(hook) {
        return $(newWindow.document).find(hook);
    }

    function doInit() {
        observeRollChanges()
    }

    function defaultAnalytics() {
        return {
            rollCount: 0,
            globalRollCount: {
                count: 0
            },
            highHits: {
                allTime: {
                    rollCount: 0,
                    base: -1,
                    payout: 0,
                },
                thousand: {
                    rollCount: 0,
                    base: 1000,
                    payout: 0
                },
                hundred: {
                    rollCount: 0,
                    base: 100,
                    payout: 0
                },
                ten: {
                    rollCount: 0,
                    base: 10,
                    payout: 0
                }
            },
            hitCount: 0,
            rollsRemaining: 0
        }
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
                newWindow = window.open("", "", "width=600, height=1200");

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
         overflow: hidden;
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
         <div class="stats-pane" id="statsPane">
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

    // Initialize MutationObserver
    doInit();
})()