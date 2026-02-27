function initRollEngine() {
  let rollCount = 0
  let sessionRollCount = 0
  const targets = generateTargets()
  const rollingStats = initRollingStats()
  const highHits = initHighHits()
  const ui = initUI();

  class UI {
    constructor() {}
  }

  class SessionHandler {
    constructor(rollHandler) {
      this.state = {
        stopped: true,
        reason: "",
      }
      this.losingStreak = 0
      this.rollHandler = rollHandler
      this.losingStreakTargetDelta = 0
      this.hitCount = 0
      this.rollMode = ""
      this.stopOnExpectedHits = false
      this.expectedHitsMaxRolls = 0
      this.stopOnMaxRolls = false
      this.payout = 0
      this.wagerRatio = 0
      this.profitLoss = 0
      this.maxRolls = 0
      this.expectedHitsMaxRolls = 0
      this.selectedPayoutLSMultiplier = 0
      this.minPayout = 0
      this.shortLookback = 0
      this.midLookback = 0
      this.longLookback = 0
      this.scoreThreshold = 0
      this.strengthThreshold = 0
      this.stopOnWin = false
    }

    getWinRate() {
      return this.hitCount / this.sessionRollCount
    }

    getTeo() {
      return 1 / (this.payout * 1.05)
    }

    getMean(lookback) {
      return rollingStats.getMean(lookback)
    }

    getMedian(lookback) {
      return rollingStats.getMedian(lookback)
    }

    getVariance(lookback) {
      return rollingStats.getVariance(lookback)
    }

    getStandardDeviation(lookback) {
      return rollingStats.getStandardDeviation(lookback)
    }

    start(rollConfig) {
      this.reset()
      this.setRollConfigVariables(rollConfig)
      this.state.stopped = false
      this.losingStreakTargetDelta = 0
      this.profitLoss = 0
      this.expectedHits = 0
      this.expectedHitsMaxRolls = 0
    }

    reset() {
      this.state.stopped = true
      this.state.reason = ""
      this.sessionRollCount = 0
      this.losingStreak = 0
      this.hitCount = 0
      this.wagerRatio = 1
    }

    isStopped() {
      return this.state.stopped
    }

    getStopReason() {
      return this.state.reason
    }

    isRunning() {
      return !this.isStopped()
    }

    addResult(result, wager, rollConfig, isRiskOn) {
      this.setRollConfigVariables(rollConfig)
      rollingStats.push(result)
      highHits.addResult(result)
      sessionRollCount++
      rollCount++
      targets.forEach((target) => target.addResult(result))

      if (result >= this.payout) {
        this.hitCount++
        this.profitLoss += this.payout * wager - wager
        const diff = this.payout - this.losingStreak
        this.wagerRatio = Math.min(1, 1 - diff / this.payout)
        this.losingStreakTargetDelta = this.payout - this.losingStreak
        this.losingStreak = 0
      } else {
        this.profitLoss -= wager
        this.losingStreak++
        this.wagerRatio = 1
      }

      ui.update();

      this.checkStopOnProfitTarget(result)
      this.checkStopOnHitCount()
      this.checkStopOnMaxRolls()
      this.checkStopOnWatchTarget(result)
      this.checkStopOnExpectedHits()

      if (!isRiskOn) {
        this.checkWindUpHalt()
        this.checkSelectedPayoutLosingStreak()
        this.checkStrengthThreshold()
      }
    }

    setRollConfigVariables(rollConfig) {
      this.watchTarget = rollConfig.watchTarget
      this.payout = rollConfig.payout
      this.maxRolls = rollConfig.maxRolls
      this.hitCountTarget = rollConfig.hitCountTarget
      this.profitTarget = rollConfig.profitTarget
      this.rollMode = rollConfig.rollMode
      this.stopOnExpectedHits = rollConfig.stopOnExpectedHits
      this.selectedPayoutLSMultiplier = rollConfig.selectedPayoutLSMultiplier
      this.minPayout = rollConfig.minPayout
      this.shortLookback = rollConfig.shortLookback
      this.midLookback = rollConfig.midLookback
      this.longLookback = rollConfig.longLookback
      this.scoreThreshold = rollConfig.scoreThreshold
      this.strengthThreshold = rollConfig.strengthThreshold
    }

    checkWindUpHalt() {
      if (!this.isWindUp()) return
      this.stop(`Wind up halt triggered`)
    }

    checkSelectedPayoutLosingStreak() {
      if (this.losingStreak >= this.payout * this.selectedPayoutLSMultiplier) {
        this.stop(
          `Selected payout hit max losing streak multiplier: ${this.losingStreak}`,
          true,
        )
      }
    }

    checkStrengthThreshold() {
      const results = this.getTargetsExceedingStrengthThreshold(
        this.minPayout,
        this.shortLookback,
        this.midLookback,
        this.longLookback,
        -this.strengthThreshold,
      )

      if (results.length !== 0) {
        const names = results.map((t) => t.getPayout()).join(", ")
        const message = `🟡 The following targets exceeded strength threshold:\n\n${names}\n\n🛑 Session halted for review.`
        this.stop(message, true)
      }
    }

    checkScoreThreshold() {
      const results = this.getTargetsExceedingScoreThreshold(
        this.minPayout,
        this.shortLookback,
        this.midLookback,
        this.longLookback,
        this.scoreThreshold,
      )

      if (results.length !== 0) {
        const names = results.map((t) => t.getPayout()).join(", ")
        const message = `🟡 The following targets exceeded win rate score thresholds:\n\n${names}\n\n🛑 Session halted for review.`
        this.stop(message, true)
      }
    }

    checkStopOnExpectedHits() {
      if (this.rollMode !== "expected-hits") return
      const expectedHits =
        (this.getTeo() / 100) * this.expectedHitsMaxRolls * 100

      if (this.stopOnExpectedHits && this.hitCount >= expectedHits) {
        this.stop(
          `Target hit or exceeded expected hits: ${this.hitCount} / ${expectedHits.toFixed(
            2,
          )} over ${this.sessionRollCount} rolls`,
        )
      } else if (this.sessionRollCount >= this.expectedHitsMaxRolls) {
        this.stop(
          `Target hit max rolls during expected hits mode: ${this.hitCount} / ${expectedHits.toFixed(
            2,
          )} over ${this.sessionRollCount} rolls`,
        )
      }
    }

    checkStopOnHitCount() {
      if (this.hitCountTarget === 0) return
      if (this.hitCount < this.hitCountTarget) return

      this.stop(
        `Target ${this.payout} hit ${this.hitCount} times, Delta: (${this.losingStreakTargetDelta})`,
      )
    }

    checkStopOnWatchTarget(result) {
      if (this.watchTarget === 0) return
      if (result < this.watchTarget) return

      this.stop(`Watch target ${this.watchTarget} hit)`)
    }

    checkStopOnMaxRolls() {
      if (this.maxRolls === -1) return
      if (this.sessionRollCount >= this.maxRolls) {
        this.stop(`Stopped on max rolls ${this.sessionRollCount}`)
      }
    }

    checkStopOnProfitTarget() {
      if (this.profitTarget === 0) return
      if (this.profitLoss < this.profitTarget) return

      this.stop(
        `Stopped on profit target Profit Target: ${this.profitTarget}, Profit: ${this.profitLoss.toFixed(5)}`,
      )
    }

    isWindUp() {
      if (rollCount < 100) return false

      const minStableStdDev = 10
      const mean10 = this.getMean(10)
      const mean100 = this.getMean(10)
      const median10 = this.getMedian(10)
      const median100 = this.getMedian(100)
      const median1000 = this.getMedian(1000)
      const stdDev10 = this.getStandardDeviation(10)
      const stdDev100 = this.getStandardDeviation(100)

      return (
        stdDev100 < minStableStdDev && // Environment is not chaotic
        stdDev10 < stdDev100 * 0.75 && // Compression happening
        mean10 < mean100 * 0.75 && // Payout suppression
        mean10 < median10 * 1.25 && // No big outliers skewing mean
        median10 < 1.3 &&
        median100 < 1.5 &&
        median1000 < 1.8
      )
    }

    isWindUpTight() {
      if (rollCount < 100) return false

      const mean10 = this.getMean(10)
      const median10 = this.getMedian(10)
      const stdDev10 = this.getStandardDeviation(10)
      const stdDev100 = this.getStandardDeviation(100)
      const variance10 = this.getVariance(10)

      return (
        stdDev10 < 0.1 &&
        variance10 < 0.5 &&
        mean10 < median10 * 1.25 &&
        median10 < 1.5
      )
    }

    getTargetsExceedingScoreThreshold(
      minPayout,
      shortLookback,
      midLookback,
      longLookback,
      scoreThreshold,
    ) {
      if (rollCount < longLookback) return []
      return targets.filter(
        (target) =>
          target.getPayout() >= minPayout &&
          target.exceedsAllThresholds(
            shortLookback,
            midLookback,
            longLookback,
            scoreThreshold,
          ),
      )
    }

    getTargetsExceedingStrengthThreshold(
      minPayout,
      shortLookback,
      midLookback,
      longLookback,
      threshold,
    ) {
      if (rollCount < longLookback) return []
      return targets.filter(
        (target) =>
          target.getPayout() >= minPayout &&
          target.exceedsStrengthThreshold(
            shortLookback,
            midLookback,
            longLookback,
            threshold,
          ),
      )
    }
    stop(reason = "", notify = false) {
      this.state.reason = reason
      this.state.stopped = true
      console.log(reason)
      $("#message").html(reason)
      document.querySelector(".btn.btn-danger")?.click()
    }
  }

  class RollEngine {
    constructor() {
      this.ui = new UI()
      this.sessionHandler = new SessionHandler()
    }
  }

  function generateTargets() {
    class Stats {
      constructor(size, payout) {
        this.size = size
        this.payout = payout
        this.streak = 0
        this.pstreak = 0
        this.hitCount = 0
        this.losingStreak = 0
        this.streakSignFlipped = 0

        this.buffer = new Array(size).fill(null)
        this.index = 0
        this.count = 0
        this.sum = 0
      }

      push = (result) => {
        rollCount++
        this.updateStreak(result)
        const isHit = result >= this.payout ? 1 : 0

        if (this.count >= this.size) {
          const old = this.buffer[this.index]
          this.sum -= old ?? 0
        } else {
          this.count++
        }

        this.buffer[this.index] = isHit
        this.sum += isHit
        this.index = (this.index + 1) % this.size
      }

      updateStreak = (result) => {
        if (result >= this.payout) {
          this.hitCount++
          if (this.streak < 0) {
            this.streakSignFlipped = true
            this.pstreak = this.streak
          } else {
            this.streakSignFlipped = false
          }
          this.streak = Math.max(this.streak + 1, 1)
        } else {
          if (this.streak > 0) {
            this.streakSignFlipped = true
            this.pstreak = this.streak
          } else {
            this.streakSignFlipped = false
          }
          this.streak = Math.min(this.streak - 1, -1)
        }

        this.losingStreak = this.streak < 0 ? this.streak : 0
      }

      getRate = (lastN = this.count) => {
        const count = Math.min(lastN, this.count)
        if (count === 0) return 0

        let sum = 0
        const start = (this.index - count + this.size) % this.size
        for (let i = 0; i < count; i++) {
          const idx = (start + i + this.size) % this.size
          sum += this.buffer[idx] ?? 0
        }
        return sum / count
      }

      getWinRate = (lookback = 10) => this.getRate(lookback)

      getTeo = () => 1 / (this.getPayout() * 1.05)

      getSum = (lastN = this.count) => {
        const count = Math.min(lastN, this.count)
        if (count === 0) return 0

        let sum = 0
        const start = (this.index - count + this.size) % this.size
        for (let i = 0; i < count; i++) {
          const idx = (start + i + this.size) % this.size
          sum += this.buffer[idx] ?? 0
        }
        return sum
      }

      getDeviation = () => {
        const expectedRate = 1 / this.payout
        return (this.getRate() - expectedRate) * this.count * 100
      }

      reset() {
        rollCount = 0
        sessionRollCount = 0
      }

      getHitCount = () => this.hitCount
      getRollCount = () => rollCount
      getStreak = () => this.streak
      getPreviousStreak = () => this.pstreak
      getLosingStreak = () =>
        this.losingStreak < 0 ? Math.abs(this.losingStreak) : 0
      getStreakSignFlipped = () => this.streakSignFlipped
      getCount = () => this.count
      getPayout = () => this.payout
      getStrength = () => this.getTeo() * this.getStreak()
      getLSRatio = () => Math.floor(this.getLosingStreak() / this.payout)
      getLSRatioAbs = () => Math.abs(this.getLSRatio())
    }

    class Target {
      constructor(payout, lookbackMultipliers = [5, 10, 20]) {
        this.stats = new Stats(Math.ceil(payout * 20), payout)
        this.payout = payout
        this.lookbacks = lookbackMultipliers.map((multiplier) =>
          Math.ceil(payout * multiplier),
        )
      }

      addResult = (result) => {
        this.stats.push(result)
      }

      getTeo = () => this.stats.getTeo()
      getLookbacks = () => this.lookbacks
      getPayout = () => this.stats.getPayout()
      getHitCount = () => this.stats.getHitCount()
      getRollCount = () => this.stats.getRollCount()
      getStreak = () => this.stats.getStreak()
      getPreviousStreak = () => this.stats.getPreviousStreak()
      getLosingStreak = () => this.stats.getLosingStreak()
      getStreakSignFlipped = () => this.stats.getStreakSignFlipped()
      getCount = () => this.stats.getCount()
      getLSRatioAbs = () => this.stats.getLSRatioAbs()
      getLSRatio = () => this.stats.getLSRatio()
      getStrength = () => this.stats.getStrength()
      losingStreakExceedsN = (n) =>
        this.getLSRatioAbs() > n * this.stats.getPayout()

      getWinRatePercentOfTeo = (lookback = 100) => {
        return (this.stats.getWinRate(lookback) / this.getTeo()) * 100
      }

      getWinRateChange = (lookback) => {
        const winRate = this.stats.getWinRate(lookback)
        const teo = this.getTeo()
        return ((winRate - teo) / teo) * 100
      }

      getHitPoolDeviationScoreLookback = (lookback) => {
        const teo = 1 / this.payout
        const windowSize = Math.min(lookback, this.getCount())
        if (windowSize === 0) return 0

        const expected = windowSize * teo
        const actual = this.stats.getSum(windowSize)

        const balance = expected - actual
        const ratio = balance / expected

        const capped = Math.max(-1, Math.min(1, ratio))
        return -capped * 100
      }


      exceedsAllThresholds = (
        shortLookback,
        midLookback,
        longLookback,
        scoreThreshold,
      ) => {
        if (this.getRollCount() < this.payout * 10) return false
        const ls = this.getLSRatioAbs()
        const short = this.getHitPoolDeviationScoreLookback(shortLookback)
        const mid = this.getHitPoolDeviationScoreLookback(midLookback)
        const long = this.getHitPoolDeviationScoreLookback(longLookback)
        const score = ((short + mid + long) / 3) * ls
        return score < -scoreThreshold
      }

      exceedsStrengthThreshold = (
        shortLookback,
        midLookback,
        longLookback,
        threshold,
      ) => {
        if (this.getRollCount() < this.payout * 10) return false
        const ls = this.getLSRatioAbs()
        const short = this.stats.getWinRate(shortLookback)
        const mid = this.stats.getWinRate(midLookback)
        const long = this.stats.getWinRate(longLookback)
        const strength = this.getStrength()
        return short < 90 && mid < 90 && long < 90 && strength < threshold
      }

      getWinRatePercentsOfTeo = () => {
        return this.getLookbacks().map((lookback) =>
          this.getWinRatePercentOfTeo(lookback),
        )
      }
    }
    return generatePayouts().map((payout) => new Target(payout))
  }

  function generatePayouts() {
    return [
      1.01,
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
      ...Array.from({ length: 10 }, (_, k) => 10 + k * 10),
    ]
  }
  return new RollEngine()
}

