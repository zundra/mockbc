/* Start Script */
// ==UserScript==
// @name         bc.game Analytics (With Strength Bars) v2
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

    $(document).on("keypress", function(e) {
        if (e.which === 122) {
            if (stop) {
                if (!rollsStarted) rollsStarted = true
                startBetting()
            } else {
                stopBetting()
            }
        }
    })



    const STOP_SOUND =
        "https://www.myinstants.com/media/sounds/ding-sound-effect_2.mp3"
    const CASH_SOUND =
        "https://www.myinstants.com/media/sounds/audiojoiner120623175716.mp3"

    const LS_COLORS = ["", "", "#ffc100", "#ff9a00", "#ff7400", "#ff4d00", "#ff0000"];

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
    let stop = false;
    let rollsStarted = false;
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

    // Function to start the betting process
    function startBetting() {
        if (isAnalytics()) {
            setWager(0)
        } else if (isRiskOn() && getWager() === 0) {
            setWager(0.01)
        }
        stop = false // Reset the stop flag
        doBet() // Start the async loop
        ANALYTICS.rollCount = 0;
        ANALYTICS.hitCount = 0;
    }

    function getStreakBackgroundColor() {
        let streak = this.getStreak();
        let payout = this.getPayout();

        let base = streak > 0 ? "0 0 255" : "255 0 0 "
        const ratio = (payout / Math.abs(streak));
        const alpha = 1 - (1 * ratio);
        return `rgb(${base} / ${alpha})`;
    }

    function getRBGRatio(target, streak) {
        return (255 - Math.max(0, Math.floor(255 * (target / Math.abs(streak)))));
    }

    // Function to stop the betting process
    function stopBetting() {
        stop = true
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

    /* BC Embedded */
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

    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    async function doBet() {
        while (!stop) {
            // Trigger the button click

            $(".button-brand:first").trigger("click")

            // Wait for 1 second (1000 ms) before clicking again
            await delay(10)

            // Stop condition check inside the loop
            if (stop) {
                console.log("Stopped betting.")
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

                checkHalts(result)
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
        const t1 = [1.5, 1.98, 2, 3, 5, 6, 7, 8, 9]
        const t2 = Array.from({
                length: 19,
            },
            (v, k) => 10 + k * 5,
        )

        const t3 = [200, 500, 1000]

        return [...t1, ...t2, ...t3]
    }

    function getWinRateDetailsBelowThreshold(maxKey) {
        let data = aggregateWinRates();
        let threshold = getWinRateThreshold();
        const result = {};

        // Iterate through each key in the object
        for (const key in data) {
            const numericKey = parseFloat(key); // Convert the key to a number for comparison
            const teo = calculateTeo(numericKey);

            if (numericKey <= maxKey && Array.isArray(data[key])) {
                // Map the array to include the lookback and belowThreshold status
                result[key] = data[key].map(item => ({
                    lookback: item.lookback,
                    belowThreshold: (item.winRate - teo) < threshold
                }));
            }
        }

        return result;
    }

    function getWinRatesBelowZeroCountCheck(counts) {
        const results = [];

        for (const key in counts) {
            if (counts[key] > 0) { // Customize condition based on requirements
                results.push({
                    key: key,
                    count: counts[key]
                });
            }
        }

        return results;
    }

    function getWinRateCountsBelowThreshold(details) {
        const counts = {};
        // Count the number of belowThreshold entries for each key
        for (const key in details) {
            counts[key] = details[key].reduce((count, item) => {
                return count + (item.belowThreshold ? 1 : 0);
            }, 0);
        }

        return counts;
    }

    function getWinRateColor(winRate, teo) {
        const diff = getWinRateDiff(winRate, teo);

        if (diff < -5) {
            return "red";
        } else if (diff > 5) {
            return "green";
        }
        return "";
    }

    function getWinRateDiff(winRate, teo) {
        return winRate - teo;
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
        // If the average of all win rates are greater then teo, don't halt
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


        if (getMaxRolls() === 0) {
            getNewWindowHTMLNode("#rolls-remaining").html("∞")
        } else {
            getNewWindowHTMLNode("#rolls-remaining").html(getRollsRemaining())
        }

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

        console.log("State blocks updated with average data:", averageData);
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

    /* Halts */
    function checkHalts(result) {
        const maxRollsResult = rollMultiplierHaltResult();
        let haltResult = null;

        if (!maxRollsResult.halted) {
            if (isFreeRoll()) return;
            if (isRiskOn()) {
                haltResult = riskOnHaltResult(result);
            } else if (stopOnWins()) {
                haltResult = stopOnWinsHaltResult(result);
            } else {
                haltResult = analyticsHaltResult(result)
            }
        } else {
            haltResult = maxRollsResult;
        }


        if (haltResult.halted)
            halt(haltResult.reason);
    }

    function riskOnHaltResult(result) {
        let payout = getPayout();

        const haltResult = {
            halted: false,
            reason: ""
        };

        if (result >= payout) {
            haltResult.halted = true;
            haltResult.reason = `Target Hit ${getPayout()}`;
        } else if (ANALYTICS.rollCount === (payout - 1)) {
            haltResult.halted = true;
            haltResult.reason = `Max rolls attempted during risk on betting ${ANALYTICS.rollCount})}`
            ANALYTICS.rollCount = 0;
        }

        return haltResult;
    }

    function rollMultiplierHaltResult() {
        const haltResult = {
            halted: false,
            reason: ""
        };

        if (getMaxRolls() === 0) return haltResult;

        const rollsRemaining = getRollsRemaining();

        if (rollsRemaining <= 0) {
            haltResult.halted = true;
            haltResult.reason = `Max Rolls Hit: ${ANALYTICS.rollCount}`
            ANALYTICS.rollCount = 0;
        }
        return haltResult;
    }

    function stopOnWinsHaltResult(result) {
        const payout = getPayout();
        const haltResult = {
            halted: false,
            reason: ""
        };


        if (result >= getPayout()) {
            const winRate = ANALYTICS.hitCount / ANALYTICS.rollCount;
            const winCountStop = getWinCountStop(payout, getMaxRolls());
            const message = `Target hit ${ANALYTICS.hitCount} / ${winCountStop} times over ${ANALYTICS.rollCount} rolls (${winRate.toFixed(2)})`;
            if (ANALYTICS.hitCount >= winCountStop) {
                ANALYTICS.hitCount = 0
                haltResult.halted = true;
                haltResult.reason = message;
                return haltResult
            }
        }

        return haltResult;
    }

    function analyticsHaltResult(result) {
        const haltResult = {
            halted: false,
            reason: ""
        };

        if (isAnalyticsStopOnWin()) {
            if (result >= getPayout()) {
                haltResult.halted = true;
                haltResult.reason = "Target hit!";
                return haltResult;
            }
        }

        checkStopThresholds();
        const results = checkWinRateThresholds(2);

        if (results.length >= 5) {
            // Aggregate results for presentation
            const aggregatedResults = results.map(
                result => `Key: ${result.key}, Count: ${result.count}`
            ).join("; ");

            haltResult.halted = true;
            haltResult.reason = `Halt: Win rate count exceeded for targets. Aggregated results: ${aggregatedResults}`;
            return haltResult;
        }

        for (let i = 0; i < STOP_CANDIDATES.length; i++) {
            if (STOP_CANDIDATES[i].stop_on_streak) {
                let reason = STOP_CANDIDATES[i].reason;
                STOP_CANDIDATES.splice(i, 1); // Remove the element at index i
                haltResult.halted = true;
                haltResult.reason = reason;
                break;
            } else if (!STOP_CANDIDATES.stop_on_streak && result >= STOP_CANDIDATES.target) {
                let reason = STOP_CANDIDATES[i].reason;
                STOP_CANDIDATES.splice(i, 1); // Remove the element at index i
                haltResult.halted = true;
                haltResult.reason = reason;
                break;
            }
        }

        return haltResult;
    }

    function checkStopThresholds() {
        if (ANALYTICS.globalRollCount.count < 100) return;

        const stopOnStreak = getLSStopMethod() === 0 ? true : false;
        let lowRatioLowTargetCount = 0;
        let lowRatioHighTargetCount = 0;
        const lookbacks = getLookBacks();
        const stdDevs = ROLL_HANDLER.getStdDevs(lookbacks);
        const medians = ROLL_HANDLER.getMedians(lookbacks);

        if (medians[0].median < 1.9 && stdDevs[0].stdDev < getStdStopLimit(1) && stdDevs[1].stdDev < getStdStopLimit(2) && stdDevs[2].stdDev < getStdStopLimit(3)) {
            const stop_candidate = {};
            stop_candidate.preflight_triggered = true;
            stop_candidate.stop_on_streak = true;
            stop_candidate.reason = `Exceeded std dev thresholds: Std 1 ${stdDevs[0].stdDev.toFixed(2)}, Std 2 ${stdDevs[1].stdDev.toFixed(2)},  Std 3 ${stdDevs[2].stdDev.toFixed(2)}`
            STOP_CANDIDATES[0] = stop_candidate;
            return;
        }

        if (stdDevs[0].stdDev < 1 && medians[0].median < getMediansStopLimit(1) && medians[1].median < getMediansStopLimit(2) && medians[2].median < getMediansStopLimit(3)) {
            const stop_candidate = {};
            stop_candidate.preflight_triggered = true;
            stop_candidate.stop_on_streak = true;
            stop_candidate.reason = `Exceeded median thresholds: Med 1 ${medians[0].median.toFixed(2)}, Med 2 ${medians[1].median.toFixed(2)},  Med 3 ${medians[2].median.toFixed(2)}`
            STOP_CANDIDATES[0] = stop_candidate;
            return;
        }

        for (let i = 0; i < PAYOUTS.length; i++) {
            let target = PAYOUTS[i];

            if (target < 1.98) continue;

            let ls = ROLL_HANDLER.getLosingStreak(target);

            let teo = calculateTeo(PAYOUTS[i])
            let winRates = ROLL_HANDLER.getWinRates(target, getLookBacks(target));
            let winRate1 = winRates[0].winRate;
            let winRate2 = winRates[1].winRate;
            let winRate3 = winRates[2].winRate;
            let streakObject = ROLL_HANDLER.getWinLoseStreaks(target).last();
            let ratio = streakObject.ratio;

            if (ratio <= -3) {
                if (target < 10) {
                    lowRatioLowTargetCount++;
                } else {
                    lowRatioHighTargetCount++;
                }
            }


            if (stdDevs[0].stdDev <= 1 && winRate1 - teo <= getWinRatePercent(target) && winRate2 < teo) {
                const stop_candidate = {};
                stop_candidate.preflight_triggered = true;
                stop_candidate.target = target;
                stop_candidate.ls = ls;
                stop_candidate.reason = `Target ${target} exceeded win rate threshold ${winRate1 - teo}`;
            }

            if (ROLL_HANDLER.getLosingStreak(target) >= (target * getLosingStreakMultiplier(target))) {
                const stop_candidate = {};
                stop_candidate.preflight_triggered = true;
                stop_candidate.target = target;
                stop_candidate.ls = ls;
                stop_candidate.stop_on_streak = stopOnStreak;
                stop_candidate.reason = `Target ${target} exceeded losing streak threshold ${ROLL_HANDLER.getLosingStreak(target)}`
                STOP_CANDIDATES.push(stop_candidate);
            }

            if (ROLL_HANDLER.getLosingStreak(target) >= (target * 4) && getWinRateDiff(winRate1, teo) < getWinRateStopLimit(1) && getWinRateDiff(winRate2, teo) < getWinRateStopLimit(2) && getWinRateDiff(winRate3, teo) < getWinRateStopLimit(3)) {
                const stop_candidate = {};
                stop_candidate.target = target;
                stop_candidate.preflight_triggered = true;
                stop_candidate.stop_on_streak = true;
                stop_candidate.reason = `Target ${target} exceeded win rate thresholds: Win Rate 1 ${winRate1.toFixed(2)}, Win Rate 2 ${winRate2.toFixed(2)},  Win Rate 3 ${winRate3.toFixed(2)}`
                STOP_CANDIDATES.push(stop_candidate);
            }
        }



        if (totalWinRateAvg > 0) {
            STOP_CANDIDATES.length = 0
            return;
        }

        postProcessStopCandiates(lowRatioLowTargetCount, lowRatioHighTargetCount);
    }

    function postProcessStopCandiates(lowRatioLowTargetCount, lowRatioHighTargetCount) {
        for (let i = 0; i < STOP_CANDIDATES.length; i++) {
            if ((STOP_CANDIDATES[i].target < 10 && lowRatioHighTargetCount < 1) || (STOP_CANDIDATES[i].target > 10 && lowRatioLowTargetCount < 1)) {
                STOP_CANDIDATES.splice(i, 1);
            }
        }
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

    function checkWinRateThresholds(maxTarget) {
        if (ANALYTICS.rollCount < 100) return {};

        const data = getWinRateDetailsBelowThreshold(maxTarget);
        const winRateBelowZeroCount = getWinRateCountsBelowThreshold(data);

        const result = getWinRatesBelowZeroCountCheck(winRateBelowZeroCount);
        return result;
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

    function doReset() {
        window.stopApp = false
        ROLL_HANDLER.results = [];
        console.log("Stats reset")
    }

    function halt(stopMessage) {
        console.log(stopMessage)
        alertSound(STOP_SOUND)
        setMessage(stopMessage)
        window.stopApp = false
        stopMessage = ""
        stopBetting()
        return
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

    /* End Halts */


    async function initEvents() {

    }

    async function initWindowEvents() {
        getNewWindowHTMLNode("#reset").click(function() {
            doReset()
        })

        getNewWindowHTMLNode("#set-wager-btn").click(function() {
            setWager((getNewWindowHTMLNode("#wager").val()))
        })
    }

    function isAnalytics() {
        return (Number(getNewWindowHTMLNode("#stop-method").val()) === 0)
    }

    function stopOnWins() {
        return (Number(getNewWindowHTMLNode("#stop-method").val()) === 1)
    }

    function stopOnRollMultiplier() {
        return (Number(getNewWindowHTMLNode("#stop-method").val()) === 2)
    }

    function isRiskOn() {
        return (Number(getNewWindowHTMLNode("#stop-method").val()) === 3)
    }

    function isFreeRoll() {
        return (Number(getNewWindowHTMLNode("#stop-method").val()) === 4)
    }

    function isAnalyticsStopOnWin() {
        return (Number(getNewWindowHTMLNode("#stop-method").val()) === 5)
    }

    function getMaxRolls() {
        return Number(getNewWindowHTMLNode("#max-rolls").val())
    }

    function getLSStopMethod() {
        return Number(getNewWindowHTMLNode("#ls-stop-method").val());
    }


    function getLosingStreakMultiplier(payout) {
        return Number(getNewWindowHTMLNode("#ls-multiplier").val())
    }

    function getWinRateThreshold() {
        return -Number(getNewWindowHTMLNode("#win-rate-threshold").val())
    }

    function getWinRateStopLimit(n) {
        return -Number(getNewWindowHTMLNode(`#win-rate-stop-limit-${n}`).val())
    }

    function getStdStopLimit(n) {
        return Number(getNewWindowHTMLNode(`#std-stop-limit-${n}`).val())
    }

    function getMediansStopLimit(n) {
        return Number(getNewWindowHTMLNode(`#med-stop-limit-${n}`).val())
    }

    function getLowRatioLimitCount() {
        return Number(getNewWindowHTMLNode("#low-ratio-limit-count").val())
    }

    function getLowRatioThreshold() {
        return -Number(getNewWindowHTMLNode("#low-ratio-threshold").val())
    }

    function getPlayAlertSound() {
        return getNewWindowHTMLNode("#play-alert-sound").prop("checked") && !isRiskOn()
    }

    function getNewWindowHTMLNode(hook) {
        return $(newWindow.document).find(hook);
    }

    function doInit() {
        initEvents();
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

    async function alertSound(path) {
        if (!getPlayAlertSound()) return

        if (soundTriggered) return

        var audio = new Audio(path)
        audio.type = "audio/wav"

        try {
            await audio.play()
        } catch (err) {
            console.log("Failed to play..." + err)
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
         <!-- Collapsible Panel -->
         <button class="toggle-panel-button" id="togglePanel">&lt;</button>
         <div class="panel-wrapper" id="panel">
        <div class="panel">
  <h2>Configuration</h2>

  <!-- General Settings -->
  <h3>General Settings</h3>
  <label>Stop Method</label>
  <select id="stop-method">
    <option value="0" selected>Analytics</option>
    <option value="5">Analytics (Stop on Win)</option>
    <option value="1" >Stop On Wins</option>
    <option value="2">Stop on Roll Multiplier</option>
    <option value="3">Risk On</option>
    <option value="4">Free Roll</option>
  </select>

  <label>Play Alert Sound</label>
  <input id="play-alert-sound" type="checkbox" checked />

  <label>Wager</label>
  <input type="number" id="wager" value="0.01" />  <button id="set-wager-btn" "Set Wager">Set Wager</button><br/>

  <label>Max Rolls</label>
  <input type="number" id="max-rolls" value="10000000" />

  <!-- Threshold Settings -->
  <h3>Threshold Settings</h3>
  <label>Low Ratio Limit Count</label>
  <input type="number" id="low-ratio-limit-count" value="1" />

  <label>Low Ratio Threshold</label>
  <input type="number" id="low-ratio-threshold" value="3" />

  <!-- Stop Limit Settings -->
  <h3>Stop Limit Settings</h3>
  <label>Win Rate 1 Stop Limit</label>
  <input type="number" id="win-rate-stop-limit-1" value="15" />

  <label>Win Rate 2 Stop Limit</label>
  <input type="number" id="win-rate-stop-limit-2" value="10" />

  <label>Win Rate 3 Stop Limit</label>
  <input type="number" id="win-rate-stop-limit-3" value="1" />

  <label>Std 1 Stop Limit</label>
  <input type="number" id="std-stop-limit-1" value="0.15" />

  <label>Std 2 Stop Limit</label>
  <input type="number" id="std-stop-limit-2" value="3" />

  <label>Std 3 Stop Limit</label>
  <input type="number" id="std-stop-limit-3" value="10" />

  <label>Med 1 Stop Limit</label>
  <input type="number" id="med-stop-limit-1" value="1.3" />

  <label>Med 2 Stop Limit</label>
  <input type="number" id="med-stop-limit-2" value="1.5" />

  <label>Med 3 Stop Limit</label>
  <input type="number" id="med-stop-limit-3" value="1.95" />

  <!-- Losing Streak Settings -->
  <h3>Losing Streak Settings</h3>
  <label>Losing Streak Stop Method</label>
  <select id="ls-stop-method">
    <option value="0">During Streak</option>
    <option value="1">After Win</option>
  </select>

  <label>Losing Streak Multiplier</label>
  <select id="ls-multiplier">
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
    <option value="9" selected>9</option>
    <option value="9.5">9.5</option>
    <option value="10">10</option>
  </select>

  <label>Win Rate Threshold</label>
  <input type="number" id="win-rate-threshold" value="60" />
</div>

         </div>
      </div>
      <script>
         const panel = document.getElementById('panel');
         const toggleButton = document.getElementById('togglePanel');
         const statsPane = document.getElementById('statsPane');

         // Toggle panel visibility
         toggleButton.addEventListener('click', () => {
           panel.classList.toggle('collapsed');
           toggleButton.textContent = panel.classList.contains('collapsed') ? '>' : '<';
         });

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
                printOutput();
                initWindowEvents();
            })();
        },
        false
    );

    // Initialize MutationObserver
    doInit();
})()