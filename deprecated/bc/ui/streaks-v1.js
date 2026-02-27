/* Start Script */
// ==UserScript==
// @name         bc.game streaks V1
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

  let lastRollSet = []
  let currentRollSet = []
  const rollEngine = initRollEngine()

  let newWindow = null

  function evalResult(result) {
    rollEngine.sessionHandler.addResult(result)
  }

    // Utility function: Get current roll data
    function getCurrentRollData() {
        return $(".grid.grid-auto-flow-column div span")
            .map(function() {
            return $(this).text()
        })
            .get()
    }

  function doInit() {
    observeRollChanges()
    initPrototypes()
  }

  function initDraggable() {
    $(document).ready(function () {
      $("#control-panel").draggable({
        containment: "window",
        scroll: false,
      })

      $("#statsPane").draggable({
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


  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }


  function initRollEngine() {
    let rollCount = 0
    const targets = generateTargets()
    const rollingStats = initRollingStats()
    const ui = initUI(targets, rollingStats)

    class SessionHandler {
      constructor(rollHandler) {
     
      }

      getWinRate() {
        return this.hitCount / this.rollCount
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

      addResult(result) {
        rollCount++;
        targets.forEach((target) => target.addResult(result))
        ui.update()
      }
  }

    class RollEngine {
      constructor() {
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
          if (lastN === Infinity) return this.getTotalWinRate();

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
          this.rollCount = 0
        }

        getTotalWinRate = () => this.hitCount / rollCount;

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
          this.deltaBalance = 0;
        }

        addResult = (result) => {
          this.stats.push(result)
          this.updateDeltaBalance();
        }

        getTeo = () => this.stats.getTeo()
        getLookbacks = () => this.lookbacks
        getShortLookback = () => this.lookbacks[0]
        getMidLookback = () => this.lookbacks[1]
        getLongLookback = () => this.lookbacks[2]

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
        getTotalWinRate = () => this.stats.getTotalWinRate();
        getWinRate = (lookback) => this.stats.getRate(lookback);
        losingStreakExceedsN = (n) => this.getLSRatioAbs() > n * this.stats.getPayout()

 getStrengthScaled = () =>
    this.applyPercentChange(
      this.getStrength(),
      this.averageWinRatePercentOfTeo()
    );

  averageWinRatePercentOfTeo() {
    const data = this.getWinRatePercentsOfTeo();
    const len = data.length;

    return data.reduce((a, b) => a + b, 0) / len;
  }

  applyPercentChange(value, percent) {
    return value * (1 + (100 - percent) / 100);
  }


    applyCompoundChange(value, percent, steps) {
      const factor = 1 + percent / 100;
      return value * Math.pow(factor, steps);
    }

    getStrengthThreshold(threshold) {
      return this.applyCompoundChange(
        threshold,
        this.getWinRatePercentOfTeo(),
        1
      );
    }
        getWinRatePercentsOfTeo = () => {
          const lookbacks = this.getLookbacks().slice();
          lookbacks.push(Infinity)
          return lookbacks.map((lookback) =>
            this.getWinRatePercentOfTeo(lookback),
          )

        }

        getRiskScore () {
        const shortLookback = this.getShortLookback();
        const midLookback = this.getMidLookback();
        const longLookback = this.getLongLookback();
        const shortScore = this.getHitPoolDeviationScoreLookback(shortLookback);
        const midScore = this.getHitPoolDeviationScoreLookback(midLookback);
        const longScore = this.getHitPoolDeviationScoreLookback(longLookback);
        const stdDevScores = [shortScore, midScore, longScore];
        const streak = this.getStreak();
        const scoreAvg = ((shortScore + midScore + longScore) / 3);
        const riskScoreM = (scoreAvg < 0 || streak < 0) ? -1 : 1;
          return riskScoreM * scoreAvg * streak;

        }

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

        exceedsStrengthThreshold = (threshold) => {
          if (this.getRollCount() < this.payout * 10) return false
          const strength = this.getStrengthScaled()
          return strength < threshold
        }

  }


updateDeltaBalance() {
  const expected = this.getTeo(); // per roll
  const actual = this.getLosingStreak() === 0 ? 1 : 0;

  if (!this.deltaBalance) this.deltaBalance = 0;
  this.deltaBalance += expected - actual;
}

getExpectedVsActualHits(lookback) {
  const lb = Math.min(lookback, this.getRollCount());

  const rawExpected = lb * this.getTeo();
  const actual = lb * this.getWinRate(lb);

  const correctedExpected = rawExpected + this.deltaBalance;

  const delta = correctedExpected - actual; // ✅ This is what belongs in the UI

  return {
    expected: correctedExpected,
    actual: actual,
    rollCount: this.rollCount,
    balance: delta,
    backgroundColor: delta > 1 ? "red" : "transparent"
  };
}


  getExpectedVsActualHitsUIData() {
    const lookbacks = this.getLookbacks().slice();
    return lookbacks.map((lookback) =>
        this.getExpectedVsActualHits(lookback),
    )

  }

         getWinRatePercentOfTeoUIData() {
        const winRatePercentsOfTeo = this.getWinRatePercentsOfTeo();
        const riskScore = this.getRiskScore();

       let riskScoreBGColor = "transparent";

        if (riskScore > 100) {
          riskScoreBGColor = "green";
        } else if (riskScore < -100) {
          riskScoreBGColor = "red";
        }

        let idx = 0;

        return winRatePercentsOfTeo.map((wrpot) => {
          return {
            pot: wrpot,
            riskScore: riskScore,
            riskScoreBGColor: riskScoreBGColor,
            foregroundColor: "",
            backgroundColor: wrpot < 70 ? "red" : "transparent"
          };
        });
      }


      getStreakUIData() {
        const streak = this.getStreak();
        const pstreak = this.getPreviousStreak();
        const payout = this.getPayout();
        const good_m = 1.5;
        const bad_m = 3.0;
        const skew_e = 0.75;
        const teo = 1 / payout;
        const evd = (1 - teo) / teo;

        let foregroundColor = "";
        let backgroundColor = "";

        let greenThreshold = Math.max(
          5,
          Math.ceil((evd * good_m) / Math.pow(payout, skew_e))
        );

        let redThreshold = -Math.ceil(evd * bad_m * Math.pow(payout, skew_e));

        if (streak >= greenThreshold) {
          backgroundColor = "green";
        } else if (streak <= redThreshold) {
          backgroundColor = "red";
        } else {
          backgroundColor = "transparent";
        }

        foregroundColor = "white";

        if (backgroundColor === "transparent") {
          if (streak > 0) {
            if (streak + pstreak > payout) {
              foregroundColor = "green";
            } else {
              foregroundColor = "#AAAAAA"
            }

          } else {
            if (Math.abs(streak + pstreak) > payout) {
              foregroundColor = "red";
            } else {
              foregroundColor = "#AAAAAA"
            }
          }
        }

        return {
          value: streak,
          foregroundColor: foregroundColor,
          backgroundColor: backgroundColor
        };
      }

      getStrengthUIData() {
        const strength = this.getStrengthScaled();

        let foregroundColor = "transparent";
        let backgroundColor = "transparent";

        if (strength > 3) {
          backgroundColor = "green";
        } else if (strength < -3) {
          backgroundColor = "red";
        }

        return {
          value: strength,
          foregroundColor: foregroundColor,
          backgroundColor: backgroundColor,
        };
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

  function initUI(targets, rollingStats) {
    function getNewWindowHTMLNode(hook) {
      return $(newWindow.document).find(hook)
    }

    class UI {
      constructor(targets, rollingStats) {
        this.targets = targets;
        this.rollingStats = rollingStats;
      }

      update(result) {
        this.updateTable()
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

        this.targets.forEach((entry) => {
          const target = entry.getPayout()

          const winRatePercentsOfTeoUIData =
            entry.getWinRatePercentOfTeoUIData()
          const streakUIData = entry.getStreakUIData()
          const strengthUIData = entry.getStrengthUIData()

          const strength = strengthUIData.value
          const streak = streakUIData.value
          const riskScore = winRatePercentsOfTeoUIData[0].riskScore

          const winRateChangeShort = winRatePercentsOfTeoUIData[0].pot
          const winRateChangeMed = winRatePercentsOfTeoUIData[1].pot
          const winRateChangeLong = winRatePercentsOfTeoUIData[2].pot
          const winRateChangeTotal = winRatePercentsOfTeoUIData[3].pot

          const expectedVActualHitData = entry.getExpectedVsActualHitsUIData();

          const balanceShort = expectedVActualHitData[0].balance;
          const balanceShortColor = expectedVActualHitData[0].backgroundColor;
          const balanceMid = expectedVActualHitData[1].balance;
          const balanceMidColor = expectedVActualHitData[1].backgroundColor;
          const balanceLong = expectedVActualHitData[2].balance;
          const balanceLongColor = expectedVActualHitData[2].backgroundColor;

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


      const balance0 = $("<span>")
              .addClass("balance-0")
              .text(balanceShort.toFixed(2))
              .css({
                backgroundColor: balanceShortColor,
              })
              
              const balance1 = $("<span>")
              .addClass("balance-1")
              .text(balanceMid.toFixed(2))
              .css({
                backgroundColor: balanceMidColor,
              })

              const balance2 = $("<span>")
              .addClass("balance-2")
              .text(balanceLong.toFixed(2))
              .css({
                backgroundColor: balanceLongColor,
              })

            const balanceContainer = $("<td>")
              .append(balance0)
              .append("<span> | </span>")
              .append(balance1)
              .append("<span> | </span>")
              .append(balance2)

            const riskScoreContainer = $("<td>")
              .addClass("risk-score-col")
              .text(`${riskScore.toFixed(2)}`)
              .css({
                backgroundColor: winRatePercentsOfTeoUIData[0].riskScoreBGColor,
              })

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

            const winRateContainerTotal = $("<td>")
              .addClass("win-rate-meter-total")
              .css({
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "120px",
                position: "relative",
              })

            row.append(
              winRateContainerShort,
              winRateContainerMed,
              winRateContainerLong,
              winRateContainerTotal,
              targetLabel,
              blockContainer,
              strengthMeterContainer,
              strengthContainer,
              riskScoreContainer,
              balanceContainer,
              winRatePercentOfTeoContainer
            )
            table.append(row)
          }

          const blockContainer = row.find(".streak-blocks")
          const strengthContainer = row.find(".strength-col")
          const strengthMeterContainer = row.find(".strength-meter")
          const winRateContainerShort = row.find(".win-rate-meter-short")
          const winRateContainerMed = row.find(".win-rate-meter-med")
          const winRateContainerLong = row.find(".win-rate-meter-long")
          const winRateContainerTotal = row.find(".win-rate-meter-total")
          const blocks = blockContainer.find(".streak-block")
          const riskScoreContainer = row.find(".risk-score-col")

          const wrpot0 = row.find(".win-rate-pot-0")
          const wrpot1 = row.find(".win-rate-pot-1")
          const wrpot2 = row.find(".win-rate-pot-2")
          const wrpot3 = row.find(".win-rate-pot-3")

          const balance0 = row.find(".balance-0")
          const balance1 = row.find(".balance-1")
          const balance2 = row.find(".balance-2")

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

          wrpot3.text(winRateChangeLong.toFixed(2)).css({
            backgroundColor: winRatePercentsOfTeoUIData[3].backgroundColor,
          })

          balance0.text(balanceShort.toFixed(2)).css({
            backgroundColor: balanceShortColor,
          })
          balance1.text(balanceMid.toFixed(2)).css({
            backgroundColor: balanceMidColor,
          })
          balance2.text(balanceLong.toFixed(2)).css({
            backgroundColor: balanceLongColor,
          })

          if (blocks.length >= MAX_BLOCKS) {
            blocks.last().remove()
          }

          const needsNewBlock =
            entry.getStreakSignFlipped() || blocks.length === 0

          riskScoreContainer.text(`${riskScore.toFixed(2)}`).css({
            backgroundColor: winRatePercentsOfTeoUIData[0].riskScoreBGColor,
          })


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
          this.createWinRateBar(winRateContainerTotal, winRateChangeTotal)
        })
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

    return new UI(targets, rollingStats)
  }


  // Utility function: Extract the last roll result

    // Utility function: Extract the last roll result
    function getRollResult() {
        const temp = lastRollSet
        lastRollSet = currentRollSet
        currentRollSet = temp
        currentRollSet.length = 0

        currentRollSet = $(".grid.grid-auto-flow-column div span")
            .map(function() {
            return Number($(this).text().replace("x", ""))
        })
            .get()

        if (arraysAreEqual(currentRollSet, lastRollSet)) {
            return -1
        }

        return currentRollSet[currentRollSet.length - 1]
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

  function getNewWindowHTMLNode(hook) {
    return $(newWindow.document).find(hook)
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

  window.addEventListener("beforeunload", function () {
    if (newWindow && !newWindow.closed) {
      newWindow.close()
    }
  })

  window.addEventListener(
    "load",
    function () {
      ;(function () {
        // Open a new floating window with specified dimensions
        newWindow = window.open("", "", "width=800, height=1200")

        // Define the HTML content for the new window
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
 <head>
   <style>
      body {
      font-family: Arial, sans-serif;
      background-color: #1e2323;
      color: white;
      margin: 0;
      padding: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
      }
      .container {
      height: 100%;
      }
      /* Blocks Section */
      .blocks-wrapper {
      flex: 3;
      overflow-y: auto;
      padding: 10px;
      display: flex;
      flex-direction: column;
      }
      #stateBlockContainer {
      display: flex;
      flex-direction: column;
      gap: 10px;
      }
      .state-block-row {
      display: flex;
      align-items: center;
      gap: 5px;
      }
      .state-block {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      background-color: #444;
      cursor: pointer;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
      }
      .lookback-label {
      font-size: 0.9rem;
      color: #aaa;
      margin-right: 8px;
      }

      .message-box {
      margin-bottom: 10px;
      background-color: #333;
      padding: 10px;
      border-radius: 4px;
      color: white;
      font-size: 0.9rem;
      }
      .stats-block {
      margin-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      padding-bottom: 5px;
      }
      /* Collapsible Panel */
      .panel-wrapper {
      position: absolute;  /* ✅ Sticks it to the right */
      top: 0;
      right: 0;  /* ✅ Ensures it stays attached to the right */
      height: 100vh; /* ✅ Full height */
      width: 300px; /* ✅ Default expanded width */
      background-color: #2a2d2e;
      border-left: 1px solid #444;
      padding: 10px;
      overflow-y: auto;
      transition: width 0.3s ease-in-out; /* ✅ Smooth transition */
      }
      .panel-collapsed {
      width: 0px !important;
      padding: 0;
      overflow: hidden;
      border-left: none; /* ✅ Hides border when collapsed */
      }
      /* ✅ Left Content Fills Available Space */
      .main-content {
      margin-right: 300px; /* ✅ Prevents overlap when panel is open */
      transition: margin-right 0.3s ease-in-out;
      }
      .main-content.panel-collapsed {
      margin-right: 0px; /* ✅ Expands when panel collapses */
      }
      .panel-wrapper.collapsed {
      transform: translateX(100%);
      }
      .panel h2 {
      font-size: 1.2rem;
      margin-bottom: 0.5rem;
      color: #00bcd4;
      }
      .panel label {
      display: block;
      margin-bottom: 5px;
      color: white;
      }
      .panel input,
      .panel select {
      width: 100%;
      margin-bottom: 10px;
      padding: 5px;
      background-color: #333;
      color: white;
      border: 1px solid #555;
      border-radius: 4px;
      }
      .panel button {
      background-color: #555;
      border: none;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      }
      .panel button:hover {
      background-color: #777;
      }
      /* Toggle Button */
      .toggle-panel-button {
      position: fixed;
      top: 10px;
      right: 10px;
      width: 30px;
      height: 30px;
      background-color: #00bcd4;
      border: none;
      color: white;
      border-radius: 50%;
      cursor: pointer;
      font-size: 1.2rem;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1001;
      }
      .toggle-panel-button:hover {
      background-color: #0097a7;
      }
      .win-rate-table {
      width: 100%;
      border-collapse: collapse;
      border: none; /* ✅ Removes the ugly gray border */
      }
      .win-rate-row td {
      padding: 4px;
      vertical-align: middle;
      border: none; /* ✅ Removes individual cell borders */
      }
      .streak-blocks {
      display: flex;
      gap: 2px;
      }
      .strength-meter {
      display: flex;
      gap: 2px;

      min-height: 14px;
      justify-content: flex-start;
      }
      .strength-bar {
      width: 8px;
      height: 14px;
      border-radius: 2px;
      }
   </style>
</head>
<body>
   <div class="container">
      <!-- Blocks Section -->
      <div id="winRateContainer">
         <table class="win-rate-table">
            <tbody>
            </tbody>
         </table>
      </div>
   </div>
   </div>
</body>
</html>
`

        // Write the content to the new window
        newWindow.document.write(htmlContent)
        newWindow.document.close()
      })()

      ();
    },
    false,
  )
  doInit()
})()


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
