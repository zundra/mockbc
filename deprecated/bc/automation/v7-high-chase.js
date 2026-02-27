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
    TARGET_MANAGER.evalRiskState(result, getBaseWager());
    updateUI(result);
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
    class HighTarget {
      constructor(payout, wager, maxLoss) {
        this.payout = payout;
        this.wager = wager;
        this.teo = 1 / (this.payout * 1.04); // Adjusted for edge
        this.maxLoss = maxLoss;
        this.streak = 0;
        this.pstreak = 0;
        this.losingStreak = 0;
        this.hitHalt = false;
        // Hit counters
        this.hitCount = 0;
        this.rollCount = 0;
        this.profit = 0;
        this.recoveryReady = false;
        this.inRecovery = false;
      }

      isRecoveryReady = () => this.recoveryReady

      isInRecovery = () => this.inRecovery
      
      isHitHalt = () => this.hitHalt;

      getHitHaltMessage = () => this.hitHaltMessage;

      getPL = () => this.profit;

      setBet() {
        setWager(this.wager);
        setPayout(this.payout);
      }

      clearBet() {
        setWager(0);
        setPayout(1.01);
      }

      exitRecovery() {
        this.inRecovery = false;
        console.log(`[Exit Recovery ${rollCount}] Target: ${this.payout}, Profit: ${profit}`);
        this.setBet();
      }

      configureRecovery() {
        console.log(`[Configured Recovery ${rollCount}] Target: ${this.payout}, Profit: ${profit}`);
        this.recoveryReady = true;
        this.inRecovery = false;
        this.clearBet();
      }

      enterRecovery() {
        this.recoveryReady = false;
        this.inRecovery = true;
        console.log(`[Enter Recovery ${rollCount}] Target: ${this.payout}, Profit: ${profit}`);
      }

      updateRecovery(profit) {
        this.profit += profit;
        

        // console.log(`[Recovery progress ${rollCount}] Target: ${this.payout}, Profit: ${this.profit}, Result Profit: ${profit}`);
        
        
        if (this.profit >= 0) {
          console.log(`[Recovery Complete ${rollCount}] Target: ${this.payout}, Profit: ${this.profit}`);
          this.exitRecovery();
        }
      }
      getPayout() {
        return this.payout;
      }

      getWager = () => this.wager;

      push(result) {
        this.rollCount++;
        
        const isHit = result >= this.payout;
        
        if (isHit) {
          this.hitHalt = true;
          
          if (!this.inRecovery && !this.recoveryReady) {
            this.profit += this.wager * this.payout - this.wager;
            this.hitHaltMessage = `[High target hit! ${rollCount}] Payout ${this.payout}, Result: ${result}, Profit: ${this.profit}`
          } else {
            this.hitHaltMessage = `[High target hit during recovery :( ${rollCount}] Payout ${this.payout}, Result: ${result}`            
          }
          return;
        }

        if (this.inRecovery || this.recoveryReady) return;

        this.streak = Math.min(this.streak - 1, -1);
        this.profit -= this.wager;

        if (this.profit < 0 && Math.abs(this.profit) >= this.maxLoss) {
          this.configureRecovery();
        }

        this.losingStreak = Math.min(0, this.streak);
      }

      getPL = () => this.profit;

      getWinRate(lookback = this.results.length) {
        return this.hitCount / this.rollCount;
      }

      getRiskOn = () => !this.recoveryOn && this.riskOn;
      getLosingStreak = () => (this.streak < 0 ? this.streak : 0);
      getLosingStreakAbs = () => Math.abs(this.getLosingStreak());
      getTeo = () => this.teo;
      getHitCount = () => this.hitCount;
      getRollCount = () => this.rollCount;
      getWinRatePercentOfTeo = (lookback = 100) =>
        (this.getWinRate(lookback) / this.getTeo()) * 100;

      isRiskOffReady() {
        return this.getPL() > 0;
      }
    }

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
        this.highTarget = null;
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
      goRiskOn(wager, highTarget) {
        this.baseWager = this.getScaledWager(wager);
        console.log(
          `[Risk on ${rollCount}] Payout: ${this.getPayout()} and wager: ${
            this.baseWager
          }`
        );
        this.highTarget = highTarget;
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

      goRiskOff() {
        console.log(
          `[Risk off ${rollCount}] Payout: ${this.getPayout()}, Profit ${profit}, max wager was ${
            this.maxWager
          }`
        );
        if (this.highTarget) {
          this.highTarget.updateRecovery(this.profit);
        }
        this.profit = 0;
        this.highTarget = null;
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
          const profit = this.payout * this.wager - this.wager;
          this.profit += profit;

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
          
          // console.log(
          //   `[Miss ${rollCount}]: Payout:${this.getPayout()}, Profit: ${
          //     this.profit
          //   }, Wager: ${this.wager}, Max Wager: ${
          //     this.maxWager
          //   }, Overall Profit: ${profit}`
          // );
          if (this.riskOnLosingStreak % Math.ceil(this.getPayout() / 2) === 0) {
            this.attemptCount++;
            this.wager = this.baseWager * Math.pow(2, this.attemptCount);
            this.maxWager = Math.max(this.wager, this.maxWager);
          }
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
        return (
          this.getWinRatePercentOfTeo(10) < 20 &&
          this.getWinRatePercentOfTeo(20) < 30 &&
          this.getWinRatePercentOfTeo(30) < 40 &&
          this.getWinRatePercentOfTeo(40) < 50 &&
          this.getWinRatePercentOfTeo(50) < 60 &&
          this.getWinRatePercentOfTeo(60) < 70 &&
          this.getWinRatePercentOfTeo(70) < 80 &&
          this.getWinRatePercentOfTeo(80) < 90 &&
          this.getWinRatePercentOfTeo(90) < 90 &&
          this.getWinRatePercentOfTeo(100) < 90
        );
      }

      isRiskOffReady() {
        return this.getPL() > 0;
      }
    }

    class TargetManager {
      constructor(payouts, highPayout, decay = 0.95) {
        this.targets = payouts.map((p) => new Target(p));
        this.highTarget = new HighTarget(700000, 0.001, 1);
        this.lowTargets = this.targets.filter(
          (target) => target.getPayout() <= 3
        );
        this.riskOnTarget = null;
        this.profit = 0;
        this.cycleProfit = 0;
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

      getNextRiskOnTarget() {
        return this.getPivotTarget();
      }


      evalRiskState(result, baseWager) {
        this.highTarget.push(result);
        
        if (this.highTarget.isHitHalt()) {
          halt(this.highTarget.getHitHaltMessage())
          return;
        }
        if (this.highTarget.isInRecovery()) {
          this.evalRecoveryState();
        } else {
          this.evalNormalState(result);
        }
      }

      evalNormalState(result) {

        if (this.highTarget.isRecoveryReady()) {
          this.highTarget.enterRecovery();
        } else {
          this.highTarget.setBet();
        }
      }

      evalRecoveryState() {
        if (this.riskOnTarget !== null) {
          this.evalRiskOnState();
        }
        
        // Risk on state still valid, so adjust the wager if necessary
        // and return.
        if (this.riskOnTarget !== null)
          if (this.riskOnTarget !== null) {
            this.riskOnTarget.setBet();
            return;
          }

          this.riskOnTarget = this.getNextRiskOnTarget();

          // No target ready to go risk on.
          if (this.riskOnTarget === null) return; 
          this.riskOnTarget.goRiskOn(getBaseWager(), this.highTarget);
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
        this.targets.forEach((target) => {
          target.addResult(result);
        });
      }
    }

    return new TargetManager(generatePayouts());
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
</div>`;

    $("body").prepend(controlPanel);
  }

  function halt(stopMessage) {
    console.log(stopMessage);
    $("#message").text(stopMessage);
    stopMessage = "";
    if (!window.stopped) stopBetting();

    if (getIsTestMode()) {
      mbc.stop();
    }
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
