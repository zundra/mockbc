var config = {
    wager: {
        label: "Wager",
        type: "balance",
        value: 100
    },
    min_payout: {
        label: "Min Payout",
        type: "multiplier",
        value: 3        
    },
    short_lookback: {
        label: "Short Lookback",
        type: "multiplier",
        value: 5       
    },
    mid_lookback: {
        label: "Mid Lookback",
        type: "multiplier",
        value: 10       
    },
    long_lookback: {
        label: "Long Lookback",
        type: "multiplier",
        value: 20        
    },
    score_threshold: {
        label: "Score Threshold",
        type: "multiplier",
        value: 500        
    }
};


        Array.prototype.last = function() {
            return this[this.length - 1];
        };
        Array.prototype.first = function() {
            return this[0];
        };

        Array.prototype.median = function() {
            if (this.length === 0) return null; // Handle empty array case

            const medianIndex = Math.floor((this.length - 1) / 2); // Get the median index
            return this[medianIndex]; // Return the median element
        };

let bet = null;
 let lastRollSet = []
  let currentRollSet = []
  const ROLL_HANDLER = initRollHandler()
  const SESSION = defaultSession(ROLL_HANDLER, this)
  SESSION.start(getRollConfig())

while (true) {
    bet = await doRoll(this);

    const result = bet.multiplier;

    evalResult(result);
}

 function evalResult(result) {
    ROLL_HANDLER.addResult(result)
    SESSION.addRoll(result, getWager(), getRollConfig())
  }

function getWager() {
    return config.wager.value;
}

async function doRoll(ctx) {
   if (SESSION.riskOnTarget) {
      return await doLiveRoll(ctx);
   }
    
   return await doSimRoll(ctx);
}

async function doLiveRoll(ctx) {
    return await ctx.bet(100, SESSION.riskOnTarget.getPayout());
}

async function doSimRoll(ctx) {
    if (SESSION.globalRollCount % 2 === 0) 
    {
        return ctx.bet(100, 1.01)
    } 
    
    const result = ctx.skip();
    return result;
}


