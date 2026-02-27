/* Start Script */
// ==UserScript==
// @name         Stake Roller V3
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  try to take over the world!
// @author       You
// @match        https://stake.us/casino/games/limbo
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bc.game
// @require https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";
  let lastQualRoll = null;
let qualGaps = [];
let qualHits = 0;
  let lowTarget = null;
  const DROP_PCT = -0.9;
  const HOUSE_EDGE = 1.01;
  const EVEN_TEO_PAYOUT = 1.98;
  const ROLLING_STATS = initRollingStats();
  const VOLATILITY_ENGINE = initVolatilityEngine(10, 100, ROLLING_STATS);
  const TARGETS = generateTargets();
  const HIGH_HITS = initHighHits();
  let firstLoad = true;
  let lastRollSet = [];
  let currentRollSet = [];
  let rollCount = 0;
  let sessionRollCount = 0;
  let losingStreak = 0;
  let stopped = true;
  let hitCount = 0;
  let profit = 0;
  let wager = 0;
  let baseWager = 0;

  // Fields
  let lsField = null;
  let highHitThresholdField = null;
  let hitCountTargetField = null;
  let maxRollField = null;
  let restHighHitField = null;
  let highHitResetThresholdField = null;
  let maxLossField = null;
  let maxMultiplierField = null;
  let MicroWRThresholdField = null;
  let ShortWRThresholdField = null;
  let LongWRThresholdField = null;
  let med1000thresholdField = null;
  let med100thresholdField = null;
  let med10thresholdField = null;
  let StdDevThresholdField = null;
  let highHit = 0;
  let highHitRound = 0;
  let highHitLosingStreak = 0;
  let lsDelta = 0;
  let rowColors = {};
  let wagerInputField = null;
  let payoutInputField = null;

  let teo = 0;

  injectUI();
  initWindowEvents();

  function evalResult(result) {
    rollCount++;
    sessionRollCount++;

    ROLLING_STATS.push(result);
    VOLATILITY_ENGINE.push(result);

    if (result > highHit) {
      highHit = result;
      highHitRound = rollCount;
      highHitLosingStreak = 0;
    } else {
      highHitLosingStreak++;
    }

    let payout = getPayout();
    let wager = getWager();

    if (result >= payout) {
      hitCount++;
      lsDelta = payout - losingStreak;
      losingStreak = 0;
      profit += payout * getWager() - getWager();
    } else {
      lsDelta = 0;
      losingStreak++;
      profit -= getWager();
    }

    HIGH_HITS.addResult(result, ROLLING_STATS.getStandardDeviation(10));
    setStreaks(result);
    updateUI();
    updateStats();
  }

  function setBet() {
    let wager = getWager();

    if (baseWager === 0) {
      baseWager = wager;
    }

    let payout = getPayout();
    let m = -lsDelta / 10;
    let newWager = wager + wager * m;
    newWager = Math.max(newWager, baseWager);
    newWager = Math.min(newWager, 0.25);

    console.log(
      `Payout: ${payout}, Current Wager: ${wager}, Next Wager: ${newWager},Losing Streak: ${losingStreak}, Diff: ${lsDelta}, M: ${m}`
    );
    setWager(newWager);
  }

  function setStreaks(result) {
    for (let i = 0; i < TARGETS.length; i++) {
      TARGETS[i].push(result);
    }
  }

  function updateStats() {
    function setColor(id, value, threshold) {
      let $element = $("#" + id); // Select element with jQuery
      $element.css("color", value < threshold ? "red" : "white"); // Apply color conditionally
    }

    const stats10Mean = ROLLING_STATS.getMean(10);
    const stats100Mean = ROLLING_STATS.getMean(100);
    const stats1000Mean = ROLLING_STATS.getMean(1000);

    const stats10variance = ROLLING_STATS.getVariance(10);
    const stats100variance = ROLLING_STATS.getVariance(100);
    const stats1000variance = ROLLING_STATS.getVariance(1000);

    const stats10median = ROLLING_STATS.getMedian(10);
    const stats100median = ROLLING_STATS.getMedian(100);
    const stats1000median = ROLLING_STATS.getMedian(1000);

    const stats10StdDev = ROLLING_STATS.getStandardDeviation(10);
    const stats100StdDev = ROLLING_STATS.getStandardDeviation(100);
    const stats1000StdDev = ROLLING_STATS.getStandardDeviation(1000);

    $("#mean10").text(stats10Mean.toFixed(2));
    $("#variance10").text(stats10variance.toFixed(2));
    $("#stddev10").text(stats10StdDev.toFixed(2));
    $("#median10").text(stats10median.toFixed(2));

    $("#mean100").text(stats100Mean.toFixed(2));
    $("#variance100").text(stats100variance.toFixed(2));
    $("#stddev100").text(stats100StdDev.toFixed(2));
    $("#median100").text(stats100median.toFixed(2));

    $("#mean1000").text(stats1000Mean.toFixed(2));
    $("#variance1000").text(stats1000variance.toFixed(2));
    $("#stddev1000").text(stats1000StdDev.toFixed(2));
    $("#median1000").text(stats1000median.toFixed(2));

    // Last 10 Rolls
    setColor("mean10", stats10Mean, stats100Mean - 1);
    setColor("variance10", stats10variance, 0.5);
    setColor("stddev10", stats10StdDev, 1);
    setColor("median10", stats10Mean, 1.92);

    // Last 100 Rolls
    setColor("mean100", stats100Mean, stats1000Mean - 1);
    setColor("variance100", stats100variance, 0.5);
    setColor("stddev100", stats100StdDev, 1);
    setColor("median100", stats100median, 1.92);

    // Last 1000 Rolls
    setColor("mean1000", stats1000Mean, 1.92);
    setColor("variance1000", stats1000variance, 0.5);
    setColor("stddev1000", stats1000StdDev, 1);
    setColor("median1000", stats1000median, 1.92);
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

    //    const anyStrongMomentum = TARGETS.some(t => t.momentumContext >= +1);
    const anyStrongMomentum = false;

    if (anyStrongMomentum || getRiskOn()) return;

    for (const t of TARGETS) {
      const shortThresh = getShortWinRateThrehold();
      const longThresh = getLongWinRateThrehold();
      const microThreshold = getMicroWinRateThrehold();
      const maxMultiplier = getMaxMultiplier();

      const belowWRThresholds = t.isBelowWinRates(
        microThreshold,
        shortThresh,
        longThresh,
        maxMultiplier
      );

      if (belowWRThresholds && t.getLosingStreak() > t.getPayout()) {
        const { payout, shortWR, longWR, microWR } = belowWRThresholds;
        halt(
          `[Target ${payout}×] Breached Win Rate Threshold ` +
            `WR(Micro)=${microWR}, WR(Short)=${shortWR}, WR(Long)=${longWR}`
        );
        return;
      }

      const stdDevThrehold = getStdDevThrehold();
      const stdDev10 = ROLLING_STATS.getStandardDeviation(10);

      if (
        rollCount > 100 &&
        stdDev10 <= stdDevThrehold &&
        median10 <= 1.92 &&
        median100 < 1.92 &&
        median1000 < 1.92
      ) {
        halt(
          `[Breached standard deviation threshold] Threshold: ${stdDevThrehold}, Actual: ${stdDev10}`
        );
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

  function generateTargets() {
    return generatePayouts().map((p) => {
      const target = createTarget(parseFloat(p.toFixed(2)));
      if (target.getPayout() === 1.5) {
        lowTarget = target;
      }
      return target;
    });
  }

  function createTarget(payout) {
    class Stats {
      constructor(payout, size) {
        this.size = size;
        this.payout = payout;
        this.streak = 0;
        this.pstreak = 0;
        this.hitCount = 0;
        this.losingStreak = 0;

        this.results = [];
        this.index = 0;
        this.sum = 0;
      }

      push = (result) => {
        this.updateStreak(result);
        this.results.push(result >= this.payout ? 1 : 0);

        if (this.results.length === this.size) {
          this.results.shift();
        }
      };

      updateStreak = (result) => {
        if (result >= this.payout) {
          this.hitCount++;
          if (this.streak < 0) {
            this.pstreak = this.streak;
          }
          this.streak = Math.max(this.streak + 1, 1);
        } else {
          if (this.streak > 0) {
            this.streakSignFlipped = true;
            this.pstreak = this.streak;
          }
          this.streak = Math.min(this.streak - 1, -1);
        }

        this.losingStreak = this.streak < 0 ? this.streak : 0;
      };

      getHitData(lookback = this.results.length) {
        const data = this.results.slice(-lookback);
        if (data.length === 0) return 0;
        const sum = data.reduce((sum, val) => sum + val, 0);
        const len = data.length;
        return { sum, len };
      }

      getWinRate(lookback = this.results.length) {
        const data = this.getHitData(lookback);
        return data.sum / data.len;
      }

      getTeo = () => 1 / (this.getPayout() * HOUSE_EDGE);
      getWinRatePercentOfTeo = (lookback = 100) =>
        (this.getWinRate(lookback) / this.getTeo()) * 100;
      getDeviation = () => {
        const expectedRate = 1 / this.payout;
        return (this.getWinRate() - expectedRate) * this.count * 100;
      };

      reset() {
        rollCount = 0;
        this.rollCount = 0;
      }

      getHitCount = () => this.hitCount;
      getRollCount = () => rollCount;
      getStreak = () => this.streak;
      getPreviousStreak = () => this.pstreak;
      getLosingStreak = () =>
        this.losingStreak < 0 ? Math.abs(this.losingStreak) : 0;
      getCount = () => this.count;
      getPayout = () => this.payout;
      getStrength = () => this.getTeo() * this.getStreak();
      getLSRatio = () => Math.floor(this.getLosingStreak() / this.payout);
      getLSRatioAbs = () => Math.abs(this.getLSRatio());
    }

    class Target {
      constructor(payout) {
        this.length = 1000;
        this.payout = parseFloat(payout);
        this.stats = new Stats(payout, 1000);
        this.microWindow = Math.floor(payout * 5);
        this.shortWindow = this.microWindow * 10;
        this.longWindow = this.length;
        this.losingStreak = 0;
        this.hitCount = 0;
        this.rollCount = 0;
        this.haltMessage = null;
        this.teo = 1 / (this.payout * HOUSE_EDGE);
      }

      getTeo = () => this.stats.getTeo();
      getWinRatePercentOfTeo = (lookback = 100) =>
        this.stats.getWinRatePercentOfTeo(lookback);
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
        microThresh = 60,
        shortThresh = 70,
        longThresh = 80,
        maxMultiplier = 1000000
      ) {
        if (rollCount < 100) return null;

        if (this.payout > maxMultiplier || this.payout < 1.5) return null;

        const microWR = this.getWinRatePercentOfTeo(this.microWindow);
        const shortWR = this.getWinRatePercentOfTeo(this.shortWindow);
        const longWR = this.getWinRatePercentOfTeo(this.longWindow);

        const avgThreshold = (shortThresh + longThresh + microThresh) / 3;
        const avgWR = (microWR + shortWR + longWR) / 3;
        const winRatesBreached = avgWR < avgThreshold;

        if (!winRatesBreached) return false;

        // ✅ Return old style result object
        return {
          payout: this.payout,
          shortWR: shortWR.toFixed(2),
          longWR: longWR.toFixed(2),
          microWR: microWR.toFixed(2),
          avgWR: avgWR.toFixed(2)
        };
      }

      getDynamicStreakLimit(baseMult) {
        const shortWR = this.getWinRatePercentOfTeo(this.shortWindow);
        const longWR = this.getWinRatePercentOfTeo(this.longWindow);
        const microWR = this.getWinRatePercentOfTeo(this.microWindow);

        // average WR for dynamic adjustment
        const avgWR = (shortWR + longWR + microWR) / 3;
        const deficit = Math.max(0, 100 - avgWR); // how far below fair we are
        const dynamicMult = baseMult * (1 - deficit / 100); // less streak needed for worse WRs
        return Math.max(1, this.payout * dynamicMult);
      }

      getHTMLID = () =>
        this.payout
          .toString()
          .replace(/\./g, "_")
          .replace(/[^\w-]/g, "");
    }

    return new Target(payout);
  }

  function generatePayouts() {
    const a1 = [1.01, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9];
    const a2 = Array.from(
      {
        length: 19
      },
      (v, k) => 2 + k * 1
    );

    return [...a1, ...a2];
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
    $("#high-hit")
      .html(
        `${highHit} | ${highHitLosingStreak} | ${Math.round(
          rollCount - highHit
        )}`
      )
      .css({
        backgroundColor:
          highHitLosingStreak > highHit * 3 ? "red" : "transparent"
      });

    $("#profit-loss")
      .html(profit.toFixed(4))
      .css({
        backgroundColor: `${
          profit > 0 ? "green" : profit < 0 ? "red" : "transparent"
        }`
      });

    updateStreakRows();
    updateHighHits();
  }

  function basicColor(val) {
    if (isNaN(val)) return "transparent";

    const diff = val - 100;
    const maxDev = 25; // how far before full saturation
    const severity = Math.min(Math.abs(diff) / maxDev, 1);
    const alpha = 0.15 + 0.35 * severity;

    const color = diff >= 0 ? "0, 255, 0" : "255, 0, 0";
    return `rgba(${color}, ${alpha})`;
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

  function getRowColors(payout, streak, microWR, shortWR, longWR) {
    const microThresh = getMicroWinRateThrehold();
    const shortThresh = getShortWinRateThrehold();
    const longThresh = getLongWinRateThrehold();
    const wrColors = syncedColor(
      microWR,
      shortWR,
      longWR,
      microThresh,
      shortThresh,
      longThresh
    );
    const lsColor = getLsColor(streak, payout);

    return {
      wrColors,
      lsColor
    };
  }

  const stateCache = new Map();

  function getColor(wr, threshold = 90) {
    const colors = { bg: "transparent", fg: "white" };

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

  function syncedColor(
    microWR,
    shortWR,
    longWR,
    microThresh,
    shortThresh,
    longThresh
  ) {
    return {
      micro: getColor(microWR),
      short: getColor(shortWR, shortThresh),
      long: getColor(longWR, longThresh)
    };
  }

  function rgbaFromHSV(hsv, alpha) {
    const [r, g, b] = hsvToRgb(hsv[0], hsv[1], hsv[2]);
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
  }

  function updateStreakRows() {
    if (!$.trim($("#stats-body").html())) {
      const rows = createStreakRows();
      $("#stats-body").append(createStreakRows());
    }

    for (let i = 0; i < TARGETS.length; i++) {
      const target = TARGETS[i];
      const payout = target.payout;
      const ls = target.losingStreak;
      const streakId = target.getHTMLID();
      const diff = target.lsdiff;
      const wrp25 = target.getWinRatePercentOfTeo(target.microWindow);
      const wrp50 = target.getWinRatePercentOfTeo(target.shortWindow);
      const wrp100 = target.getWinRatePercentOfTeo(target.longWindow);
      const streakLimit = target.getDynamicStreakLimit(
        getLosingStreakMultiplier()
      );

      $(`#payout-${streakId}`).html(isNaN(payout) ? "—" : payout.toFixed(2));

      $(`#win-rate-percent-25-${streakId}`).html(
        isNaN(wrp25) ? "—" : wrp25.toFixed(2)
      );

      $(`#win-rate-percent-50-${streakId}`).html(
        isNaN(wrp50) ? "—" : wrp50.toFixed(2)
      );

      $(`#win-rate-percent-100-${streakId}`).html(
        isNaN(wrp100) ? "—" : wrp100.toFixed(2)
      );

      $(`#streak-${streakId}`).html(isNaN(ls) ? "—" : ls);

      const colors = getRowColors(payout, ls, wrp25, wrp50, wrp100);
      const lsColor = colors.lsColor;

      const wrColor25fg = colors.wrColors.micro.fg;
      const wrColor25bg = colors.wrColors.micro.bg;

      const wrColor50fg = colors.wrColors.short.fg;
      const wrColor50bg = colors.wrColors.short.bg;

      const wrColor100fg = colors.wrColors.long.fg;
      const wrColor100bg = colors.wrColors.long.bg;

      const $streakCol = $(`#streak-${streakId}`).closest("td");
      $streakCol.css("background-color", lsColor);

      const $wrCol25 = $(`#win-rate-percent-25-${streakId}`).closest("td");
      $wrCol25.css({ "background-color": wrColor25bg, color: wrColor25fg });

      const $wrCol50 = $(`#win-rate-percent-50-${streakId}`).closest("td");
      $wrCol50.css({ "background-color": wrColor50bg, color: wrColor50fg });

      const $wrCol100 = $(`#win-rate-percent-100-${streakId}`).closest("td");
      $wrCol100.css({ "background-color": wrColor100bg, color: wrColor100fg });
    }
  }

  function updateHighHits() {
    const highHits = HIGH_HITS.getResults();

    $("#std-dev-to-high").text(
      `${highHits.stdDevToHighDelta} | ${highHits.stdDevRelease}`
    );

    $("#highHit-hit")
      .text(`${highHits.highHit.hit}`)
      .css({
        backgroundColor: highHits.highHit.hitDelta < 0 ? "red" : "transparent"
      });
    $("#highHit-remaining").text(`${highHits.highHit.rollsRemaining}`);
    $("#highHit-delta").text(`${highHits.highHit.hitDelta.toFixed(2)}`);

    $("#highHit50-hit")
      .text(`${highHits.highHit50.hit}`)
      .css({
        backgroundColor: highHits.highHit50.hitDelta < 0 ? "red" : "transparent"
      });
    $("#highHit50-remaining").text(`${highHits.highHit50.rollsRemaining}`);
    $("#highHit50-delta").text(`${highHits.highHit50.hitDelta.toFixed(2)}`);

    $("#highHit100-hit")
      .text(`${highHits.highHit100.hit}`)
      .css({
        backgroundColor:
          highHits.highHit100.hitDelta < 0 ? "red" : "transparent"
      });
    $("#highHit100-remaining").text(`${highHits.highHit100.rollsRemaining}`);
    $("#highHit100-delta").text(`${highHits.highHit100.hitDelta.toFixed(2)}`);

    $("#highHit1000-hit")
      .text(`${highHits.highHit1000.hit}`)
      .css({
        backgroundColor:
          highHits.highHit1000.hitDelta < 0 ? "red" : "transparent"
      });
    $("#highHit1000-remaining").text(`${highHits.highHit1000.rollsRemaining}`);
    $("#highHit1000-delta").text(`${highHits.highHit1000.hitDelta.toFixed(2)}`);

    $("#highHit10000-hit")
      .text(`${highHits.highHit10000.hit}`)
      .css({
        backgroundColor:
          highHits.highHit10000.hitDelta < 0 ? "red" : "transparent"
      });
    $("#highHit10000-remaining").text(
      `${highHits.highHit10000.rollsRemaining}`
    );
    $("#highHit10000-delta").text(
      `${highHits.highHit10000.hitDelta.toFixed(2)}`
    );
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
    if (!ShortWRThresholdField) {
      ShortWRThresholdField = $("#short-wr-threshold");
    }
    return Number(ShortWRThresholdField.val());
  }

  function getStdDevThrehold() {
    if (!StdDevThresholdField) {
      StdDevThresholdField = $("#std-dev-threshold");
    }
    return Number(StdDevThresholdField.val());
  }

  function getMicroWinRateThrehold() {
    if (!MicroWRThresholdField) {
      MicroWRThresholdField = $("#micro-wr-threshold");
    }
    return Number(MicroWRThresholdField.val());
  }

  function getLongWinRateThrehold() {
    if (!LongWRThresholdField) {
      LongWRThresholdField = $("#long-wr-threshold");
    }
    return Number(LongWRThresholdField.val());
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

function initVolatilityEngine(shortWindow, midWindow, rollingStats) {
  class VolatilityEngine {
    constructor(shortWindow, midWindow) {
      this.rollingStats = rollingStats;
      this.rollCount = 0;

      this.shortWindow = shortWindow;
      this.midWindow = midWindow;

      // ---- Qualifier + windowing ----
      this.qualifier = 10;          // >=10 "high"
      this.filteredWindow = 50;     // how long after a collapse we track filtered gaps

      // ---- Velocity trigger ----
      // DROP_PCT is expected to be defined outside (e.g. -0.35 for -35% drop)
      this.prevStd = null;

      // ---- Baseline gaps (unfiltered) ----
      this.lastQualRollBase = null;
      this.baseGaps = [];

      // ---- Filtered gaps (post-collapse) ----
      this.trackAfterCollapse = false;
      this.collapseStartRoll = null;
      this.lastQualRollFiltered = null;
      this.filteredGaps = [];

      // ---- Event logs (optional) ----
      this.collapseEvents = [];     // {roll, stdShort, dPct}
    }

    // ---- small helpers ----
    _pushCapped(arr, v, cap = 5000) {
      arr.push(v);
      if (arr.length > cap) arr.shift();
    }

    _stats(arr) {
      if (!arr.length) return null;
      const n = arr.length;
      const mean = arr.reduce((a, b) => a + b, 0) / n;
      const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
      const sorted = [...arr].sort((a, b) => a - b);
      const median = sorted[Math.floor(n / 2)];
      return { n, mean, variance, median };
    }

    _maybeLog(label, arr, geoVarHint = null) {
      const s = this._stats(arr);
      if (!s || s.n < 50) return;
      console.log(
        `${label} GAPS n=${s.n} mean=${s.mean.toFixed(2)} var=${s.variance.toFixed(
          2
        )} median=${s.median}${geoVarHint ? ` (${geoVarHint})` : ""}`
      );
    }

    push(result) {
      this.rollCount++;

      // compute stats *before* pushing current result? (you can swap if you prefer)
      const stdShort = this.rollingStats.getStandardDeviation(this.shortWindow);
      const stdMid = this.rollingStats.getStandardDeviation(this.midWindow);

      // ---- velocity (dPct) on stdShort ----
      let dPct = 0;
      if (this.prevStd !== null && this.prevStd > 0) {
        dPct = (stdShort - this.prevStd) / this.prevStd;
      }

      // -------- Collapse trigger --------
      if (this.prevStd !== null && dPct <= DROP_PCT) {
        // start/refresh filtered tracking window
        this.trackAfterCollapse = true;
        this.collapseStartRoll = this.rollCount;
        this.lastQualRollFiltered = null;

        this._pushCapped(this.collapseEvents, {
          roll: this.rollCount,
          stdShort,
          dPct,
          ts: new Date().toISOString()
        }, 1000);

        console.log(
          `[COLLAPSE] roll=${this.rollCount} stdShort=${stdShort.toFixed(
            4
          )} dPct=${(dPct * 100).toFixed(1)}%`
        );
      }

      // update prev
      this.prevStd = stdShort;

      // ---- stop filtered window after N rolls ----
      if (
        this.trackAfterCollapse &&
        this.rollCount - this.collapseStartRoll >= this.filteredWindow
      ) {
        this.trackAfterCollapse = false;
        this.collapseStartRoll = null;
        this.lastQualRollFiltered = null;
      }

      // -------- Qualifier hit handling (BOTH baseline + filtered) --------
      if (result >= this.qualifier) {
        // baseline gap
        if (this.lastQualRollBase !== null) {
          this._pushCapped(this.baseGaps, this.rollCount - this.lastQualRollBase);
        }
        this.lastQualRollBase = this.rollCount;

        // filtered gap (only if we're within post-collapse window)
        if (this.trackAfterCollapse) {
          if (this.lastQualRollFiltered !== null) {
            this._pushCapped(
              this.filteredGaps,
              this.rollCount - this.lastQualRollFiltered
            );
          }
          this.lastQualRollFiltered = this.rollCount;
        }
      }

      // ---- occasional logging ----
      // Rough geometric variance hint for p ≈ 1/qualifier (for qualifier=10 => ~90)
      const geoVarHint = `geo≈${Math.round(((1 - 1 / this.qualifier) / (1 / this.qualifier) ** 2))}`;
      if (this.rollCount % 250 === 0) {
        this._maybeLog("BASE", this.baseGaps, geoVarHint);
        this._maybeLog("FILTERED", this.filteredGaps, geoVarHint);
      }

      return { stdShort, stdMid, dPct };
    }
  }

  return new VolatilityEngine(shortWindow, midWindow);
}

  function initHighHits() {
    class HighHits {
      constructor() {
        this.rollCount = 0;
        this.highHit = 0;
        this.round = 0;
        this.stdDevLow = 0;
        this.stdDevRound = 0;
        this.stdDevToHighDelta = 0;
        this.stdDevRelease = 0;

        this.intervals = [50, 100, 1000, 10000];
        this.data = new Map();

        for (const interval of this.intervals) {
          this.data.set(interval, {
            highHit: 0,
            round: 0,
            resetDue: false
          });
        }
      }

      addResult(result, stdDev) {
        this.rollCount++;

        if (stdDev !== 0) {
          if (stdDev < 1 && this.stdDevLow === 0) {
            this.stdDevLow = stdDev;
            this.stdDevRound = this.rollCount;
            this.stdDevRelease = 0;
          }
        }

        if (this.stdDevRound !== 0 && result > 10) {
          this.stdDevLow = 0;
          this.stdDevRound = 0;
          this.stdDevRelease = result;
        } else {
          if (this.stdDevRound !== 0) {
            this.stdDevToHighDelta = this.rollCount - this.stdDevRound;
          }
        }

        // Update global high hit

        if (result > this.highHit) {
          this.highHit = result;
          this.round = this.rollCount;
        }

        for (const interval of this.intervals) {
          const entry = this.data.get(interval);

          if (this.rollCount % interval === 0) {
            entry.resetDue = true;
          }

          if (result > entry.highHit || result > interval) {
            if (entry.resetDue) {
              this.data.set(interval, {
                highHit: result,
                round: 0,
                resetDue: false
              });
            } else {
              this.data.set(interval, {
                highHit: result,
                round: this.rollCount
              });
            }
          }
        }
      }

      getResults() {
        const results = {
          stdDevToHighDelta: this.stdDevToHighDelta,
          stdDevRelease: this.stdDevRelease,
          highHit: {
            hit: this.highHit,
            round: this.round,
            roundDelta: this.rollCount - this.round,
            hitDelta: this.highHit - (this.rollCount - this.round),
            rollsRemaining: Infinity
          }
        };

        for (const interval of this.intervals) {
          const { highHit, round } = this.data.get(interval);
          const roundDelta = this.rollCount - round;
          const rollsRemaining = Math.max(0, interval - roundDelta);

          results[`highHit${interval}`] = {
            hit: highHit,
            round,
            roundDelta,
            hitDelta: highHit - roundDelta,
            rollsRemaining
          };
        }

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
    if (firstLoad || getResetOnStart()) {
      firstLoad = false;
      highHitLosingStreak = 0;
      highHitRound = 0;
    }

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
    observeRollChanges();
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

  function getRollResult() {
    const temp = lastRollSet;
    lastRollSet = currentRollSet;
    currentRollSet = temp;
    currentRollSet.length = 0;

    currentRollSet = $(".grid.grid-auto-flow-column div span")
      .map(function () {
        return Number($(this).text().replace("x", ""));
      })
      .get();

    if (arraysAreEqual(currentRollSet, lastRollSet)) {
      return -1;
    }

    return currentRollSet[currentRollSet.length - 1];
  }

  function getCurrentRollData() {
    return $(".grid.grid-auto-flow-column div span")
      .map(function () {
        return $(this).text()
      })
      .get()
  }

  // Observer for Bustadice "My Bets" table
  let observer = null;

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
                  <th style="text-align: left; padding: 6px;">WR% M</th>
                  <th style="text-align: left; padding: 6px;">WR% S</th>
                  <th style="text-align: left; padding: 6px;">WR% L</th>
                </tr>
              </thead>
              <tbody id="stats-body">
              </tbody>
            </table>
          </div>

</td>
<td>
   <div class="stats-block">
      <h3>Last 10 Rolls</h3>
      <p>Mean: <span id="mean10">0</span></p>
      <p>Variance: <span id="variance10">0</span></p>
      <p>Std Dev: <span id="stddev10">0</span></p>
      <p>Median: <span id="median10">0</span></p>
   </div>
   <div class="stats-block">
      <h3>Last 100 Rolls</h3>
      <p>Mean: <span id="mean100">0</span></p>
      <p>Variance: <span id="variance100">0</span></p>
      <p>Std Dev: <span id="stddev100">0</span></p>
      <p>Median: <span id="median100">0</span></p>
   </div>
   <div class="stats-block">
      <h3>Last 1000 Rolls</h3>
      <p>Mean: <span id="mean1000">0</span></p>
      <p>Variance: <span id="variance1000">0</span></p>
      <p>Std Dev: <span id="stddev1000">0</span></p>
      <p>Median: <span id="median1000">0</span></p>
   </div>

     <div class="stats-block">
        <h3>High Hits</h3>
        <p>Std Dev to High Δ: <span id="std-dev-to-high">0</span></p>
        <table style="font-size: 11px; width: 100%; text-align: right;">
           <thead>
              <tr style="text-align: center;">
                 <th style="width: 25%;">Rolls</th>
                 <th style="width: 25%;">Hit</th>
                 <th style="width: 25%;">Δ</th>
                 <th style="width: 25%;">Left</th>
              </tr>
           </thead>
           <tbody>
              <tr>
                 <td>50</td>
                 <td><span id="highHit50-hit"></span></td>
                 <td><span id="highHit50-delta"></span></td>
                 <td><span id="highHit50-remaining"></span></td>
              </tr>
              <tr>
                 <td>100</td>
                 <td><span id="highHit100-hit">0</span></td>
                 <td><span id="highHit100-delta">0</span></td>
                 <td><span id="highHit100-remaining">0</span></td>
              </tr>
              <tr>
                 <td>1000</td>
                 <td><span id="highHit1000-hit">0</span></td>
                 <td><span id="highHit1000-delta">0</span></td>
                 <td><span id="highHit1000-remaining">0</span></td>
              </tr>
              <tr>
                 <td>10000</td>
                 <td><span id="highHit10000-hit">0</span></td>
                 <td><span id="highHit10000-delta">0</span></td>
                 <td><span id="highHit10000-remaining">0</span></td>
              </tr>
              <tr>
                 <td>Global</td>
                 <td><span id="highHit-hit">0</span></td>
                 <td><span id="highHit-delta">0</span></td>
                 <td><span id="highHit-remaining">0</span></td>
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
    <div>High Hit: <span id="high-hit"></span></div>



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
    <label>Micro Win Rate Threshold</label>
    <select id="micro-wr-threshold">
      <option value="100">100</option>
      <option value="95">95</option>
      <option value="90">90</option>
      <option value="85">85</option>
      <option value="80">80</option>
      <option value="70">70</option>
      <option value="75">75</option>
      <option value="60">60</option>
      <option value="50">50</option>
      <option value="40">40</option>
      <option value="30">30</option>
      <option value="20">20</option>
      <option value="10" selected>10</option>
      <option value="0">0</option>
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
      <option value="60" selected>60</option>
      <option value="50">50</option>
      <option value="40">40</option>
      <option value="30">30</option>
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

  function createStreakRows() {
    return TARGETS.map(
      (target) =>
        `<tr>
        <td style="position: sticky; left: 0; background-color: #1e1e1e; text-align: left; padding: 4px 6px; white-space: nowrap;">${
          target.payout
        }</td>
        <td><span id="streak-${target.getHTMLID()}"></span></td>
        <td><span id="win-rate-percent-25-${target.getHTMLID()}"></span></td>
        <td><span id="win-rate-percent-50-${target.getHTMLID()}"></span></td>
        <td><span id="win-rate-percent-100-${target.getHTMLID()}"></span></td>
      </tr>`
    ).join("");
  }

  doInit();
})();

function getIsTestMode() {
  return true;
}

let mbc;
if (getIsTestMode()) {
  mbc = new MockBC(
    0,
    "Y83TpC2hj2SnjiNEDJwN",
    "9b98254e8986dd95349fc754b4b087b5d0ddf9771026d68fe4ed661c869420b4"
  );
}