function getRollConfig() {
  const payout = getPayout()
  const maxRolls = getMaxRolls()
  const hitCountTarget = getHitCountTarget()
  const watchTarget = getWatchTarget()
  const profitTarget = getProfitTarget()
  const selectedPayoutLSMultiplier = getSelectedPayoutLosingStreakMultiplier()
  const minPayout = getMinPayout()
  const shortLookback = getShortLookback()
  const midLookback = getMidLookback()
  const longLookback = getLongLookback()
  const scoreThreshold = getScoreThreshold()
  const strengthThreshold = getStrengthThreshold()

  const rollMode = getRollMode()

  return {
    payout: payout,
    maxRolls: maxRolls,
    hitCountTarget: hitCountTarget,
    profitTarget: profitTarget,
    rollMode: rollMode,
    watchTarget: watchTarget,
    selectedPayoutLSMultiplier: selectedPayoutLSMultiplier,
    minPayout: minPayout,
    shortLookback: shortLookback,
    midLookback: midLookback,
    longLookback: longLookback,
    scoreThreshold: scoreThreshold,
    strengthThreshold: strengthThreshold,
  }
}

function initRollingStats() {
  class RollingStats {
    constructor(size) {
      this.size = size
      this.buffer = new Array(size).fill(null)
      this.index = 0
      this.count = 0
    }

    push = (value) => {
      if (this.count >= this.size) {
        // Overwrite old value
        this.buffer[this.index] = value
      } else {
        this.buffer[this.index] = value
        this.count++
      }

      this.index = (this.index + 1) % this.size
    }

    getValues = (lookback = this.count) => {
      const count = Math.min(lookback, this.count)
      const values = []
      const start = (this.index - count + this.size) % this.size
      for (let i = 0; i < count; i++) {
        const idx = (start + i + this.size) % this.size
        values.push(this.buffer[idx])
      }
      return values
    }

    getMean = (lookback = this.count) => {
      const vals = this.getValues(lookback)
      if (vals.length === 0) return 0
      const sum = vals.reduce((a, b) => a + b, 0)
      return sum / vals.length
    }

    getVariance = (lookback = this.count) => {
      const vals = this.getValues(lookback)
      if (vals.length <= 1) return 0
      const mean = this.getMean(lookback)
      const sumOfSquares = vals.reduce((sum, v) => sum + (v - mean) ** 2, 0)
      return sumOfSquares / (vals.length - 1)
    }

    getStandardDeviation = (lookback = this.count) => {
      return Math.sqrt(this.getVariance(lookback))
    }

    getMedian = (lookback = this.count) => {
      const vals = this.getValues(lookback)
      if (vals.length === 0) return null
      const sorted = [...vals].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid]
    }
  }

  return new RollingStats(10000)
}

