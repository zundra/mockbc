/* Start Script */
// ==UserScript==
// @name         bc.game martingale
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://*.game/game/limbo
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bc.game
// @require https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @grant        none
// ==/UserScript==

;(function () {
  "use strict"

  class WagerManager {
    constructor() {
      this.wagers = [0.0001, 0.0005, 0.001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1, 0.5]
    }

    getWager(ratio) {
      const idx = Math.floor(ratio);
      return this.wagers[idx]
    }
  }

  const ROLL_HANDLER = initRollHandler()
  const SESSION = defaultSession()
  let currentRiskOnTarget = null

  function evalResult(result) {
    if (SESSION.globalRollCount % 50 === 0) {
      console.log(
        `Roll Count: ${SESSION.globalRollCount}, P/L: ${ROLL_HANDLER.getPL()}`,
      )
    }

    SESSION.addRoll(result)
    ROLL_HANDLER.addResult(result)
    evalRiskState(result)
    setRiskTarget(result)
    updateUI()
  }

  function setRiskTarget(result) {
    const riskOnTarget = ROLL_HANDLER.getRiskOnTarget(getBaseWager(), getLosingStreakMultiplier())

    if (!riskOnTarget) return

    let wager = riskOnTarget.getWager();
    let payout = riskOnTarget.getPayout();

    const msg = `🔥 Currently RISK-ON with target ${payout} and wager ${wager}`
    console.log(msg)
    setMessage(msg)
    setNextBet(riskOnTarget.getPayout(), riskOnTarget.getWager());
  }

  function evalRiskState() {
    if (!ROLL_HANDLER.getRiskOnRevoked()) return
      const msg = ROLL_HANDLER.getRiskOnRevokedMessage();
      setMessage(msg);
      console.warn(msg);
      setNextBet(1.01, 0)
      ROLL_HANDLER.resetRiskOnRevoked();
  }

  function updateUI() {
    $("#automation-bankRoll").text(ROLL_HANDLER.getBankRollBalance())
    $("#automation-profitLoss").text(ROLL_HANDLER.getPL())
    $("#automation-rollCount").text(SESSION.getGlobalRollCount())
    if (currentRiskOnTarget)
      $("#automation-risk-on-losing-streak").text(
        currentRiskOnTarget.riskOnLosingStreak,
      )
  }
  function setNextBet(payout, wager) {
    if (getAutomationTestMode()) return

    setPayout(payout)
    setWager(wager)
  }

  function getStartingBankRoll() {
    return 100
    return Number($("#automation-bank-roll-start").val())
  }

  function setMessage(message) {
    $("#automation-message").html(message)
  }

  function setPayout(amount) {
    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Payout")',
    )
    const inputField = payoutFieldGroup.find("input")

    if (inputField.length) {
      let nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set

      nativeSetter.call(inputField[0], amount) // Update input field value

      let event = new Event("input", {
        bubbles: true,
      })
      inputField[0].dispatchEvent(event)

      let reactEvent = new Event("change", {
        bubbles: true,
      })
      inputField[0].dispatchEvent(reactEvent) // React listens for change events

      // console.log(`Payout set to: ${amount}`);
    } else {
      console.error("Payout input field not found!")
    }
  }

  function getPayout() {
    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Payout")',
    )
    const inputField = payoutFieldGroup.find("input")

    return Number(inputField.val())
  }

  function setWager(amount) {
    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Amount")',
    )
    const inputField = payoutFieldGroup.find("input")

    if (inputField.length) {
      const currentValue = parseFloat(inputField.val())

      if (currentValue !== amount) {
        // Only set if different
        let nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        ).set

        nativeSetter.call(inputField[0], amount)
        inputField[0].dispatchEvent(
          new Event("input", {
            bubbles: true,
          }),
        )
        inputField[0].dispatchEvent(
          new Event("change", {
            bubbles: true,
          }),
        )
        // console.log(`Wager set to: ${amount}`);
      }
    } else {
      console.error("Wager input field not found!")
    }
  }


  function defaultSession() {
    return {
      state: {
        stopped: true,
        reason: "",
      },
      sessionRollCount: 0,
      globalRollCount: 0,
      addRoll: function (result) {
        this.sessionRollCount++
        this.globalRollCount++
      },
      getGlobalRollCount: function () {
        return this.globalRollCount
      },
      getSessionRollCount: function () {
        return this.sessionRollCount
      },
      start: function () {
        this.reset()
        this.state.stopped = false
      },
      reset: function () {
        this.state.stopped = true
        this.state.reason = ""
        this.sessionRollCount = 0
      },
      isStopped: function () {
        return this.state.stopped
      },
      getStopReason: function () {
        return this.state.reason
      },
      isRunning: function () {
        return !this.isStopped()
      },
      stop(reason = "") {
        this.state.reason = reason
        this.state.stopped = true
      },
    }
  }
 
  /* Configuration */
  function getAutomationTestMode() {
    return $("#automation-test-mode").prop("checked")
  }

  function getLosingStreakMultiplier() {
    return Number($("#automation-ls-multiplier").val())
  }

  function getBaseWager() {
    return Number($("#automation-base-wager").val());
  }

  // Utility function: Get current roll data
  function getCurrentRollData() {
    return $(".grid.grid-auto-flow-column div span")
      .map(function () {
        return $(this).text()
      })
      .get()
  }

  // Function to start the betting process
  function startBetting() {
    SESSION.start()
    if (!getAutomationTestMode()) {
      doBet()
    }
  }

  function stopBetting() {
    SESSION.stop()
  }

  function doInit() {
    observeRollChanges()
    initPrototypes()
    initUI()
    bindHotKeys()
  }

  function initRollHandler() {
    // const payouts = [
    //   ...[5, 6, 7, 8, 9],
    //   ...Array.from(
    //     {
    //       length: 10,
    //     },
    //     (v, k) => 10 + k * 1,
    //   ),
    // ]

    const payouts = [5, 6, 7, 8];
class RiskOnTarget {
  constructor() {
    this.wager = 0;
    this.payout = 0;
    this.wager = 0;
    this.state = 0;
    this.streak = 0;
    this.hitCount = 0;
    this.rollCount = 0;
    this.profitLoss = 0;
    this.currentProfitLoss = 0;
    this.previousProfitLoss = 0;
    this.revokeMessage = "";
    this.maxRatio = 0;
    this.wagerIncreaseDivisor = 1;
    this.cycle = 0;
  }

  invoke(payout, wager, bankRoll) {
    if (this.state === 1) throw "Must revoke target before calling invoke";
    this.baseWager = wager;
    this.bankRoll = bankRoll;
    this.payout = payout;
    this.wager = 0;
    this.state = 1;
    this.streak = 0;
    this.hitCount = 0;
    this.rollCount = 0;
    this.profitLoss = 0;
    this.currentProfitLoss = 0;
    this.previousProfitLoss = 0;
    this.revokeMessage = "";
    this.wagerIncreaseDivisor = 1;
    this.maxRatio = 0;
    this.cycle = 0;
    this.wager = this.getTieredWager(this.baseWager);
  }

  revoke(message) {
    if (this.isNotInvoked()) throw "Must invoke target before calling revoke";
    this.state = -1;
    this.revokeMessage = message;
  }

  getRevokeMessage() {
    return this.revokeMessage;
  }

  addResult(result) {
    if (this.isNotInvoked()) throw "Must invoke target before calling addResult";
    
    this.rollCount++;

    if (this.rollCount % Math.floor(this.getPayout()) === 0) {
      this.cycle++;
    }

    if (this.wagerIncreaseDivisor === 1 && this.cycle == 2) {
      this.wagerIncreaseDivisor = 2;
    }

    if (result >= this.payout) {
      this.hitCount++;
      this.streak = Math.max(this.streak + 1, 1);
      this.previousProfitLoss = this.currentProfitLoss;
      this.currentProfitLoss = (this.wager * this.payout) - this.wager;
      this.profitLoss += this.currentProfitLoss;
    } else {
      this.streak = Math.min(this.streak - 1, -1);
      this.previousProfitLoss = this.currentProfitLoss;
      this.currentProfitLoss = -this.wager;
      this.profitLoss -= this.currentProfitLoss;
    }


    this.evalRiskState(result)
    if (this.isInvoked()) this.setWager();
  }

  getRollCount() {
    return this.rollCount;
  }

  evalRiskState(result) {
    if (result >= this.getPayout() && this.getWager() < MAX_WAGER) {
      this.revoke(`Target hit for payout ${this.getPayout()}`);
    } 

    if (this.getWager() === MAX_WAGER && this.getPL() > 0) {
      this.revoke(`profit target hit for  ${this.this.getPL()}`);
    }
  }

  getPL() {
    return this.profitLoss;
  }
  
  getPLDelta() {
    return this.currentProfitLoss + this.previousProfitLoss;
  }

  getPayout() {
  //  if (this.isNotInvoked()) throw "Must invoke target before calling getPayout";
    return this.payout;
  }

  getWager() {
 //   if (this.isNotInvoked()) throw "Must invoke target before calling getWager";
    return this.wager;
  }

  getTieredWager() {
    this.maxRatio = Math.max(this.maxRatio, Math.max(this.getRatioAbs(), 1))
    return Math.min(MAX_WAGER, Math.max(MIN_WAGER, this.getScaledWager() * this.maxRatio));
  }

  getScaledWager(scalingFactor = 1.5) {
    return this.getBaseWager() * Math.pow(1.92 / this.payout, scalingFactor)
  }

  getBaseWager() {
    if (this.isNotInvoked()) throw "Must invoke target before calling getWager";
    return this.baseWager;
  }

  setWager2() {
    this.wager = this.wager * (1 + (this.getPayout() * 2) / 100);
  }

  setWager() {
    if (this.streak < 0) {
        this.wager = this.baseWager * Math.pow(this.getPayout() / (this.getPayout() - 1), Math.abs(this.streak));
      } else {
        this.wager = this.baseWager; // Reset on win
      }
  }
  getStreak() {
    return this.streak;
  }

  getRatio() {
    return Math.floor(this.getStreak() / this.payout)
  }

  getRatioAbs() {
    return Math.abs(this.getRatio());
  }

  getRollCount() {
    return this.rollCount
  }

  getHitCount() {
    return this.hitCount
  }

  getWinRate() {
    return this.hitCount / this.rollCount;
  }

  getTeoPercent() {
    return this.getTeo() * 100
  }

  getTeo() {
    return 1 / (this.payout * 1.05)
  }

  getHitCount() {
    return this.hitCount
  }

  isNotInvoked() {
    return this.isRevoked() || this.isIdle();
  }

  isIdle() {
    return this.state === 0;
  }

  isRevoked() {
    return this.state === -1;
  }

  isInvoked() {
    return this.state === 1;
  }
}

    class Target {
      constructor(payout) {
        this.payout = payout
        this.losingStreak = 0
        this.hitCount = 0
        this.rollCount = 0
        this.streak = 0
        this.pstreak = 0
        this.longStreakCount = 0
        this.strengthHistory = []
        this.historySize = 5
      }

      updateStrengthHistory() {
        const strength = Math.ceil(this.payout + this.streak) / this.payout
        this.strengthHistory.push(strength)
        if (this.strengthHistory.length > this.historySize) {
          this.strengthHistory.shift() // Keep buffer size small
        }
      }

      addResult(result) {
        this.updateStats(result)
        this.updateStrengthHistory()
      }

      updateStats(result) {
        this.rollCount++

        if (result >= this.payout) {
          this.hitCount++
          if (this.streak < 0) this.pstreak = this.streak
          this.streak = this.streak >= 1 ? this.streak + 1 : 1
        } else {
          if (this.streak > 0) this.pstreak = this.streak
          this.streak = this.streak > 0 ? -1 : this.streak - 1
        }
      }

      getStreak() {
        return this.streak
      }

      getPayout() {
        return this.payout
      }

      setLeftTarget(target) {
        this.leftTarget = target
      }

      setRightTarget(target) {
        this.rightTarget = target
      }

      getLeftTarget() {
        return this.leftTarget
      }

      getRightTarget() {
        return this.rightTarget
      }

      getPayout() {
        return this.payout
      }

      getLosingStreak() {
        if (this.streak >= 0) return 0
        return this.streak
      }

      getLosingStreakAbs() {
        return Math.abs(this.getLosingStreak())
      }

      getRatio() {
        return Math.floor(this.getStreak() / this.payout)
      }

      getLSRatio() {
        return Math.floor(this.getLosingStreak() / this.payout)
      }

      getLSRatioAbs() {
        return Math.abs(this.getLSRatio())
      }

      getTeo() {
        return 1 / (this.payout * 1.05)
      }

      getWinRate() {
        return this.hitCount / this.rollCount
      }

      getStrength() {
        return Math.ceil(this.payout + this.streak) / this.payout
      }
    }

    class RollHandler {
      constructor(targets, bankRoll) {
        this.bankRoll = { start: bankRoll, current: bankRoll }
        this.targets = targets
        this.riskOnTarget = new RiskOnTarget();
        this.riskOnRevoked = false;
        this.riskOnRevokedMessage = "";
        this.profitLoss = 0;
      }

      addResult(result) {
        for (let i = 0; i < this.targets.length; i++)
          this.targets[i].addResult(result)

        if (this.riskOnTarget.isInvoked()) {
          this.riskOnTarget.addResult(result)
          this.updateBankRoll();;
          if (this.riskOnTarget.isRevoked()) {
            this.revokeRiskOn();
          }
        }
      }

      getRiskOnRevoked() {
        return this.riskOnRevoked;
      }

      getRiskOnRevokedMessage() {
        return this.riskOnRevokedMessage;
      }

      resetRiskOnRevoked() {
        this.riskOnRevoked = false;
        this.riskOnRevokedMessage = "";
      }

      invokeRiskOn(payout, wager) {
        this.riskOnTarget.invoke(payout, wager)
      }

      revokeRiskOn() {
        this.riskOnRevoked = true;
        this.riskOnRevokedMessage = this.riskOnTarget.getRevokeMessage();
        this.updatePL(this.riskOnTarget.getPL())
      }

      getRiskOnTarget(wager, m) {
        if (this.riskOnTarget.isInvoked()) return this.riskOnTarget;

        const nextTarget = this.getNextRiskTarget(m);

        if (nextTarget) {
          this.riskOnTarget.invoke(nextTarget.getPayout(), wager, this.bankRoll);
          return this.riskOnTarget;
        }

        return null;
      }

      getTargetsWithStrengthBelowThreshold(
        strengthThreshold,
        filterPayout = null,
      ) {
        if (filterPayout) {
          return this.targets.filter(
            (target) =>
              target.getStrength() < -strengthThreshold &&
              target.getPayout() > filterPayout,
          )
        }

        return this.targets.filter(
          (target) => target.getStrength() < -strengthThreshold,
        )
      }

      getNextRiskTarget(m) {
        return this.getTargetsWithStrengthBelowThreshold(m)
          .sort((a, b) => Math.abs(a.getStrength()) - Math.abs(b.getStrength()))
          .last()
      }

      getBankRollBalance() {
        return this.bankRoll.current;
      }

      getPL() {
        return this.profitLoss;
      }

      updatePL(profitLoss) {
        this.profitLoss += profitLoss;
      }

      updateBankRoll() {
        this.bankRoll.current += this.riskOnTarget.getPLDelta()
      }
    }

    // Initialize targets and link them efficiently
    const targets = payouts.map((payout) => new Target(payout))

    targets.forEach((target, index) => {
      if (index > 0) target.setLeftTarget(targets[index - 1])
      if (index < targets.length - 1) target.setRightTarget(targets[index + 1])
    })

    return new RollHandler(targets, 5000)
  }

  function initUI() {
    $(document).ready(function () {
      var body = $("body")

      let html = `
    <div id="control-panel" style="
        position: fixed;
        top: 0px;
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
            border-radius: 8px 8px 0 0;z
            cursor: grab;
        ">⚙️ Control Panel</div>

        <div id="automation-message" class="message-box" style="
            margin: 12px 0;
            background-color: #444;
            padding: 10px;
            border-radius: 6px;
            color: white;
            font-size: 0.9rem;
            text-align: center;
        ">Welcome! Configure your settings to begin.</div>
        <div id="automation-stats-panel">
            <div id="automation-stats-panel-header">⚙️ Stats Panel</div>
            <div class="message-box">
            <div>Bank Roll: <span id="automation-bankRoll"></span></div>
            <br />
            <div>Roll Count: <span id="automation-rollCount"></span></div>
            <br />
            <div>Profit Loss: <span id="automation-profitLoss"></span></div>
            <br />
            <div>Losing Streak: <ul id="automation-risk-on-losing-streak"></div>
        </div>
            <label>Bank Roll Start</label>
            <input type="number" id="automation-bank-roll-start" value="50" />
           <br/>
             <label>Test Mode</label>
            <input id="automation-test-mode" type="checkbox" checked />
            <br/>
            <label>Base Wager</label>
            <input type="number" id="automation-base-wager" value="0.0001" />
                  <br/>
            <label>Losing Streak Multiplier</label>
            <select id="automation-ls-multiplier" style="color: black;">
            <option value="1">1</option>
            <option value="1.5">1.5</option>
            <option value="2" selected>2</option>
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
            <option value="8">8</option>
            <option value="8.5">8.5</option>
            <option value="9">9</option>
            <option value="9.5">9.5</option>
            <option value="10">10</option>
            </select>
        </div>`

      body.prepend($(html))

      $("#control-panel").draggable({
        handle: "#control-panel-header",
        containment: "window",
        scroll: false,
      })
    })
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

  function bindHotKeys() {
    $(document).on("keypress", function (e) {
      if (e.which === 122) {
        if (SESSION.isStopped()) {
          startBetting()
        } else {
          stopBetting()
        }
      }
    })
  }


  /********************* Framework *********************/
  let lastRollSet = []
  let currentRollSet = []

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async function doBet() {
    while (SESSION.isRunning()) {
      // Trigger the button click

      $(".button-brand:first").trigger("click")

      // Wait for 1 second (1000 ms) before clicking again
      await delay(10)

      // Stop condition check inside the loop
      if (SESSION.isStopped()) {
        return // Break the loop if stop is true
      }
    }
  }

  // Utility function: Extract the last roll result
  function getRollResult() {
    const temp = lastRollSet
    lastRollSet = currentRollSet
    currentRollSet = temp
    currentRollSet.length = 0

    currentRollSet = $(".grid.grid-auto-flow-column div span")
      .map(function () {
        return Number($(this).text().replace("x", ""))
      })
      .get()

    if (arraysAreEqual(currentRollSet, lastRollSet)) {
      return -1
    }

    return currentRollSet[currentRollSet.length - 1]
  }

  // Observer to monitor roll changes in the grid
  let observer = null // Store observer globally

  async function observeRollChanges() {
    const gridElement = await waitForSelector(".grid.grid-auto-flow-column")
    let previousRollData = getCurrentRollData()

    // If an observer already exists, disconnect it before creating a new one
    if (observer) {
      observer.disconnect()
    }

    observer = new MutationObserver((mutationsList) => {
      let rollDataChanged = false

      for (const mutation of mutationsList) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          const currentRollData = getCurrentRollData()
          if (!arraysAreEqual(previousRollData, currentRollData)) {
            rollDataChanged = true
            previousRollData = currentRollData
          }
        }
      }

      if (rollDataChanged) {
        evalResult(getRollResult())
      }
    })

    observer.observe(gridElement, {
      childList: true,
      subtree: true,
    })
  }

  function arraysAreEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false
    return arr1.every((value, index) => value === arr2[index])
  }

  function waitForSelector(selector) {
    const pause = 10 // Interval between checks (milliseconds)
    let maxTime = 50000 // Maximum wait time (milliseconds)

    return new Promise((resolve, reject) => {
      function inner() {
        if (maxTime <= 0) {
          reject(
            new Error("Timeout: Element not found for selector: " + selector),
          )
          return
        }

        // Try to find the element using the provided selector
        const element = document.querySelector(selector)
        if (element) {
          resolve(element)
          return
        }

        maxTime -= pause
        setTimeout(inner, pause)
      }

      inner()
    })
  }

  doInit()
})()