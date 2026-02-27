/* Start Script */
// ==UserScript==
// @name         bc.game automation v1
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

  const SCRIPT_NAME = "baseline";

  let lastRollSet = [];
  let currentRollSet = [];
  let stopped = true;
  let rollCount = 0;

  injectControlPanel();

  initWindowEvents();

  const BET_ENGINE = generateBetEngine();

  function evalResult(result) {
    rollCount++;
    BET_ENGINE.push(result);
    updateUI(result);
  }

  function updateUI(result) {
    const riskOnTarget = BET_ENGINE.getRiskOnTarget();

    $("#profit-loss").html(BET_ENGINE.bankRoll.getPL().toFixed(4));
    // $("#exit-pl").html(exitPL.toFixed(4));
    $("#roll-count").html(rollCount);
    $("#state").html(BET_ENGINE.rollState.getState());
    // if (riskOnTarget) {
    //   const payout = riskOnTarget.getPayout();
    //   const maxAllowed = getDynamicMaxWager(payout);
    //   $("#max-allowed-wager").html(maxAllowed.toFixed(6));
    // } else {
    //   $("#max-allowed-wager").html("-");
    // }

    // if (riskOnTarget) {
    //   $("#ls").html(riskOnTarget.getLosingStreak());
    //   $("#risk-on-ls").html(riskOnTarget.getRiskOnLosingStreak());
    //   $("#risk-on-payout").html(riskOnTarget.getPayout());
    // }
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
    BET_ENGINE.getTargets().forEach((t) => {
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

      // Reset EMA trackers
      for (const lb in t.emaTrackers) {
        t.emaTrackers[lb].value = 0;
      }
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

  function generateBetEngine() {
    class BankRoll {
      constructor(
        hardStopLimit,
        drawDownLimit,
        profitTarget,
        isAutomation = false
      ) {
        this.profit = 0;
        this.peakProfit = 0;
        this.hardStopLimit = hardStopLimit;
        this.drawDownLimit = drawDownLimit;
        this.profitTarget = profitTarget;
        this.drawDown = 0;
        this.outcome = { message: "", action: "" };
        this.isAutomation = isAutomation;
      }

      getIsAutomation = () => this.isAutomation;
      getHardStopLimit = () => this.hardStopLimit;
      getDrawDownLimit = () => this.drawDownLimit;
      getPeakProfit = () => this.peakProfit;
      getDrawDown = () => this.drawDown;
      getPL = () => this.profit;
      push(wager, payout, isWin) {
        if (isWin) {
          this.increment(wager, payout);
        } else {
          this.decrement(wager);
        }
        this.evalOutcome();
      }

      increment(wager, payout) {
        this.profit += payout * wager - wager;
        this.peakProfit = Math.max(this.profit, this.peakProfit);
      }

      decrement(wager) {
        this.profit -= wager;
        this.drawDown = Math.min(this.drawDown, this.profit);
      }

      evalOutcome() {
        const profit = this.getPL();
        const peakProfit = this.getPeakProfit();
        const hardStopLimit = this.getHardStopLimit();
        if (this.getIsAutomation()) {
          const drawDownLimit = this.getDrawDownLimit();
          if (profit < 0 && Math.abs(profit) >= drawDownLimit) {
            this.outcome.message = `Draw down limit hit: Profit ${profit.toFixed(
              4
            )}, Limit ${drawDownLimit.toFixed(4)}`;
            this.outcome.action = "RECOVER";
            return;
          }
        }

        if (profit <= peakProfit - hardStopLimit) {
          this.outcome.message = `Trailing max loss hit: Profit ${profit.toFixed(
            4
          )}, Peak ${peakProfit.toFixed(4)}`;
          this.outcome.action = "HALT";
          return;
        }

        if (profit < 0 && Math.abs(profit) >= hardStopLimit) {
          this.outcome.action = "HALT";
          this.message = `[${
            this.outcome.action
          }] Loss limit hit ${hardStopLimit} hit ${profit.toFixed(4)}`;
          return;
        }

        if (profit >= this.profitTarget) {
          this.outcome.action = "HALT";
          this.message = `[${
            this.outcome.action
          }] Profit target hit ${hardStopLimit} hit ${profit.toFixed(4)}`;
          return;
        }

        this.outcome = { message: "", action: "" };
      }
      getShouldHalt = () => this.outcome.action === "HALT";
      getHaltMessage = () => this.outcome.message;
      getShouldRecover = () => this.outcome.action === "RECOVER";
    }

    class RollState {
      constructor() {
        this.STATES = {
          riskon: "RISKON",
          recovery: "RECOVERY",
          analysis: "ANALYSIS"
        };
        this.state = this.STATES.analysis;
      }

      getState = () => this.state;
      setRiskOn() {
        this.state = this.STATES.riskon;
      }
      setRecovery() {
        this.state = this.STATES.recovery;
      }
      setRiskAnalysis() {
        this.state = this.STATES.analysis;
      }

      getIsRecovery = () => this.state === this.STATES.recovery;
      getIsRiskOn = () => this.state === this.STATES.riskon;

      getWagerHandler() {
        switch (this.state) {
          case "RISKON":
            return "RISKON";
            break;
          case "RECOVERY":
            return "RECOVERY";
            break;
          default:
            return "ANALYSIS";
        }
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
        this.wager = 0;
        this.baseWager = 0;
        this.profit = 0;

        this.emaTrackers = {};

        for (const lb of this.lookbacks) {
          this.emaTrackers[lb] = { value: 0, alpha: 2 / (lb + 1) };
        }
      }

      getPL = () => this.profit;

      goRiskOn(wager) {
        this.baseWager = wager;
        this.wager = this.baseWager;
        console.log(
          `Target ${this.getPayout()} going risk on with wager ${
            this.wager
          } and base wager ${this.baseWager}`
        );
        this.riskOn = true;
        this.riskOnLosingStreak = 0;
        this.currentAttempts = 0;
        this.profit = 0;
        this.attemptCount = 0;
      }

      goRiskOff() {
        this.wager = 0;
        this.riskOn = false;
        this.riskOnLosingStreak = 0;
        this.currentAttempts = 0;
        this.attemptCount = 0;
      }

      getPayout() {
        return this.payout;
      }

      getWager = () => this.wager;

      push(result) {
        const hit = result >= this.payout;

        if (this.getRiskOn()) {
          this.addRiskOnResult(result);
        } else {
          this.addRiskOffResult(result);
        }

        for (const lb in this.emaTrackers) {
          const tracker = this.emaTrackers[lb];
          tracker.value =
            tracker.alpha * (hit ? 1 : 0) + (1 - tracker.alpha) * tracker.value;
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
        if (result >= this.getPayout()) {
          // WIN
          this.profit += this.payout * this.wager - this.wager;

          if (this.profit > this.baseWager * this.payout) {
            console.log(
              "Risk off: profit target hit on payout",
              this.getPayout()
            );
            this.goRiskOff();
          } else {
            // Partial recovery → unwind half-step
            this.attemptCount = Math.floor(this.attemptCount / 2);
            this.wager = this.baseWager * Math.pow(2, this.attemptCount);
            console.log(
              `Win but still underwater → attemptCount=${this.attemptCount}, wager=${this.wager}`
            );
          }
        } else {
          // LOSS
          this.riskOnLosingStreak++;
          this.profit -= this.wager;

          if (
            this.riskOnLosingStreak % Math.floor(this.getPayout() / 2) ===
            0
          ) {
            this.attemptCount++;
            if (
              this.attemptCount >= 5 &&
              this.getWinRatePercentOfTeo(100) > 100
            ) {
              console.log(
                "Risk off: overheated loser on payout",
                this.getPayout()
              );
              this.goRiskOff();
              return;
            }
            this.wager = this.baseWager * Math.pow(2, this.attemptCount);
            console.log(
              `Loss streak checkpoint → attemptCount=${this.attemptCount}, wager=${this.wager}`
            );
          }
        }
      }

      getWinRate(lookback = this.lookbacks[this.lookbacks.length - 1]) {
        return this.emaTrackers[lookback]?.value ?? null;
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

      isRiskOnReady(baseLsThreshold, fastThreshold, slowThreshold) {
        const dynamicThreshold = this.dynamicStreakThreshold(baseLsThreshold);
        return (
          this.rollCount >= 100 &&
          this.streakExceedsThreshold(dynamicThreshold) &&
          this.getWinRatePercentOfTeo(50) < fastThreshold &&
          this.getWinRatePercentOfTeo(100) < slowThreshold
        );
      }
    }
    class BetEngine {
      constructor() {
        this.baseWagerField = null;
        this.maxLossField = null;
        this.fastWinRateThresholdField = null;
        this.slowWinRateThresholdField = null;
        this.riskPctField = null;
        this.profitTargetField = null;
        this.lsThreshold = null;

        this.targets = this.generateTargets();
        this.bankRoll = new BankRoll(
          this.getHardStopLimit(),
          this.getDrawDownLimit(),
          this.getProfitTarget(),
          true
        );
        this.rollState = new RollState();
        this.riskOnTarget = null;
      }

      push(result) {
        this.analyzeResult(result);
        this.checkState(result);
        this.setNextBet();
      }

      analyzeResult(result) {
        for (let i = 0; i < this.targets.length; i++) {
          const target = this.targets[i];
          target.push(result);
        }

        const payout = this.getPayout();
        const wager = this.getWager();

        this.bankRoll.push(wager, payout, result >= payout);
      }

      checkState(result) {
        if (this.bankRoll.getShouldHalt()) {
          this.halt(this.bankRoll.getHaltMessage());
          return;
        }

        if (this.bankRoll.getShouldRecover()) {
          this.rollState.setRecovery();
          this.setWatchMode();
        }
      }

      setNextBet() {
        if (this.rollState.getIsRecovery()) {
          this.setRecoveryBet();
        } else {
          this.setStandardBet();
        }
      }

      setRecoveryBet() {
        // set recovery wgger and payout;
        console.log("RECOVERY STUB");
        this.setWatchMode();
      }

      setStandardBet() {
        const nextTarget = this.getNextRiskOnTarget();

        if (!this.riskOnTarget && nextTarget) {
          this.riskOnTarget = nextTarget;
          this.riskOnTarget.goRiskOn(this.getScaledWager());
          this.setWager(this.riskOnTarget.getWager());
          this.setPayout(this.riskOnTarget.getPayout());
        } else {
          this.setWatchMode();
        }
      }

      halt(stopMessage) {
        console.log(stopMessage);
        $("#message").text(stopMessage);
        stopMessage = "";
        if (!stopped) stopBetting();

        return;
      }

      getNextRiskOnTarget = () =>
        this.targets.find((t) =>
          t.isRiskOnReady(
            this.getLSThreshold(),
            this.getFastWinRateThreshold(),
            this.getSlowWinRateThreshold()
          )
        );

      setWatchMode() {
        this.setWager(0);
        this.setPayout(1.01);
      }
      getRiskOnTarget = () => this.riskOnTarget;
      getTargets = () => this.targets;
      getWager() {
        if (this.getIsTestMode()) {
          return Number($("#wager").val());
        }

        const payoutFieldGroup = $('div[role="group"]').has(
          'label:contains("Amount")'
        );
        const inputField = payoutFieldGroup.find("input");

        return Number(inputField.val());
      }

      setWager(amount) {
        const payout = this.getPayout(); // whatever’s currently selected in UI
        const maxAllowed = this.getDynamicMaxWager(payout);
        amount = Math.min(amount, maxAllowed);

        if (this.getIsTestMode()) {
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

      setPayout(amount) {
        if (this.getIsTestMode()) {
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

      getPayout() {
        if (this.getIsTestMode()) {
          return Number($("#payout").val());
        }

        const payoutFieldGroup = $('div[role="group"]').has(
          'label:contains("Payout")'
        );
        const inputField = payoutFieldGroup.find("input");

        return Number(inputField.val());
      }

      getBalance() {
        if (getIsTestMode()) {
          return Number($("#balance").val());
        }

        let rawText = $(".ml-3 .font-extrabold").text().trim();
        return parseFloat(rawText.replace(/[^\d.]/g, ""));
      }

      getBaseWager() {
        if (!this.baseWagerField) {
          this.baseWagerField = $("#base-wager");
        }
        return Number(this.baseWagerField.val());
      }

      getRiskPercentOfBankroll() {
        if (!this.riskPctField) {
          this.riskPctField = $("#risk-pct");
        }
        return Number(this.riskPctField.val()) / 100;
      }

      getMaxLoss() {
        if (!this.maxLossField) {
          this.maxLossField = $("#max-loss");
        }
        return Number(this.maxLossField.val());
      }

      getProfitTarget() {
        if (!this.profitTargetField) {
          this.profitTargetField = $("#profit-target");
        }
        return Number(this.profitTargetField.val());
      }

      getFastWinRateThreshold() {
        if (!this.fastWinRateThresholdField) {
          this.fastWinRateThresholdField = $("#fast-win-rate-threshold");
        }
        return Number(this.fastWinRateThresholdField.val());
      }

      getSlowWinRateThreshold() {
        if (!this.slowWinRateThresholdField) {
          this.slowWinRateThresholdField = $("#slow-win-rate-threshold");
        }
        return Number(this.slowWinRateThresholdField.val());
      }

      getLSThreshold() {
        if (!this.lsThreshold) {
          this.lsThreshold = $("#ls-threshold");
        }
        return Number(this.lsThreshold.val());
      }

      getHardStopLimit() {
        if (!this.hardStopLimitField) {
          this.hardStopLimitField = $("#hard-stop-limit");
        }
        return Number(this.hardStopLimitField.val());
      }

      getDrawDownLimit() {
        if (!this.drawDownLimitField) {
          this.drawDownLimitField = $("#draw-down-limit");
        }
        return Number(this.drawDownLimitField.val());
      }

      getDynamicMaxWager(payout) {
        if (!this.riskOnTarget) return 0;

        const balance = this.getBalance();
        const riskPct = this.getRiskPercentOfBankroll();

        // Use target’s TEO if available, otherwise just 1/payout
        const teoFactor = this.riskOnTarget.getTeo() / payout;

        // Max risk allowed on this bet
        return balance * riskPct * teoFactor;
      }

      getIsTestMode() {
        const inputField = $("#test-mode");
        return inputField.length !== 0 && inputField.prop("checked");
      }

      getScaledWager(scalingFactor = 1.5) {
        return Math.max(
          1,
          0.5 * Math.pow(1.92 / this.riskOnTarget.getPayout(), scalingFactor)
        );
      }
      generateTargets() {
        return this.generatePayouts().map((p) => new Target(p));
      }

      generatePayouts() {
        return Array.from(
          {
            length: 41
          },
          (v, k) => 3 + k * 0.1
        );
      }
    }

    return new BetEngine();
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


   <div class="button-group">
      <button id="start-betting-btn">Start Betting</button>
      <button id="stop-betting-btn">Stop Betting</button>
      <button id="zero-wager-btn">Zero Wager</button>
      <button id="reset-btn">Reset</button>
   </div>


      <div class="control-group">
      <label>Base Wager</label>
      <input type="number" id="base-wager" value="0.0001" step="0.0001" />
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
      <label>Fast Win Rate Threshold</label>
      <input type="number" id="fast-win-rate-threshold" value="50"  />
   </div>

    <div class="control-group">
      <label>Slow Win Rate Threshold</label>
      <input type="number" id="slow-win-rate-threshold" value="80"  />
   </div>

       <div class="control-group">
      <label>LS Threshold</label>
      <input type="number" id="ls-threshold" value="3"  />
   </div>
</div>`;

    $("body").prepend(controlPanel);
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
