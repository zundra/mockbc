/* Start Script */
// ==UserScript==
// @name         bc.game automation missing-hits
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

  const MAX_WAGER = 0.15
  const MIN_WAGER = 0.001;
  const SESSION = defaultSession()
  const ROLL_HANDLER = initRollHandler()

  let BANK_ROLL = null
  let riskOnTarget = null

  function evalResult(result) {
    SESSION.addRoll(result)
    ROLL_HANDLER.addResult(result)
    updateUI()
    checkHalts();
    // Risk on target in play,
    // evaluate the risk on
    // state.
    if (riskOnTarget) {
      riskOnTarget.addResult(result)
      evalRiskState(result)
    }

    // Risk on target no longer
    // valid, so attempt to
    // set the next one from the
    // queue.

    if (!riskOnTarget) {
      setNextRiskOnTarget()
    }

    // Risk on target in play after
    // eval, so either a new one
    // was picked up or the old
    // one has not met the risk
    // off conditions, so set the
    // next bet.
    if (riskOnTarget) {
      setNextBet()
    }
  }

  function checkHalts() {
    BANK_ROLL.checkMaxLoss();
  }
  function evalRiskState(result) {
    if (!riskOnTarget) return

    if (riskOnTarget.isRevoked()) {
      riskOnTarget = null
      setPayout(1.01)
      setWager(0)
    }

    return
  }

  function setNextRiskOnTarget() {
    const target = ROLL_HANDLER.getNextRiskOnReadyTarget()

    if (target) {
      target.goRiskOn()
      riskOnTarget = initRiskOnTarget(
        target,
        target.getNextWager(),
        getMaxWager(),
        BANK_ROLL,
      )
    }
  }

  async function queueRiskOnCandidates() {
    const targets = ROLL_HANDLER.getPotentialTargets()

    if (targets.length === 0) return

    await Promise.all(
      targets.flat().map((target) => target.goPotentialRiskOn()),
    )
  }

  function reapInvalidPotentialRiskOnTargets() {
    ROLL_HANDLER.reapRiskOnReadyReversed()
  }

  async function processRiskOnQueue() {
    while (true) {
      reapInvalidPotentialRiskOnTargets()
      await queueRiskOnCandidates()
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  function updateUI() {
    $("#automation-bankRoll").text(BANK_ROLL.getBalance())
    $("#automation-profitLoss").text(BANK_ROLL.getPL())
    $("#automation-rollCount").text(SESSION.getGlobalRollCount())
  }

  function setNextBet() {
    if (getAutomationTestMode()) return

    if (!riskOnTarget) return

    setPayout(riskOnTarget.getPayout())
    setWager(riskOnTarget.getWager())
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
    return Number($("#automation-base-wager").val())
  }

  function getMaxLoss() {
    return Number($("#automation-max-loss").val())
  }

  function getMaxWager() {
    return MAX_WAGER
  }

  function getBalance() {
    let rawText = $(".ml-3 .font-extrabold").text().trim()
    return parseFloat(rawText.replace(/[^\d.]/g, ""))
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
    console.log("starting...")
    BANK_ROLL = initBankRoll(getBalance(), getMaxLoss())
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
    processRiskOnQueue()
  }

  function initRiskOnTarget(primaryTarget, baseWager, maxWager, bankRoll) {
    class RiskOnTarget {
      constructor() {
        this.primaryTarget = null
        this.bankRoll = null
        this.wager = 0
        this.baseWager = 0
        this.maxWager = 0
        this.payout = 0
        this.state = 0
        this.streak = 0
        this.hitCount = 0
        this.rollCount = 0
        this.profitLoss = 0
        this.currentProfitLoss = 0
        this.previousProfitLoss = 0
        this.revokeMessage = ""
        this.hitThresholds = {}
                this.retryCount = 0;
        this.rollingResults = []
        this.startWinRate = 0
        this.requiredHits = 0
        this.isRetry = false
      }

      invoke(primaryTarget, baseWager, maxWager, bankRoll) {
        this.primaryTarget = primaryTarget
        this.bankRoll = bankRoll
        this.baseWager = baseWager
        this.maxWager = maxWager
        this.payout = primaryTarget.getPayout()
        this.wager = this.getScaledWager();
        this.hitThresholds = this.getHitThresholds()
        this.state = 1
        this.retryCount = 0;
        this.streak = 0
        this.hitCount = 0
        this.rollCount = 0
        this.profitLoss = 0
        this.currentProfitLoss = 0
        this.previousProfitLoss = 0
        this.revokeMessage = ""
        this.rollingResults = []
        this.startWinRate = primaryTarget.getWinRate(
          this.hitThresholds.full.windowSize,
        )
        this.isRetry = false
        this.printInvokeSummary()
      }

      retry(requiredHitDelta) {
        this.wager = this.baseWager * Math.pow(this.getPayout() / (this.getPayout() - 1), Math.abs(this.streak));
        this.hitThresholds = this.getRetryHitThresholds(requiredHitDelta)
        this.state = 1
        this.streak = 0
        this.hitCount = 0
        this.rollCount = 0
        this.currentProfitLoss = 0
        this.previousProfitLoss = 0
        this.revokeMessage = ""
        this.rollingResults = []
        this.isRetry = true
        this.retryCount++;
        this.printRetrySummary()
      }
  getScaledWager(scalingFactor = 1.5) {
    return this.getBaseWager() * Math.pow(5 / this.payout, scalingFactor)
  }

  getBaseWager() {
    return this.baseWager;
  }
      printRetrySummary() {
        console.log(`🔔 Retry Invoked`)
        console.log(`==========================`)
        console.log(`🎯 Target: ${primaryTarget.payout}`)
        console.log(`🎯 TEO: ${(this.getTeo() * 100).toFixed(2)}%`)
        console.log(
          `⚠️ Required Recovery Hits (next 100): ${this.hitThresholds.full.requiredHits.toFixed(2)}`,
        )
        console.log(`💰 Wager: ${this.wager}`)
        console.log(`💰 Window Size: ${this.hitThresholds.full.windowSize}`)
        console.log(`🧪 Payout: ${this.payout.toFixed(2)}x`)
        console.log(`🧪 Retry Count: ${this.retryCount}`)
        console.log(`==========================`)
      }

      printInvokeSummary() {
        console.log(`🔔 Risk-On Invoked`)
        console.log(`==========================`)
        console.log(`🎯 Target: ${primaryTarget.payout}`)
        console.log(`🎯 TEO: ${(this.getTeo() * 100).toFixed(2)}%`)
        console.log(
          `⚠️ Required Recovery Hits (next 100): ${this.hitThresholds.full.requiredHits.toFixed(2)}`,
        )
        console.log(`💰 Wager: ${this.wager}`)
        console.log(`💰 Window Size: ${this.hitThresholds.full.windowSize}`)
        console.log(`🧪 Payout: ${this.payout.toFixed(2)}x`)
        console.log(`==========================`)
      }

      printRevokeSummary(profitableCycle) {
        console.log(
          `🔔 Risk-On Revoked ${profitableCycle ? "Hit count completed early" : "Ran full cycle"}`,
        )
        console.log(`==========================`)
        console.log(`🎯 Target: ${this.payout}`)
        console.log(`🎯 TEO: ${(this.getTeo() * 100).toFixed(2)}%`)
        console.log(
          `⚠️ Required Recovery Hits (next 100): ${this.hitThresholds.full.requiredHits.toFixed(2)}`,
        )
        console.log(`💰 Actual Hits: ${this.hitCount}`)
        console.log(`💰 Profit/Loss: ${this.getPL()}`)
        console.log(`==========================`)
      }

      shouldGoRiskOff() {
        if (this.getPL() > 0) return true
      }

      getBankRollBalance() {
        return this.bankRoll.getBalance()
      }

      revoke(message) {
        this.state = -1
        this.revokeMessage = message
        this.primaryTarget.goRiskOff()
      }

      getRevokeMessage() {
        return this.revokeMessage
      }

      addResult(result) {
        this.rollCount++

        if (result >= this.payout) {
          this.profitLoss += this.wager * this.payout - this.wager
          this.bankRoll.increment(this.wager * this.payout - this.wager)
          this.hitCount++
          this.streak = Math.max(this.streak + 1, 1)
        } else {
          this.streak = Math.min(this.streak - 1, -1)
          this.profitLoss -= this.wager
          this.bankRoll.decrement(this.wager)
        }

        this.updateRollingResults(result)

        if (this.hitThresholdsPassed()) {
          this.revoke("Going risk off")
          this.printRevokeSummary(false)
        }

        if (this.rollCount === this.hitThresholds.full.windowSize) {
          const requiredHitDelta =
            this.hitThresholds.full.requiredHits - this.hitCount
          this.retry(requiredHitDelta)
          this.printRetrySummary(false)
        }

        if (this.isRetry && this.getPL() >= 0) {
          this.revoke("Going risk off")
          this.printRetrySummary(true)
        }

        if (this.retryCount === 3) {
          this.revoke("Going risk off")
          this.printRetrySummary(true)
        }
      }

      hitThresholdsPassed() {
        const thresholds = this.hitThresholds

        for (const key in thresholds) {
          const { requiredHits, windowSize } = thresholds[key]
          if (this.rollCount <= windowSize && this.hitCount >= requiredHits) {
            console.log(
              `✅ Hit threshold passed: ${key} — Hits: ${this.hitCount}, Rolls: ${this.rollCount}`,
            )
            return true
          }
        }

        return false
      }

      updateRollingResults(result) {
        this.rollingResults.push(result >= this.payout ? 1 : 0)
        if (this.rollingResults.length > this.windowThresholds) {
          this.rollingResults.shift()
        }
      }

      getRollCount() {
        return this.rollCount
      }

      getPL() {
        return this.profitLoss
      }

      resetPL() {
        this.profitLoss = 0
      }

      getPayout() {
        return this.payout
      }

      getWager() {
        return this.wager
      }

      setWager() {
        if (this.getLosingStreakAbs() >= this.getPayout()) {
          this.wager = Math.min(this.maxWager, this.wager * 2)
        } else if (this.getPL() >= 0) {
          this.wager = Math.max(this.baseWager, this.wager / 4)
        }
      }
      getStreak() {
        return this.streak
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

      getRatioAbs() {
        return Math.abs(this.getRatio())
      }

      getRollCount() {
        return this.rollCount
      }

      getHitCount() {
        return this.hitCount
      }

      getWinRate(lookback = 100) {
        const data = this.rollingResults.slice(-lookback)
        if (data.length === 0) return 0
        return data.reduce((sum, val) => sum + val, 0) / data.length
      }

      getWinRatePercentOfTeo(lookback = 100) {
        return (this.getWinRate(lookback) / this.getTeo()) * 100
      }

      getTeoPercent() {
        return this.getTeo() * 100
      }

      getTeo() {
        return 1 / (this.payout * 1.05)
      }

      getRetryHitThresholds(requiredHitDelta) {
        const hitThresholds = { full: {}, half: {}, quarter: {} }
        hitThresholds.full.requiredHits =
          this.hitThresholds.full.requiredHits + requiredHitDelta
        hitThresholds.half.requiredHits = Math.floor(
          this.hitThresholds.full.requiredHits / 2,
        )
        hitThresholds.quarter.requiredHits = Math.floor(
          this.hitThresholds.full.requiredHits / 4,
        )

        hitThresholds.full.windowSize = this.hitThresholds.full.windowSize
        hitThresholds.half.windowSize = this.hitThresholds.half.windowSize
        hitThresholds.quarter.windowSize = this.hitThresholds.quarter.windowSize
        return hitThresholds
      }

      getHitThresholds() {
        const fullWindowSize = this.getFullWindowSize()
        const teo = this.getTeo()
        const currentHits = this.startWinRate * fullWindowSize
        const targetTotalHits = fullWindowSize * 2 * teo
        const fullRequiredHits = targetTotalHits - currentHits

        const hitThresholds = { full: {}, half: {}, quarter: {} }
        hitThresholds["full"].requiredHits = Math.floor(fullRequiredHits)
        hitThresholds["full"].windowSize = Math.floor(fullWindowSize)

        hitThresholds["half"].requiredHits = Math.floor(fullRequiredHits / 2)
        hitThresholds["half"].windowSize = Math.floor(fullWindowSize / 2)

        hitThresholds["quarter"].requiredHits = Math.floor(fullRequiredHits / 4)
        hitThresholds["quarter"].windowSize = Math.floor(fullWindowSize / 4)
        return hitThresholds
      }

      getFullWindowSize() {
        const baseFactor = 100 // Increased from 100 to smooth scaling
        const expectedWindow = Math.ceil(baseFactor / this.getTeoPercent())
        const minWindow = Math.ceil(expectedWindow * 10)
        return this.payout <= 100
          ? Math.max(minWindow, expectedWindow)
          : expectedWindow

        //                 console.log(`📊 Get Buffer Size Debug`);
        // console.log(`-------------------------------`);
        // console.log(`🧪 expectedWindow: ${expectedWindow}`);
        // console.log(`📈 this.getTeoPercent(): ${(this.getTeoPercent().toFixed(2))}%`);
        // console.log(`🧮 Min Window Size: ${minWindow}`);
        // console.log(`🧮 Buffer Size: ${windowThresholds}`);
        // console.log(`-------------------------------`);
      }

      getHitCount() {
        return this.hitCount
      }

      isNotInvoked() {
        return this.isRevoked() || this.isIdle()
      }

      isIdle() {
        return this.state === 0
      }

      isRevoked() {
        return this.state === -1
      }

      isInvoked() {
        return this.state === 1
      }
    }

    const t = new RiskOnTarget()
    t.invoke(primaryTarget, baseWager, maxWager, bankRoll)
    return t
  }

  function initRollHandler() {
    // const payouts = [...[1.5, 1.6, 1.7, 1.8, 1.9, 2, 3, 4, 5, 6, 7, 8, 9], ...Array.from({
    //         length: 10,
    //     },
    //     (v, k) => 10 + k * 10,
    // )]

    const payouts = Array.from(
      {
        length: 10,
      },
      (v, k) => 5 + k * 1,
    )

    class HistoricalHit {
      constructor(lookback) {
        this.lookback = lookback
        this.hitCount = 0
        this.rollCount = 0
      }

      setHit(targetHit) {
        if (this.rollCount % this.lookback === 0) {
          this.rollCount = 0
          this.hitCount = 0
        }

        this.rollCount++
        if (targetHit) this.hitCount++
      }

      getWinRate() {
        return this.hitCount / this.rollCount
      }
    }

    class Target {
      constructor(payout, nextWager) {
        this.payout = payout
        this.streak = 0
        this.pstreak = 0
        this.hitCount = 0
        this.rollCount = 0
        this.leftTarget = null
        this.rightTarget = null
        this.state = 0
        this.rollingResults = []
        this.priorExitWithProfit = true
        this.baseWager = nextWager
        this.nextWager = nextWager
        this.windowSize = this.getWindowSize()
      }

      getWindowSize() {
        const baseFactor = 500 // Increased from 100 to smooth scaling
        const expectedWindow = Math.ceil(baseFactor / this.getTeoPercent())
        const minWindow = Math.ceil(expectedWindow * 10)
        const windowSize =
          this.payout <= 100
            ? Math.max(minWindow, expectedWindow)
            : expectedWindow
        return windowSize
      }

      getNextWager() {
        return this.nextWager
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

      addResult(result) {
        this.rollCount++
        this.updateRollingResults(result)
        this.updateStreak(result)
      }

      updateStreak(result) {
        if (result >= this.payout) {
          this.hitCount++
          if (this.streak < 0) this.pstreak = this.streak
          this.streak = Math.max(this.streak + 1, 1)
        } else {
          if (this.streak > 0) this.pstreak = this.streak
          this.streak = Math.min(this.streak - 1, -1)
        }
      }

      updateRollingResults(result) {
        this.rollingResults.push(result >= this.payout ? 1 : 0)
        if (this.rollingResults.length > this.windowSize) {
          this.rollingResults.shift()
        }
      }

      getStreak() {
        return this.streak
      }

      getLosingStreakAbs() {
        return Math.abs(this.getLosingStreak())
      }

      getLosingStreak() {
        return this.streak < 0 ? this.streak : 0
      }

      getRatio() {
        return Math.floor(this.getLosingStreak() / this.payout)
      }

      getLSRatioAbs() {
        return Math.abs(this.getLSRatio())
      }

      getWinRatePercentOfTeo() {
        return (this.getWinRate(this.windowSize) / this.getTeo()) * 100
      }

      getWinRate(lookback = 100) {
        const data = this.rollingResults.slice(-lookback) // Use only the latest `lookback` results
        if (data.length === 0) return 0
        return data.reduce((sum, val) => sum + val, 0) / data.length
      }

      getHitCount() {
        return this.hitCount
      }

      getRollCount() {
        return this.rollCount
      }

      getTeoPercent(target) {
        return this.getTeo() * 100
      }

      getTeo() {
        return 1 / (this.payout * 1.05)
      }

      getStrength() {
        return Math.ceil(this.payout + this.streak) / this.payout
      }

      /* Automation Functions */
      riskOnConditionsMet() {
        if (this.rollCount < this.payout * 10) return false

        return (
          this.getWinRatePercentOfTeo() <= 95 &&
          this.getLosingStreakAbs() >= this.payout * 2
        )
      }

      riskOnConditionsReversed() {
        return this.isPotentialRiskOn() && this.getWinRatePercentOfTeo() > 95
      }

      isWinRateMinusTeoLessThan(delta = -1) {
        return this.getWinRateMinusTeo() < delta
      }

      isWinRateMinusTeoGreaterThan(delta = 1) {
        return this.getWinRateMinusTeo() > delta
      }

      getWinRateMinusTeo() {
        return this.getWinRate() - this.getTeo()
      }

      isRiskOnReady() {
        return this.isPotentialRiskOn() && !this.riskOnConditionsReversed()
      }

      goRiskOff() {
        this.state = 0
      }

      goPotentialRiskOn() {
        this.state = 1
      }

      goRiskOn(wager) {
        this.state = 2
      }

      isRiskOff() {
        return this.state === 0
      }

      isPotentialRiskOn() {
        return this.state === 1
      }

      isRiskOn() {
        return this.state === 2
      }
    }

    class RollHandler {
      constructor(targets) {
        this.targets = targets
      }

      getNextRiskOnReadyTarget() {
        return targets.find(
          (target) => target.isPotentialRiskOn() && target.isRiskOnReady(),
        )
      }

      getPotentialTargets() {
        // This will be the target to start tracking cycles on.  Static window size of 100, static partition size 10
        return this.targets
          .filter((target) => target.riskOnConditionsMet())
          .sort((a, b) => b.payout - a.payout) // Sort descending by target value
      }

      reapRiskOnReadyReversed() {
        this.targets
          .filter(
            (target) =>
              target.isPotentialRiskOn() && target.riskOnConditionsReversed(),
          )
          .forEach((target) => {
            target.goRiskOff()
          })
      }

      getTargets() {
        return this.targets
      }

      addResult(result) {
        this.targets.forEach((target) => target.addResult(result))
      }

      getTotalStrength() {
        return this.targets.reduce(
          (sum, target) => sum + target.getStrength(),
          0,
        )
      }

      getStrengthBelowZeroCount() {
        return this.targets.filter((target) => target.getStrength() < 0).length
      }

      getSupressedTargetCount(targets, strenthThreshold = -1) {
        return targets.filter(
          (target) => target.getStrength() < -strenthThreshold,
        ).length
      }

      supressedTargetsExceedThreshold(
        targets,
        strenthThreshold,
        percentMatchedThreshold,
      ) {
        return (
          this.getSupressedTargetCount(targets, strenthThreshold) /
            targets.length >=
          percentMatchedThreshold
        )
      }

      getTargetsWithStrengthBelowThreshold(strengthThreshold) {
        return this.targets.filter(
          (target) => target.getStrength() < -strengthThreshold,
        )
      }
    }

    // Initialize targets and link them efficiently
    const targets = payouts.map((payout) => new Target(payout, MIN_WAGER))

    targets.forEach((target, index) => {
      if (index > 0) target.setLeftTarget(targets[index - 1])
      if (index < targets.length - 1) target.setRightTarget(targets[index + 1])
    })

    return new RollHandler(targets)
  }

  function initBankRoll(balance, maxLoss) {
    class BankRoll {
      constructor(startBalance, maxLoss) {
        this.startBalance = startBalance
        this.currentBalance = startBalance
        this.maxLoss = -maxLoss;
        this.profitLoss = 0
      }

      getBalance() {
        return this.currentBalance
      }

      increment(profit) {
        this.currentBalance += profit
      }

      decrement(loss) {
        this.currentBalance -= loss
      }

      getPL() {
        return this.currentBalance - this.startBalance
      }

      checkMaxLoss() {
        //console.log("checkMaxLoss", this.getPL(), this.maxLoss, this.getPL() <= this.maxLoss);
        if (this.getPL() <= this.maxLoss) {
            SESSION.stop("Max loss hit", this.getPL())
            return;
        }
      }
    }

    return new BankRoll(100, getMaxLoss())
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
            <input type="number" id="automation-base-wager" value="0.001" />
                  <br/>
            <label>Max Loss</label>
            <input type="number" id="automation-max-loss" value="2" />
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
