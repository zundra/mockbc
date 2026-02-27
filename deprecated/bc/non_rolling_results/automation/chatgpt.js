;(function () {
  "use strict"

  let maxTotalStrengthBelowZero = { max: 0 }
  const ROLL_HANDLER = initRollHandler();
  const SESSION = defaultSession()
  const TEST_MODE = true

  let lastRollSet = []
  let currentRollSet = []
  let currentRiskOnTarget = null
  let riskOnReTryCount = 0
  let maxRatio = 0

  console.log("🚀 Script Initialized! Waiting for rolls...");

  function evalResult(result) {
    SESSION.addRoll(result)
    ROLL_HANDLER.addResult(result)
    evalRiskState(result)
    setNextRiskTarget(result)
    printSummary()
    updateUI()
  }

  function printSummary() {
    if (!currentRiskOnTarget) return
    console.log(`📊 Current Risk-On Target: ${currentRiskOnTarget.getPayout()}`);
  }

  function setNextRiskTarget(result) {
    if (!currentRiskOnTarget)
      currentRiskOnTarget = ROLL_HANDLER.getNextRiskTarget()

    if (!currentRiskOnTarget) return

    let wager = 0
    const payout = currentRiskOnTarget.getPayout()

    if (!currentRiskOnTarget.isRiskOn()) {
      if (!currentRiskOnTarget.shouldEnterRisk()) return

      wager = getTieredWager(currentRiskOnTarget)
      console.log(`🔥 Going RISK-ON with target ${payout} and wager ${wager}`);
      currentRiskOnTarget.goRiskOn(wager)
    } else {
      wager = currentRiskOnTarget.getWager()
      console.log(`🔄 Updating Risk-On Target ${payout}, New Wager: ${wager}`);
    }

    setNextBet(payout, wager)
  }

  function evalRiskState(result) {
    if (!currentRiskOnTarget) return

    if (currentRiskOnTarget.isDispose()) {
      printSummary()
      ROLL_HANDLER.updateBankRoll()
      currentRiskOnTarget.goRiskOff()
      currentRiskOnTarget = null
      setNextBet(0, 1.01)
      maxRatio = 0
    }
  }

  function initRollHandler() {
    const payouts = [5, 6, 7, 8, 9, 10]

    class Target {
      constructor(payout) {
        this.payout = payout
        this.losingStreak = 0
        this.hitCount = 0
        this.rollCount = 0
        this.streak = 0
        this.pstreak = 0
        this.profitLoss = 0
        this.wager = 0
        this.baseWager = 0

        this.riskState = 0
        this.riskOnLosingStreak = 0
        this.riskOnHitCount = 0
        this.riskOnLosingStreakDelta = 0
        this.riskOnWinRate = 0
        this.riskOnRollCount = 0

        this.longStreakCount = 0
        this.burstHits = 0
        this.isLongStreakActive = false
      }

      addResult(result) {
        this.updateStats(result)
      }

      updateStats(result) {
        if (this.isRiskOn()) this.updateRiskOnStats(result)
        this.updateGlobalStats(result)
      }

      updateGlobalStats(result) {
        this.rollCount++

        if (result >= this.payout) {
          this.hitCount++
          if (this.streak < 0) this.pstreak = this.streak
          this.streak = this.streak >= 1 ? this.streak + 1 : 1
        } else {
          if (this.streak > 0) this.pstreak = this.streak
          this.streak = this.streak > 0 ? -1 : this.streak - 1
        }

        if (this.streak < -20 && !this.isLongStreakActive) {
          this.isLongStreakActive = true
          console.log("🚨 Long Losing Streak Detected");
        }
      }

      updateRiskOnStats(result) {
        this.riskOnRollCount++

        if (result >= this.payout) {
          if (this.isLongStreakActive) {
            this.burstHits++
            if (this.burstHits === 1) {
              this.baseWager = 0.0001
            } else if (this.burstHits <= 10) {
              this.baseWager *= 2
            }
          }

          this.riskOnLosingStreakDelta = this.payout - this.riskOnLosingStreak
          this.riskOnHitCount++
          this.riskOnLosingStreak = 0
          this.setWager()
        } else {
          this.riskOnLosingStreak++
        }

        this.updatePL(result)
        this.evalRiskState(result)
      }

      shouldEnterRisk() {
        return this.isLongStreakActive && this.burstHits === 0
      }
    }

    class RollHandler {
      constructor(targets) {
        this.targets = targets
      }

      addResult(result) {
        for (let target of this.targets) target.addResult(result)
      }

      getNextRiskTarget() {
        let target = this.targets.find(target => target.shouldEnterRisk());
        if (target) {
          console.log(`✅ Found Risk-On Target: ${target.getPayout()}`);
        }
        return target;
      }

      updateBankRoll() {}
      getBankRollBalance() { return 100 }
      getPL() { return this.targets.reduce((sum, target) => sum + target.profitLoss, 0) }
    }

    return new RollHandler(payouts.map(payout => new Target(payout)))
  }

  function doInit() {
    observeRollChanges()
    initPrototypes()
    initUI()
    bindHotKeys()
  }

  let observer = null 

  async function observeRollChanges() {
    const gridElement = await waitForSelector(".grid.grid-auto-flow-column")
    let previousRollData = getCurrentRollData()

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

  function getRollResult() {
    lastRollSet = [...currentRollSet]
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

  function waitForSelector(selector) {
    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector)
        if (element) {
          observer.disconnect()
          resolve(element)
        }
      })
      observer.observe(document.body, { childList: true, subtree: true })
    })
  }

  doInit()
})()
