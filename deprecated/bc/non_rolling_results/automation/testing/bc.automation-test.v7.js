/* Start Script */
// ==UserScript==
// @name         bc.game automation v7
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
  const RATIOS = [];
  let totalRatio = 0;
  let ratioSlope = 0;

  const compressionZone = generateCompressionZone();
  const ratioWatch = generateRatioWatch();

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
  let cycleProfit = 0;
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
  let compressedRatioField = null;
  let extremeCompressedRatioField = null;
  let mstField = null;
  let mtrField = null;
  let watchLsField = null;
  let recoveryLsField = null;

  let highHit = 0;
  let highHitRound = 0;
  let highHitLosingStreak = 0;


  /* Automation */ 
  let isRiskOn = false;
  let riskOnPayout = 0;
  let riskOnWager = 0;
  let riskOnTarget = null;
 

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

    // if (result >= payout) {
    //   losingStreak = 0;
    //   hitCount++;
    //   profit += payout * getWager() - getWager();
    //   if (inRecoveryMode) {
    //     recoveryPL += payout * getWager() - getWager();
    //   }
    // } else {
    //   losingStreak++;
    //   profit -= getWager();
    //   if (inRecoveryMode) {
    //     recoveryPL -= getWager();
    //   }
    // }

    winRate = hitCount / rollCount;
    teo = calculateTeo(payout);

    processResult(result);
    tryPlayRollAnnoucment(rollCount);
    tryPlayHitAnnouncement(result);


  
    if (!riskOnTarget) {    
      riskOnTarget = getRiskSignal(2, 4);
    }

    if (riskOnTarget) {
        if (isRiskOn) {
            handleRiskOnResult(result);
        } else {
            goRiskOn();
        }
    }

    updateUI();
  }


  function handleRiskOnResult(result) {
    const wager = getWager();
    const payout = getPayout();
    let isHit = false;

    if (result >= payout) {
console.log("HIT: Handling risk on result", result, wager, payout)
        const p = wager * payout - wager;
        profit += p
        cycleProfit += p;
  //      riskOnWager = getScaledWager();
    } else {
        profit -= wager;
        cycleProfit -= wager;
        // riskOnWager = wager * 2;
//        riskOnWager = getScaledWager();
console.log("MISS: Handling risk on result", result, wager, payout)
    }


    const testTarget = getRiskSignal(2)
    
    if (cycleProfit > 0) {
        goRiskOff();
    }
    //  else {
    //     setWager(riskOnWager);
    // }
  }

  function goRiskOn() {
    isRiskOn = true;
    cycleProfit = 0;
    riskOnPayout = riskOnTarget.getPayout();
    setPayout(riskOnPayout);
    riskOnWager = getScaledWager();

    setWager(riskOnWager);
  }


  function goRiskOff() {
    console.log("GOING RISK OFF", profit)
    setPayout(1.01);
    setWager(0);
    cycleProfit = 0;
    riskOnTarget = null;
    isRiskOn = false;
  }

  function getRiskSignal(payout, threshold) {
    const target = WATCH_TARGETS.find((t) => t.payout === payout);
    if (!target) return "NO DATA";

    // look only ABOVE
    const overhead = WATCH_TARGETS.filter((t) => t.payout > payout && t.payout <= payout + 5);

    const pressure = (t) => (t.getLosingStreakAbs() >= 2 * t.payout ? 1 : 0); // placeholder

    const allyCover = overhead.reduce((sum, q) => sum + pressure(q), 0);

    if (rollCount % 100 === 0) {
        console.log("allyCover count", allyCover);
    }

    if (allyCover < threshold) return;
    
    console.log("risk-on (covered)", allyCover);

    return target;
  }

  function recordRoll() {
    const now = Date.now();

    if (rollStartTime === null) {
      rollStartTime = now;
    }

    rollCount++;
  }

  function getRollsPerSecond() {
    if (rollStartTime === null || rollCount === 0) return "0.00";

    const elapsedSeconds = (Date.now() - rollStartTime) / 1000;
    return (rollCount / elapsedSeconds).toFixed(2);
  }

  function processResult(result) {
    totalRatio = 0;

    let zoneNumber = 0;
    let incrementZone = true;

    WATCH_TARGETS.forEach((target) => {
      target.addResult(result, zoneNumber);

      if (target.getIsCompressed()) {
        target.setCompressionZone(zoneNumber);
        incrementZone = true;
      } else if (incrementZone) {
        zoneNumber++;
        incrementZone = false;
      }

      totalRatio += target.getRatio();
    console.log(`Target = ${target.getPayout()}, isCompressed: ${target.getIsCompressed()}, "CompressionZone: ${target.compressionZone}`)
    });


    RECOVERY_TARGETS.forEach((target) => {
      target.addResult(result);
    });

    if (RATIOS.length === 50) RATIOS.shift();
    RATIOS.push(totalRatio);
    ratioSlope = getRatioSlope();
    compressionZone.tryProcessCompression(
      WATCH_TARGETS,
      getCompressedRatio(),
      getExtremeCompressedRatio()
    );
    ratioWatch.push(totalRatio, result);
    ratioWatch.logTable();
  }

  function getRecoveryFlips() {
    const totalRatio = -3;

    if (totalRatio >= 0) return { flipsRequired: 0, targets: [] };

    // Step 1: Filter negative targets and sort by absolute ratio descending
    const negativeTargets = WATCH_TARGETS.filter((t) => t.getRatio() < 0).sort(
      (a, b) => Math.abs(b.getRatio()) - Math.abs(a.getRatio())
    );

    let simulatedTotal = totalRatio;
    const flipTargets = [];

    for (const target of negativeTargets) {
      const r = target.getRatio();
      simulatedTotal += Math.abs(r) * 2; // flipping -X to +X adds 2X
      flipTargets.push(target);

      if (simulatedTotal >= 0) break;
    }

    return {
      targetsRequiredForRecovery: flipTargets.length,
      targets: flipTargets,
      buoyTarget: flipTargets[flipTargets.length - 1] || null
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
        const winRateLow = entry.getWinRatePercentOfTeo() < 100;
        if (streak < 0 && winRateLow && Math.abs(streak) >= threshold) {
          halt(
            `Recovery Target ${payout} hit losing streak threshold ${streak}`
          );
          return;
        }
      });
    }

    if (getRiskOn()) return;

    if (compressionZone.isReady()) {
      if (rollCount % 1000 === 0) {
        console.clear();
      }
      halt(compressionZone.getHaltMessage());
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

    WATCH_TARGETS.filter((t) => t.payout >= 5).forEach((entry) => {
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
        return;
      }

      if (entry.isExtremeCompressed() && Math.abs(streak) >= payout * 7.5) {
        halt(
          `Target ${payout} hit losing streak threshold ${streak} while in extreme compression`
        );
        return;
      }
    });
  }

  function halt(stopMessage, seq = STOP_HIT_SEQ) {
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
    $("#lows-ls-multiplier").val(5);

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

  function logTargetsTable() {
    const table = WATCH_TARGETS.map((t) => ({
      Payout: t.payout + "x",
      "⚠️ Parabolic": t.isParabolicZone() ? "YES" : ""
    }));
    console.table(table);
  }

  function updateUI() {

    $("#roll-count").html(`${rollCount}`);

    $("#profit-loss")
      .html(`${profit.toFixed(4)} | ${cycleProfit.toFixed(4)}`)
      .css({
        backgroundColor: `${
          profit > 0 ? "green" : profit < 0 ? "red" : "transparent"
        }`
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
    return $("#recovery-mode").prop("checked");
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

  function getCompressedRatio() {
    if (!compressedRatioField) {
      compressedRatioField = $("#compressed-ratio");
    }
    return Number(compressedRatioField.val());
  }

  function getExtremeCompressedRatio() {
    if (!extremeCompressedRatioField) {
      extremeCompressedRatioField = $("#extreme-compressed-ratio");
    }
    return Number(extremeCompressedRatioField.val());
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
      $("#watch-ls-multiplier").val(7);
      $("#ls-multiplier").val(7);
      $("#recovery-mode").prop("checked", true);
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
      containment: "window",
      scroll: false
    });

    $("#stats-panel").draggable({
      containment: "window",
      scroll: false
    });

    populateTargets();
  }

  function populateTargets() {
    class Stats {
      constructor(size, payout) {
        this.size = size;
        this.payout = payout;
        this.streak = 0;
        this.pstreak = 0;
        this.hitCount = 0;
        this.losingStreak = 0;
        this.buffer = new Array(size).fill(null);
        this.index = 0;
        this.count = 0;
        this.sum = 0;
        this.rollCount = 0;
      }

      push = (result) => {
        this.rollCount++;
        this.updateStreak(result);
        const isHit = result >= this.payout ? 1 : 0;

        if (this.count >= this.size) {
          const old = this.buffer[this.index];
          this.sum -= old ?? 0;
        } else {
          this.count++;
        }

        this.buffer[this.index] = isHit;
        this.sum += isHit;
        this.index = (this.index + 1) % this.size;
      };

      updateStreak = (result) => {
        if (result >= this.payout) {
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

        this.losingStreak = this.streak < 0 ? this.streak : 0;
      };

      getRate = (lookbackM = this.count) => {
        const lastN = Math.ceil(lookbackM * this.payout);
        const count = Math.min(lastN, this.count);
        if (count === 0) return 0;

        let sum = 0;
        const start = (this.index - count + this.size) % this.size;
        for (let i = 0; i < count; i++) {
          const idx = (start + i + this.size) % this.size;
          sum += this.buffer[idx] ?? 0;
        }
        return sum / count;
      };

      //      getWinRate = (lookbackM = 50) => this.getRate(lookbackM);
      getWinRate = () => this.getFullWinRate();
      getWinRatePercentOfTeo() {
        return (this.getFullWinRate() / this.getTeo()) * 100;
      }
      getFullWinRate = () => this.hitCount / this.rollCount;
      getTeo = () => 1 / (this.getPayout() * 1.04);

      getSum = (lastN = this.count) => {
        const count = Math.min(lastN, this.count);
        if (count === 0) return 0;

        let sum = 0;
        const start = (this.index - count + this.size) % this.size;
        for (let i = 0; i < count; i++) {
          const idx = (start + i + this.size) % this.size;
          sum += this.buffer[idx] ?? 0;
        }
        return sum;
      };

      getWinRate = () => this.hitCount / this.rollCount;
      getTeo = () => 1 / (this.getPayout() * 1.04);
      getHitCount = () => this.hitCount;
      getRollCount = () => this.rollCount;
      getStreak = () => this.streak;
      getPreviousStreak = () => this.pstreak;
      getLosingStreak = () => this.losingStreak;
      getPayout = () => this.payout;
      getStreakDiff = () => this.streak + this.payout;
      getRatio = () => this.getStreakDiff() / this.payout;
    }

    class ScalarStats {
      constructor(payout) {
        this.rollCount = 0;
        this.payout = payout;
        this.streak = 0;
        this.pstreak = 0;
        this.hitCount = 0;
        this.losingStreak = 0;
      }

      push = (result) => {
        this.rollCount++;
        this.updateStreak(result);
      };

      updateStreak = (result) => {
        if (result >= this.payout) {
          this.hitCount++;
          this.globalHits++;
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

      getWinRatePercentOfTeo() {
        return (this.getWinRate() / this.getTeo()) * 100;
      }

      getSum = () => this.hitCount;
      getWinRate = () => this.hitCount / this.rollCount;
      getTeo = () => 1 / (this.getPayout() * 1.04);
      getHitCount = () => this.hitCount;
      getRollCount = () => this.rollCount;
      getStreak = () => this.streak;
      getPreviousStreak = () => this.pstreak;
      getLosingStreak = () => this.losingStreak;
      getPayout = () => this.payout;
      getStreakDiff = () => this.streak + this.payout;
      getRatio = () => this.getStreakDiff() / this.payout;
    }

    class Target {
      constructor(payout, baseBet = 1, lookbacks = [20, 50, 200]) {
        this.payout = payout;
        this.stats =
          this.payout <= 96 ? new Stats(100, payout) : new ScalarStats(payout);
        this.teo = 1 / (this.payout * 1.05); // Adjusted for edge
        this.streak = 0;
        this.pstreak = 0;
        this.hitCount = 0;
        this.rollCount = 0;
        this.globalHits = 0;
        this.globalRolls = 0;
        this.lossesSoFar = 0;
        this.baseBet = baseBet;
        this.isCompressed = false;
        this.isExtremeCompressed = false;
        this.compressionZone = null;
      }

      getPayout() {
        return this.payout;
      }

      addResult(result) {
        this.rollCount++;

        this.stats.push(result);
        this.updateStats(result);
      }

      updateStats(result) {
        this.globalRolls++;
        this.rollCount++;

        if (result >= this.payout) {
          this.hitCount++;
          this.globalHits++;
          if (this.streak < 0) this.pstreak = this.streak;
          this.streak = Math.max(this.streak + 1, 1);
        } else {
          if (this.streak > 0) this.pstreak = this.streak;
          this.streak = Math.min(this.streak - 1, -1);
        }
      }

      isParabolicZone() {
        const expected = this.payout;
        const streak = this.losingStreak;

        // (a) streak multiplier rule
        const streakTrigger = streak >= 3 * expected;

        // (b) Wilson bound test
        const p = 1 / this.payout;
        const n = this.globalRolls;
        const x = this.globalHits;
        let wilsonTrigger = false;
        if (n > 10) {
          const phat = x / n;
          const z = 1.96; // 95% CI
          const wilsonLB =
            (phat +
              (z * z) / (2 * n) -
              z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * n)) / n)) /
            (1 + (z * z) / n);
          wilsonTrigger = wilsonLB < p;
        }

        // (c) EMA collapse
        const emaTrigger = this.getWinRate() < (100 / this.payout) * 0.5;

        return streakTrigger || wilsonTrigger || emaTrigger;
      }

      getRatio = () => this.stats.getRatio();
      getLosingRatio() {
        const ratio = this.getRatio();
        if (ratio >= 0) return 0;
        return Math.abs(ratio);
      }
      getDiff = () => this.stats.streak + this.payout;
      
      setCompressionLevels(normalCompression = 3, heavyCompression = 5) {
        this.isCompressed = this.getLosingRatio() >= normalCompression && this.getWinRatePercentOfTeo() < 100
        this.isHeavyCompressed = this.isCompressed && this.getLosingRatio() >= heavyCompression
      }

      setCompressionZone(zone) {
        this.compressionZone = zone;
      }

      getIsExtremeCompressed = () => this.isHeavyCompressed
      getIsCompressed = () => this.isCompressed


      getStreak = () => this.streak;
      getLosingStreak = () => (this.streak < 0 ? this.streak : 0);
      getLosingStreakAbs = () => Math.abs(this.getLosingStreak())
      getTeo = () => this.teo;
      getHitCount = () => this.hitCount;
      getRollCount = () => this.rollCount;
      getWinRatePercentOfTeo = () => this.stats.getWinRatePercentOfTeo();
      getWinRate = () => this.stats.getWinRate();
      getHTMLID = () =>
        this.payout
          .toString()
          .replace(/\./g, "_")
          .replace(/[^\w-]/g, "");
    }

    WATCH_TARGETS = generateWatchPayouts().map((payout) => new Target(payout));
    RECOVERY_TARGETS = generateRecoveryPayouts().map(
      (payout) => new Target(payout)
    );
  }

  function generateWatchPayouts() {
    const a1 = Array.from(
      {
        length: 10
      },
      (v, k) => parseFloat((1.1 + k * 0.1).toFixed(2))
    );

    const a2 = Array.from(
      {
        length: 99
      },
      (v, k) => 2 + k * 1
    );

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

  function generateRatioWatch() {
    class RatioWatch {
      constructor() {
        this.ratio = 0;
        this.minRatio = 0;
        this.shouldPrint = false;
        this.popHistory = [];
      }

      push(ratio, result) {
        if (this.isCrossToPositive(ratio)) {
          this.addNegativeToPositiveRecord(ratio, result);
        }
        this.ratio = ratio;
        this.minRatio = Math.min(this.ratio, ratio);
      }

      addNegativeToPositiveRecord(ratio, result) {
        this.shouldPrint = true;
        this.popHistory.push({
          minRatio: this.minRatio,
          ratio: ratio,
          result
        });
      }

      isCrossToPositive(ratio) {
        return this.ratio < 0 && ratio > 0;
      }

      getPopHistory = () => this.popHistory;

      logTable() {
        return;

        if (!this.shouldPrint) return;

        this.shouldPrint = false;

        if (this.popHistory.length === 0) {
          console.log("No pops recorded yet.");
          return;
        }
        console.table(
          this.popHistory.map((entry, i) => ({
            "#": i + 1,
            "Min Ratio": entry.minRatio,
            Ratio: entry.ratio,
            Result: entry.result
          }))
        );

        this.minRatio = 0;
      }
    }

    return new RatioWatch();
  }
  function generateCompressionZone() {
    class CompressionZone {
      constructor() {
        this.zones = [];
      }

      getZones() {
        return this.zones;
      }

      getBase() {
        return this.base;
      }

      getLength = () => this.zones.length;

      tryProcessCompression(targets, compressedRatio, extremeCompressedRatio) {
        this.zones = [];
        let partition = [];

        for (const t of targets) {
          const compressed = t.getIsCompressed();
          const extremeCompressed = t.getIsExtremeCompressed();

          if (compressed) {
            partition.push({
              payout: t.getPayout(),
              isExtreme: extremeCompressed
            });
          } else if (partition.length) {
            this.zones.push(partition);
            partition = [];
          }
        }

        if (partition.length) {
          this.zones.push(partition);
        }
      }

      getHaltMessage() {
        if (!this.isReady()) return null;

        const extremeZones = this.zones
          .map((zone, i) => ({
            index: i,
            payouts: zone
              .filter((item) => item.isExtreme)
              .map((item) => item.payout)
          }))
          .filter((z) => z.payouts.length);

        const details = extremeZones
          .map((z) => `Zone ${z.index + 1}: payouts ${z.payouts.join(", ")}`)
          .join(" | ");

        return `Halting: Extreme compression detected in ${extremeZones.length} zone(s). ${details}`;
      }

      isReady() {
        return this.zones.some(
          (zone) => zone.length >= 8 && zone.some((item) => item.isExtreme)
        );
      }
    }

    return new CompressionZone();
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
    if (getIsTestMode()) {
        return 100;
    }

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
