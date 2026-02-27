// ==UserScript==
// @name         Bustadice UI V1
// @namespace    http://tampermonkey.net/
// @version      2025-04-07
// @description  try to take over the world!
// @author       Zundra Daniel
// @match        https://bustadice.com/play
// @grant        none
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bc.game
// @require https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// ==/UserScript==

(function () {
  "use strict";

  const ROLLING_STATS = initRollingStats();
  const TARGETS = generateTargets();
  const HIGH_HITS = initHighHits();
  let firstLoad = true;
  let lastRollSet = [];
  let currentRollSet = [];
  let rollCount = 0;
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
  let starvedLsField = null;
  let starvedShortWRThresholdField = null;
  let starvedLongWRThresholdField = null;
  let starvedWRThresholdField = null;
  let maxMultiplierField = null;
  let ShortWRThresholdField = null;
  let LongWRThresholdField = null;
  let WRThresholdField = null;

  let highHit = 0;
  let highHitRound = 0;
  let highHitLosingStreak = 0;
  let lsDelta = 0;
  let rowColors = {};

  let teo = 0;

  injectUI();
  initWindowEvents();

  function evalResult(result) {
    rollCount++;

    ROLLING_STATS.push(result);

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

    HIGH_HITS.addResult(result);
    setStreaks(result);
    updateUI();
    updateStats();
  }

  function setStreaks(result) {
    for (let i = 0; i < TARGETS.length; i++) {
      TARGETS[i].push(result);
      TARGETS[i].updateMomentum(
        getStarvedShortWinRateThrehold(),
        getStarvedLongWinRateThrehold(),
        getStarvedWinRateThrehold()
      );

      if (TARGETS[i].getFullyPrimed() && !TARGETS[i].checkedIn) {
        TARGETS[i].checkedIn = true;
      }
    }
  }

      function updateStats() {
        function setColor(id, value, threshold) {
          let $element = $("#" + id) // Select element with jQuery
          $element.css("color", value < threshold ? "red" : "white") // Apply color conditionally
        }

        const stats10Mean = ROLLING_STATS.getMean(10)
        const stats100Mean = ROLLING_STATS.getMean(100)
        const stats1000Mean = ROLLING_STATS.getMean(1000)

        const stats10variance = ROLLING_STATS.getVariance(10)
        const stats100variance = ROLLING_STATS.getVariance(100)
        const stats1000variance = ROLLING_STATS.getVariance(1000)

        const stats10median = ROLLING_STATS.getMedian(10)
        const stats100median = ROLLING_STATS.getMedian(100)
        const stats1000median = ROLLING_STATS.getMedian(1000)

        const stats10StdDev = ROLLING_STATS.getStandardDeviation(10)
        const stats100StdDev = ROLLING_STATS.getStandardDeviation(100)
        const stats1000StdDev = ROLLING_STATS.getStandardDeviation(1000)

        $("#mean10").text(stats10Mean.toFixed(2))
        $("#variance10").text(stats10variance.toFixed(2))
        $("#stddev10").text(stats10StdDev.toFixed(2))
        $("#median10").text(stats10median.toFixed(2))

        $("#mean100").text(stats100Mean.toFixed(2))
        $("#variance100").text(stats100variance.toFixed(2))
        $("#stddev100").text(stats100StdDev.toFixed(2))
        $("#median100").text(stats100median.toFixed(2))

        $("#mean1000").text(stats1000Mean.toFixed(2))
        $("#variance1000").text(stats1000variance.toFixed(2))
        $("#stddev1000").text(stats1000StdDev.toFixed(2))
        $("#median1000").text(stats1000median.toFixed(2))


        // Last 10 Rolls
        setColor("mean10", stats10Mean, stats100Mean - 1)
        setColor("variance10", stats10variance, 0.5)
        setColor("stddev10", stats10StdDev, 1)
        setColor("median10", stats10Mean, 1.92)

        // Last 100 Rolls
        setColor("mean100", stats100Mean, stats1000Mean - 1)
        setColor("variance100", stats100variance, 0.5)
        setColor("stddev100", stats100StdDev, 1)
        setColor("median100", stats100median, 1.92)

        // Last 1000 Rolls
        setColor("mean1000", stats1000Mean, 1.92)
        setColor("variance1000", stats1000variance, 0.5)
        setColor("stddev1000", stats1000StdDev, 1)
        setColor("median1000", stats1000median, 1.92)
      }


  function initRollingStats() {
    class RollingStats {
      constructor(size) {
        this.size = size
        this.buffer = new Array(size).fill(null)
        this.index = 0
        this.count = 0
      }

      push = (value) => {
        if (this.count >= this.size) {
          // Overwrite old value
          this.buffer[this.index] = value
        } else {
          this.buffer[this.index] = value
          this.count++
        }

        this.index = (this.index + 1) % this.size
      }

      getValues = (lookback = this.count) => {
        const count = Math.min(lookback, this.count)
        const values = []
        const start = (this.index - count + this.size) % this.size
        for (let i = 0; i < count; i++) {
          const idx = (start + i + this.size) % this.size
          values.push(this.buffer[idx])
        }
        return values
      }

      getMean = (lookback = this.count) => {
        const vals = this.getValues(lookback)
        if (vals.length === 0) return 0
        const sum = vals.reduce((a, b) => a + b, 0)
        return sum / vals.length
      }

      getVariance = (lookback = this.count) => {
        const vals = this.getValues(lookback)
        if (vals.length <= 1) return 0
        const mean = this.getMean(lookback)
        const sumOfSquares = vals.reduce((sum, v) => sum + (v - mean) ** 2, 0)
        return sumOfSquares / (vals.length - 1)
      }

      getStandardDeviation = (lookback = this.count) => {
        return Math.sqrt(this.getVariance(lookback))
      }

      getMedian = (lookback = this.count) => {
        const vals = this.getValues(lookback)
        if (vals.length === 0) return null
        const sorted = [...vals].sort((a, b) => a - b)
        const mid = Math.floor(sorted.length / 2)
        return sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid]
      }
    }

    return new RollingStats(10000)
  }

  function globalFairnessIndex(targets) {
    const wrs = TARGETS.map((t) => t.getDecayedWinRatePercentOfTeo());
    const avg = wrs.reduce((a, b) => a + b, 0) / wrs.length;
    const dispersion = Math.max(...wrs) - Math.min(...wrs);
    return { avg, dispersion };
  }

  function generateTargets() {
    return generatePayouts().map((p) => createTarget(p.toFixed(2)));
  }

  function createTarget(payout) {
    // ---------- Core: fixed-size circular counter ----------
    class RollingCounter {
      constructor(size) {
        this.size = size;
        this.hits = new Array(size).fill(0);
        this.index = 0;
        this.count = 0;
      }
      push(isHit) {
        this.hits[this.index] = isHit ? 1 : 0;
        this.index = (this.index + 1) % this.size;
        this.count = Math.min(this.count + 1, this.size);
      }
      getHitRate(lookback = this.count, offset = 0) {
        if (this.count === 0 || lookback <= 0) return 0;
        lookback = Math.min(lookback, this.count);
        offset = Math.min(offset, this.count - lookback);
        const end = (this.index - offset + this.size) % this.size;
        const start = (end - lookback + this.size) % this.size;
        let sum = 0;
        for (let i = 0; i < lookback; i++) {
          const idx = (start + i) % this.size;
          sum += this.hits[idx];
        }
        return sum / lookback;
      }
    }

    // ---------- Optional: event-driven window (last K wins) ----------
    class WinTriggeredWindow {
      constructor(kWins) {
        this.kWins = kWins;
        this.count = 0;
        this.winIdx = []; // indices of last K wins
      }
      push(isWin) {
        const idx = this.count++;
        if (isWin) {
          this.winIdx.push(idx);
          if (this.winIdx.length > this.kWins) this.winIdx.shift();
        }
      }
      getRate() {
        if (this.count === 0) return 0;
        const haveK = this.winIdx.length >= this.kWins;
        const start = haveK ? this.winIdx[0] : 0;
        const wins = this.winIdx.length;
        const len = this.count - start;
        return len > 0 ? wins / len : 0;
      }
      getWindowLength() {
        const haveK = this.winIdx.length >= this.kWins;
        const start = haveK ? this.winIdx[0] : 0;
        return this.count - start;
      }
    }

    class DecayedWinRate {
      constructor(size = 100) {
        this.size = size;
        this.gaps = new Array(size).fill(0);
        this.index = 0;
        this.totalHits = 0;
        this.totalMisses = 0;
        this.currentGap = 0; // running distance since last hit
      }

      push(isWin) {
        if (isWin) {
          // close the current gap
          const gapLength = this.currentGap + 1; // +1 includes the win roll
          this.gaps[this.index] = gapLength;
          this.index = (this.index + 1) % this.size;
          this.totalHits++;
          this.totalMisses += gapLength;
          this.currentGap = 0; // reset gap
        } else {
          // grow the open gap
          this.currentGap++;
        }
      }

      // mean now includes the open gap as a provisional sample
      getMeanGap() {
        const valid = this.gaps.filter((g) => g > 0);
        const allGaps = [...valid];
        if (this.currentGap > 0) allGaps.push(this.currentGap);
        if (!allGaps.length) return 0;
        return allGaps.reduce((a, b) => a + b, 0) / allGaps.length;
      }

      getHitRate() {
        const meanGap = this.getMeanGap();
        return meanGap > 0 ? 1 / meanGap : 0;
      }
    }

    // ---------- Streaks ----------
    class StreakTracker {
      constructor() {
        this.losing = 0;
        this.winning = 0;
      }
      push(isWin) {
        if (isWin) {
          this.winning += 1;
          this.losing = 0;
        } else {
          this.losing += 1;
          this.winning = 0;
        }
      }
    }

    // ---------- Hybrid model wiring ----------
    class HybridWinRate {
      constructor(cfg = {}, payout) {
        const {
          windowSize = 100, // rolling default
          envThreshold = 0.45,
          momentumK = 3,
          kWins = null
        } = cfg;

        this.payout = payout;
        this.staticCounter = new RollingCounter(windowSize);
        this.decayedCounter = new DecayedWinRate(windowSize);

        this.streaks = new StreakTracker();
        this.missCount = 0;
        this.state = "NEUTRAL";
        this.last = null;
        this.winTriggered = kWins ? new WinTriggeredWindow(kWins) : null;
      }

      push(isWin) {
        // update rolling + streaks
        this.staticCounter.push(isWin);
        this.streaks.push(isWin);
        if (this.winTriggered) this.winTriggered.push(isWin);

        // decayed model now updates on every roll (hit or miss)
        this.decayedCounter.push(isWin);
        this.evaluate();
      }

      getRollingHitRate(lookback, offset = 0) {
        return this.staticCounter.getHitRate(lookback, offset);
      }

      getDecayedHitRate() {
        return this.decayedCounter.getHitRate();
      }

      evaluate() {
        // could include whatever regime logic you want here
      }
    }

    class Target {
      constructor(payout, cycles = 100) {
        this.winSize = this.adaptiveWindow(payout, this.cycles);
        this.payout = parseFloat(payout);
        this.cycles = cycles;
        this.shortWindow = Math.round(this.payout * 5);
        this.longWindow = this.shortWindow * 2;
        this.primedLower = false;
        this.primedUpper = false;
        this.fullyPrimed = false;
        this.checkedIn = false;

        this.rateWindow = new HybridWinRate(
          {
            windowSize: this.winSize, // static rolling buffer capacity
            decayedSize: 150, // gap samples; leave independent
            envThreshold: 0.46,
            momentumK: 3,
            kWins: 10
          },
          payout
        );

        this.momentumState = { state: null, direction: null };
        this.losingStreak = 0;
        this.hitCount = 0;
        this.rollCount = 0;
        this.haltMessage = null;
        this.ratio = 0;
        this.rawRatio = parseFloat(payout);
        this.lsdiff = 0;
        this.e = 0.02;
      }

      // ===============================
      // === Core performance metrics ===
      // ===============================
      updateMomentum(shortThresh, longThresh, overallThresh) {
        const shortWR = this.getWinRatePercentOfTeo(this.shortWindow);
        const longWR = this.getWinRatePercentOfTeo(this.longWindow);
        const decayedWR = this.getDecayedWinRatePercentOfTeo();

        const agg = (shortWR + longWR + decayedWR) / 3;

        // initialize EMA if needed
        if (!this.wrEMA) this.wrEMA = agg;

        // smooth long-term direction
        this.wrEMA = this.wrEMA * 0.9 + agg * 0.1;

        const slope = agg - this.wrEMA;

        // --- Position score ---
        let pos = 0;
        const above = shortWR > 100 && longWR > 100 && decayedWR > 100;
        const below =
          shortWR < shortThresh &&
          longWR < longThresh &&
          decayedWR < overallThresh;

        if (above) pos = +2;
        else if (below) pos = -2;
        else if (this.lastZone === "UP") pos = +1;
        else if (this.lastZone === "DOWN") pos = -1;

        // --- Momentum score ---
        const mom = Math.max(-1, Math.min(1, slope * 20));

        const context = pos + mom;

        // --- Persistent discrete memory
        if (above) this.lastZone = "UP";
        if (below) this.lastZone = "DOWN";

        // ✅ store context persistently
        this.momentumContext = context;
      }

      getMomentumContext = () => this.momentumContext;

      getRollingWRPct(frac = 1.0, offsetFrac = 0.0) {
        const theo = 1 / this.payout;
        const W = this.adaptiveWindow(this.payout, this.cycles);
        const lookback = Math.max(1, Math.round(W * frac));
        const offset = Math.max(0, Math.round(W * offsetFrac));
        const actual = this.rateWindow.getRollingHitRate(lookback, offset);
        return (actual / theo) * 100;
      }

      getWinRatePercentOfTeo(lookback, offset = 0) {
        return this.getRollingWRPct(lookback, offset);
      }

      getDecayedWinRatePercentOfTeo() {
        const theo = 1 / this.payout;
        const actual = this.rateWindow.getDecayedHitRate();
        return (actual / theo) * 100;
      }

      getTotalWinRate() {
        return this.hitCount / this.rollCount;
      }

      getTotalWinRatePercentOfTeo() {
        const theo = 1 / this.payout;
        const actual = this.getTotalWinRate();
        return (actual / theo) * 100;
      }

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
          this.rawRatio = (this.rawRatio ?? 0) + winBump;
          this.ratio = this.rawRatio / this.payout;
        } else {
          this.losingStreak = (this.losingStreak ?? 0) + 1;
          this.rawRatio = (this.rawRatio ?? 0) + loseBump;
          this.ratio = this.rawRatio / this.payout;

          if (this.losingStreak >= this.payout * getLosingStreakMultiplier()) {
            this.haltMessage = `[Losing Streak Threshold Breached] Payout: ${this.payout}, Streak: ${this.losingStreak}`;
          } else {
            this.haltMessage = null;
          }
        }
        this.rateWindow.push(result >= this.payout);

        if (!this.fullyPrimed && this.rollCount < this.payout * 100) {
          this.primedLower = false;
          this.primedUpper = false;
          this.fullyPrimed = false;
        } else if (this.rollCount > this.payout * 500) {
          this.fullyPrimed = true;
        } else if (this.getWinRatePercentOfTeo(this.shortWindow) < 90) {
          this.primedLower = true;
        } else if (this.getWinRatePercentOfTeo(this.shortWindow) > 110) {
          this.primedUpper = true;
        }

        if (this.primedLower && this.primedUpper) {
          this.fullyPrimed = true;
        }
      }

      getFullyPrimed = () => this.fullyPrimed;

      getMomentumBias() {
        switch (this.momentumState) {
          case "UP":
            return +2;
          case "NEUTRAL_FROM_UP":
            return +1;
          case "NEUTRAL":
            return 0;
          case "NEUTRAL_FROM_DOWN":
            return -1;
          case "DOWN":
            return -2;
          default:
            return 0;
        }
      }

      isStarved(
        shortThresh = 70,
        longThresh = 80,
        overallThresh = 90,
        baseMult = 4,
        maxMultiplier = 1000000
      ) {
        if (!this.getFullyPrimed()) return null;

        if (this.payout > maxMultiplier || this.payout < 1.6) return null;

        const shortWR = this.getWinRatePercentOfTeo(this.shortWindow);
        const longWR = this.getWinRatePercentOfTeo(this.longWindow);
        const decayedWR = this.getDecayedWinRatePercentOfTeo();
        const streak = this.getLosingStreak();
        const avgWR = (shortWR + longWR + decayedWR) / 3;

        const context = this.momentumContext;

        const winRatesBreached =
          shortWR < shortThresh &&
          longWR < longThresh &&
          decayedWR < overallThresh;

        if (!winRatesBreached) return false;

        const requiredStreak = this.getDynamicStreakLimit(baseMult);
        const streakOK = streak >= requiredStreak;

        // ✅ KEY RULE:
        // If we're only here because a formerly strong WR is normalizing
        // AND we haven't hit the streak limit yet → DON'T HALT
        const normalizingFromStrength = context > 0 && !streakOK;

        if (normalizingFromStrength) return false;

        // ✅ Otherwise: halting depends only on streak
        if (!streakOK) return false;

        // ✅ Return old style result object
        return {
          payout: this.payout,
          shortWR: shortWR.toFixed(2),
          longWR: longWR.toFixed(2),
          decayedWR: decayedWR.toFixed(2),
          streak,
          requiredStreak: Math.round(requiredStreak),
          avgWR: avgWR.toFixed(2),
          context: context.toFixed(3)
        };
      }

      isBelowWinRates(
        shortThresh = 70,
        longThresh = 80,
        overallThresh = 90,
        maxMultiplier = 1000000
      ) {
        if (!this.getFullyPrimed()) return null;

        if (this.payout > maxMultiplier || this.payout < 1.6) return null;

        const shortWR = this.getWinRatePercentOfTeo(this.shortWindow);
        const longWR = this.getWinRatePercentOfTeo(this.longWindow);
        const decayedWR = this.getDecayedWinRatePercentOfTeo();
        const streak = this.getLosingStreak();
        const avgWR = (shortWR + longWR + decayedWR) / 3;

        const context = this.momentumContext;

        const winRatesBreached =
          shortWR < shortThresh &&
          longWR < longThresh &&
          decayedWR < overallThresh;

        if (!winRatesBreached) return false;

        const streakOK = streak >= this.getPayout() * 3;
        if (!streakOK) return;

        // ✅ KEY RULE:
        // If we're only here because a formerly strong WR is normalizing
        // AND we haven't hit the streak limit yet → DON'T HALT
        const normalizingFromStrength = context > 0 && !streakOK;

        if (normalizingFromStrength) return false;

        // ✅ Return old style result object
        return {
          payout: this.payout,
          shortWR: shortWR.toFixed(2),
          longWR: longWR.toFixed(2),
          decayedWR: decayedWR.toFixed(2),
          avgWR: avgWR.toFixed(2),
          context: context.toFixed(3)
        };
      }

      getDynamicStreakLimit(baseMult) {
        const shortWR = this.getWinRatePercentOfTeo(this.shortWindow);
        const longWR = this.getWinRatePercentOfTeo(this.longWindow);
        const decayedWR = this.getDecayedWinRatePercentOfTeo();

        // average WR for dynamic adjustment
        const avgWR = (shortWR + longWR + decayedWR) / 3;
        const deficit = Math.max(0, 100 - avgWR); // how far below fair we are
        const dynamicMult = baseMult * (1 - deficit / 100); // less streak needed for worse WRs
        return Math.max(1, this.payout * dynamicMult);
      }

      adaptiveWindow(payout, cycles = 100, minRolls = 20, maxRolls = 200000) {
        return Math.max(
          minRolls,
          Math.min(Math.round(payout * cycles), maxRolls)
        );
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

    // const a2 = Array.from(
    //   {
    //     length: 100
    //   },
    //   (v, k) => 2 + k * 1
    // );

    return [...a1, ...a2];
  }

  function halt(stopMessage, clearWager = false) {
    if (getIsTestMode()) {
      mbc.stop();
    }

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

  function getLSColor(target) {
    let lsColor = "transparent";

    if (target.getWinRatePercentOfTeo(1) < 90) {
      if (target.getLosingStreak() > target.getPayout()) {
        lsColor = "red";
      }
    } else if (target.getWinRatePercentOfTeo(1) > 110) {
      if (target.getLosingStreak() > target.getPayout()) {
        lsColor = "gray";
      }
    }

    return lsColor;
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

  function colorForFairness(FIraw) {
    const maxDev = 40; // full tint threshold
    const sev = Math.min(Math.abs(FIraw) / maxDev, 1);
    const alpha = 0.15 + 0.35 * sev;
    const color = FIraw >= 0 ? "0,255,0" : "255,0,0";
    return `rgba(${color},${alpha})`;
  }

  function computeFairnessIndex(target, w50 = 0.6, w100 = 0.4) {
    const C50 = target.getWinRatePercentOfTeo(0.5);
    const P50 = target.getWinRatePercentOfTeo(0.5, 0.5);
    const C100 = target.getWinRatePercentOfTeo(1);
    const P100 = target.getWinRatePercentOfTeo(1, 1);

    // Fair = generous, Unfair = starved
    // Weighted deviation above or below 100
    const shortTerm = (C50 - 100) * w50 + (C100 - 100) * w100;
    const longTerm = (P50 - 100) * w50 + (P100 - 100) * w100;

    // Combine with bias toward present (80% current, 20% history)
    const FIraw = 0.8 * shortTerm + 0.2 * longTerm;

    return FIraw; // pure value, no clamp or color
  }

  function getRowColors(
    payout,
    streak,
    streakLimit,
    fi,
    shortWR,
    longWR,
    decayedWR
  ) {
    const shortThresh = getStarvedShortWinRateThrehold();
    const longThresh = getStarvedLongWinRateThrehold();
    const overallThresh = getStarvedWinRateThrehold();

    const wrColor50 = syncedColor(shortWR, shortThresh, payout);
    const wrColor100 = syncedColor(longWR, longThresh, payout);
    const wrColorDecayed = syncedColor(decayedWR, overallThresh, payout);

    let lsColor = "transparent";
    if (streak >= streakLimit) {
      const excess = streak / (payout * 3);
      const capped = Math.min(excess, 2);
      const alpha = 0.25 + capped * 0.25;
      lsColor = `rgba(255, 0, 0, ${alpha})`;
    }
    const fairnessColor = colorForFairness(fi);

    return {
      wrColor50,
      wrColorDecayed,
      wrColor100,
      lsColor,
      fairnessColor,
      fairnessValue: fi
    };
  }

  const stateCache = new Map();

  function syncedColor(val, low = 90, key = null) {
    if (isNaN(val)) return "transparent";

    // No key = no state tracking → transparent fall-back
    let last = key ? stateCache.get(key) : null;

    // --- Hard RED zone: below threshold
    if (val < low) {
      const out = "rgba(255, 0, 0, 0.50)";
      if (key) stateCache.set(key, "red");
      return out;
    }

    // --- Hard GREEN zone: above 100
    if (val > 100) {
      const out = "rgba(0, 255, 0, 0.50)";
      if (key) stateCache.set(key, "green");
      return out;
    }
    // --- Neutral zone
    if (last === "green") {
      return "rgba(0, 255, 0, 0.15)";
    }
    if (last === "red") {
      return "rgba(255, 0, 0, 0.15)";
    }

    // No history yet — neutral
    return "transparent";
  }

  // Storage for previous colors keyed by value type + payout
  const memory = new Map();

  function fancyColor(val, low = 90, floor = 50, ceiling = 150, key = null) {
    if (isNaN(val)) return "transparent";

    let last = key ? memory.get(key) : null;

    // Convert last to HSV + alpha if exists
    let lastHSV = null;
    let lastAlpha = 0;
    if (last && last.startsWith("rgba")) {
      const m = last.match(/rgba\((\d+), (\d+), (\d+), ([0-9.]+)\)/);
      if (m) {
        lastHSV = rgbToHsv(+m[1], +m[2], +m[3]);
        lastAlpha = parseFloat(m[4]);
      }
    }

    // Determine zone
    let zone = "neutral";
    if (val < low) zone = "red";
    else if (val > 100) zone = "green";

    let hsv, alpha;

    if (zone === "red") {
      const severity = Math.min((low - val) / (low - floor), 1);
      // pure red: HSV ~ (0°,100%,100%) BUT we want fading toward yellow (60°)
      let h = 0 + (60 / 360) * (1 - severity); // red → yellow as severity lightens
      hsv = [h, 1, 1];
      alpha = 0.15 + 0.35 * severity;
    } else if (zone === "green") {
      const severity = Math.min((val - 100) / (ceiling - 100), 1);
      // pure green: 120°, blend toward yellow (~60°) when weak
      let h = 120 / 360 - (60 / 360) * (1 - severity); // green → yellow
      hsv = [h, 1, 1];
      alpha = 0.15 + 0.35 * severity;
    } else {
      // NEUTRAL ZONE: Fade previous hue toward YELLOW + reduce alpha
      if (lastHSV) {
        let [h, s, v] = lastHSV;
        // Move hue toward yellow 60°
        const yellow = 60 / 360;
        h = h * 0.85 + yellow * 0.15;

        // fade alpha
        alpha = Math.max(lastAlpha - 0.06, 0);

        memory.set(
          key,
          alpha === 0 ? "transparent" : rgbaFromHSV([h, s, v], alpha)
        );
        return alpha === 0 ? "transparent" : rgbaFromHSV([h, s, v], alpha);
      }

      memory.set(key, "transparent");
      return "transparent";
    }

    const rgb = hsvToRgb(hsv[0], hsv[1], hsv[2]);
    const out = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha.toFixed(3)})`;

    if (key) memory.set(key, out);
    return out;
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
      const wrp50 = target.getWinRatePercentOfTeo(0.5);
      const baseMult = 3;
      const streakLimit = target.getDynamicStreakLimit(baseMult);
      const wrpDecayed = target.getDecayedWinRatePercentOfTeo();
      const wrp100 = target.getWinRatePercentOfTeo(1);
      const fi = computeFairnessIndex(target);

      $(`#payout-${streakId}`).html(isNaN(payout) ? "—" : payout.toFixed(2));

      $(`#win-rate-percent-decayed-${streakId}`).html(
        isNaN(wrpDecayed) ? "—" : wrpDecayed.toFixed(2)
      );

      $(`#win-rate-percent-50-${streakId}`).html(
        isNaN(wrp50) ? "—" : wrp50.toFixed(2)
      );

      $(`#win-rate-percent-100-${streakId}`).html(
        isNaN(wrp100) ? "—" : wrp100.toFixed(2)
      );

      $(`#streak-${streakId}`).html(isNaN(ls) ? "—" : ls);

      const colors = getRowColors(
        payout,
        ls,
        streakLimit,
        fi,
        wrp50,
        wrp100,
        wrpDecayed
      );
      const lsColor = colors.lsColor;
      const wrColor50 = colors.wrColor50;
      const wrColorDecayed = colors.wrColorDecayed;
      const wrColor100 = colors.wrColor100;
      const wrColorDecayed100 = colors.wrColorDecayed100;
      const wrColor = colors.wrColor;

      const fairnessValue = colors.fairnessValue;
      const fairnessColor = colors.fairnessColor;

      $(`#win-rate-fairness-${streakId}`).html(
        isNaN(fairnessValue) ? "—" : fairnessValue.toFixed(2)
      );

      const $streakCol = $(`#streak-${streakId}`).closest("td");
      $streakCol.css("background-color", lsColor);

      const $wrCol50 = $(`#win-rate-percent-50-${streakId}`).closest("td");
      $wrCol50.css("background-color", wrColor50);

      const $wrColDecayed50 = $(
        `#win-rate-percent-decayed-${streakId}`
      ).closest("td");
      $wrColDecayed50.css("background-color", wrColorDecayed);

      const $wrCol100 = $(`#win-rate-percent-100-${streakId}`).closest("td");
      $wrCol100.css("background-color", wrColor100);

      const $fairnessCol = $(`#win-rate-fairness-${streakId}`).closest("td");
      $fairnessCol.css("background-color", fairnessColor);
    }
  }

  function updateHighHits() {
    const highHits = HIGH_HITS.getResults();

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

  function getResetHighHitOnBigHit() {
    return $("#reset-high-hit-on-big-hit").prop("checked");
  }

  function getResetOnStart() {
    return $("#reset-on-start").prop("checked");
  }

  function getHighHitResetThreshold() {
    if (!highHitResetThresholdField) {
      highHitResetThresholdField = $("#high-hit-reset-threshold");
    }
    return Number(highHitResetThresholdField.val());
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

  function getStarvedLosingStreakMultiplier() {
    if (!starvedLsField) {
      starvedLsField = $("#starved-ls-multiplier");
    }
    return Number(starvedLsField.val());
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

  function getWinRateThrehold() {
    if (!WRThresholdField) {
      WRThresholdField = $("#wr-threshold");
    }
    return Number(WRThresholdField.val());
  }

  function getLongWinRateThrehold() {
    if (!LongWRThresholdField) {
      LongWRThresholdField = $("#long-wr-threshold");
    }
    return Number(LongWRThresholdField.val());
  }

  function getStarvedShortWinRateThrehold() {
    if (!starvedShortWRThresholdField) {
      starvedShortWRThresholdField = $("#starved-short-wr-threshold");
    }
    return Number(starvedShortWRThresholdField.val());
  }

  function getStarvedWinRateThrehold() {
    if (!starvedWRThresholdField) {
      starvedWRThresholdField = $("#starved-wr-threshold");
    }
    return Number(starvedWRThresholdField.val());
  }

  function getStarvedLongWinRateThrehold() {
    if (!starvedLongWRThresholdField) {
      starvedLongWRThresholdField = $("#starved-long-wr-threshold");
    }
    return Number(starvedLongWRThresholdField.val());
  }

  function getHighHitThreshold() {
    if (!highHitThresholdField) {
      highHitThresholdField = $("#high-hit-threshold");
    }
    return Number(highHitThresholdField.val());
  }

  function initHighHits() {
    class HighHits {
      constructor() {
        this.rollCount = 0;
        this.highHit = 0;
        this.round = 0;

        this.intervals = [50, 100, 1000, 10000];
        this.data = new Map();

        for (const interval of this.intervals) {
          this.data.set(interval, {
            highHit: 0,
            round: 0
          });
        }
      }

      addResult(result) {
        this.rollCount++;

        // Update global high hit
        if (result > this.highHit) {
          this.highHit = result;
          this.round = this.rollCount;
        }

        for (const interval of this.intervals) {
          if (this.rollCount % interval === 0) {
            this.data.set(interval, { highHit: 0, round: 0 });
          }

          const entry = this.data.get(interval);
          if (result > entry.highHit) {
            this.data.set(interval, {
              highHit: result,
              round: this.rollCount
            });
          }
        }
      }

      getResults() {
        const results = {
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
      setWager(getScaledWager());
      $("#risk-on").prop("checked", true);

      $("#profit-target").val(0.01);
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
    return Math.max(0.0001, baseWager * Math.pow(1.01 / target, scalingFactor));
  }

  function getBaseWager() {
    return getBalance() * 0.01;
  }

  function getBalance() {
    let rawText = $(".ml-3 .font-extrabold").text().trim();
    return parseFloat(rawText.replace(/[^\d.]/g, ""));
  }

  function getMaxWager() {
    return parseFloat($("#max-wager").val());
  }

  function getBalance() {
    let rawText = $(".ml-3 .font-extrabold").text().trim();
    return parseFloat(rawText.replace(/[^\d.]/g, ""));
  }

  function getWager() {
    if (getIsTestMode()) {
      return Number($("#wager").val());
    }

    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Amount")'
    );
    const inputField = payoutFieldGroup.find("input");

    return Number(inputField.val());
  }

  function setWager(amount) {
    const payout = getPayout(); // whatever’s currently selected in UI

    if (getIsTestMode()) {
      $("#wager").val(amount);
      return;
    }

    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Amount")'
    );
    const inputField = payoutFieldGroup.find("input");

    if (inputField.length) {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      ).set;
      nativeSetter.call(inputField[0], amount);
      inputField[0].dispatchEvent(new Event("input", { bubbles: true }));
      inputField[0].dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function setPayout(amount) {
    if (getIsTestMode()) {
      $("#payout").val(amount);
      return;
    }

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
    if (getIsTestMode()) {
      return Number($("#payout").val());
    }

    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Payout")'
    );
    const inputField = payoutFieldGroup.find("input");

    return Number(inputField.val());
  }

  // Utility function: Get current roll data
  function getCurrentRollData() {
    return $(".grid.grid-auto-flow-column div span")
      .map(function () {
        const t = $(this).text();

        // Normalize and remove anything that's not a digit or dot
        const cleaned = t
          .normalize("NFKC")
          .replace(/[\u00A0\u2000-\u200D\u202F\u205F\u3000\uFEFF]/g, "") // NBSP & zero-widths
          .replace(/[x×✕✖✗]/gi, "") // common x look-alikes
          .replace(/[^\d.]/g, "") // keep only numbers & dots
          .trim();

        return cleaned;
      })
      .get();
  }

  function getTeo() {
    return 1 / (getPayout() * 1.02);
  }

  function getExpectedHits() {
    const maxRolls = getMaxRolls();

    if (maxRolls === 0) return 1;

    return Math.ceil(getTeo() * maxRolls) + 1;
  }

  // Function to start the betting process
  function startBetting() {
    if (firstLoad || getResetOnStart()) {
      firstLoad = false;
      highHitLosingStreak = 0;
      highHitRound = 0;
    }

    rollCount = 0;
    profit = 0;
    hitCount = 0;
    stopped = false;

    if (getIsTestMode()) {
      mbc.start();
    } else {
      doBet(); // Start the async loop
    }
  }

  function stopBetting() {
    stopped = true;
    if (getIsTestMode()) {
      mbc.stop();
    }
    document.querySelector(".btn.btn-danger")?.click()
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function doInit() {
    observeRollChanges();
    configureMarqueeColorization();
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


  // Utility function: Get current roll data
  function getCurrentRollData() {
    return Array.from(
      document.querySelectorAll("table tbody tr td:nth-child(4)"),
    ).map((cell) => cell.textContent.trim())
  }


  // Utility function: Extract the last roll result
  function getRollResult() {
    const row = document.querySelector("div.table-responsive table tbody tr")
    if (!row || row.children.length < 4) return -1

    const outcomeCell = row.children[2] // 0-indexed
    const resultText = outcomeCell.textContent.trim()
   console.log(resultText);
    return Number(resultText.replace(/[x,]/g, ""))
  }

  // Observer to monitor roll changes in the grid
  let observer = null; // Store observer globally


  async function observeRollChanges() {
    const tableBody = await waitForSelector("#root table tbody")
    let previousRollData = getCurrentRollData()

    if (observer) observer.disconnect()

    observer = new MutationObserver((mutationsList) => {
      let result = getRollResult()

      if (result === -1 || result === NaN || !isMeTabActive()) return
      evalResult(result)
    })

    observer.observe(tableBody, {
      childList: true,
      subtree: true,
    })
  }

  function isMeTabActive() {
    const wrapper = document.querySelector('div[class*="wagerHistory"]')
    if (!wrapper) return false

    const tabs = wrapper.querySelector('div[class^="_tabs"]')
    if (!tabs) return false

    const meTab = Array.from(tabs.querySelectorAll("a")).find(
      (el) => el.textContent.trim().toLowerCase() === "me",
    )

    if (!meTab) return false

    return Array.from(meTab.classList).some((cls) =>
      cls.startsWith("_activeTab"),
    )
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
                  <th style="text-align: left; padding: 6px;">WR%</th>
                  <th style="text-align: left; padding: 6px;">WR% 1/2</th>
                  <th style="text-align: left; padding: 6px;">WR% 1</th>
                  <th style="text-align: left; padding: 6px;">F</th>
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
        <td><span id="win-rate-percent-decayed-${target.getHTMLID()}"></span></td>
        <td><span id="win-rate-percent-50-${target.getHTMLID()}"></span></td>
        <td><span id="win-rate-percent-100-${target.getHTMLID()}"></span></td>
        <td><span id="win-rate-fairness-${target.getHTMLID()}"></span></td>
      </tr>`
    ).join("");
  }

  function configureMarqueeColorization() {
    // ------- CONFIG -------
    const H_THRESHOLD = 1.92;
    const V_THRESH = 10;
    const V_PAYOUTS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

    // ------- STYLE (beat Tailwind + nested elements) -------
    (function injectStyle() {
      if (document.getElementById("bcg-low-style")) return;
      const el = document.createElement("style");
      el.id = "bcg-low-style";
      el.textContent = `
      .grid.grid-auto-flow-column .btn-like.bcg-low,
      .grid.grid-auto-flow-column .btn-like.bcg-lower,
      .grid.grid-auto-flow-column .btn-like.bcg-both { background-color:#b3261e !important; color:#fff !important; }
      .grid.grid-auto-flow-column .btn-like.bcg-lower { background-color:#d02a20 !important; }
      .grid.grid-auto-flow-column .btn-like.bcg-both  { background-color:#ff3b30 !important;
        box-shadow:0 0 .5rem rgba(255,59,48,.7),0 0 1.25rem rgba(255,59,48,.35) !important;
        transform:translateZ(0); animation:bcg-pulse 1.2s ease-in-out infinite;
      }
      /* Force inner spans/icons, regardless of !text-[#B3BEC1] */
      .grid.grid-auto-flow-column .btn-like.bcg-low *,
      .grid.grid-auto-flow-column .btn-like.bcg-lower *,
      .grid.grid-auto-flow-column .btn-like.bcg-both * { color:#fff !important; fill:#fff !important; stroke:#fff !important; }
      @keyframes bcg-pulse {
        0%{box-shadow:0 0 .35rem rgba(255,59,48,.6),0 0 1rem rgba(255,59,48,.25)}
        50%{box-shadow:0 0 .9rem rgba(255,59,48,.9),0 0 1.6rem rgba(255,59,48,.45)}
        100%{box-shadow:0 0 .35rem rgba(255,59,48,.6),0 0 1rem rgba(255,59,48,.25)}
      }
    `;
      document.head.appendChild(el);
    })();

    // ------- UTILS -------
    const parseNum = (t) => {
      const n = parseFloat(String(t || "").replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : null;
    };

    // Snapshot hot payouts from your table (used ONLY for future tiles)
    let HOT_SET = [];
    function snapshotHotPayouts() {
      const tbody = document.querySelector("#output-table tbody");
      if (!tbody) return;
      const hot = [];
      tbody.querySelectorAll("tr").forEach((row) => {
        const tds = row.querySelectorAll("td");
        if (tds.length < 2) return;
        const payout = parseNum((tds[0].textContent || "").trim());
        const streak = parseNum(tds[1]?.querySelector("span")?.textContent);
        if (
          payout != null &&
          streak != null &&
          V_PAYOUTS.includes(payout) &&
          Math.abs(streak) >= V_THRESH
        ) {
          hot.push(payout);
        }
      });
      hot.sort((a, b) => a - b);
      HOT_SET = hot;
    }

    // ------- STATE & ENGINE -------
    const lastText = new WeakMap(); // tile -> last seen text
    const gridRun = new WeakMap(); // grid -> { lastLow }

    function classify(grid, tile, value) {
      // Clear classes from the PREVIOUS value (we only do this when text changed)
      tile.classList.remove("bcg-low", "bcg-lower", "bcg-both");

      const run = gridRun.get(grid) ?? { lastLow: null };
      if (value < H_THRESHOLD) {
        const converges = HOT_SET.length && HOT_SET.some((P) => value < P);
        if (converges) {
          tile.classList.add("bcg-both");
        } else {
          if (run.lastLow !== null && value < run.lastLow) {
            tile.classList.add("bcg-lower");
          } else {
            tile.classList.add("bcg-low");
          }
          run.lastLow = value;
        }
      } else {
        // break in the <1.92 run
        run.lastLow = null;
      }
      gridRun.set(grid, run);
    }

    function maybeUpdate(grid, tile) {
      // Use innerText to be resilient to span splits
      const nowTxt = (tile.innerText || tile.textContent || "").trim();
      if (!nowTxt) return;

      // Only react when the TEXT changed (prevents retro flips)
      if (lastText.get(tile) === nowTxt) return;
      lastText.set(tile, nowTxt);

      const v = parseNum(nowTxt);
      if (v == null) return;
      classify(grid, tile, v);
    }

    function scanGrid(grid) {
      grid
        .querySelectorAll(".btn-like")
        .forEach((tile) => maybeUpdate(grid, tile));
    }

    // ------- WIRING -------
    // 1) Initial snapshot + quick first paint
    snapshotHotPayouts();
    document.querySelectorAll(".grid.grid-auto-flow-column").forEach(scanGrid);

    // 2) Robust “tick” that catches silent updates (some frameworks dodge MOs)
    let tickTimer = 0;
    (function tick() {
      // Query grids fresh each tick (grids can mount later)
      const grids = document.querySelectorAll(".grid.grid-auto-flow-column");
      grids.forEach(scanGrid);
      tickTimer = window.setTimeout(() => requestAnimationFrame(tick), 120); // ~8 fps
    })();

    // 3) MutationObserver (still helps when available)
    const docObs = new MutationObserver((muts) => {
      let needRescan = false;
      for (const m of muts) {
        if (m.type === "childList") needRescan = true;
        if (m.type === "characterData") {
          const tile = m.target?.parentElement?.closest?.(".btn-like");
          const grid = tile?.closest?.(".grid.grid-auto-flow-column");
          if (tile && grid) maybeUpdate(grid, tile);
        }
      }
      if (needRescan) {
        document
          .querySelectorAll(".grid.grid-auto-flow-column")
          .forEach(scanGrid);
      }
    });
    docObs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });

    // 4) Watch your table to refresh HOT_SET (future tiles only)
    const tbody = document.querySelector("#output-table tbody");
    if (tbody) {
      const tableObs = new MutationObserver(() => {
        if (tableObs._t) cancelAnimationFrame(tableObs._t);
        tableObs._t = requestAnimationFrame(snapshotHotPayouts);
      });
      tableObs.observe(tbody, {
        childList: true,
        subtree: true,
        characterData: true
      });
      setInterval(snapshotHotPayouts, 1500); // safety: some tables render off-DOM then swap
    }

    // Debug helpers
    window.__bcg = {
      hot: () => HOT_SET.slice(),
      grids: () =>
        [...document.querySelectorAll(".grid.grid-auto-flow-column")].length,
      sample: () =>
        [...document.querySelectorAll(".grid.grid-auto-flow-column .btn-like")]
          .slice(-6)
          .map((t) => this.innerText.trim()),
      lastText,
      gridRun
    };
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
