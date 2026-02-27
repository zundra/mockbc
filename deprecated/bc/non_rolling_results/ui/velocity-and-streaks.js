/* Start Script */
// ==UserScript==
// @name         bc.game streaks velocity v1
// @namespace    http://tampermonkey.net/
// @version      0.1
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

  const targets = generateTargets();
  const compressionZone = generateCompressionZone();
  let lastRollSet = [];
  let currentRollSet = [];
  let prevLowHit = null;

  $("<style>")
    .prop("type", "text/css")
    .html(
      `
             #sv-stats-panel-header {
                background: #333;
                padding: 12px;
                font-weight: bold;
                text-align: center;
                border-radius: 8px 8px 0 0;
                font-size: 16px;
                cursor: grab;
            }

            #sv-stats-panel {
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
                height: 1000px;
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

  const statsPanel = `<div id="sv-stats-panel" style="
   position: fixed;
   top: 300px;
   left: 500px;
   z-index: 9999;
   background: #1e1e1e;
   color: #fff;
   padding: 16px;
   width: 1200px;
   border-radius: 10px;
   box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
   font-family: Arial, sans-serif;
   font-size: 14px;
   line-height: 1.6;
   cursor: grab;
   ">
   <div id="sv-stats-panel-header" style="
      background: #333;
      padding: 10px;
      font-weight: bold;
      text-align: center;
      border-radius: 8px 8px 0 0;
      cursor: grab;
      ">⚙️ Losing Streaks</div>
      <div style="background-color: #1e1e1e; border: 1px solid #333; border-radius: 6px; padding: 10px; margin-top: 10px; color: #ccc; font-family: sans-serif; font-size: 15px; overflow-x: auto;">
         <table style="width: 100%; border-collapse: collapse;" id="output-table">
            <thead>
               <tr>
                  <th style="position: sticky; left: 0; background-color: #1e1e1e; z-index: 1; text-align: left; padding: 6px; white-space: nowrap;">
                     Payout
                  </th>
                  <th style="position: sticky; left: 0; background-color: #1e1e1e; z-index: 1; text-align: left; padding: 6px; white-space: nowrap;">
                     Streak
                  </th>

                  <th style="position: sticky; left: 0; background-color: #1e1e1e; z-index: 1; text-align: left; padding: 6px; white-space: nowrap;">
                     Diff
                  </th>
                  <th style="position: sticky; left: 0; background-color: #1e1e1e; z-index: 1; text-align: left; padding: 6px; white-space: nowrap;">
                     Weighted Streak
                  </th>
                  <th style="position: sticky; left: 0; background-color: #1e1e1e; z-index: 1; text-align: left; padding: 6px; white-space: nowrap;">
                     Cumulative Weighted Streak
                  </th>
                  <th style="position: sticky; left: 0; background-color: #1e1e1e; z-index: 1; text-align: left; padding: 6px; white-space: nowrap;">
                     Ratio
                  </th>
                  <th style="position: sticky; left: 0; background-color: #1e1e1e; z-index: 1; text-align: left; padding: 6px; white-space: nowrap;">
                     Expected | Observed | ZIndex | Speed
                  </th>
                  <th style="position: sticky; left: 0; background-color: #1e1e1e; z-index: 1; text-align: left; padding: 6px; white-space: nowrap;">
                     Deviation
                  </th>
               </tr>
            </thead>
            <tbody></tbody>
         </table>
      </div>
   </div>
</div>`;

  $("body").prepend(statsPanel);

  initWindowEvents();

  function evalResult(result) {
    if (result === -1) return;

    targets.forEach((target) => {
      target.addResult(result);
    });

    compressionZone.tryProcessCompression(targets);

    updateUI();
  }

  function updateUI() {
    renderTable();
  }


  function getRatioColor(ratio) {
    // Logistic squash for smooth scaling
    const absRatio = Math.abs(ratio);
    const intensity = 1 / (1 + Math.exp(-8 * (absRatio - 0.2)));

    // Cold (negative ratio) = red, Hot (positive ratio) = blue
    const baseColor = ratio < 0 ? [200, 50, 50] : [50, 100, 220];

    return `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${Math.min(1, intensity)})`;
  }

function getStreakColor(streak) {
  // streak < 0 = losing streak (cold), streak > 0 = winning streak (hot)
  const absStreak = Math.abs(streak);

  // Logistic squash: tames big streaks, emphasizes near-threshold
  const intensity = 1 / (1 + Math.exp(-0.6 * (absStreak - 3)));

  // Choose base color (red = losing, blue = winning)
  const baseColor = streak < 0 ? [200, 50, 50] : [50, 100, 220];

  // Map intensity into RGBA alpha
  const alpha = Math.min(1, intensity);

  return `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${alpha})`;

}
  function renderTable() {
    const $tbody = $("#output-table tbody");
    $tbody.empty();

    targets.forEach((entry) => {
      const payout = entry.getPayout();
      const streak = entry.getStreak();
      const weightedStreak = entry.getWeightedStreak();
      const cWeightedStreak = entry.getCweightedStreak();
      const sanitized = entry.getHTMLID();
      const diff = entry.getDiff();
      const ratio = entry.getRatio();
      const percentOfTeo = entry.getWinRatePercentOfTeo();

      let streakColor = "transparent";
      let streakTextColor = "white";
      let weightedStreakColor = "transparent"
      let cWeightedStreakColor = "transparent";

      let ratioColor = "transparent";
      let ratioTextColor = "white";

      let diffColor = "transparent";
      let diffTextColor = "white";


      if (percentOfTeo < 100) {
        ratioColor = getRatioColor(ratio);
        diffColor = streakColor = getStreakColor(diff);
        weightedStreakColor = getStreakColor(weightedStreak);
        cWeightedStreakColor = getStreakColor(cWeightedStreak);
      }

      const ri = entry.rarityIndex.getStats();

      const row = `
      <tr>
        <td style="position: sticky; left: 0; background-color: #1e1e1e; text-align: left; padding: 4px 6px; white-space: nowrap;">
          ${payout.toFixed(2)}x
        </td>
        <td style='color: ${streakTextColor}; background-color: ${streakColor}'><span id="losing-streak-${sanitized}">${streak}</span></td>

           <td style='color: ${diffTextColor}; background-color: ${diffColor}'><span id="losing-streak-${sanitized}-diff">${diff.toFixed(
        2
      )}</span></td>
        <td style='color: white; background-color: ${weightedStreakColor}'><span id="weighted-losing-streak-${sanitized}">${weightedStreak.toFixed(2)}</span></td>
        <td style='color: white; background-color: ${cWeightedStreakColor}'><span id="cweighted-losing-streak-${sanitized}">${cWeightedStreak.toFixed(2)}</span></td>
        <td style='color: ${ratioTextColor};background-color: ${ratioColor}'><span id="losing-streak-${sanitized}-ratio">${ratio.toFixed(
        2
      )}</span></td>

      <td style='color: ${ri.fgColor}; background-color: ${
        ri.bgColor
      }'>${ri.expected.toFixed(3)} | ${ri.observed.toFixed(3)} | ${ri.z.toFixed(
        3
      )} | ${(ri.speed * 100).toFixed(1)}%</td>
      <td>${ri.deviation.toFixed(2)}</td>
      </tr>
    `;
      $tbody.append(row);
    });
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
    $("#sv-stats-panel").draggable({
      containment: "window",
      scroll: false
    });
  }

  function initPrototypes() {
    Array.prototype.last = function () {
      return this[this.length - 1];
    };
    Array.prototype.first = function () {
      return this[0];
    };
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function doInit() {
    observeRollChanges();
    configureMarqueeColorization();
  }

  function generateTargets() {
    class RarityIndex {
      constructor(payout, houseEdge = 0.04) {
        this.payout = payout;
        this.houseEdge = houseEdge;
        this.teo = (1 / payout) * (1 - houseEdge); // true expected outcome
        this.reset();
      }

      reset() {
        this.hits = 0;
        this.trials = 0;
      }

      push(result) {
        // result = true if hit, false otherwise
        this.trials++;
        if (result >= this.payout) this.hits++;
      }

getStats() {
  if (this.trials === 0) return null;

  const expectedHits = this.trials * this.teo;
  const observedHits = this.hits;
  const deviation = observedHits - expectedHits;
  const stdErr = Math.sqrt(expectedHits * (1 - this.teo));
  const speed = expectedHits > 0 ? observedHits / expectedHits : 0;
  const z = stdErr > 0 ? deviation / stdErr : 0;

  const deficit = deviation < 0 ? -deviation : 0;
  const surplus = deviation > 0 ? deviation : 0;

  // intensity scaling: 0 → neutral, 3σ+ → fully saturated
  const ri = Math.abs(z);
  const intensity = Math.min(1, ri / 3); // clamp at 1

  let banding = "neutral";
  const bgColor = this.getColor(z);
  const fgColor = "white"; // stays constant or you can invert for readability

  return {
    payout: this.payout,
    trials: this.trials,
    hits: this.hits,
    expected: expectedHits,
    observed: observedHits,
    deviation,
    deficit,
    surplus,
    speed,
    stdErr,
    z,
    ri,
    intensity,   // 0–1 scale
    banding,
    bgColor,
    fgColor,
  };
}


getColor(z) {
  // Signed z: negative = cold, positive = hot
  const absZ = Math.abs(z);

  // Logistic squash: grows fast near 0, flattens at extremes
  // Maps |z| into [0, 1], with softer shoulders
  const intensity = 1 / (1 + Math.exp(-0.8 * (absZ - 2)));

  // Choose base color based on sign
  let baseColor = z < 0 ? [200, 50, 50] : [50, 100, 220]; 
  // cold = reddish, hot = bluish

  // Convert intensity into rgba alpha scaling
  const alpha = Math.min(1, intensity);

  return `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${alpha})`;
}


getStats2() {
  if (this.trials === 0) return null;

  const observed = this.hits / this.trials;
  const expected = this.teo;
  const speed = observed / expected;
  const stdErr = Math.sqrt((expected * (1 - expected)) / this.trials);

  // Z = signed deviation from expected
  const z = stdErr > 0 ? (observed - expected) / stdErr : 0;
  const ri = Math.abs(z);

  let banding = "neutral";
  let bgColor = "transparent";
  let fgColor = "white";

  if (ri < 2) {
    // within statistical noise
    banding = "neutral";
  } else if (z <= -3) {
    banding = "frozen (≤ -3σ)";
    bgColor = "#1E3A8A"; // deep blue
    fgColor = "white";
  } else if (z <= -2) {
    banding = "cold (≈ -2σ)";
    bgColor = "#3B82F6"; // medium blue
    fgColor = "white";
  } else if (z >= 3) {
    banding = "burn-off (≥ +3σ)";
    bgColor = "#DC2626"; // deep red
    fgColor = "white";
  } else if (z >= 2) {
    banding = "hot (≈ +2σ)";
    bgColor = "#F97316"; // orange
    fgColor = "black";
  }

  return {
    payout: this.payout,
    trials: this.trials,
    hits: this.hits,
    bgColor,
    fgColor,
    banding,
    observed,
    expected,
    stdErr,
    speed,
    z,   // signed deviation
    ri   // magnitude only
  };
}

    }

    // // --- Example usage ---
    // // 10x payout
    // const ri10 = new RarityIndex(10);

    // // Say 200 rolls, 5 hits
    // const result = ri10.evaluate(200, 5);
    // console.log(result);
    /*
{
  payout: 10,
  teo: 0.096,
  rolls: 200,
  hits: 5,
  observed: 0.025,
  z: -3.42,
  ri: 3.42,
  band: "orange",
  suggestion: "size up, tension building"
}
*/

    class Stats {
      constructor(size, payout) {
        this.size = size;
        this.payout = payout;
        this.streak = 0;
        this.pstreak = 0;
        this.ratio = 0;
        this.pratio = 0;
        this.hitCount = 0;
        this.losingStreak = 0;
        this.buffer = new Array(size).fill(null);
        this.index = 0;
        this.count = 0;
        this.sum = 0;
        this.rollCount = 0;
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
        this.pratio = this.ratio;
        this.ratio = this.getStreakDiff() / this.payout;
      };

      getRate = (lookbackM = this.count) => {
        const lastN = Math.ceil(lookbackM * this.payout);
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

      getWinRate = (lookbackM = 50) => this.getRate(lookbackM);

      getWinRatePercentOfTeo() {
        return (this.getFullWinRate() / this.getTeo()) * 100;
      }

      getFullWinRate = () => this.hitCount / this.rollCount;

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
      getPRatio = () => this.pratio;
    }

    class ScalarStats {
      constructor(payout) {
        this.rollCount = 0;
        this.payout = payout;
        this.streak = 0;
        this.pstreak = 0;
        this.hitCount = 0;
        this.losingStreak = 0;
        this.ratio = 0;
        this.pratio = 0;
      }

      push = (result) => {
        this.rollCount++;
        this.updateStreak(result);
      };

      updateStreak = (result) => {
        if (result >= this.payout) {
          this.hitCount++;
          if (this.streak < 0) {
            this.pstreak = this.streak;
          }
          this.streak = Math.max(this.streak + 1, 1);
        } else {
          if (this.streak > 0) {
            this.pstreak = this.streak;
          }
          this.streak = Math.min(this.streak - 1, -1);
        }

        this.losingStreak = this.streak < 0 ? this.streak : 0;
        this.pratio = this.ratio;
        this.ratio = this.getStreakDiff() / this.payout;
      };

      getWinRatePercentOfTeo() {
        return (this.getWinRate() / this.getTeo()) * 100;
      }
      getSum = () => this.hitCount;
      getWinRate = () => this.hitCount / this.rollCount;
      getTeo = () => 1 / (this.getPayout() * 1.04);
      getHitCount = () => this.hitCount;
      getRollCount = () => this.rollCount;
      getStreak = () => this.streak;
      getPreviousStreak = () => this.pstreak;
      getLosingStreak = () => this.losingStreak;
      getPayout = () => this.payout;
      getStreakDiff = () => this.payout - this.streak;
      getRatio = () => this.ratio;
      getPRatio = () => this.pratio;
    }

    class Target {
      constructor(payout) {
        this.payout = payout;
        this.stats =
          this.payout <= 96 ? new Stats(100, payout) : new ScalarStats(payout);
        this.teo = 1 / (this.payout * 1.05); // Adjusted for edge
        this.rarityIndex = new RarityIndex(payout);
        this.streak = 0;
        this.pstreak = 0;
        this.weightedStreak = 0;
        this.cWeightedStreak = 0;
        this.incrementor = this.payout - 1;
        this.decrementor = 1;
        this.hitCount = 0;
        this.rollCount = 0;


        // Snapshot stats
        this.lastSnapshot = null;

        // Snapshot tracking
        this.SNAPSHOT_ROLL_COUNT = 50;
        this.snapshotRollCount = 0;
        this.snapshotHitCount = 0;
      }

      getPayout() {
        return this.payout;
      }

      addResult(result) {
        this.rollCount++;
        this.rarityIndex.push(result);
        this.stats.push(result);
        this.updateStreak(result);

        // Snapshot logic
        const isHit = result >= this.payout;
        this.snapshotRollCount++;
        if (isHit) this.snapshotHitCount++;

        if (this.snapshotRollCount >= this.SNAPSHOT_ROLL_COUNT) {
          this.evaluateSnapshot();
          this.resetSnapshotWindow();
        }
      }

updateStreak(result) {
  if (result >= this.payout) {
    this.hitCount++;
    if (this.streak < 0) this.pstreak = this.streak;
    this.streak = Math.max(this.streak + 1, 1);

    // show how "big" the current streak is
    this.weightedStreak = this.streak * this.incrementor;

    // accumulate as flat units
    this.cWeightedStreak += this.incrementor;
  } else {
    if (this.streak > 0) this.pstreak = this.streak;
    this.streak = Math.min(this.streak - 1, -1);

    this.weightedStreak = this.streak * this.decrementor;
    this.cWeightedStreak -= this.decrementor;
  }
}


      evaluateSnapshot() {
        const n = this.snapshotRollCount;
        const x = this.snapshotHitCount;
        const p = this.teo;

        const expectedHits = n * p;
        const winRate = n > 0 ? x / n : 0;
        const performanceRatio = expectedHits > 0 ? x / expectedHits : 0;
        const percentOfTeo = p > 0 ? winRate / p : 0;
        const zScore =
          n > 0 ? (x - expectedHits) / Math.sqrt(n * p * (1 - p)) : 0;

        this.lastSnapshot = {
          payout: this.payout,
          rollCount: n,
          hitCount: x,
          expectedHits,
          winRate,
          performanceRatio,
          percentOfTeo,
          zScore
        };
      }

      getSpeedStatus() {
        if (!this.lastSnapshot) return null;

        const pr = parseFloat(this.lastSnapshot.performanceRatio);
        const speedLimit = 1.0;
        const margin = 0.1;

        let relativeSpeed;
        if (pr < speedLimit - margin) {
          relativeSpeed = "below";
        } else if (pr > speedLimit + margin) {
          relativeSpeed = "above";
        } else {
          relativeSpeed = "near";
        }

        return {
          ratio: pr,
          speedLimit,
          relativeSpeed
        };
      }

      getRecoveryProjection() {
        const currentRolls = this.snapshotRollCount;
        const currentHits = this.snapshotHitCount;
        const teo = this.teo;

        if (currentRolls === 0) return null;

        const expectedNow = currentRolls * teo;
        const deficit = expectedNow - currentHits;

        // No deficit → nothing to recover
        if (deficit <= 0)
          return {
            currentRolls,
            currentHits,
            deficit: "0.00",
            futureRolls: 0,
            hitsToRecover: "0.00",
            requiredFutureHitRate: "0.000",
            teo: teo.toFixed(3),
            recoveryFeasible: true
          };

        const recoveryRate = teo * 1.5; // assume you'll recover faster than average
        const futureRolls = Math.ceil(deficit / recoveryRate);
        const hitsToRecover = deficit;
        const requiredFutureHitRate = hitsToRecover / futureRolls;

        return {
          currentRolls,
          currentHits,
          deficit: deficit.toFixed(2),
          futureRolls,
          hitsToRecover: hitsToRecover.toFixed(2),
          requiredFutureHitRate: requiredFutureHitRate.toFixed(3),
          teo: teo.toFixed(3),
          recoveryFeasible: requiredFutureHitRate <= teo * 2
        };
      }

      resetSnapshotWindow() {
        this.snapshotRollCount = 0;
        this.snapshotHitCount = 0;
      }

      getRatio = () => this.stats.getRatio();
      getPRatio =() => this.stats.getPRatio();
      getLosingRatio() {
        const ratio = this.getRatio();
        if (ratio >= 0) return 0;
        return Math.abs(ratio);
      }
      getDiff = () => this.stats.streak + this.payout;
      isExtremeCompressed = (threshold = 3) => this.isCompressed(threshold);
      isCompressed = (threshold = 1) =>
        this.getLosingRatio() >= threshold &&
        this.getWinRatePercentOfTeo() < 100;
      getStreak = () => this.streak;
      getWeightedStreak = () => this.weightedStreak;
      getCweightedStreak = () => this.cWeightedStreak;
      getLosingStreak = () => (this.streak < 0 ? this.streak : 0);
      getTeo = () => this.teo;
      getHitCount = () => this.hitCount;
      getRollCount = () => this.rollCount;
      getWinRatePercentOfTeo = (lookbackM = 100) =>
        this.stats.getWinRatePercentOfTeo(lookbackM);
      getHTMLID = () =>
        this.payout
          .toString()
          .replace(/\./g, "_")
          .replace(/[^\w-]/g, "");
    }

    return generatePayouts().map((payout) => new Target(payout));
  }

  function generateCompressionZone() {
    class CompressionZone {
      constructor() {
        this.zones = [];
      }

      getZones() {
        return this.zones;
      }

      getBase() {
        return this.base;
      }

      getLength = () => this.zones.length;

      tryProcessCompression(targets, compressedRatio = 1) {
        this.zones = [];
        let partition = [];

        for (const t of targets) {
          const compressed = t.isCompressed(compressedRatio);
          if (compressed) {
            partition.push({
              payout: t.getPayout(),
              isExtreme: t.isExtremeCompressed()
            });
          } else if (partition.length) {
            this.zones.push(partition);
            partition = [];
          }
        }

        if (partition.length) {
          this.zones.push(partition);
        }
      }

      isReady() {
        return this.zones.some((zone) => zone.some((item) => item.isExtreme));
      }
    }

    return new CompressionZone();
  }
  function generatePayouts() {
    return [
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
      9,
      10,
      15,
      20,
      25,
      30,
      40,
      50,
      60,
      70,
      80,
      90,
      100,
      200,
      300,
      400,
      500,
      1000,
      2000,
      3000,
      4000,
      5000,
      10000,
      25000,
      50000,
      100000,
      500000,
      1000000
    ];
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

  function configureMarqueeColorization() {
    // ------- CONFIG -------
    const H_THRESHOLD = 1.92;
    const V_THRESH = 10;
    const V_PAYOUTS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

    // ------- STYLE (beat Tailwind + nested elements) -------
    (function injectStyle() {
      if (document.getElementById("bcg-low-style")) return;
      const el = document.createElement("style");
      el.id = "bcg-low-style";
      el.textContent = `
      .grid.grid-auto-flow-column .btn-like.bcg-low,
      .grid.grid-auto-flow-column .btn-like.bcg-lower,
      .grid.grid-auto-flow-column .btn-like.bcg-both { background-color:#b3261e !important; color:#fff !important; }
      .grid.grid-auto-flow-column .btn-like.bcg-lower { background-color:#d02a20 !important; }
      .grid.grid-auto-flow-column .btn-like.bcg-both  { background-color:#ff3b30 !important;
        box-shadow:0 0 .5rem rgba(255,59,48,.7),0 0 1.25rem rgba(255,59,48,.35) !important;
        transform:translateZ(0); animation:bcg-pulse 1.2s ease-in-out infinite;
      }
      /* Force inner spans/icons, regardless of !text-[#B3BEC1] */
      .grid.grid-auto-flow-column .btn-like.bcg-low *,
      .grid.grid-auto-flow-column .btn-like.bcg-lower *,
      .grid.grid-auto-flow-column .btn-like.bcg-both * { color:#fff !important; fill:#fff !important; stroke:#fff !important; }
      @keyframes bcg-pulse {
        0%{box-shadow:0 0 .35rem rgba(255,59,48,.6),0 0 1rem rgba(255,59,48,.25)}
        50%{box-shadow:0 0 .9rem rgba(255,59,48,.9),0 0 1.6rem rgba(255,59,48,.45)}
        100%{box-shadow:0 0 .35rem rgba(255,59,48,.6),0 0 1rem rgba(255,59,48,.25)}
      }
    `;
      document.head.appendChild(el);
    })();

    // ------- UTILS -------
    const parseNum = (t) => {
      const n = parseFloat(String(t || "").replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : null;
    };

    // Snapshot hot payouts from your table (used ONLY for future tiles)
    let HOT_SET = [];
    function snapshotHotPayouts() {
      const tbody = document.querySelector("#output-table tbody");
      if (!tbody) return;
      const hot = [];
      tbody.querySelectorAll("tr").forEach((row) => {
        const tds = row.querySelectorAll("td");
        if (tds.length < 2) return;
        const payout = parseNum((tds[0].textContent || "").trim());
        const streak = parseNum(tds[1]?.querySelector("span")?.textContent);
        if (
          payout != null &&
          streak != null &&
          V_PAYOUTS.includes(payout) &&
          Math.abs(streak) >= V_THRESH
        ) {
          hot.push(payout);
        }
      });
      hot.sort((a, b) => a - b);
      HOT_SET = hot;
    }

    // ------- STATE & ENGINE -------
    const lastText = new WeakMap(); // tile -> last seen text
    const gridRun = new WeakMap(); // grid -> { lastLow }

    function classify(grid, tile, value) {
      // Clear classes from the PREVIOUS value (we only do this when text changed)
      tile.classList.remove("bcg-low", "bcg-lower", "bcg-both");

      const run = gridRun.get(grid) ?? { lastLow: null };
      if (value < H_THRESHOLD) {
        const converges = HOT_SET.length && HOT_SET.some((P) => value < P);
        if (converges) {
          tile.classList.add("bcg-both");
        } else {
          if (run.lastLow !== null && value < run.lastLow) {
            tile.classList.add("bcg-lower");
          } else {
            tile.classList.add("bcg-low");
          }
          run.lastLow = value;
        }
      } else {
        // break in the <1.92 run
        run.lastLow = null;
      }
      gridRun.set(grid, run);
    }

    function maybeUpdate(grid, tile) {
      // Use innerText to be resilient to span splits
      const nowTxt = (tile.innerText || tile.textContent || "").trim();
      if (!nowTxt) return;

      // Only react when the TEXT changed (prevents retro flips)
      if (lastText.get(tile) === nowTxt) return;
      lastText.set(tile, nowTxt);

      const v = parseNum(nowTxt);
      if (v == null) return;
      classify(grid, tile, v);
    }

    function scanGrid(grid) {
      grid
        .querySelectorAll(".btn-like")
        .forEach((tile) => maybeUpdate(grid, tile));
    }

    // ------- WIRING -------
    // 1) Initial snapshot + quick first paint
    snapshotHotPayouts();
    document.querySelectorAll(".grid.grid-auto-flow-column").forEach(scanGrid);

    // 2) Robust “tick” that catches silent updates (some frameworks dodge MOs)
    let tickTimer = 0;
    (function tick() {
      // Query grids fresh each tick (grids can mount later)
      const grids = document.querySelectorAll(".grid.grid-auto-flow-column");
      grids.forEach(scanGrid);
      tickTimer = window.setTimeout(() => requestAnimationFrame(tick), 120); // ~8 fps
    })();

    // 3) MutationObserver (still helps when available)
    const docObs = new MutationObserver((muts) => {
      let needRescan = false;
      for (const m of muts) {
        if (m.type === "childList") needRescan = true;
        if (m.type === "characterData") {
          const tile = m.target?.parentElement?.closest?.(".btn-like");
          const grid = tile?.closest?.(".grid.grid-auto-flow-column");
          if (tile && grid) maybeUpdate(grid, tile);
        }
      }
      if (needRescan) {
        document
          .querySelectorAll(".grid.grid-auto-flow-column")
          .forEach(scanGrid);
      }
    });
    docObs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });

    // 4) Watch your table to refresh HOT_SET (future tiles only)
    const tbody = document.querySelector("#output-table tbody");
    if (tbody) {
      const tableObs = new MutationObserver(() => {
        if (tableObs._t) cancelAnimationFrame(tableObs._t);
        tableObs._t = requestAnimationFrame(snapshotHotPayouts);
      });
      tableObs.observe(tbody, {
        childList: true,
        subtree: true,
        characterData: true
      });
      setInterval(snapshotHotPayouts, 1500); // safety: some tables render off-DOM then swap
    }

    // Debug helpers
    window.__bcg = {
      hot: () => HOT_SET.slice(),
      grids: () =>
        [...document.querySelectorAll(".grid.grid-auto-flow-column")].length,
      sample: () =>
        [...document.querySelectorAll(".grid.grid-auto-flow-column .btn-like")]
          .slice(-6)
          .map((t) => t.innerText.trim()),
      lastText,
      gridRun
    };
  }

  doInit();
  // Initialize MutationObserver
})();

