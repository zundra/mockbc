/* Start Script */
// ==UserScript==
// @name         bc.game wind up v17
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  try to take over the world!
// @author       You
// @match        https://*.game/game/limbo?fast-roll=true
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bc.game
// @require https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const MAX_WAGER = 10;
  let MIN_WAGER = 0;

  let targets = generateTargets();
  let compressionZone = null;
  /* end testing */
  let lastRollSet = [];
  let currentRollSet = [];
  let rollCount = 0;
  let losingStreak = 0;
  let winningStreak = 0;
  let stopped = true;
  let hitCount = 0;

  // Fields
  let lowCompressionMaxPressureField = null;
  let lowCompressionMaxSizeField = null;

  let lossLimitField = null;
  let lsField = null;
  let highHitThresholdField = null;
  let hitCountTargetField = null;
  let maxRollField = null;
  let restHighHitField = null;
  let highHitResetThresholdField = null;
  let newWindow = null;
  let analyticsWrapper = null;
  let rollStrategyField = null;
  let maxPressureField = null;
    let recoveryLSField = null;
  let recoveryPL = 0;
  let profit = 0;
  let cycleProfit = 0;

  const highHit = {
    payout: 0,
    round: 0,
    getSummary(rollCount) {
      return `${highHit.payout} || Delta: ${highHit.getRollDelta(rollCount)}`;
    },
    getRollDelta(rollCount) {
      return rollCount - highHit.round;
    },

    getDeltaColor(rollCount) {
      if (highHit.getRollDelta(rollCount) >= highHit.payout * 2) {
        return "red";
      }
      return "transparent";
    },
    shouldHalt(rollCount, threshold) {
      if (highHit.round === 0) return;

      return rollCount - highHit.round > highHit.payout * threshold;
    }
  };

  let teo = 0;
  $("<style>")
    .prop("type", "text/css")
    .html(
      `
            #stats-panel-header {
                background: #333;
                padding: 12px;
                font-weight: bold;
                text-align: center;
                border-radius: 8px 8px 0 0;
                font-size: 16px;
                cursor: grab;
            }

            #control-panel {
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
        `
    )
    .appendTo("head");
  let html = `
    <div id="control-panel" style="
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 9999;
        background: #1e1e1e;
        color: #fff;
        padding: 16px;
        width: 340px;
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
        ">Welcome! Configure your settings to begin.</div>



        <div id="stats" class="stats-box" style="
            margin: 12px 0;
            background-color: #444;
            padding: 10px;
            border-radius: 6px;
            color: white;
            font-size: 0.9rem;
            text-align: center;
        ">
        <div>Roll Count: <span id="roll-count"></span></div>
        <div>Profit / Loss: <span id="profit-loss"></span></div>
        <div>Hit Count: <span id="hit-count"></span></div>
        <div>High Hit: <span id="high-hit"></span></div>
        <div>Win Rate: <span id="win-rate"></span></div>
        <div>Losing Streak: <span id="losing-streak"></span></div>
        </div>
   <div class="button-group">
      <button id="start-betting-btn">Start Betting</button>
      <button id="stop-betting-btn"  style="display: none;">Stop Betting</button>
      <button id="set-risk-on-btn" style="display: none;">Risk On</button>
      <button id="set-risk-off-btn">Risk Off</button>
      <button id="zero-wager-btn">Zero Wager</button>
      <button id="recovery-mode-btn">Recovery Mode</button>
      <button id="double-wager-btn">Double Wager</button>
      <button id="half-wager-btn">Half Wager</button>
   </div>

   <div class="control-group">
      <label>Risk On</label>
      <input id="risk-on" type="checkbox" checked/>
   </div>


   <div class="control-group">
      <label>Performance Ajust Wager</label>
      <input id="performance-adjust-wager" type="checkbox"/>
   </div>


   <div class="control-group">
      <label>Reset High Hit on Big Hit</label>
      <input id="reset-high-hit-on-big-hit" type="checkbox"/>
   </div>


          <div class="control-group">
            <label>Roll Strategy</label>
  <select id="roll-strategy" >
    <option value="analytics">Analytics</option>
    <option value="full-target">Full Target</option>
    <option value="half-target">Half Target</option>
    <option value="quarter-target">Quarter Target</option>
    <option value="expected-hits">Expected Hits</option>
    <option value="hit-count">Hit Count</option>
  </select>
            </div>

          <div class="control-group">
            <label>Max Rolls</label>
            <input type="number" id="max-rolls" value="0"  />
            </div>
           <div class="control-group">
            <label>Hit Count Target</label>
            <input type="number" id="hit-count-target" value="0" />
            </div>
          <div class="control-group">
            <label>Profit Target</label>
            <input type="number" id="profit-target" value="0.01"  />
            </div>

          <div class="control-group">
            <label>Loss Limit</label>
            <input type="number" id="loss-limit" value="100"  />
            </div>

          <div class="control-group">
            <label>Losing Streak Multiplier</label>
  <select id="ls-multiplier">
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
    <option value="3">3</option>
    <option value="3.5">3.5</option>
    <option value="4">4</option>
    <option value="4.5">4.5</option>
    <option value="5">5</option>
    <option value="5.5">5.5</option>
    <option value="6">6</option>
    <option value="6.5" >6.5</option>
    <option value="7">7</option>
    <option value="7.5">7.5</option>
    <option value="8">8</option>
    <option value="8.5">8.5</option>
    <option value="9">9</option>
    <option value="9.5">9.5</option>
    <option value="10">10</option>
  </select>
            </div>











          <div class="control-group">
            <label>Recovery LS Treshold</label>
  <select id="recovery-ls-threshold" >
    <option value="0">0</option>
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
    <option value="3">3</option>
    <option value="3.5" >3.5</option>
    <option value="4">4</option>
    <option value="4.5">4.5</option>
    <option value="5">5</option>
    <option value="5.5">5.5</option>
    <option value="6" selected>6</option>
    <option value="6.5" >6.5</option>
    <option value="7">7</option>
    <option value="7.5">7.5</option>
    <option value="8">8</option>
    <option value="8.5">8.5</option>
    <option value="9">9</option>
    <option value="9.5">9.5</option>
    <option value="10">10</option>
  </select>
            </div>


                      <div class="control-group">
            <label>Max Pressure</label>
    <select id="max-pressure-old">
    <option value="4.5">4.5</option>
    <option value="5">5</option>
    <option value="5.5">5.5</option>
    <option value="6">6</option>
    <option value="6.5" >6.5</option>
    <option value="7">7</option>
    <option value="7.5">7.5</option>
    <option value="8" selected>8</option>
    <option value="8.5">8.5</option>
    <option value="9">9</option>
    <option value="9.5">9.5</option>
    <option value="10">10</option>
  </select>
            </div>
           <div class="control-group">
            <label>High Hit Reset Threshold</label>
            <input type="number" id="high-hit-reset-threshold" value="100" />
            </div>









          <div class="control-group">
            <label>High Hit Threshold</label>
  <select id="high-hit-threshold" >
    <option value="0">0</option>
    <option value="0.05">0.05</option>
    <option value="0.1">0.1</option>
    <option value="0.2">0.2</option>
    <option value="0.3">0.3</option>
    <option value="0.4">0.4</option>
    <option value="0.5">0.5</option>
    <option value="1">1</option>
    <option value="1.5">1.5</option>
    <option value="2" selected>2</option>
    <option value="2.5">2.5</option>
    <option value="3">3</option>
    <option value="3.5" >3.5</option>
    <option value="4">4</option>
    <option value="4.5">4.5</option>
    <option value="5">5</option>
    <option value="5.5">5.5</option>
    <option value="6">6</option>
    <option value="6.5" >6.5</option>
    <option value="7">7</option>
    <option value="7.5">7.5</option>
    <option value="8">8</option>
    <option value="8.5">8.5</option>
    <option value="9">9</option>
    <option value="9.5">9.5</option>
    <option value="10">10</option>
  </select>
            </div>



     <div class="control-group">
  <label>Low Compression Max Size</label>
  <select id="low-compression-max-size">
    <option value="5">5</option>
    <option value="6">6</option>
    <option value="7" selected>7</option>
    <option value="8">8</option>
  </select>
            </div>

     <div class="control-group">
  <label>Low Compression Negative Pressure</label>
  <select id="low-compression-max-pressure">
    <option value="0.1">0.1</option>
    <option value="0.2">0.2</option>
    <option value="0.3" selected>0.3</option>
    <option value="0.4">0.4</option>
    <option value="0.5">0.5</option>
    <option value="0.6">0.6</option>
    <option value="0.7">0.7</option>
    <option value="0.8">0.8</option>
    <option value="0.9">0.9</option>
    <option value="1">1</option>
    <option value="1.1">1.1</option>
    <option value="1.2">1.2</option>
    <option value="1.3">1.3</option>
    <option value="1.4">1.4</option>
    <option value="1.5">1.5</option>
  </select>
  </div>
    </div>
`;

  $("body").prepend(html);
  initWindowEvents();

  function evalResult(result) {
    rollCount++;

    const haltedTargets = [];
    const maxPressure = getMaxPressure();
    const stopOnReovery = getStopOnRecoveryLS();
    const recoveryLSLimit = getRecoveryLS();
    const wager = getWager();
    const payout = getPayout();

    for (const t of targets) {
      t.push(result, maxPressure, stopOnReovery, recoveryLSLimit, payout); // must always happen

      if (!getRiskOn()) {
        compressionZone.tryAdd(t);

        if (t.hasHalted()) {
          haltedTargets.push(t); // optional post-check
        }
      }
    }

    targets.last().setOverheadPressure();

    const performanceAdjust = getPerformanceAdjustWager();

    if (result >= payout) {
      profit += payout * wager - wager;

      if (performanceAdjust) {
        if (isProfitableCycle()) {
          cycleProfit = 0;
        } else {
          cycleProfit += payout * wager - wager;
        }
      }

      if (performanceAdjust) {
        tryAdjustWager();
      }

      hitCount++;
      winningStreak++;
      losingStreak = 0;
    } else {
      winningStreak = 0;
      losingStreak++;
      profit -= wager;
      if (performanceAdjust) {
        cycleProfit -= wager;
      }
    }

    recoveryPL = profit;

    if (result > highHit.payout) {
      if (result >= getHighHitResetThreshold() && getResetHighHitOnBigHit()) {
        highHit.payout = 0;
        highHit.round = 0;
      } else {
        highHit.payout = result;
        highHit.round = rollCount;
      }
    }
    updateUI();
    checkHalts(result, haltedTargets);
  }

  function tryAdjustWager() {
    const wager = getWager();
    const payout = getPayout();
    const streakDelta = payout - losingStreak;

    if (streakDelta < 0) {
      return setWager(tryAdjustWagerHigher(streakDelta, wager, payout));
    } else if (isProfitableCycle()) {
      return setWager(tryAdjustWagerLower(streakDelta, wager, payout));
    }
  }

  function isProfitableCycle() {
    return cycleProfit > 0;
  }

  function tryAdjustWagerHigher(streakDelta, wager, payout) {
    const percentOfPayout = 2 * (Math.abs(streakDelta) / payout);
    const nextWager = Math.min(getMaxWager(), wager + wager * percentOfPayout);

    return nextWager;
  }

  function tryAdjustWagerLower(streakDelta, wager, payout) {
    const percentOfPayout = streakDelta / payout;
    const nextWager = Math.max(getMinWager(), wager / 2);

    return nextWager;
  }

  function getMinWager() {
    return MIN_WAGER;
  }

  function getMaxWager() {
    return MAX_WAGER;
  }

  function checkHalts(result, haltedTargets) {
    function resetHalts(haltedTargets) {
      haltedTargets.forEach((t) => t.resetHalt());
    }

    if (getStopOnProfit() && profit >= getProfitTarget()) {
      halt(`Profit target hit ${profit.toFixed(4)}`);
      return;
    }

    if (
      getStopOnLossLimit() &&
      profit < 0 &&
      Math.abs(profit) >= getLossLimit()
    ) {
      halt(`Loss limit target hit ${profit.toFixed(4)}`);
      return;
    }

    if (
      getStopOnLosingStreak() &&
      losingStreak >= getPayout() * getLosingStreakMultiplier()
    ) {
      halt("Losing streak threshold hit");
      return;
    }

    if (getStopOnHitCount() && hitCount >= getHitCountTarget()) {
      halt("Target hit");
      return;
    }

    if (getStopOnMaxRolls() && rollCount >= getMaxRolls()) {
      halt("Max rolls hit");
      return;
    }

    if (getStopOnRecoveryLS()) {
          if (haltedTargets.length > 0) {
          const msg = haltedTargets.map((t) => t.getHaltMessage()).join("\n");
          resetHalts(haltedTargets);
          halt(`Halts triggered:\n${msg}`);
          return;
        }
    }

    if (getRiskOn()) return;

    if (highHit.shouldHalt(rollCount, getHighHitThreshold())) {
      halt("Roll count exceeded high hit threshold");
      return;
    }

    if (haltedTargets.length > 0) {
      const msg = haltedTargets.map((t) => t.getHaltMessage()).join("\n");
      resetHalts(haltedTargets);
      halt(`Halts triggered:\n${msg}`);
      return;
    }

    if (compressionZone.isReady()) {
      // Signal detected: strong low-target squeeze zone
      halt(
        `🔥 Low expansion squeeze forming at base: ${compressionZone.getBase()}`
      );
      return;
    }
  }

  function updateUI() {
    // Render new UI Element
    updateStats();
    updateTable();
  }

  function updateTable() {
    const MAX_BLOCKS = 10;
    const SCALE_FACTOR = 2;
    if (!analyticsWrapper) {
      analyticsWrapper = getNewWindowHTMLNode("#analytics-wrapper");
      //const analyticsWrapper = $("#analytics-wrapper");
    }

    // Ensure the table structure exists
    let table = analyticsWrapper.find("#output-table");

    targets.forEach((entry) => {
      const target = entry.getPayout();

      const winRateTeoData = entry.getWinRatePercentOfTeoUIData();
      const windUpData = entry.getWindUpUIData();
      const evData = entry.getSmootedEVUIData();
      const pData = entry.getOverheadPressureUIData();

      const sanitizedTarget = `${target}`.replace(/\./g, "_");
      let row = table.find(`#row-${sanitizedTarget}`);

      if (row.length === 0) {
        row = $("<tr>")
          .addClass("target-row")
          .attr("id", `row-${sanitizedTarget}`);

        const targetLabel = $("<td>")
          .addClass("target-label")
          .text(`Target: ${target}`)
          .css({ color: "white" });

        const winRateCol = $("<td>")
          .addClass("win-rate-col")
          .text(`${winRateTeoData.winRatePercentOfTeo.toFixed(2)}`)
          .css({ backgroundColor: winRateTeoData.bgColor });

        const streakCol = $("<td>")
          .addClass("streak-col")
          .text(`${winRateTeoData.streak}`)
          .css({ backgroundColor: winRateTeoData.streakBGColor, color: winRateTeoData.streakFGColor});
        
        const aStreakCol = $("<td>")
          .addClass("a-streak-col")
          .text(`${winRateTeoData.astreak.toFixed(2)}`)
          .css({ backgroundColor: winRateTeoData.aStreakBGColor, color: winRateTeoData.aStreakFGColor});


        const pCol = $("<td>")
          .addClass("p-col")
          .text(`${pData.p.toFixed(4)}`)
          .css({ backgroundColor: pData.colors.bgColor, color: pData.colors.fgColor });


        const averagePressureCol = $("<td>")
          .addClass("average-pressure-col")
          .text(`${windUpData.average.toFixed(2)}`)
          .css({ backgroundColor: winRateTeoData.bgColor });

        const blockContainer = $("<td>").addClass("row-blocks").css({
          display: "flex",
          gap: "2px",
          minWidth: "250px"
        });

          const emptyCell = $("<td></td>").css({backgroundColor: "white"})

        row.append(targetLabel, pCol, averagePressureCol, emptyCell, winRateCol, streakCol, aStreakCol, blockContainer);
        table.append(row);
      }

      const blockContainer = row.find(".row-blocks");
      const winRateCol = row.find(".win-rate-col");
      const blocks = blockContainer.find(".row-block");
      const averagePressureCol = row.find(".average-pressure-col");
      const streakCol = row.find(".streak-col")
      const aStreakCol = row.find(".a-streak-col")
      const pCol = row.find(".p-col")

      winRateCol
        .text(`${winRateTeoData.winRatePercentOfTeo.toFixed(2)}`)
        .css({ backgroundColor: winRateTeoData.bgColor });

      streakCol
          .text(`${winRateTeoData.streak}`)
          .css({ backgroundColor: winRateTeoData.streakBGColor, color: winRateTeoData.streakFGColor});
      
        aStreakCol
          .text(`${winRateTeoData.astreak.toFixed(2)}`)
          .css({ backgroundColor: winRateTeoData.aStreakBGColor, color: winRateTeoData.aStreakFGColor});
      


      pCol
          .text(`${pData.p.toFixed(4)}`)
          .css({ backgroundColor: pData.colors.bgColor, color: pData.colors.fgColor });

      averagePressureCol
        .text(`${windUpData.average.toFixed(2)}`)
        .css({ backgroundColor: winRateTeoData.bgColor });

      if (blocks.length > MAX_BLOCKS) {
        blocks.last().remove();
      }

      const needsNewBlock = entry.needsNewBlock() || blocks.length === 0;

      if (needsNewBlock) {
        const streakBlock = $("<div>")
          .addClass("row-block")
          .css({
            padding: "4px",
            margin: "1px",
            backgroundColor: winRateTeoData.modBGColor,
            color: winRateTeoData.modFGColor,
            borderRadius: "4px",
            textAlign: "center",
            fontSize: "15px",
            fontWeight: "bold",
            minWidth: "30px"
          }).text(`${winRateTeoData.winRatePercentOfTeoMod.toFixed(2)}`)
//          .text(`${entry.getStreak()} | ${windUpData.balance.toFixed(4)}`);

        blockContainer.prepend(streakBlock);
      } else {
        const firstBlock = blocks.first();
        firstBlock
          .css({
            backgroundColor: winRateTeoData.modBGColor,
            color: winRateTeoData.modFGColor,
          })
          .text(`${winRateTeoData.winRatePercentOfTeoMod.toFixed(2)}`)
          //.text(`${entry.getStreak()} | ${windUpData.balance.toFixed(4)}`);
      }

      table.append(row);
    });
  }
  function updateStats() {
    const winRate = hitCount / rollCount;
    const wrtdiff = winRate - teo;

    $("#profit-loss").html(profit.toFixed(4));

    $("#roll-count").html(rollCount);
    $("#hit-count").html(hitCount);
    $("#win-rate").html(
      `${winRate.toFixed(2)} | ${teo.toFixed(2)} | ${wrtdiff.toFixed(2)}`
    );

    $("#high-hit")
      .html(`${highHit.getSummary(rollCount)}`)
      .css({ backgroundColor: highHit.getDeltaColor(rollCount) });
    $("#losing-streak").html(
      `${losingStreak} (${(getPayout() - losingStreak).toFixed(2)})`
    );
  }

  function halt(stopMessage) {
    console.log(stopMessage);
    $("#message").text(stopMessage);
    stopMessage = "";
    stopBetting();
    return;
  }

  function getMaxRolls() {
    if (!maxRollField) {
      maxRollField = $("#max-rolls");
    }
    return Number(maxRollField.val());
  }

  function getStopOnMaxRolls() {
    return getMaxRolls() !== 0;
  }

  function getStopOnLosingStreak() {
    return getLosingStreakMultiplier() !== 0;
  }

  function getStopOnRecoveryLS() {
    const wager = getWager();
    return wager > 0;
  }

  function getStopOnHitCount() {
    return getHitCountTarget() !== 0;
  }

  function getRiskOn() {
    return $("#risk-on").prop("checked");
  }

  function getRollStrategy() {
    if (!rollStrategyField) {
      rollStrategyField = $("#roll-strategy");
    }

    return rollStrategyField.val();
  }

  function getResetHighHitOnBigHit() {
    return $("#reset-high-hit-on-big-hit").prop("checked");
  }

  function getPerformanceAdjustWager() {
    return $("#performance-adjust-wager").prop("checked");
  }

  function getLowCompressionMaxSize() {
    if (!lowCompressionMaxSizeField) {
      lowCompressionMaxSizeField = $("#low-compression-max-size");
    }
    return Number(lowCompressionMaxSizeField.val());
  }

  function getRecoveryLS() {
    if (!recoveryLSField) {
      recoveryLSField = $("#recovery-ls-threshold");
    }
    return Number(recoveryLSField.val());
  }

  function getLowCompressionMaxPressure() {
    if (!lowCompressionMaxPressureField) {
      lowCompressionMaxPressureField = $("#low-compression-max-pressure");
    }
    return Number(lowCompressionMaxPressureField.val());
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

  function getStopOnProfit() {
    return getProfitTarget() !== 0;
  }
  function getStopOnLossLimit() {
    return getLossLimit() !== 0;
  }

  function getLossLimit() {
    if (!lossLimitField) {
      lossLimitField = $("#loss-limit");
    }
    return Number(lossLimitField.val());
  }

  function getProfitTarget() {
    return Number($("#profit-target").val());
  }

  function getLosingStreakMultiplier() {
    if (!lsField) {
      lsField = $("#ls-multiplier");
    }
    return Number(lsField.val());
  }

    function getMaxPressure() {
    if (!maxPressureField) {
      maxPressureField = $("#max-pressure");
    }
    return Number(maxPressureField.val());
  }

  function getHighHitThreshold() {
    if (!highHitThresholdField) {
      highHitThresholdField = $("#high-hit-threshold");
    }
    return Number(highHitThresholdField.val());
  }

  function initWindowEvents() {
    $("#roll-strategy").on("change", function () {
      configureStrategy(this.value);
    });

    $("#max-rolls").on("input", function () {
      const rollStrategy = $("#roll-strategy").val();
      if (rollStrategy !== "expected-hits") return;
      const maxRolls = getMaxRolls();
      $("#hit-count-target").val(calculateExpectedHits(maxRolls));
    });

    $("#set-risk-on-btn").click(function () {
      setWager(getScaledWager());
      $("#profit-target").val(0.0001);
      $("#set-risk-on-btn").hide();
      $("#set-risk-off-btn").show();
      $("#performance-adjust-wager").prop("checked", false);
      $("#risk-on").prop("checked", true);
    });

    $("#set-risk-off-btn").click(function () {
      setWager(0);
      $("#profit-target").val(0);
      $("#performance-adjust-wager").prop("checked", false);
      $("#risk-on").prop("checked", false);
      $("#set-risk-on-btn").show();
      $("#set-risk-off-btn").hide();
    });

    $("#recovery-mode-btn").click(function () {
      $("#risk-on").prop("checked", true);
      $("#profit-target").val(Math.abs(Number((recoveryPL * 2).toFixed(4))));
      $("#performance-adjust-wager").prop("checked", true);
      setPayout(1.92);
      setWager(getScaledWager());
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
      $("#start-betting-btn").hide();
      $("#stop-betting-btn").show();
    });

    $("#stop-betting-btn").click(function () {
      stopBetting();
      $("#start-betting-btn").show();
      $("#stop-betting-btn").hide();
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

  function configureStrategy(strategy) {
    if (strategy === "analytics") {
      doConfigStrategy(0, 0, getWager(), 7, 0);
    } else if (strategy === "full-target") {
      doConfigStrategy(calculateMaxRolls(1), 1, getScaledWager());
    } else if (strategy === "half-target") {
      doConfigStrategy(calculateMaxRolls(0.5), 1, getScaledWager());
    } else if (strategy === "quarter-target") {
      doConfigStrategy(calculateMaxRolls(0.25), 1, getScaledWager());
    } else if (strategy === "expected-hits") {
      const payout = getPayout();

      let maxRolls = 0;

      if (payout <= 100) maxRolls = 100;
      else if (payout <= 1000) maxRolls = 1000;
      else if (payout <= 10000) maxRolls = 10000;

      doConfigStrategy(
        maxRolls,
        calculateExpectedHits(maxRolls),
        getScaledWager(),
        0,
        0
      );
    } else if (strategy === "hit-count") {
      let maxRolls = 0;

      if (payout <= 100) maxRolls = 100;
      else if (payout <= 1000) maxRolls = 1000;
      else if (payout <= 10000) maxRolls = 10000;

      doConfigStrategy(maxRolls, getHitCountTarget(), getScaledWager(), 0, 0);
    }
    $("#performance-adjust-wager").prop("checked", false);
  }

  function doConfigStrategy(
    maxRolls,
    hitCount,
    wager,
    lsm = 0,
    profitTarget = 0.0001
  ) {
    $("#profit-target").val(profitTarget);
    $("#ls-multiplier").val(lsm);
    $("#max-rolls").val(maxRolls);
    $("#hit-count-target").val(hitCount);
    setWager(wager);
  }

  function calculateExpectedHits(maxRolls) {
    const expectedHits = Math.round(getTeo() * maxRolls);
    return Math.max(1, expectedHits);
  }

  // Utility function: Get current roll data
  function getCurrentRollData() {
    return $(".grid.grid-auto-flow-column div span")
      .map(function () {
        return $(this).text();
      })
      .get();
  }

  function getTeo() {
    return 1 / (getPayout() * 1.05);
  }

  function calculateMaxRolls(m) {
    const payout = getPayout();
    return Math.max(1, Math.floor(m * payout));
  }

  function getScaledWager(scalingFactor = 1.5) {
    const target = getPayout();
    const baseWager = getBaseWager();
    return Math.max(0.0001, baseWager * Math.pow(1.01 / target, scalingFactor));
  }

  function getBaseWager() {
    return getBalance() * 0.01;
  }
  function getWager() {
    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Amount")'
    );
    const inputField = payoutFieldGroup.find("input");

    return Number(inputField.val());
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
  // Function to start the betting process
  function startBetting() {
    rollCount = 0;
    $("#message").text("");
    compressionZone = generateCompressionZone(
      getLowCompressionMaxSize(),
      getLowCompressionMaxPressure()
    );
    MIN_WAGER = getWager();
    highHit.payout = 0;
    highHit.round = 0;
    teo = getTeo();
    hitCount = 0;
    losingStreak = 0;
    profit = 0;
    cycleProfit = 0;
    stopped = false;
    doBet(); // Start the async loop
  }

  function stopBetting() {
    stopped = true;
  }

  function getPayout() {
    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Payout")'
    );
    const inputField = payoutFieldGroup.find("input");

    return Number(inputField.val());
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

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function doInit() {
    observeRollChanges();
    initPrototypes();
  }

  function initPrototypes() {
    Array.prototype.last = function () {
      return this[this.length - 1];
    };
    Array.prototype.first = function () {
      return this[0];
    };

    Array.prototype.median = function () {
      if (this.length === 0) return null; // Handle empty array case

      const medianIndex = Math.floor((this.length - 1) / 2); // Get the median index
      return this[medianIndex]; // Return the median element
    };

    Array.prototype.lastN = function (n) {
      if (typeof n !== "number" || n < 0) {
        throw new Error("Argument must be a non-negative number");
      }
      return this.slice(Math.max(this.length - n, 0));
    };
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
          if (
            !arraysAreEqual(previousRollData.lastN(5), currentRollData.lastN(5))
          ) {
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
    if (!Array.isArray(arr1) || !Array.isArray(arr2)) {
      console.error("One of the inputs is not an array", { arr1, arr2 });
      return false;
    }

    if (arr1.length !== arr2.length) return false;

    return arr1.every((val, index) => val === arr2[index]);
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

  function generateTargets() {
    class Target {
      constructor(payout) {
        this.streak = 0;
        this.pstreak = 0;
        this.astreak = 0;
        this.losingStreak = 0;
        this.winningStreak = 0;
        this.downWindUp = 0;
        this.upWindUp = 0;
        this.windUpHistory = [];
        this.streakSignFlipped = false;
        this.totalWindup = 0;
        this.payout = payout;
        this.accumulator = this.payout - 1;
        this.teo = this.getTeo();
        this.rollCount = 0;
        this.rollCountMod = 0;
        this.hitCountMod = 0;
        this.haltReason = null;
        this.hitCount = 0;
        this.windUpPressure = 0;
        this.avgWindUpPressure = 0;
        this.smoothedEV = 0;
        this.overheadPressure = 0;
        this.higherTarget = null;
        this.lowerTarget = null;
        this.ordinal = null;
        this.maxOverheadPressure = 0;
        this.seteWindowSize()
      }

        seteWindowSize() {
            if (this.payout <= 50) {
              this.windowSize = 100;
            } else if (this.payout <= 100) {
              this.windowSize = 200;
            } else if (this.payout <= 500) {
              this.windowSize = 1000;
            } else if (this.payout <= 1000) {
              this.windowSize = 2000;
            } else {
              this.windowSize = 10000;
            }
        }
      getPayout() {
        return this.payout;
      }

      getStreak() {
        return this.streak;
      }

      getAStreak() {
        return this.astreak;
      }

      getPStreak() {
        return this.pstreak;
      }

      push(result, maxPressure, stopOnReovery, recoveryLSLimit, payout) {
        this.rolledOver = false;

        if (this.rollCount % this.windowSize === 0) {
          this.rollOver();
        }

        this.rollCountMod++;
        this.rollCount++;
        this.updateStreak(result);

        if (this.checkWinUpPressureHalt(maxPressure)) {
            this.haltReason = `Target ${this.getPayout()} wind-up below threshold: ${this.getWindUpPressure().toFixed(2)}`;
        } else if (stopOnReovery && this.checkHighPayoutRecoverLS(recoveryLSLimit, payout)) {
            this.haltReason = `Target ${this.getPayout()}: exceeded recover losing streak ${this.getLosingStreak()}`;    
        } else {
          this.resetHalt();
        }
      }

      rollOver() {
          this.rolledOver = true;
          this.hitCountMod = 0;
          this.rollCountMod = 0;
      }

      checkWinUpPressureHalt(maxPressure) {
        return this.getWindUpPressure() < -maxPressure;
      }
      
      checkHighPayoutRecoverLS(recoveryLSLimit, payout) {
        let limit = this.getDynamicRecoveryLimit(recoveryLSLimit);
        return this.getPayout() < payout && 
        this.getPayout() >= 1.5 && 
        this.getLosingStreak() >= (this.getPayout() * limit) 
      }

      getDynamicRecoveryLimit(limit) {
        const wrpot = this.getWinRatePercentOfTeo();

        if (wrpot > 110) {
          return limit + 3; 
        } else if (wrpot > 100) {
          return limit + 2;
        } else if (wrpot < 50) {
          return Math.max(2, limit - 2)
        }
        return limit;
      }
      
      hasHalted() {
        return this.haltReason !== null;
      }

      resetHalt() {
        this.haltReason = null;
      }

      getHaltMessage() {
        return this.haltReason;
      }

      getWinRate() {
        return this.hitCount / this.rollCount;
      }

      getModWinRateMod() {
        return this.hitCountMod / this.rollCountMod;
      }

      getWinRatePercentOfTeo() {
        return (this.getWinRate() / this.getTeo()) * 100;
      }

      getWinRatePercentOfTeoMod() {
        return (this.getModWinRateMod() / this.getTeo()) * 100;
      }

      getRollCount() {
        return this.rollCount;
      }

      updateStreak = (result) => {
        if (result >= this.payout) {
          this.astreak += this.accumulator;
          this.hitCount++;
          this.hitCountMod++;
          if (this.streak < 0) {
            this.streakSignFlipped = true;
            this.pstreak = this.streak;
          } else {
            this.streakSignFlipped = false;
          }
          this.streak = Math.max(this.streak + 1, 1);
        } else {
          this.astreak -= 1;
          if (this.streak > 0) {
            this.streakSignFlipped = true;
            this.pstreak = this.streak;
          } else {
            this.streakSignFlipped = false;
          }
          this.streak = Math.min(this.streak - 1, -1);
        }

        this.losingStreak = this.streak < 0 ? this.streak : 0;
        this.winningStreak = this.streak > 0 ? this.streak : 0;
        this.setWindUpHistory(this.losingStreak === 0);
        this.setWindUpPressure();
        this.setAvgWindUpPressure();
        this.setSmoothedEV();
      };

      getLosingStreak() {
        return Math.abs(this.losingStreak);
      }
      needsNewBlock() {
        return this.rolledOver;
      }

      setWindUpHistory(isHit) {
        // const lastWindUp = this.windUpHistory[this.windUpHistory.length - 1];

        if (this.windUpHistory.length === 0 || this.streakSignFlipped) {
          this.windUpHistory.push(this.getWindUpPressure());
        }

        if (this.windUpHistory.length === 100) this.windUpHistory.shift();
      }

      getAveragePressure() {
        return this.avgWindUpPressure;
      }

      setAvgWindUpPressure() {
        if (this.windUpHistory.length === 0) return 0;
        this.avgWindUpPressure =
          this.windUpHistory.reduce((a, b) => a + b, 0) /
          this.windUpHistory.length;
      }

      getOverheadPressure() {
        return this.overheadPressure;
      }

// setOverheadPressure(decayRate = 1) {
//   if (!this.higherTarget) {
//     this.overheadPressure = 0;
//     this.maxOverheadPressure = this.getWindUpPressure();
//     return;
//   }

//   const overheadPressure = this.higherTarget.getWindUpPressure();
//   const totalPressure = overheadPressure + this.higherTarget.overheadPressure;

//   const distance = this.higherTarget.payout - this.payout;
//   const decayFactor = Math.exp(-decayRate * distance);

//   this.overheadPressure = totalPressure * decayFactor;
//   this.maxOverheadPressure = this.getWindUpPressure() + this.higherTarget.maxOverheadPressure;
// }


setOverheadPressure() {
  if (!this.higherTarget) {
    this.overheadPressure = this.getWindUpPressure();
    this.lowerTarget.setOverheadPressure();
    return;
  }

  this.overheadPressure = this.higherTarget.getWindUpPressure() + this.higherTarget.overheadPressure;
  
  if (this.lowerTarget) {
    this.lowerTarget.setOverheadPressure();    
    return;
  }
}

    getNormalizedOverheadPressure() {
      if (this.ordinal === 0) return this.overheadPressure;
      return this.overheadPressure / this.ordinal;
    }

      setSmoothedEV() {
        const rolls = this.getRollCount();
        const actualWinRate = this.getWinRate();
        const theoreticalWinRate = 1 / this.getPayout();

        const weight = Math.min(1, rolls / (this.getPayout() * 10)); // arbitrary stabilization factor

        const adjustedWinRate =
          weight * actualWinRate + (1 - weight) * theoreticalWinRate;

        this.smoothedEV =
          (this.getPayout() - 1) * adjustedWinRate - (1 - adjustedWinRate);
      }

      getSmootedEV() {
        return this.smoothedEV;
      }

getEVColor() {
  const ev = this.smoothedEV;
  let bg = "transparent";
  let fg = "255 255 255";
  let base = "";
  let ratio = 0;

  if (ev >= 0.25) {
    base = "0 100 0"; // Deep green
    fg = "0 0 0";
    ratio = Math.min(1, (ev - 0.25) / 0.75);
  } else if (ev >= 0.05) {
    base = "0 255 0"; // Green
    fg = "0 0 0";
    ratio = (ev - 0.05) / 0.2;
  } else if (ev > -0.05) {
    return {
      bgColor: `rgb(128 128 128 / 0.1)`, // Chop zone
      fgColor: `rgb(255 255 255 / 0.1)`
    };
  } else if (ev > -0.15) {
    base = "255 165 0"; // Orange
    ratio = (Math.abs(ev) - 0.05) / 0.1;
  } else if (ev > -0.35) {
    base = "255 0 0"; // Red
    ratio = (Math.abs(ev) - 0.15) / 0.2;
  } else {
    base = "128 0 0"; // Dark red
    ratio = Math.min(1, (Math.abs(ev) - 0.35) / 0.65);
  }

  const alpha = 0.2 + 0.8 * ratio;
  return {
    bgColor: `rgb(${base} / ${alpha})`,
    fgColor: `rgb(${fg} / ${alpha})`
  };
}



      getWindUpColor(balance, avgPressure) {
        let base = "";
        let ratio = 0;
        let fgBase = "";

        if (balance < -2) {
          fgBase = "255 255 255";
          base = "255 0 0"; // RED for negative wind-up (underperformance)
          ratio = Math.min(1, Math.abs(balance + 2) / 4); // fade in from -0.25 down
        } else if (balance > 2) {
          fgBase = "0 0 0";
          base = "0 255 0"; // GREEN for positive wind-up (overperformance)
          ratio = Math.min(1, (balance - 2) / 4); // fade in from +0.25 up
        } else {
          return { fgColor: "rgb(255, 255, 255, 0.1)", bgColor: "transparent" };
        }

        const alpha = 0.2 + 0.8 * ratio;
        return {
          bgColor: `rgb(${base} / ${alpha})`,
          fgColor: `rgb(${fgBase} / ${alpha})`,
          avgColor: avgPressure < 0 ? "red" : "green"
        };
      }

      getExpectedStreak() {
        return 1 / this.getTeo(); // e.g. ~100 for 1.01x, ~2 for 2x, etc
      }

      getTeo() {
        return 1 / (this.payout * 1.05);
      }

      getExpectedStreak(streak) {
        return streak < 0 ? this.getTeo() : 1 / this.getTeo();
      }

      getWindUpPressure() {
        return this.windUpPressure;
      }

      setWindUpPressure() {
        const streak = this.getStreak();

        if (streak < 0) {
          this.setDownPressure(streak);
          return;
        }

        this.setUpPressure(streak);
      }

      setDownPressure(streak) {
        const expected = this.getExpectedStreak(streak);

        const normalized = Math.abs(streak) / expected - 1;
        const basePressure = -normalized / this.getPayout() ** 2;

        const winRatePct = this.getWinRatePercentOfTeo(); // e.g. 70 if hitting 70% of TEO
        const relativePerformance = (100 - winRatePct) / 100; // 0.3 if under by 30%

        // Final pressure blends streak momentum + relativePerformance of hit rate
        this.windUpPressure = basePressure * (1 + relativePerformance);
      }

      setUpPressure(streak) {
        const expected = this.getExpectedStreak(streak);

        const normalized = streak / expected - 1;
        const basePressure = normalized / this.getPayout() ** 2;

        const winRatePct = this.getWinRatePercentOfTeo(); // e.g. 70 if hitting 70% of TEO
        const relativePerformance = (100 - winRatePct) / 100; // 0.3 if under by 30%

        // Final pressure blends streak momentum + relativePerformance of hit rate
        this.windUpPressure = basePressure * (1 + relativePerformance);
      }

      getPreviousWindUpPressure() {
        const streak = this.getPStreak();
        const expected = this.getExpectedStreak(streak);

        if (Math.abs(streak) < expected) return 0;

        const normalized = Math.abs(streak) / expected - 1;
        return normalized > 0 ? Math.sign(streak) * normalized : 0;
      }

      getWindUpUIData() {
        const p = this.getWindUpPressure(); // streak * payout
        const avgPressure = this.getAveragePressure();
        const streak = this.getStreak();
        const colors = this.getWindUpColor(p, avgPressure);

        return { balance: p, average: avgPressure, colors: colors };
      }


      getSmootedEVUIData() {
        const ev =  this.getSmootedEV();
        const color = this.getEVColor();

        return { ev: ev, colors: color };
      }
getOverheadPressureColor() {
  const p = this.overheadPressure;
  let bg = "transparent";
  let fg = "255 255 255";
  let base = "";
  let ratio = 0;

  if (p <= -1) {
    base = "128 0 0";  // Deep Red - High negative pressure (bad)
    ratio = Math.min(1, Math.abs(p) / 5);
  } else if (p < 0) {
    base = "255 0 0";  // Red - Mild negative pressure
    ratio = Math.abs(p) / 1;
  } else if (p === 0) {
    return {
      bgColor: `rgb(128 128 128 / 0.1)`,  // Neutral zone
      fgColor: `rgb(255 255 255 / 0.1)`
    };
  } else if (p < 1) {
    base = "0 255 0";  // Green - Mild positive pressure (cool)
    ratio = p / 1;
  } else if (p < 3) {
    base = "0 128 255";  // Blue - Stronger positive pressure
    ratio = (p - 1) / 2;
  } else {
    base = "0 0 255";  // Deep Blue - High positive pressure (relief/hidden strength)
    ratio = Math.min(1, (p - 3) / 2);
  }

  const alpha = 0.2 + 0.8 * ratio;
  return {
    bgColor: `rgb(${base} / ${alpha})`,
    fgColor: `rgb(${fg} / ${alpha})`
  };
}



      getOverheadPressureUIData() {
        const p =  this.getNormalizedOverheadPressure();
        const color = this.getOverheadPressureColor();

        return { p: p, colors: color };
      }

      getWinRatePercentOfTeoUIData() {
        const winRatePercentOfTeo = this.getWinRatePercentOfTeo();
        const winRatePercentOfTeoMod = this.getWinRatePercentOfTeoMod();
        const streak = this.getStreak();
        const astreak = this.getAStreak();

        let bgColor = "transparent";
        let modBGColor = "transparent"
        let streakBGColor = "transparent";
        let aStreakBGColor = "transparent";

        let streakFGColor = "white";
        let fgColor = "white";
        let modFGColor = "white";
        let aStreakFGColor = "white";

        if (winRatePercentOfTeo < 90) {
          bgColor = "red";
        } else if (winRatePercentOfTeo >= 110) {
          bgColor = "green";
        }

        if (this.rollCountMod > this.payout) {
          if (winRatePercentOfTeoMod < 90) {
            modBGColor = "red";
          } else if (winRatePercentOfTeoMod >= 110) {
              modBGColor = "green";
          }
        }

        if (streak < 0 && Math.abs(streak) >= (this.payout * 3)) {
          streakBGColor = "red";
        }

        if (astreak < 0 && Math.abs(astreak) >= (this.payout * 3)) {
          aStreakBGColor = "red";
        }


        return { winRatePercentOfTeoMod: winRatePercentOfTeoMod, 
        winRatePercentOfTeo: winRatePercentOfTeo, 
        bgColor: bgColor,
        fgColor: fgColor,
        aStreakFGColor: aStreakFGColor,
        streak: streak,
        astreak: astreak,
        aStreakBGColor: aStreakBGColor,
        streakBGColor: streakBGColor,
        streakFGColor: streakFGColor,
        modFGColor: modFGColor,
        modBGColor: modBGColor };
      }
    }


    const payouts = generatePayouts();
    const targets = payouts.map(p => new Target(p));
    let targetCount = targets.length;
    targets[targets.length - 1].ordinal = 1
    targets[targets.length - 1].lowerTarget = targets[targets.length - 2]
    // Now wire higherTarget references
    for (let i = 0; i < targets.length - 1; i++) {
      if (i >= 1) {
        targets[i].lowerTarget = targets[i - 1]
      }
      
      targets[i].higherTarget = targets[i + 1];
      targets[i].ordinal = targetCount
      targetCount--;
    }


    return targets;
  }

  function generateCompressionZone(maxSize, maxPressure) {
    class CompressionZone {
      constructor(maxSize, maxPressure) {
        this.maxSize = maxSize;
        this.maxPressure = maxPressure;
        this.targets = {}; // payout → pressure
        this.base = 0;
      }

      getTargets() {
        return this.targets;
      }

      getBase() {
        return this.base;
      }

      getLength() {
        return Object.keys(this.targets).length;
      }

      isFull() {
        return this.getLength() === this.maxSize;
      }

      isGreaterThanBase(payout) {
        return payout > this.base;
      }

      removeTarget(payout) {
        delete this.targets[payout];
        if (this.getLength() === 0) this.base = 0;
      }

      tryAdd(target) {
        const payout = target.getPayout();

        if (payout > 2 || payout === 1.01) return;

        if (target.getStreak() > 0 || target.getOverheadPressure() > -this.maxPressure ||
          target.getWinRatePercentOfTeo() >= 100) {
          this.removeTarget(payout);
          return;
        }

        if (this.isFull()) return;

        const pressure = target.getWindUpPressure();

        if (this.isGreaterThanBase(payout)) {
          this.base = payout;
          this.targets = {};
          this.targets[payout] = pressure;
          return;
        }

        this.targets[payout] = pressure;
      }

      getAveragePressure() {
        const values = Object.values(this.targets);
        if (values.length === 0) return 0;
        return values.reduce((a, b) => a + b, 0) / values.length;
      }

      isReady(threshold = -2) {
        return this.isFull() && this.getAveragePressure() <= threshold;
      }
    }

    return new CompressionZone(maxSize, maxPressure);
  }

  function generatePayouts() {
    const p1 = [
      1.01,
      1.1,
      1.2,
      1.3,
      1.4,
      1.5,
      1.6,
      1.7,
      1.8,
      1.9,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9
    ];

    const p2 = Array.from(
      {
        length: 10
      },
      (v, k) => 10 + k * 10
    );

    const p3 = Array.from(
      {
        length: 10
      },
      (v, k) => 100 + k * 100
    );

    const p4 = Array.from(
      {
        length: 10
      },
      (v, k) => 1000 + k * 1000
    );

    const p5 = Array.from(
      {
        length: 10
      },
      (v, k) => 10000 + k * 10000
    );

    return [...p1, ...p2];
  }
  function getNewWindowHTMLNode(hook) {
    return $(newWindow.document).find(hook);
  }

  window.addEventListener("beforeunload", function () {
    if (newWindow && !newWindow.closed) {
      newWindow.close();
    }
  });

  window.addEventListener(
    "load",
    function () {
      (function () {
        // Open a new floating window with specified dimensions
        newWindow = window.open("", "", "width=1100, height=1200");

        // Define the HTML content for the new window
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
 <head>
   <style>
      body {
      font-family: Arial, sans-serif;
      background-color: #1e2323;
      color: white;
      margin: 0;
      padding: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
      }
      .container {
      height: 100%;
      }
      /* Blocks Section */
      .blocks-wrapper {
      flex: 3;
      overflow-y: auto;
      padding: 10px;
      display: flex;
      flex-direction: column;
      }
      #stateBlockContainer {
      display: flex;
      flex-direction: column;
      gap: 10px;
      }
      .state-block-row {
      display: flex;
      align-items: center;
      gap: 5px;
      }
      .state-block {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      background-color: #444;
      cursor: pointer;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
      }
      .lookback-label {
      font-size: 0.9rem;
      color: #aaa;
      margin-right: 8px;
      }

      .message-box {
      margin-bottom: 10px;
      background-color: #333;
      padding: 10px;
      border-radius: 4px;
      color: white;
      font-size: 0.9rem;
      }
      .stats-block {
      margin-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      padding-bottom: 5px;
      }
      /* Collapsible Panel */
      .panel-wrapper {
      position: absolute;  /* ✅ Sticks it to the right */
      top: 0;
      right: 0;  /* ✅ Ensures it stays attached to the right */
      height: 100vh; /* ✅ Full height */
      width: 300px; /* ✅ Default expanded width */
      background-color: #2a2d2e;
      border-left: 1px solid #444;
      padding: 10px;
      overflow-y: auto;
      transition: width 0.3s ease-in-out; /* ✅ Smooth transition */
      }
      .panel-collapsed {
      width: 0px !important;
      padding: 0;
      overflow: hidden;
      border-left: none; /* ✅ Hides border when collapsed */
      }
      /* ✅ Left Content Fills Available Space */
      .main-content {
      margin-right: 300px; /* ✅ Prevents overlap when panel is open */
      transition: margin-right 0.3s ease-in-out;
      }
      .main-content.panel-collapsed {
      margin-right: 0px; /* ✅ Expands when panel collapses */
      }
      .panel-wrapper.collapsed {
      transform: translateX(100%);
      }
      .panel h2 {
      font-size: 1.2rem;
      margin-bottom: 0.5rem;
      color: #00bcd4;
      }
      .panel label {
      display: block;
      margin-bottom: 5px;
      color: white;
      }
      .panel input,
      .panel select {
      width: 100%;
      margin-bottom: 10px;
      padding: 5px;
      background-color: #333;
      color: white;
      border: 1px solid #555;
      border-radius: 4px;
      }
      .panel button {
      background-color: #555;
      border: none;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      }
      .panel button:hover {
      background-color: #777;
      }
      /* Toggle Button */
      .toggle-panel-button {
      position: fixed;
      top: 10px;
      right: 10px;
      width: 30px;
      height: 30px;
      background-color: #00bcd4;
      border: none;
      color: white;
      border-radius: 50%;
      cursor: pointer;
      font-size: 1.2rem;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1001;
      }
      .toggle-panel-button:hover {
      background-color: #0097a7;
      }
      .output-table {
      width: 100%;
      border-collapse: collapse;
      border: none; /* ✅ Removes the ugly gray border */
      }
      .target-row td {
      padding: 4px;
      vertical-align: middle;
      border: none; /* ✅ Removes individual cell borders */
      }
      .streak-blocks {
      display: flex;
      gap: 2px;
      }
      .strength-meter {
      display: flex;
      gap: 2px;

      min-height: 14px;
      justify-content: flex-start;
      }
      .strength-bar {
      width: 8px;
      height: 14px;
      border-radius: 2px;
      }
   </style>
</head>
<body>
   <div class="container">
      <!-- Blocks Section -->
      <div id="analytics-wrapper">
         <table id="output-table">
            <tbody>
            </tbody>
         </table>
      </div>
   </div>
   </div>
</body>
</html>
`;

        // Write the content to the new window
        newWindow.document.write(htmlContent);
        newWindow.document.close();
      })();
    },
    false
  );

  doInit();
  // Initialize MutationObserver
})();
