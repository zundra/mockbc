/* Start Script */
// ==UserScript==
// @name         bc.game automation v8
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

  let lastRollSet = [];
  let currentRollSet = [];
  let automation = generateAutomation();
  let recovery = generateRecovery();
  let profit = 0;
  let rollCount = 0;

  function evalResult(result) {
    const payout = getPayout();
    const wager = getWager();
rollCount++;


    if (profit <= -0.1) {
      if (!recovery.inRecovery) {
        const recoveryAmount = Math.abs(profit);
        const baseWager = 0.5;
        const originalPayout = payout;
        const originalWager = wager;
        setWager(0);
        setPayout(1.01);
        recovery.initialize(
          recoveryAmount,
          baseWager,
          originalPayout,
          originalWager
        );
      } else {
        recovery.evaluate(result);
      }
    } else {
      automation.evaluate(result);      
    }

    if (result >= payout) {
      profit += payout * wager - wager;
      if (wager > 0)
     console.log(`TOP LEVEL WINNER PROFIT, wager=${wager}, payout=${payout}, result=${result}, profit = ${profit}`);
    } else {
      profit -= wager;
     if (wager > 0)
     console.log(`TOP LEVEL LOSER PROFIT, wager=${wager}, payout=${payout}, result=${result}, profit = ${profit}`);
    }
    updateUI();
  }

  function updateUI() {
    $("#profit-loss")
      .html(profit.toFixed(4))
      .css({
        backgroundColor: `${
          profit > 0 ? "green" : profit < 0 ? "red" : "transparent"
        }`
      });
  }

  function generateAutomation() {
    class Automation {
      constructor(targets, baseWager) {
        this.targets = targets;
        this.baseWager = baseWager;
        this.riskOnTarget = null;
        this.totalProfit = 0;
        this.profit = 0;
        this.wager = 0;
        this.payout = 1.01;
        this.losingStreak = 0;
      }

      getLosingStreak = () => this.losingStreak;
      getPayout = () => this.payout;
      getPL = () => this.totalProfit;

      evaluate(result) {
        for (let i = 0; i < this.targets.length; i++) {
          const target = targets[i];
          target.push(result);
        }
      }

      evaluateRiskOff() {
        this.trySetNextRiskOnTarget();
        if (this.riskOnTarget) {
          this.goRiskOn();
        } else {
          //console.log("No risk on target found");
        }
      }

      evaluateRiskOn(result) {
        if (!this.riskOnTarget) return;
        this.setRiskOnStats(result);

        if (this.profit > 0) {
          console.log("Going risk on with profit", this.profit);
          this.goRiskOff();
          return;
        } else if (this.riskOnTarget.riskOffCheck()) {
          console.log(
            "Going risk off for target",
            this.riskOnTarget.getPayout()
          );
          this.goRiskOff();
        } else {
          if (Math.ceil(this.getLosingStreak() / 2) % this.getPayout() === 0) {
            this.wager *= 2;
          }
        }
      }

      setRiskOnStats(result) {
        if (!this.riskOnTarget) return;
        const payout = this.riskOnTarget.getPayout();

        if (result >= payout) {
          this.profit += this.wager * payout - this.wager;
          this.losingStreak = 0;
        } else {
          this.profit -= this.wager;
          this.losingStreak++;
        }
        console.log(
          `Payout: ${payout}, Wager: ${this.wager}, Profit: ${this.profit}`
        );
      }

      goRiskOn() {
        if (!this.riskOnTarget) return;
        this.payout = this.riskOnTarget.getPayout();
        this.wager = this.getScaledWager();
        console.log(`Going risk on with target ${this.payout}`);
        setWager(this.wager);
        setPayout(this.riskOnTarget.getPayout());
      }

      goRiskOff() {
        if (!this.riskOnTarget) return;
        const payout = this.riskOnTarget.getPayout();
        this.totalProfit += this.profit;
        console.log(
          `Going risk off: Payout: ${payout}, Total Profit: ${this.totalProfit}`
        );
        this.riskOnTarget = null;
        this.wager = 0;
        this.payout = 1.01;
        this.losingStreak = 0;
        this.profit = 0;
        setWager(0);
        setPayout(1.01);
      }

      getScaledWager(scalingFactor = 0.9) {
        return Math.max(
          0.0001,
          this.baseWager * Math.pow(1.01 / this.payout, scalingFactor)
        );
      }

      trySetNextRiskOnTarget() {
        this.riskOnTarget = this.targets.find((t) => t.riskOnReady());
      }
    }

    const targets = populateTargets();
    return new Automation(targets, 1);
  }

  function generateRecovery() {
    class Recovery {
      constructor() {
        this.targets = this.generateTargets();
        this.recoveryAmount = 0;
        this.baseWager = 0;
        this.originalPayout = 0;
        this.originalWager = 0;
        this.profit = 0;
        this.wager = 0;
        this.payout = 1.01;
        this.losingStreak = 0;
        this.riskOn = false;
        this.inRecovery = false;
      }

      initialize(recoveryAmount, baseWager, originalPayout, originalWager) {
        this.recoveryAmount = recoveryAmount;
        this.baseWager = baseWager;
        this.wager = this.baseWager;
        this.originalPayout = originalPayout;
        this.originalWager = originalWager;
        this.inRecovery = true;
        setWager(0);
        setPayout(1.01);
      }

      getLosingStreak = () => this.losingStreak;
      getPayout = () => this.payout;
      getPL = () => this.totalProfit;

      evaluate(result) {
        this.evaluateBase(result);
        if (this.riskOn) {
          this.evaluateRiskOn(result);
        } else {
          this.evaluateRiskOff(result);
        }
      }

      evaluateRiskOff(result) {
        const riskOnPayout = this.targets.find((t) => t.riskOnReady);

        if (riskOnPayout) {
          this.goRiskOn(riskOnPayout.payout);
        }
      }

      evaluateBase(result) {
        this.targets.forEach((entry) => {
          const payout = entry.payout;
          entry.riskOnReady = false;

          if (result >= payout) {
            entry.streak = 0;
          } else {
            entry.streak++;
          }

          if (entry.streak >= entry.payout * 2) {
            entry.riskOnReady = true;
          }
        });
      }
      evaluateRiskOn(result) {
        this.setRiskOnStats(result);
        if (this.profit > this.recoveryAmount) {
          console.log(
            `Exiting recovery cycle, profit ${this.profit} exceeded recovery amount ${this.recoveryAmount} total profit = ${profit}`
          );
          this.exitRecovery();
        }
      }

      setBaseStats(result) {
        if (result >= this.payout) {
          this.losingStreak = 0;
        } else {
          this.losingStreak++;
        }
      }

      setRiskOnStats(result) {
        const payout = getPayout();
        const wager = getWager();

        if (result >= payout) {
          this.profit += wager * payout - wager;
          this.losingStreak = 0;
          this.wager = this.getScaledWager();
          console.log("Winner PROFIT, next wager", this.profit, this.wager, `total profit = ${profit}`);
        } else {
          this.profit -= wager;
          this.losingStreak++;
          this.wager = wager * 3;
          console.log("LOSER PROFIT, next wager", this.profit, this.wager, `total profit = ${profit}`);
        }
        // console.log(
        //   `Payout: ${this.payout}, Wager: ${this.wager}, Profit: ${this.profit}`
        // );
      }

      goRiskOn(payout) {
        console.log(`Going risk on with pyout ${payout}`);
        this.payout = payout;
        this.wager = this.getScaledWager();
        this.riskOn = true;
        setWager(this.wager);
        setPayout(this.payout);
      }

      goRiskOff() {
        this.wager *= 2;
        console.log(
          `Going risk off with pyout ${this.payout} and next wager ${this.wager}`
        );
        this.riskOn = false;

        setWager(0);
      }

      exitRecovery() {
        this.riskOn = false;
        this.wager = 0;
        this.payout = 1.01;
        this.losingStreak = 0;
        this.profit = 0;
        this.recoveryAmopunt = 0;
        this.inRecovery = false;
        setWager(this.originalWager);
        setPayout(this.originalPayout);
      }

      getScaledWager(scalingFactor = 0.9) {
        return Math.max(
          0.0001,
          this.baseWager * Math.pow(1.01 / this.payout, scalingFactor)
        );
      }

      trySetNextRiskOnTarget() {
        this.riskOnTarget = this.targets.find((t) => t.riskOnReady());
      }

      generateTargets() {
        return Array.from(
          {
            length: 53
          },
          (v, k) => 1.7 + k * 0.01
        ).map((p) => ({ payout: p, streak: 0, riskOnReady: false }));
      }
    }

    return new Recovery();
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

  function getIsTestMode() {
    return true;
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
    rollCount = 0;
    highHit = 0;
    profit = 0;
    recoveryDelta = 0;
    recoveryPL = 0;
    setWager(0.01);
    setPayout(100);

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
    setWager(0.01);
    setPayout(100);
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

  function populateTargets() {
    class Stats {
      constructor(payout) {
        this.rollCount = 0;
        this.payout = payout;
        this.streak = 0;
        this.pstreak = 0;
        this.hitCount = 0;
        this.losingStreak = 0;
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
      };

      getWinRatePercentOfTeo() {
        return (this.getWinRate() / this.getTeo()) * 100;
      }

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
      constructor(payout) {
        this.payout = payout;
        this.stats = new Stats(payout);
        this.testCheck = 0;
      }

      getPayout() {
        return this.payout;
      }

      push(result) {
        this.rollCount++;
        this.stats.push(result);
      }

      riskOnReady() {
        return Math.abs(this.getLosingStreak()) >= this.getPayout() * 3;
      }

      riskOffCheck() {
        return Math.abs(this.getLosingStreak()) >= this.getPayout() * 5;
      }

      getRatio = () => this.stats.getRatio();
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
      getStreak = () => this.stats.streak;
      getLosingStreak = () =>
        this.stats.getStreak() < 0 ? this.stats.getStreak() : 0;
      getTeo = () => this.stats.getTeo();
      getHitCount = () => this.stats.getHitCount();
      getRollCount = () => this.stats.getRollCount();
      getWinRatePercentOfTeo = () => this.stats.getWinRatePercentOfTeo();
    }

    return generatePayouts().map((payout) => new Target(payout));
  }

  function generatePayouts() {
    const a1 = Array.from(
      {
        length: 10
      },
      (v, k) => parseFloat((1.5 + k * 0.1).toFixed(2))
    );

    const a2 = Array.from(
      {
        length: 99
      },
      (v, k) => 2 + k * 1
    );

    return [...a1, ...a2];
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

const mbc = new MockBC(
  0,
  "Y83TpC2hj2SnjiNEDJwN",
  "9b98254e8986dd95349fc754b4b087b5d0ddf9771026d68fe4ed661c869420b4"
);