function initUI() {
  function getNewWindowHTMLNode(hook) {
    return $(newWindow.document).find(hook)
  }

  class UI {
    update(result) {
      this.updateTable()
      this.updateStats()
    }

    updateTable() {
      const MAX_STRENGTH_BLOCKS = 50
      const MAX_BLOCKS = 15
      const SCALE_FACTOR = 2 // ✅ 2 bars per 1 ratio unit
      const winRateContainer = getNewWindowHTMLNode("#winRateContainer")

      if (!winRateContainer || winRateContainer.length === 0) {
        console.error("Win rate container not found in new window!")
        return
      }

      // Ensure the table structure exists
      let table = winRateContainer.find(".win-rate-table")
      if (table.length === 0) {
        table = $("<table>").addClass("win-rate-table").append("<tbody>")
        winRateContainer.append(table)
      }

      targets.forEach((entry) => {
        const target = entry.getPayout()

        const winRatePercentsOfTeoUIData = entry.getWinRatePercentOfTeoUIData()
        const streakUIData = entry.getStreakUIData()
        const strengthUIData = entry.getStrengthUIData()
        const requiredShortWinRate = entry.getRequiredShortWinRate()

        const strength = strengthUIData.value
        const streak = streakUIData.value
        const riskScore = winRatePercentsOfTeoUIData[0].riskScore

        const winRateChangeShort = winRatePercentsOfTeoUIData[0].pot
        const winRateChangeMed = winRatePercentsOfTeoUIData[1].pot
        const winRateChangeLong = winRatePercentsOfTeoUIData[2].pot

        // const strength = entry.getStrength();

        const sanitizedTarget = `${target}`.replace(/\./g, "_")
        let row = table.find(`#row-${sanitizedTarget}`)

        if (row.length === 0) {
          row = $("<tr>")
            .addClass("win-rate-row")
            .attr("id", `row-${sanitizedTarget}`)

          const targetLabel = $("<td>")
            .addClass("win-rate-label")
            .text(`Target: ${target}`)

          const strengthContainer = $("<td>")
            .addClass("strength-col")
            .text(`${strength.toFixed(2)}`)
            .css({ backgroundColor: strengthUIData.backgroundColor })

          const wrpot0 = $("<span>")
            .addClass("win-rate-pot-0")
            .text(winRatePercentsOfTeoUIData[0].pot.toFixed(2))
            .css({
              backgroundColor: winRatePercentsOfTeoUIData[0].backgroundColor,
            })
          const wrpot1 = $("<span>")
            .addClass("win-rate-pot-1")
            .text(winRatePercentsOfTeoUIData[1].pot.toFixed(2))
            .css({
              backgroundColor: winRatePercentsOfTeoUIData[1].backgroundColor,
            })
          const wrpot2 = $("<span>")
            .addClass("win-rate-pot-2")
            .text(winRatePercentsOfTeoUIData[2].pot.toFixed(2))
            .css({
              backgroundColor: winRatePercentsOfTeoUIData[2].backgroundColor,
            })

          const winRatePercentOfTeoContainer = $("<td>")
            .append(wrpot0)
            .append("<span> | </span>")
            .append(wrpot1)
            .append("<span> | </span>")
            .append(wrpot2)

          const riskScoreContainer = $("<td>")
            .addClass("risk-score-col")
            .text(`${riskScore.toFixed(2)}`)
            .css({
              backgroundColor: winRatePercentsOfTeoUIData[0].riskScoreBGColor,
            })

          const requiredShortWinRateContainer = $("<td>")
            .addClass("required-short-win-rate")
            .text(`${requiredShortWinRate.toFixed(2)}`)
          // .css({ backgroundColor: winRatePercentsOfTeoUIData[0].riskScoreBGColor });

          const blockContainer = $("<td>").addClass("streak-blocks").css({
            display: "flex",
            gap: "2px",
            minWidth: "250px",
          })

          const strengthMeterContainer = $("<td>")
            .addClass("strength-meter")
            .css({
              display: "flex",
              gap: "2px",
              minWidth: "100px",
              minHeight: "14px",
              justifyContent: "flex-start",
            })

          const winRateContainerShort = $("<td>")
            .addClass("win-rate-meter-short")
            .css({
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "120px",
              position: "relative",
            })

          const winRateContainerMed = $("<td>")
            .addClass("win-rate-meter-med")
            .css({
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "120px",
              position: "relative",
            })

          const winRateContainerLong = $("<td>")
            .addClass("win-rate-meter-long")
            .css({
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "120px",
              position: "relative",
            })

          row.append(
            targetLabel,
            strengthContainer,
            blockContainer,
            strengthMeterContainer,
            winRateContainerShort,
            winRateContainerMed,
            winRateContainerLong,
            winRatePercentOfTeoContainer,
            riskScoreContainer,
            requiredShortWinRateContainer,
          )
          table.append(row)
        }

        const blockContainer = row.find(".streak-blocks")
        const strengthContainer = row.find(".strength-col")
        const strengthMeterContainer = row.find(".strength-meter")
        const winRateContainerShort = row.find(".win-rate-meter-short")
        const winRateContainerMed = row.find(".win-rate-meter-med")
        const winRateContainerLong = row.find(".win-rate-meter-long")
        const blocks = blockContainer.find(".streak-block")
        const riskScoreContainer = row.find(".risk-score-col")

        const requiredShortWinRateContainer = row.find(
          ".required-short-win-rate",
        )

        const wrpot0 = row.find(".win-rate-pot-0")
        const wrpot1 = row.find(".win-rate-pot-1")
        const wrpot2 = row.find(".win-rate-pot-2")

        strengthContainer
          .text(`${strength.toFixed(2)}`)
          .css({ backgroundColor: strengthUIData.backgroundColor })

        wrpot0.text(winRateChangeShort.toFixed(2)).css({
          backgroundColor: winRatePercentsOfTeoUIData[0].backgroundColor,
        })
        wrpot1.text(winRateChangeMed.toFixed(2)).css({
          backgroundColor: winRatePercentsOfTeoUIData[1].backgroundColor,
        })
        wrpot2.text(winRateChangeLong.toFixed(2)).css({
          backgroundColor: winRatePercentsOfTeoUIData[2].backgroundColor,
        })

        if (blocks.length >= MAX_BLOCKS) {
          blocks.last().remove()
        }

        const needsNewBlock =
          entry.getStreakSignFlipped() || blocks.length === 0

        riskScoreContainer.text(`${riskScore.toFixed(2)}`).css({
          backgroundColor: winRatePercentsOfTeoUIData[0].riskScoreBGColor,
        })

        requiredShortWinRateContainer.text(`${requiredShortWinRate.toFixed(2)}`)
        //.css({ backgroundColor: winRatePercentsOfTeoUIData[0].riskScoreBGColor });

        if (needsNewBlock) {
          const streakBlock = $("<div>")
            .addClass("streak-block")
            .css({
              backgroundColor: streakUIData.backgroundColor,
              color: streakUIData.foregroundColor,
              padding: "4px",
              margin: "1px",
              borderRadius: "4px",
              textAlign: "center",
              fontSize: "15px",
              fontWeight: "bold",
              minWidth: "30px",
            })
            .text(`${streak}`)

          blockContainer.prepend(streakBlock)
        } else {
          const firstBlock = blocks.first()
          firstBlock
            .css({
              backgroundColor: streakUIData.backgroundColor,
              color: streakUIData.foregroundColor,
            })
            .text(`${streak}`)
        }

        // **Ensure Strength Meter is Cleared and Updated**
        strengthMeterContainer.empty()

        let strengthBars = Math.abs(strength) * SCALE_FACTOR
        let fullBars = Math.floor(strengthBars)
        let fractionalPart = strengthBars - fullBars
        fullBars = Math.min(fullBars, MAX_STRENGTH_BLOCKS)

        // Render full bars
        for (let i = 0; i < fullBars; i++) {
          strengthMeterContainer.append(
            $("<div>")
              .addClass("strength-bar")
              .css({
                width: "8px",
                height: "14px",
                backgroundColor: strength > 0 ? "lightgreen" : "red",
                borderRadius: "2px",
              }),
          )
        }

        // Render the fractional bar (if any)
        if (fractionalPart > 0) {
          strengthMeterContainer.append(
            $("<div>")
              .addClass("strength-bar")
              .css({
                width: `${fractionalPart * 8}px`, // Scale based on remainder
                height: "14px",
                backgroundColor: strength > 0 ? "lightgreen" : "red",
                borderRadius: "2px",
              }),
          )
        }

        this.createWinRateBar(winRateContainerShort, winRateChangeShort)
        this.createWinRateBar(winRateContainerMed, winRateChangeMed)
        this.createWinRateBar(winRateContainerLong, winRateChangeLong)
      })
    }

    updateStats(rollHandler) {
      function setColor(id, value, threshold) {
        let $element = $("#" + id) // Select element with jQuery
        $element.text(value.toFixed(2)) // Update text
        $element.css("color", value < threshold ? "red" : "white") // Apply color conditionally
      }

      const stats10Mean = rollingStats.getMean(10)
      const stats100Mean = rollingStats.getMean(100)
      const stats1000Mean = rollingStats.getMean(1000)

      const stats10variance = rollingStats.getVariance(10)
      const stats100variance = rollingStats.getVariance(100)
      const stats1000variance = rollingStats.getVariance(1000)

      const stats10median = rollingStats.getMedian(10)
      const stats100median = rollingStats.getMedian(100)
      const stats1000median = this.Stats1000.getMedian(1000)

      const stats10StdDev = rollingStats.getStandardDeviation(10)
      const stats100StdDev = rollingStats.getStandardDeviation(100)
      const stats1000StdDev = rollingStats.getStandardDeviation(1000)

      $("#hit-count-roll-count").text(
        `${SESSION.hitCount}/${SESSION.sessionRollCount}`,
      )
      $("#win-rate-teo").text(
        `${SESSION.getWinRate().toFixed(2)}/${SESSION.getTeo().toFixed(2)}`,
      )
      // $("#profit-loss").text(`${SESSION.getPL().toFixed(5)}`);

      $("#mean10").text(stats10Mean.toFixed(2))
      $("#variance10").text(stats10variance.toFixed(2))
      $("#stddev10").text(stats10StdDev.toFixed(2))
      $("#median10").text(stats10median.toFixed(2))

      $("#mean100").text(stats100Mean.toFixed(2))
      $("#variance100").text(stats100variance.toFixed(2))
      $("#stddev100").text(stats100StdDev.toFixed(2))
      $("#median100").text(stats100median.toFixed(2))

      $("#mean1000").text(stats1000Mean.toFixed(2))
      $("#variance1000").text(stats1000variance.toFixed(2))
      $("#stddev1000").text(stats1000StdDev.toFixed(2))
      $("#median1000").text(stats1000median.toFixed(2))

      $("#highHit-hit")
        .text(`${highHits.highHit.hit}`)
        .css({
          backgroundColor:
            highHits.highHit.hitDelta < 0 ? "red" : "transparent",
        })
      $("#highHit-remaining").text(`${highHits.highHit.rollsRemaining}`)
      $("#highHit-delta").text(`${highHits.highHit.hitDelta.toFixed(2)}`)

      $("#highHit50-hit")
        .text(`${highHits.highHit50.hit}`)
        .css({
          backgroundColor:
            highHits.highHit50.hitDelta < 0 ? "red" : "transparent",
        })
      $("#highHit50-remaining").text(`${highHits.highHit50.rollsRemaining}`)
      $("#highHit50-delta").text(`${highHits.highHit50.hitDelta.toFixed(2)}`)

      $("#highHit100-hit")
        .text(`${highHits.highHit100.hit}`)
        .css({
          backgroundColor:
            highHits.highHit100.hitDelta < 0 ? "red" : "transparent",
        })
      $("#highHit100-remaining").text(`${highHits.highHit100.rollsRemaining}`)
      $("#highHit100-delta").text(`${highHits.highHit100.hitDelta.toFixed(2)}`)

      $("#highHit1000-hit")
        .text(`${highHits.highHit1000.hit}`)
        .css({
          backgroundColor:
            highHits.highHit1000.hitDelta < 0 ? "red" : "transparent",
        })
      $("#highHit1000-remaining").text(`${highHits.highHit1000.rollsRemaining}`)
      $("#highHit1000-delta").text(
        `${highHits.highHit1000.hitDelta.toFixed(2)}`,
      )

      $("#highHit10000-hit")
        .text(`${highHits.highHit10000.hit}`)
        .css({
          backgroundColor:
            highHits.highHit10000.hitDelta < 0 ? "red" : "transparent",
        })
      $("#highHit10000-remaining").text(
        `${highHits.highHit10000.rollsRemaining}`,
      )
      $("#highHit10000-delta").text(
        `${highHits.highHit10000.hitDelta.toFixed(2)}`,
      )

      // Last 10 Rolls
      setColor("mean10", stats10Mean, stats100Mean - 1)
      setColor("variance10", stats10variance, 0.5)
      setColor("stddev10", stats10StdDev, 1)
      setColor("median10", stats10Mean, 1.92)

      // Last 100 Rolls
      setColor("mean100", stats100Mean, stats1000Mean - 1)
      setColor("variance100", stats100variance, 0.5)
      setColor("stddev100", stats100StdDev, 1)
      setColor("median100", stats100median, 1.92)

      // Last 1000 Rolls
      setColor("mean1000", stats1000Mean, 1.92)
      setColor("variance1000", stats1000variance, 0.5)
      setColor("stddev1000", stats1000StdDev, 1)
      setColor("median1000", stats1000Mean, 1.92)
    }

    createWinRateBar(winRateContainer, percentOfTeo) {
      winRateContainer.empty()

      const winRateChange = percentOfTeo - 100
      const fullBarWidth = 200
      const halfBarWidth = fullBarWidth / 2
      const fillPct = Math.min(Math.abs(winRateChange), 100) / 100
      const leftWidth = `${fillPct * halfBarWidth}px`
      const rightWidth = `${fillPct * halfBarWidth}px`

      const winRateBar = $("<div>")
        .addClass("win-rate-bar")
        .css({
          position: "relative",
          width: `${fullBarWidth}px`,
          height: "12px",
          background: "rgba(255, 255, 255, 0.1)",
          border: "1px solid rgba(255, 255, 255, 0.3)",
          borderRadius: "4px",
          overflow: "hidden",
          boxShadow: "0 0 5px rgba(0, 255, 0, 0.2)",
        })

      const winRateCenter = $("<div>").addClass("win-rate-bar-center").css({
        position: "absolute",
        left: "50%",
        width: "2px",
        height: "100%",
        background: "#fff",
        transform: "translateX(-50%)",
        boxShadow: "0 0 5px rgba(255, 255, 255, 0.5)",
      })

      const winRateLeft = $("<div>")
        .addClass("win-rate-bar-left")
        .css({
          background: "rgba(255, 0, 0, 0.8)", // 🔴 solid red
          height: "100%",
          position: "absolute",
          right: "50%",
          width: winRateChange < 0 ? leftWidth : "0",
          transition: "width 0.3s ease-in-out",
        })

      const winRateRight = $("<div>")
        .addClass("win-rate-bar-right")
        .css({
          background: "rgba(0, 255, 0, 0.8)", // 🟢 solid green
          height: "100%",
          position: "absolute",
          left: "50%",
          width: winRateChange > 0 ? rightWidth : "0",
          transition: "width 0.3s ease-in-out",
        })

      winRateBar.append(winRateLeft, winRateRight, winRateCenter)
      winRateContainer.append(winRateBar)
    }
  }

  return new UI()
}

