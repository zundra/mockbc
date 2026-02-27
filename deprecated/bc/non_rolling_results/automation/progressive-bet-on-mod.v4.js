/* Start Script */
// ==UserScript==
// @name         bc.game progressive bet on mod v4
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://*.game/game/limbo?fast-roll=true
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bc.game
// @require https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @grant        none
// ==/UserScript==

(function() {
    "use strict";

class RiskManager {
  constructor(payout, wager, parentTarget) {
    this.baseWager = this.wager = wager;
    this.payout = payout;
    this.target = parentTarget;
    this.cycleMod = Math.floor(payout);
    this.profitLoss = 0;
    this.cycleProfitLoss = 0;
    this.rollCount = 0;
    this.losingStreak = 0;
    this.winningStreak = 0;
    this.shouldScaleWager = false;
  }

  addResult(currentWager, result) {
    this.rollCount++;
    if (result >= this.payout) {
      this.losingStreak = 0;
      this.winningStreak++;
      this.increment();
      this.setWager(currentWager, true);
    } else {
      this.losingStreak++;
      this.winningStreak = 0;
      this.decrement();
      this.setWager(currentWager, false);
    }
  }


setWager(currentWager, isHit) {
  this.wager = currentWager || this.baseWager;

  // if (this.target?.overrideWagerToBase || this.target?.riskOnRollCount < this.target.getPayout() * 2) {
  //   this.wager = this.baseWager;
  //   this.target.overrideWagerToBase = false;
  //   return;
  // }

  // Handle high payout strategy (≥2x)
  // const winRatePercentOfTeo = this.target.getWinRatePercentOfTeo();
  // const riskOnStartPercentOfTeo = this.target.riskOnStartPercentOfTeo;

  // this.wager = Math.max(this.baseWager / 2, this.baseWager + (this.baseWager - (this.baseWager * ((winRatePercentOfTeo / 0.01) / 100))))

    const currentShort = this.target.getWinRatePercentOfTeo(100);
    const currentLong = this.target.getWinRatePercentOfTeo(100);
    const start = this.target.riskOnStartPercentOfTeo;

    const diff = start - currentShort; // positive = underperforming

    // Normalize the diff (e.g., divide by 50 to control scaling aggression)
    const scaleFactor = Math.max(0, diff / 50); // Never negative

    // Cap scaleFactor to avoid runaway growth (optional)
    //const cappedScale = Math.min(scaleFactor, 1); // Max 2x wager

    // this.wager = this.baseWager * (1 + scaleFactor); // From 1x to 2x


    if (this.losingStreak % this.cycleMod === 0) {
      if (currentShort < 100) {
        
        const m = currentLong < 100 ? 1.4 : 1.1;

        this.wager = this.baseWager * (1 + (this.losingStreak ** m) / 10);
      } else {
        this.wager = this.baseWager * (1 + scaleFactor); // From 1x to 2x
      }
    } else {
      //const cappedScale = Math.min(scaleFactor, 1); // Max 2x wager

      // this.wager = this.baseWager * (1 + scaleFactor); // From 1x to 2x
      // const losingStreak = (Math.abs(this.target.stats.losingStreak))
    }

}

isScaledUp() {
  return this.wager > this.baseWager;
}

// setWager(currentWager, isHit, winRatePercentOfTeo) {
//   this.wager = currentWager || this.baseWager;

//   if (this.target?.overrideWagerToBase) {
//     this.wager = this.baseWager;
//     this.target.overrideWagerToBase = false;
//     return;
//   }

//   // Handle low payout strategy (<2x)
//   if (this.payout < 2) {
//     //this.baseWager + (this.baseWager - (this.baseWager * ((winRatePercentOfTeo / .8) / 100)))
//     const payoutFraction = (this.payout - 1) / this.payout;
//     const streakCap = 10;

//     const cappedLosingStreak = Math.min(this.losingStreak, streakCap);
//     const cappedWinningStreak = Math.min(this.winningStreak, streakCap);

//     if (this.losingStreak > 0) {
//       const gain = this.wager * cappedLosingStreak * payoutFraction;
//       this.wager = Math.min(1, this.wager + gain);
//     } else if (this.winningStreak > 0) {
//       const reduction = this.wager * cappedWinningStreak * payoutFraction;
//       this.wager = Math.max(this.baseWager, this.wager - reduction);
//     }

//     return;
//   }

//   // Handle high payout strategy (≥2x)
//   const entryTeo = this.target?.riskOnStartPercentOfTeo || 100;
//   const performance = winRatePercentOfTeo / entryTeo;
//   let scale = Math.max(this.baseWager / 2, Math.min(2, 2 - (performance / 0.8)));

//   // === Aggressive Scaling Logic ===
//   if (this.target?.isRiskOn()) {
//     // 🔥 Deep Draw Boost
//     if (this.target.deepDrawDetected) {
//       const delta = Math.abs(entryTeo - winRatePercentOfTeo);
//       scale += delta / 100;
//     }

//     // 🟡 Grind Recovery Boost
//     if (this.target.grindRecoveryMode) {
//       const grindPenalty = Math.abs(this.target.getRiskOnPL()) / this.baseWager;
//       scale += grindPenalty * 0.5;
//     }
//   }

//   // Cap total scale
//   scale = Math.min(scale, 8);
//   this.wager = this.baseWager * scale;
// }


  setHighPayoutWager(isHit) {
    if (isHit) {
      if (this.isProfitableCycle()) {
        this.cycleProfitLoss = 0;
        this.wager = this.baseWager;
      } else {
        this.wager = Math.max(this.wager / 2, this.baseWager);
      }
    } else {
      if (this.losingStreak % this.cycleMod === 0) {
        this.wager *= 2;
      }
    }
  }

  setLowPayoutWager(isHit) {
    if (isHit) {
      if (this.isProfitableCycle()) {
        this.cycleProfitLoss = 0;
        this.wager = this.baseWager;
      } else {
        this.wager = Math.max(this.wager * 0.75, this.baseWager);
      }
    } else {
      this.wager = this.baseWager * (1 + (this.losingStreak ** 1.2) / 10);
    }
  }

  getWager() {
    return this.wager;
  }

  getPayout() {
    return this.payout;
  }

  getPL() {
    return this.profitLoss;
  }

  getCyclePL() {
    return this.cycleProfitLoss;
  }

  isProfitable() {
    return this.profitLoss > 0;
  }

  isProfitableCycle() {
    return this.cycleProfitLoss >= (this.wager * this.payout) / 2;
  }

  getLossLimitExceeded() {
    if (!this.lossLimit || this.isProfitable()) return false;
    const currentLoss = Math.abs(this.profitLoss);
    return currentLoss >= this.lossLimit;
  }

  increment() {
    const pl = this.wager * this.payout - this.wager;
    this.profitLoss += pl;
    this.cycleProfitLoss += pl;
  }

  decrement() {
    this.profitLoss -= this.wager;
    this.cycleProfitLoss -= this.wager;
  }
}



class Stats {
  constructor(payout, size = 100) {
    this.size = size;
    this.payout = payout;
    this.streak = 0;
    this.pstreak = 0;
    this.hitCount = 0;
    this.losingStreak = 0;
    this.streakSignFlipped = 0;
    this.rollingResults = [];
  }

  push = (result) => {
    this.updateStreak(result);

    if (this.rollingResults.length > this.size) this.rollingResults.shift();

    this.rollingResults.push(result >= this.payout ? 1 : 0);
  };

  updateStreak = (result) => {
    if (result >= this.payout) {
      this.hitCount++;
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
  };

  getStreak() {
    return this.streak;
  }

  getRate(lookback = 100) {
    const data = this.rollingResults.slice(-lookback); // Use only the latest `lookback` results
    if (data.length === 0) return 0;
    return (data.reduce((sum, val) => sum + val, 0)) / data.length;
  }

  getWinRate = (lookback = 10) => this.getRate(lookback);

  getTeo = () => 1 / (this.getPayout() * 1.05);
}

class Target {
  constructor(payout, baseWager, lowerThreshold, upperThreshold, size = 10000) {
    this.stats = new Stats(payout, size);
    this.payout = payout;
    this.riskManager = new RiskManager(payout, baseWager, this);
    this.lowerThreshold = lowerThreshold
    this.upperThreshold = upperThreshold
    this.riskOn = false;
    this.riskOnPL = 0;
    this.riskOnRollCount = 0;
    this.riskOnHitCount = 0;
    this.riskOnStartPercentOfTeo = 0;
    this.riskOnStartLongPercentOfTeo = 0;
    this.riskOnResults = [];
    this.wasAboveTeo = false;
    this.deepDrawDetected = false;
    this.deepDrawExitUsed = false;
    this.grindRecoveryMode = false;
    this.riskOnCooldownUntilRoll = 0;
    this.overrideWagerToBase = true;
        this.teoDiffHistory = []
        this.shortTeoDiffHistory = []
        this.longTeoDiffHistory = []
  }

  push(currentWager, result) {
    this.stats.push(result);
    this.addTeoDiff(this.getWinRatePercentOfTeo(100))
    if (this.isRiskOn()) {
      this.setRiskOnStats(currentWager, result);
      this.riskManager.addResult(
        currentWager,
        result
      );
      this.setRiskOnResult();

      // Detect deep drawdown (real financial pain)
      if (
        !this.deepDrawDetected &&
        this.getRiskOnPL() < -this.getPayout()
      ) {
        this.deepDrawDetected = true;
      }

      // Detect grind mode (stuck underwater)
      if (
        !this.grindRecoveryMode &&
        this.getRiskOnPL() < 0 &&
        this.getWinRatePercentOfTeo(100) < 100
      ) {
        this.grindRecoveryMode = true;
      }
    }
  }

  setRiskOnStats(currentWager, result) {
    this.riskOnRollCount++;
    if (result >= this.payout) {
      this.riskOnHitCount++;
      this.riskOnPL += this.payout * currentWager - currentWager;
    } else {
      this.riskOnPL -= currentWager;
    }
  }

  getRiskOnWinRate() {
    return this.riskOnHitCount / this.riskOnRollCount;
  }

  setRiskOnResult(result) {
    let nextEntry = this.getStreak();

    if (this.riskOnResults.length === 0) {
      this.riskOnResults.push(nextEntry);
      return;
    }

    const lastEntry = this.riskOnResults.last();

    if ((nextEntry < 0 && lastEntry > 0) || (nextEntry > 0 && lastEntry < 0)) {
      this.riskOnResults.push(nextEntry);
    } else {
      this.riskOnResults.pop();
      this.riskOnResults.push(nextEntry);
    }
  }

  tryRiskOn2(currentRoll) {
    const short = this.getMovingAverageDirection(100);
    const long = this.getMovingAverageDirection(1000);
    const shortMADirection = this.getMovingWinRateDiffAverageDirection(10);

    if (shortMADirection === 1 && long < 100) {
      this.resetRiskOnState(true);
    }
  }

  tryRiskOn() {   
    const long = this.getWinRatePercentOfTeo(1000);
    const shortDir = this.getMovingAverageDirection(this.shortTeoDiffHistory, 10);
    const longDir = this.getMovingAverageDirection(this.longTeoDiffHistory, 10);

    // if (long < 110 && short === 1 && long === 1) {
    if (shortDir === 1 && longDir === 1) {
      this.resetRiskOnState(true);
      this.riskOnStartPercentOfTeo = this.getWinRatePercentOfTeo(100);
    }
  }

  tryRiskOff() {
   // if (!this.riskManager.isProfitableCycle()) return;

    const shortDir = this.getMovingAverageDirection(this.shortTeoDiffHistory, 10);
    const longDir = this.getMovingAverageDirection(this.longTeoDiffHistory, 10);

    if (shortDir === -1 || longDir === -1) {
        this.resetRiskOnState(false);
        this.riskOnStartPercentOfTeo = 0;
    }

    // if (long === -1) {
    //   if (this.riskManager.isScaledUp()) {
    //     if (this.getStreak() > 0) {
    //       this.resetRiskOnState(false);          
    //       this.riskOnStartPercentOfTeo = 0;
    //     }
    //   } else {
    //     this.resetRiskOnState(false);
    //     this.riskOnStartPercentOfTeo = 0;
    //   }
    // }
  }

  tryRiskOff2(currentRoll) {
    const short = this.getWinRatePercentOfTeo(100);
    const long = this.getWinRatePercentOfTeo(1000);
    const shortMADirection = this.getMovingWinRateDiffAverageDirection(10);

    if (shortMADirection === -1 || long > 150) {
      this.resetRiskOnState(false);
      this.riskOnStartPercentOfTeo = 0;
    }
  }

  getRiskOnPL() {
    return this.riskOnPL;
  }

  resetRiskOnState(riskOn) {
    this.riskOnResults.length = 0;
    this.riskOnPL = 0;
    this.riskOn = riskOn;
    this.riskOnRollCount = 0;
    this.riskOnHitCount = 0;
    this.wasAboveTeo = false;
    this.deepDrawDetected = false;
    this.deepDrawExitUsed = false;
    this.grindRecoveryMode = false;

  }

 // Push new TEO diff value
  addTeoDiff(value) {
    this.teoDiffHistory.push(value);
    this.shortTeoDiffHistory.push(this.getWinRatePercentOfTeo(100))
    this.longTeoDiffHistory.push(this.getWinRatePercentOfTeo(1000))
  }

  getTeoDiffMovingAverage(lookback) {
    if (this.teoDiffHistory.length < lookback) return 0;
    const recent = this.teoDiffHistory.slice(-lookback);
    const sum = recent.reduce((a, b) => a + b, 0);
    return sum / lookback;
  }

  getMovingWinRateDiffAverageDirection(lookback = 5) {
    if (this.teoDiffHistory.length < lookback * 2) return 0;

    const mid = this.teoDiffHistory.length - lookback;
    const oldAvg = this.teoDiffHistory.slice(mid - lookback, mid)
      .reduce((a, b) => a + b, 0) / lookback;

    const newAvg = this.teoDiffHistory.slice(mid, mid + lookback)
      .reduce((a, b) => a + b, 0) / lookback;

    if (newAvg > oldAvg) return 1;
    if (newAvg < oldAvg) return -1;
    return 0;
  }

  getMovingAverageDirection(data, lookback = 5) {
    if (data.length < lookback * 2) return 0;

    const mid = data.length - lookback;
    const oldAvg = data.slice(mid - lookback, mid)
      .reduce((a, b) => a + b, 0) / lookback;

    const newAvg = data.slice(mid, mid + lookback)
      .reduce((a, b) => a + b, 0) / lookback;

    if (newAvg > oldAvg) return 1;
    if (newAvg < oldAvg) return -1;
    return 0;
  }

  isRiskOn() {
    return this.riskOn;
  }

  getStreak() {
    return this.stats.getStreak();
  }

  goRiskOn() {
    this.riskOn = true;
  }

  goRiskOff() {
    this.riskOn = false;
  }

  getRate(lookback) {
    return this.stats.getRate(lookback);
  }

  getPayout() {
    return this.payout;
  }

  getWager() {
    return this.riskManager.getWager();
  }

  getWinRatePercentOfTeo = (lookback = 100) => {
    let winRate = 0;

    // if (this.isRiskOn()) {
    //   winRate = this.getRiskOnWinRate();
    // } else {
    //   winRate = this.stats.getRate(lookback)
    // }
    winRate = this.stats.getRate(lookback)
    return (winRate / this.getTeo()) * 100;
  };

  getTeo() {
    return 1 / (this.payout * 1.05);
  }

  getStrength() {
    const streak = this.stats.getStreak();
    return Math.ceil(this.payout + streak) / this.payout;
  }

  getRiskOnPerformance() {
    const data = this.riskOnResults.slice();
    const expected =
      data.reduce((a, b) => Math.abs(a) + Math.abs(b), 0) * this.getTeo();
    const actual = data.filter((r) => r > 0).reduce((a, b) => a + b, 0);
    const delta = expected - actual;
    const result = { expected: expected, actual: actual, delta: delta };
    console.log(result);
    return result;
  }
}




    let lastRollSet = [];
    let currentRollSet = [];
    let rollCount = 0;
    let losingStreak = 0;
    let stopped = true;
    let hitCount = 0;
    let wager = 0;
    let baseWager = 0;
    let cyclePL = 0;
    let rollMod = 0;
    let currentTarget = 0;
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
            if (highHit.getRollDelta(rollCount) >= (highHit.payout * 2)) {
                return "red";
            }
            return "transparent";
        }
    }

    let teo = 0;

    let html = `
    <div id="probability-grid-wrapper">
        <h3 style="text-align: center">🎯 Payout Grid Tracker</h3>
        <table id="grid">
          <tr><th></th><th>0</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th></tr>
        </table>
    </div>
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

        <div>Short Percent of Teo: <span id="short-win-rate-percent-of-teo"></span></div>
        <div>Long Percent of Teo: <span id="long-win-rate-percent-of-teo"></span></div>

        <div>Short Direction: <span id="short-win-rate-percent-of-teo-direction"></span></div>
        <div>Long Direction: <span id="long-win-rate-percent-of-teo-direction"></span></div>

        <div>Hit Count: <span id="hit-count"></span></div>
        <div>High Hit: <span id="high-hit"></span></div>
        <div>Win Rate: <span id="win-rate"></span></div>
        <div>Losing Streak: <span id="losing-streak"></span></div>
        <div>Cycle PL: <span id="cycle-pl"></span></div>

        </div>
         <div class="control-group">
            <label>Reset On Start</label>
            <input id="reset-on-start" type="checkbox" checked="checked"/>
         </div>


           <div class="control-group">
            <label>Base Wager</label>
            <input type="number" id="base-wager" value="0.03" style="color: black"/>
            </div>


           <div class="control-group">
            <label>Risk On Target</label>
            <input type="number" id="risk-on-target" value="10" style="color: black"/>
            </div>

           <div class="control-group">
            <label>Short Percent of Teo Threshold</label>
            <input type="number" id="short-percent-of-teo-threshold" value="50" style="color: black"/>
            </div>
           <div class="control-group">
            <label>Long Percent of Teo Threshold</label>
            <input type="number" id="long-percent-of-teo-threshold" value="150" style="color: black"/>
            </div>

          <div class="control-group">
            <label>Losing Streak Multiplier</label>
  <select id="ls-multiplier">
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
            <label>Max Rolls Multiplier</label>
  <select id="max-rolls-multiplier">
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

    </div>
`;

    $("body").prepend(html);
   initWindowEvents()
   let riskOnTarget = null;
    let wagerField = null;
    let payoutField = null;

    function evalResult(result) {
        rollCount++;
        
        riskOnTarget.push(getWager(), result);

        rollCount++;
        if (result >= getPayout()) {
            hitCount++;
            losingStreak = 0;
        } else {
            losingStreak++;
        }

        if (rollCount > 20) {
            
            if (!riskOnTarget.isRiskOn()) {
                riskOnTarget.tryRiskOn();
            } else {
              riskOnTarget.tryRiskOff()
            }

            if (riskOnTarget.isRiskOn()) {
                setNextBet();
            } else {
              zeroNextBet();
            }
        }        

        if (result > highHit.payout) {
            highHit.payout = result;
            highHit.round = rollCount;
        }

        checkHalts(result);
        updateUI();
    }

    function setNextBet() {
        setWager(riskOnTarget.getWager())
        setPayout(riskOnTarget.getPayout())
    }

    function zeroNextBet() {
        setWager(0)
        setPayout(riskOnTarget.getPayout())
    }

    function checkHalts(result) {

         if (getStopOnLosingStreak() && (losingStreak >= (getPayout() * getLosingStreakMultiplier()))) {
            halt("Losing streak threshold hit");
            return;
        }

        if (getStopOnMaxRolls() && rollCount >= getMaxRolls()) {
            halt("Max rolls hit");
            return;
        }
    }

    function updateUI() {
        const winRate = hitCount / rollCount;
        const wrtdiff = winRate - teo;
        const short = riskOnTarget.getWinRatePercentOfTeo(100);
        const long = riskOnTarget.getWinRatePercentOfTeo(1000);
    
        const shortDir = riskOnTarget.getMovingAverageDirection(riskOnTarget.shortTeoDiffHistory, 10);
        const longDir = riskOnTarget.getMovingAverageDirection(riskOnTarget.longTeoDiffHistory, 10);

        const maDirectionLabel = shortDir === -1 ? "Down" : (shortDir === 1 ? "UP" : "Neutral")
        const lmaDirectionLabel = longDir === -1 ? "Down" : (longDir === 1 ? "UP" : "Neutral")


        let shortColor = "transparent"
        
        if (shortDir === -1) {
          shortColor = "red";
        } else if (shortDir === 1) {
          shortColor = "green";
        }


        let longColor = "transparent";

        if (longDir === -1) {
          longColor = "red";
        } else if (longDir === 1) {
          longColor = "green";
        }

        $("#roll-count").html(rollCount);
              $("#hit-count").html(hitCount);
              $("#win-rate").html(`${(winRate.toFixed(2))} | ${(teo).toFixed(2)} | ${(wrtdiff).toFixed(2)}`);


      $("#high-hit").html(`${highHit.getSummary(rollCount)}`).css({backgroundColor: highHit.getDeltaColor(rollCount)});
      $("#losing-streak").html(`${losingStreak} (${(getPayout() - losingStreak).toFixed(2)})`);
      $("#cycle-pl").html(`${riskOnTarget.riskManager.getCyclePL().toFixed(4)}`);

      $("#short-win-rate-percent-of-teo").html(`${short.toFixed(2)}`).css({backgroundColor: shortColor})
      $("#long-win-rate-percent-of-teo").html(`${long.toFixed(2)}`).css({backgroundColor: longColor})

      $("#short-win-rate-percent-of-teo-direction").html(`${maDirectionLabel}`).css({backgroundColor: shortColor})

      $("#long-win-rate-percent-of-teo-direction").html(`${lmaDirectionLabel}`).css({backgroundColor: longColor})

    }

    function halt(stopMessage) {
        console.log(stopMessage)
        $("#message").text(stopMessage);
        stopMessage = ""
        stopBetting()
        return
    }

    function getMaxRolls() {
        return Math.ceil(getMaxRollMultiplier() * getPayout());
    }

    function getMaxRollMultiplier() {
        return  Number($("#max-rolls-multiplier").val());
    }

  function getStopOnMaxRolls() {
    return getMaxRollMultiplier() !== 0;
  }

  function getStopOnLosingStreak() {
    return getLosingStreakMultiplier() !== 0;
  }

  function getStopOnHitCount() {
    return getHitCountTarget() !== 0;
  }

  function getLongPercentOfTeoThreshold() {
    return Number($("#long-percent-of-teo-threshold").val())
  }
  
  function getShortPercentOfTeoThreshold() {
    return Number($("#short-percent-of-teo-threshold").val())
  }

    function getLosingStreakMultiplier(payout) {
        return Number($("#ls-multiplier").val())
    }


  function getBaseWager() {
    return Number($("#base-wager").val())
  }

  function getRiskOnTarget() {
    return Number($("#risk-on-target").val())
  }

  function initWindowEvents() {
        $(document).on("keypress", function(e) {
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
        scroll: false,
      })
  }

    // Utility function: Get current roll data
    function getCurrentRollData() {
        return $(".grid.grid-auto-flow-column div span")
            .map(function() {
                return $(this).text();
            }).get();
    }

       function getTeo() {
        return 1 / (getPayout() * 1.05)
      }

    // Function to start the betting process
    function startBetting() {
      if (getResetOnStart()) {
          rollCount = 0;
          riskOnTarget = new Target(getRiskOnTarget(), getBaseWager(), getShortPercentOfTeoThreshold(), getLongPercentOfTeoThreshold())
          currentTarget = 0;
          highHit.payout = 0;
          highHit.round = 0;
          hitCount = 0;
          losingStreak = 0;
        }
        teo = getTeo();
        stopped = false;
        setWager(0)
        setPayout(riskOnTarget.getPayout())
        baseWager = getWager();
        wager = baseWager;
        rollMod = Math.floor(getPayout())
        doBet(); // Start the async loop
    }

    function getResetOnStart() {
      return $("#reset-on-start").prop("checked")
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

    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function doInit() {
        observeRollChanges();
        initPrototypes();
    }

      function initPrototypes() {
    Array.prototype.last = function () {
      return this[this.length - 1]
    }
    Array.prototype.first = function () {
      return this[0]
    }

    Array.prototype.median = function () {
      if (this.length === 0) return null // Handle empty array case

      const medianIndex = Math.floor((this.length - 1) / 2) // Get the median index
      return this[medianIndex] // Return the median element
    }
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
            .map(function() {
                return Number($(this).text().replace("x", ""));
            }).get();

        if (arraysAreEqual(currentRollSet, lastRollSet)) {
            return -1;
        }

        return currentRollSet[currentRollSet.length - 1];
    }

  function getWager() {
    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Amount")',
    )
    const inputField = payoutFieldGroup.find("input")

    return Number(inputField.val())
  }

    function setPayout(amount) {
        if (!payoutField) {
            const payoutFieldGroup = $('div[role="group"]').has(
            'label:contains("Payout")')
            payoutField = payoutFieldGroup.find("input")
        }


        if (payoutField.length) {
            let nativeSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                "value",
            ).set

            nativeSetter.call(payoutField[0], amount) // Update input field value

            let event = new Event("input", {
                bubbles: true,
            })
            payoutField[0].dispatchEvent(event)

            let reactEvent = new Event("change", {
                bubbles: true,
            })
            payoutField[0].dispatchEvent(reactEvent) // React listens for change events
        } else {
            console.error("Payout input field not found!")
        }
    }

    function setWager(amount) {
      if (!wagerField) {
        const payoutFieldGroup = $('div[role="group"]').has('label:contains("Amount")');
        wagerField = payoutFieldGroup.find("input");
      }

      if (wagerField?.length) {
        const currentValue = parseFloat(wagerField.val());

        if (currentValue !== amount) {
          let nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value",
          ).set;

          nativeSetter.call(wagerField[0], amount);
          wagerField[0].dispatchEvent(new Event("input", { bubbles: true }));
          wagerField[0].dispatchEvent(new Event("change", { bubbles: true }));
        }
      } else {
        console.error("Wager input field not found!");
      }
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

doInit()
    // Initialize MutationObserver
})()