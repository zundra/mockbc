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
  strength_threshold: {
    label: "Strength Threshold",
    type: "multiplier",
    value: 3
  }
};

Array.prototype.last = function () {
  return this[this.length - 1];
};
Array.prototype.first = function () {
  return this[0];
};

Array.prototype.median = function () {
  if (this.length === 0) return null; // Handle empty array case

  const medianIndex = Math.floor((this.length - 1) / 2); // Get the median index
  return this[medianIndex]; // Return the median element
};

let bet = null;
let lastRollSet = [];
let currentRollSet = [];
const ROLL_HANDLER = initRollHandler();
const SESSION = defaultSession(ROLL_HANDLER, this);
SESSION.start(getRollConfig());

while (true) {
  bet = await doRoll(this);

  const result = bet.multiplier;

  evalResult(result);
}

function evalResult(result) {
  ROLL_HANDLER.addResult(result);
  SESSION.addRoll(result, getWager(), getRollConfig());
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
//  return await ctx.bet(100, SESSION.riskOnTarget.getPayout());
  return doSimRoll(ctx);
}

async function doSimRoll(ctx) {
  if (SESSION.globalRollCount % 2 === 0) {
    return ctx.bet(100, 1.01);
  }

  const result = ctx.skip();
  return result;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRollConfig() {
  const minPayout = getMinPayout();
  const shortLookback = getShortLookback();
  const midLookback = getMidLookback();
  const longLookback = getLongLookback();
  const strengthThreshold = getStrengthThreshold();

  return {
    minPayout: minPayout,
    shortLookback: shortLookback,
    midLookback: midLookback,
    longLookback: longLookback,
    strengthThreshold: strengthThreshold
  };
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


  function getStrengthThreshold() {
    return config.strength_threshold.value;
  }

function initRollHandler() {
  const payouts = [
    ...[1.5, 1.6, 1.7, 1.8, 1.9, 2, 3, 4, 5, 6, 7, 8, 9],
    ...Array.from(
      {
        length: 10
      },
      (v, k) => 10 + k * 10
    )
  ];

  class RollingWindow {
    constructor(size, payout) {
      this.size = size;
      this.payout = payout;
      this.buffer = new Array(size).fill(null);
      this.index = 0;
      this.count = 0;
      this.sum = 0;
    }

    push(result) {
      const isHit = result >= this.payout ? 1 : 0;

      if (this.count >= this.size) {
        const old = this.buffer[this.index];
        this.sum -= old ?? 0;
      } else {
        this.count++;
      }

      this.buffer[this.index] = isHit;
      this.sum += isHit;
      this.index = (this.index + 1) % this.size;
    }

    getRate(lastN = this.count) {
      const count = Math.min(lastN, this.count);
      if (count === 0) return 0;

      let sum = 0;
      const start = (this.index - count + this.size) % this.size;
      for (let i = 0; i < count; i++) {
        const idx = (start + i + this.size) % this.size;
        sum += this.buffer[idx] ?? 0;
      }
      return sum / count;
    }

    getDeviation() {
      const expectedRate = 1 / this.payout;
      return (this.getRate() - expectedRate) * this.count * 100;
    }

    getSum(lastN = this.count) {
      const count = Math.min(lastN, this.count);
      if (count === 0) return 0;

      let sum = 0;
      const start = (this.index - count + this.size) % this.size;
      for (let i = 0; i < count; i++) {
        const idx = (start + i + this.size) % this.size;
        sum += this.buffer[idx] ?? 0;
      }
      return sum;
    }
    getCount() {
      return this.count;
    }
  }

  function RollingStats(windowSize) {
    this.windowSize = windowSize;
    this.values = []; // Store last N values
    this.mean = 0;
    this.sumOfSquares = 0;

    this.addValue = function (value) {
      this.values.push(value);

      if (this.values.length > this.windowSize) {
        let removed = this.values.shift(); // Remove oldest value
        this.updateStats(-removed, removed); // Subtract old value from stats
      }

      this.updateStats(value, null); // Add new value to stats
    };

    this.updateStats = function (value, removed) {
      let count = this.values.length;

      // Update Mean
      let oldMean = this.mean;
      this.mean = this.values.reduce((sum, v) => sum + v, 0) / count;

      // Update Variance (numerically stable formula)
      this.sumOfSquares = this.values.reduce(
        (sum, v) => sum + (v - this.mean) ** 2,
        0
      );
    };

    this.getMean = function () {
      return this.mean;
    };

    this.getVariance = function () {
      let count = this.values.length;
      return count > 1 ? this.sumOfSquares / (count - 1) : 0;
    };

    this.getStandardDeviation = function () {
      return Math.sqrt(this.getVariance());
    };

    this.getMedian = function () {
      if (this.values.length === 0) return null;
      let sorted = [...this.values].sort((a, b) => a - b);
      let mid = Math.floor(sorted.length / 2);

      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    };
  }
  class HighHits {
    constructor() {
      this.rollCount = 0;
      this.highHit = 0;
      this.round = 0;

      this.intervals = [50, 100, 1000, 10000];
      this.data = new Map();

      for (const interval of this.intervals) {
        this.data.set(interval, {
          highHit: 0,
          round: 0
        });
      }
    }

    addResult(result) {
      this.rollCount++;

      // Update global high hit
      if (result > this.highHit) {
        this.highHit = result;
        this.round = this.rollCount;
      }

      for (const interval of this.intervals) {
        if (this.rollCount % interval === 0) {
          this.data.set(interval, { highHit: 0, round: 0 });
        }

        const entry = this.data.get(interval);
        if (result > entry.highHit) {
          this.data.set(interval, {
            highHit: result,
            round: this.rollCount
          });
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
          rollsRemaining: Infinity
        }
      };

      for (const interval of this.intervals) {
        const { highHit, round } = this.data.get(interval);
        const roundDelta = this.rollCount - round;
        const rollsRemaining = Math.max(0, interval - roundDelta);

        results[`highHit${interval}`] = {
          hit: highHit,
          round,
          roundDelta,
          hitDelta: highHit - roundDelta,
          rollsRemaining
        };
      }

      return results;
    }
  }

  class Target {
    constructor(payout) {
      this.rollingWindow = new RollingWindow(Math.ceil(payout * 20), payout);
      this.payout = payout;
      this.losingStreak = 0;
      this.hitCount = 0;
      this.rollCount = 0;
      this.balance = 0;
      this.streak = 0;
      this.pstreak = 0;
      this.hitCount = 0;
      this.streakSignFlipped = false;
    }

    addResult(result) {
      this.rollingWindow.push(result);

      this.updateStreak(result);
    }

    updateStreak(result) {
      if (result >= this.payout) {
        this.hitCount++;
        this.balance += 1;

        if (this.streak < 0) {
          this.streakSignFlipped = true;
          this.pstreak = this.streak;
        } else {
          this.streakSignFlipped = false;
        }
        this.streak = Math.max(this.streak + 1, 1);
      } else {
        this.balance -= 1;
        if (this.streak > 0) {
          this.streakSignFlipped = true;
          this.pstreak = this.streak;
        } else {
          this.streakSignFlipped = false;
        }
        this.streak = Math.min(this.streak - 1, -1);
      }
    }

    getStreak() {
      return this.streak;
    }

    getPayout() {
      return this.payout;
    }

    getRiskScore(short, mid, long) {
      return ((short + mid + long) / 3) * this.getLSRatioAbs();
    }

    isWinRateBelowTeo(lookback, threshold) {
      return this.getWinRatePercentOfTeo(lookback) < threshold;
    }

    isWinRateChangeBelow(lookback, threshold) {
      return this.getWinRateChange(lookback) < -threshold;
    }

    getWinRateChange(lookback) {
      const winRate = this.getWinRate(lookback);
      const teo = this.getTeo();
      return ((winRate - teo) / teo) * 100;
    }

    isWinRateAboveTeo(lookback, threshold) {
      return this.getWinRatePercentOfTeo(lookback) > threshold;
    }

    exceedsStrengthThreshold(
      shortLookback,
      midLookback,
      longLookback,
      threshold
    ) {
      if (ROLL_HANDLER.rollCount < this.payout * 10) return false;
      const ls = this.getLSRatioAbs();
      const short = this.getWinRate(shortLookback);
      const mid = this.getWinRate(midLookback);
      const long = this.getWinRate(longLookback);
      const strength = this.getStrength();

      return short < 90 && mid < 90 && long < 90 && strength < threshold;
    }

    getStreakSignFlipped() {
      return this.streakSignFlipped;
    }

    getStrength() {
      return this.getTeo() * this.getStreak();
    }

    getLosingStreak() {
      if (this.streak > 0) return 0;
      return Math.abs(this.streak);
    }

    losingStreakExceedsN(n) {
      return this.getLSRatioAbs() > n * this.getPayout();
    }

    getLSRatio() {
      return Math.floor(this.getLosingStreak() / this.payout);
    }

    getLSRatioAbs() {
      return Math.abs(this.getLSRatio());
    }

    getWinRatePercentOfTeo(lookback = 100) {
      return (this.getWinRate(lookback) / this.getTeo()) * 100;
    }

    getTotalWinRate() {
      return this.hitCount / ROLL_HANDLER.rollCount;
    }

    getWinRate(lookback = 10) {
      return this.rollingWindow.getRate();
    }

    getHitPoolDeviationScoreLookback(lookbackMultiplier = 500) {
      const lookback = Math.ceil(this.getPayout() * lookbackMultiplier);
      const teo = 1 / this.payout;

      const windowSize = Math.min(lookback, this.rollingWindow.getCount());
      if (windowSize === 0) return 0;

      const expected = windowSize * teo;
      const actual = this.rollingWindow.getSum(windowSize); // actual hits over that window

      const balance = expected - actual;
      const ratio = balance / expected;

      const capped = Math.max(-1, Math.min(1, ratio)); // clamp to [-1, +1]
      return -capped * 100;
    }

    getHitCount() {
      return this.hitCount;
    }

    getTeoPercent(target) {
      return this.getTeo() * 100;
    }

    getTeo() {
      return 1 / (this.payout * 1.05);
    }
  }

  class RollHandler {
    constructor(targets) {
      this.Stats10 = new RollingStats(10);
      this.Stats100 = new RollingStats(100);
      this.Stats1000 = new RollingStats(1000);

      this.targets = targets;
      this.microTargets = this.targets.filter(
        (target) => target.getPayout() < 1.7
      );
      this.lowTargets = this.targets.filter((target) => target.getPayout() < 3);
      this.midTargets = this.targets.filter(
        (target) => target.getPayout() >= 3 && target.getPayout() < 10
      );
      this.highTargets = this.targets.filter(
        (target) => target.getPayout() >= 10
      );
      this.highHits = new HighHits();
      this.rollCount = 0;
    }

    getTargets() {
      return this.targets;
    }

    getTargetsExceedingStrengthThreshold(
      minPayout,
      shortLookback,
      midLookback,
      longLookback,
      threshold
    ) {
      if (ROLL_HANDLER.rollCount < longLookback) return [];
      return this.targets.filter(
        (target) =>
          target.getPayout() >= minPayout &&
          target.exceedsStrengthThreshold(
            shortLookback,
            midLookback,
            longLookback,
            threshold
          )
      );
    }

    addResult(result) {
      this.rollCount++;
      this.highHits.addResult(result);
      this.targets.forEach((target) => {
        target.addResult(result);
      });

      this.Stats10.addValue(result);
      this.Stats100.addValue(result);
      this.Stats1000.addValue(result);
    }
  }

  // Initialize targets and link them efficiently
  const targets = payouts.map((payout) => new Target(payout));

  return new RollHandler(targets);
}

function defaultSession(rollHandler, ctx) {
  return {
    state: {
      stopped: true,
      reason: ""
    },
    riskOnTarget: null,
    ctx: ctx,
    riskOnRollCount: 0,
    losingStreak: 0,
    rollHandler: rollHandler,
    hitCount: 0,
    globalRollCount: 0,
    stopOnExpectedHits: false,
    expectedHitsMaxRolls: 0,
    stopOnMaxRolls: false,
    payout: 0,
    wager: 0,
    profitLoss: 0,
    maxRolls: 0,
    expectedHitsMaxRolls: 0,
    minPayout: 0,
    shortLookback: 0,
    midLookback: 0,
    longLookback: 0,
    strengthThreshold: 0,
    getWinRate() {
      return this.hitCount / this.riskOnRollCount;
    },
    getTeo() {
      return 1 / (this.payout * 1.01);
    },
    getPL() {
      return this.profitLoss;
    },
    getWinRate() {
      return this.hitCount / this.riskOnRollCount;
    },
    getGlobalRollCount: function () {
      return this.globalRollCount;
    },
    getRiskOnRollCount: function () {
      return this.riskOnRollCount;
    },
    start: function (rollConfig) {
      this.reset();
      this.setRollConfigVariables(rollConfig);
      this.state.stopped = false;
      this.profitLoss = 0;
      this.expectedHits = 0;
      this.expectedHitsMaxRolls = 0;
    },
    reset: function () {
      this.state.stopped = true;
      this.state.reason = "";
      this.riskOnRollCount = 0;
      this.losingStreak = 0;
      this.hitCount = 0;
    },
    isStopped: function () {
      return this.state.stopped;
    },
    getStopReason: function () {
      return this.state.reason;
    },
    isRunning: function () {
      return !this.isStopped();
    },
    setRollConfigVariables(rollConfig) {
      this.maxRolls = rollConfig.maxRolls;
      this.hitCountTarget = rollConfig.hitCountTarget;
      this.payout = rollConfig.payout;
      this.profitTarget = rollConfig.profitTarget;

      this.minPayout = rollConfig.minPayout;
      this.shortLookback = rollConfig.shortLookback;
      this.midLookback = rollConfig.midLookback;
      this.longLookback = rollConfig.longLookback;
      this.strengthThreshold = rollConfig.strengthThreshold;
    },

    addRoll: function (result, wager, rollConfig) {
      this.setRollConfigVariables(rollConfig);

      if (!this.riskOnTarget) {
        this.evalRiskOff();
      } else {
        this.evalRiskOn(result, wager);
      }

      // this.checkStopOnProfitTarget(result)
      // this.checkStopOnHitCount()
      // this.checkStopOnMaxRolls()
    },
    evalRiskOff() {
      this.globalRollCount++;
      this.checkStrengthThreshold();
    },

    evalRiskOn(result, wager) {
      this.globalRollCount++;
      this.riskOnRollCount++;

      if (result >= this.riskOnTarget.getPayout()) {
        this.hitCount++;
        this.profitLoss += this.riskOnTarget.getPayout() * wager - wager;
        this.losingStreak = 0;
    console.log("HIT Risk on profit / loss", result,  this.profitLoss);
      } else {
        this.profitLoss -= wager;
        this.losingStreak++;
     console.log("MISS Risk on profit / loss", result, this.profitLoss);
      }

      this.checkRiskOnExits();
    },
    checkRiskOnExits() {
      if (this.profitLoss > 0) {
        this.goRiskOff(`profit target hit ${this.riskOnTarget.getPayout()}`);
        return;
      }
    },

    checkStrengthThreshold() {
      const targets = rollHandler.getTargetsExceedingStrengthThreshold(
        this.minPayout,
        this.shortLookback,
        this.midLookback,
        this.longLookback,
        -this.strengthThreshold
      )

      if (targets.length === 0) return;

      const riskOnTarget = targets.first();
      const message = `🟡 ${riskOnTarget.getPayout()} exceeded strength threhold going risk on`;
      this.goRiskOn(riskOnTarget, message);
      return;
    },

    checkStopOnMaxRolls() {
      if (this.maxRolls === -1) return;

      if (this.riskOnRollCount >= this.maxRolls) {
        this.stop(`Stopped on max rolls ${this.riskOnRollCount}`);
      }
    },
    checkStopOnProfitTarget() {
      if (this.profitTarget === 0) return;

      if (this.profitLoss < this.profitTarget) return;

      this.stop(
        `Stopped on profit target Profit Target: ${
          this.profitTarget
        }, Profit: ${this.profitLoss.toFixed(5)}`
      );
    },
    goRiskOn(riskOnTarget, reason) {
      this.riskOnTarget = riskOnTarget;
      console.log(reason);
      this.ctx.notify(reason);
    },

    goRiskOff(reason) {
      this.profitLoss = 0;
      this.riskOnHitCount = 0;
      this.riskOnRollCount = 0;
      this.riskOnTarget = null;
      console.log(reason);
      this.ctx.notify(reason);
    }
  };
}
