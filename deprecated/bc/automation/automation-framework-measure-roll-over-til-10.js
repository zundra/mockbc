/* Start Script */
// ==UserScript==
// @name         bc.game automation framework v1
// @namespace    http://tampermonkey.net/
// @version      1
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

  const FIRST_PAYOUT = 1.98;
  const MIN_WAGER = 0.0001;

let winrateChart;
  


  
  
  const scenarios = {
    baseline: (target) => ({
      riskOnCheck: () => Math.abs(target.getLosingStreak()) > target.payout,
      riskOffCheck: () =>
        Math.abs(target.getRiskOnLosingStreak()) > target.payout
    }),

    median: (target) => ({
      riskOnCheck: () =>
        target.stats.getMedian(100) < 1.92 &&
        Math.abs(target.getLosingStreak()) >= target.payout * 3,
      riskOffCheck: () =>
        Math.abs(target.riskOnStats.getLosingStreak()) > target.payout
    }),

    median: (target) => ({
      riskOnCheck: () =>
        target.stats.getMedian(100) < 1.92 &&
        Math.abs(target.getLosingStreak()) >= target.payout * 3,
      riskOffCheck: () =>
        Math.abs(target.riskOnStats.getLosingStreak()) > target.payout
    }),

    losingStreak: (target) => ({
      riskOnCheck: () =>
        target.getRiskOnLosingStreak() === 0 &&
        Math.abs(target.getLosingStreak()) >= target.payout * 3 &&
        target.getOverheadUnderPressureCount() >= 3,
      riskOffCheck: () =>
        Math.abs(target.getRiskOnLosingStreak()) > target.payout
    }),

    overheadratio: (target) => ({
      riskOnCheck: () =>
        Math.abs(target.getLosingStreak()) > target.payout * 2 &&
        target.getOverheadUnderPressureCount() > 3,
      riskOffCheck: () =>
        Math.abs(target.getRiskOnLosingStreak()) > target.payout
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
  let cycleProfit = 0;
  let cycleStarted = false;
  let cycleRollCount = 0;
  let riskOnTarget = null;
  let uiprofit = 0;

  // Fields
  let lsThresholdField = null;
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
  let shortWinRateThresholdField = null;
  let midWinRateThresholdField = null;
  let longWinRateThresholdField = null;
  let winCount = 0;
  let loseCount = 0;
  const BASE_MIN_RATIO = 2.5;
  let minRatio = BASE_MIN_RATIO;
  let rollNum = 0;

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
  const scenario = $("#scenario").val();
  const tm = initTargetManager(scenarios[scenario]);

    const windows = initRollingWindows();

  initWindowEvents();
  //initChart();
  let currentBaseWager = getBaseWager();
  function evalResult(result) {
    rollCount++;

    const payout = getPayout();
    const wager = getWager();

    if (result >= payout) {
      uiprofit += payout * wager - wager;
    } else {
      uiprofit -= wager;
    }

  

    tm.push(result);
    highHit.push(result);

    if (riskOnTarget) {
      evalRiskOn(result);
    } else {
      evalRiskOff();
    }

    updateUI();
  recordRoll(tm.targets.first().getLosingStreak() === 0 ? 1 : 0, uiprofit);
    checkHalts(result);

    tm.renderRunSummaryToTable();
  }

function recordRoll(isWin, profit) {
  rollNum++;
  Object.values(windows).forEach((w) => w.push(isWin));

  winrateChart.data.labels.push(rollNum);

  winrateChart.data.datasets.forEach((ds) => {
    if (ds.label.startsWith("WR-")) {
      const size = ds.label.split("-")[1];
      ds.data.push(windows[size].getWinRate());
    }
    if (ds.label.startsWith("TEO")) {
      const val = parseFloat(ds.label.match(/\d+(\.\d+)?/)[0]);
      ds.data.push(val);
    }
    // if (ds.label === "P/L") {
    //   ds.data.push(profit); // supply running profit from your sim
    // }
  });

  if (winrateChart.data.labels.length > 10000) {
    winrateChart.data.labels.shift();
    winrateChart.data.datasets.forEach((ds) => ds.data.shift());
  }

  winrateChart.update();
}

  function evalRiskOn(result) {
    if (!riskOnTarget) return;

    riskOnTarget.evalRiskOn();

    if (result >= riskOnTarget.getPayout()) {
      losingStreak = 0;
      hitCount++;
    } else {
      losingStreak++;
    }

    if (riskOnTarget.isRiskOffReady()) {
      riskOnTarget.goRiskOff();
      riskOnTarget = null;
    } else {
      riskOnTarget.setBet();
    }
  }

  function evalRiskOff() {
    riskOnTarget = tm.getNextRiskTarget();

    if (!riskOnTarget) return;

    riskOnTarget.goRiskOn(currentBaseWager, getProfitTarget());
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

    $("#ui-profit-loss")
      .html(uiprofit.toFixed(4))
      .css({
        backgroundColor: `${
          uiprofit > 0 ? "green" : uiprofit < 0 ? "red" : "transparent"
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

  function getLSThreshold() {
    if (!lsThresholdField) {
      lsThresholdField = $("#ls-threshold");
    }
    return Number(lsThresholdField.val());
  }

  function getShortWinRateThreshold() {
    if (!shortWinRateThresholdField) {
      shortWinRateThresholdField = $("#short-win-rate-threshold");
    }
    return Number(shortWinRateThresholdField.val());
  }

  function getMidWinRateThreshold() {
    if (!midWinRateThresholdField) {
      midWinRateThresholdField = $("#mid-win-rate-threshold");
    }
    return Number(midWinRateThresholdField.val());
  }

  function getLongWinRateThreshold() {
    if (!longWinRateThresholdField) {
      longWinRateThresholdField = $("#long-win-rate-threshold");
    }
    return Number(longWinRateThresholdField.val());
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
    return $("#test-mode").prop("checked");
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

// Rolling window tracker
class RollingWindow {
  constructor(size) {
    this.size = size;
    this.data = [];
  }
  push(val) {
    this.data.push(val);
    if (this.data.length > this.size) this.data.shift();
  }
  getWinRate() {
    if (this.data.length === 0) return 0;
    const wins = this.data.filter((v) => v === 1).length;
    return (wins / this.data.length) * 100;
  }
}

function initRollingWindows() {
    class RollingWindow {
      constructor(size) {
        this.size = size;
        this.data = [];
      }
      push(val) {
        this.data.push(val);
        if (this.data.length > this.size) this.data.shift();
      }
      getWinRate() {
        if (this.data.length === 0) return 0;
        const wins = this.data.filter((v) => v === 1).length;
        return (wins / this.data.length) * 100;
      }
    }
  // define your rolling windows
  const windows = {
    50: new RollingWindow(50),
    100: new RollingWindow(100),
    200: new RollingWindow(200),
  };

  const ctx = document.getElementById("winrateChart").getContext("2d");

  if (winrateChart) {
    winrateChart.destroy();
  }

  const datasets = Object.keys(windows).map((k, i) => ({
    label: `WR-${k}`,
    data: [],
    borderColor: `hsl(${i * 120}, 70%, 50%)`,
    yAxisID: "yWinRate",
    fill: false,
    tension: 0.1,
  }));

  // // add P/L dataset
  // datasets.push({
  //   label: "P/L",
  //   data: [],
  //   borderColor: "orange",
  //   backgroundColor: "rgba(255,165,0,0.2)",
  //   yAxisID: "yPL",
  //   fill: true,
  //   tension: 0.1,
  // });

  winrateChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: datasets,
    },
    options: {
      animation: false,
      scales: {
        yWinRate: {
          type: "linear",
          position: "left",
          min: 0,
          max: 100,
          title: { display: true, text: "Win Rate (%)" },
        },
        yPL: {
          type: "linear",
          position: "right",
          title: { display: true, text: "Profit/Loss" },
          grid: { drawOnChartArea: false },
        },
        x: { title: { display: true, text: "Roll #" } },
      },
    },
  });

  return windows; // so you can track WR-50/100/1000 externally
}

  function initTargetManager(scenario) {
    function generatePayouts() {
      return Array.from(
        {
          length: 1
        },
        (v, k) => FIRST_PAYOUT + k * 0.01
      );
    }

    class BankRoll {
      constructor(lossLimit) {
        this.profit = 0;
        this.lossLimit = -lossLimit;
        this.drawDown = 0;
        this.haltMessage = null;
      }

      getDrawDown = () => this.drawDown;
      getPL = () => this.profit;

      increment(wager, payout) {
        this.profit += payout * wager - wager;
      }

      shouldHalt = () => this.haltMessage != null;
      decrement(wager) {
        this.profit -= wager;
        this.drawDown = Math.min(this.drawDown, this.profit);

        if (this.getPL() <= this.lossLimit) {
          this.haltMessage = `[HALT] Loss limit ${
            this.lossLimit
          } exceeded ${this.getPL()}`;
        }
      }
    }

    class Stats {
      constructor(size, payout) {
        this.size = size;
        this.payout = payout;
        this.buffer = new Array(size).fill(null);
        this.index = 0;
        this.count = 0;
        this.sum = 0;
        this.hitCount = 0; // running count of hits >= payout
        this.losingStreak = 0;
        this.streakSignFlipped = false;
        this.streak = 0;
        this.pstreak = 0;
      }

      push(value) {
        if (value == null || Number.isNaN(value)) return; // ignore invalids

        // Remove old value if overwriting
        if (this.count >= this.size) {
          const old = this.buffer[this.index];
          this.sum -= old ?? 0;
          if (old >= this.payout) this.hitCount--;
        } else {
          this.count++;
        }

        // Add new value
        this.buffer[this.index] = value;
        this.sum += value;
        if (value >= this.payout) this.hitCount++;

        // Advance index
        this.index = (this.index + 1) % this.size;
        this.updateStreak(value >= this.payout);
      }

      updateStreak = (isHit) => {
        if (isHit) {
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
      };
      getValues = (lookback = this.count) => {
        const count = Math.min(lookback, this.count);
        const values = [];
        const start = (this.index - count + this.size) % this.size;
        for (let i = 0; i < count; i++) {
          const idx = (start + i) % this.size;
          values.push(this.buffer[idx]);
        }
        return values;
      };

      getSum = (lookback = this.count) => {
        lookback = Math.min(lookback, this.count);
        if (lookback === this.count) return this.sum;
        const vals = this.getValues(lookback);
        return vals.reduce((a, b) => a + b, 0);
      };

      getMean = (lookback = this.count) => {
        lookback = Math.min(lookback, this.count);
        if (lookback === 0) return 0;
        return this.getSum(lookback) / lookback;
      };

      getHitCount = (lookback = this.count) => {
        lookback = Math.min(lookback, this.count);
        if (lookback === this.count) return this.hitCount;
        const vals = this.getValues(lookback);
        return vals.filter((v) => v >= this.payout).length;
      };

      getHitRatePercent = (lookback = this.count) => {
        lookback = Math.min(lookback, this.count);
        if (lookback === 0) return 0;
        return (this.getHitCount(lookback) / lookback) * 100;
      };

      getEdgePercent = (lookback = this.count) => {
        lookback = Math.min(lookback, this.count);
        if (lookback === 0) return 0;
        const observedWinRate = this.getHitCount(lookback) / lookback;
        const teo = this.getTeo();
        return (observedWinRate / teo - 1) * 100; // % above/below TEO
      };

      getVariance = (lookback = this.count) => {
        const vals = this.getValues(lookback);
        if (vals.length <= 1) return 0;
        const mean = this.getMean(lookback);
        const sumOfSquares = vals.reduce((sum, v) => sum + (v - mean) ** 2, 0);
        return sumOfSquares / (vals.length - 1);
      };

      getStdDev = (lookback = this.count) =>
        Math.sqrt(this.getVariance(lookback));

      getMedian = (lookback = this.count) => {
        const vals = this.getValues(lookback);
        if (vals.length === 0) return null;
        const sorted = [...vals].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
      };

      getStreakDiff = () => this.streak + this.payout;
      getRatio = () => this.getStreakDiff() / this.payout;
      getWinRatePercentOfTeo = (lookback = 100) =>
        this.getHitRatePercent(lookback) / this.getTeo();

      getTeo = () => 1 / (this.payout * 1.04);
      getPayout = () => this.payout;
      getStreak = () => this.streak;
      getPStreak = () => this.pstreak;
      getLosingStreak = () => this.losingStreak;
    }

    class Target {
      constructor(payout, bankRoll, scenarioFn) {
        this.payout = payout;
        this.bankRoll = bankRoll;
        this.riskOffStats = this.stats = new Stats(10000, payout);
        this.riskOnStats = new Stats(10000, payout);
        this.rollCount = 0;
        this.nextTarget = null;
        this.previousTarget = null;
        this.wager = 0;
        this.baseWager = 0;
        this.holdWager = 0;
        this.riskOn = false;
        this.maxWager = 0;
        this.minRollOverTil10 = null;
        this.profitTarget = 0;
        this.profit = 0;
        this.cooldown = 0;
        this.startWinRatePercent = 0;
        this.lastWr50 = 0;
        this.lastWr100 = 0;
        if (scenarioFn) {
          const { riskOnCheck, riskOffCheck } = scenarioFn(this);
          this.riskOnCheck = riskOnCheck;
          this.riskOffCheck = riskOffCheck;
        } else {
          this.riskOnCheck = () => false;
          this.riskOffCheck = () => false;
        }

        // How many times this this target to risk on
        this.riskOnCount = 0;

        // How many times did the target roll over during the risk on cycle
        // this is reset when going risk on/off and the total is aggregated in the
        // totalRiskOnCycles variable
        this.riskOnCycle = 0;

        // Summation of the cycles
        this.totalRiskOnCycleCount = 0;

        // Count of exit with profit
        this.winCount = 0;

        // Count of exit with loss
        this.loseCount = 0;
      }

      getMinRollOverTil10 = () => this.minRollOverTil10;

      getWager = () => this.wager;

      setNextTarget(target) {
        this.nextTarget = target;
      }

isRiskOffReady() {
  return this.checkSignals().exit;


}


isRiskOnReady() {
  return this.checkSignals().entry;
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

      getRollOverTil10X = () => {
        const ls = this.getLosingStreak();
        const payout = this.getPayout();
        const tenx = payout * 10;
        return Math.ceil((tenx - ls) / Math.ceil(payout));
      };

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

      getRiskOnLosingStreak = () => {
        this.stats.getLosingStreak();
      };

      push(result) {
        this.rollCount++;
        const isHit = result >= this.payout;
        this.riskOffStats.push(result);

        if (this.riskOn) {
          this.riskOnStats.push(result);
        }

        this.updateBankRoll(isHit);
      }

      updateBankRoll(isHit) {
        if (isHit) {
          this.profit += this.payout * this.wager - this.wager;
          this.bankRoll.increment(this.wager, this.payout);
        } else {
          this.profit -= this.wager;
          this.bankRoll.decrement(this.wager);
        }
      }

      getPL = () => this.profit;


      riskOnReady() {
        return this.riskOnCheck();
      }

      evalRiskOn3() {
        if (!this.cooldown) this.cooldown = 0;

        const diff = this.startWinRatePercent - this.getWinRatePercentOfTeo(10);

        if (diff < 0 && this.wager !== 0) {
          this.holdWager = this.wager;
          this.wager = 0;
          this.cooldown = 3; // must wait 3 evals before re-entry
        } else if (diff > 0 && this.cooldown === 0) {
          this.wager = this.holdWager;

          if (this.getLosingStreak() > 0) {
            this.wager *= 2;
          }
        } else if (this.cooldown > 0) {
          this.cooldown -= 1;
          this.wager = 0; // still sitting out
        } else {
          this.wager = this.holdWager;
        }
      }

      evalRiskOn5() {
        const bankrollCap = 20 * 0.05; // 5% max
        const diff = this.startWinRatePercent - this.getWinRatePercentOfTeo(10);

        if (diff < 0 && this.wager !== 0) {
          this.holdWager = this.wager;
          this.wager = 0;
        } else if (diff > 0) {
          this.wager = Math.min(this.holdWager * 2, bankrollCap);

          if (this.getLosingStreak() > 0) {
            this.wager = Math.min(this.wager * 1.5, bankrollCap);
          }
        } else {
          this.wager = Math.min(this.holdWager, bankrollCap);
        }
      }

      evalRiskOn4() {
        const diff = this.startWinRatePercent - this.getWinRatePercentOfTeo(10);

        if (diff < 0 && this.wager !== 0) {
          this.holdWager = this.wager;
          this.wager = 0;
        } else if (diff > 0) {
          let scale = 1 + Math.min(Math.abs(diff) / 5, 1); // up to 2x
          this.wager = this.holdWager * scale;

          if (this.getLosingStreak() > 0) {
            this.wager *= 1.25; // add a streak bump
          }
        } else {
          this.wager = this.holdWager;
        }
      }

      evalRiskOn2() {
        const diff = this.startWinRatePercent - this.getWinRatePercentOfTeo(10);

        if (diff < 0 && this.wager !== 0) {
          this.holdWager = this.wager;
          this.wager = 0;
        } else if (diff > 0) {
          // Ramp in gradually
          if (this.wager === 0) {
            this.wager = this.holdWager * 0.25;
          } else if (this.wager < this.holdWager) {
            this.wager *= 2; // step back up
          } else {
            this.wager = this.holdWager;
          }

          if (this.getLosingStreak() > 0) {
            this.wager *= 1.5;
          }
        } else {
          this.wager = Math.max(this.baseWager, this.holdWager * 0.5); // idle mode
        }
      }

      evalRiskOn() {
        // const diff = this.startWinRatePercent - this.getWinRatePercentOfTeo(10);

        // if (diff < 0 && this.wager !== 0) {
        //   this.holdWager = this.wager;
        //   this.wager = 0;
        // } else if (diff > 0) {
        //   this.wager = this.holdWager;

        //   if(this.getLosingStreak() > 0) {
        //       this.wager *= 2;
        //   }
        // } else {
        //   this.wager = this.holdWager;
        // }

        this.wager = 1;
      }

      setBet() {
        setPayout(this.getPayout());
        setWager(this.getWager());
      }

      clearBet() {
        setWager(0);
        setPayout(1.01);
      }
      goRiskOn(wager, profitTarget) {
        this.baseWager = this.baseWager = this.holdWager = wager;
        this.startWinRatePercent = this.getWinRatePercentOfTeo(100);
        this.profitTarget = profitTarget;
        this.stats = this.riskOnStats;
        this.profit = 0;
        this.losingStreak = 0;
        this.riskOnCycle = 0;
        this.riskOn = true;
        this.riskOnCount++;
        this.setBet();
      }

      goRiskOff() {
        if (this.profit > 0) {
          this.winCount++;
          currentBaseWager = Math.max(0.0001, currentBaseWager - 0.0001);
        } else {
          currentBaseWager = Math.min(0.25, currentBaseWager + 0.001);
          this.loseCount++;
        }
        this.holdWager = 0;
        this.profitTarget = 0;
        this.stats = this.riskOffStats;
        this.totalRiskOnCycleCount += this.riskOnCycle;
        this.losingStreak = 0;
        this.riskOn = false;
        this.wager = 0;
        this.riskOnCycle = 0;
        this.profit = 0;
        this.startWinRatePercent = 0;
        this.clearBet();
      }

      getScaledWager(wager, scalingFactor = 1.5) {
        const scaledWager = Math.max(
          0.0001,
          wager * Math.pow(FIRST_PAYOUT / this.payout, scalingFactor)
        );

        return Math.max(MIN_WAGER, scaledWager);
      }

      getProgressiveWager() {
        let wager = this.wager;
        if (this.getLosingStreak() % Math.ceil(this.getPayout() / 2) === 0) {
          wager = Math.min(1, this.wager * 2);
        } else if (this.getLosingStreak() === 0) {
          if (this.getPL() > 0) {
            wager = this.baseWager;
          } else {
            wager = Math.max(this.baseWager, this.wager * 0.25);
          }
        }

        return wager;
      }

      // Micro-scale wager by win rate vs TEO (inverted logic)
      getProgressiveWager() {
        const teo = 100 / this.getPayout(); // expected win rate (%)
        const actual = this.getWinRatePercentOfTeo(100); // rolling actual win rate (%)

        if (teo <= 0) return this.baseWager; // guard

        // Ratio: how actual compares to TEO
        const ratio = actual / teo;

        // Scale wager proportionally
        let wager = this.baseWager * ratio;

        // Optional clamps so it doesn’t go crazy
        const min = this.baseWager * 0.2;
        const max = this.baseWager * 5;
        wager = Math.max(min, Math.min(max, wager));

        return wager;
      }

      // Fibonacci progression
      getProgressiveWager2() {
        let fib = [1, 1];
        let ls = this.getLosingStreak();
        while (fib.length <= ls) {
          fib.push(fib[fib.length - 1] + fib[fib.length - 2]);
        }
        return this.baseWager * fib[ls];
      }

      // Parabolic scaling (grows faster than linear, slower than exponential)
      getProgressiveWager3() {
        let ls = this.getLosingStreak();
        if (ls === 0) return this.baseWager;
        return this.baseWager * Math.pow(ls, 2);
      }

      // Soft linear ramp (safe grind)
      getProgressiveWager4() {
        let ls = this.getLosingStreak();
        return this.baseWager * (1 + 0.5 * ls);
      }

      // Hybrid reset: step up, but snap back hard when positive
      getProgressiveWager5() {
        let wager = this.wager;
        let ls = this.getLosingStreak();

        if (ls > 0) {
          // step up gently
          wager = this.baseWager * (1 + ls);
        }

        if (ls === 0 && this.getPL() > 0) {
          // reset when back in profit
          wager = this.baseWager;
        }

        return wager;
      }

checkSignals() {
  const wr50   = this.riskOffStats.getHitRatePercent(50);
  const wr100  = this.riskOffStats.getHitRatePercent(100);
  const wr1000 = this.riskOffStats.getHitRatePercent(1000);
  const teo    = this.getTeo() * 100;

  //console.log(`TEO: ${teo}, wr50: ${wr50}, wr100: ${wr100}, wr1000: ${wr1000}`)

  // store last values to detect cross
  if (!this.lastWr50) this.lastWr50 = wr50;
  if (!this.lastWr100) this.lastWr100 = wr100;

  let entry = false;
  let exit = false;

  // entry: WR-50 crosses above WR-100, and mid is not under long
  if (this.lastWr50 <= this.lastWr100 && wr50 > wr100) {// && wr100 >= wr1000 && wr1000 > teo) {
    entry = true;
  }

  // exit: WR-50 crosses below WR-100, or mid breaks long, or climate bad
  if ((this.lastWr50 >= this.lastWr100 && wr50 < wr100)) {// || wr100 < wr1000 || wr1000 < teo) {
    exit = true;
  }

  this.lastWr50 = wr50;
  this.lastWr100 = wr100;

  entry = false;
  return { entry, exit };
}
 

      getProfitTarget = () => this.profitTarget;

      getRiskOnCount = () => this.riskOnCount;
      getTotalRiskOnCycleCount = () => this.totalRiskOnCycleCount;
      getWinCount = () => this.winCount;
      getLoseCount = () => this.loseCount;
      getWinLoseRatio() {
        if (this.loseCount === 0) return 1;
        return this.winCount / this.loseCount;
      }
      isRiskOn = () => this.riskOn;

      getRollCount = () => this.rollCount;

      getMaxWager = () => this.maxWager;

      // From stats class
      getStreak = () => this.stats.getStreak();
      getLosingStreak = () => this.stats.getLosingStreak();
      getPreviousLosingStreak = () => this.stats.getPreviousLosingStreak();
      getRatio = () => this.stats.getRatio();
      getStreakDiff = () => this.stats.getStreakDiff();
      getWinRatePercentOfTeo = (lookback = 100) =>
        this.stats.getWinRatePercentOfTeo(lookback);
      getTeo = () => this.stats.getTeo();
      getHitCount = () => this.stats.getHitCount();
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
          "Risk On Losing Streak": target.getRiskOnLosingStreak(),
          "Bets Taken": target.getRiskOnCount(),
          "Bets Won": target.getWinCount(),
          "Bets Lost": target.getLoseCount(),
          "W/L Ratio": target.getWinLoseRatio().toFixed(2),
          "Base Edge Percent": target.stats.getEdgePercent(10000).toFixed(2),
          "Roll Over Til 10": target.getRollOverTil10X(),
          "Min Roll Over Til 10": target.getMinRollOverTil10(),
          "Risk on Edge Percent": target.riskOnStats
            .getEdgePercent(10000)
            .toFixed(2),
          "Max Wager": target.getMaxWager(),
          _highlight: target.isRiskOn()
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
          const style = row._highlight
            ? 'style="background-color: #fff3b0; color: #222; font-weight: bold;"'
            : "";
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

      getNextRiskTarget() {
        return this.targets.find((t) => t.isRiskOnReady());
      }

     // getNextRiskTarget() {
      //   const rand = this.getRandomInt();
      //   if (rand % 10 !== 0) return;

      //   return this.targets.find((t) => t.isRiskOnReady());
      // }

      push(result) {
        this.totalRatio = 0;
        this.totalBreachRatio = 0;

        for (let i = 0; i < this.targets.length; i++) {
          const t = this.targets[i];
          t.push(result);
          this.totalRatio += t.getRatio();
        }
      }

      getRandomInt(max) {
        return Math.floor(Math.random() * max);
      }
    }

    const bankRoll = new BankRoll(getHardStopMaxLoss());
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
      <div>UI Profit / Loss: <span id="ui-profit-loss"></span></div>
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
      <label>Test Mode</label>
      <input id="test-mode" type="checkbox"/>
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
      <input type="number" id="base-wager" value="0.005"  />
   </div>
   <div class="control-group">
      <label>Max Wager</label>
      <input type="number" id="max-wager" value="0.10"  />
   </div>
   <div class="control-group">
      <label>Hard Stop Max Loss</label>
      <input type="number" id="hard-stop-max-loss" value="10"  />
   </div>
   <div class="control-group">
      <label>Profit Target</label>
      <input type="number" id="profit-target" value="0.25"  />
   </div>

      <div class="control-group">
        <label>LS Threshold</label>
        <input type="number" id="ls-threshold" value="3" />
      </div>

      <div class="control-group">
        <label>Short Win Rate Percent Threshold</label>
        <input type="number" id="short-win-rate-threshold" value="50" />
      </div>

      <div class="control-group">
        <label>Mid Win Rate Percent Threshold</label>
        <input type="number" id="mid-win-rate-threshold" value="90" />
      </div>

      <div class="control-group">
        <label>Long Win Rate Percent Threshold</label>
        <input type="number" id="long-win-rate-threshold" value="90" />
      </div>
   <div class="control-group">
      <label>Bank Roll</label>
      <input type="number" id="bank-roll" value="0.003"  />
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
