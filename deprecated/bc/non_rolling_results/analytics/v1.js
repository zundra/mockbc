/* Start Script */
// ==UserScript==
// @name         bc.game (non-rolling) analytics V1
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

    if (!Array.prototype.first) {
        Array.prototype.first = function() {
            return this[0];
        };
    }


    Array.prototype.median = function() {
        if (this.length === 0) return null; // Handle empty array case

        const medianIndex = Math.floor((this.length - 1) / 2); // Get the median index
        return this[medianIndex]; // Return the median element
    };


    $(document).on("keypress", function(e) {
        //        console.log(e.which);
        if (e.which === 122) {
            if (ROLL_STATS.getStopState().stopped) {
                startBetting()
            } else {
                stopBetting()
            }
        }
    })


    const MIN_WAGER = 0.0001;
    const MAX_WAGER = 2;

    const STOP_SOUND =
        "https://www.myinstants.com/media/sounds/ding-sound-effect_2.mp3"
    const CASH_SOUND =
        "https://www.myinstants.com/media/sounds/audiojoiner120623175716.mp3"

    const LS_COLORS = ["", "", "#ffc100", "#ff9a00", "#ff7400", "#ff4d00", "#ff0000"];

    const PAYOUTS = Array.from({
            length: 50,
        },
        (v, k) => 2 + k * 2,
    )

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
            this.results = [];
            this.losingStreaks = {}; // Store current losing streaks per target
            this.haltThresholds = {}; // Precomputed thresholds per target

            // Precompute halt thresholds for each target
            PAYOUTS.forEach(target => {
                this.haltThresholds[target] = getLosingStreakHaltThreshold(target); // 1% rarity threshold
                this.losingStreaks[target] = 0; // Initialize streak tracking
            });
        }

        addResult(result) {
            if (this.results.length == 400) this.results.shift();
            this.results.push(result);

            PAYOUTS.forEach(target => {
                this.updateLosingStreak(target, result);
            });
        }

        updateLosingStreak(target, result) {
            if (result < target) {
                this.losingStreaks[target] += 1; // Increment losing streak
            } else {
                this.losingStreaks[target] = 0; // Reset on win
            }
        }

        getLosingStreak(target) {
            return this.losingStreaks[target] || 0;
        }

        getFirstTargetInLosingStreak(lsm) {
            return this.getTargetsInLosingStreak(lsm).first()
        }

        getMedianTargetInLosingStreak(lsm) {
            return this.getTargetsInLosingStreak(lsm).median()
        }

        getTargetsInLosingStreak(lsm) {
            return PAYOUTS.slice().sort().map(target => ({
                payout: target,
                losingStreak: this.getLosingStreak(target)
            })).filter(target => target.losingStreak >= (target.payout * lsm));
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

        LSTiers(lsm) {
            const targetsInStreak = this.getTargetsInLosingStreak(lsm); // Get filtered targets
            const tiers = [];

            let currentTier = [];
            let currentStreak = null;

            // 🔄 Group targets into tiers based on consecutive same streak values
            for (const target of targetsInStreak) {
                if (currentStreak === null || target.losingStreak !== currentStreak) {
                    // 🆕 Start a new tier when the streak changes
                    if (currentTier.length > 0) {
                        tiers.push([...currentTier]);
                    }
                    currentTier = [target];
                    currentStreak = target.losingStreak;
                } else {
                    // ➕ Continue adding to the current tier
                    currentTier.push(target);
                }
            }

            // 🔄 Push the last tier if not empty
            if (currentTier.length > 0) {
                tiers.push([...currentTier]);
            }

            return tiers;
        }

        overheadLSTiers(lsm, referenceTarget) {
            return this.LSTiers(lsm).filter(tier => tier.some(target => target.payout > referenceTarget.payout));
        }

        overheadLSTiersCount(lsm, referenceTarget) {
            return overheadLSTiers(lsm, referenceTarget).length
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
            let resultsSinceLastHit = [];
            let lastStreak = 0; // ✅ Track the previous streak

            for (const result of this.results) {
                if (result < target) {
                    resultsSinceLastHit.push(result); // Track values since last hit

                    if (currentStreak > 0) {
                        streaks.push({
                            streak: currentStreak,
                            lastStreak, // ✅ Store previous streak before resetting
                            ratio: Math.floor(currentStreak / target),
                            medianSinceHit: 0 // Median is only calculated for losing streaks
                        });
                        lastStreak = currentStreak; // ✅ Update previous streak
                        currentStreak = 0;
                    }
                    currentStreak--;
                } else {
                    let medianSinceHit = resultsSinceLastHit.length > 0 ? this.median(resultsSinceLastHit, Math.min(resultsSinceLastHit.length, 100)) : 0;
                    resultsSinceLastHit = []; // Reset tracking after a hit

                    if (currentStreak < 0) {
                        streaks.push({
                            streak: currentStreak,
                            lastStreak, // ✅ Store previous streak before resetting
                            ratio: Math.floor(currentStreak / target),
                            medianSinceHit: medianSinceHit
                        });
                        lastStreak = currentStreak; // ✅ Update previous streak
                        currentStreak = 0;
                    }
                    currentStreak++;
                }
            }

            if (currentStreak !== 0) {
                let medianSinceHit = resultsSinceLastHit.length > 0 ? this.median(resultsSinceLastHit, Math.min(resultsSinceLastHit.length, 100)) : 0;

                streaks.push({
                    streak: currentStreak,
                    lastStreak, // ✅ Store previous streak
                    ratio: Math.floor(currentStreak / target),
                    medianSinceHit: medianSinceHit
                });
            }

            return streaks;
        }



        median(array, size) {
            let numbers = this.getWorkingArray(array, size)
            const sorted = Array.from(numbers).sort((a, b) => a - b)
            const middle = Math.floor(sorted.length / 2)

            if (sorted.length % 2 === 0) {
                return (sorted[middle - 1] + sorted[middle]) / 2
            }

            return sorted[middle]
        }

        getWorkingArray(array, lookback) {
            if (array.length < lookback) return array.slice()

            return array.slice(array.length - lookback)
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
    let rollsStarted = false;
    let medians = [];
    let stdDevs = [];


    const ROLL_STATS = defaultRollStats();

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
        ROLL_STATS.startSession(getStopOnProfit(), getMaxLoss(), getStopOnMaxLoss(), useProgressiveBetting())
        doBet() // Start the async loop
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

    // Function to stop the betting process
    function stopBetting() {
        ROLL_STATS.stopSession()
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

    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    async function doBet() {
        while (!ROLL_STATS.getStopState().stopped) {

            // Trigger the button click

            $(".button-brand:first").trigger("click")

            // Wait for 1 second (1000 ms) before clicking again
            await delay(10)

            // Stop condition check inside the loop
            if (ROLL_STATS.getStopState().stopped) {
                if (ROLL_STATS.getStopState().reason !== "") {
                    setMessage(ROLL_STATS.getStopState().reason);
                }
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
                let result = getRollResult();
                ROLL_HANDLER.addResult(result);
                updateData(result);
                checkHalts(result);
                setupNextBet();
                printOutput();

            }
        });

        observer.observe(gridElement, {
            childList: true,
            subtree: true
        });
    }


    function setupNextBet() {
        const wager = getWager();
        const payout = getPayout()
        setWager(ROLL_STATS.getWager(ROLL_STATS.getWager(wager, payout, useProgressiveBetting())))
    }
    /* End BC Embedded */


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


    const WIN_RATES = [];

    function updateData(result) {
        const payout = getPayout();
        WIN_RATE_DIFFS_1.length = 0;
        WIN_RATE_DIFFS_2.length = 0;
        WIN_RATE_DIFFS_3.length = 0;
        WIN_RATE_AVG_1.length = 0;
        WIN_RATE_AVG_2.length = 0;
        WIN_RATE_AVG_3.length = 0;
        WIN_RATES.length = 0;
        const lookbacks = getLookBacks();
        for (let i = 0; i < PAYOUTS.length; i++) {

            const teo = calculateTeo(PAYOUTS[i])
            const winRates = ROLL_HANDLER.getWinRates(PAYOUTS[i], lookbacks);
            const streak = ROLL_HANDLER.getWinLoseStreaks(PAYOUTS[i]).last().streak;
            const medianSinceHit = ROLL_HANDLER.getWinLoseStreaks(PAYOUTS[i]).last().medianSinceHit;
            const lastStreak = ROLL_HANDLER.getWinLoseStreaks(PAYOUTS[i]).last().lastStreak;
            const ratio = ROLL_HANDLER.getWinLoseStreaks(PAYOUTS[i]).last().ratio;

            WIN_RATE_DIFFS_1.push(winRates[0].winRate - teo);
            WIN_RATE_DIFFS_2.push(winRates[1].winRate - teo);
            WIN_RATE_DIFFS_3.push(winRates[2].winRate - teo);
            const wrObject = {};
            wrObject[PAYOUTS[i]] = {
                winRate: (winRates[0].winRate - teo),
                streak: streak,
                medianSinceHit: medianSinceHit,
                ratio: ratio,
                lastStreak: lastStreak
            };
            WIN_RATES.push(wrObject);
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
        updateWinRateBlocks(WIN_RATES);
        // If the average of all win rates are greater then teo, don't halt
        totalWinRateAvg = getAverage(WIN_RATE_DIFFS_1);

        medians = ROLL_HANDLER.getMedians(lookbacks);
        stdDevs = ROLL_HANDLER.getStdDevs(lookbacks);


        ROLL_STATS.addRoll(result, getPayout(), getWager())

        // Refactor into ROLL_STATS
        setHighHit(ROLL_STATS.highHits.allTime, result);
        setHighHit(ROLL_STATS.highHits.thousand, result);
        setHighHit(ROLL_STATS.highHits.hundred, result);
        setHighHit(ROLL_STATS.highHits.ten, result);
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
        getNewWindowHTMLNode("#global-rollcount").html(ROLL_STATS.globalRollCount)


        getNewWindowHTMLNode("#profit-loss").html(ROLL_STATS.profitLoss.toFixed(5))

        getNewWindowHTMLNode("#current-wager").html(ROLL_STATS.getWager())

        if (getMaxRolls() === 0) {
            getNewWindowHTMLNode("#rolls-remaining").html("∞")
        } else {
            getNewWindowHTMLNode("#rolls-remaining").html(getRollsRemaining())
        }

        getNewWindowHTMLNode("#win-rate").html(`${(ROLL_STATS.hitCount / ROLL_STATS.rollCount * 100).toFixed(2)} (${calculateTeo(getPayout()).toFixed(2)})`)
        getNewWindowHTMLNode("#total-win-rate-avg").html(`${(totalWinRateAvg).toFixed(2)}`)
        getNewWindowHTMLNode("#rollcount").html(ROLL_STATS.rollCount)
        getNewWindowHTMLNode("#hitcount").html(ROLL_STATS.hitCount)

        getNewWindowHTMLNode("#global-ath-diff").html(Math.round(ROLL_STATS.highHits.allTime.payout - ROLL_STATS.globalRollCount))
        getNewWindowHTMLNode("#session-ath-diff").html(Math.round(ROLL_STATS.highHits.allTime.payout - ROLL_STATS.highHits.allTime.rollCount))

        getNewWindowHTMLNode("#all-time-high").html(ROLL_STATS.highHits.allTime.payout)
        getNewWindowHTMLNode("#all-time-high-rounds-ago").html(ROLL_STATS.highHits.allTime.rollCount)
        getNewWindowHTMLNode("#all-time-high-rounds-ago-diff").html(getRoundAgoDiff(ROLL_STATS.highHits.allTime))


        getNewWindowHTMLNode("#high-hit-10").html(ROLL_STATS.highHits.ten.payout)
        getNewWindowHTMLNode("#high-hit-10-rounds-ago").html(ROLL_STATS.highHits.ten.rollCount)
        getNewWindowHTMLNode("#high-hit-10-rounds-ago-diff").html(getRoundAgoDiff(ROLL_STATS.highHits.ten))


        getNewWindowHTMLNode("#high-hit-100").html(ROLL_STATS.highHits.hundred.payout)
        getNewWindowHTMLNode("#high-hit-100-rounds-ago").html(ROLL_STATS.highHits.hundred.rollCount)
        getNewWindowHTMLNode("#high-hit-100-rounds-ago-diff").html(getRoundAgoDiff(ROLL_STATS.highHits.hundred))

        getNewWindowHTMLNode("#high-hit-1000").html(ROLL_STATS.highHits.thousand.payout)
        getNewWindowHTMLNode("#high-hit-1000-rounds-ago").html(ROLL_STATS.highHits.thousand.rollCount)
        getNewWindowHTMLNode("#high-hit-1000-rounds-ago-diff").html(getRoundAgoDiff(ROLL_STATS.highHits.thousand))

    }

    function updateStateBlocksForAverages(averageData) {
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

        //console.log("State blocks updated with average data:", averageData);
    }



    function updateWinRateBlocks(winRateData) {
        const MAX_BLOCKS = 10;
        const winRateContainer = getNewWindowHTMLNode("#winRateContainer");

        if (!winRateContainer || winRateContainer.length === 0) {
            console.error("Win rate container not found in new window!");
            return;
        }

        // Refresh payout colors every update
        const payoutColors = generatePayoutColorMap(getUpdatedTiers());

        winRateData.forEach(entry => {
            const target = Object.keys(entry)[0];
            const {
                winRate,
                streak,
                ratio,
                medianSinceHit,
                lastStreak
            } = Object.values(entry)[0];
            const sanitizedTarget = target.replace(/\./g, "_");

            let rowContainer = winRateContainer.find(`#row-${sanitizedTarget}`);

            // 🚀 **Reap (Remove) blocks that turn positive**
            if (winRate > -1 || Math.abs(streak) < (target * 2)) {
                if (rowContainer.length > 0) {
                    rowContainer.remove();
                }
                return;
            }

            // ✅ **Ensure row exists**
            if (rowContainer.length === 0) {
                rowContainer = $("<div>")
                    .addClass("win-rate-row")
                    .attr("id", `row-${sanitizedTarget}`)
                    .attr("data-target-value", parseFloat(target)) // ✅ Store numeric target for sorting
                    .css({
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        marginBottom: "3px",
                    });

                const targetLabel = $("<div>")
                    .addClass("win-rate-label")
                    .attr("data-target", target)
                    .css({
                        fontWeight: "bold",
                        minWidth: "40px",
                        textAlign: "right",
                        marginRight: "8px",
                        padding: "2px 4px",
                        borderRadius: "4px",
                    })
                    .text(target);

                const blockContainer = $("<div>")
                    .addClass("win-rate-blocks")
                    .css({
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: "2px",
                        overflow: "hidden",
                    });

                rowContainer.append(targetLabel, blockContainer);
                winRateContainer.append(rowContainer);
            }

            // **Ensure the block container is present**
            let blockContainer = rowContainer.find(".win-rate-blocks");
            if (blockContainer.length === 0) {
                blockContainer = $("<div>")
                    .addClass("win-rate-blocks")
                    .css({
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: "2px",
                        overflow: "hidden",
                    });
                rowContainer.append(blockContainer);
            }

            // **Apply target label coloring**
            const targetLabel = rowContainer.find(".win-rate-label");
            if (payoutColors.hasOwnProperty(target)) {
                targetLabel.css("background-color", payoutColors[target]);
            } else {
                targetLabel.css("background-color", "");
            }

            // **Determine if a new block is needed**
            let needsNewBlock = false;
            const blocks = blockContainer.find(".win-rate-block");

            if (blocks.length === 0) {
                needsNewBlock = true;
            } else {
                needsNewBlock = streak !== lastStreak;
            }

            // **Win rate block color logic**
            const winRateIntensity = Math.min(Math.abs(winRate) / 20, 1);
            const backgroundColor = `rgba(255, 0, 0, ${winRateIntensity})`; // 🔴 Only negative WR blocks remain

            const fontColor = getStreakFontColor(streak, target);

            if (needsNewBlock) {
                const winRateBlock = $("<div>")
                    .addClass("win-rate-block")
                    .css({
                        backgroundColor,
                        color: fontColor,
                        padding: "6px",
                        margin: "2px",
                        borderRadius: "6px",
                        textAlign: "center",
                        fontSize: "10px",
                        fontWeight: "bold",
                        minWidth: "50px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                    })
                    .append(
                        $("<div>").addClass("streak").text(`Streak: ${streak}`),
                        $("<div>").addClass("win-rate").text(`WR: ${winRate.toFixed(2)}`),
                        $("<div>").addClass("ratio").text(`Ratio: ${ratio.toFixed(2)}`),
                        $("<div>").addClass("median").text(`Med: ${medianSinceHit.toFixed(2)}`)
                    );

                // ✅ Append the block without removing history prematurely
                blockContainer.prepend(winRateBlock);

                // ✅ Ensure old blocks aren't deleted too soon
                while (blockContainer.find(".win-rate-block").length > MAX_BLOCKS) {
                    blockContainer.find(".win-rate-block").last().remove();
                }
            } else {
                // ✅ Update the most recent block instead of replacing history
                const firstBlock = blocks.first();
                firstBlock.css({
                    backgroundColor,
                    color: fontColor
                });
                firstBlock.find(".streak").text(`Streak: ${streak}`);
                firstBlock.find(".win-rate").text(`WR: ${winRate.toFixed(2)}`);
                firstBlock.find(".ratio").text(`Ratio: ${ratio.toFixed(2)}`);
                firstBlock.find(".median").text(`Med: ${medianSinceHit.toFixed(2)}`);
            }
        });

        // ✅ **Ensure rows stay sorted after updates**
        winRateContainer.children(".win-rate-row").sort((a, b) => {
            return parseFloat($(a).attr("data-target-value")) - parseFloat($(b).attr("data-target-value"));
        }).appendTo(winRateContainer);
    }



    /**
     * Fetch updated tiers dynamically.
     * @returns {Array} Updated structured payout groups.
     */
    function getUpdatedTiers() {
        return ROLL_HANDLER.LSTiers(getTierLSThreshold());
    }

    /**
     * Generates a mapping of payout values to unique colors.
     * @param {Array} payoutGroups - The structured payout group data.
     * @returns {Object} A mapping of payout values to colors.
     */
    function generatePayoutColorMap(payoutGroups) {
        const colorPalette = [
            "#ff5733", "#33ff57", "#3357ff", "#ff33a1", "#a133ff", "#33fff5", "#f5ff33", "#ff8633", "#ff3385"
        ];
        let payoutColorMap = {};

        payoutGroups.forEach((group, index) => {
            // Assign one color per group (based on its position in the array)
            const groupColor = colorPalette[index % colorPalette.length];

            group.forEach(entry => {
                const payoutKey = entry.payout.toString();
                payoutColorMap[payoutKey] = groupColor; // Assign the same color to all payouts in the group
            });
        });

        return payoutColorMap;
    }


    function getStreakFontColor(streak, target) {
        if (Math.abs(streak) < target && streak < 0 || Math.abs(streak) > target && streak > 0) return "white";

        const streakIntensity = Math.min(Math.abs(streak) / (target * 4), 1)

        return streak > 0 ?
            `rgba(0, 255, 255, ${streakIntensity})` // Cyan for positive streaks
            :
            `rgba(255, 255, 0, ${streakIntensity})`; // Yellow for negative streaks
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

    function getRoundAgoDiff(highHit) {
        return Math.round(highHit.payout - highHit.rollCount)
    }

    /* Halts */

    function checkHalts(result) {
        if (isFreeRoll()) return;

        let haltResult = null;

        if (isRiskOnDropWager()) {
            setRiskOnWager(result);
            return;
        } else if (isRiskOn()) {
            haltResult = riskOnHaltResult(result);
        } else if (stopOnRollMultiplier()) {
            haltResult = riskOnHaltResult(result);
        } else if (stopOnWins()) {
            haltResult = stopOnWinsHaltResult(result);
        } else {
            haltResult = analyticsHaltResult(result)
        }


        if (haltResult.halted)
            halt(haltResult.reason);
    }

    function getDynamicStopLimit(target, winProbability, baseLimit) {
        const varianceFactor = Math.sqrt(winProbability * (1 - winProbability)); // Standard deviation proxy

        return baseLimit * varianceFactor;
    }

    function calculateWagerDivisor() {
        return calculateTeo(getPayout()) / 100;
    }

    function decreaseWager(wager) {
        wager *= calculateWagerDivisor()
        return wager;
    }

    function increaseWager(wager) {
        wager /= calculateWagerDivisor()
        return wager;
    }

    function setRiskOnWager(result) {
        if (ROLL_STATS.getPreviousCyclePL() != 0) {
            console.log("Prevous cycle PL", ROLL_STATS.getPreviousCyclePL())
        }

        if (ROLL_STATS.getPreviousCyclePL() > 0) {
            const divisor = getRiskOnnWagerDropDivisor()
            const wager = decreaseWager(getWager())
            setWager(wager)
        } else if (ROLL_STATS.getPreviousCyclePL() < 0) {
            // const divisor = getRiskOnnWagerDropDivisor()
            // const wager = increaseWager(getWager())
            // setWager(wager)     
        }
    }

    function riskOnHaltResult(result) {
        let payout = getPayout();

        const haltResult = {
            halted: false,
            reason: ""
        };

        const multiplier = isRiskOnHalfCount() ? 2 : 1;

        if (result >= payout) {
            haltResult.halted = true;
            haltResult.reason = `Target Hit ${getPayout()}`;
        } else if (Math.floor((ROLL_STATS.rollCount * multiplier)) >= (payout - 1)) {
            haltResult.halted = true;
            haltResult.reason = `Max rolls attempted during risk on betting ${ROLL_STATS.rollCount})}`
            ROLL_STATS.rollCount = 0;
        }

        return haltResult;
    }

    function rollMultiplierHaltResult() {
        const haltResult = {
            halted: false,
            reason: ""
        };

        if (!getStopOnMaxRolls()) return haltResult;

        const rollsRemaining = getRollsRemaining();

        if (rollsRemaining <= 0) {
            haltResult.halted = true;
            haltResult.reason = `Max Rolls Hit: ${ROLL_STATS.rollCount}`
            ROLL_STATS.rollCount = 0;
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
            const winRate = ROLL_STATS.hitCount / ROLL_STATS.rollCount;
            const winCountStop = getWinCountStop(payout, getMaxRolls());
            const message = `Target hit ${ROLL_STATS.hitCount} / ${winCountStop} times over ${ROLL_STATS.rollCount} rolls (${winRate.toFixed(2)})`;
            if (ROLL_STATS.hitCount >= winCountStop) {
                ROLL_STATS.hitCount = 0
                haltResult.halted = true;
                haltResult.reason = message;
                return haltResult
            }
        }

        const riskAdjustHaltResult = shouldAdjustRiskHaltResult();

        if (riskAdjustHaltResult.halted) {
            return riskAdjustHaltResult;
        } else {
            setMessage(riskAdjustHaltResult.reason);
            return riskAdjustHaltResult;
        }
    }

    function shouldAdjustRiskHaltResult() {
        const remainingRolls = getRollsRemaining();
        const expectedWinRate = calculateTeo(getPayout())
        const totalRolls = getMaxRolls();
        const currentRolls = ROLL_STATS.rollCount;
        const currentHits = ROLL_STATS.hitCount;

        const requiredHits = Math.ceil((expectedWinRate / 100) * totalRolls); // Expected total hits
        const neededHits = requiredHits - currentHits;

        if (neededHits > remainingRolls) {
            return {
                action: 'CUT_LOSS',
                reason: 'Impossible to recover'
            }; // Stop rolling, impossible to recover
        }

        // Calculate probability of hitting at least neededHits in remainingRolls
        let probability = 0;
        for (let i = neededHits; i <= remainingRolls; i++) {
            probability += binomialProbability(i, remainingRolls, expectedWinRate / 100);
        }

        // Decision making based on probability
        if (probability < 0.3) {
            return {
                halted: true,
                action: 'CUT_LOSS',
                reason: 'Low probability of recovery (<5%)'
            };
        } else if (probability < 0.2) {
            return {
                halted: true,
                action: 'INCREASE_BET',
                reason: 'Moderate chance of recovery (5-20%)'
            };
        } else if (probability > 0.8 && currentHits > requiredHits) {
            return {
                halted: true,
                action: 'DECREASE_BET',
                reason: 'Exceeding expected win rate, reducing risk'
            };
        } else {
            return {
                halted: false,
                action: 'KEEP_SAME',
                reason: 'Within normal range'
            };
        }
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

        if (STOP_CANDIDATES.length === 0) {
            checkStopThresholds();
        }

        if (STOP_CANDIDATES.length === 0) {
            checkTiersThreshold();
        }

        if (STOP_CANDIDATES.length === 0) {
            checkWinRateThresholds();
        }

        if (STOP_CANDIDATES.length === 0) {
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
        if (ROLL_STATS.globalRollCount < 100) return;

        let stopOnStreak = getLSStopMethod() === 0;

        for (let i = 0; i < PAYOUTS.length; i++) {
            let target = PAYOUTS[i];
            let ls = ROLL_HANDLER.getLosingStreak(target);
            let threshold = ROLL_HANDLER.haltThresholds[target];

            if (ls >= threshold) {
                const stop_candidate = {
                    target: target,
                    preflight_triggered: true,
                    stop_on_streak: stopOnStreak,
                    reason: `Target ${target} exceeded calculated losing streak threshold (${ls} / ${threshold})`
                };
                STOP_CANDIDATES.push(stop_candidate);
            }
        }
    }

    function checkTiersThreshold() {
        const lsm = getTierLSThreshold();
        const minTiers = getMinTiers();
        const tiers = ROLL_HANDLER.LSTiers(lsm);
        const tierCount = tiers.length;
        const singleTierCount = tiers.length > 0 && tiers[0].length;

        if (tierCount < minTiers && singleTierCount < 5) return;
        const target = ROLL_HANDLER.getMedianTargetInLosingStreak(lsm)

        const stopCandidate = {
            target: target.payout,
            preflight_triggered: true,
            stop_on_streak: true,
            reason: `Target ${target.payout} exceeded tier losing streak threshold ${target.losingStreak}`
        };

        STOP_CANDIDATES[0] = stopCandidate;
    }

    function checkWinRateThresholds(maxTarget) {
        if (ROLL_STATS.rollCount < 100) return {};

        const data = getWinRateDetailsBelowThreshold(maxTarget);
        const winRateBelowZeroCount = getWinRateCountsBelowThreshold(data);

        const result = getWinRatesBelowZeroCountCheck(winRateBelowZeroCount);
        return result;
    }

    function getRollsRemaining() {
        return getMaxRolls() - ROLL_STATS.rollCount
    }

    function getAverage(numbers) {
        if (!Array.isArray(numbers) || numbers.length === 0) {
            return null; // Return null if input is not a valid array or is empty
        }

        const sum = numbers.reduce((acc, num) => acc + num, 0);
        return sum / numbers.length;
    }

    function halt(stopMessage) {
        console.log(stopMessage)
        alertSound(STOP_SOUND)
        setMessage(stopMessage)
        ROLL_STATS.stopSession()
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
        return ROLL_STATS.rollsRemaining == 1
    }

    function getWinRatePercent(payout) {
        if (payout <= 1.5) {
            return -60;
        }
        return -55;
    }

    function getStopOnRollCount() {
        return getMaxRolls() != 0
    }

    /* End Halts */


    async function initWindowEvents() {
        getNewWindowHTMLNode("#reset").click(function() {
            doReset()
        })

        getNewWindowHTMLNode("#set-wager-btn").click(function() {
            setWager((getNewWindowHTMLNode("#wager").val()))
        })


        getNewWindowHTMLNode("#start-analytics-btn").click(function() {
            setWager(0)
            getNewWindowHTMLNode("#stop-method").val(0);
            startBetting();
        })

        getNewWindowHTMLNode("#double-wager-btn").click(function() {
            setWager(Math.min(MAX_WAGER, getWager() * 2))
        })

        getNewWindowHTMLNode("#half-wager-btn").click(function() {
            setWager(Math.max(MIN_WAGER, getWager() / 2))
        })

        getNewWindowHTMLNode("#set-wager-btn").click(function() {
            setWager(Number(getNewWindowHTMLNode("#wager-amount").val()))
        })


        getNewWindowHTMLNode("#start-betting-btn").click(function() {
            let wager = getWager();
            let settingsWager = Number(getNewWindowHTMLNode("#wager-amount").val());

            if (wager == 0 && settingsWager !== 0) {
                wager = settingsWager
            }

            setWager(wager)
            startBetting()
        })

        getNewWindowHTMLNode("#stop-betting-btn").click(function() {
            stopBetting()
        })
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

    function isRiskOn() {
        return isRiskOnNormal() || isRiskOnHalfCount();
    }

    function isRiskOnNormal() {
        return (Number(getNewWindowHTMLNode("#stop-method").val()) === 3)
    }

    function isRiskOnHalfCount() {
        return (Number(getNewWindowHTMLNode("#stop-method").val()) === 6)
    }

    function isFreeRoll() {
        return (Number(getNewWindowHTMLNode("#stop-method").val()) === 4)
    }

    function isAnalyticsStopOnWin() {
        return (Number(getNewWindowHTMLNode("#stop-method").val()) === 5)
    }

    function isRiskOnDropWager() {
        return (Number(getNewWindowHTMLNode("#stop-method").val()) === 7)
    }

    function getMaxRolls() {
        return Number(getNewWindowHTMLNode("#max-rolls").val())
    }

    function getLSStopMethod() {
        return Number(getNewWindowHTMLNode("#ls-stop-method").val());
    }


    function getLosingStreakMultiplier() {
        return Number(getNewWindowHTMLNode("#ls-multiplier").val())
    }

    function getRiskOnnWagerDropDivisor() {
        return Number(getNewWindowHTMLNode("#risk-on-wager-drop-divisor").val())
    }

    function getTierLSThreshold() {
        return Number(getNewWindowHTMLNode("#ls-tier-multiplier").val())
    }

    function getMinTiers() {
        return Number(getNewWindowHTMLNode("#min-tiers").val())
    }

    function getWinRateThreshold() {
        return -Number(getNewWindowHTMLNode("#win-rate-threshold").val())
    }


    function getWinRateStopLosingStreakLimit(n) {
        return Number(getNewWindowHTMLNode(`#win-rate-stop-ls-limit`).val())
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

    function getStopOnProfit() {
        return getNewWindowHTMLNode("#stop-on-profit").prop("checked") && !isRiskOn()
    }

    function getMaxLoss() {
        return Number(getNewWindowHTMLNode("#max-loss").val())
    }

    function useProgressiveBetting() {
        return getNewWindowHTMLNode("#use-progressive-betting").prop("checked") && !isRiskOn()
    }

    function getStopOnMaxRolls() {
        return getNewWindowHTMLNode("#stop-on-max-rolls").prop("checked") && !isRiskOn()
    }

    function getStopOnMaxLoss() {
        return getNewWindowHTMLNode("#stop-on-max-loss").prop("checked") && !isRiskOn()
    }


    function getNewWindowHTMLNode(hook) {
        return $(newWindow.document).find(hook);
    }

    function doInit() {
        observeRollChanges()
        initWindowEvents();
    }

    function defaultRollStats() {
        return {
            stopState: {
                stopped: false,
                reason: ""
            },
            stopOnProfit: false,
            stopOnMaxLoss: false,
            useProgressiveBetting: false,
            baseWager: 0,
            profitLoss: 0,
            losingStreak: 0,
            priorLosingStreak: 0,
            rollCount: 0,
            cycleRollCount: 0,
            cycleProfitLoss: 0,
            previousCycleProfitLoss: 0,
            globalRollCount: 0,
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
            rollsRemaining: 0,
            defaultStopState: function() {
                return {
                    stopped: false,
                    reason: ""
                };
            },
            getPL: function() {
                return this.profitLoss;
            },
            cyclePL: function() {
                return this.cycleProfitLoss;
            },
            addRoll: function(result, payout, wager) {
                this.rollCount++;
                this.globalRollCount++;

                if (this.cycleRollCount < payout) {
                    this.previousCycleProfitLoss = 0;
                    this.cycleRollCount++;
                    // console.log("Cycle RUNNING", this.rollCount, this.cycleRollCount, this.cycleProfitLoss)
                } else {
                    this.previousCycleProfitLoss = this.cycleProfitLoss;
                    this.cycleRollCount = 0;
                    this.cycleProfitLoss = 0;
                }

                if (result >= payout) {
                    const pl = (wager * payout) - wager;

                    this.hitCount++;
                    this.losingStreak = 0;
                    this.profitLoss += pl;
                    this.cycleProfitLoss += pl;
                } else {
                    this.profitLoss -= wager;
                    this.cycleProfitLoss -= wager;
                    this.priorLosingStreak = this.losingStreak;
                    this.losingStreak++;
                }

            },
            getCyclePL() {
                return this.cycleProfitLoss;
            },
            getPreviousCyclePL() {
                return this.previousCycleProfitLoss;
            },
            getPL() {
                return this.profitLoss;
            },
            resetSession: function() {
                this.hitCount = 0;
                this.maxLoss = Infinity;
                this.stopOnProfit = false;
                this.stopOnMaxLoss = false;
                this.rollCount = 0;
                this.attemptCount = 0;
                this.profitLoss = 0;
                this.losingStreak = 0;
                this.priorLosingStreak = 0;
                this.stopState = this.defaultStopState();
            },
            startSession: function(stopOnProfit, maxLoss, stopOnMaxLoss) {
                this.resetSession()
                this.stopState.stopped = false;
                this.stopOnProfit = stopOnProfit;
                this.maxLoss = maxLoss;
                this.stopOnMaxLoss = stopOnMaxLoss;
            },
            stopSession: function() {
                this.stopState.stopped = true;
            },
            getWager: function(wager, target, progressiveBetting) {
                if (progressiveBetting) {
                    return this.getProgressiveWager(wager, target);
                }
                return wager;
            },
            calculateTeo: function(target) {
                return 1 / (target * 1.05)
            },
            getBaseWager: function(finalWager, target) {
                if (this.priorLosingStreak === 0) return finalWager;

                const multiplier = (calculateTeo(target) / 2) * this.priorLosingStreak;
                return finalWager / (1 + multiplier);
            },
            getLosingStreak() {
                return this.losingStreak;
            },
            getLosingStreakAbs() {
                return Math.abs(this.getLosingStreak());
            },
            checkStopOnProfit() {
                if (this.profitLoss >= 0.01) {
                    this.stopState.stopped = true;
                    this.stopState.reason = `Stopped on profit ${this.profitLoss.toFixed(5)}`;
                }
            },
            checkStopOnMaxLoss() {
                if (this.profitLoss < 0 && Math.abs(this.profitLoss) >= this.maxLoss) {
                    this.stopState.stopped = true;
                    this.stopState.reason = `Stopped on max loss ${this.profitLoss}`;
                }
            },
            getStopState() {
                return this.stopState;
            }
        }
    }


    function getLosingStreakHaltThreshold(target, rarity_threshold = 0.0001) {
        const losing_prob = 1 - (calculateTeo(target) / 100); // Convert to probability

        if (losing_prob <= 0) return Infinity; // Prevent division errors for extreme values

        let streak = 1;
        while (Math.pow(losing_prob, streak) > rarity_threshold) {
            streak++;
        }

        return streak;
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
                newWindow = window.open("", "", "width=1000, height=1200");

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
         flex: 1;
         background-color: #2a2d2e;
         border-left: 1px solid #444;
         padding: 10px;
         overflow-y: auto;
         position: relative;
         transition: transform 0.3s ease;
         width: 300px;
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

 .button-group {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 5px;
    padding: 10px;
    background: #222;
    border-radius: 8px;
    width: fit-content;
    margin: auto;
}

.button-group button {
    background: #2d89ef;
    color: white;
    border: none;
    padding: 6px 10px;
    font-size: 12px;
    font-weight: bold;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    text-align: center;
    min-width: 60px;
}

.button-group button:hover {
    background: #1c6ac9;
}

.button-group button:active {
    transform: scale(0.95);
}


      </style>
   </head>
   <body>
      <div class="container">
         <!-- Blocks Section -->
         <div class="blocks-wrapper">
            <div id="stateBlockContainer">
               <div class="state-block-row"></div>
            </div>
            <div id="winRateContainer"></div>
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
            <h2>Wagering Stats</h2>
            <div>Profit Loss: <span id="profit-loss">0</span></div>
            <div>Current Wager: <span id="current-wager">0</span></div>

            <hr/>
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
<div class="button-group">
    <button id="start-analytics-btn">Start Analytics</button>
    <button id="double-wager-btn">Double Wager</button>
    <button id="half-wager-btn">Half Wager</button>
    <button id="start-betting-btn">Start Betting</button>
    <button id="stop-betting-btn">Stop Betting</button>
    <button id="set-wager-btn">Set Wager</button>
</div>


  <br/>

  <label>Wager Amount</label>
  <input type="number" id="wager-amount" value="0.0001" />
  <br/>

<br/>

  <label>Max Loss</label>
  <input type="number" id="max-loss" value="5" />
  <br/>


  <label>Stop Method</label>
  <select id="stop-method">
    <option value="0" selected>Analytics</option>
    <option value="5">Analytics (Stop on Win)</option>
    <option value="1">Stop On Wins</option>
    <option value="2">Stop on Roll Multiplier</option>
    <option value="3">Risk On</option>
    <option value="7">Risk On (Drop Wager)</option>
    <option value="6">Risk On (Half Count)</option>
    <option value="4">Free Roll</option>
  </select>
  <br/>

  <label>Risk On Drop Wager Divisor</label>

  <select id="risk-on-wager-drop-divisor">
    <option value="1.5">1.5</option>
    <option value="2">2</option>
    <option value="2.5">2.5</option>
    <option value="3">3</option>
    <option value="3.5">3.5</option>
    <option value="4">4</option>
  </select>
  <label>Play Alert Sound</label>
  <input id="play-alert-sound" type="checkbox" checked />

  <label>Stop On Profit</label>
  <input id="stop-on-profit" type="checkbox" checked />

  <label>Stop On Max Loss</label>
  <input id="stop-on-max-loss" type="checkbox" checked />

  <label>Use Progressive Betting</label>
  <input id="use-progressive-betting" type="checkbox" />

  <label>Stop On Max Rolls</label>
  <input id="stop-on-max-rolls" type="checkbox" />

  <label>Max Rolls</label>
  <input type="number" id="max-rolls" value="100" />

  <!-- Threshold Settings -->
  <h3>Threshold Settings</h3>
  <label>Low Ratio Limit Count</label>
  <input type="number" id="low-ratio-limit-count" value="1" />

  <label>Low Ratio Threshold</label>
  <input type="number" id="low-ratio-threshold" value="3" />

  <!-- Stop Limit Settings -->
  <h3>Stop Limit Settings</h3>

  <label>Win Rate Stop LS Limit</label>
  <input type="number" id="win-rate-stop-ls-limit" value="2" />

  <label>Win Rate 1 Stop Limit</label>
  <input type="number" id="win-rate-stop-limit-1" value="20" />

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
    <option value="6.5">6.5</option>
    <option value="7">7</option>
    <option value="7.5" selected>7.5</option>
    <option value="8">8</option>
    <option value="8.5">8.5</option>
    <option value="9">9</option>
    <option value="9.5">9.5</option>
    <option value="10">10</option>
  </select>

<br/>
  <label>Tier Losing Streak Multiplier</label>
  <select id="ls-tier-multiplier">
    <option value="1">1</option>
    <option value="1.5">1.5</option>
    <option value="2">2</option>
    <option value="2.5">2.5</option>
    <option value="3">3</option>
    <option value="3.5">3.5</option>
    <option value="4">4</option>
    <option value="4.5">4.5</option>
    <option value="5" selected>5</option>
  </select>

<br/>
<br/>

<label>Minumum Tiers</label>
  <select id="min-tiers">
    <option value="1">1</option>
    <option value="2">2</option>
    <option value="3">3</option>
    <option value="4" selected>4</option>
    <option value="5">5</option>
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
                doInit();
            })();
        },
        false
    );

    // Initialize MutationObserver
})()