async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

  function getRollConfig() {
    const minPayout = getMinPayout()
    const shortLookback = getShortLookback()
    const midLookback = getMidLookback()
    const longLookback = getLongLookback()
    const scoreThreshold = getScoreThreshold();

    return {
      minPayout: minPayout,
      shortLookback: shortLookback,
      midLookback: midLookback,
      longLookback: longLookback,
      scoreThreshold: scoreThreshold,
    }
  }

  function getMinPayout() {
    return config.min_payout.value;
  }

  function getShortLookback() {
    return config.short_lookback.value;
  }

  function getMidLookback() {
    return config.mid_lookback.value;
  }

  function getLongLookback() {
    return config.long_lookback.value;
  }

  function getScoreThreshold() {
    return config.score_threshold.value;
  }

  function initRollHandler() {
    const payouts = getPayouts()

    class RollingWindow {
      constructor(size, payout) {
        this.size = size
        this.payout = payout
        this.buffer = new Array(size).fill(null)
        this.index = 0
        this.count = 0
        this.sum = 0
      }

      push(result) {
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

      getRate(lastN = this.count) {
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

      getDeviation() {
        const expectedRate = 1 / this.payout
        return (this.getRate() - expectedRate) * this.count * 100
      }

    getSum(lastN = this.count) {
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
      getCount() {
        return this.count
      }
    }

function getPayouts() {
  const round = (n) => Math.round(n * 100) / 100;
  const payouts = [];

  // // 1.1 to 2.0 (step 0.05) → 19 values
  // for (let p = 1.1; p <= 2.0; p += 0.05) {
  //   payouts.push(round(p));
  // }

  // // 2.0 to 5.0 (step 0.1) → 31 values
  // for (let p = 2.1; p <= 5.0; p += 0.1) {
  //   payouts.push(round(p));
  // }

  // 5.0 to 10.0 (step 0.25) → 21 values
  for (let p = 5.25; p <= 10.0; p += 0.25) {
    payouts.push(round(p));
  }

  // // 10 to 100 (step 5) → 19 values
  // for (let p = 15; p <= 100; p += 5) {
  //   payouts.push(round(p));
  // }

  return payouts;
}


    class Target {
      constructor(payout) {
        this.rollingWindow = new RollingWindow(Math.ceil(payout * 20), payout)
        this.payout = payout
        this.losingStreak = 0
        this.winStreak = 0;
        this.hitCount = 0
        this.rollCount = 0
      }

      addResult(result) {
        this.rollingWindow.push(result);

        if (result >= this.payout) {
          this.losingStreak = 0;
        } else {
          this.losingStreak++;
        }
      }

      getPayout() {
        return this.payout
      }

      isWinRateBelowTeo(lookback, threshold) {
        return this.getWinRatePercentOfTeo(lookback) < threshold
      }

      isWinRateChangeBelow(lookback, threshold) {
        return this.getWinRateChange(lookback) < -threshold
      }

      getWinRateChange(lookback) {
        const winRate = this.getWinRate(lookback)
        const teo = this.getTeo()
        return ((winRate - teo) / teo) * 100
      }

       getWeightedStreak(options = {}) {
        const streak = this.getStreak();
        const payout = this.getPayout();

  const base = options.logBase || 2;

  const normalized = streak / payout; // preserve sign
  const smoothed =
    base === Math.E
      ? Math.log(1 + Math.abs(normalized))
      : Math.log(1 + Math.abs(normalized)) / Math.log(base);
      const value = (normalized >= 0 ? smoothed : -smoothed);
      return parseFloat(value.toFixed(2));
}

    getStreak() {
        return this.losingStreak > 1 ? -this.losingStreak : this.winStreak;
    }
       getStrength() {
        const streak = this.getStreak();
        return Math.ceil(this.payout + streak) / this.payout
       }

      isWinRateAboveTeo(lookback, threshold) {
        return this.getWinRatePercentOfTeo(lookback) > threshold
      }

      exceedsAllThresholds(
        shortLookback,
        midLookback,
        longLookback,
        scoreThreshold,
      ) {
        if (ROLL_HANDLER.rollCount < this.payout * 10) return false
          const ls = this.getLSRatioAbs();
          const short = this.getHitPoolDeviationScoreLookback(shortLookback);
          const mid = this.getHitPoolDeviationScoreLookback(midLookback);
          const long = this.getHitPoolDeviationScoreLookback(longLookback)
          const score = ((short + mid + long) / 3) * ls;
          return score < -scoreThreshold;
      }

      exceedsScoreStrengthThreshold(
        shortLookback,
        midLookback,
        longLookback,
        scoreThreshold,
      ) {
        if (ROLL_HANDLER.rollCount < this.payout * 10) return false
          const ls = this.getLSRatioAbs();
          const short = this.getHitPoolDeviationScoreLookback(shortLookback);
          const mid = this.getHitPoolDeviationScoreLookback(midLookback);
          const long = this.getHitPoolDeviationScoreLookback(longLookback)
          const score = ((short + mid + long) / 3) * ls;
          const strength = this.getStrength();

          return score < -400 && this.getStrength()  -4
      }

      getWinStreak() {
        return this.winStreak;
      }

      getLosingStreak() {
        return this.losingStreak;
      }

      losingStreakExceedsN(n) {
        return this.getLSRatioAbs() > n * this.getPayout()
      }

      getLSRatio() {
        return Math.floor(this.getLosingStreak() / this.payout)
      }

      getLSRatioAbs() {
        return Math.abs(this.getLSRatio())
      }

      getWinRatePercentOfTeo(lookback = 100) {
        return (this.getWinRate(lookback) / this.getTeo()) * 100
      }

      getWinRate(lookback = 10) {
        return this.rollingWindow.getRate()
      }

    getHitPoolDeviationScoreLookback(lookbackMultiplier = 500) {
      const lookback = Math.ceil(this.getPayout() * lookbackMultiplier)
      const teo = 1 / this.payout

      const windowSize = Math.min(lookback, this.rollingWindow.getCount())
      if (windowSize === 0) return 0

      const expected = windowSize * teo
      const actual = this.rollingWindow.getSum(windowSize) // actual hits over that window

      const balance = expected - actual
      const ratio = balance / expected

      const capped = Math.max(-1, Math.min(1, ratio)) // clamp to [-1, +1]
      return -capped * 100
    }

      getHitCount() {
        return this.hitCount
      }

      getTeoPercent(target) {
        return this.getTeo() * 100
      }

      getTeo() {
        return 1 / (this.payout * 1.01)
      }

    }

  function RollingStats(windowSize) {
    this.windowSize = windowSize
    this.values = [] // Store last N values
    this.mean = 0
    this.sumOfSquares = 0

    this.addValue = function (value) {
      this.values.push(value)

      if (this.values.length > this.windowSize) {
        let removed = this.values.shift() // Remove oldest value
        this.updateStats(-removed, removed) // Subtract old value from stats
      }

      this.updateStats(value, null) // Add new value to stats
    }

    this.updateStats = function (value, removed) {
      let count = this.values.length

      // Update Mean
      let oldMean = this.mean
      this.mean = this.values.reduce((sum, v) => sum + v, 0) / count

      // Update Variance (numerically stable formula)
      this.sumOfSquares = this.values.reduce(
        (sum, v) => sum + (v - this.mean) ** 2,
        0,
      )
    }

    this.getMean = function () {
      return this.mean
    }

    this.getVariance = function () {
      let count = this.values.length
      return count > 1 ? this.sumOfSquares / (count - 1) : 0
    }

    this.getStandardDeviation = function () {
      return Math.sqrt(this.getVariance())
    }

    this.getMedian = function () {
      if (this.values.length === 0) return null
      let sorted = [...this.values].sort((a, b) => a - b)
      let mid = Math.floor(sorted.length / 2)

      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid]
    }
  }


    class RollHandler {
      constructor(targets) {
        this.Stats10 = new RollingStats(10)
        this.Stats100 = new RollingStats(100)
        this.Stats1000 = new RollingStats(1000)

        this.targets = targets
        this.microTargets = this.targets.filter(
          (target) => target.getPayout() < 1.7,
        )
        this.lowTargets = this.targets.filter(
          (target) => target.getPayout() < 3,
        )
        this.midTargets = this.targets.filter(
          (target) => target.getPayout() >= 3 && target.getPayout() < 10,
        )
        this.highTargets = this.targets.filter(
          (target) => target.getPayout() >= 10,
        )
        this.rollCount = 0;
      }

      getTargets() {
        return this.targets
      }

      getMicroTargets() {
        return this.microTargets
      }

      isMicroTargetsPullBack() {
        return (
          this.getMicroTargets().filter((target) =>
            target.losingStreakExceedsN(1),
          ).length > 0
        )
      }

    isWindUp() {
        if (this.rollCount < 100) return false

        const minStableStdDev = 10
        const mean10 = this.Stats10.getMean()
        const mean100 = this.Stats100.getMean()
        const median10 = this.Stats10.getMedian()
        const median100 = this.Stats100.getMedian()
        const median1000 = this.Stats1000.getMedian()
        const stdDev10 = this.Stats10.getStandardDeviation()
        const stdDev100 = this.Stats100.getStandardDeviation()

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
        if (this.rollCount < 100) return false

        const mean10 = this.Stats10.getMean()
        const median10 = this.Stats10.getMedian()
        const stdDev10 = this.Stats10.getStandardDeviation()
        const stdDev100 = this.Stats100.getStandardDeviation()
        const variance10 = this.Stats10.getVariance()

        return (
          stdDev10 < 0.1 &&
          variance10 < 0.5 &&
          mean10 < median10 * 1.25 &&
          median10 < 1.5
        )
      }

      getTargetsExceedingWeighedStreak(
        minPayout,
        threshold
      ) {

        return this.targets.filter(
          (target) => {
            
            return target.getPayout() >= minPayout &&
            target.getWeightedStreak() <= threshold
        }
        )
      }

      getTargetsExceedingScoreThreshold(
        minPayout,
        shortLookback,
        midLookback,
        longLookback,
        scoreThreshold
      ) {
        if (ROLL_HANDLER.rollCount < longLookback) return []
        return this.targets.filter(
          (target) =>
            target.getPayout() >= minPayout &&
            target.exceedsAllThresholds(
              shortLookback,
              midLookback,
              longLookback,
              scoreThreshold
            ),
        )
      }

      getTargetsExceedingScoreStrengthThreshold(
        minPayout,
        shortLookback,
        midLookback,
        longLookback,
        scoreThreshold
      ) {
        if (ROLL_HANDLER.rollCount < longLookback) return []
        return this.targets.filter(
          (target) =>
            target.getPayout() >= minPayout &&
            target.exceedsScoreStrengthThreshold(
              shortLookback,
              midLookback,
              longLookback,
              scoreThreshold
            ),
        )
      }

      addResult(result) {
        this.rollCount++
        this.targets.forEach((target) => {
          target.addResult(result)
        })

        this.Stats10.addValue(result)
        this.Stats100.addValue(result)
        this.Stats1000.addValue(result)
      }
    }

    // Initialize targets and link them efficiently
    const targets = payouts.map((payout) => new Target(payout))

    return new RollHandler(targets)
  }

  function defaultSession(rollHandler, ctx) {
    return {
      state: {
        stopped: true,
        reason: ""
      },
      ctx: ctx,
      riskOnTarget: null,
      losingStreak: 0,
      rollHandler: rollHandler,
      sessionRollCount: 0,
      globalRollCount: 0,
      payout: 0,
      profitLoss: 0,
      minPayout: 0,
      shortLookback: 0,
      midLookback: 0,
      longLookback: 0,
      scoreThreshold: 0,
      getPL() {
        return this.profitLoss
      },
      getGlobalRollCount: function () {
        return this.globalRollCount
      },
      getSessionRollCount: function () {
        return this.sessionRollCount
      },
      start: function (rollConfig) {
        this.setRollConfigVariables(rollConfig)
        this.profitLoss = 0
      },
      addRoll: function (result, wager, rollConfig) {
        this.setRollConfigVariables(rollConfig)

        this.sessionRollCount++
        this.globalRollCount++

        if (result >= this.payout) {
          this.hitCount++
          this.profitLoss += this.payout * wager - wager
          this.losingStreak = 0
          this.winStreak++;
        } else {
          this.winStreak = 0;
          this.profitLoss -= wager
          this.losingStreak++
        }

        if (!this.riskOnTarget) {
            this.evalRiskOff();
        } else {
            this.evalRiskOn(result);
        }

      },
      evalRiskOff() {
        // this.checkWindUpHalt();
        // this.checkSelectedPayoutLosingStreak()
        // this.checkScoreThreshold()
        // this.checkScoreStrengthThreshold()
        this.checkWeightedStreak()
      },
      evalRiskOn(result) {
       if (result >= this.riskOnTarget.getPayout()) {
          this.goRiskOff(`Target hit ${this.riskOnTarget.getPayout}`);
       }
      },

      setRollConfigVariables(rollConfig) {
        this.payout = rollConfig.payout
        this.profitTarget = rollConfig.profitTarget
        this.minPayout = rollConfig.minPayout
        this.shortLookback = rollConfig.shortLookback
        this.midLookback = rollConfig.midLookback
        this.longLookback = rollConfig.longLookback
        this.scoreThreshold = rollConfig.scoreThreshold
      },

      checkWeightedStreak() {
        const targets = rollHandler.getTargetsExceedingWeighedStreak(this.minPayout, -1)

        if (targets.length != 0) {
          const riskOnTarget = targets.first();
          const message = `🛑 Going risk on with target ${riskOnTarget.getPayout()} due to exceeding weighed streak threshold`

          this.goRiskOn(riskOnTarget, message)
          return
        }
      },

      checkScoreThreshold() {
        const targets = rollHandler.getTargetsExceedingScoreThreshold(
          this.minPayout,
          this.shortLookback,
          this.midLookback,
          this.longLookback,
          this.scoreThreshold
        )

        if (targets.length != 0) {
          const names = targets.map((t) => t.getPayout()).join(", ")
          const message = `🛑 The following targets exceeded win rate score threshold:\n\n${names}.`

          this.stop(message, true)
          return
        }
      },
      checkScoreStrengthThreshold() {
        const targets = rollHandler.getTargetsExceedingScoreStrengthThreshold(
          this.minPayout,
          this.shortLookback,
          this.midLookback,
          this.longLookback,
          this.scoreThreshold
        )

        if (targets.length != 0) {
          const names = targets.map((t) => t.getPayout()).join(", ")
          const message = `🛑 The following targets exceeded win rate score / strength threshold:\n\n${names}.`

          this.stop(message, true)
          return
        }
      },

      goRiskOn(riskOnTarget, reason) {
        this.riskOnTarget = riskOnTarget;
        this.ctx.notify(reason);
      },

      goRiskOff(reason) {
        this.riskOnTarget = null;
        this.ctx.notify(reason);
      }
    }
  }





