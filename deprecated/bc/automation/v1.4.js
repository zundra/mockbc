/* Start Script */
// ==UserScript==
// @name         bc.game automation v1.4
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  try to take over the world!
// @author       You
// @match        https://*/game/limbo
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bc.game
// @require https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @grant        none
// ==/UserScript==

window.stopped = true;

(function () {
  "use strict";

  const SCRIPT_NAME = "baseline";

  const TARGET_MANAGER = generateTargetManager();
  let lastRollSet = [];
  let currentRollSet = [];
  let rollCount = 0;
  let lastRiskOnPayout = null;
  let profit = 0;
  let exitPL = 0;
  let peakProfit = 0;

  // Fields
  let baseWagerField = null;
  let maxLossField = null;
  let fastWinRateThresholdField = null;
  let slowWinRateThresholdField = null;
  let riskPctField = null;
  let profitTargetField = null;
  let lsThreshold = null;
  let lsField = null;

  injectControlPanel();

  initWindowEvents();

  function evalResult(result) {
    rollCount++;

    let payout = getPayout();
    let wager = getWager();

    if (result >= payout) {
      profit += payout * wager - wager;
      peakProfit = Math.max(profit, peakProfit);
      if (profit >= getProfitTarget()) {
        halt(
          `Profit target hit: Profit ${profit.toFixed(
            4
          )}, Peak ${peakProfit.toFixed(4)}`
        );
        return;
      }
    } else {
      profit -= wager;
      if (profit <= peakProfit - getMaxLoss()) {
        halt(
          `Trailing max loss hit: Profit ${profit.toFixed(
            4
          )}, Peak ${peakProfit.toFixed(4)}`
        );
        return;
      }
    }

    TARGET_MANAGER.addResult(result);
    TARGET_MANAGER.evalRiskState(getBaseWager());
    updateUI(result);

    if (rollCount === Number(($("#max-rolls").val()))) {
      mbc.stop();
    }
  }

  function updateUI(result) {
    $("#profit-loss").html(TARGET_MANAGER.getPL().toFixed(4));
    $("#exit-pl").html(exitPL.toFixed(4));
    $("#roll-count").html(rollCount);

    const riskOnTarget = TARGET_MANAGER.getRiskOnTarget();

    if (riskOnTarget) {
      const payout = riskOnTarget.getPayout();
      const maxAllowed = getDynamicMaxWager(payout);
      $("#max-allowed-wager").html(maxAllowed.toFixed(6));
      $("#ls").html(riskOnTarget.getLosingStreak());
      $("#risk-on-ls").html(riskOnTarget.getRiskOnLosingStreak());
      $("#risk-on-payout").html(riskOnTarget.getPayout());
      $("#risk-on-profit-loss").html(riskOnTarget.getPL().toFixed(4));
    } else {
      $("#max-allowed-wager").html("-");
    }
  }

  function generateTargetManager() {
    class Target {
      constructor(
        payout,
        lookbacks = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
      ) {
        this.payout = payout;
        this.teo = 1 / (this.payout * 1.04); // Adjusted for edge
        this.lookbacks = lookbacks;
        // Streak tracking
        this.streak = 0;
        this.pstreak = 0;
        this.losingStreak = 0;
        this.cooldown = 0;

        // Hit counters
        this.hitCount = 0;
        this.rollCount = 0;

        this.streakCeiling = payout * 10;
        this.streakDiff = 0;
        this.maxAttempts = 0;
        this.maxAttemptThreshold = 3;
        this.attemptCount = 0;
        this.riskOn = false;
        this.recoveryOn = false;
        this.recoveryAmount = 0;
        this.riskOnLosingStreak = 0;
        this.wager = 0;
        this.baseWager = 0;
        this.maxWager = 0;
        this.profit = 0;
        this.results = [];
        this.recoveryWagers = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
        this.recoveryPayout = this.payout;
        this.execRiskOff = false;
      }

      getPL = () => this.profit;

      setBet() {
        setWager(this.wager);
        setPayout(this.getRecoveryOn() ? this.recoveryPayout : this.payout);
      }

      clearBet() {
        setWager(0);
        setPayout(1.01);
      }
      goRiskOn(wager) {
        this.baseWager = this.getScaledWager(wager);
        console.log(
          `[Going risk on with] Payout: ${this.getPayout()} and wager: ${
            this.baseWager
          }`
        );
        this.execRiskOff = false;
        this.wager = this.baseWager;
        this.riskOn = true;
        this.recoveryOn = false;
        this.riskOnLosingStreak = 0;
        this.currentAttempts = 0;
        this.profit = 0;
        this.attemptCount = 0;
        this.setBet();
      }

      goRecoveryOn(recoveryAmount) {
        this.execRiskOff = false;
        this.recoveryAmount = Math.abs(recoveryAmount);
        this.wager = 0.01;
        this.recoveryPayout = this.payout;
        this.riskOn = true;
        this.recoveryOn = true;
        this.riskOnLosingStreak = 0;
        this.currentAttempts = 0;
        this.profit = 0;
        this.attemptCount = 0;
        this.recoveryRollCount = 0;
        console.log(
          `[Going recovery on with] Payout: ${this.getPayout()} and recovery amount: ${
            this.recoveryAmount
          }`
        );

        this.setBet();
      }

      goRiskOff() {
        console.log(
          `Risk off: profit ${profit} on payout ${this.getPayout()}, max wager was ${
            this.maxWager
          }`
        );
        this.execRiskOff = false;
        this.recoveryRollCount = 0;
        this.wager = 0;
        this.riskOn = false;
        this.recoveryOn = false;
        this.riskOnLosingStreak = 0;
        this.currentAttempts = 0;
        this.attemptCount = 0;
        this.cooldown = Math.ceil(this.payout * 10);

        this.clearBet();
      }

      checkCooldown() {
        const shortWR = this.getWinRatePercentOfTeo(50);
        const longWR = this.getWinRatePercentOfTeo(200);

        if (rollCount < 100) {
          return true;
        }

        if (this.cooldown != 0) {
          this.cooldown--;
          return true;
        }

        if (this.inCooldown) {
          if (shortWR > longWR) {
            return true;
          }

          // Heat cooled → reset
          this.inCooldown = false;
        }

        return false; // no cooldown active
      }

      getScaledWager(wager, scalingFactor = 1.5) {
        return Math.max(
          0.0001,
          wager * Math.pow(1.75 / this.payout, scalingFactor)
        );
      }
      getPayout() {
        return this.payout;
      }

      getWager = () => this.wager;

      addResult(result) {
        this.addGlobalResult(result);
        if (this.getRiskOn()) {
          this.addRiskOnResult(result);
        } else if (this.getRecoveryOn()) {
          this.addRecoveryOnResult(result);
        }
      }

      addGlobalResult(result) {
        this.rollCount++;

        if (this.results.length === Math.ceil(this.payout * 100))
          this.results.shift();

        // Update streaks + hits
        if (result >= this.payout) {
          this.hitCount++;
          if (this.streak < 0) this.pstreak = this.streak;
          this.streak = Math.max(this.streak + 1, 1);
          this.results.push(1);
        } else {
          if (this.streak > 0) this.pstreak = this.streak;
          this.streak = Math.min(this.streak - 1, -1);
          this.results.push(0);
        }

        this.losingStreak = Math.min(0, this.streak);
        this.streakDiff = this.streakCeiling + this.losingStreak;
        this.maxAttempts = Math.floor(this.streakDiff / 10);
      }

      addRiskOnResult(result) {
        if (result >= this.getPayout()) {
          // WIN

          this.profit += this.payout * this.wager - this.wager;

          // Progressive pullback, profit included via coverageRatio
          const drawdown = Math.abs(this.profit);
          const potentialWin = this.payout * this.wager - this.wager;
          const coverageRatio = drawdown / potentialWin; // <1 = single hit covers

          // Adjust attemptCount based on where we are
          if (coverageRatio > 1.0) {
            // Big profit → full reset
            this.attemptCount = 0;
          } else if (coverageRatio < 0.5) {
            // Close to breakeven → sharp cutback
            this.attemptCount = Math.floor(this.attemptCount / 3);
          } else if (coverageRatio < 1.0) {
            // Recoverable in one hit → medium cutback
            this.attemptCount = Math.floor(this.attemptCount / 2);
          } else {
            // Deep → shallow cut
            this.attemptCount = Math.max(1, this.attemptCount - 1);
          }

          // Update wager after pullback
          this.wager = Math.max(
            0.0001,
            this.baseWager * Math.pow(2, this.attemptCount)
          );
        } else {
          // LOSS
          this.riskOnLosingStreak++;
          this.profit -= this.wager;
          console.log(
            `[Miss ${rollCount}]: Payout:${this.getPayout()}, Profit: ${
              this.profit
            }, Wager: ${this.wager}, Max Wager: ${
              this.maxWager
            }, Overall Profit: ${profit}`
          );
          if (this.riskOnLosingStreak % Math.ceil(this.getPayout() / 2) === 0) {
            this.attemptCount++;
            this.wager = this.baseWager * Math.pow(2, this.attemptCount);
            this.maxWager = Math.max(this.wager, this.maxWager);
          }
        }
      }
      addRecoveryOnResult(result) {
        this.recoveryRollCount++;
        if (result >= this.recoveryPayout) {
          this.profit += this.recoveryPayout * this.wager - this.wager;
          this.riskOnLosingStreak = 0;
          this.recoveryPayout = this.payout;
        } else {
          this.riskOnLosingStreak++;
          // if (this.recoveryRollCount % 100 === 0) {
          //   this.attemptCount++;
          //   this.wager = this.recoveryWagers[Math.min(this.attemptCount, this.recoveryWagers.length - 1)];
          // } else {
          //   this.wager = Math.min(this.wager * 1.5, 1);
          // }

          // this.wager = Math.min(this.wager * 1.5, 1);
          this.recoveryPayout = this.recoveryPayout + 0.5;
          this.profit -= this.wager;
        }
      }
      getStreakDiff = () => this.streak + this.payout;
      getPL = () => this.profit;
      getRatio = () => this.getStreakDiff() / this.payout;
      getWinRates() {
        return this.lookbacks.map((lookback) => this.getWinRate(lookback));
      }

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

      getHitDelta(lookback) {
        const lb = this.rollCount < lookback ? this.rollCount : lookback;
        return Math.floor(this.getHitCount(lb) - this.getExpectedHits(lb));
      }

      getHitCount(lookback = this.results.length) {
        return this.getHitData(lookback).sum;
      }

      getRecoveryOn = () => this.recoveryOn;
      getRiskOn = () => !this.recoveryOn && this.riskOn;
      getAttemptCount = () => this.attemptCount;
      getStreak = () => this.streak;
      getLosingStreak = () => (this.streak < 0 ? this.streak : 0);
      getLosingStreakAbs = () => Math.abs(this.getLosingStreak());
      getRiskOnLosingStreak = () => this.riskOnLosingStreak;
      streakExceedsThreshold = (lsThreshold) =>
        this.getLosingStreakAbs() >= this.getPayout() * lsThreshold;
      getTeo = () => this.teo;
      getHitCount = () => this.hitCount;
      getRollCount = () => this.rollCount;
      getWinRatePercentOfTeo = (lookback = 100) =>
        (this.getWinRate(lookback) / this.getTeo()) * 100;
      dynamicStreakThreshold(baseThreshold = 10) {
        const winRatePct = this.getWinRatePercentOfTeo(100);

        // High win rate → longer streak required
        // Low win rate → shorter streak allowed
        let scale = winRatePct / 100;

        // Clamp between 0.5x and 2x for safety
        scale = Math.max(0.5, Math.min(2, scale));

        return Math.floor(baseThreshold * scale);
      }

      isBelowWinRates() {
        return this.getWinRatePercentOfTeo(50) < 50;
      }

      isRiskOffReady() {
        return this.getPL() > 0;
      }
    }

    class TargetManager {
      constructor(payouts, decay = 0.95) {
        this.rollingStats = initRollingStats();
        this.targets = payouts.map((p) => new Target(p));
        this.lowTargets = this.targets.filter(
          (target) => target.getPayout() <= 3
        );
        this.riskOnTarget = null;
        this.profit = 0;
        this.cycleProfit = 0;
        this.stats10Mean = 0;
        this.stats100Mean = 0;
        this.stats1000Mean = 0;

        this.stats10variance = 0;
        this.stats100variance = 0;
        this.stats1000variance = 0;

        this.stats10median = 0;
        this.stats100median = 0;
        this.stats1000median = 0;

        this.stats10StdDev = 0;
        this.stats100StdDev = 0;
        this.stats1000StdDev = 0;
      }

      getRiskOnTarget = () => this.riskOnTarget;

      getCyclePL = () => this.cycleProfit;

      getPL = () => this.profit;

      getTargetN = (n) => this.targets[n + 1];
      getTargets = () => this.targets;

      getPivotTarget() {
        let pivot = null;

        for (const t of this.targets) {
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

      getBelowWinRateTarget() {
        return this.targets
          .filter((target) => target.isBelowWinRates())
          .first();
      }

      getNextRiskOnTarget() {
        const pivot = this.getPivotTarget();
        if (pivot && pivot.isBelowWinRates()) return pivot;
        return null;
      }


      getNextRiskOnTarget2() {
        if ( this.stats10median > 1.92 ||  this.stats100median > 1.92 ||  this.stats1000median > 1.92) return null;

        const pivot = this.getPivotTarget();
        if (pivot && pivot.isBelowWinRates()) return pivot;
        return null;
      }


      getNextRiskOnTarget3() {
        if ( this.stats10median < 1.92 ||  this.stats100median > 1.92 ||  this.stats1000median > 1.92) return null;
        const pivot = this.getPivotTarget();
        return pivot;
      }

      evalRiskState(baseWager) {
        // Check to see if the current risk on state
        // should be exited.
        if (this.riskOnTarget) {
          this.evalRiskOnState();
        }

        // Risk on state still valid, so adjust the wager if necessary
        // and return.
        if (this.riskOnTarget)
          if (this.riskOnTarget !== null) {
            this.riskOnTarget.setBet();
            return;
          }

        // if (this.getCyclePL() < 0) {
        //   this.riskOnTarget = this.getRecoveryTarget();
        //   // No target ready to go risk on.
        //   if (this.riskOnTarget === null) return;

        //     console.log("RECOVERY TARGET", this.riskOnTarget.getPayout());
        //   // New risk on target, so go risk on
        //   this.riskOnTarget.goRecoveryOn(this.getCyclePL());
        // } else {
        // Risk on state is null, so try to get the next one.
        this.riskOnTarget = this.getNextRiskOnTarget();

        // No target ready to go risk on.
        if (this.riskOnTarget === null) return;

        if (this.riskOnTarget)
          // New risk on target, so go risk on
          this.riskOnTarget.goRiskOn(baseWager);
        //    }
      }
      updateStats() {
        this.stats10Mean = this.rollingStats.getMean(10);
        this.stats100Mean = this.rollingStats.getMean(100);
        this.stats1000Mean = this.rollingStats.getMean(1000);

        this.stats10variance = this.rollingStats.getVariance(10);
        this.stats100variance = this.rollingStats.getVariance(100);
        this.stats1000variance = this.rollingStats.getVariance(1000);

        this.stats10median = this.rollingStats.getMedian(10);
        this.stats100median = this.rollingStats.getMedian(100);
        this.stats1000median = this.rollingStats.getMedian(1000);

        this.stats10StdDev = this.rollingStats.getStandardDeviation(10);
        this.stats100StdDev = this.rollingStats.getStandardDeviation(100);
        this.stats1000StdDev = this.rollingStats.getStandardDeviation(1000);

        $("#mean10").text(this.stats10Mean.toFixed(2));
        $("#variance10").text(this.stats10variance.toFixed(2));
        $("#stddev10").text(this.stats10StdDev.toFixed(2));
        $("#median10").text(this.stats10median.toFixed(2));

        $("#mean100").text(this.stats100Mean.toFixed(2));
        $("#variance100").text(this.stats100variance.toFixed(2));
        $("#stddev100").text(this.stats100StdDev.toFixed(2));
        $("#median100").text(this.stats100median.toFixed(2));

        $("#mean1000").text(this.stats1000Mean.toFixed(2));
        $("#variance1000").text(this.stats1000variance.toFixed(2));
        $("#stddev1000").text(this.stats1000StdDev.toFixed(2));
        $("#median1000").text(this.stats1000median.toFixed(2));
      }

      evalRiskOnState() {
        if (this.riskOnTarget.isRiskOffReady()) {
          this.cycleProfit = this.riskOnTarget.getPL();
          this.profit += this.cycleProfit;
          this.riskOnTarget.goRiskOff();
          this.riskOnTarget = null;
        }
      }
      addResult(result) {
        this.rollingStats.push(result);
        this.updateStats();
        this.targets.forEach((target) => {
          target.addResult(result);
        });
      }
    }

    return new TargetManager(generatePayouts());
  }

  function getLosingStreakMultiplier() {
    if (!lsField) {
      lsField = $("#ls-multiplier");
    }
    return Number(lsField.val());
  }

  function getBaseWager() {
    if (!baseWagerField) {
      baseWagerField = $("#base-wager");
    }
    return Number(baseWagerField.val());
  }

  function getRiskPercentOfBankroll() {
    if (!riskPctField) {
      riskPctField = $("#risk-pct");
    }
    return Number(riskPctField.val()) / 100;
  }

  function getMaxLoss() {
    if (!maxLossField) {
      maxLossField = $("#max-loss");
    }
    return Number(maxLossField.val());
  }

  function getProfitTarget() {
    if (!profitTargetField) {
      profitTargetField = $("#profit-target");
    }
    return Number(profitTargetField.val());
  }

  function getFastWinRateThreshold() {
    if (!fastWinRateThresholdField) {
      fastWinRateThresholdField = $("#fast-win-rate-threshold");
    }
    return Number(fastWinRateThresholdField.val());
  }

  function getSlowWinRateThreshold() {
    if (!slowWinRateThresholdField) {
      slowWinRateThresholdField = $("#slow-win-rate-threshold");
    }
    return Number(slowWinRateThresholdField.val());
  }

  function getControlRollLoop() {
    const controlRollLoopField = $("#control-roll-loop");
    return (
      controlRollLoopField.length !== 0 && controlRollLoopField.prop("checked")
    );
  }

  function getDynamicMaxWager(payout) {
    const balance = getBalance();
    const riskPct = getRiskPercentOfBankroll();
    const target = TARGET_MANAGER.getTargets().find(
      (t) => t.getPayout() === payout
    );

    // Use target’s TEO if available, otherwise just 1/payout
    const teoFactor = target ? target.getTeo() : 1 / payout;

    // Max risk allowed on this bet
    return balance * riskPct * teoFactor;
  }

  function getBalance() {
    if (getIsTestMode()) {
      return Number($("#balance").val());
    }

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

  function generatePayouts() {
    return Array.from(
      {
        length: 21
      },
      (v, k) => 3 + k * 0.1
    );
  }

  function generatePayouts2() {
    // let a1 = [1.92, 2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3];
    // let a2 = [
    //   3,
    //   3.1,
    //   3.2,
    //   3.3,
    //   3.4,
    //   3.5,
    //   3.6,
    //   3.7,
    //   3.8,
    //   3.9,
    //   4,
    //   4.1,
    //   4.2,
    //   4.4,
    //   4.4,
    //   4.5,
    //   4.6,
    //   4.7,
    //   4.8,
    //   4.9,
    //   5
    // ];
    // return [...a1, ...a2];

    return Array.from(
      {
        length: 13
      },
      (v, k) => 5 + k * 0.5
    );
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

    return new RollingStats(100);
  }
  // Utility function: Get current roll data
  function getCurrentRollData() {
    return $(".grid.grid-auto-flow-column div span")
      .map(function () {
        return $(this).text();
      })
      .get();
  }

  function initWindowEvents() {
    $("#reset-btn").click(() => fullReset());

    $("#start-betting-btn").click(function () {
      startBetting();
    });

    $("#stop-betting-btn").click(function () {
      stopBetting();
    });

    $("#zero-wager-btn").click(function () {
      setWager(0);
    });

    $(document).on("keypress", function (e) {
      if (e.which === 122) {
        if (window.stopped) {
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
  }

  function fullReset() {
    console.log("Full reset triggered");
    stopBetting();

    // Reset globals
    profit = 0;
    peakProfit = 0;
    rollCount = 0;
    lastRiskOnPayout = null;

    // Reset wagers
    setWager(0);
    setPayout(1.01);

    // Reset all targets
    TARGET_MANAGER.getTargets().forEach((t) => {
      t.streak = 0;
      t.pstreak = 0;
      t.losingStreak = 0;
      t.hitCount = 0;
      t.rollCount = 0;
      t.streakDiff = 0;
      t.maxAttempts = 0;
      t.attemptCount = 0;
      t.riskOn = false;
      t.riskOnLosingStreak = 0;
      t.wager = 0;
      t.baseWager = 0;
      t.results.length = 0;
    });

    // Update UI immediately
    updateUI();
    $("#message").text("Session reset. New run started.");
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function doInit() {
    if (!Array.prototype.last) {
      Array.prototype.last = function () {
        return this[this.length - 1];
      };
    }

    if (!Array.prototype.first) {
      Array.prototype.first = function () {
        return this[0];
      };
    }

    observeRollChanges();
  }

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
   <div id="stats" class="stats-box" style="
      margin: 12px 0;
      background-color: #444;
      padding: 10px;
      border-radius: 6px;
      color: white;
      font-size: 0.9rem;
      text-align: center;
      ">
      <div>Overall Profit / Loss: <span id="profit-loss"></span></div>
      <div>Risk on Profit / Loss: <span id="risk-on-profit-loss"></span></div>
      <div>Overall Losing Streak: <span id="ls"></span></div>
      <div>Risk on Losing Streak: <span id="risk-on-ls"></span></div>
      <div>Risk on Payout: <span id="risk-on-payout"></span></div>
      <div>Roll Count: <span id="roll-count"></span></div>
      <div>Max Allowed Wager: <span id="max-allowed-wager"></span></div>
   </div>

      <div class="control-group">
      <label>Control Roll Loop</label>
      <input id="control-roll-loop" type="checkbox" checked/>
   </div>


   <div class="button-group">
      <button id="start-betting-btn">Start Betting</button>
      <button id="stop-betting-btn">Stop Betting</button>
      <button id="zero-wager-btn">Zero Wager</button>
      <button id="reset-btn">Reset</button>
   </div>


      <div class="control-group">
      <label>Base Wager</label>
      <input type="number" id="base-wager" value="0.01" step="0.01" />
   </div>

<div class="control-group">
  <label>Risk % of Bankroll</label>
  <input type="number" id="risk-pct" value="5" />
</div>
      <div class="control-group">
      <label>Max Loss</label>
      <input type="number" id="max-loss" value="5"  />
   </div>

      <div class="control-group">
      <label>Profit Target</label>
      <input type="number" id="profit-target" value="10"  />
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
         <option value="0.5">0.5</option>
         <option value="1">1</option>
         <option value="1.5">1.5</option>
         <option value="2">2</option>
         <option value="2.5">2.5</option>
         <option value="3" selected>3</option>
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
</div>`;

    $("body").prepend(controlPanel);
  }

  function halt(stopMessage) {
    console.log(stopMessage);
    $("#message").text(stopMessage);
    stopMessage = "";
    if (!window.stopped) stopBetting();

    return;
  }

  function startBetting() {
    window.stopped = false;
    setWager(0);
    setPayout(1.01);

    if (!getControlRollLoop()) return;
    doBet(); // Start the async loop
  }

  function stopBetting() {
    window.stopped = true;
  }

  async function doBet() {
    while (!window.stopped) {
      // Trigger the button click

      $(".button-brand:first").trigger("click");

      // Wait for 1 second (1000 ms) before clicking again
      await delay(10);

      // Stop condition check inside the loop
      if (window.stopped) {
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
