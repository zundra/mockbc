var mbc = new MockBC(
  0,
  "Y83TpC2hj2SnjiNEDJwN",
  "9b98254e8986dd95349fc754b4b087b5d0ddf9771026d68fe4ed661c869420b4"
);

(function () {
  "use strict";

  const dataAggregator = initDataAggregator();
  let lastRollSet = [];
  let currentRollSet = [];
  let rollNum = 0;
  let lastRatio = 0;
  let mark1 = null;
  let currentIteration = 1;

  let popEvents = [];
  const allIterations = [];

  const PULLBACK_THRESHOLD = -200;
  const POP_UP_THRESHOLD = 50;

  let pendingPop = null;

  function evalResult(result) {
    if (result === -1) return;
    rollNum++;
    dataAggregator.push(result);

    const ratioVal = dataAggregator.getRatio();
    const nextRoll = rollNum + 1;

    updatePopEvents(result, ratioVal, nextRoll);

    $("#roll-count").html(rollNum);

    if (rollNum === parseInt($("#max-rolls").val())) {
      console.log(`Max rolls hit: ${rollNum}`);
      console.table(popEvents);
      mbc.stop();
      reset();
      if (currentIteration !== parseInt($("#iterations").val())) {
        currentIteration++;
        mbc.start();
      } else {
        currentIteration = 1;
        exportCSV();
      }
    } else if (rollNum % 1000 === 0) {
      console.log(
        `[Progress Checkpoint] Iteration: ${currentIteration}, Roll Count: ${rollNum}, Events Detected: ${popEvents.length}`
      );
    }
  }

  function reset() {
    allIterations.push(popEvents);
    popEvents = [];
    mark1 = null;
    lastRatio = 0;
    rollNum = 0;
    mbc = new MockBC(0, uuidv4(), uuidv4());
  }
  function updatePopEvents(result, ratioVal, currentRoll) {
    if (!pendingPop) {
      if (ratioVal <= PULLBACK_THRESHOLD && lastRatio > PULLBACK_THRESHOLD) {
        pendingPop = { m1Roll: currentRoll, m1Ratio: ratioVal };
      }
    } else {
      if (ratioVal >= POP_UP_THRESHOLD && lastRatio < POP_UP_THRESHOLD) {
        const event = {
          roll: currentRoll,
          payout: result,
          m1Roll: pendingPop.m1Roll,
          m1Ratio: pendingPop.m1Ratio,
          m2Ratio: ratioVal,
          deltaRolls: Math.max(0, currentRoll - pendingPop.m1Roll)
        };

        popEvents.unshift(event);
        pendingPop = null;
      }
    }

    lastRatio = ratioVal;
  }

  function initDataAggregator() {
    class DataAggregator {
      constructor() {
        this.ratio = 0;
        this.targets = this.generateTargets();
      }
      getRatio = () => this.ratio;
      push(result) {
        this.ratio = 0;
        for (let i = 0; i < this.targets.length; i++) {
          const target = this.targets[i];
          target.push(result);
          this.ratio += target.getRatio();
        }
      }
      generateTargets = () => {
        class Target {
          constructor(payout) {
            this.streak = 0;
            this.payout = payout;
          }
          push = (result) => {
            if (result >= this.payout) {
              this.streak = Math.max(this.streak + 1, 1);
            } else {
              this.streak = Math.min(this.streak - 1, -1);
            }

            this.losingStreak = this.streak < 0 ? Math.abs(this.streak) : 0;
          };

          getStreakDelta = () => this.streak + this.payout;
          getRatio = () => this.getStreakDelta() / this.payout;
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
    }
    return new DataAggregator();
  }

  function uuidv4() {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
      (
        +c ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))
      ).toString(16)
    );
  }

  async function observeRollChanges() {
    const gridElement = await waitForSelector(".grid.grid-auto-flow-column");
    let previousRollData = getCurrentRollData();

    const observer = new MutationObserver((mutationsList) => {
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

    observer.observe(gridElement, { childList: true, subtree: true });
  }

  function getCurrentRollData() {
    return $(".grid.grid-auto-flow-column div span")
      .map(function () {
        return $(this).text();
      })
      .get();
  }

function exportCSV() {
  let rows = [
    ["Iteration", "Roll", "Payout", "M1 Roll", "M1 Ratio", "M2 Ratio", "ΔRolls"]
  ];

  allIterations.forEach((iterationEvents, idx) => {
    let iterNum = idx + 1;
    let totalDelta = 0;
    let count = iterationEvents.length;

    iterationEvents.slice().reverse().forEach(ev => {
      rows.push([
        iterNum,
        ev.roll,
        ev.payout.toFixed(2) + "x",
        ev.m1Roll,
        ev.m1Ratio.toFixed(1),
        ev.m2Ratio.toFixed(1),
        ev.deltaRolls
      ]);
      totalDelta += ev.deltaRolls;
    });

    // add summary row
    if (count > 0) {
      rows.push([
        iterNum,
        "SUMMARY",
        `${count} events`,
        "",
        "",
        "",
        (totalDelta / count).toFixed(1) + " avg ΔRolls"
      ]);
    }
  });

  const csvContent = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "pop_events.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}



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

    if (arraysAreEqual(currentRollSet, lastRollSet)) return -1;
    return currentRollSet[currentRollSet.length - 1];
  }

  function arraysAreEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((value, index) => value === arr2[index]);
  }

  function waitForSelector(selector) {
    const pause = 10;
    let maxTime = 50000;
    return new Promise((resolve, reject) => {
      (function inner() {
        if (maxTime <= 0) {
          reject(new Error("Timeout: Element not found: " + selector));
          return;
        }
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
          return;
        }
        maxTime -= pause;
        setTimeout(inner, pause);
      })();
    });
  }
  observeRollChanges();
})();
