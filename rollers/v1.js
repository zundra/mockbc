/* Start Script */
// ==UserScript==
// @name         Limbo roller v1
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  try to take over the world!
// @author       You
// @match        https://stake.us/casino/games/limbo
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bc.game
// @require https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @require https://zundra.github.io/mockbc/dice_roll_observer.js
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    // Misc global vars
    let firstLoad = true;
    let rollCount = 0;
    let sessionRollCount = 0;
    let losingStreak = 0;
    let stopped = true;
    let hitCount = 0;
    let profit = 0;
    let wager = 0;
    let baseWager = 0;
    let lowTarget = null;

    // Constants
    const LOW_TARGETS_TABLE_ID = "low-targets-body";
    const TARGETS_TABLE_ID = "targets-body";
    const HOUSE_EDGE = 1.01;
    const EVEN_TEO_PAYOUT = 1.98;
    const ROLLING_STATS = initRollingStats();
    const HIGH_TARGETS = generateTargets();
    const LOW_TARGETS = generateLowTargets();
    const TARGETS = [...LOW_TARGETS, ...HIGH_TARGETS];
    const HIGH_HITS = initHighHits();

    // Fields
    let lsField = null;
    let highHitThresholdField = null;
    let hitCountTargetField = null;
    let maxRollField = null;
    let restHighHitField = null;
    let highHitResetThresholdField = null;
    let maxLossField = null;
    let maxMultiplierField = null;
    let shortWRThresholdField = null;
    let longWRThresholdField = null;
    let med1000thresholdField = null;
    let med100thresholdField = null;
    let med10thresholdField = null;
    let stdDevThresholdField = null;
    let wagerInputField = null;
    let payoutInputField = null;

    injectUI();
    initWindowEvents();

    function evalResult(result) {
        rollCount++;
        sessionRollCount++;

        ROLLING_STATS.push(result);

        let payout = getPayout();
        let wager = getWager();

        if (result >= payout) {
            hitCount++;
            losingStreak = 0;
            profit += payout * getWager() - getWager();
        } else {
            losingStreak++;
            profit -= getWager();
        }

        HIGH_HITS.addResult(result, ROLLING_STATS.getStandardDeviation(10));
        setStreaks(result);
        updateUI();
        updateStats();
        checkHalts(result);

        maybeRunTests({
          rollCount,
          result,
          rollingStats: ROLLING_STATS,
          targets: TARGETS,
          highHits: HIGH_HITS
        });
    }

    function maybeRunTests(ctx) {
        if (!getIsTestMode()) return;
        runTests(ctx);
    }

    function setStreaks(result) {
        for (let i = 0; i < TARGETS.length; i++) {
            TARGETS[i].push(result);
        }
    }

    function updateStats() {
        updateCompressionTable();
    }

    function checkHalts(result) {
        const payout = getPayout();

        if (getStopOnProfit() && profit >= getProfitTarget()) {
            halt(`Profit target hit ${profit.toFixed(4)}`, true);
            return;
        }

        if (getStopOnHitCount() && hitCount >= getHitCountTarget()) {
            hitCount = 0;
            halt(`Target hit ${hitCount} times`);
            return;
        }

        if (getStopOnMaxRolls() && sessionRollCount >= getMaxRolls()) {
            halt("Max rolls hit");
            return;
        }

        if (getHaltOnLows()) {
            let breached = TARGETS.filter(
                (target) => target.getPayout() < 2 && target.haltMessage != null
            );
            if (breached.length !== 0) {
                halt(breached[0].haltMessage);
                return;
            }
        }

        if (getStopOnMaxLoss() && maxLossExceeded()) {
            halt("Max loss exceeded: " + profit, true);
            return;
        }

        const median1000 = ROLLING_STATS.getMedian(1000);

        if (median1000 > EVEN_TEO_PAYOUT) return;

        const median10 = ROLLING_STATS.getMedian(10);
        const median100 = ROLLING_STATS.getMedian(100);

        const med10threshold = getMedian10Threshold();
        const med100threshold = getMedian100Threshold();
        const med1000threshold = getMedian1000Threshold();

        if (
            rollCount > 100 &&
            lowTarget.getLosingStreak() >= 5 &&
            median10 < med10threshold &&
            median100 < med100threshold
        ) {
            halt(
                `Extreme median 10 ${med10threshold} exceeded threshold ${med100threshold}`
      );
        return;
    }


      if (getRiskOn()) return;

      for (const t of TARGETS) {
          const shortThresh = getShortWinRateThrehold();
          const longThresh = getLongWinRateThrehold();
          const maxMultiplier = getMaxMultiplier();

          const belowWRThresholds = t.isBelowWinRates(
              shortThresh,
              longThresh,
              maxMultiplier
          );

          if (lowTarget.getLosingStreak() >= 2 && belowWRThresholds && t.getLosingStreak() > t.getPayout()) {
              const { payout, shortWR, longWR } = belowWRThresholds;
              halt(
                  `[Target ${payout}×] Breached Win Rate Threshold ` +
                  `WR(Short)=${shortWR}, WR(Long)=${longWR}, Low Payout LS = ${lowTarget.getLosingStreak()}`
        );
          return;
      }

        const stdDevThrehold = getStdDevThrehold();
        const stdDev10 = ROLLING_STATS.getStandardDeviation(10);

        if (rollCount > 100 && lowTarget.getLosingStreak() >= 5 && stdDev10 <= stdDevThrehold && median10 <= 1.5 && median100 < 1.92 && median1000 < 1.92) {
            halt(`[Breached standard deviation threshold] Threshold: ${stdDevThrehold}, Actual: ${stdDev10}`);
            return;
        }
    }


      if (getStopOnLosingStreak()) {
          let breached = TARGETS.filter((target) => target.haltMessage != null);
          if (breached.length !== 0) {
              halt(breached[0].haltMessage);
              return;
          }
      }
  }

    function initRollingStats() {
        class RollingStats {
            constructor(size) {
                this.size = size;
                this.buffer = new Array(size).fill(null);
                this.index = 0;
                this.count = 0;
            }

            push = (value) => {
                if (this.count >= this.size) {
                    // Overwrite old value
                    this.buffer[this.index] = value;
                } else {
                    this.buffer[this.index] = value;
                    this.count++;
                }

                this.index = (this.index + 1) % this.size;
            };

            getValues = (lookback = this.count) => {
                const count = Math.min(lookback, this.count);
                const values = [];
                const start = (this.index - count + this.size) % this.size;
                for (let i = 0; i < count; i++) {
                    const idx = (start + i + this.size) % this.size;
                    values.push(this.buffer[idx]);
                }
                return values;
            };

            getMean = (lookback = this.count) => {
                const vals = this.getValues(lookback);
                if (vals.length === 0) return 0;
                const sum = vals.reduce((a, b) => a + b, 0);
                return sum / vals.length;
            };

            getVariance = (lookback = this.count) => {
                const vals = this.getValues(lookback);
                if (vals.length <= 1) return 0;
                const mean = this.getMean(lookback);
                const sumOfSquares = vals.reduce((sum, v) => sum + (v - mean) ** 2, 0);
                return sumOfSquares / (vals.length - 1);
            };

            getStandardDeviation = (lookback = this.count) => {
                return Math.sqrt(this.getVariance(lookback));
            };

            getMedian = (lookback = this.count) => {
                const vals = this.getValues(lookback);
                if (vals.length === 0) return null;
                const sorted = [...vals].sort((a, b) => a - b);
                const mid = Math.floor(sorted.length / 2);
                return sorted.length % 2 === 0
                    ? (sorted[mid - 1] + sorted[mid]) / 2
                : sorted[mid];
            };
        }

        return new RollingStats(10000);
    }

    function generateLowTargets() {
        return generateLowPayouts().map((p) => {
            const target = createTarget(parseFloat(p.toFixed(2)));
            if (target.getPayout() === 1.5) {
                lowTarget = target;
            }
            return target;
        });
    }


    function generateTargets() {
        return generatePayouts().map((p) => { return createTarget(parseFloat(p.toFixed(2))) })
    }

    function createTarget(payout) {
        class Stats {
            constructor(payout, size) {
                this.size = size
                this.payout = payout
                this.streak = 0
                this.pstreak = 0
                this.hitCount = 0
                this.losingStreak = 0

                this.results = [];
                this.index = 0
                this.sum = 0
            }

            push = (result) => {
                this.updateStreak(result)
                this.results.push(result);

                if (this.results.length === this.size) {
                    this.results.shift();
                }
            }

            updateStreak = (result) => {
                if (result >= this.payout) {
                    this.hitCount++
                    if (this.streak < 0) {
                        this.pstreak = this.streak
                    }
                    this.streak = Math.max(this.streak + 1, 1)
                } else {
                    if (this.streak > 0) {
                        this.streakSignFlipped = true
                        this.pstreak = this.streak
                    }
                    this.streak = Math.min(this.streak - 1, -1)
                }

                this.losingStreak = this.streak < 0 ? this.streak : 0
            }

            getValues = (lookback = this.count) => {
              return this.results.slice(-lookback);
            };

            getWinRate = (lookback = this.count) => {
              const vals = this.getValues(lookback);
              if (vals.length === 0) return 0;
              const winCount = vals.filter((a) => a >= this.payout).length;
              return winCount / vals.length;
            };

            getWinRateTeoDelta = (lookback = this.results.length) => {
                const expectedRate = this.getTeo();
                const count = this.getValues(lookback).length;
                return (this.getWinRate(lookback) - expectedRate) * count;
            }

            getTeo = () => 1 / (this.getPayout() * HOUSE_EDGE)
            getWinRatePercentOfTeo = (lookback = 100) => (this.getWinRate(lookback) / this.getTeo()) * 100;

            reset() {
                rollCount = 0
                this.rollCount = 0
            }

            getHitCount = () => this.hitCount
            getRollCount = () => rollCount
            getStreak = () => this.streak
            getPreviousStreak = () => this.pstreak
            getLosingStreak = () =>
            this.losingStreak < 0 ? Math.abs(this.losingStreak) : 0
            getCount = () => this.count
            getPayout = () => this.payout
            getStrength = () => this.getTeo() * this.getStreak()
            getLSRatio = () => Math.floor(this.getLosingStreak() / this.payout)
            getLSRatioAbs = () => Math.abs(this.getLSRatio())
        }

        class Target {
            constructor(payout) {
                this.length = 1000;
                this.payout = parseFloat(payout);
                this.stats = new Stats(payout, 1000);
                this.shortWindow = this.payout <= 2 ? 10 : 100;
                this.longWindow = this.payout <= 2 ? 100 : 1000;
                this.losingStreak = 0;
                this.hitCount = 0;
                this.rollCount = 0;
                this.haltMessage = null;
                this.teo = 1 / (this.payout * HOUSE_EDGE);
            }

            getTeo = () => this.stats.getTeo();
            getWinRatePercentOfTeo = (lookback = 100) => this.stats.getWinRatePercentOfTeo(lookback);
            getWinRateTeoDelta = (lookback = 100) => this.stats.getWinRateTeoDelta(lookback);
            getTotalWinRate = () => this.hitCount / this.rollCount;
            getLosingStreak = () => this.losingStreak;
            getPayout = () => this.payout;

            push(result) {
                this.rollCount++;
                const winBump = this.payout - 1 + this.e;
                const loseBump = -1 + this.e;

                if (result >= this.payout) {
                    this.hitCount++;
                    this.haltMessage = null;
                    this.losingStreak = 0;
                } else {
                    this.losingStreak = (this.losingStreak ?? 0) + 1;

                    if (this.losingStreak >= this.payout * getLosingStreakMultiplier()) {
                        this.haltMessage = `[Losing Streak Threshold Breached] Payout: ${this.payout}, Streak: ${this.losingStreak}`;
                    } else {
                        this.haltMessage = null;
                    }
                }
                this.stats.push(result);

            }

            isBelowWinRates(
             shortThresh = 70,
             longThresh = 80,
             maxMultiplier = 1000000
            ) {
                if (rollCount < 100) return null;

                if (this.payout > maxMultiplier || this.payout < 1.5) return null;

                const shortWR = this.getWinRatePercentOfTeo(this.shortWindow);
                const longWR = this.getWinRatePercentOfTeo(this.longWindow);

                const avgThreshold = (shortThresh + longThresh) / 2;
                const avgWR = (shortWR + longWR) / 2;
                const winRatesBreached = avgWR < avgThreshold;

                if (!winRatesBreached) return false;

                // ✅ Return old style result object
                return {
                    payout: this.payout,
                    shortWR: shortWR.toFixed(2),
                    longWR: longWR.toFixed(2),
                    avgWR: avgWR.toFixed(2)
                };
            }

            getDynamicStreakLimit(baseMult) {
                const shortWR = this.getWinRatePercentOfTeo(this.shortWindow);
                const longWR = this.getWinRatePercentOfTeo(this.longWindow);

                // average WR for dynamic adjustment
                const avgWR = (shortWR + longWR) / 2;
                const deficit = Math.max(0, 100 - avgWR); // how far below fair we are
                const dynamicMult = baseMult * (1 - deficit / 100); // less streak needed for worse WRs
                return Math.max(1, this.payout * dynamicMult);
            }
            getTableIDPrefix = () => this.tableIDPrefix;
            getHTMLID = () =>
            this.payout
            .toString()
            .replace(/\./g, "_")
            .replace(/[^\w-]/g, "");
        }

        return new Target(payout);
    }

    function generateLowPayouts() {
      return [1.01, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2];
    }

    function generatePayouts() {
         return Array.from(
            {
                length: 19
            },
            (v, k) => 3 + k * 1
        );
    }

    function halt(stopMessage, clearWager = false) {
        if (clearWager) {
            setWager(0);
        }
        console.log(stopMessage);
        $("#message-box").text(stopMessage);
        stopMessage = "";
        baseWager = 0;
        profit = 0;
        stopBetting();
        return;
    }

    function updateUI() {
        $("#roll-count").html(rollCount);
        $("#session-roll-count").html(sessionRollCount);
        $("#hit-count").html(hitCount);

        $("#profit-loss")
            .html(profit.toFixed(4))
            .css({
            backgroundColor: `${
          profit > 0 ? "green" : profit < 0 ? "red" : "transparent"
        }`
      });

        updateTableRows();
        updateHighHits();
    }

    function getBandHue(streak, payout) {
        if (streak < payout) return 120;

        // 0 = red, 1 = orange, 2 = amber
        const band = streak % 3;

        switch (band) {
            case 0:
                return 5; // deep red
            case 1:
                return 22; // orange
            case 2:
                return 40; // dark yellow / amber
        }
    }

    function getBandLightness(streak) {
        return 32 + (streak % 3) * 4;
    }

    function getSeverityAlpha(streak, payout) {
        const ratio = streak / payout;
        const capped = Math.min(ratio, 4);
        return 0.2 + capped * 0.2; // 0.2 → 1.0
    }

    function getLsColor(streak, payout) {
        const h = getBandHue(streak, payout);
        const s = 75;
        const l = getBandLightness(streak);
        const a = getSeverityAlpha(streak, payout);

        return `hsla(${h}, ${s}%, ${l}%, ${a})`;
    }

    function getRowColors(payout, streak, shortWR, longWR, wrdShort, wrdLong) {
        const shortThresh = getShortWinRateThrehold();
        const longThresh = getLongWinRateThrehold();
        const wrColors = syncedColor(shortWR, longWR, shortThresh, longThresh, wrdShort, wrdLong);
        const lsColor = getLsColor(streak, payout);

        return {
            wrColors,
            lsColor
        };
    }

    const stateCache = new Map();

    function getColor(wr, wrd, threshold = 90) {
        const colors = {bg: "transparent", fg: "white", wrdfg: "white", wrdbg: "transparent"}

        if (wrd >= 1) {
          colors.wrdbg = "green";
        } else if (wrd <= -1) {
          colors.wrdbg = "red";
        }

        if (wr > 100) {
            colors.bg = "green";
            return colors;
        } else if (wr < threshold) {
            colors.bg = "red";
            return colors;
        } else if (wr < 95) {
            colors.bg = "yellow";
            colors.fg = "black";
            return colors;
        }


        return colors;
    }

    function syncedColor(shortWR, longWR, shortThresh, longThresh, wrdShort, wrdLong) {
        return { short: getColor(shortWR, wrdShort, shortThresh), long: getColor(longWR, wrdLong, longThresh) };
    }

    function rgbaFromHSV(hsv, alpha) {
        const [r, g, b] = hsvToRgb(hsv[0], hsv[1], hsv[2]);
        return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
    }

    function updateTableRows(data) {
       if (!$.trim($(`#${TARGETS_TABLE_ID}`).html())) {
            $(`#${TARGETS_TABLE_ID}`).append(createTableRows(HIGH_TARGETS));
        }

       if (!$.trim($(`#${LOW_TARGETS_TABLE_ID}`).html())) {
            $(`#${LOW_TARGETS_TABLE_ID}`).append(createTableRows(LOW_TARGETS));
        }

        for (let i = 0; i < TARGETS.length; i++) {
            const target = TARGETS[i];
            const payout = target.payout;
            const ls = target.losingStreak;
            const streakId = target.getHTMLID();
            const diff = target.lsdiff;
            const wrpShort = target.getWinRatePercentOfTeo(target.shortWindow);
            const wrpLong = target.getWinRatePercentOfTeo(target.longWindow);
            const wrdShort = target.getWinRateTeoDelta(target.shortWindow);
            const wrdLong = target.getWinRateTeoDelta(target.longWindow);
            const streakLimit = target.getDynamicStreakLimit(getLosingStreakMultiplier());

            $(`#payout-${streakId}`).html(isNaN(payout) ? "—" : payout.toFixed(2));

            $(`#win-rate-percent-short-${streakId}`).html(
                isNaN(wrpShort) ? "—" : wrpShort.toFixed(2)
            );

            $(`#win-rate-percent-short-delta-${streakId}`).html(
                isNaN(wrdShort) ? "—" : wrdShort.toFixed(2)
            );

            $(`#win-rate-percent-long-${streakId}`).html(
                isNaN(wrpLong) ? "—" : wrpLong.toFixed(2)
            );

            $(`#win-rate-percent-long-delta-${streakId}`).html(
                isNaN(wrdLong) ? "—" : wrdLong.toFixed(2)
            );

            $(`#streak-${streakId}`).html(isNaN(ls) ? "—" : ls);

            const colors = getRowColors(payout, ls, wrpShort, wrpLong, wrdShort, wrdLong);
            const lsColor = colors.lsColor;

            const wrColor50fg = colors.wrColors.short.fg;
            const wrColor50bg = colors.wrColors.short.bg;
            
            const wrdShortColorfg = colors.wrColors.short.wrdfg;
            const wrdShortColorbg = colors.wrColors.short.wrdbg;

            const wrColor100fg = colors.wrColors.long.fg;
            const wrColor100bg = colors.wrColors.long.bg;
            const wrdLongColorfg = colors.wrColors.long.wrdfg;
            const wrdLongColorbg = colors.wrColors.long.wrdbg;

            const $streakCol = $(`#streak-${streakId}`).closest("td");
            $streakCol.css("background-color", lsColor);

            const $wrCol50 = $(`#win-rate-percent-short-${streakId}`).closest("td");
            $wrCol50.css({"background-color": wrColor50bg, "color": wrColor50fg});

            const $wrColShortDelta = $(`#win-rate-percent-short-delta-${streakId}`).closest("td");
            $wrColShortDelta.css({"background-color": wrdShortColorbg, "color": wrdShortColorfg});

            const $wrCol100 = $(`#win-rate-percent-long-${streakId}`).closest("td");
            $wrCol100.css({"background-color": wrColor100bg, "color": wrColor100fg});

            const wrColLongDelta = $(`#win-rate-percent-long-delta-${streakId}`).closest("td");
            wrColLongDelta.css({"background-color": wrdLongColorbg, "color": wrdLongColorfg});
        }
    }

    function updateHighHits() {
        const highHits = HIGH_HITS.getResults();

        $("#highHit-hit")
            .text(`${highHits.highHit.hit}`)
            .css({
            backgroundColor: highHits.highHit.delta < 0 ? "red" : "transparent"
        });

        $("#highHit50-hit")
            .text(`${highHits.highHit50.hit}`)
            .css({
            backgroundColor: highHits.highHit50.delta < 0 ? "red" : "transparent"
        });
        $("#highHit50-age").text(`${highHits.highHit50.age}`);
        $("#highHit50-delta").text(`${highHits.highHit50.delta.toFixed(2)}`);

        $("#highHit100-hit")
            .text(`${highHits.highHit100.hit}`)
            .css({
            backgroundColor:
            highHits.highHit100.delta < 0 ? "red" : "transparent"
        });
        $("#highHit100-age").text(`${highHits.highHit100.age}`);
        $("#highHit100-delta").text(`${highHits.highHit100.delta.toFixed(2)}`);

        $("#highHit1000-hit")
            .text(`${highHits.highHit1000.hit}`)
            .css({
            backgroundColor:
            highHits.highHit1000.delta < 0 ? "red" : "transparent"
        });
        $("#highHit1000-age").text(`${highHits.highHit1000.age}`);
        $("#highHit1000-delta").text(`${highHits.highHit1000.delta.toFixed(2)}`);

        $("#highHit10000-hit")
            .text(`${highHits.highHit10000.hit}`)
            .css({
            backgroundColor:
            highHits.highHit10000.delta < 0 ? "red" : "transparent"
        });

        $("#highHit10000-age").text(`${highHits.highHit10000.age}`);
      $("#highHit10000-delta").text(`${highHits.highHit10000.delta.toFixed(2)}`);
  }
    function getStopOnMaxRolls() {
        return getMaxRolls() !== 0;
    }

    function getStopOnLosingStreak() {
        return getLosingStreakMultiplier() !== 0;
    }

    function getStopOnHitCount() {
        return getHitCountTarget() !== 0;
    }

    function getStopOnProfit() {
        return getProfitTarget() !== 0;
    }

    function getProfitTarget() {
        return Number($("#profit-target").val());
    }

    function getStopOnMaxLoss() {
        return getMaxLoss() !== 0;
    }

    function getMaxLoss() {
        if (!maxLossField) {
            maxLossField = $("#max-loss");
        }
        return Number(maxLossField.val());
    }

    function getRiskOn() {
        return $("#risk-on").prop("checked");
    }

    function getHaltOnLows() {
        return $("#halt-on-lows").prop("checked");
    }

    function getResetOnStart() {
        return $("#reset-on-start").prop("checked");
    }

    function getHitCountTarget() {
        if (!hitCountTargetField) {
            hitCountTargetField = $("#hit-count-target");
        }
        return Number(hitCountTargetField.val());
    }

    function getMaxRolls() {
        if (!maxRollField) {
            maxRollField = $("#max-rolls");
        }
        return Number(maxRollField.val());
    }

    function getLosingStreakMultiplier() {
        if (!lsField) {
            lsField = $("#ls-multiplier");
        }
        return Number(lsField.val());
    }

    function getMaxMultiplier() {
        if (!maxMultiplierField) {
            maxMultiplierField = $("#max-multiplier");
        }
        return Number(maxMultiplierField.val());
    }

    function getShortWinRateThrehold() {
        if (!shortWRThresholdField) {
            shortWRThresholdField = $("#short-wr-threshold");
        }
        return Number(shortWRThresholdField.val());
    }

    function getStdDevThrehold() {
        if (!stdDevThresholdField) {
            stdDevThresholdField = $("#std-dev-threshold");
        }
        return Number(stdDevThresholdField.val());
    }

    function getLongWinRateThrehold() {
        if (!longWRThresholdField) {
            longWRThresholdField = $("#long-wr-threshold");
        }
        return Number(longWRThresholdField.val());
    }

    function getMedian1000Threshold() {
        if (!med1000thresholdField) {
            med1000thresholdField = $("#med-1000-threshold");
        }
        return Number(med1000thresholdField.val());
    }

    function getMedian100Threshold() {
        if (!med100thresholdField) {
            med100thresholdField = $("#med-100-threshold");
        }
        return Number(med100thresholdField.val());
    }

    function getMedian10Threshold() {
        if (!med10thresholdField) {
            med10thresholdField = $("#med-10-threshold");
        }
        return Number(med10thresholdField.val());
    }

    function initHighHits() {

        class HighHits {

            constructor() {
                this.rollCount = 0;

                this.intervals = [50, 100, 1000, 10000];
                this.data = new Map();

                for (const interval of this.intervals) {
                    this.data.set(interval, {
                        startRoll: 1,
                        highHit: 0,
                        highRoll: 0,
                        frozen: false
                    });
                }

                this.globalHigh = 0;
                this.globalRoll = 0;
            }

            addResult(result) {

                this.rollCount++;

                // --- Global High ---
                if (result > this.globalHigh) {
                    this.globalHigh = result;
                    this.globalRoll = this.rollCount;
                }

                // --- Bucket Logic ---
                for (const interval of this.intervals) {

                    const bucket = this.data.get(interval);
                    const bucketAge = this.rollCount - bucket.startRoll + 1;

                    // Update high within bucket
                    if (result > bucket.highHit) {
                        bucket.highHit = result;
                        bucket.highRoll = this.rollCount;

                        // If frozen and new high taken → unfreeze
                        if (bucket.frozen) {
                            bucket.frozen = false;
                            bucket.startRoll = this.rollCount;
                        }
                    }

                    // If bucket length reached
                    if (bucketAge >= interval && !bucket.frozen) {

                        if (bucket.highHit >= interval) {
                            // Normal reset
                            bucket.startRoll = this.rollCount;
                            bucket.highHit = result;
                            bucket.highRoll = this.rollCount;
                        } else {
                            // Freeze until high taken out
                            bucket.frozen = true;
                        }
                    }
                }
            }

            getResults() {

                const results = {};

                for (const interval of this.intervals) {

                    const bucket = this.data.get(interval);
                    const age = this.rollCount - bucket.startRoll + 1;
                    const overrun = age - interval;

                    const delta =
                        overrun <= 0
                            ? interval - age   // positive countdown
                            : -overrun;        // negative once exceeded

                    results[`highHit${interval}`] = {
                        hit: bucket.highHit,
                        round: bucket.highRoll,
                        age,
                        delta,
                        frozen: bucket.frozen
                    };
                }

                results.highHit = {
                    hit: this.globalHigh,
                    round: this.globalRoll,
                    age: this.rollCount - this.globalRoll
                };

                return results;
            }
        }

        return new HighHits();
    }
    function initWindowEvents() {
        $("#set-risk-on-btn").click(function () {
            $("#max-rolls").val(Math.min(getPayout() - 1));
            $("#risk-on").prop("checked", true);
            $("#hit-count-target").val(1);
            $("#profit-target").val(getProfitTarget());
            setWager(getScaledWager());
        });

        $("#set-risk-off-btn").click(function () {
            $("#risk-on").prop("checked", false);
            $("#roll-mode").val("none");
            $("#hit-count-target").val(0);
            $("#max-rolls").val(0);
            $("#profit-target").val(0);
            setWager(0);
        });

        $("#double-wager-btn").click(function () {
            setWager(Math.min(1, getWager() * 2));
        });

        $("#half-wager-btn").click(function () {
            setWager(Math.max(0.0001, getWager() / 2));
        });

        $("#zero-wager-btn").click(function () {
            setWager(0);
        });

        $("#start-betting-btn").click(function () {
            startBetting();
        });

        $("#stop-betting-btn").click(function () {
            stopBetting();
        });
        $(document).on("keypress", function (e) {
            if (e.which === 122) {
                if (stopped) {
                    startBetting();
                } else {
                    stopBetting();
                }
            }
        });

        $("#control-panel").draggable({
            scroll: false
        });
        $("#stats-panel").draggable({
            scroll: false
        });
    }

    function updateCompressionTable() {
        function classifyCompression(std, med) {
            const compressionScore = calculateCompressionScore(std, med);

            if (compressionScore > 2)
                return { label: "COMP", color: "#ff3333" };

            if (compressionScore > 1)
                return { label: "TIGHT", color: "#ffaa00" };

            return { label: "NORMAL", color: "#4caf50" };
        }
        
        const windows = [10, 100, 1000];

        windows.forEach(w => {
            const std = ROLLING_STATS.getStandardDeviation(w);
            const med = ROLLING_STATS.getMedian(w);

            const state = classifyCompression(std, med);

            $(`#comp-std-${w}`).text(std.toFixed(2));
            $(`#comp-med-${w}`).text(med.toFixed(2));

            const $state = $(`#comp-state-${w}`);
            $state.text(state.label);
            $state.css("color", state.color);
        });
    }

    function calculateCompressionScore(std, med) {
      return (1.98 - med) * 10 + (1 - Math.min(std, 2));
    }

    function maxLossExceeded() {
        if (profit >= 0) return;

        return Math.abs(profit) >= getMaxLoss();
    }

    function getScaledWager(scalingFactor = 0.9) {
        const target = getPayout();
        const baseWager = getBaseWager();
        return parseFloat(
            `${Math.max(
                0.01,
                baseWager * Math.pow(1.01 / target, scalingFactor)
            ).toFixed(2)}`
    );
    }

    function getBaseWager() {
        return getBalance() * 0.01;
    }

    function getBalance() {
        const rawText = $('[data-testid="balance-toggle"]')
        .find('span[data-ds-text="true"]')
        .filter((_, el) => {
            const t = $(el).text().trim();
            return /^\d+(\.\d+)?$/.test(t);
        })
        .first();

        return parseFloat(rawText.text());
    }

    function getMaxWager() {
        return parseFloat($("#max-wager").val());
    }

    function getWager() {
        if (!wagerInputField) {
            wagerInputField = $('[data-testid="input-game-amount"]');
        }

        return Number(wagerInputField.val());
    }

    function setWager(amount) {
        const inputField = $('[data-testid="input-game-amount"]');

        if (inputField.length) {
            const currentValue = parseFloat(inputField.val());

            if (currentValue !== amount) {
                // Only set if different
                let nativeSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype,
                    "value"
                ).set;

                nativeSetter.call(inputField[0], amount);
                inputField[0].dispatchEvent(
                    new Event("input", {
                        bubbles: true
                    })
                );
                inputField[0].dispatchEvent(
                    new Event("change", {
                        bubbles: true
                    })
                );
                // console.log(`Wager set to: ${amount}`);
            }
        } else {
            console.error("Wager input field not found!");
        }
    }

    function setPayout(amount) {
        const inputField = $('[data-testid="target-multiplier"]');

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
        if (!payoutInputField) {
            payoutInputField = $('[data-testid="target-multiplier"]');
        }

        return Number(payoutInputField.val());
    }

    function getTeo(payout) {
        return 1 / (payout * HOUSE_EDGE);
    }

    function getExpectedHits() {
        const maxRolls = getMaxRolls();

        if (maxRolls === 0) return 1;

        return Math.ceil(getTeo(getPayout()) * maxRolls) + 1;
    }

    // Function to start the betting process
    function startBetting() {
        sessionRollCount = 0;
        profit = 0;
        hitCount = 0;
        stopped = false;
        doBet();
    }

    function stopBetting() {
        stopped = true;
    }

    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function doInit() {
        observeRollChanges(evalResult);
    }

    async function doBet() {
        console.log("Stopped = ", stopped);
        while (true) {
            // Trigger the button click

            $('[data-testid="bet-button"]').trigger("click");

            // Wait for 1 second (1000 ms) before clicking again
            await delay(10);

            // Stop condition check inside the loop
            if (stopped) {
                console.log("Stopped betting.");
                break;
            }
        }
    }

    function generateAlertSounds() {
        return {
            1: new Audio("https://zundra.github.io/script-alerts/1.mp3"),
            2: new Audio("https://zundra.github.io/script-alerts/2.mp3"),
            3: new Audio("https://zundra.github.io/script-alerts/3.mp3"),
            4: new Audio("https://zundra.github.io/script-alerts/4.mp3"),
            5: new Audio("https://zundra.github.io/script-alerts/5.mp3"),
            6: new Audio("https://zundra.github.io/script-alerts/6.mp3"),
            7: new Audio("https://zundra.github.io/script-alerts/7.mp3"),
            8: new Audio("https://zundra.github.io/script-alerts/8.mp3"),
            9: new Audio("https://zundra.github.io/script-alerts/9.mp3"),
            10: new Audio("https://zundra.github.io/script-alerts/10.mp3"),
            20: new Audio("https://zundra.github.io/script-alerts/20.mp3"),
            30: new Audio("https://zundra.github.io/script-alerts/30.mp3"),
            40: new Audio("https://zundra.github.io/script-alerts/40.mp3"),
            50: new Audio("https://zundra.github.io/script-alerts/50.mp3"),
            60: new Audio("https://zundra.github.io/script-alerts/60.mp3"),
            70: new Audio("https://zundra.github.io/script-alerts/70.mp3"),
            80: new Audio("https://zundra.github.io/script-alerts/80.mp3"),
            90: new Audio("https://zundra.github.io/script-alerts/90.mp3"),
            100: new Audio("https://zundra.github.io/script-alerts/100.mp3"),
            200: new Audio("https://zundra.github.io/script-alerts/200.mp3"),
            300: new Audio("https://zundra.github.io/script-alerts/300.mp3"),
            400: new Audio("https://zundra.github.io/script-alerts/400.mp3"),
            500: new Audio("https://zundra.github.io/script-alerts/500.mp3"),
            600: new Audio("https://zundra.github.io/script-alerts/600.mp3"),
            700: new Audio("https://zundra.github.io/script-alerts/700.mp3"),
            800: new Audio("https://zundra.github.io/script-alerts/800.mp3"),
            900: new Audio("https://zundra.github.io/script-alerts/900.mp3"),
            hundred: new Audio("https://zundra.github.io/script-alerts/hundred.mp3"),
            thousand: new Audio(
                "https://zundra.github.io/script-alerts/thousand.mp3"
            ),
            million: new Audio("https://zundra.github.io/script-alerts/million.mp3"),
            hit: new Audio("https://zundra.github.io/script-alerts/hit.mp3"),
            target: new Audio("https://zundra.github.io/script-alerts/target.mp3"),
            stop: new Audio("https://zundra.github.io/script-alerts/stop.mp3"),
            roll: new Audio("https://zundra.github.io/script-alerts/roll.mp3")
        };
    }
    function injectUI() {
        $("<style>")
            .prop("type", "text/css")
            .html(
            `
            .my-container {
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

            .container-header {
                background: #333;
                padding: 12px;
                font-weight: bold;
                border-radius: 8px 8px 0 0;
                font-size: 16px;
                cursor: grab;
                text-align: center;
            }


            #stats-panel {
                position: fixed;
                top: 200px;
                right: 400px;
                width: 800px;

            }

            #control-panel {
                position: fixed;
                top: 200px;
                right: 100px;

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


             /* Draggable Stats Pane */
              .stats-pane {
              position: absolute;
              top: 300px;
              left: 470px;
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
                    .stats-block {
      margin-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      padding-bottom: 5px;
      background-color: #1e1e1e; border: 1px solid #333; border-radius: 6px; padding: 10px; margin-top: 10px; color: #ccc; font-family: sans-serif; font-size: 13px; overflow-x: auto;
      }
        `
      )
        .appendTo("head");
      let html = `
  <div class="my-container" id="stats-panel">

    <table><tr valign="top"><td>
          <div class="stats-block">
            
              <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid #444;">
                  <th style="position: sticky; left: 0; background-color: #1e1e1e; z-index: 1; text-align: left; padding: 6px; white-space: nowrap;">Payout</th>
                  <th style="text-align: left; padding: 6px;">Streak</th>
                  <th style="text-align: left; padding: 6px;">WR% S</th>
                  <th style="text-align: left; padding: 6px;">Δ S</th>
                  <th style="text-align: left; padding: 6px;">WR% L</th>
                  <th style="text-align: left; padding: 6px;">Δ L</th>
                </tr>
              </thead>
              <tbody id="${LOW_TARGETS_TABLE_ID}">
              </tbody>
            </table>
            <hr/>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid #444;">
                  <th style="position: sticky; left: 0; background-color: #1e1e1e; z-index: 1; text-align: left; padding: 6px; white-space: nowrap;">Payout</th>
                  <th style="text-align: left; padding: 6px;">Streak</th>
                  <th style="text-align: left; padding: 6px;">WR% S</th>
                  <th style="text-align: left; padding: 6px;">Δ S</th>
                  <th style="text-align: left; padding: 6px;">WR% L</th>
                  <th style="text-align: left; padding: 6px;">Δ L</th>
                </tr>
              </thead>
              <tbody id="${TARGETS_TABLE_ID}">
              </tbody>
            </table>
          </div>

</td>
<td>
<div class="stats-block">
  <h3>Compression State</h3>
  <table style="width:100%; font-size:12px; text-align:right;">
    <thead>
      <tr>
        <th>Win</th>
        <th>Std</th>
        <th>Med</th>
        <th>State</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>10</td>
        <td id="comp-std-10"></td>
        <td id="comp-med-10"></td>
        <td id="comp-state-10"></td>
      </tr>
      <tr>
        <td>100</td>
        <td id="comp-std-100"></td>
        <td id="comp-med-100"></td>
        <td id="comp-state-100"></td>
      </tr>
      <tr>
        <td>1000</td>
        <td id="comp-std-1000"></td>
        <td id="comp-med-1000"></td>
        <td id="comp-state-1000"></td>
      </tr>
    </tbody>
  </table>
</div>

     <div class="stats-block">
        <h3>High Hits</h3>
        <table style="font-size: 11px; width: 100%; text-align: right;">
           <thead>
              <tr style="text-align: center;">
                 <th style="width: 25%;">Rolls</th>
                 <th style="width: 25%;">Hit</th>
                 <th style="width: 25%;">Δ</th>
                 <th style="width: 25%;">Age</th>
              </tr>
           </thead>
           <tbody>
              <tr>
                 <td>50</td>
                 <td><span id="highHit50-hit"></span></td>
                 <td><span id="highHit50-delta"></span></td>
                 <td><span id="highHit50-age"></span></td>
              </tr>
              <tr>
                 <td>100</td>
                 <td><span id="highHit100-hit">0</span></td>
                 <td><span id="highHit100-delta">0</span></td>
                 <td><span id="highHit100-age">0</span></td>
              </tr>
              <tr>
                 <td>1000</td>
                 <td><span id="highHit1000-hit">0</span></td>
                 <td><span id="highHit1000-delta">0</span></td>
                 <td><span id="highHit1000-age">0</span></td>
              </tr>
              <tr>
                 <td>10000</td>
                 <td><span id="highHit10000-hit">0</span></td>
                 <td><span id="highHit10000-delta">0</span></td>
                 <td><span id="highHit10000-age">0</span></td>
              </tr>
           </tbody>
        </table>
     </div>
  </div>


    <div class="my-container" id="control-panel">
  <div class="container-header">⚙️ Control Panel</div>

  <div id="message-box" class="message-box"></div>

  <div id="stats" class="stats-box" style="
            margin: 12px 0;
            background-color: #444;
            padding: 10px;
            border-radius: 6px;
            color: white;
            font-size: 0.9rem;
            text-align: center;
        ">
    <div>Profit / Loss: <span id="profit-loss"></span></div>
    <div>Session Roll Count: <span id="session-roll-count"></span></div>
    <div>Roll Count: <span id="roll-count"></span></div>
    <div>Hit Count: <span id="hit-count"></span></div>


  </div>
  <div class="button-group">
    <button id="start-betting-btn">Start Betting</button>
    <button id="stop-betting-btn">Stop Betting</button>
    <button id="set-risk-on-btn">Risk On</button>
    <button id="set-risk-off-btn">Risk Off</button>
    <button id="zero-wager-btn">Zero Wager</button>
    <button id="double-wager-btn">Double Wager</button>
    <button id="half-wager-btn">Half Wager</button>
  </div>

  <div class="control-group">
    <label>Risk On</label>
    <input id="risk-on" type="checkbox" style="appearance: checkbox" />
  </div>
    <div class="control-group">
    <label>Payout</label>
    <input type="number" id="payout" value="1.98" />
  </div>
    <div class="control-group">
    <label>Wager</label>
    <input type="number" id="risk-on-wager" value="0" />
  </div>
  <div class="control-group">
    <label>Profit Target</label>
    <input type="number" id="profit-target" value="0" />
  </div>
  <div class="control-group">
    <label>Max Rolls</label>
    <input type="number" id="max-rolls" value="0" />
  </div>
  <div class="control-group">
    <label>Hit Count Target</label>
    <input type="number" id="hit-count-target" value="0" />
  </div>

  <div class="control-group">
    <label>Halt on Lows</label>
    <input id="halt-on-lows" type="checkbox" />
  </div>

  <div class="control-group">
    <label>Max Wager</label>
    <input type="number" id="max-wager" value="0.1" />
  </div>

  <div class="control-group">
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
      <option value="6.5">6.5</option>
      <option value="7">7</option>
      <option value="7.5">7.5</option>
      <option value="8">8</option>
      <option value="8.5">8.5</option>
      <option value="9">9</option>
      <option value="9.5">9.5</option>
      <option value="10" selected>10</option>
    </select>
  </div>

 <div class="control-group">
    <label>Short Win Rate Threshold</label>
    <select id="short-wr-threshold">
      <option value="100">100</option>
      <option value="95">95</option>
      <option value="90">90</option>
      <option value="85">85</option>
      <option value="80">80</option>
      <option value="75">75</option>
      <option value="70">70</option>
      <option value="65">65</option>
      <option value="60">60</option>
      <option value="50">50</option>
      <option value="40">40</option>
      <option value="30" selected>30</option>
      <option value="20">20</option>
      <option value="10">10</option>
      <option value="0">0</option>
    </select>
  </div>

  <div class="control-group">
    <label>Long Win Rate Threshold</label>
    <select id="long-wr-threshold">
      <option value="100">100</option>
      <option value="95">95</option>
      <option value="90">90</option>
      <option value="85">85</option>
      <option value="80">80</option>
      <option value="75">75</option>
      <option value="70" selected>70</option>
      <option value="65">65</option>
      <option value="60">60</option>
      <option value="50">50</option>
      <option value="40">40</option>
      <option value="30">30</option>
      <option value="20">20</option>
      <option value="10">10</option>
      <option value="0">0</option>
    </select>
  </div>


<hr/>
    <div class="control-group">
    <label>Standard Dev Threshold</label>
    <select id="std-dev-threshold">
      <option value="2">2</option>
      <option value="1">1</option>
      <option value="0.75">0.75</option>
      <option value="0.5" selected>0.5</option>
      <option value="0.25">0.25</option>
    </select>
  </div>

<hr/>

    <div class="control-group">
    <label>Max Multiplier</label>
    <input type="number" id="max-multiplier" value="1000000" />
  </div>

  <div class="control-group">
    <label>Max Loss</label>
    <input type="number" id="max-loss" value="0" />
  </div>

  <div class="control-group">
    <label>Reset On Start</label>
    <input id="reset-on-start" type="checkbox" />
  </div>

  <div class="control-group">
    <label>Med 10 Threshold</label>
    <input type="number" id="med-10-threshold" value="1.1" />
  </div>

  <div class="control-group">
    <label>Med 100 Threshold</label>
    <input type="number" id="med-100-threshold" value="1.8" />
  </div>

  <div class="control-group">
    <label>Med 1000 Threshold</label>
    <input type="number" id="med-1000-threshold" value="1.9" />
  </div>


  <div class="control-group">
    <label>High Hit Threshold</label>
    <select id="high-hit-threshold">
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
      <option value="6.5">6.5</option>
      <option value="7" selected>7</option>
      <option value="7.5">7.5</option>
      <option value="8">8</option>
      <option value="8.5">8.5</option>
      <option value="9">9</option>
      <option value="9.5">9.5</option>
      <option value="10">10</option>
    </select>
  </div>
  </td>
  </tr>
  </table>
</div>
`;

      $("body").prepend(html);
  }

    function createTableRows(data) {
        return data.map(
            (target) =>
            `<tr>
        <td style="position: sticky; left: 0; background-color: #1e1e1e; text-align: left; padding: 4px 6px; white-space: nowrap;">${
          target.payout
        }</td>
        <td><span id="streak-${target.getHTMLID()}"></span></td>
        <td><span id="win-rate-percent-short-${target.getHTMLID()}"></span></td>
        <td><span id="win-rate-percent-short-delta-${target.getHTMLID()}"></span></td>
        <td><span id="win-rate-percent-long-${target.getHTMLID()}"></span></td>
        <td><span id="win-rate-percent-long-delta-${target.getHTMLID()}"></span></td>
      </tr>`
    ).join("");
  }

    doInit();
})();


function getIsTestMode() {
  const inputField = $("#test-mode");
  return inputField.length !== 0 && inputField.prop("checked");
}

let mbc;

if (getIsTestMode()) {
  mbc = new MockBC(
    0,
    "Y83TpC2hj2SnjiNEDJwN",
    "9b98254e8986dd95349fc754b4b087b5d0ddf9771026d68fe4ed661c869420b4"
  );
}
