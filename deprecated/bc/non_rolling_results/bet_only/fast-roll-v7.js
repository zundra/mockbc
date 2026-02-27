/* Start Script */
// ==UserScript==
// @name         bc.game fastest roll v7
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  try to take over the world!
// @author       You
// @match        https://*.game/game/limbo
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bc.game
// @require https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

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

  // Fields
  let lsField = null;
  let highHitThresholdField = null;
  let hitCountTargetField = null;
  let maxRollField = null;
  let restHighHitField = null;
  let highHitResetThresholdField = null;
  let maxLossField = null;

  let highHit = 0;
  let highHitRound = 0;
  let highHitLosingStreak = 0;

  let rowColors = {};

  let teo = 0;

  injectUI();
  initWindowEvents();

  function evalResult(result) {
    rollCount++;

    if (result > highHit) {
      highHit = result;
      highHitRound = rollCount;
      highHitLosingStreak = 0;
    } else {
      highHitLosingStreak++;
    }

    let payout = getPayout();

    if (result >= payout) {
      hitCount++;

      losingStreak = 0;
      profit += payout * getWager() - getWager();
    } else {
      losingStreak++;
      profit -= getWager();
    }

    HIGH_HITS.addResult(result);
    setStreaks(result);
    updateUI();
    checkHalts(result);
  }

  function setStreaks(result) {
    for (let i = 0; i < TARGETS.length; i++) {
      TARGETS[i].push(result);
    }
  }

  function checkHalts(result) {
    const payout = getPayout();

    if (getStopOnHitCount() && hitCount >= getHitCountTarget()) {
      halt(`Target hit ${hitCount} times`);
      return;
    }

    console.log(getStopOnMaxRolls(), rollCount, getMaxRolls());
    if (getStopOnMaxRolls() && rollCount >= getMaxRolls()) {
      halt("Max rolls hit", rollCount);
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
      halt("Max loss exceeded:", profit);
      return;
    }

    if (getStopOnProfit() && profit >= getProfitTarget()) {
      halt(`Profit target hit ${profit.toFixed(4)}`);
      return;
    }

    // if (getRiskOn()) return;

    // const unfairCompressionTargets = TARGETS
    //   .map((t) => {
    //     const { FI } = computeFairnessIndex(t);
    //     return { t, FI };
    //   })
    //   .filter(({ t, FI }) =>
    //     t.getWinRatePercentOfTeo(50) < 60 &&    // below 60% of expected short-term WR
    //     t.getWinRatePercentOfTeo(50, 50) < 80 &&    // below 60% of expected short-term WR
    //     FI < -50 &&                              // fairness index shows continuing compression
    //     t.getLosingStreak() >= t.getPayout() * 5 &&
    //     rollCount >= t.getPayout() * 100
    //   )
    //   .sort((a, b) => a.FI - b.FI); // most unfair (lowest FI) first

    // if (unfairCompressionTargets.length) {
    //   const { t, FI } = unfairCompressionTargets[0];
    //   halt(
    //     `[Target ${t.payout}× Unfair Compression] WR(50)=${t.getWinRatePercentOfTeo(50).toFixed(2)}, WR(100)=${t.getWinRatePercentOfTeo(100).toFixed(2)}, F=${FI.toFixed(2)}`
    //   );
    //   return;
    // }

    // const extremeUnfairCompressionTargets = TARGETS
    //   .map((t) => {
    //     const FI = computeFairnessIndex(t);
    //     return { t, FI };
    //   })
    //   .filter(({ t, FI }) => FI <= -50 && rollCount >= t.getPayout() * 100)
    //   .sort((a, b) => a.FI - b.FI); // most unfair (lowest FI) first

    // if (extremeUnfairCompressionTargets.length) {
    //   const { t, FI } = extremeUnfairCompressionTargets[0];

    //   logFairnessBreakdown(t);
    //   halt(
    //     `[Target ${t.payout}× Unfair Compression: ${FI}]}`
    //   );
    //   return;
    // }

    // const lowWinRateTargets = TARGETS
    //   .map((t) => {
    //     const { FI } = computeFairnessIndex(t);
    //     return { t, FI };
    //   })
    //   .filter(({ t, FI }) =>
    //     t.getWinRatePercentOfTeo(50) < 30 &&
    //     t.getWinRatePercentOfTeo(50, 50) < 80 &&
    //     FI < 0 &&
    //     t.getLosingStreak() >= t.getPayout() * 5 &&
    //     rollCount >= t.getPayout() * 100
    //   )
    //   .sort((a, b) => a.FI - b.FI);

    // if (lowWinRateTargets.length) {
    //   const { t, FI } = lowWinRateTargets[0];
    //   halt(
    //     `[Target ${t.payout}× Win Rate Threshold Breached]
    //     Current WR (50)=${t.getWinRatePercentOfTeo(50).toFixed(2)},
    //     Previous WR (50)=${t.getWinRatePercentOfTeo(50, 50).toFixed(2)},
    //     WR (100)=${t.getWinRatePercentOfTeo(100).toFixed(2)}`
    //   );
    //   return;
    // }

    // if (getStopOnLosingStreak()) {
    //   let breached = TARGETS.filter((target) => target.haltMessage != null);
    //   if (breached.length !== 0) {
    //     halt(breached[0].haltMessage);
    //     return;
    //   }
    // }
  }

  function generateTargets() {
    return generatePayouts().map((p) => createTarget(p.toFixed(2)));
  }

  function createTarget(payout) {
    class RollingCounter {
      constructor(size, decay = 0.98) {
        this.size = size;
        this.decay = decay; // exponential decay factor per sample
        this.hits = new Array(size).fill(0);
        this.index = 0;
        this.count = 0;
      }

      push(isHit) {
        this.hits[this.index] = isHit ? 1 : 0;
        this.index = (this.index + 1) % this.size;
        this.count = Math.min(this.count + 1, this.size);
      }

      // Rolling window with optional offset and decay weighting
      getHitRate(lookback = this.count, offset = 0) {
        if (this.count === 0) return 0;
        lookback = Math.min(lookback, this.count);
        offset = Math.min(offset, this.count - lookback);

        const end = (this.index - offset + this.size) % this.size;
        const start = (end - lookback + this.size) % this.size;

        let weightedSum = 0;
        let weight = 1;
        let totalWeight = 0;

        for (let i = 0; i < lookback; i++) {
          const idx = (start + i) % this.size;
          weightedSum += this.hits[idx] * weight;
          totalWeight += weight;
          weight *= this.decay; // older samples lose influence
        }

        return weightedSum / totalWeight;
      }

      getWinRate(lookback = this.count, offset = 0) {
        return this.getHitRate(lookback, offset);
      }
    }

    class Target {
      constructor(payout) {
        this.payout = parseFloat(payout);
        this.losingStreak = 0;
        this.hitCount = 0;
        this.rollCount = 0;
        this.haltMessage = null;
        this.ratio = 0;
        this.rawRatio = parseFloat(payout);
        this.lsdiff = 0;
        this.e = 0.02;
        this.teo = this.calculateTeo();
        this.rollingCounter = new RollingCounter(1000, this.teo);
      }

      // ===============================
      // === Core performance metrics ===
      // ===============================
      getWinRatePercentOfTeo(lookback, offset = 0) {
        const theo = 1 / this.payout;
        const actual = this.rollingCounter.getWinRate(lookback, offset);
        return (actual / theo) * 100;
      }

      calculateTeo = () => 1 / (this.payout * 1.02);
      getLosingStreak = () => this.losingStreak;

      getPayout = () => this.payout;

      push(result) {
        const winBump = this.payout - 1 + this.e;
        const loseBump = -1 + this.e;

        if (result >= this.payout) {
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
        this.rollingCounter.push(result >= this.payout);
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
        length: 9
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

  function halt(stopMessage) {
    if (getIsTestMode()) {
      mbc.stop();
    }
    console.log(stopMessage);
    $("#message-box").text(stopMessage);
    stopMessage = "";
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

    if (target.getWinRatePercentOfTeo(100) < 90) {
      if (target.getLosingStreak() > target.getPayout()) {
        lsColor = "red";
      }
    } else if (target.getWinRatePercentOfTeo(100) > 110) {
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

  function logFairnessBreakdown(t) {
    const C50 = t.getWinRatePercentOfTeo(50);
    const P50 = t.getWinRatePercentOfTeo(50, 50);
    const C100 = t.getWinRatePercentOfTeo(100);
    const P100 = t.getWinRatePercentOfTeo(100, 100);
    const d50 = Math.abs(P50 - 100) - Math.abs(C50 - 100);
    const d100 = Math.abs(P100 - 100) - Math.abs(C100 - 100);
    const FI = computeFairnessIndex(t);
    console.log(
      `[${t.payout}x] C50=${C50.toFixed(2)} P50=${P50.toFixed(
        2
      )} C100=${C100.toFixed(2)} P100=${P100.toFixed(2)}  d50=${d50.toFixed(
        2
      )} d100=${d100.toFixed(2)}  F=${FI.toFixed(2)}`
    );
  }

  function colorForFairness(FIraw) {
    const maxDev = 40; // full tint threshold
    const sev = Math.min(Math.abs(FIraw) / maxDev, 1);
    const alpha = 0.15 + 0.35 * sev;
    const color = FIraw >= 0 ? "0,255,0" : "255,0,0";
    return `rgba(${color},${alpha})`;
  }

  function computeFairnessIndex(target, w50 = 0.6, w100 = 0.4) {
    const C50 = target.getWinRatePercentOfTeo(50);
    const P50 = target.getWinRatePercentOfTeo(50, 50);
    const C100 = target.getWinRatePercentOfTeo(100);
    const P100 = target.getWinRatePercentOfTeo(100, 100);

    // Fair = generous, Unfair = starved
    // Weighted deviation above or below 100
    const shortTerm = (C50 - 100) * w50 + (C100 - 100) * w100;
    const longTerm = (P50 - 100) * w50 + (P100 - 100) * w100;

    // Combine with bias toward present (80% current, 20% history)
    const FIraw = 0.8 * shortTerm + 0.2 * longTerm;

    return FIraw; // pure value, no clamp or color
  }

  function getRowColors(target) {
    const wrColor50 = basicColor(target.getWinRatePercentOfTeo(50));
    const wrColorPrev50 = basicColor(target.getWinRatePercentOfTeo(50, 50));
    const wrColor100 = basicColor(target.getWinRatePercentOfTeo(100));
    const wrColorPrev100 = basicColor(target.getWinRatePercentOfTeo(100, 100));

    let lsColor = "transparent";
    if (target.getLosingStreak() >= target.getPayout() * 3) {
      const excess = target.getLosingStreak() / (target.getPayout() * 3);
      const capped = Math.min(excess, 2);
      const alpha = 0.25 + capped * 0.25;
      lsColor = `rgba(255, 0, 0, ${alpha})`;
    }
    const FI = computeFairnessIndex(target);
    const fairnessColor = colorForFairness(FI);

    return {
      wrColor50,
      wrColorPrev50,
      wrColor100,
      wrColorPrev100,
      lsColor,
      fairnessColor,
      fairnessValue: FI
    };
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
      const ratio = target.ratio;
      const wrp50 = target.getWinRatePercentOfTeo(50);
      const wrpPrev50 = target.getWinRatePercentOfTeo(50, 50);
      const wrp100 = target.getWinRatePercentOfTeo(100);
      const wrpPrev100 = target.getWinRatePercentOfTeo(100, 100);
      $(`#payout-${streakId}`).html(isNaN(payout) ? "—" : payout.toFixed(2));

      $(`#ratio-${streakId}`).html(isNaN(ratio) ? "—" : ratio.toFixed(2));

      $(`#win-rate-percent-50-${streakId}`).html(
        isNaN(wrp50) ? "—" : wrp50.toFixed(2)
      );

      $(`#win-rate-percent-prev-50-${streakId}`).html(
        isNaN(wrpPrev50) ? "—" : wrpPrev50.toFixed(2)
      );

      $(`#win-rate-percent-100-${streakId}`).html(
        isNaN(wrp100) ? "—" : wrp100.toFixed(2)
      );

      $(`#win-rate-percent-prev-100-${streakId}`).html(
        isNaN(wrpPrev100) ? "—" : wrpPrev100.toFixed(2)
      );

      $(`#streak-${streakId}`).html(isNaN(ls) ? "—" : ls);

      const $ratioCol = $(`#ratio-${streakId}`).closest("td");

      if (!isNaN(ratio)) {
        if (ratio >= 3) {
          $ratioCol.css("background-color", "green");
        } else if (ratio <= -3) {
          $ratioCol.css("background-color", "red");
        } else {
          $ratioCol.css("background-color", "transparent");
        }
      } else {
        $ratioCol.css("background-color", ""); // Reset
      }
      const colors = getRowColors(target);
      const lsColor = colors.lsColor;
      const wrColor50 = colors.wrColor50;
      const wrColorPrev50 = colors.wrColorPrev50;
      const wrColor100 = colors.wrColor100;
      const wrColorPrev100 = colors.wrColorPrev100;
      const fairnessValue = colors.fairnessValue;
      const fairnessColor = colors.fairnessColor;

      $(`#win-rate-fairness-${streakId}`).html(
        isNaN(fairnessValue) ? "—" : fairnessValue.toFixed(2)
      );

      const $streakCol = $(`#streak-${streakId}`).closest("td");
      $streakCol.css("background-color", lsColor);

      const $wrCol50 = $(`#win-rate-percent-50-${streakId}`).closest("td");
      $wrCol50.css("background-color", wrColor50);

      const $wrColPrev50 = $(`#win-rate-percent-prev-50-${streakId}`).closest(
        "td"
      );
      $wrColPrev50.css("background-color", wrColorPrev50);

      const $wrCol100 = $(`#win-rate-percent-100-${streakId}`).closest("td");
      $wrCol100.css("background-color", wrColor100);

      const $wrColPrev100 = $(`#win-rate-percent-prev-100-${streakId}`).closest(
        "td"
      );
      $wrColPrev100.css("background-color", wrColorPrev100);

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
      $("#roll-mode").val("half-target");
      $("#hit-count-target").val(1);
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

    $("#watch-payouts").on("change", function () {
      TARGETS = null;
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
        return $(this).text();
      })
      .get();
  }

  function getTeo() {
    return 1 / (getPayout() * 1.05);
  }

  // Function to start the betting process
  function startBetting() {
    if (firstLoad || getResetOnStart()) {
      firstLoad = false;
      TARGETS = null;
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

  // Utility function: Extract the last roll result
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
            .container {
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
                width: 500px;

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
  <div class="container" id="stats-panel">
    <div class="container-header">⚙️ Stats Panel</div>
          <div class="stats-block">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid #444;">
                  <th style="position: sticky; left: 0; background-color: #1e1e1e; z-index: 1; text-align: left; padding: 6px; white-space: nowrap;">Payout</th>
                  <th style="text-align: left; padding: 6px;">Streak</th>
                  <th style="text-align: left; padding: 6px;">Ratio</th>
                  <th style="text-align: left; padding: 6px;">WR% C:50</th>
                  <th style="text-align: left; padding: 6px;">WR% P:50</th>
                  <th style="text-align: left; padding: 6px;">WR% C:100</th>
                  <th style="text-align: left; padding: 6px;">WR% P:100</th>
                  <th style="text-align: left; padding: 6px;">F</th>
                </tr>
              </thead>
              <tbody id="stats-body">
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
  

    <div class="container" id="control-panel">
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
    <input id="risk-on" type="checkbox" />
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
      <option value="0" selected>0</option>
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
      <option value="8.5" selected>8.5</option>
      <option value="9">9</option>
      <option value="9.5">9.5</option>
      <option value="10">10</option>
    </select>
  </div>


  <div class="control-group">
    <label>Max Loss</label>
    <input type="number" id="max-loss" value="1" />
  </div>

  <div class="control-group">
    <label>Reset On Start</label>
    <input id="reset-on-start" type="checkbox" />
  </div>

  <div class="control-group">
    <label>Reset High Hit on Big Hit</label>
    <input id="reset-high-hit-on-big-hit" type="checkbox" checked />
  </div>

  <div class="control-group">
    <label>High Hit Reset Threshold</label>
    <input type="number" id="high-hit-reset-threshold" value="100" />
  </div>

  <div class="control-group">
    <label>Profit Target</label>
    <input type="number" id="profit-target" value="0" />
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

  <div class="control-group">
    <label>Watch Payouts</label>
    <textarea style="color: black" id="watch-payouts">2 5 10 20 50 100 1000 10000</textarea>
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
        <td><span id="ratio-${target.getHTMLID()}"></span></td>
        <td><span id="win-rate-percent-50-${target.getHTMLID()}"></span></td>
        <td><span id="win-rate-percent-prev-50-${target.getHTMLID()}"></span></td>
        <td><span id="win-rate-percent-100-${target.getHTMLID()}"></span></td>
        <td><span id="win-rate-percent-prev-100-${target.getHTMLID()}"></span></td>
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
