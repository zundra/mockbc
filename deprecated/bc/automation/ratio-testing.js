(function () {
  "use strict";

  const WINDOW_SIZE = 1000;
  let lastRollSet = [];
  let currentRollSet = [];
  const PULLBACK_THRESHOLD = -200; // Mark-1 when ratio <= this
  const POP_UP_THRESHOLD = 50; // Mark-2 when ratio >= this

  let rollCount = 0;
  let riskOnRollCount = 0;
  let lastRatio = 0;
  let profit = 0;
  const dataAggregator = initDataAggregator();
  let riskOnPayout = null;

  function evalResult(result) {
    rollCount++;

    dataAggregator.push(result);
    const payout = getPayout();
    const wager = getWager();
    const ratioData = dataAggregator.getRatioData();
    const ratioVal = ratioData.ratio;
    const minRatioPayout = ratioData.minRatioPayout;

    if (result >= payout) {
      profit += payout * wager - wager;
    } else {
      profit -= wager;
    }

    if (!riskOnPayout) {
      if (ratioVal <= PULLBACK_THRESHOLD && lastRatio > PULLBACK_THRESHOLD) {
        riskOnPayout = ratioData.minRatioPayout;
        riskOnRollCount = 0;
        setPayout(riskOnPayout);
        setWager(0.01);
      }
    } else {
      riskOnRollCount++;



      if (
        result >= riskOnPayout// || (ratioVal >= POP_UP_THRESHOLD && lastRatio < POP_UP_THRESHOLD)
      ) {
        setWager(0);
        riskOnPayout = null;
      } else {
                if (riskOnRollCount >= riskOnPayout) {
           riskOnPayout = minRatioPayout + riskOnRollCount;
        }

        setPayout(riskOnPayout);
      }
    }

  

    lastRatio = ratioVal;

    updateUI();
  }

  function updateUI() {
    $("#roll-count").text(rollCount);
    $("#risk-on-roll-count").text(riskOnRollCount);
    $("#profit-loss")
      .html(profit.toFixed(4))
      .css({
        backgroundColor: `${
          profit > 0 ? "green" : profit < 0 ? "red" : "transparent"
        }`
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

  function initDataAggregator() {
    class DataAggregator {
      constructor() {
        this.ratio = 0;
        this.lastAvg = 0;
        this.targets = this.generateTargets();
        this.rollingStats = this.generateRollingStats();
        this.minRatioTarget = null;
      }
      getAvgDelta = () => this.lastAvg;
      getRatio = () => this.ratio;
      getRatioData() {
        const t = this.minRatioTarget;
        if (!t) return {ratio: 0, minRatioPayout: 0}

        return {
          ratio: this.ratio,
          minRatioPayout: t.getPayout()
        };
      }

      minRatioPayout = () => this.minRatioPayout;

      getLowestRatioTarget() {
        if (!this.targets || this.targets.length === 0) return null;

        return this.targets.reduce((lowest, current) =>
          current.getRatio() < lowest.getRatio() ? current : lowest
        );
      }
      push(result) {
        this.rollingStats.push(result);
        let sum = 0,
          count = 0;
        this.ratio = 0;

        for (let i = 0; i < this.targets.length; i++) {
          const target = this.targets[i];
          target.push(result);
          const d = target.deltaPercentOfTEO();
          if (d !== null) {
            sum += d;
            count++;
          }
          this.ratio += target.getRatio();
          if (this.ratio > -POP_UP_THRESHOLD) {
            this.minRatioTarget = null;
          }
        }

        this.setMinRatioTarget();

        this.lastAvg = count > 0 ? sum / count : 0;
      }
      setMinRatioTarget() {
        const target = this.getLowestRatioTarget();

        if (
          this.minRatioTarget &&
          this.minRatioTarget.getPayout() < target.getPayout()
        )
          return;

        this.minRatioTarget = this.getLowestRatioTarget();
      }
      generateTargets = () => {
        class Target {
          constructor(payout) {
            this.streak = 0;
            this.payout = payout;
            this.results = [];
            this.window = WINDOW_SIZE;
            this.wins = 0;
          }
          push = (result) => {
            this.results.push(result);
            if (result >= this.payout) this.wins++;
            if (this.results.length > this.window) {
              const removed = this.results.shift();
              if (removed >= this.payout) this.wins--;
            }

            if (result >= this.payout) {
              this.streak = Math.max(this.streak + 1, 1);
            } else {
              this.streak = Math.min(this.streak - 1, -1);
            }

            this.losingStreak = this.streak < 0 ? Math.abs(this.streak) : 0;
          };

          getStreakDelta = () => this.streak + this.payout;
          getRatio = () => this.getStreakDelta() / this.payout;
          getWinRatePercent() {
            if (this.results.length === 0) return null;
            return (this.wins / this.results.length) * 100;
          }
          getPayout = () => this.payout;
          getTEO() {
            return (1 / this.payout) * 100;
          }
          deltaPercentOfTEO() {
            const wr = this.getWinRatePercent();
            if (wr === null) return null;
            return wr - this.getTEO();
          }
        }
        return this.generatePayouts().map((payout) => new Target(payout));
      };

      generatePayouts() {
        return Array.from(
          {
            length: 300
          },
          (v, k) => 2 + k * 0.5
        );
      }

      generateRollingStats() {
        class RollingStats {
          constructor(size) {
            this.size = size;
            this.buffer = new Array(size).fill(null);
            this.index = 0;
            this.count = 0;
          }

          push = (value) => {
            if (this.count >= this.size) {
              // Overwrite old value
              this.buffer[this.index] = value;
            } else {
              this.buffer[this.index] = value;
              this.count++;
            }

            this.index = (this.index + 1) % this.size;
          };

          getValues = (lookback = this.count) => {
            const count = Math.min(lookback, this.count);
            const values = [];
            const start = (this.index - count + this.size) % this.size;
            for (let i = 0; i < count; i++) {
              const idx = (start + i + this.size) % this.size;
              values.push(this.buffer[idx]);
            }
            return values;
          };

          getMean = (lookback = this.count) => {
            const vals = this.getValues(lookback);
            if (vals.length === 0) return 0;
            const sum = vals.reduce((a, b) => a + b, 0);
            return sum / vals.length;
          };

          getVariance = (lookback = this.count) => {
            const vals = this.getValues(lookback);
            if (vals.length <= 1) return 0;
            const mean = this.getMean(lookback);
            const sumOfSquares = vals.reduce(
              (sum, v) => sum + (v - mean) ** 2,
              0
            );
            return sumOfSquares / (vals.length - 1);
          };

          getStandardDeviation = (lookback = this.count) => {
            return Math.sqrt(this.getVariance(lookback));
          };

          getMedian = (lookback = this.count) => {
            const vals = this.getValues(lookback);
            if (vals.length === 0) return null;
            const sorted = [...vals].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 === 0
              ? (sorted[mid - 1] + sorted[mid]) / 2
              : sorted[mid];
          };
        }
        return new RollingStats(1000);
      }
    }
    return new DataAggregator();
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
  function doInit() {
    observeRollChanges();
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