function initHighHits() {
  class HighHits {
    constructor() {
      this.rollCount = 0
      this.highHit = 0
      this.round = 0

      this.intervals = [50, 100, 1000, 10000]
      this.data = new Map()

      for (const interval of this.intervals) {
        this.data.set(interval, {
          highHit: 0,
          round: 0,
        })
      }
    }

    addResult(result) {
      this.rollCount++

      // Update global high hit
      if (result > this.highHit) {
        this.highHit = result
        this.round = this.rollCount
      }

      for (const interval of this.intervals) {
        if (this.rollCount % interval === 0) {
          this.data.set(interval, { highHit: 0, round: 0 })
        }

        const entry = this.data.get(interval)
        if (result > entry.highHit) {
          this.data.set(interval, {
            highHit: result,
            round: this.rollCount,
          })
        }
      }
    }

    getResults() {
      const results = {
        highHit: {
          hit: this.highHit,
          round: this.round,
          roundDelta: this.rollCount - this.round,
          hitDelta: this.highHit - (this.rollCount - this.round),
          rollsRemaining: Infinity,
        },
      }

      for (const interval of this.intervals) {
        const { highHit, round } = this.data.get(interval)
        const roundDelta = this.rollCount - round
        const rollsRemaining = Math.max(0, interval - roundDelta)

        results[`highHit${interval}`] = {
          hit: highHit,
          round,
          roundDelta,
          hitDelta: highHit - roundDelta,
          rollsRemaining,
        }
      }

      return results
    }
  }
  return new HighHits()
}

let e = initRollEngine()
e.sessionHandler.addResult(1, 1, getRollConfig(), false)
e.sessionHandler.addResult(3, 1, getRollConfig(), false)
e.sessionHandler.addResult(5, 1, getRollConfig(), false)
e.sessionHandler.addResult(3, 1, getRollConfig(), false)

console.log("mean", e.sessionHandler.getMean())

/* Stubbed for testing */

function getRollMode() {
  return "none"
}
function getWager() {
  return 100
}

function getPayout() {
  return 1.98
}

function getRiskOn() {
  return $("#risk-on").prop("checked")
}

function getStrengthThreshold() {
  return -5000
}

function getHitCountTarget() {
  return 0
}

function getWatchTarget() {
  return 10
}

function getSelectedPayoutLosingStreakMultiplier() {
  return 10
}

function getMaxRolls() {
  return 100000
}

function getProfitTarget() {
  return 10
}

function getMinPayout() {
  return 1.5
}

function getShortLookback() {
  return 5
}

function getMidLookback() {
  return 10
}

function getLongLookback() {
  return 20
}

function getScoreThreshold() {
  return 10
}
/* End stubbed for testing */
