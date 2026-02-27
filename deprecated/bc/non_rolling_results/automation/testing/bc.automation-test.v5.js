/* Start Script */
// ==UserScript==
// @name         bc.game automation v3
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  try to take over the world!
// @author       You
// @match        https://*.game/game/limbo?automation=true
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bc.game
// @require https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const scenarios = {
    baseline: (target) => ({
      riskOnCheck: () => target.stats.getWinRateSensitiveLosingStreak() > target.getPayout() && target.getOverheadUnderPressureCount() > 0,
      riskOffCheck: () => target.getRiskOnLosingStreak() > target.getPayout(),
      progressiveBet: () => false
    }),
    winRate: (target) => ({
      riskOnCheck: () =>
        target.getWinRatePercentOfTeo(100) < 50 &&
        Math.abs(target.stats.getWinRateSensitiveLosingStreak()) >= target.payout &&
        target.getOverheadUnderPressureCount() >= 5,
      riskOffCheck: () => target.getOverheadUnderPressureCount() === 0 || (target.getPL() >= target.getPayout() * target.getWager() * 2),
      progressiveBet: () => false
    }),

    losingStreak: (target) => ({
      riskOnCheck: () =>
        target.getRiskOnLosingStreak() === 0 &&
        Math.abs(target.getLosingStreak()) >= target.payout * 2 &&
        target.getOverheadUnderPressureCount() >= 5,
      riskOffCheck: () => target.getOverheadUnderPressureCount() === 0 || (target.getPL() >= target.getPayout() * target.getWager() * 2),
      progressiveBet: () => false
    }),
    losingStreak2: (target) => ({
      riskOnCheck: () => target.stats.getWinRateSensitiveLosingStreak() > (target.getPayout() * 2),
      riskOffCheck: () => target.getRiskOnLosingStreak() > target.getPayout(),
      progressiveBet: () => false
    }),
    overheadratio: (target) => ({
      riskOnCheck: () =>
        Math.abs(target.getLosingStreak()) > target.payout * 2 &&
        target.getOverheadUnderPressureCount() > 3,
      riskOffCheck: () =>
        Math.abs(target.getRiskOnLosingStreak()) > target.payout,
      progressiveBet: () => false
    })
  };

  let firstLoad = true;
  let lastRollSet = [];
  let currentRollSet = [];
  let rollCount = 0;
  let losingStreak = 0;
  let stopped = true;
  let hitCount = 0;
  let prevProfit = 0;
  let cyclePL = 0;
  let riskOnCycle = 0;
  let cycleStarted = false;
  let cycleRollCount = 0;
  let riskOnTarget = null;

  // Fields
  let lsField = null;
  let minRatioField = null;
  let hardStopMaxLossField = null;
  let maxWagerField = null;
  let baseWagerField = null;
  let profitTargetField = null;
  let maxPayoutField = null;
  let basePayoutField = null;
  let bankRollField = null;
  let maxLossField = null;
  let maxRollsField = null;
  let winCount = 0;
  let loseCount = 0;
  const BASE_MIN_RATIO = 2.5;
  let minRatio = BASE_MIN_RATIO;

  let cycleCyount = 0;
  const highHit = {
    rollCount: 0,
    payout: 0,
    round: 0,
    push(result, highHitThreshold) {
      highHit.rollCount++;

      if (result > highHit.payout) {
        highHit.payout = result;
        highHit.round = highHit.rollCount;
      }
    },
    reset() {
      highHit.rollCount = 0;
      highHit.payout = 0;
      highHit.round = 0;
    },
    getSummary(rollCount) {
      return `${highHit.payout} || Delta: ${highHit.getRollDelta(rollCount)}`;
    },
    getRollDelta() {
      return highHit.rollCount - highHit.round;
    },
    getDeltaColor() {
      if (highHit.getRollDelta() >= highHit.payout * 3) {
        return "red";
      }
      return "transparent";
    },
    shouldHalt(threshold) {
      if (highHit.round === 0) return;
      return highHit.isThresholdExceeded(threshold);
    },
    isThresholdExceeded(threshold) {
      return highHit.getRollDelta() > highHit.payout * threshold;
    }
  };

  injectStatsPanel();

  /*
  *
  *
  *
  *
    TARGET MANAGER
  *
  *
  *
  */
  const tm = initTargetManager(scenarios.baseline);
  initWindowEvents();

  function evalResult(result) {
    rollCount++;

    tm.push(result, getHardStopMaxLoss());
    highHit.push(result);

    if (riskOnTarget) {
      evalRiskOn(result);
    } else {
      evalRiskOff();
    }

    updateUI();
    checkHalts(result);

    tm.renderRunSummaryToTable();
  }

  function evalRiskOn(result) {
    if (!riskOnTarget) return;

    if (result >= riskOnTarget.getPayout()) {
      cyclePL += riskOnTarget.getPayout() * riskOnTarget.getWager() - riskOnTarget.getWager();
      
      if (cyclePL > 0) {
        console.log("HIT Risk On Target", riskOnTarget.getPayout(), "going risk off with PL", cyclePL)
        clearRiskOn();
        riskOnCycle = 0;
        return;
      } else {
        riskOnCycle++;
              const nextTarget = tm.targets.first();
      const nextWager = getBaseWager();

      console.log("Hit but negative profit of, ", cyclePL, "starting over to", nextTarget.getPayout(), "with new wager", nextWager)

      setRiskOn(nextTarget, nextWager, riskOnCycle);
      return;

      }
    } else {
      cyclePL -= riskOnTarget.getWager();
    }


    const nextTarget = riskOnTarget.getNextTarget();

    // End of the line, start over
    if (!nextTarget) {
      riskOnCycle++;
      const nextTarget = tm.targets.first();
      const nextWager = Math.min(riskOnTarget.getWager() * 2, 0.25);

      console.log("End of the tline Risk On Target", riskOnTarget.getPayout(), "old wager", riskOnTarget.getWager(), "starting over to", nextTarget.getPayout(), "with new wager", nextWager)

      setRiskOn(nextTarget, nextWager, riskOnCycle);
      return;
    }

    const nextWager = riskOnTarget.getWager();

    console.log("MISS Risk On Target", riskOnTarget.getPayout(), "moving to", nextTarget.getPayout())

    setRiskOn(nextTarget, nextWager)
  }

  function evalRiskOff() {
    if (riskOnTarget) return;

    if (!tm.riskOnReady()) return;

    cyclePL = 0;

    let nextTarget = tm.targets.first();

    console.log("Risk On Target", nextTarget.getPayout(), "going risk on", getBaseWager())

    setRiskOn(nextTarget, getBaseWager(), 0)
  }

  function setRiskOn(target, wager, cycle) {
    clearRiskOn();

    if (!target || !wager) return;
    riskOnTarget = target;
    riskOnTarget.goRiskOn(wager, cycle);
    setWager(riskOnTarget.getWager());
    setPayout(riskOnTarget.getPayout());
  }

  function clearRiskOn() {
    if (!riskOnTarget) return;
    riskOnTarget.goRiskOff();
    setWager(0);
    setPayout(0);
    riskOnTarget = null;
  }

  function checkHalts(result) {
    const profit = tm.bankRoll.getPL();
    if (tm.bankRoll.shouldHalt()) {
      halt(`Hard stop max loss exceeded ${profit.toFixed(4)}`);
      return;
    }

    if (rollCount === getMaxRolls()) {
      halt(`Max rolls hit ${rollCount}`);
      return;
    }
  }

  function halt(stopMessage) {
    console.log(stopMessage);
    $("#message").text(stopMessage);
    stopMessage = "";
    stopBetting();

    if (getIsTestMode()) {
      //Mock BC Stop
      mbc.stop();
    }

    return;
  }

  function updateUI() {
    const profit = tm.bankRoll.getPL();

    $("#losing-streak").text(losingStreak);
    $("#hit-count").text(hitCount);
    $("#roll-count").html(`${rollCount}`);
    $("#profit-loss")
      .html(profit.toFixed(4))
      .css({
        backgroundColor: `${
          profit > 0 ? "green" : profit < 0 ? "red" : "transparent"
        }`
      });

    const r = tm.getTotalRatio();

    $("#total-ratio")
      .html(`${r.toFixed(3)}`)
      .css({ backgroundColor: `${r < 0 ? "red" : "transparent"}` });

    $("#high-hit")
      .html(`${highHit.getSummary(rollCount)}`)
      .css({ backgroundColor: highHit.getDeltaColor(rollCount) });
  }

  function getStopOnProfit() {
    return getProfitTarget() !== 0;
  }

  function getBasePayout() {
    if (!basePayoutField) {
      basePayoutField = $("#base-payout");
    }
    return Number(basePayoutField.val());
  }

  function getMaxRolls() {
    if (!maxRollsField) {
      maxRollsField = $("#max-rolls");
    }
    return Number(maxRollsField.val());
  }

  function getMaxPayout() {
    if (!maxPayoutField) {
      maxPayoutField = $("#max-payout");
    }
    return Number(maxPayoutField.val());
  }

  function getBaseWager() {
    if (!baseWagerField) {
      baseWagerField = $("#base-wager");
    }
    return Number(baseWagerField.val());
  }

  function getMaxWager() {
    if (!maxWagerField) {
      maxWagerField = $("#max-wager");
    }
    return Number(maxWagerField.val());
  }

  function getProfitTarget() {
    if (!profitTargetField) {
      profitTargetField = $("#profit-target");
    }
    return Number(profitTargetField.val());
  }

  function getMinRatio() {
    if (!minRatioField) {
      minRatioField = $("#min-ratio");
    }
    return -Number(minRatioField.val());
  }

  function getStopOnMaxLoss() {
    return getMaxLoss() !== 0;
  }

  function getStopOnHardStopMaxLoss() {
    return getHardStopMaxLoss() !== 0;
  }

  function getIsTestMode() {
    const inputField = $("#test-mode");
    return inputField.length !== 0 && inputField.prop("checked");
  }

  function getHardStopMaxLoss() {
    if (!hardStopMaxLossField) {
      hardStopMaxLossField = $("#hard-stop-max-loss");
    }
    return Number(hardStopMaxLossField.val());
  }

  function getMaxLoss() {
    if (!maxLossField) {
      maxLossField = $("#max-loss");
    }
    return Number(maxLossField.val());
  }

  function initWindowEvents() {
    Array.prototype.last = function () {
      return this[this.length - 1];
    };

    Array.prototype.first = function () {
      return this[0];
    };

    $("#set-risk-on-btn").click(function () {
      $("#set-risk-on-btn").hide();
      $("#set-risk-off-btn").show();
      $("#risk-on").prop("checked", true);
      $("#roll-mode").val("half-target");
      $("#hit-count-target").val(1);
      $("#profit-target").val(0.01);
    });

    $("#set-risk-off-btn").click(function () {
      $("#set-risk-on-btn").show();
      $("#set-risk-off-btn").hide();
      $("#risk-on").prop("checked", false);
      $("#roll-mode").val("none");
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
      containment: "window",
      scroll: false
    });

    $("#stats-panel").draggable({
      containment: "window",
      scroll: false
    });
  }

  function maxLossExceeded() {
    const profit = tm.bankRoll.getPL();
    if (profit >= 0) return;

    return Math.abs(profit) >= getMaxLoss();
  }

  function hardStopMaxLossExceeded(profit) {
    if (profit >= 0) return;

    return Math.abs(profit) >= getHardStopMaxLoss();
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
    setWager(0);
    setPayout(0);
    losingStreak = 0;
    hitCount = 0;
    stopped = false;
    doBet(); // Start the async loop
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

  function initTargetManager(scenario) {
    function generatePayouts() {


      return Array.from(
        {
          length: 100
        },
        (v, k) => 5 + k * 1
      );
    }

class BankRoll {
  constructor(lossLimit) {
    this.profit = 0;
    this.peakProfit = 0;
    this.lossLimit = lossLimit; // Now used as trailing drawdown
    this.haltMessage = null;
  }

  getPL = () => this.profit;
  getPeakPL = () => this.peakProfit;
  getDrawDown = () => this.peakProfit - this.profit;
  shouldHalt = () => this.haltMessage != null;

  push(wager, payout, stopLimit) {
    if (wager > 0) this.increment(wager, payout)
    if (wager < 0) this.decrement(wager, stopLimit)
  }

  increment(wager, payout) {
    this.profit += payout * wager - wager;

    // Update trailing high-water mark
    if (this.profit > this.peakProfit) {
      this.peakProfit = this.profit;
    }
  }

  decrement(wager, stopLimit) {
    this.profit += wager;

    // Check for trailing stop violation
    if (this.getDrawDown() >= stopLimit) {
      this.haltMessage = `[HALT] Trailing loss limit of ${stopLimit} exceeded (Drawdown: ${this.getDrawDown().toFixed(4)})`;
    }
  }
}


    class Stats {
      constructor(size, payout) {
        this.size = size;
        this.payout = payout;
        this.streak = 0;
        this.pstreak = 0;
        this.hitCount = 0;
        this.losingStreak = 0;
        this.winRateAtStreakStart = 0;
        this.buffer = new Array(size).fill(null);
        this.index = 0;
        this.count = 0;
        this.sum = 0;
        this.rollCount = 0;
        this.ratio = 0;
        this.breachRatio = 0;
        this.nextTarget = null;
        this.previousTarget = null;
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
          if (this.payout === 100) this.breachRatio = this.ratio;

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

        this.losingStreak = this.streak < 0 ? Math.abs(this.streak) : 0;
        
        if (this.losingStreak === 1) {
          this.winRateWasLowWhenStreakStarted = this.getWinRatePercentOfTeo(100) < 100
        } else if (this.losingStreak === 0) {
          this.winRateWasLowWhenStreakStarted = false;
        }
        
        this.ratio = this.getStreakDiff() / this.payout;
      };

      getWinRatePercentOfTeo = (lookback = 100) =>
        (this.getWinRate(lookback) / this.getTeo()) * 100;

      getRate = (lastN = this.count) => {
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

      getWinRate = (lookback = 10) => this.getRate(lookback);

      getTeo = () => 1 / (this.getPayout() * 1.05);

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
      getWinRateSensitiveLosingStreak = () => this.winRateWasLowWhenStreakStarted ? this.getLosingStreak() : 0
      getPayout = () => this.payout;
      getStreakDiff = () => this.streak + this.payout;
      getRatio = () => this.ratio;
    }

    class Target {
      constructor(payout, bankRoll, scenarioFn) {
        this.payout = payout;
        this.bankRoll = bankRoll;
        this.stats = new Stats(100, payout);
        this.rollCount = 0;
        this.nextTarget = null;
        this.previousTarget = null;
        this.losingStreak = 0;
        this.pstreak = 0;
        this.streakID = 1;
        this.streakIDSet = false;
        this.riskOffStreakID = 0;
        this.profit = 0;
        this.wager = 0;
        this.baseWager = 0;
        this.riskOn = false;
        this.isFlip = false;
        this.isBuoy = false;

        if (scenarioFn) {
          const { riskOnCheck, riskOffCheck, progressiveBet } = scenarioFn(this);
          this.riskOnCheck = riskOnCheck;
          this.riskOffCheck = riskOffCheck;
          this.progressiveBet = progressiveBet
        } else {
          this.riskOnCheck = () => false;
          this.riskOffCheck = () => false;
          this.progressiveBet = () => false;
        }

        // How many times this this target to risk on
        this.riskOnCount = 0;

        // Count of exit with profit
        this.winCount = 0;

        // Count of exit with loss
        this.loseCount = 0;
      }

      getWager = () => this.wager;

      setNextTarget(target) {
        this.nextTarget = target;
      }
      setPreviousTarget(target) {
        this.previousTarget = target;
      }

      getNextTarget = () => this.nextTarget;

      getOverheadRatioSum() {
        const nextTarget = this.getNextTarget();

        if (!nextTarget) return this.getRatio();
        return this.getRatio() + nextTarget.getOverheadRatioSum();
      }

      getOverheadCount() {
        const next = this.getNextTarget();
        if (!next) return 1; // count self
        return 1 + next.getOverheadCount();
      }

      getOverheadUnderPressureCount() {
        const next = this.getNextTarget();
        const selfCount = this.getRatio() < 0 ? 1 : 0;

        if (!next) return selfCount;

        return selfCount + next.getOverheadUnderPressureCount();
      }

      getOverheadRatioAvg() {
        if (this.getOverheadCount() === 0) return this.getOverheadRatioSum();
        return this.getOverheadRatioSum() / this.getOverheadCount();
      }

      getPreviousTarget = () => this.previousTarget;

      getPayout() {
        return this.payout;
      }

      getRiskOnLosingStreak = () => this.losingStreak;

      isDifferentRiskOnCycle = () => this.getRiskOnLosingStreak() === 0

      push(result, stopLimit) {
        this.updateStreak(result);

        if (this.isRiskOn()) {
          this.updateRiskOnStats(result, stopLimit);
        }
        this.stats.push(result);
      }

      updateStreak(result) {
        if (!this.isRiskOn() && this.losingStreak === 0) return; // Continue to count the losing steak even if it goes risk off

        if (result >= this.payout) {
          if (this.losingStreak > 0) this.pstreak = this.losingStreak;
          this.losingStreak = 0;
        } else {
          this.losingStreak++;
        }
      }

      updateRiskOnStats(result, stopLimit) {
        this.rollCount++;
        
        if (result >= this.payout) {
          this.profit += this.payout * this.wager - this.wager;
          this.bankRoll.push(this.wager, this.payout, stopLimit);
        } else {
          this.profit -= this.wager;
          this.bankRoll.push(-this.wager, this.payout, stopLimit);
        }
      }

      getPL = () => this.profit;

      getScaledWager(cycle) {
        const decrementor = cycle / 100
        const baseFactor = 1.5;
        const scalingFactor = baseFactor - decrementor;
        return this.baseWager * Math.pow(1.92 / this.getPayout(), scalingFactor)
      }


      getLSEqualsPayoutMod(divisor = 1) {
        if (this.losingStreak === 0) return false;

        return this.losingStreak % Math.floor(this.payout / divisor) === 0;
      }

      shouldGoRiskOff() {
        return this.riskOffCheck();
      }

      riskOnReady() {
        return this.isDifferentRiskOnCycle() && this.riskOnCheck();
      }

      goRiskOn(baseWager, cycle = 0) {
        this.baseWager = baseWager
        this.wager = this.getScaledWager(cycle);
        this.profit = 0;
        this.losingStreak = 0;
        this.riskOn = true;
        this.riskOnCount++;
      }

      goRiskOff() {
        if (this.profit > 0) {
          this.winCount++;
        } else {
          this.loseCount++;
        }
        this.losingStreak = 0;
        this.riskOn = false;
        this.wager = 0;
        this.profit = 0;
      }

      getRiskOnCount = () => this.riskOnCount;
      getWinCount = () => this.winCount;
      getLoseCount = () => this.loseCount;
      getWinLoseRatio() {
        if (this.loseCount === 0) return 1;
        return this.winCount / this.loseCount;
      }
      isRiskOn = () => this.riskOn;
      getWinRatePercentOfTeo = (lookback = 100) =>
        this.stats.getWinRatePercentOfTeo(lookback);
      getStreak = () => this.stats.getStreak();
      getLosingStreak = () => this.stats.getLosingStreak();
      getPreviousLosingStreak = () => this.pstreak;
      getTeo = () => this.stats.getTeo();
      getHitCount = () => this.stats.getHitCount();
      getRollCount = () => this.rollCount;
      getRatio = () => this.stats.getRatio();
    }

    class TargetManager {
      constructor(targets, bankRoll) {
        this.targets = targets;
        this.bankRoll = bankRoll;
        this.totalRatio = 0;
        this.past10Ratios = [];
        this.past5Ratios = [];
        this.ratioThresholdBreached = false;
        this.riskOnChecksPassed = false;
      }

      renderRunSummaryToTable() {
        const tableData = this.targets.map((target) => ({
          Payout: target.getPayout(),
          Rolls: target.getRollCount(),
          Ratio: target.getRatio().toFixed(3),
          "Negative Overhead Ratio": target.getOverheadUnderPressureCount(),
          "Risk On": target.isRiskOn(),
          "Flip Target": target.isFlip,
          "Buoy Target": target.isBuoy,
          "Risk On Losing Streak": target.getRiskOnLosingStreak(),
          "Bets Taken": target.getRiskOnCount(),
          "Bets Won": target.getWinCount(),
          "Bets Lost": target.getLoseCount(),
          "W/L Ratio": target.getWinLoseRatio().toFixed(2),
          Drawdown: target.getPreviousLosingStreak(),
          "Final P/L": target.profit.toFixed(2),
          _highlightFlip: target.isFlip,
          _highlightBuoy: target.isBuoy
        }));

        const tableEl = document.getElementById("summary-table");
        if (!tableEl) return;

        const headers = Object.keys(tableData[0] || {}).filter(
          (h) => h !== "_highlight"
        );

        tableEl.innerHTML = `
    <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>
      ${tableData
        .map((row) => {

          let style = "";

          if (row._highlightBuoy) {
            style = `style="background-color: red; color: #222; font-weight: bold;"`
          } else if (row._highlightFlip) {
            style = `style="background-color: lightblue; color: #222; font-weight: bold;"`
          }

          return `<tr ${style}>${headers
            .map((h) => `<td>${row[h]}</td>`)
            .join("")}</tr>`;
        })
        .join("")}
    </tbody>
  `;
      }

      getTotalRatio = () => this.totalRatio;

      getIsFalling = () => this.getPast5AvgRatio() < this.getPast10AvgRatio();

      getIsRising = () => this.getPast5AvgRatio() > this.getPast10AvgRatio();

      getPast10AvgRatio() {
        const count = this.past10Ratios.length;
        return this.past10Ratios.reduce((sum, v) => sum + v, 0) / count;
      }

      getPast5AvgRatio() {
        const count = this.past5Ratios.length;
        return this.past5Ratios.reduce((sum, v) => sum + v, 0) / count;
      }

      setRecoveryFlips() {
        const totalRatio = this.getTotalRatio();
        if (totalRatio >= 0) return { flipsRequired: 0, targets: [] };

        // Step 1: Filter negative targets and sort by absolute ratio descending
        const negativeTargets = this.targets
          .filter(t => t.getRatio() < 0)
          .sort((a, b) => Math.abs(b.getRatio()) - Math.abs(a.getRatio()));

        let simulatedTotal = totalRatio;

        let previousTarget = null;

        for(let i = 0; i < negativeTargets.length; i++) {
          const target = negativeTargets[i];
          const r = target.getRatio();
          simulatedTotal += Math.abs(r) * 2; // flipping -X to +X adds 2X
          target.isFlip = true;

          if (previousTarget !== null) {
            previousTarget.isBuoy = false;
          }
          target.isBuoy = true;
          previousTarget = target
          if (simulatedTotal >= 0) break;
        }
      }

      riskOnReady() {
        return false;
      }

      push(result, stopLimit) {
        this.totalRatio = 0;
        this.totalBreachRatio = 0;

        for (let i = 0; i < this.targets.length; i++) {
          const t = this.targets[i];
          t.isFlip = false;
          t.isBuoy = false;
          t.push(result, stopLimit);
          this.totalRatio += t.getRatio();
        }
        this.setRecoveryFlips();
      }
    }

    const bankRoll = new BankRoll();
    const targets = generatePayouts().map(
      (payout) => new Target(payout, bankRoll, scenario)
    );

    for (let i = 0; i < targets.length; i++) {
      const current = targets[i];
      const next = targets[i + 1] || null;
      const prev = targets[i - 1] || null;

      current.setNextTarget(next);
      current.setPreviousTarget(prev);
    }

    return new TargetManager(targets, bankRoll);
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

  function injectStatsPanel() {
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

      tr.highlight {
        background-color: #fff3b0; /* pale yellow */
        color: #333; /* dark text for contrast */
        font-weight: bold;
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
      <div>Profit / Loss: <span id="profit-loss"></span></div>
      <div>Roll Count: <span id="roll-count"></span></div>
      <div>Hit Count: <span id="hit-count"></span></div>
      <div>High Hit: <span id="high-hit"></span></div>
      <div>Total Ratio: <span id="total-ratio"></span></div>
   </div>


   <div class="button-group">
      <button id="start-betting-btn">Start Betting</button>
      <button id="stop-betting-btn" style="display: none;">Stop Betting</button>
      <button id="set-risk-on-btn" style="display: none;">Risk On</button>
      <button id="set-risk-off-btn">Risk Off</button>
      <button id="zero-wager-btn">Zero Wager</button>
   </div>


   <div class="control-group">
      <label>Base Payout</label>
      <input type="number" id="base-payout" value="2"  />
   </div>
   <div class="control-group">
      <label>Max Payout</label>
      <input type="number" id="max-payout" value="100"  />
   </div>
   <div class="control-group">
      <label>Base Wager</label>
      <input type="number" id="base-wager" value="0.01"  />
   </div>
   <div class="control-group">
      <label>Max Wager</label>
      <input type="number" id="max-wager" value="0.10"  />
   </div>
   <div class="control-group">
      <label>Hard Stop Max Loss</label>
      <input type="number" id="hard-stop-max-loss" value="1"  />
   </div>
   <div class="control-group">
      <label>Profit Target</label>
      <input type="number" id="profit-target" value="5"  />
   </div>
    <div class="control-group">
      <label>Min Ratio</label>
      <select id="min-ratio" >
         <option value="0">0</option>
         <option value="0.25">0.25</option>
         <option value="0.50">0.50</option>
         <option value="0.75">0.75</option>
         <option value="1.25">1.25</option>
         <option value="1.50">1.50</option>
         <option value="1.75">1.75</option>
         <option value="1.75">1.75</option>
         <option value="2.25">2.25</option>
         <option value="2.50">2.50</option>
         <option value="2.75">2.75</option>
         <option value="2.75">2.75</option>
         <option value="3" selected>3</option>
         <option value="4">4</option>
         <option value="5">5</option>
         <option value="6">6</option>
         <option value="7">7</option>
         <option value="8">8</option>
         <option value="9">9</option>
         <option value="10">10</option>
      </select>
   </div>
</div>`;

    $("body").prepend(controlPanel);
  }
  doInit();

  // Initialize MutationObserver
})();
