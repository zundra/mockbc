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
        }

        addResult = (result) => {
          this.stats.push(result)
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

        exceedsRiskScoreThreshold = (threshold) => {
          if (this.getRollCount() < this.payout * 10) return false
          const riskScore = this.getRiskScore()
          return riskScore < threshold
        }


  getExpectedVsActualHitsUIData() {
    let expected = this.getRollCount() * this.getTeo();
    let actual = this.getRollCount() * this.getTotalWinRate();
    const balance = expected - actual;

    return {
      expected: expected,
      actual: actual,
      rollCount: this.rollCount,
      balance: balance,
      backgroundColor: balance > 1 ? "red" : "transparent"
    };
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
