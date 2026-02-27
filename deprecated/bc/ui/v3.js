/* Start Script */
// ==UserScript==
// @name         bc.game ui v3
// @namespace    http://tampermonkey.net/
// @version      2
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

  let lastRollSet = [];
  let currentRollSet = [];
  let rollCount = 0;

  injectUI();
  initWindowEvents();

  function evalResult(result) {
    rollCount++;

    if (rollCount % 100 === 0) {
      console.log(result);
    }

    TARGET_MANAGER.addResult(result);
    updateUI(result);
  }

  function updateUI(result) {
    renderTable();
  }

  function renderTable() {
    const $tbody = $("#output-table tbody");
    $tbody.empty();

    const targets = TARGET_MANAGER.getTargets();

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
      let weightedStreakColor = "transparent";
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



      const teo = entry.getTeo() * 100;
      const ri = entry.rarityIndex.getStats();
      const strengthUIData = entry.getStrengthUIData();

      const row = `
      <tr>
        <td style="position: sticky; left: 0; background-color: #1e1e1e; text-align: left; padding: 4px 6px; white-space: nowrap;">
          ${payout.toFixed(2)}x
        </td>
        <td style='color: ${streakTextColor}; background-color: ${streakColor}'><span id="losing-streak-${sanitized}">${streak}</span></td>

           <td style='color: ${diffTextColor}; background-color: ${diffColor}'><span id="losing-streak-${sanitized}-diff">${diff.toFixed(
        2
      )}</span></td>
        <td style='color: ${ratioTextColor};background-color: ${ratioColor}'><span id="losing-streak-${sanitized}-ratio">${ratio.toFixed(
        2
      )}</span></td>
        <td style='color: white; background-color: ${strengthUIData.bgColor}'><span id="strength-${sanitized}">${strengthUIData.value.toFixed(
        2
      )}</span></td>
        <td style='color: white; background-color: ${weightedStreakColor}'><span id="weighted-losing-streak-${sanitized}">${weightedStreak.toFixed(
        2
      )}</span></td>
        <td style='color: white; background-color: ${cWeightedStreakColor}'><span id="cweighted-losing-streak-${sanitized}">${cWeightedStreak.toFixed(
        2
      )}</span></td>

      <td><span>${createWinRateCells(entry)}</td>
      </tr>
    `;
      $tbody.append(row);
    });
  }

  function createWinRateCells(entry) {

      const teo = (entry.getTeo() * 100).toFixed(2)
      const uiData = entry.getWindowWinRatesUIData();
    const rowData = uiData.map((data) => {
      return `<span style="background-color: ${data.bgColor}">${data.winRate}</span>`;      
    }).join(" | ")

    return `${teo} | ${rowData}`

  }
  function getRatioColor(ratio) {
    // Logistic squash for smooth scaling
    const absRatio = Math.abs(ratio);
    const intensity = 1 / (1 + Math.exp(-8 * (absRatio - 0.2)));

    // Cold (negative ratio) = red, Hot (positive ratio) = blue
    const baseColor = ratio < 0 ? [200, 50, 50] : [50, 100, 220];

    return `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${Math.min(
      1,
      intensity
    )})`;
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


    function getWinRateColor(rateDiff) {
    const absRateDiff = Math.abs(rateDiff);

    const intensity = 1 / (1 + Math.exp(-0.6 * (absRateDiff - 3)));

    // Choose base color (red = losing, blue = winning)
    const baseColor = rateDiff < 0 ? [200, 50, 50] : [50, 100, 220];

    // Map intensity into RGBA alpha
    const alpha = Math.min(1, intensity);

    return `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${alpha})`;
  }

  function generateTargetManager() {
    class Stats {
      constructor(payout, lookbacks = [100,200, 300,400,500,600,700, 800, 900, 1000], lookbacksLows = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]) {
        this.lookbacks = payout <= 2 ? lookbacksLows : lookbacks;
        this.payout = payout;
        this.teo = 1 / (this.getPayout() * 1.04);
        this.streak = 0;
        this.pstreak = 0;
        this.globalRolls = 0;
        this.globalHits = 0;
        this.losingStreak = 0;

        // Init EMA trackers per lookback
        this.emaTrackers = {};
        for (const lb of this.lookbacks) {
          this.emaTrackers[lb] = { value: 0, alpha: 2 / (lb + 1) };
        }
      }

      push(result) {
        this.updateStats(result);
      }

      updateStats = (result) => {
        const hit = result >= this.payout;
        this.globalRolls++;

        // Always update EMA with alpha=1 (just raw value, we'll smooth later)
        this.ema = hit ? 1 : 0;

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

        for (const lb in this.emaTrackers) {
          const tracker = this.emaTrackers[lb];
          tracker.value = tracker.alpha * (hit ? 1 : 0) + (1 - tracker.alpha) * tracker.value;
        }
      };


      // Pass a lookback length and compute an EMA on the fly
      getWindowWinRate(lookback) {
        return this.emaTrackers[lookback]
          ? this.emaTrackers[lookback].value
          : null;
      }

      getWindowWinRates() {
        return this.lookbacks.map((lookback) => this.getWindowWinRate(lookback));
      }

      getWindowWinRatePercentsOfTeo() {
        return this.lookbacks.map((lookback) => (this.calculateWinRatePercentOfTeo(this.getWindowWinRate(lookback))));
      }
      
      calculateWinRatePercentOfTeo(winRate) {
        return ((winRate / 100) / this.getTeo() * 100);
      }


      getTotalWinRate() {
        return (this.globalHits / this.globalRolls) * 100;
      }
      getStreakDiff = () => this.streak + this.payout;
      getRatio = () => this.getStreakDiff() / this.payout;
      getWinRatePercentOfTeo() {
        return (this.getTotalWinRate() / this.getTeo()) * 100;
      }
      getPayout = () => this.payout;
      getTeo = () => this.teo;
    }

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
          intensity, // 0–1 scale
          banding,
          bgColor,
          fgColor
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
    }
    class Target {
      constructor(payout, decay = 0.95) {
        this.payout = payout;
        this.stats = new Stats(payout);
        this.teo = 1 / (this.payout * 1.04); // Adjusted for edge
        this.rarityIndex = new RarityIndex(payout);

        // Streak tracking
        this.streak = 0;
        this.pstreak = 0;
        this.weightedStreak = 0;
        this.cWeightedStreak = 0;
        this.incrementor = this.payout - 1;
        this.decrementor = 1;

        // Hit counters
        this.hitCount = 0;
        this.rollCount = 0;
        this.globalHits = 0;
        this.globalRolls = 0;

        // Compression flags
        this.isCompressed = false;
        this.isHeavyCompressed = false;
        this.compressionZone = null;
        this.prev = null;
        this.next = null;

        // 🔹 Pressure tracking
        this.decay = decay;
        this.pressure = 0; // decayed imbalance
      }

      getPayout() {
        return this.payout;
      }

      setPrev(target) {
        this.prev = target;
      }
      setNext(target) {
        this.next = target;
      }

      addResult(result) {
        this.rollCount++;
        this.globalRolls++;

        this.stats.push(result);
        this.rarityIndex.push(result);
        this.setCompressionLevels();
        this.updatePressure(result);
        this.updateStreak(result);
      }

      updateStreak(result) {
        if (result >= this.payout) {
          this.hitCount++;
          this.globalHits++;
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

      // 🔹 Pressure logic
      updatePressure(result) {
        // decay old pressure
        this.pressure *= this.decay;

        const prob = 1 / this.payout; // theoretical prob
        const hit = result >= this.payout ? 1 : 0;
        const imbalance = hit - prob;

        this.pressure += imbalance;
      }

      getNormalizedPressure() {
        const prob = 1 / this.payout;
        const variance = prob * (1 - prob) * this.globalRolls;
        if (variance === 0) return 0;
        return this.pressure / Math.sqrt(variance);
      }

      // Compression
      setCompressionLevels(normalCompression = 3, heavyCompression = 5) {
        this.isCompressed =
          this.getLosingRatio() >= normalCompression &&
          this.getWinRatePercentOfTeo() < 100;

        this.isHeavyCompressed =
          this.isCompressed && this.getLosingRatio() >= heavyCompression;
      }

      // Accessors
      getRatio = () => this.stats.getRatio();
      getLosingRatio() {
        const ratio = this.getRatio();
        if (ratio >= 0) return 0;
        return Math.abs(ratio);
      }
      getDiff = () => this.stats.streak + this.payout;
      setCompressionZone(zone) {
        this.compressionZone = zone;
      }
      getWeightedStreak = () => this.weightedStreak;
      getCweightedStreak = () => this.cWeightedStreak;
      getIsExtremeCompressed = () => this.isHeavyCompressed;
      getIsCompressed = () => this.isCompressed;
      getStrength = () => this.getTeo() * this.getStreak();
      getStreak = () => this.streak;
      getLosingStreak = () => (this.streak < 0 ? this.streak : 0);
      getTeo = () => this.teo;
      getHitCount = () => this.hitCount;
      getRollCount = () => this.rollCount;
      getWinRatePercentOfTeo = () => this.stats.getWinRatePercentOfTeo();
      getWinRate = () => this.stats.getWinRate();
      getWindowWinRates = () => this.stats.getWindowWinRates();
      getWindowWinRatePercentsOfTeo = () => this.stats.getWindowWinRatePercentsOfTeo();
      getWindowWinRatesUIData() {
        const rates = this.getWindowWinRates();
        const uiData = [];
        for (let i = 0; i < rates.length; i++) {
          const data = {};
          data.winRate = (rates[i] * 100).toFixed(2);
          data.pot = this.calculateWinRatePercentOfTeo(rates[i])
          data.bgColor = this.getWinRateColor(data.pot);
          uiData.push(data);
        }
        return uiData;
      }

        getStrengthUIData() {
          const strength = this.getStrengthScaled();

          let fgColor = "transparent";
          let bgColor = this.getStrengthColor(strength)
          return {
            value: strength,
            fgColor: fgColor,
            bgColor: bgColor
          };
        }

          getStrengthScaled = () =>
          this.applyPercentChange(
            this.getStrength(),
            this.averageWinRatePercentOfTeo()
          );


        applyPercentChange(value, percent) {
          return value * (1 + (100 - percent) / 100);
        }

        averageWinRatePercentOfTeo() {
          const data = this.getWindowWinRatePercentsOfTeo();
          const len = data.length;

          return data.reduce((a, b) => a + b, 0) / len;
        }


   getStrengthColor(strength) {
    const absStrength = Math.abs(strength);

    // Logistic squash: tames big streaks, emphasizes near-threshold
    const intensity = 1 / (1 + Math.exp(-0.6 * (absStrength - 3)));

    // Choose base color (red = losing, blue = winning)
    const baseColor = strength < 0 ? [200, 50, 50] : [50, 100, 220];

    // Map intensity into RGBA alpha
    const alpha = Math.min(1, intensity);

    return `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${alpha})`;
  }
      getWinRateColor(pot) {
        const rateDiff = pot - 1;
        const absRateDiff = Math.abs(rateDiff);

        const intensity = 1 / (1 + Math.exp(-0.6 * (absRateDiff - 1)));

        // Choose base color (red = losing, blue = winning)
        const baseColor = rateDiff < 0 ? [200, 50, 50] : [50, 100, 220];

        // Map intensity into RGBA alpha
        const alpha = Math.min(1, intensity);

        return `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${alpha})`;
      }

      calculateWinRatePercentOfTeo(winRate) {
        return ((winRate / 100) / this.getTeo() * 100);
      }
      getHTMLID = () =>
        this.payout
          .toString()
          .replace(/\./g, "_")
          .replace(/[^\w-]/g, "");
    }

    class TargetManager {
      constructor(payouts, decay = 0.95) {
        this.targets = payouts.map((p) => new Target(p, decay));

        // link them in a chain
        for (let i = 0; i < this.targets.length; i++) {
          if (i > 0) this.targets[i].setPrev(this.targets[i - 1]);
          if (i < this.targets.length - 1)
            this.targets[i].setNext(this.targets[i + 1]);
        }

        this.lowTargets = this.targets.filter((t) => t.getPayout() <= 2);
        this.ratios = [];
        this.totalRatio = 0;
        this.ratioSlope = 0;
      }

      getCompressionZone = () => this.compressionZone;
      getTotalRatio = () => this.totalRatio;
      getRatioSlope = () => this.ratioSlope;
      getLowTargets = () => this.lowTargets;
      getTargets = () => this.targets;
      getZones = () => this.zones;

      addResult(result) {
        this.totalRatio = 0;
        let zoneNumber = 0;
        let incrementZone = true;

        this.targets.forEach((target) => {
          target.addResult(result);

          if (target.getIsCompressed()) {
            target.setCompressionZone(zoneNumber);
            incrementZone = true;
          } else if (incrementZone) {
            zoneNumber++;
            incrementZone = false;
          }

          this.totalRatio += target.getRatio();
        });

        if (this.ratios.length === 50) this.ratios.shift();
        this.ratios.push(this.totalRatio);
        this.ratioSlope = this.calculateRatioSlope();

        this.buildZones();
      }
      snapshot() {
        return this.targets
          .filter((t) => t.getIsCompressed())
          .reduce((acc, t) => {
            acc[t.payout] = {
              streak: t.getStreak(),
              ratio: t.getRatio().toFixed(3),
              pressure: t.pressure.toFixed(3),
              normalized: t.getNormalizedPressure().toFixed(3),
              compressed: t.getIsCompressed(),
              extreme: t.getIsExtremeCompressed()
            };
            return acc;
          }, {});
      }

      buildZones() {
        const zones = [];
        const visited = new Set();
        let breakAlerts = [];

        const expand = (target, zone) => {
          if (!target || visited.has(target)) return;

          visited.add(target);

          if (target.getIsCompressed()) {
            zone.nodes.push(target);
            target.setCompressionZone(zone);

            expand(target.prev, zone);
            expand(target.next, zone);
          } else {
            // If we hit a break while building, mark alert + split
            if (zone.nodes.length > 0) {
              zone.breakOccurred = true;
              zones.push(zone);

              breakAlerts.push({
                at: target.payout,
                leftZone: zone.nodes.map((n) => n.payout)
              });

              // start a fresh zone after the break
              if (target.next && target.next.getIsCompressed()) {
                const newZone = { nodes: [], breakOccurred: false };
                expand(target.next, newZone);
                if (newZone.nodes.length > 0) zones.push(newZone);
              }
            }
          }
        };

        for (const t of this.targets) {
          if (!visited.has(t) && t.getIsCompressed()) {
            const zone = { nodes: [], breakOccurred: false };
            expand(t, zone);
            if (zone.nodes.length > 0) zones.push(zone);
          }
        }

        this.zones = { zones, breakAlerts };
      }

      calculateRatioSlope(windowSize = 5) {
        const recent = this.ratios.slice(-windowSize);
        if (recent.length < 2) return 0;

        // Compute slope via least squares
        const n = recent.length;
        const sumX = (n * (n - 1)) / 2;
        const sumX2 = ((n - 1) * n * (2 * n - 1)) / 6;
        let sumY = 0;
        let sumXY = 0;

        for (let i = 0; i < n; i++) {
          const x = i;
          const y = recent[i];
          sumY += y;
          sumXY += x * y;
        }

        const numerator = n * sumXY - sumX * sumY;
        const denominator = n * sumX2 - sumX * sumX;
        return denominator === 0 ? 0 : numerator / denominator;
      }
    }

    return new TargetManager(generateWatchPayouts());
  }

  function generateWatchPayouts() {
    const a1 = [1.1, 1.2, 1.3, 1.5, 1.5, 1.6, 1.7, 1.8, 1.9];

    const a2 = Array.from(
      {
        length: 50
      },
      (v, k) => 2 + k * 2
    );

    return [...a1, ...a2];
  }


  function initWindowEvents() {
    $("#ui-v2-stats-panel").draggable({
      scroll: false
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

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function doInit() {
    observeRollChanges();
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

  function injectUI() {
    // if (getIsTestMode()) return;
    $("<style>")
      .prop("type", "text/css")
      .html(
        `
             #ui-v2-stats-panel-header {
                background: #333;
                padding: 12px;
                font-weight: bold;
                text-align: center;
                border-radius: 8px 8px 0 0;
                font-size: 16px;
                cursor: grab;
            }

            #ui-v2-stats-panel {
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
                height: 1500px;
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

    const uiHTML = `<div id="ui-v2-stats-panel" style="
   position: fixed;
   top: 300px;
   left: 500px;
   z-index: 9999;
   background: #1e1e1e;
   color: #fff;
   padding: 16px;
   width: 1500px;
   border-radius: 10px;
   box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
   font-family: Arial, sans-serif;
   font-size: 14px;
   line-height: 1.6;
   cursor: grab;
   ">
   <div id="ui-v2-stats-panel-header" style="
      background: #333;
      padding: 10px;
      font-weight: bold;
      text-align: center;
      border-radius: 8px 8px 0 0;
      cursor: grab;
      ">⚙️ BC Analytics</div>
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
                     Ratio
                  </th>
                  <th style="position: sticky; left: 0; background-color: #1e1e1e; z-index: 1; text-align: left; padding: 6px; white-space: nowrap;">
                     Strength
                  </th>
                  <th style="position: sticky; left: 0; background-color: #1e1e1e; z-index: 1; text-align: left; padding: 6px; white-space: nowrap;">
                     Weighted Streak
                  </th>
                  <th style="position: sticky; left: 0; background-color: #1e1e1e; z-index: 1; text-align: left; padding: 6px; white-space: nowrap;">
                     Cumulative Weighted Streak
                  </th>

                  <th style="position: sticky; left: 0; background-color: #1e1e1e; z-index: 1; text-align: left; padding: 6px; white-space: nowrap;">
                     Historical Win Rates
                  </th>
               </tr>
            </thead>
            <tbody></tbody>
         </table>
      </div>
   </div>
</div>`;

    $("body").prepend(uiHTML);
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
  configureMarqueeColorization();


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
