/* Start Script */
// ==UserScript==
// @name         bc.game roller v25.2 (with targets)
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  try to take over the world!
// @author       You
// @match        https://*/game/limbo
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bc.game
// @require https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  let [start, end] = [0, 49];

  const STOP_HIT_SEQ = ["stop", "hit"];
  const TARGET_HIT_SEQ = ["target", "hit"];
  let WATCH_TARGETS = [];
  let RECOVERY_TARGETS = [];
  const ROLLING_STATS = initRollingStats();
  let pivotTarget = null;
  const RATIOS = [];
  let totalRatio = 0;
  let ratioSlope = 0;

  let stats10Mean = 0;
  let stats100Mean = 0;
  let stats1000Mean = 0;

  let stats10variance = 0;
  let stats100variance = 0;
  let stats1000variance = 0;

  let stats10median = 0;
  let stats100median = 0;
  let stats1000median = 0;

  let stats10StdDev = 0;
  let stats100StdDev = 0;
  let stats1000StdDev = 0;

  // Audio Map
  const alertSounds = {
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
    thousand: new Audio("https://zundra.github.io/script-alerts/thousand.mp3"),
    million: new Audio("https://zundra.github.io/script-alerts/million.mp3"),
    hit: new Audio("https://zundra.github.io/script-alerts/hit.mp3"),
    target: new Audio("https://zundra.github.io/script-alerts/target.mp3"),
    stop: new Audio("https://zundra.github.io/script-alerts/stop.mp3"),
    roll: new Audio("https://zundra.github.io/script-alerts/roll.mp3")
  };

  function playNumberAlert(value, prefix = "hit") {
    const sequence = [];
    sequence.push(prefix);

    if (value >= 1_000_000 && alertSounds["million"]) {
      const millions = Math.floor(value / 1_000_000);
      if (alertSounds[millions]) sequence.push(millions);
      sequence.push("million");
      value %= 1_000_000;
    }

    if (value >= 1_000 && alertSounds["thousand"]) {
      const thousands = Math.floor(value / 1_000);
      if (alertSounds[thousands]) sequence.push(thousands);
      sequence.push("thousand");
      value %= 1_000;
    }

    const hundreds = Math.floor(value / 100) * 100;
    if (hundreds > 0 && alertSounds[hundreds]) {
      sequence.push(hundreds);
      value %= 100;
    }

    if (value > 0 && alertSounds[value]) {
      sequence.push(value);
    }

    playSequence(sequence);
  }

  function playSequence(seq, index = 0) {
    if (index >= seq.length) return;
    const sound = alertSounds[seq[index]];
    if (sound) {
      sound.currentTime = 0;
      sound.play();
      sound.onended = () => playSequence(seq, index + 1);
    } else {
      playSequence(seq, index + 1);
    }
  }

  let inRecoveryMode = false;
  let profitAtRecoveryStart = 0;
  let recoveryDelta = 0;
  let recoveryPL = 0;
  let firstLoad = true;
  let lastRollSet = [];
  let currentRollSet = [];
  let rollCount = 0;
  let rollStartTime = null; // in ms
  let losingStreak = 0;
  let stopped = true;
  let hitCount = 0;
  let profit = 0;
  let winRate = 0;
  let teo = 0;

  // Fields
  let lsField = null;
  let highHitThresholdField = null;
  let hitCountTargetField = null;
  let maxRollField = null;
  let restHighHitField = null;
  let highHitResetThresholdField = null;
  let maxLossField = null;
  let alertThresholdField = null;
  let rollModField = null;
  let watchPayout1Field = null;
  let watchPayout2Field = null;
  let watchPayout3Field = null;
  let watchPayout4Field = null;
  let watchPayout5Field = null;
  let maxHaltTargetField = null;
  let profitTargetField = null;
  let highModeTargetField = null;
  let extremeCompressedRatioField = null;
  let fastWinRateThresholdField = null;
  let midWinRateThresholdField = null;
  let slowWinRateThresholdField = null;
  let mstField = null;
  let mtrField = null;
  let watchLsField = null;
  let recoveryLsField = null;

  let highHit = 0;
  let highHitRound = 0;
  let highHitLosingStreak = 0;

  injectControlPanel();

  initWindowEvents();

  function evalResult(result) {
    recordRoll();
    inRecoveryMode = getRecoveryMode();

    if (result > highHit) {
      highHit = result;
      highHitRound = rollCount;
      highHitLosingStreak = 0;
    } else {
      highHitLosingStreak++;
    }

    let payout = getPayout();

    if (result >= payout) {
      losingStreak = 0;
      hitCount++;
      profit += payout * getWager() - getWager();
      if (inRecoveryMode) {
        recoveryPL += payout * getWager() - getWager();
      }
    } else {
      losingStreak++;
      profit -= getWager();
      if (inRecoveryMode) {
        recoveryPL -= getWager();
      }
    }

    winRate = hitCount / rollCount;
    teo = calculateTeo(payout);

    processResult(result);
    tryPlayRollAnnoucment(rollCount);
    tryPlayHitAnnouncement(result);
    updateUI();
    updateStats();

    checkConditions(result);
  }

  function recordRoll() {
    const now = Date.now();

    if (rollStartTime === null) {
      rollStartTime = now;
    }

    rollCount++;
  }

  function updatePivotUI() {
    const pivotTarget = getPivotTarget();

    const infoEl = document.getElementById("pivot-info");
    const barFill = document.getElementById("pressure-fill");
    const spanEl = document.getElementById("pressure-span");

    if (!pivotTarget) {
      infoEl.textContent = "Pivot Target: --";
      barFill.style.width = "0%";
      spanEl.innerHTML = "";
      return;
    }

    const stats = getPivotTargetStats(pivotTarget);

    // update text
    infoEl.innerHTML = `Pivot Target: <span style="color:red;">Payout ${pivotTarget.getPayout()}</span>
    | Ratio ${pivotTarget.getRatio().toFixed(2)}
    | Span ${stats.span}
    | Avg ${stats.avg.toFixed(2)}`;

    // intensity bar (normalized by avg, tune factor if needed)
    const intensity = Math.min(100, Math.abs(stats.avg) * 10);
    barFill.style.width = intensity + "%";

    // render span blocks
    spanEl.innerHTML = "";
    for (let i = 0; i < stats.span; i++) {
      const block = document.createElement("div");
      block.style.width = "20px";
      block.style.height = "20px";
      block.style.background = "#e33";
      block.style.borderRadius = "3px";
      spanEl.appendChild(block);
    }
  }

  function processResult(result) {
    totalRatio = 0;
    let zoneNumber = 0;
    let incrementZone = true;
    ROLLING_STATS.push(result);

    WATCH_TARGETS.forEach((target) => {
      target.push(result);
      totalRatio += target.getRatio();
    });

    RECOVERY_TARGETS.forEach((target) => {
      target.push(result);
    });

    if (RATIOS.length === 50) RATIOS.shift();
    RATIOS.push(totalRatio);
    ratioSlope = getRatioSlope();
  }

  function updateStats() {
    stats10Mean = ROLLING_STATS.getMean(10);
    stats100Mean = ROLLING_STATS.getMean(100);
    stats1000Mean = ROLLING_STATS.getMean(1000);

    stats10variance = ROLLING_STATS.getVariance(10);
    stats100variance = ROLLING_STATS.getVariance(100);
    stats1000variance = ROLLING_STATS.getVariance(1000);

    stats10median = ROLLING_STATS.getMedian(10);
    stats100median = ROLLING_STATS.getMedian(100);
    stats1000median = ROLLING_STATS.getMedian(1000);

    stats10StdDev = ROLLING_STATS.getStandardDeviation(10);
    stats100StdDev = ROLLING_STATS.getStandardDeviation(100);
    stats1000StdDev = ROLLING_STATS.getStandardDeviation(1000);

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
  }

  function getPivotTarget() {
    let pivot = null;

    for (const t of WATCH_TARGETS) {
      const ratio = t.getRatio();

      if (ratio < -2) {
        if (
          !pivot ||
          ratio < pivot.getRatio() ||
          (ratio === pivot.getRatio() && t.getPayout() < pivot.getPayout())
        ) {
          pivot = t;
        }
      }
    }

    return pivot;
  }

  function getPivotTargetStats2(pivotTarget) {
    let span = 0;
    let sum = 0;
    let current = pivotTarget;

    while (current && current.getRatio() < 0) {
      span++;
      sum += current.getRatio();
      current = current.getPreviousTarget();
    }

    return {
      span,
      sum,
      avg: span > 0 ? sum / span : 0
    };
  }

  function getPivotTargetStats(pivotTarget, minPayout = 1) {
    if (!pivotTarget) return { span: 0, sum: 0, avg: 0, pressure: 0 };

    let sum = 0;
    let count = 0;

    let minFloor = Math.floor(pivotTarget.getPayout());
    let maxFloor = minFloor;

    let current = pivotTarget;

    while (current && current.getRatio() < 0) {
      const payout = current.getPayout();
      const floor = Math.floor(payout);

      minFloor = Math.min(minFloor, floor);
      maxFloor = Math.max(maxFloor, floor);

      sum += current.getRatio();
      count++;

      current = current.getPreviousTarget();
    }

    let span = 0;
    if (count > 0 && minFloor !== maxFloor) {
      span = maxFloor - minFloor;
    }

    // Normalize span relative to everything possible below pivot
    const pivotFloor = Math.floor(pivotTarget.getPayout());
    const possibleBelow = Math.max(1, pivotFloor - minPayout);
    const pressure = possibleBelow > 0 ? span / possibleBelow : 0;

    return {
      span,
      sum,
      avg: count > 0 ? sum / count : 0,
      pressure
    };
  }

  function getRatioSlope(windowSize = 5) {
    const recent = RATIOS.slice(-windowSize);
    if (recent.length < 2) return 0;

    // Compute slope via least squares
    const n = recent.length;
    const sumX = (n * (n - 1)) / 2;
    const sumX2 = ((n - 1) * n * (2 * n - 1)) / 6;
    let sumY = 0;
    let sumXY = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = recent[i];
      sumY += y;
      sumXY += x * y;
    }

    const numerator = n * sumXY - sumX * sumY;
    const denominator = n * sumX2 - sumX * sumX;
    return denominator === 0 ? 0 : numerator / denominator;
  }

  function tryPlayRollAnnoucment(result) {
    if (!getPlayAlert()) return;
    if (result % getRollAnnoucmentMod() !== 0) return;
    playNumberAlert(result, "roll");
  }

  function tryPlayHitAnnouncement(result) {
    if (!getPlayAlert()) return;
    if (result < getAlertThreshold()) return;
    playNumberAlert(result, "hit");
  }

  function checkConditions(result) {
    if (!inRecoveryMode && getStopOnMaxLoss() && maxLossExceeded()) {
      enterRecovery("Max loss exceeded, entering recovery mode:", profit);
      return;
    }

    if (inRecoveryMode && recoveryDelta > 0) {
      exitRecovery(
        "Recovery successful, exiting recovery mode:",
        recoveryDelta
      );
      return;
    }

    if (getStopOnProfit() && profit >= getProfitTarget()) {
      halt(`Profit target hit ${profit.toFixed(4)}`, TARGET_HIT_SEQ);
      return;
    }

    if (getStopOnHitCount() && hitCount >= getHitCountTarget()) {
      halt(`Target hit ${hitCount} times`, TARGET_HIT_SEQ);
      return;
    }

    if (getStopOnMaxRolls() && rollCount >= getMaxRolls()) {
      halt("Max rolls hit");
      return;
    }

    if (
      getStopOnLosingStreak() &&
      losingStreak >= getPayout() * getLosingStreakMultiplier()
    ) {
      halt("Losing streak threshold hit");
      return;
    }

    if (result >= getMaxHaltTarget()) {
      halt(`Max halt target hit`);
      return;
    }

    if (getRecoveryMode()) {
      RECOVERY_TARGETS.forEach((entry) => {
        const payout = entry.payout;
        const streak = entry.streak;
        const threshold = payout * getRecoveryLosingStreakMultiplier();
        const winRateLow =
          entry.getWinRatePercentOfTeo(entry.getPayout() * 100) < 90;
        if (streak < 0 && winRateLow && Math.abs(streak) >= threshold) {
          halt(
            `Recovery Target ${payout} hit losing streak threshold ${streak}`
          );
          return;
        }
      });
    }

    if (getRiskOn()) return;

    if (
      rollCount > 100 &&
      totalRatio < -200 &&
      stats10median < 1.25 &&
      stats100median < 1.6 &&
      stats1000median < 1.9
    ) {
      halt(
        `[Medians below threshold] Median 10: ${stats10median}, Median 100: ${stats100median}, Median 1000: ${stats1000median}`
      );
      return;
    }

    if (rollCount > 100 && totalRatio < -200 && stats10variance < 0.05) {
      halt(`[Variance below threshold] Variance 10: ${stats10variance}`);
      return;
    }

    if (totalRatio <= -getMinimumTotalRatio()) {
      halt(`Minimum total ratio hit: ${totalRatio}`);
      return;
    }

    if (ratioSlope <= -getMinimumSlopeThreshold()) {
      halt(`Minimum slope threshold hit: ${ratioSlope}`);
      return;
    }

    for (let i = 0; i < WATCH_TARGETS.length; i++) {
      const entry = WATCH_TARGETS[i];

      const contextString = getPostStreakHalt() ? "previous" : "current";
      const streak = getPostStreakHalt()
        ? entry.getPreviousStreak()
        : entry.getStreak();
      const payout = entry.getPayout();
      const threshold = payout * getWatchLosingStreakMultiplier();
      const winRateLow = entry.getWinRatePercentOfTeo() < 100;

      if (winRateLow && streak < 0 && Math.abs(streak) >= threshold) {
        halt(
          `Target ${payout} hit ${contextString} losing streak threshold ${streak}`
        );
        break;
      }

      if (entry.isRiskOnReady()) {
        halt(`Target ${payout} in risk on ready condition`);
        break;
      }

      if (entry.isBelowWinRateThresholds()) {
        halt(
          `[Below win rate thresholds] Payout: ${entry.getPayout()}, Fast: ${entry.getWinRatePercentOfTeo(
            50
          )}, , Mid: ${entry.getWinRatePercentOfTeo(
            100
          )}, , Slow: ${entry.getWinRatePercentOfTeo(200)}`
        );
        break;
      }
    }
  }

  function halt(stopMessage, seq = STOP_HIT_SEQ) {
    if (getIsTestMode()) {
      mbc.stop();
    }
    console.log(stopMessage);
    $("#message").text(stopMessage);
    stopMessage = "";
    if (getPlayAlert()) playSequence(seq);

    if (!stopped) stopBetting();

    return;
  }

  function enterRecovery(stopMessage, seq = STOP_HIT_SEQ) {
    console.log(stopMessage);
    $("#recovery-mode").prop("checked", true);
    recoveryPL = 0;
    recoveryDelta = 0;
    profitAtRecoveryStart = profit;

    $("#message").text(stopMessage);
    $("#lows-ls-multiplier").val(7);

    setWager(0);

    stopMessage = "";

    $("#risk-on").prop("checked", false);
    $("#hit-count-target").val(1);
    return;
  }

  function exitRecovery(stopMessage, seq = STOP_HIT_SEQ) {
    $("#recovery-mode").prop("checked", false);
    recoveryPL = 0;
    profitAtRecoveryStart = 0;
    recoveryDelta = 0;
    setWager(0);
    halt(stopMessage, STOP_HIT_SEQ);
    stopMessage = "";
    return;
  }

  function updateUI() {
    updatePivotUI();

    $("#hit-count").text(hitCount);
    $("#roll-count").html(`${rollCount}`);

    $("#total-ratio")
      .html(`${totalRatio.toFixed(3)}`)
      .css({ backgroundColor: `${totalRatio < 0 ? "red" : "transparent"}` });

    $("#ratio-slope")
      .html(`${ratioSlope.toFixed(3)}`)
      .css({ backgroundColor: `${ratioSlope < 0 ? "red" : "transparent"}` });

    $("#win-rate").html(
      `${teo.toFixed(2)} | ${winRate.toFixed(2)} | ${(teo - winRate).toFixed(
        2
      )}`
    );
    $("#profit-loss")
      .html(profit.toFixed(4))
      .css({
        backgroundColor: `${
          profit > 0 ? "green" : profit < 0 ? "red" : "transparent"
        }`
      });

    recoveryDelta = recoveryPL + profitAtRecoveryStart;

    $("#recovery-profit-loss")
      .html(recoveryDelta.toFixed(4))
      .css({
        backgroundColor: `${
          recoveryDelta > 0
            ? "green"
            : recoveryDelta < 0
            ? "red"
            : "transparent"
        }`
      });

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
  }

  function getMaxRolls() {
    return Math.ceil(getMaxRollMultiplier() * getPayout());
  }

  function getStopOnMaxRolls() {
    return getMaxRollMultiplier() !== 0;
  }

  function getStopOnLosingStreak() {
    return getLosingStreakMultiplier() !== 0 && getRiskOn();
  }

  function getStopOnHitCount() {
    return getHitCountTarget() !== 0;
  }

  function getStopOnProfit() {
    return getProfitTarget() !== 0;
  }

  function getMaxHaltTarget() {
    if (!maxHaltTargetField) {
      maxHaltTargetField = $("#max-halt-target");
    }
    return Number(maxHaltTargetField.val());
  }

  function getHighModeTarget() {
    if (!highModeTargetField) {
      highModeTargetField = $("#high-mode-target");
    }
    return Number(highModeTargetField.val());
  }

  function getProfitTarget() {
    if (!profitTargetField) {
      profitTargetField = $("#profit-target");
    }
    return Number(profitTargetField.val());
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

  function getPlayAlert() {
    return $("#play-alert").prop("checked") && !stopped;
  }

  function getUseProgressiveWager() {
    return $("#use-progressive-wager").prop("checked");
  }

  function getResetHighHitOnBigHit() {
    return $("#reset-high-hit-on-big-hit").prop("checked");
  }

  function getPostStreakHalt() {
    return $("#post-streak-halt").prop("checked");
  }

  function getRecoveryMode() {
    return !getRiskOn() && $("#recovery-mode").prop("checked");
  }

  function getResetOnStart() {
    return $("#reset-on-start").prop("checked");
  }

  function getAlertThreshold() {
    if (!alertThresholdField) {
      alertThresholdField = $("#high-hit-alert-threshold");
    }
    return Number(alertThresholdField.val());
  }

  function getRollAnnoucmentMod() {
    if (!rollModField) {
      rollModField = $("#roll-announcement-mod");
    }
    return Number(rollModField.val());
  }

  function getRollAnnoucmentMod() {
    if (!rollModField) {
      rollModField = $("#roll-announcement-mod");
    }
    return Number(rollModField.val());
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

  function getMaxRollMultiplier() {
    if (!maxRollField) {
      maxRollField = $("#max-rolls-multiplier");
    }
    return Number(maxRollField.val());
  }

  function getWatchLosingStreakMultiplier() {
    if (!watchLsField) {
      watchLsField = $("#watch-ls-multiplier");
    }
    return Number(watchLsField.val());
  }

  function getMinimumTotalRatio() {
    if (!mtrField) {
      mtrField = $("#minimum-total-ratio");
    }
    return Number(mtrField.val());
  }

  function getMinimumSlopeThreshold() {
    if (!mstField) {
      mstField = $("#minimum-slope-threshold");
    }
    return Number(mstField.val());
  }

  function getFastRateThreshold() {
    if (!fastWinRateThresholdField) {
      fastWinRateThresholdField = $("#fast-win-rate-threshold");
    }
    return Number(fastWinRateThresholdField.val());
  }

  function getMidRateThreshold() {
    if (!midWinRateThresholdField) {
      midWinRateThresholdField = $("#mid-win-rate-threshold");
    }
    return Number(midWinRateThresholdField.val());
  }

  function getSlowRateThreshold() {
    if (!slowWinRateThresholdField) {
      slowWinRateThresholdField = $("#slow-win-rate-threshold");
    }
    return Number(slowWinRateThresholdField.val());
  }
  function getLosingStreakMultiplier() {
    if (!lsField) {
      lsField = $("#ls-multiplier");
    }
    return Number(lsField.val());
  }

  function getRecoveryLosingStreakMultiplier() {
    if (!recoveryLsField) {
      recoveryLsField = $("#lows-ls-multiplier");
    }
    return Number(recoveryLsField.val());
  }

  function getHighHitThreshold() {
    if (!highHitThresholdField) {
      highHitThresholdField = $("#high-hit-threshold");
    }
    return Number(highHitThresholdField.val());
  }

  function initWindowEvents() {
    $("#set-risk-on-btn").click(function () {
      $("#set-risk-on-btn").hide();
      $("#set-risk-off-btn").show();
      setWager(getScaledWager());
      $("#risk-on").prop("checked", true);
      $("#hit-count-target").val(1);
      $("#profit-target").val(0.01);
    });

    $("#set-risk-off-btn").click(function () {
      $("#set-risk-on-btn").show();
      $("#set-risk-off-btn").hide();
      $("#risk-on").prop("checked", false);
      $("#hit-count-target").val(0);
      $("#profit-target").val(0);
      setWager(0);
    });

    $("#double-wager-btn").click(function () {
      setWager(Math.min(1, getWager() * 2));
    });

    $("#half-wager-btn").click(function () {
      setWager(Math.max(0.0001, getWager() / 2));
    });

    $("#configure-high-roll-btn").click(function () {
      $("#risk-on").prop("checked", false);
      $("#hit-count-target").val(1);
      $("#watch-ls-multiplier").val(8);
      $("#ls-multiplier").val(0.5);
      $("#profit-target").val(0);

      $("#max-loss").val(getDynamicMaxLoss());
      setPayout(getHighModeTarget());
      setWager(0.0001);
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

    populateTargets();
  }

  function populateTargets() {
    class Stats {
      constructor(payout, size) {
        this.payout = payout;
        this.rollCount = 0;
        this.size = size;
        this.teo = 1 / (this.getPayout() * 1.04);
        this.streak = 0;
        this.pstreak = 0;
        this.losingStreak = 0;
        this.results = [];
      }

      push(result) {
        this.updateStats(result);
      }

      updateStats = (result) => {
        this.rollCount++;
        const hit = result >= this.payout;

        if (this.results.length === this.size) this.results.shift();

        this.results.push(hit ? 1 : 0);

        if (result >= this.payout) {
          this.hitCount++;
          if (this.streak < 0) {
            this.pstreak = this.streak;
          }
          this.streak = Math.max(this.streak + 1, 1);
        } else {
          if (this.streak > 0) {
            this.pstreak = this.streak;
          }
          this.streak = Math.min(this.streak - 1, -1);
        }

        this.losingStreak = this.streak < 0 ? this.streak : 0;
      };

      getRollCount = () => this.rollCount;

      getWinRate(lookback = this.results.length) {
        const data = this.getHitData(lookback);
        return data.sum / data.len;
      }

      getHitData(lookback = this.results.length) {
        const data = this.results.slice(-lookback);
        if (data.length === 0) return 0;
        const sum = data.reduce((sum, val) => sum + val, 0);
        const len = data.length;
        return { sum, len };
      }

      getHitCount(lookback = this.results.length) {
        return this.getHitData(lookback).sum;
      }

      calculateWinRatePercentOfTeo(winRate) {
        return (winRate / 100 / this.getTeo()) * 100;
      }

      getExpectedHits(lookback) {
        return lookback / this.payout;
      }

      getStreak = () => this.streak;
      getLosingStreak = () => (this.streak >= 0 ? 0 : Math.abs(this.streak));
      getStreakDiff = () => this.streak + this.payout;
      getRatio = () => this.getStreakDiff() / this.payout;
      getWinRatePercentOfTeo(lookback = 100) {
        return (this.getWinRate(lookback) / this.getTeo()) * 100;
      }
      getPayout = () => this.payout;
      getTeo = () => this.teo;
    }

    class Target {
      constructor(payout, size = 1000) {
        this.payout = payout;
        this.stats = new Stats(payout, size);
        this.nextTarget = null;
        this.previousTarget = null;
      }

      getPayout() {
        return this.payout;
      }

      setNextTarget = (t) => (this.nextTarget = t);

      setPreviousTarget = (t) => (this.previousTarget = t);

      getPreviousTarget = () => this.previousTarget;

      getNextTarget = () => this.nextTarget;

      push(result) {
        this.stats.push(result);
      }

      streakExceedsThreshold = (t) => this.getLosingStreak() >= this.getPayout() * t;

      // From stats class
      getRatio = () => this.stats.getRatio();
      getStreakDiff = () => this.stats.getStreakDiff();
      getStreak = () => this.stats.getStreak();
      getLosingStreak = () => this.stats.getLosingStreak();
      getTeo = () => this.stats.getTeo();
      getHitCount = () => this.stats.getHitCount();
      getRollCount = () => this.stats.getRollCount();
      getWinRatePercentOfTeo = (lookback = 100) =>
        this.stats.getWinRatePercentOfTeo(lookback);

      // End from stats class

      dynamicStreakThreshold(baseThreshold = 10) {
        const winRatePct = this.getWinRatePercentOfTeo(100);

        // High win rate → longer streak required
        // Low win rate → shorter streak allowed
        let scale = winRatePct / 100;

        // Clamp between 0.5x and 2x for safety
        scale = Math.max(0.5, Math.min(2, scale));

        return Math.floor(baseThreshold * scale);
      }

      preflightPassed() {
        return false; // Temporarily disable
        return this.getRollCount() >= (this.payout * 100);
      }

      isRiskOnReady() {
        if (!this.preflightPassed()) return;
        return (
          this.streakExceedsThreshold(8) &&
          this.getWinRatePercentOfTeo(10 * this.getPayout()) < 2 &&
          this.getWinRatePercentOfTeo(50 * this.getPayout()) < 40 &&
          this.getWinRatePercentOfTeo(100 * this.getPayout()) < 80
        );
      }
      isBelowWinRateThresholds() {
        if (!this.preflightPassed()) return;
        return (
          this.getWinRatePercentOfTeo(50) < getFastRateThreshold() &&
          this.getWinRatePercentOfTeo(100) < getMidRateThreshold() &&
          this.getWinRatePercentOfTeo(200) < getSlowRateThreshold()
        );
      }
    }

    WATCH_TARGETS = generateWatchPayouts().map((payout) => new Target(payout));

    for (let i = 0; i < WATCH_TARGETS.length; i++) {
      const current = WATCH_TARGETS[i];
      const next = WATCH_TARGETS[i + 1] || null;
      const prev = WATCH_TARGETS[i - 1] || null;

      current.setNextTarget(next);
      current.setPreviousTarget(prev);
    }

    RECOVERY_TARGETS = generateRecoveryPayouts().map(
      (payout) => new Target(payout)
    );
  }

  function generateWatchPayouts() {
    // const a1 = Array.from(
    //   {
    //     length: 3
    //   },
    //   (v, k) => parseFloat((1.7 + k * 0.1).toFixed(2))
    // );

    const a2 = Array.from(
      {
        length: 99
      },
      (v, k) => 2 + k * 1
    );

    return a2;

    const a3 = [
      200,
      300,
      400,
      500,
      1000,
      2000,
      3000,
      4000,
      5000,
      10000,
      25000,
      50000,
      100000,
      500000,
      1000000
    ];

    return [...a1, ...a2, ...a3];
  }
  function generateRecoveryPayouts() {
    return Array.from(
      {
        length: 53
      },
      (v, k) => 1.5 + k * 0.01
    );
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

  function getDynamicMaxLoss() {
    return getBalance() * 0.0025;
  }

  function getBalance() {
    let rawText = $(".ml-3 .font-extrabold").text().trim();
    return parseFloat(rawText.replace(/[^\d.]/g, ""));
  }

  // Utility function: Get current roll data
  function getCurrentRollData() {
    return $(".grid.grid-auto-flow-column div span")
      .map(function () {
        return $(this).text();
      })
      .get();
  }

  function calculateTeo(payout) {
    return 1 / (payout * 1.04);
  }

  // Function to start the betting process
  function startBetting() {
    if (firstLoad || getResetOnStart()) {
      firstLoad = false;
      rollCount = 0;
      highHit = 0;
      highHitLosingStreak = 0;
      highHitRound = 0;
    }

    if (!inRecoveryMode) {
      profit = 0;
      profitAtRecoveryStart = 0;
      recoveryDelta = 0;
      recoveryPL = 0;
    }

    hitCount = 0;
    losingStreak = 0;
    stopped = false;
    doBet(); // Start the async loop
  }

  function stopBetting() {
    stopped = true;
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
    if (getIsTestMode()) {
      $("#wager").val(amount);
      return;
    }

    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Amount")'
    );
    const inputField = payoutFieldGroup.find("input");

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

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function doInit() {
    observeRollChanges();
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

    return new RollingStats(1000);
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

  doInit();

  function injectControlPanel() {
    if (getIsTestMode()) return;
    $("<style>")
      .prop("type", "text/css")
      .html(
        `
            #control-panel-header, #stats-panel-header {
                background: #333;
                padding: 12px;
                font-weight: bold;
                text-align: center;
                border-radius: 8px 8px 0 0;
                font-size: 16px;
                cursor: grab;
            }

            #control-panel, #stats-panel {
                position: fixed;
                top: 200px;
                right: 100px;
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
                height: 800px;
                overflow: scroll;
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
                    .stats-block-top {
margin-top: 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      padding-top: 5px;
      }
                    .stats-block {
      margin-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      padding-bottom: 5px;
      }
      #watch-target-table th,
      #watch-target-table td {
        text-align: left;
      }

        `
      )
      .appendTo("head");
    let controlPanel = `<div id="control-panel" style="
   position: fixed;
   top: 300px;
   left: 0px;
   z-index: 9999;
   background: #1e1e1e;
   color: #fff;
   padding: 16px;
   width: 400px;
   border-radius: 10px;
   box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
   font-family: Arial, sans-serif;
   font-size: 14px;
   line-height: 1.6;
   cursor: grab;
   ">
   <div id="control-panel-header" style="
      background: #333;
      padding: 10px;
      font-weight: bold;
      text-align: center;
      border-radius: 8px 8px 0 0;
      cursor: grab;
      ">⚙️ Control Panel</div>
   <div id="message" class="message-box" style="
      margin: 12px 0;
      background-color: #444;
      padding: 10px;
      border-radius: 6px;
      color: white;
      font-size: 0.9rem;
      text-align: center;
      "></div>

   <div class="button-group">
      <button id="start-betting-btn">Start Betting</button>
      <button id="stop-betting-btn" style="display: none;">Stop Betting</button>
      <button id="set-risk-on-btn" style="display: none;">Risk On</button>
      <button id="set-risk-off-btn">Risk Off</button>
      <button id="configure-high-roll-btn">Configure High Roll</button>
   </div>
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
      <div>Recovery Profit / Loss: <span id="recovery-profit-loss"></span></div>
      <div>Roll Count: <span id="roll-count"></span></div>
      <div>Hit Count: <span id="hit-count"></span></div>
      <div>High Hit: <span id="high-hit"></span></div>
      <div>Win Rate: <span id="win-rate"></span></div>
      <div>Total Ratio: <span id="total-ratio"></span></div>
      <div>Ratio Slope: <span id="ratio-slope"></span></div>
   <div class="stats-block stats-block-top">
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
<div id="pivot-info" style="margin-bottom:10px; font-weight:bold;"></div>

<div style="margin-bottom:5px;">
  <span style="font-weight:bold; color:#a00;">Pressure Below Pivot</span>
</div>

<!-- pressure bar -->
<div id="pressure-bar" style="
  width: 100%;
  height: 20px;
  border-radius: 4px;
  background: linear-gradient(to right, green, yellow, red);
  position: relative;">
  <div id="pressure-fill" style="
    height: 100%;
    width: 0%;
    background: rgba(0,0,0,0.4);
    border-radius: 4px;">
  </div>
</div>

<!-- span blocks -->
<div id="pressure-span" style="margin-top:6px; display:flex; gap:3px;"></div>

   <div class="control-group">
      <label>Play Alert</label>
      <input id="play-alert" type="checkbox" checked/>
   </div>
   <div class="control-group">
      <label>Risk On</label>
      <input id="risk-on" type="checkbox"/>
   </div>

   <div class="control-group">
      <label>Recovery Mode</label>
      <input id="recovery-mode" type="checkbox"/>
   </div>
   <div class="control-group">
      <label>Hit Count Target</label>
      <input type="number" id="hit-count-target" value="0"  />
   </div>
   <div class="control-group">
      <label>Profit Target</label>
      <input type="number" id="profit-target" value="0"  />
   </div>
   <div class="control-group">
      <label>Risk On Losing Streak Multiplier</label>
      <select id="ls-multiplier" >
         <option value="0" selected>0</option>
         <option value="0.05">0.05</option>
         <option value="0.1">0.1</option>
         <option value="0.2">0.2</option>
         <option value="0.3">0.3</option>
         <option value="0.4">0.4</option>
         <option value="0.5" selected>0.5</option>
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
         <option value="8" >8</option>
         <option value="8.5">8.5</option>
         <option value="9">9</option>
         <option value="9.5">9.5</option>
         <option value="10">10</option>
         <option value="10.5">10.5</option>
         <option value="11">11</option>
         <option value="11.5">11.5</option>
         <option value="12">10</option>
         <option value="12.5">12.5</option>
         <option value="13">13</option>
         <option value="13.5">13.5</option>
         <option value="14">14</option>
         <option value="14.5">14.5</option>
         <option value="15">10</option>
      </select>
   </div>
   <div class="control-group">
      <label>Watch Losing Streak Multiplier</label>
      <select id="watch-ls-multiplier" >
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
         <option value="6.5" >6.5</option>
         <option value="7">7</option>
         <option value="7.5">7.5</option>
         <option value="8">8</option>
         <option value="8.5">8.5</option>
         <option value="9" selected>9</option>
         <option value="9.5">9.5</option>
         <option value="10">10</option>
         <option value="10.5">10.5</option>
         <option value="11">11</option>
         <option value="11.5">11.5</option>
         <option value="12">10</option>
         <option value="12.5">12.5</option>
         <option value="13">13</option>
         <option value="13.5">13.5</option>
         <option value="14">14</option>
         <option value="14.5">14.5</option>
         <option value="15">10</option>
      </select>
   </div>
   <div class="control-group">
      <label>Lows Losing Streak Multiplier</label>
      <select id="lows-ls-multiplier" >
         <option value="2">2</option>
         <option value="2.5">2.5</option>
         <option value="3">3</option>
         <option value="3.5">3.5</option>
         <option value="4">4</option>
         <option value="4.5">4.5</option>
         <option value="5" selected>5</option>
         <option value="5.5">5.5</option>
         <option value="6">6</option>
         <option value="6.5" >6.5</option>
         <option value="7">7</option>
         <option value="7.5">7.5</option>
         <option value="8">8</option>
         <option value="8.5">8.5</option>
         <option value="9">9</option>
         <option value="9.5" selected>9.5</option>
         <option value="10">10</option>
         <option value="10.5">10.5</option>
         <option value="11">11</option>
         <option value="11.5">11.5</option>
         <option value="12">10</option>
         <option value="12.5">12.5</option>
         <option value="13">13</option>
         <option value="13.5">13.5</option>
         <option value="14">14</option>
         <option value="14.5">14.5</option>
         <option value="15">10</option>
      </select>
   </div>
      <div class="control-group">
      <label>Minimum Total Ratio</label>
      <input type="number" id="minimum-total-ratio" step="25" value="300">
   </div>

   <div class="control-group">
      <label>Minimum Slope Threshold</label>
      <select id="minimum-slope-threshold" >
         <option value="10">10</option>
         <option value="15">15</option>
         <option value="20">20</option>
         <option value="25">25</option>
         <option value="30">30</option>
          <option value="35">35</option>
         <option value="40">40</option>
         <option value="45">45</option>
         <option value="50" selected>50</option>
         <option value="55">55</option>
         <option value="60">60</option>
         <option value="65">65</option>
         <option value="70">70</option>
         <option value="75">75</option>
         <option value="80">80</option>
         <option value="85">85</option>
         <option value="90">90</option>
         <option value="95">95</option>
         <option value="100">100</option>
      </select>
   </div>
   <div class="control-group">
      <label>Post Streak Halt</label>
      <input id="post-streak-halt" type="checkbox"/>
   </div>
   <div class="control-group">
      <label>Alert Threshold</label>
      <input type="number" id="high-hit-alert-threshold" value="10000"  />
   </div>
   <div class="control-group">
      <label>Roll Annoucement Mod</label>
      <input type="number" id="roll-announcement-mod" value="10000"  />
   </div>
   <div class="control-group">
      <label>Reset On Start</label>
      <input id="reset-on-start" type="checkbox"/>
   </div>
   <div class="control-group">
      <label>Reset High Hit on Big Hit</label>
      <input id="reset-high-hit-on-big-hit" type="checkbox" checked/>
   </div>
   <div class="control-group">
      <label>Use Progressive Wager</label>
      <input id="use-progressive-wager" type="checkbox"/>
   </div>
   <div class="control-group">
      <label>Max Loss</label>
      <input type="number" id="max-loss" value="0"  />
   </div>
   <div class="control-group">
      <label>High Hit Reset Threshold</label>
      <input type="number" id="high-hit-reset-threshold" value="100"  />
   </div>

   <div class="control-group">
      <label>High Hit Threshold</label>
      <select id="high-hit-threshold"  >
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
         <option value="6.5" >6.5</option>
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
      <label>Max Rolls Multiplier</label>
      <select id="max-rolls-multiplier"  >
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
         <option value="6.5" >6.5</option>
         <option value="7">7</option>
         <option value="7.5">7.5</option>
         <option value="8">8</option>
         <option value="8.5">8.5</option>
         <option value="9">9</option>
         <option value="9.5">9.5</option>
         <option value="10">10</option>
      </select>
   </div>

     <div class="control-group">
      <label>Fast Win Rate Threshold</label>
      <select id="fast-win-rate-threshold" >
         <option value="20">20</option>
         <option value="20">20</option>
         <option value="30">30</option>
         <option value="40" selected>40</option>
         <option value="50">50</option>
         <option value="60">60</option>
         <option value="70">70</option>
         <option value="80">80</option>
         <option value="90">90</option>
         <option value="100">100</option>
      </select>
      </div>

     <div class="control-group">
      <label>Mid Win Rate Threshold</label>
      <select id="mid-win-rate-threshold" >
         <option value="20">20</option>
         <option value="20">20</option>
         <option value="30">30</option>
         <option value="40" selected>40</option>
         <option value="50">50</option>
         <option value="60">60</option>
         <option value="70">70</option>
         <option value="80">80</option>
         <option value="90">90</option>
         <option value="100">100</option>
      </select>
      </div>


           <div class="control-group">
      <label>Slow Win Rate Threshold</label>
      <select id="slow-win-rate-threshold" >
         <option value="20">20</option>
         <option value="20">20</option>
         <option value="30">30</option>
         <option value="40" selected>40</option>
         <option value="50">50</option>
         <option value="60">60</option>
         <option value="70">70</option>
         <option value="80">80</option>
         <option value="90">90</option>
         <option value="100">100</option>
      </select>
      </div>
   <div class="control-group">
      <label>Max Halt Target</label>
      <input type="number" id="max-halt-target" value="100000"  />
   </div>
      <div class="control-group">
      <label>High Mode Target</label>
      <input type="number" id="high-mode-target" value="1000000"  />
   </div>
</div>`;

    $("body").prepend(controlPanel);
  }
  // Initialize MutationObserver
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
