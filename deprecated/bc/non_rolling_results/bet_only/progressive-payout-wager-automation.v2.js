/* Start Script */
// ==UserScript==
// @name         bc.game automation v2
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
    riskOnCheck: () => Math.abs(target.getLosingStreak()) > 0,
    riskOffCheck: () => target.losingStreak >= target.payout - 1
  }),

  conservative: (target) => ({
    riskOnCheck: () => target.getWinRatePercentOfTeo() > 75,
    riskOffCheck: () => target.losingStreak >= target.payout - 1
  }),

  aggressive: (target) => ({
    riskOnCheck: () => target.getWinRatePercentOfTeo() > 90,
    riskOffCheck: () => target.losingStreak >= target.payout - 1
  }),

  highWinRate: (target) => ({
    riskOnCheck: () => target.stats.getWinRate() > 0.6,
    riskOffCheck: () => target.stats.getWinRate() < 0.4
  }),

  teoOutperformance: (target) => ({
    riskOnCheck: () => target.stats.getWinRatePercentOfTeo() > 120,
    riskOffCheck: () => target.stats.getWinRatePercentOfTeo() < 90
  }),

  meanReversion: (target) => ({
    riskOnCheck: () => target.stats.getLosingStreak() <= -5,
    riskOffCheck: () => target.stats.getStreak() >= 1
  }),

  doubleDipEntry: (target) => ({
    riskOnCheck: () =>
      target.stats.getLosingStreak() <= -3 &&
      target.stats.getPreviousStreak() <= -3,
    riskOffCheck: () => target.stats.getStreak() > 0
  }),

  negativeRatioSpike: (target) => ({
    riskOnCheck: () => target.stats.getRatio() < -0.5,
    riskOffCheck: () => target.stats.getRatio() >= 0
  }),

  fallingKnife: (target) => ({
    riskOnCheck: () =>
      target.stats.getRatio() < -1 &&
      target.stats.getLosingStreak() <= -4,
    riskOffCheck: () => target.stats.getStreak() > 0
  }),

  compressionBreakout: (target) => ({
    riskOnCheck: () =>
      target.stats.getStreak() <= -3 &&
      target.stats.getRatio() < 0 &&
      target.stats.getWinRatePercentOfTeo() > 110,
    riskOffCheck: () =>
      target.stats.getStreak() >= 1 ||
      target.stats.getWinRatePercentOfTeo() < 90
  }),

  resistanceBounce: (target) => ({
    riskOnCheck: () =>
      target.stats.getRatio() < -0.3 &&
      target.getOverheadRatioAvg() < 0,
    riskOffCheck: () => target.stats.getStreak() >= 2
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
      <input type="number" id="hard-stop-max-loss" value="1000"  />
   </div>
   <div class="control-group">
      <label>Profit Target</label>
      <input type="number" id="profit-target" value="1000000000000"  />
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

  const tm = initTargetManager(scenarios.fallingKnife);
  initWindowEvents();

  function evalResult(result) {
    rollCount++;

    tm.push(result);
    highHit.push(result);

    evalRiskOn(result);
    // if (riskOnTarget) {
    //   evalRiskOn(result);
    // } else {
    //   evalRiskOff();
    // }

    updateUI();
    checkHalts(result);

    tm.renderRunSummaryToTable();
  }


  function evalRiskOn(result) {
    if (!riskOnTarget) {
        resetRiskOnTarget();
        return;
    }

    if (result >= riskOnTarget.getPayout()) {
        console.log(`riskOnTarget Payout: ${riskOnTarget.getPayout()} hit ${result}`)
        resetRiskOnTarget();
        return;
    }

    const nextTarget = riskOnTarget.getPreviousTarget();

    if (!nextTarget) {
      resetRiskOnTarget();
      return;
    };

//    console.log(`riskOnTarget Payout: ${riskOnTarget.getPayout()}, nextTarget Payout: ${nextTarget.getPayout()}`)
    
    riskOnTarget.goRiskOff();
    riskOnTarget = nextTarget;

    const payout = riskOnTarget.getPayout();
    const wager = getWager();
    const profitTarget = 1;
    const nextWager = (riskOnTarget.getPL() + profitTarget) / payout
    
    setWager(nextWager);
    setPayout(riskOnTarget.getPayout());
  }

  function resetRiskOnTarget() {
      if (riskOnTarget) {
        riskOnTarget.goRiskOff();
      }

      riskOnTarget = tm.targets.last();
      riskOnTarget.goRiskOn(getBaseWager());
      setWager(getBaseWager());
      setPayout(riskOnTarget.getPayout());
  }

  // function evalRiskOn(result) {
  //   if (!riskOnTarget) return;

  //   riskOnTarget.evalRiskOn();

  //   if (riskOnTarget.shouldGoRiskOff()) {
  //     riskOnTarget.goRiskOff();
  //     setWager(0);
  //     setPayout(0);
  //     riskOnTarget = null;
  //   } else {
  //     setWager(riskOnTarget.getWager());
  //   }
  // }

  function evalRiskOff() {
    riskOnTarget = tm.getNextRiskTarget(minRatio);

    if (!riskOnTarget) return;

    riskOnTarget.goRiskOn(getBaseWager());
    setWager(riskOnTarget.getWager());
    setPayout(riskOnTarget.getPayout());
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

    // Mock BC Stop
    mbc.stop();

    return;
  }

  function updateUI() {
    const profit = tm.bankRoll.getPL();

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

  function getBankRoll() {
    if (!bankRollField) {
      bankRollField = $("#bank-roll");
    }
    return Number(bankRollField.val());
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
    if (profit >= 0) return;

    return Math.abs(profit) >= getMaxLoss();
  }

  function hardStopMaxLossExceeded(profit) {
    if (profit >= 0) return;

    return Math.abs(profit) >= getHardStopMaxLoss();
  }

  function getWager() {
    return Number($("#wager").val());
  }

  function getBalance() {
    let rawText = $(".ml-3 .font-extrabold").text().trim();
    return parseFloat(rawText.replace(/[^\d.]/g, ""));
  }

  function setWager(amount) {
    $("#wager").val(amount);
  }

  function getAvgRatioAtPop() {
    let count = RATIO_AT_POP.length;
    return RATIO_AT_POP.reduce((sum, v) => sum + v, 0) / count;
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
    profit = 0;
    hitCount = 0;
    stopped = false;
    doBet(); // Start the async loop
  }

  function stopBetting() {
    stopped = true;
  }

  function setPayout(amount) {
    $("#payout").val(amount);
  }

  function setPayout2(amount) {
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
    return Number($("#payout").val());
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
          length: 98
        },
        (v, k) => 10 + k * 1
      );

      // return Array.from(
      //   {
      //     length: 48
      //   },
      //   (v, k) => 10 + k * 0.5
      // );
    }

    class BankRoll {
      constructor(startBalance, lossLimit) {
        this.startBalance = startBalance;
        this.currentBalance = startBalance;
        this.lossLimit = -lossLimit;
        this.drawDown = 0;
        this.haltMessage = null;
      }

      getDrawDown = () => this.drawDown;
      getBalance = () => this.currentBalance;
      getPL = () => this.currentBalance - this.startBalance;
      increment = (profit) => (this.currentBalance += profit);
      shouldHalt = () => this.haltMessage != null;
      decrement(loss) {
        this.currentBalance += loss;
        this.drawDown = Math.min(this.drawDown, this.currentBalance);

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
        this.streak = 0;
        this.pstreak = 0;
        this.hitCount = 0;
        this.losingStreak = 0;
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

        this.losingStreak = this.streak < 0 ? this.streak : 0;
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
        this.profit = 0;
        this.wager = 0;

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

      getOverheadRatioAvg() {
        if (this.getOverheadCount() === 0) return this.getOverheadRatioSum();
        return this.getOverheadRatioSum() / this.getOverheadCount();
      }

      getPreviousTarget = () => this.previousTarget;

      getPayout() {
        return this.payout;
      }

      push(result) {
        if (this.isRiskOn()) {
          this.updateRiskOnStats(result);
        }
        this.stats.push(result);
      }

      updateRiskOnStats(result) {
        this.rollCount++;

        if (result >= this.payout) {
          this.profit += this.payout * this.wager - this.wager;
          if (this.losingStreak > 0) this.pstreak = this.losingStreak;
          this.bankRoll.increment(this.profit);
          this.losingStreak = 0;
        } else {
          this.profit -= this.wager;
          this.bankRoll.decrement(this.profit);
          this.losingStreak++;
        }
      }

      getPL = () => this.profit

      getLSEqualsPayoutMod(divisor = 1) {
        if (this.losingStreak === 0) return false;

        return this.losingStreak % Math.floor(this.payout / divisor) === 0;
      }

      evalRiskOn() {
        const divisor = this.riskOnCycle == 0 ? 1 : 2;

        if (
          this.getOverheadRatioAvg() < 0 &&
          this.losingStreak % Math.floor(this.payout / divisor) === 0
        ) {
          this.riskOnCycle++;
          this.wager += this.wager;
        }
      }

      shouldGoRiskOff() {
        return this.riskOffCheck();
      }

      riskOnReady() {
        return this.riskOnCheck();
      }

      goRiskOn(wager) {
        this.wager = wager;
        this.profit = 0;
        this.losingStreak = 0;
        this.riskOnCycle = 0;
        this.riskOn = true;
        this.riskOnCount++;
      }

      goRiskOff() {
        if (this.profit > 0) {
          this.winCount++;
        } else {
          this.loseCount++;
        }
        this.totalRiskOnCycleCount += this.riskOnCycle;
        this.losingStreak = 0;
        this.riskOn = false;
        this.wager = 0;
        this.riskOnCycle = 0;
        this.profit = 0;
      }

      getRiskOnCount = () => this.riskOnCount;
      getTotalRiskOnCycleCount = () => this.totalRiskOnCycleCount;
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
      getLosingStreak = () => (this.getStreak() < 0 ? this.getStreak() : 0);
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
          "Bets Taken": target.getRiskOnCount(),
          "Bets Won": target.getWinCount(),
          "Bets Lost": target.getLoseCount(),
          "W/L Ratio": target.getWinLoseRatio().toFixed(2),
          "Avg Risk Cycle": (
            target.getTotalRiskOnCycleCount() /
            Math.max(1, target.getRiskOnCount())
          ).toFixed(2),
          Drawdown: target.getPreviousLosingStreak(),
          "Final P/L": target.profit.toFixed(2)
        }));

        // Optional dev output
        //console.table(tableData);

        // Render to UI
        const tableEl = document.getElementById("summary-table");
        if (!tableEl) return;

        const headers = Object.keys(tableData[0] || {});
        tableEl.innerHTML = `
          <thead><tr>${headers
            .map((h) => `<th>${h}</th>`)
            .join("")}</tr></thead>
          <tbody>
            ${tableData
              .map(
                (row) => `
              <tr>${headers.map((h) => `<td>${row[h]}</td>`).join("")}</tr>
            `
              )
              .join("")}
          </tbody>
        `;
      }

      getTotalRatio = () => this.totalRatio;

      getIsFalling = () => this.getPast5AvgRatio() < this.getPast10AvgRatio();

      getPast10AvgRatio() {
        const count = this.past10Ratios.length;
        return this.past10Ratios.reduce((sum, v) => sum + v, 0) / count;
      }

      getPast5AvgRatio() {
        const count = this.past5Ratios.length;
        return this.past5Ratios.reduce((sum, v) => sum + v, 0) / count;
      }

      getNextRiskTarget() {
        return this.targets.find((t) => t.riskOnReady());
      }

      push(result) {
        this.totalRatio = 0;
        this.totalBreachRatio = 0;

        for (let i = 0; i < this.targets.length; i++) {
          const t = this.targets[i];
          t.push(result);
          this.totalRatio += t.getRatio();
        }
      }
    }

    const bankRoll = new BankRoll(getBankRoll(), getHardStopMaxLoss());
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

  doInit();

  // Initialize MutationObserver
})();

mbc.start(); // Or whatever you need to run
