/* Start Script */
// ==UserScript==
// @name         bc.game automation (recovery) v1.0
// @namespace    http://tampermonkey.net/
// @version      1
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

  const SystemStates = {
    NORMAL: "normal",
    RECOVERY: "recovery",
    RECOVERY_INVOKED: "recovery_invoked",
    NORMAL_INVOKED: "normal_invoked"
  };

  let SystemState = SystemStates.NORMAL;

  const SCRIPT_NAME = "baseline";

  const TARGET_MANAGER = generateTargetManager();
  const FIRST_PAYOUT = generateWatchPayouts()[0];
  let lastRollSet = [];
  let currentRollSet = [];
  let rollCount = 0;
  let riskOnTarget = null;
  let lastRiskOnPayout = null;
  let profit = 0;
  let exitPL = 0;
  let peakProfit = 0;
  let stopped = true;

  // Fields
  let baseWagerField = null;
  let recoveryBaseWagerField = null;
  let maxLossField = null;
  let fastWinRateThresholdField = null;
  let slowWinRateThresholdField = null;
  let riskPctField = null;
  let profitTargetField = null;
  let lsThreshold = null;

  injectControlPanel();

  initWindowEvents();

  const recoveryEngine = generateRecovery();

  function evalResult(result) {
    rollCount++;

    if (rollCount === 1) {
      debugger;
    }

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
      if (SystemState !== SystemStates.RECOVERY) {
        if (profit <= peakProfit - getMaxLoss()) {
          setSystemState(SystemStates.RECOVERY_INVOKED);
          console.log(`Recovery mode invoked ${profit}`);
          // halt(
          //   `Trailing max loss hit: Profit ${profit.toFixed(
          //     4
          //   )}, Peak ${peakProfit.toFixed(4)}`
          // );
          return;
        }
      }
    }

    TARGET_MANAGER.addResult(result);
    recoveryEngine.addResult(result);

    if (
      SystemState !== SystemStates.RECOVERY &&
      SystemState !== SystemStates.RECOVERY_INVOKED
    ) {
      if (riskOnTarget && !riskOnTarget.getRiskOn()) {
        exitPL = riskOnTarget.getPL();
        riskOnTarget = null;
        setWager(0);
        setPayout(1.01);
      }

      const targets = TARGET_MANAGER.getTargets();

      if (!riskOnTarget) {
        for (let i = 0; i < targets.length; i++) {
          const target = targets[i];
          if (target.isRiskOnReady()) {
            riskOnTarget = target;
            lastRiskOnPayout = riskOnTarget.getPayout();
            riskOnTarget.goRiskOn(getBaseWager());
            break;
          }
        }
      } else {
        riskOnTarget.setBet();
      }
    } else {
      if (!recoveryEngine.inRecovery) {
        setSystemState(SystemStates.NORMAL_INVOKED);
      } else {
        recoveryEngine.maybeEnter();        
      }

    }
    updateUI(result);
  }

  function setSystemState(nextState) {
    // if we’re already in the desired state, ignore
    if (SystemState === nextState) return;

    // cleanup logic on transition
    switch (SystemState) {
      case SystemStates.NORMAL:
        if (riskOnTarget) {
          riskOnTarget.goRiskOff();
          riskOnTarget = null;
        }
        break;

      case SystemStates.RECOVERY:
        if (recoveryEngine && recoveryEngine.activeTarget) {
          recoveryEngine.exit("Transitioning out of recovery");
        }
        break;

      // invoked states don’t need cleanup, they’re just transition markers
    }

    // set new state
    SystemState = nextState;

    // setup logic for the new state
    switch (SystemState) {
      case SystemStates.NORMAL_INVOKED:
        // prepare normal engine to start fresh

        SystemState = SystemStates.NORMAL;
        break;

      case SystemStates.RECOVERY_INVOKED:
        // prepare recovery engine
        if (recoveryEngine) recoveryEngine.reset();
        // exitPL = riskOnTarget.getPL();
        riskOnTarget = null;
        setWager(0);
        setPayout(1.01);
        recoveryEngine.invoke(profit);
        SystemState = SystemStates.RECOVERY;
        break;
    }

    console.log(`[System] Transitioned to ${SystemState}`);
  }

  function updateUI(result) {
    $("#profit-loss").html(profit.toFixed(4));
    $("#exit-pl").html(exitPL.toFixed(4));
    $("#roll-count").html(rollCount);
    $("#system-state").html(SystemState);
    if (riskOnTarget) {
      const payout = riskOnTarget.getPayout();
      const maxAllowed = getDynamicMaxWager(payout);
      $("#max-allowed-wager").html(maxAllowed.toFixed(6));
    } else {
      $("#max-allowed-wager").html("-");
    }

    if (riskOnTarget) {
      $("#ls").html(riskOnTarget.getLosingStreak());
      $("#risk-on-ls").html(riskOnTarget.getRiskOnLosingStreak());
      $("#risk-on-payout").html(riskOnTarget.getPayout());
      $("#risk-on-profit-loss").html(riskOnTarget.getPL());
    }
  }

  function generateTarget(payout, isRecovery = false) {
    class Target {
      constructor(payout, isRecovery = false) {
        this.payout = payout;
        this.isRecovery = isRecovery;
        this.teo = 1 / (this.payout * 1.04); // Adjusted for edge

        // Streak tracking
        this.streak = 0;
        this.pstreak = 0;
        this.losingStreak = 0;
        this.cooldown = 0;
        this.hitDeltaOnEntry = 0;

        // Hit counters
        this.hitCount = 0;
        this.rollCount = 0;

        this.streakCeiling = payout * 10;
        this.streakDiff = 0;
        this.maxAttempts = 0;
        this.maxAttemptThreshold = 3;
        this.attemptCount = 0;
        this.riskOn = false;
        this.riskOnLosingStreak = 0;
        this.riskOnRollCount = 0;
        this.wager = 0;
        this.wagerPinned = false;
        this.baseWager = 0;
        this.maxWager = 0;
        this.profit = 0;
        this.riskOnHitCount = 0;
        this.results = [];

        this.maxWager = 0;
      }

      getPL = () => this.profit;

      goRiskOn(wager) {
        this.baseWager = wager;
        this.wagerPinned = false;
        this.hitDeltaOnEntry = this.getHitDelta(Math.ceil(this.payout * 5));
        this.wager = this.baseWager;
        this.riskOn = true;
        this.riskOnLosingStreak = 0;
        this.riskOnRollCount = 0;
        this.currentAttempts = 0;
        this.profit = 0;
        this.attemptCount = 1;
        this.riskOnHitCount = 0;
        this.setBet();
      }

      setBet() {
        setWager(this.getWager());
        setPayout(this.getPayout());
      }

      clearBet() {
        setWager(0);
        setPayout(1.01);
      }

      goRiskOff() {
        this.hitDeltaOnEntry = 0;
        this.wager = 0;
        this.riskOn = false;
        this.riskOnLosingStreak = 0;
        this.currentAttempts = 0;
        this.attemptCount = 1;
        this.riskOnHitCount = 0;
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
          wager * Math.pow(FIRST_PAYOUT / this.payout, scalingFactor)
        );
      }
      getPayout() {
        return this.payout;
      }

      getWager = () => this.wager;

      addResult(result) {
        const hit = result >= this.payout;
        if (this.results.length === Math.ceil(this.payout * 100))
          this.results.shift();

        this.results.push(hit ? 1 : 0);

        if (this.getRiskOn()) {
          this.addRiskOnResult(result);
        } else {
          this.addRiskOffResult(result);
        }
      }

      addRiskOffResult(result) {
        this.rollCount++;

        // Update streaks + hits
        if (result >= this.payout) {
          this.hitCount++;
          if (this.streak < 0) this.pstreak = this.streak;
          this.streak = Math.max(this.streak + 1, 1);
        } else {
          if (this.streak > 0) this.pstreak = this.streak;
          this.streak = Math.min(this.streak - 1, -1);
        }

        this.losingStreak = Math.min(0, this.streak);
        this.streakDiff = this.streakCeiling + this.losingStreak;
        this.maxAttempts = Math.floor(this.streakDiff / 10);

        if (this.getRiskOn()) {
          this.addRiskOnResult(result);
        }
      }

      addRiskOnResult(result) {
        this.riskOnRollCount++;

        if (result >= this.getPayout()) {
          this.riskOnHitCount++;
          this.profit += this.payout * this.wager - this.wager;
          this.riskOnLosingStreak = 0;
          if (this.isRiskOffReady()) {
            this.goRiskOff();
            return;
          }

          this.wager = this.getProgressiveWager(true);
        } else {
          this.riskOnLosingStreak++;
          this.profit -= this.wager;
        }

        this.wager = this.getProgressiveWager(false);
        this.maxWager = Math.max(this.wager, this.maxWager);
        // if (rollCount % 100 === 0) {
        //   console.log("Max Wager", this.maxWager, "Base Wager", this.baseWager);
        // }
      }

      // getProgressiveWager(isHit) {
      //   let dMaxWager = this.getDynamicMaxWager();
      //   let nextWager = 0;

      //   if (isHit) {
      //    nextWager = Math.max(this.baseWager, this.wager /= 2);
      //   } else {
      //    nextWager = Math.max(this.baseWager, this.wager *= 2);
      //   }

      //   if (nextWager === dMaxWager) {
      //     this.wagerPinned = true;
      //   } else {
      //     this.wagerPinned = false;
      //   }
      //   return nextWager;
      // }

      getProgressiveWager(isHit) {
        return this.isRecovery
          ? this.getRecoveryProgressiveWager(isHit)
          : this.getNormalProgressiveWager(isHit);
      }

      getNormalProgressiveWager(isHit) {
        let dMaxWager = this.getDynamicMaxWager();
        const nextWager = Math.min(this.wager * 2, dMaxWager);
        if (nextWager === dMaxWager) {
          //console.log("WAGER PINNED AT ", nextWager, "for payout", this.payout)
          this.wagerPinned = true;
        } else {
          //        console.log("WAGER NOT PINNED AT ", nextWager, "for payout", this.payout, dMaxWager, nextWager)
          this.wagerPinned = false;
        }
        return nextWager;
      }

      getRecoveryProgressiveWager(isHit) {
        let dMaxWager = this.getDynamicMaxWager();
        const nextWager = Math.min(this.wager * 1.92, dMaxWager);
        if (nextWager === dMaxWager) {
          //console.log("WAGER PINNED AT ", nextWager, "for payout", this.payout)
          this.wagerPinned = true;
        } else {
          //        console.log("WAGER NOT PINNED AT ", nextWager, "for payout", this.payout, dMaxWager, nextWager)
          this.wagerPinned = false;
        }
        return nextWager;
      }

      getRecoveryProgressiveWager2(isHit) {
        const payout = this.payout;
        const losingStreak = this.riskOnLosingStreak; // intrinsic
        const dMaxWager = this.getDynamicMaxWager();
        const hitDelta = this.getHitData(20);
        let nextWager = this.baseWager;

        if (payout <= 2) {
          // --- Ultra grind: linear step-up ---
          if (!isHit) {
            nextWager = this.baseWager * (1 + losingStreak * 0.2);
          } else {
            // On hit → pull back gently, never below base
            nextWager = Math.max(this.baseWager, this.wager * 0.8);
          }
        } else if (payout <= 3) {
          // --- Mid grind: fractional martingale with TEO adjustment ---
          let scale = 1.25;
          if (!isHit) {
            if (hitDelta < 0) {
              const badLuck = hitDelta / 20;
              scale += badLuck * 0.5; // up to ~1.75 if very unlucky
            }
            nextWager = this.wager * scale;
          } else {
            // On hit → halve risk, but not below base
            nextWager = Math.max(this.baseWager, this.wager / 2);
          }
        } else {
          // --- Outside recovery band: flat base ---
          nextWager = this.baseWager;
        }

        // Clamp against dynamic max
        if (nextWager >= dMaxWager) {
          nextWager = dMaxWager;
          this.wagerPinned = true;
        } else {
          this.wagerPinned = false;
        }

        this.wager = nextWager;
        return nextWager;
      }

      getExpectedHits(lookback) {
        return lookback / this.payout;
      }

      getDynamicMaxWager() {
        const balance = getBalance();
        const riskPct = getRiskPercentOfBankroll();
        const teoFactor = 1 / this.payout;
        return balance * riskPct * teoFactor;
      }
      getHitDelta() {
        return this.riskOnHitCount - this.getExpectedHits(this.riskOnRollCount);
      }

      getPerformanceRatio() {
        const expected = this.getExpectedHits(this.riskOnRollCount);
        if (expected <= 0) return 1; // avoid div/0
        return this.riskOnHitCount / expected; // >1 = overperforming, <1 = underperforming
      }

      getDynamicWager(currentWager) {
        // Compute performance ratio
        const ratio = this.getPerformanceRatio();

        // Performance factor:
        //   >1 (overperforming) → shrink wager below base
        //   <1 (underperforming) → grow wager above base
        // Clamp between 0.5x and 2x for sanity
        const performanceFactor = Math.max(0.5, Math.min(2.0, 1 / ratio));

        // Final wager
        const wager = currentWager * performanceFactor;

        return Math.max(0.0001, wager); // enforce safety floor
      }

      getPL = () => this.profit;

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
      getRiskOn = () => this.riskOn;
      getStreakDiff = () => this.streakDiff;
      getAttemptCount = () => this.attemptCount;
      getStreak = () => this.streak;
      getLosingStreak = () => (this.streak < 0 ? this.streak : 0);
      getLosingStreakAbs = () => Math.abs(this.getLosingStreak());
      getRiskOnLosingStreak = () => this.riskOnLosingStreak;
      streakExceedsThreshold = (lsThreshold) =>
        this.getLosingStreakAbs() >= this.getPayout() * lsThreshold;
      getTeo = () => this.teo;
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

      shouldGoRiskOff(overPerfThreshold = 2.0) {
        const ratio = this.getPerformanceRatio(
          this.riskOnHitCount,
          this.payout,
          this.riskOnRollCount
        );
        return ratio >= overPerfThreshold;
      }

      isRiskOffReady() {
        if (this.isRecovery) return false;
        return this.getPL() > 0;
      }

      isRiskOnReady() {
        return this.streakExceedsThreshold(4);
      }
    }
    return new Target(payout, isRecovery);
  }
  function generateTargetManager() {
    class TargetManager {
      constructor(payouts, decay = 0.95) {
        this.targets = payouts.map((p) => generateTarget(p));
      }

      getTargetN = (n) => this.targets[n + 1];
      getTargets = () => this.targets;

      addResult(result) {
        this.targets.forEach((target) => {
          target.addResult(result);
        });
      }
    }

    return new TargetManager(generateWatchPayouts());
  }

  function getBaseWager() {
    if (!baseWagerField) {
      baseWagerField = $("#base-wager");
    }
    return Number(baseWagerField.val());
  }

  function getRecoveryBaseWager() {
    if (!recoveryBaseWagerField) {
      recoveryBaseWagerField = $("#recovery-base-wager");
    }
    return Number(recoveryBaseWagerField.val());
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

  function getLSThreshold() {
    if (!lsThreshold) {
      lsThreshold = $("#ls-threshold");
    }
    return Number(lsThreshold.val());
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

  function generateWatchPayouts() {
    return Array.from(
      {
        length: 15
      },
      (v, k) => 3 + k * 0.5
    );
  }

  function generateRecoveryPayouts() {
    return Array.from(
      {
        length: 25
      },
      (v, k) => parseFloat((1.8 + k * 0.05).toFixed(2))
    );
  }

  function generateRecovery() {
    class Recovery {
      constructor(payouts) {
        this.targets = payouts.map((p) => generateTarget(p, true));
        this.reset(payouts);
      }

      reset() {
        if (this.activeTarget) {
          this.activeTarget.goRiskOff();
        }

        this.inRecovery = false;
        this.lossTarget = 0; // how much to make back
        this.sessionProfit = 0; // P/L during recovery
        this.activeTarget = null;
      }

      exit(reason = "manual") {
        if (this.activeTarget) {
          this.activeTarget.goRiskOff();
        }
        console.log(
          `[Recovery ${rollCount}] Exit → reason: ${reason}, SessionProfit=${this.sessionProfit.toFixed(
            4
          )}`
        );
        this.reset();
      }

      // always feed results in (so internal targets stay updated)
      addResult(result) {
        for (const t of this.targets) {
          t.addResult(result);
        }

        if (this.inRecovery && this.riskOn()) {
          this.updateRecovery(result);
        }
      }

      // called by main script when loss limit hit
      invoke(amountToRecover) {
        console.log(`[Recovery] Invoked to recover ${amountToRecover}`)
        this.inRecovery = true;
        this.lossTarget = Math.abs(amountToRecover);
        this.sessionProfit = 0;
      }

      // called each tick to see if we should engage
      maybeEnter() {
        if (!this.inRecovery || this.riskOn()) return;

        for (const t of this.targets) {
          if (t.isRiskOnReady()) {
            t.goRiskOn(getRecoveryBaseWager());
            this.activeTarget = t;
            console.log(`[Recovery ${rollCount}] Engaged on payout ${t.getPayout()}`);
            break;
          }
        }
      }

      riskOn() {
        return this.activeTarget !== null;
      }

      updateRecovery(result) {
        // Use live DOM as source of truth for actual wager/payout
        const wager = getWager();
        const payout = getPayout();
 
        if (result >= payout) {
          this.sessionProfit += payout * wager - wager;
        } else {
          this.sessionProfit -= wager;
        }

        if (this.sessionProfit >= this.lossTarget) {
          this.exit(
            `[Recovery ${rollCount}] Completed, +${this.sessionProfit.toFixed(4)} → back to normal`
          );
          return;
        }

        // Hand off sizing logic to the target
        this.activeTarget.setBet();
      }
    }
    return new Recovery(generateRecoveryPayouts());
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
  }

  function fullReset() {
    console.log("Full reset triggered");
    stopBetting();

    // Reset globals
    profit = 0;
    peakProfit = 0;
    rollCount = 0;
    riskOnTarget = null;
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
      <div>System State<span id="system-state"></span></div>
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
      <label>Recovery Base Wager</label>
      <input type="number" id="recovery-base-wager" value="0.01" step="0.01" />
   </div>
<div class="control-group">
  <label>Risk % of Bankroll</label>
  <input type="number" id="risk-pct" value="15" />
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
      <label>Fast Win Rate Threshold</label>
      <input type="number" id="fast-win-rate-threshold" value="50"  />
   </div>

    <div class="control-group">
      <label>Slow Win Rate Threshold</label>
      <input type="number" id="slow-win-rate-threshold" value="80"  />
   </div>

       <div class="control-group">
      <label>LS Threshold</label>
      <input type="number" id="ls-threshold" value="2"  />
   </div>
</div>`;

    $("body").prepend(controlPanel);
  }

  function halt(stopMessage) {
    console.log(stopMessage);
    $("#message").text(stopMessage);
    stopMessage = "";
    if (!stopped) stopBetting();

    return;
  }

  function startBetting() {
    stopped = false;
    setWager(0);
    setPayout(1.01);
    doBet(); // Start the async loop
  }

  function stopBetting() {
    stopped = true;
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
