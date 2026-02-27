/* Start Script */
// ==UserScript==
// @name         bc.game framework
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

    if (rollCount % 10 === 0) {
        console.log(result);
    }
    
    TARGET_MANAGER.addResult(result);
    updateUI(result);
  }

  function updateUI(result) {

  }

  function generateTargetManager() {
    class Target {
          constructor(payout) {
            this.payout = payout;
            this.teo = 1 / (this.payout * 1.04); // Adjusted for edge

            // Streak tracking
            this.streak = 0;
            this.pstreak = 0;

            // Hit counters
            this.hitCount = 0;
            this.rollCount = 0;
          }

          getPayout() {
            return this.payout;
          }

          addResult(result) {
            this.rollCount++;

            // Update streaks + hits
            if (result >= this.payout) {
              this.hitCount++;
              if (this.streak < 0) this.pstreak = this.streak;
              this.streak = Math.max(this.streak + 1, 1);
            } else {
              if (this.streak > 0) this.pstreak = this.streak;
              this.streak = Math.min(this.streak - 1, -1);
            }
          }

          getStreak = () => this.streak;
          getLosingStreak = () => (this.streak < 0 ? this.streak : 0);
          getTeo = () => this.teo;
          getHitCount = () => this.hitCount;
          getRollCount = () => this.rollCount;
          getWinRatePercentOfTeo = () => this.getWinRate() / this.getTeo() * 100;
          getWinRate = () => this.hitCount / this.rollCount;
        }
    
        class TargetManager {
          constructor(payouts, decay = 0.95) {
            this.targets = payouts.map((p) => new Target(p, decay));
          }

          getTargets = () => this.targets;

          addResult(result) {
            this.targets.forEach((target) => {
              target.addResult(result);
            });
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
