/* Start Script */
// ==UserScript==
// @name         bc.game high chase with recovery v1
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  try to take over the world!
// @author       You
// @match        https://*.game/game/limbo?coil-wagering=true
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bc.game
// @require https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const tm = initTargetManager();
  let payoutPinned = false;
  let firstLoad = true;
  let lastRollSet = [];
  let currentRollSet = [];
  let rollCount = 0;
  let rollStartTime = null; // in ms
  let losingStreak = 0;
  let baseLosingStreak = 0;
  let maxLosingStreak = 0;
  let stopped = true;
  let hitCount = 0;
  let profit = 0;
  let recoveryProfit = 0;
  let winRate = 0;
  let teo = 0;


  // TEMP DELETE ME
  let currentRatio = 0;
  let lastRatio = 0;
  const RATIO_AT_POP = [];

  // Fields
  let lsField = null;
  let recoveryLsField = null;
  let highPayoutField = null;
  let highWagerField = null;
  let highTargetField = null;
  let maxPayoutField = null;
  let basePayoutField = null;
  let maxLossField = null;
  let hardStopMaxLossField = null;
  let maxWagerField = null;
  let baseWagerField = null;
  let profitTargetField = null;
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

  let riskOn = false;
  let rollModes = {
    mode: "HIGH",
    setRiskOn() {
      rollModes.mode = "RISK_ON";
    },
    setRecovery() {
      rollModes.mode = "RECOVERY";
    },
    setHighMode() {
      rollModes.mode = "HIGH";
    },
    isHighMode() {
      return rollModes.mode === "HIGH";
    },
    isRecoveryMode() {
      return rollModes.mode === "RECOVERY";
    },
    isRiskOn() {
      return rollModes.mode === "RISK_ON";
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
      <div>Avg Pop Ratio: <span id="avg-pop-ratio"></span></div>
   </div>


   <div class="button-group">
      <button id="start-betting-btn">Start Betting</button>
      <button id="stop-betting-btn" style="display: none;">Stop Betting</button>
      <button id="set-risk-on-btn" style="display: none;">Risk On</button>
      <button id="set-risk-off-btn">Risk Off</button>
      <button id="zero-wager-btn">Zero Wager</button>
   </div>


   <div class="control-group">
      <label>High Payout</label>
      <input type="number" id="high-payout" value="1000000"  />
   </div>

   <div class="control-group">
      <label>High Wager</label>
      <input type="number" id="high-wager" value="0.0001"  />
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
      <label>Max Loss</label>
      <input type="number" id="max-loss" value="0.25"  />
   </div>
   <div class="control-group">
      <label>Hard Stop Max Loss</label>
      <input type="number" id="hard-stop-max-loss" value="5"  />
   </div>
   <div class="control-group">
      <label>Profit Target</label>
      <input type="number" id="profit-target" value="0.001"  />
   </div>
    <div class="control-group">
      <label>Recovery Losing Streak Multiplier</label>
      <select id="recovery-ls-multiplier" >
         <option value="0" selected>0</option>
         <option value="0.05">0.05</option>
         <option value="0.1">0.1</option>
         <option value="0.2">0.2</option>
         <option value="0.3">0.3</option>
         <option value="0.4">0.4</option>
         <option value="0.5">0.5</option>
         <option value="1">1</option>
         <option value="1.5" selected>1.5</option>
         <option value="2">2</option>
         <option value="2.5">2.5</option>
         <option value="3">3</option>
         <option value="3.5">3.5</option>
         <option value="4">4</option>
         <option value="4.5">4.5</option>
         <option value="5">5</option>
         <option value="5.5">5.5</option>
         <option value="6">6</option>
         <option value="6.5">6.5</option>
         <option value="7">7</option>
         <option value="7.5">7.5</option>
         <option value="8" >8</option>
         <option value="8.5">8.5</option>
         <option value="9">9</option>
         <option value="9.5">9.5</option>
         <option value="10">10</option>
      </select>
   </div>
</div>`;

  $("body").prepend(controlPanel);

  initWindowEvents();

  function evalResult(result) {
    rollCount++;
    tm.push(result);
    highHit.push(result);

    if (rollModes.isHighMode()) {
      evalHighMode(result);
    } else if (rollModes.isRecoveryMode()) {
      evalRecovery(result);
    } else {
      evalRiskOn(result);
    }

    updateUI();
    checkHalts(result);
  }




// /* Simulation to measure ratio pop */
//   let fakePayout = 0;
  
//   function captureRatioStats(result) {
//     let payout = getFakePayout();
//     let wager = getWager();
//     let maxWager = getMaxWager();

//     if (result >= 100) {
//       RATIO_AT_POP.push(lastRatio)
//       console.log("RATIO_AT_POP", RATIO_AT_POP.last())
//     } else {
//       lastRatio = currentRatio;
//       currentRatio = tm.targets.last().getRatio();
//     }
//   }


//   function getFakePayout() {
//     return fakePayout;
//   }

  /* end simulation */


  function evalHighMode(result) {
    const payout = getPayout();
    const wager = getWager();

    if (result >= payout) {
      losingStreak = 0;
      hitCount++;
      profit += payout * wager - wager;
    } else {
      losingStreak++;
      profit -= wager;
    }

    if (maxLossExceeded()) {
      enterRecovery(
        `Max loss exceeded, entering recovery ${profit.toFixed(4)}`
      );
    }
  }

  function enterRecovery() {
    const profitAbs = Math.abs(profit);
    recoveryProfit = profitAbs + profitAbs * 0.1;
    profit = 0;
    rollModes.setRecovery();
    setPayout(1.01);
    setWager(0);
  }

  function enterHighMode() {
    setPayout(getHighPayout());
    setWager(getHighWager());
    recoveryProfit = 0;
    profit = 0;
    rollModes.setHighMode();
  }

  function evalRiskOn(result) {
    let nextPayout = 0;
    let payout = getPayout();
    let wager = getWager();
    let maxWager = getMaxWager();

    if (result >= payout) {
      losingStreak = 0;
      hitCount++;
      setWager(0);
      setPayout(0);
      profit += payout * wager - wager;
      if (profit >= recoveryProfit) {
        enterHighMode();
        return;
      }
    } else {
      losingStreak++;
      profit -= wager;

      payoutPinned = nextPayout === getMaxPayout();

      if (result === 1.0) {
        wager += getBaseWager();
      }
      nextPayout = Math.min(payout + 1, getMaxPayout());

      if (payoutPinned) {
        if (losingStreak % Math.ceil(nextPayout / 2) === 0) {
          wager *= 2;
          setWager(Math.min(MAX_WAGER, wager));
        }
      }

      setPayout(nextPayout);
      setWager(wager);
    }
  }

  function evalRecovery(result) {
    const basePayout = getBasePayout();
    const maxPayout = getMaxPayout();

    if (result >= basePayout) {
      baseLosingStreak = 0;
    } else {
      baseLosingStreak++;
    }

    if (result >= maxPayout) {
      maxLosingStreak = 0;
    } else {
      maxLosingStreak++;
    }

    if (baseLosingStreak >= basePayout * getRecoveryLosingStreakMultiplier()) {
      rollModes.setRiskOn();
      baseLosingStreak = 0;
      maxLosingStreak = 0;
      setWager(getBaseWager());
      setPayout(getBasePayout());
    }
  }

  function checkHalts(result) {
    if (getStopOnHardStopMaxLoss() && hardStopMaxLossExceeded()) {
      halt(`Hard stop max loss exceeded ${profit.toFixed(4)}`);
      return;
    }

    if (result >= getHighPayout()) {
      halt(`High payout hit profit: ${profit.toFixed(4)}, payout: ${result}`);
      return;
    }
  }

  function halt(stopMessage) {
    console.log(stopMessage);
    $("#message").text(stopMessage);
    stopMessage = "";
    stopBetting();
    return;
  }

  function updateUI() {
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
    const br = tm.getTotalBreachRatioAvg();

    $("#total-ratio")
      .html(`${r.toFixed(3)}`)
      .css({ backgroundColor: `${r < 0 ? "red" : "transparent"}` });

      const avgPopRatio = getAvgRatioAtPop();
      const hr = tm.targets.last().getRatio();
    $("#avg-pop-ratio")
      .html(`${br.toFixed(3)} | ${hr.toFixed(3)}`)
      .css({ backgroundColor: `${br < 0 ? "red" : "transparent"}` });


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

  function getHighPayout() {
    if (!highPayoutField) {
      highPayoutField = $("#high-payout");
    }
    return Number(highPayoutField.val());
  }

  function getHighWager() {
    if (!highWagerField) {
      highWagerField = $("#high-wager");
    }

    return 0;

    return Number(highWagerField.val());
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

  function getRecoveryLosingStreakMultiplier() {
    if (!recoveryLsField) {
      recoveryLsField = $("#recovery-ls-multiplier");
    }
    return Number(recoveryLsField.val());
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

  function initWindowEvents() {
        Array.prototype.last = function () {
      return this[this.length - 1]
    }

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

  function hardStopMaxLossExceeded() {
    if (profit >= 0) return;

    return Math.abs(profit) >= getHardStopMaxLoss();
  }

  function getWager() {
    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Amount")'
    );
    const inputField = payoutFieldGroup.find("input");

    return Number(inputField.val());
  }

  function getBalance() {
    let rawText = $(".ml-3 .font-extrabold").text().trim();
    return parseFloat(rawText.replace(/[^\d.]/g, ""));
  }

  function setWager(amount) {
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

function getAvgRatioAtPop() {
  let count = RATIO_AT_POP.length
  return RATIO_AT_POP.reduce((sum, v) => sum + v, 0) / count
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
    setWager(getHighWager());
    setPayout(getHighPayout());
    losingStreak = 0;
    baseLosingStreak = 0;
    maxLosingStreak = 0;
    riskOn = false;
    profit = 0;
    hitCount = 0;
    stopped = false;
    doBet(); // Start the async loop
  }

  function stopBetting() {
    stopped = true;
  }

  function setPayout(amount) {
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

  function initTargetManager() {
    function generatePayouts() {
      const p1 = Array.from(
        {
          length: 81
        },
        (v, k) => 2 + k * 0.1
      );

      const p2 = Array.from(
        {
          length: 181
        },
        (v, k) => 10 + k * 0.5
      );

      return [...p1, ...p2];
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
      getBreachRatio = () => this.breachRatio;
    }

    class Target {
      constructor(payout) {
        this.payout = payout;
        this.stats = new Stats(100, payout);
        this.rollCount = 0;
      }

      getPayout() {
        return this.payout;
      }

      push(result) {
        this.rollCount++;
        this.stats.push(result);
      }

      getStreak = () => this.stats.getStreak();
      getLosingStreak = () => (this.getStreak() < 0 ? this.getStreak() : 0);
      getTeo = () => this.stats.getTeo();
      getHitCount = () => this.stats.getHitCount();
      getRollCount = () => this.rollCount;
      getRatio = () => this.stats.getRatio();
    }

    class TargetManager {
      constructor(targets) {
        this.totalRatio = 0;
        this.targets = targets;
        this.breachRatios = [];
        this.totalBreachRatio = 0;
      }

      getTotalRatio = () => this.totalRatio;

      getTotalBreachRatioAvg() {
        const count = this.breachRatios.length;
        return this.breachRatios.reduce((sum, v) => sum + v, 0) / count
      }

      push(result) {
        this.totalRatio = 0;
        this.totalBreachRatio = 0;
        for (let i = 0; i < this.targets.length; i++) {
          const t = this.targets[i];
          t.push(result);
          this.totalRatio += t.getRatio();
          this.totalBreachRatio += t.stats.getBreachRatio();
        }

        if (this.totalBreachRatio !== 0 && this.totalBreachRatio !== this.breachRatios.last())
          this.breachRatios.push(this.totalBreachRatio);
      }
    }
    return new TargetManager(
      generatePayouts().map((payout) => new Target(payout))
    );
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

  setInterval(() => {
    if (performance.memory) {
      console.log(
        "Used JS Heap:",
        (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + " MB"
      );
    }
  }, 5000);

  // Initialize MutationObserver
})();
