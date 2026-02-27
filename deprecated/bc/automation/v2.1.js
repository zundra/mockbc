/* Start Script */
// ==UserScript==
// @name         bc.game automation v2
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
  let maxLossField = null;
  let fastWinRateThresholdField = null;
  let slowWinRateThresholdField = null;
  let riskPctField = null;
  let profitTargetField = null;
  let lsThreshold = null;

  injectControlPanel();

  initWindowEvents();

  function evalResult(result) {
    rollCount++;

    if (rollCount === 5000) {
      mbc.stop();
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
        if (
          target.isRiskOnReady(
            getLSThreshold(),
            getFastWinRateThreshold(),
            getSlowWinRateThreshold()
          )
        ) {
          riskOnTarget = target;
          lastRiskOnPayout = riskOnTarget.getPayout();
          riskOnTarget.goRiskOn(getBaseWager());
          break;
        }
      }
    } else {
      setWager(riskOnTarget.getWager());
      setPayout(riskOnTarget.getPayout());
    }

    updateUI(result);
  }

  function updateUI(result) {
    $("#profit-loss").html(profit.toFixed(4));
    $("#exit-pl").html(exitPL.toFixed(4));
    $("#roll-count").html(rollCount);

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
        this.riskOnLosingStreak = 0;
        this.riskOnRollCount = 0;
        this.wager = 0;
        this.baseWager = 0;
        this.maxWager = 0;
        this.profit = 0;
        this.riskOnHitCount = 0;
        this.emaTrackers = {};

        for (const lb of this.lookbacks) {
          this.emaTrackers[lb] = { value: 0, alpha: 2 / (lb + 1) };
        }
      }

      getPL = () => this.profit;

      goRiskOn(wager) {
        this.baseWager = this.getScaledWager(wager);
        // console.log(
        //   `[Going risk on with] Payout: ${this.getPayout()} and wager: ${
        //     this.baseWager
        //   }`
        // );
        this.wager = this.baseWager;
        this.riskOn = true;
        this.riskOnLosingStreak = 0;
        this.riskOnRollCount = 0;
        this.currentAttempts = 0;
        this.profit = 0;
        this.attemptCount = 1;
        this.riskOnHitCount = 0;
      }

      goRiskOff() {
        // console.log(
        //   `Risk off: profit ${profit} on payout ${this.getPayout()}, max wager was ${
        //     this.maxWager
        //   }`
        // );
        this.wager = 0;
        this.riskOn = false;
        this.riskOnLosingStreak = 0;
        this.currentAttempts = 0;
        this.attemptCount = 1;
        this.riskOnHitCount = 0;
        this.cooldown = Math.ceil(this.payout * 10);
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
        this.riskOnRollCount++;

        if (result >= this.getPayout()) {
          this.riskOnHitCount++;
          this.profit += this.payout * this.wager - this.wager;
            console.log(
              `[Target Hit (${rollCount})] 
              Wager=${this.wager}, 
              Profit=${this.profit}, 
              riskOnRollCount=${this.riskOnRollCount},
              attemptCount=${this.attemptCount}`
            );

            if (this.isRiskOffReady()) {
              this.goRiskOff();
              return;
            }
        } else {
    
          this.riskOnLosingStreak++;
          this.profit -= this.wager;

          if (this.isRiskOffReady()) {
            this.goRiskOff();
            return;
          }

          console.log(
            `[Target Miss (${rollCount})] 
            Wager=${this.wager}, 
            Profit=${this.profit}, 
            riskOnRollCount=${this.riskOnRollCount},
            riskOnHitCount=${this.riskOnHitCount},
            attemptCount=${this.attemptCount}`
          );
        }

        if (this.riskOnRollCount % 25 === 0) {
          this.wager = this.getDynamicWager(this.wager);
        }
      }

 getExpectedHits() {
  return (this.riskOnRollCount / this.payout);
}

 getHitDelta() {
  return this.riskOnHitCount - this.getExpectedHits();
}

 getPerformanceRatio() {
  const expected = this.getExpectedHits();
  if (expected <= 0) return 1; // avoid div/0
  return this.riskOnHitCount / expected;  // >1 = overperforming, <1 = underperforming
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

      getWinRate(lookback = this.lookbacks[this.lookbacks.length - 1]) {
        if (this.payout === 5)
        return this.emaTrackers[lookback]?.value ?? null;
      }
      
      getApproxHits(lb, rollCount) {
        const tracker = this.emaTrackers[lb];
        if (!tracker) return 0;

        // tracker.value ~ hit probability (smoothed)
        // Multiply by rollCount to approximate "effective hit count"
        return Math.floor(tracker.value * rollCount);
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

       shouldGoRiskOff(overPerfThreshold = 2.0) {
        const ratio = this.getPerformanceRatio(this.riskOnHitCount, this.payout, this.riskOnRollCount);
        return ratio >= overPerfThreshold;
      }

      isRiskOffReady() {
        if (this.shouldGoRiskOff()) {
          const ratio = this.getPerformanceRatio(this.riskOnHitCount, this.payout, this.riskOnRollCount)
          console.log(`Risk off ready hits over performed, Ratio: ${ratio}`);
            return true;
        }

          if (this.getPL() >= (this.getPayout() * this.baseWager * 2)) {
            console.log(`Risk off ready on big win ${this.profit}`)
            return true;
          }

          if (this.attemptCount === 2 && this.getPL() > (this.getPayout() * this.baseWager * 1.25)) {
            console.log(`Risk off risk off on attempt ${this.attemptCount} with ${this.profit}`)
            return true;
          }

          if (this.attemptCount > 2 && this.getPL() > 0) {
            console.log(`Risk off risk off on attempt ${this.attemptCount} with ${this.profit}`)
            return true;
          }
      }

      isRiskOnReady(baseLsThreshold, fastThreshold, slowThreshold) {
        if (this.checkCooldown()) {
          const shortWR = this.getWinRatePercentOfTeo(50);
          const longWR = this.getWinRatePercentOfTeo(200);
          // console.log(
          //   `[COOL DOWN] Short Win Rate: ${shortWR}, Long Win Rate: ${longWR}, Cooldown: ${this.cooldown}`
          // );
          return false;
        }
        const dynamicThreshold = this.dynamicStreakThreshold(baseLsThreshold);
        return (
          // this.streakExceedsThreshold(dynamicThreshold) &&
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
    }

    class TargetManager {
      constructor(payouts, decay = 0.95) {
        this.targets = payouts.map((p) => new Target(p));
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
      const payout = getPayout(); // whatever’s currently selected in UI
      const maxAllowed = getDynamicMaxWager(payout);
      amount = Math.min(amount, maxAllowed);

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
