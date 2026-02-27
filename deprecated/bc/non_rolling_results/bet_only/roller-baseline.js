/* Start Script */
// ==UserScript==
// @name         bc.game roller baseline
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

  let lastRollSet = [];
  let currentRollSet = [];
  let rollCount = 0;

  injectUI();

  function evalResult(result) {
    rollCount++;

    if (rollCount % 100 === 0) {
        console.log(result);
    }
    
    TARGET_MANAGER.addResult(result);
    updateUI(result);
  }

  function updateUI(result) {

  }

  function generateTargetManager() {
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

      getWinRate = () => this.getFullWinRate();
      getWinRatePercentOfTeo() {
        return (this.getFullWinRate() / this.getTeo()) * 100;
      }
      getFullWinRate = () => this.hitCount / this.rollCount;
      getTeo = () => 1 / (this.getPayout() * 1.04);

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
      getRatio = () => this.getStreakDiff() / this.payout;
    }

    class Target {
      constructor(payout, decay = 0.95) {
        this.payout = payout;
        this.stats = new Stats(100, payout);
        this.teo = 1 / (this.payout * 1.04); // Adjusted for edge

        // Streak tracking
        this.streak = 0;
        this.pstreak = 0;

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

        // Update streaks + hits
        if (result >= this.payout) {
          this.hitCount++;
          this.globalHits++;
          if (this.streak < 0) this.pstreak = this.streak;
          this.streak = Math.max(this.streak + 1, 1);
        } else {
          if (this.streak > 0) this.pstreak = this.streak;
          this.streak = Math.min(this.streak - 1, -1);
        }

        this.setCompressionLevels();
        this.updatePressure(result);
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
      getIsExtremeCompressed = () => this.isHeavyCompressed;
      getIsCompressed = () => this.isCompressed;
      getStreak = () => this.streak;
      getLosingStreak = () => (this.streak < 0 ? this.streak : 0);
      getTeo = () => this.teo;
      getHitCount = () => this.hitCount;
      getRollCount = () => this.rollCount;
      getWinRatePercentOfTeo = () => this.stats.getWinRatePercentOfTeo();
      getWinRate = () => this.stats.getWinRate();
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
                  leftZone: zone.nodes.map(n => n.payout),
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

          this.zones =  { zones, breakAlerts };
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
        length: 99
      },
      (v, k) => 2 + k * 1
    );

    return [...a1, ...a2];
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

  doInit();

  function injectUI() {
    if (getIsTestMode()) return;
    $("<style>")
      .prop("type", "text/css")
      .html(
        `#${SCRIPT_NAME}-container {
            text-align: left;
        }`
      )
      .appendTo("head");
    
    let controlPanel = `<div id="${SCRIPT_NAME}-container">INSERT_CONTENT</div>`;

    $("body").prepend(controlPanel);
  }
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
