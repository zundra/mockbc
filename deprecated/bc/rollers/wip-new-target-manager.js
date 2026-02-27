function initTarget(payout) {
  class Target {
    constructor(payout, lookbacks = [10, 20, 30, 40, 50, 60, 70, 80, 90, 200]) {
      this.payout = payout;
      this.lookbacks = lookbacks;
      this.teo = 1 / (this.payout * 1.05); // Adjusted for edge
      this.streak = 0;
      this.pstreak = 0;
      this.hitCount = 0;
      this.rollCount = 0;
      this.globalHits = 0;
      this.globalRolls = 0;
      this.lossesSoFar = 0;
      this.isCompressed = false;
      this.isExtremeCompressed = false;
      this.compressionZone = null;
      this.cooldown = 0;
      this.emaTrackers = {};

      for (const lb of this.lookbacks) {
        this.emaTrackers[lb] = { value: 0, alpha: 2 / (lb + 1) };
      }
    }

    getPayout() {
      return this.payout;
    }

    push(result) {
      this.rollCount++;

      this.updateStats(result);
    }

    updateStats(result) {
      this.globalRolls++;
      this.rollCount++;

      if (result >= this.payout) {
        this.hitCount++;
        this.globalHits++;
        if (this.streak < 0) this.pstreak = this.streak;
        this.streak = Math.max(this.streak + 1, 1);
      } else {
        if (this.streak > 0) this.pstreak = this.streak;
        this.streak = Math.min(this.streak - 1, -1);
      }
      this.setCompressionLevels(
        getCompressedRatio(),
        getExtremeCompressedRatio()
      );
    }

    isParabolicZone() {
      const expected = this.payout;
      const streak = this.losingStreak;

      // (a) streak multiplier rule
      const streakTrigger = streak >= 3 * expected;

      // (b) Wilson bound test
      const p = 1 / this.payout;
      const n = this.globalRolls;
      const x = this.globalHits;
      let wilsonTrigger = false;
      if (n > 10) {
        const phat = x / n;
        const z = 1.96; // 95% CI
        const wilsonLB =
          (phat +
            (z * z) / (2 * n) -
            z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * n)) / n)) /
          (1 + (z * z) / n);
        wilsonTrigger = wilsonLB < p;
      }

      // (c) EMA collapse
      const emaTrigger = this.getWinRate() < (100 / this.payout) * 0.5;

      return streakTrigger || wilsonTrigger || emaTrigger;
    }

    getLosingRatio() {
      const ratio = this.getRatio();
      if (ratio >= 0) return 0;
      return Math.abs(ratio);
    }
    getDiff = () => this.streak + this.payout;
    setCompressionLevels(normalCompression = 3, heavyCompression = 5) {
      this.isCompressed =
        this.getLosingRatio() >= normalCompression &&
        this.getWinRatePercentOfTeo() < 100;
      this.isHeavyCompressed =
        this.isCompressed && this.getLosingRatio() >= heavyCompression;
    }

    setCompressionZone(zone) {
      this.compressionZone = zone;
    }

    getIsExtremeCompressed = () => this.isHeavyCompressed;
    getIsCompressed = () => this.isCompressed;
    getStreak = () => this.streak;
    getLosingStreak = () => (this.streak < 0 ? this.streak : 0);
    getTeo = () => this.teo;
    getHitCount = () => this.hitCount;
    getRollCount = () => this.rollCount;
    getWinRatePercentOfTeo = (lookback = 100) =>
      (this.getWinRate(lookback) / this.getTeo()) * 100;
    getWinRate(lookback = this.lookbacks[this.lookbacks.length - 1]) {
      return this.emaTrackers[lookback]?.value ?? null;
    }
    getLosingStreakAbs = () => Math.abs(this.getLosingStreak());
    streakExceedsThreshold = (lsThreshold) =>
      this.getLosingStreakAbs() >= this.getPayout() * lsThreshold;
    getStreakDiff = () => this.streak + this.payout;
    getRatio = () => this.getStreakDiff() / this.payout;
    dynamicStreakThreshold(baseThreshold = 10) {
      const winRatePct = this.getWinRatePercentOfTeo(100);

      // High win rate → longer streak required
      // Low win rate → shorter streak allowed
      let scale = winRatePct / 100;

      // Clamp between 0.5x and 2x for safety
      scale = Math.max(0.5, Math.min(2, scale));

      return Math.floor(baseThreshold * scale);
    }

    checkCooldown() {
      const shortWR = this.getWinRatePercentOfTeo(50);
      const longWR = this.getWinRatePercentOfTeo(200);

      if (rollCount < 100) {
        return true;
      }

      if (this.cooldown != 0) {
        this.cooldown--;
        return true;
      }

      if (this.inCooldown) {
        if (shortWR > longWR) {
          return true;
        }
      }

      return false; // no cooldown active
    }

    isRiskOnReady() {
      let haltCondition = this.checkWinRatesVTeo();
      if (haltCondition.shouldHalt) return haltCondition;
    }

    checkWinRatesVTeo() {
      let haltCondition = this.getHaltConditionTemplate();
      if (
        this.streakExceedsThreshold(7) &&
        this.getWinRatePercentOfTeo(10) < 20 &&
        this.getWinRatePercentOfTeo(20) < 30 &&
        this.getWinRatePercentOfTeo(30) < 40 &&
        this.getWinRatePercentOfTeo(40) < 50 &&
        this.getWinRatePercentOfTeo(50) < 50 &&
        this.getWinRatePercentOfTeo(60) < 60 &&
        this.getWinRatePercentOfTeo(70) < 70 &&
        this.getWinRatePercentOfTeo(80) < 80 &&
        this.getWinRatePercentOfTeo(90) < 90 &&
        this.getWinRatePercentOfTeo(100) < 90
      ) {
        haltCondition.shouldHalt = true;
        haltCondition.message = "Win rates exceeded TEO threshold";
      }

      return haltCondition;
    }

    getHaltConditionTemplate() {
      return { shouldHalt: false, haltMessage: "" };
    }
  }

  return new Target(payout);
}

function initRollingStats(size) {
  class RollingStats {
    constructor(size) {
      this.size = size;
      this.buffer = new Array(size).fill(null);
      this.index = 0;
      this.count = 0;
    }

    push(value) {
      if (this.count >= this.size) {
        // Overwrite old value
        this.buffer[this.index] = value;
      } else {
        this.buffer[this.index] = value;
        this.count++;
      }

      this.index = (this.index + 1) % this.size;
    }

    getValues = (lookback = this.count) => {
      const count = Math.min(lookback, this.count);
      const values = [];
      const start = (this.index - count + this.size) % this.size;
      for (let i = 0; i < count; i++) {
        const idx = (start + i + this.size) % this.size;
        values.push(this.buffer[idx]);
      }
      return values;
    };

    getMean = (lookback = this.count) => {
      const vals = this.getValues(lookback);
      if (vals.length === 0) return 0;
      const sum = vals.reduce((a, b) => a + b, 0);
      return sum / vals.length;
    };

    getVariance = (lookback = this.count) => {
      const vals = this.getValues(lookback);
      if (vals.length <= 1) return 0;
      const mean = this.getMean(lookback);
      const sumOfSquares = vals.reduce((sum, v) => sum + (v - mean) ** 2, 0);
      return sumOfSquares / (vals.length - 1);
    };

    getStandardDeviation = (lookback = this.count) => {
      return Math.sqrt(this.getVariance(lookback));
    };

    getMedian = (lookback = this.count) => {
      const vals = this.getValues(lookback);
      if (vals.length === 0) return null;
      const sorted = [...vals].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    };
  }

  return new RollingStats(100);
}

function initBankRoll() {
  class BankRoll {
    constructor() {
      this.profit = 0;
      this.peakProfit = 0;
      this.lossLimit = 0;
      this.haltMessage = null;
    }

    getPL = () => this.profit;
    getPeakPL = () => this.peakProfit;
    getDrawDown = () => this.peakProfit - this.profit;
    shouldHalt = () => this.haltMessage != null;

    push(result) {
      const wager = getWager();
      const payout = getPayout();

      this.profit = result >= payout ? wager * payout - wager : -wager;

      // Update trailing high-water mark
      if (this.profit > this.peakProfit) {
        this.peakProfit = this.profit;
      }
      this.checkHalt();
    }

    increment(wager, payout) {
      this.profit += payout * wager - wager;
      // Update trailing high-water mark
      if (this.profit > this.peakProfit) {
        this.peakProfit = this.profit;
      }
    }

    checkHalt() {
      // Check for trailing stop violation
      const stopLimit = getStopLimit();
      if (this.getDrawDown() >= stopLimit) {
        this.haltMessage = `[HALT] Trailing loss limit of ${stopLimit} exceeded (Drawdown: ${this.getDrawDown().toFixed(
          4
        )})`;
      }
    }
  }
  return new BankRoll();
}

function initTargetManager() {
  class TargetManager {
    constructor() {
      this.targets = this.generateTargets();
      this.bankRoll = initBankRoll(500);
      this.rollingStats = initRollingStats(100);
      this.totalRatio = 0;
      this.ratioHistory = [];
    }

    push(result) {
      this.totalRatio = 0;
      this.totalBreachRatio = 0;

      for (let i = 0; i < this.targets.length; i++) {
        const t = this.targets[i];
        t.push(result, stopLimit);
        this.totalRatio += t.getRatio();
      }

      if (this.ratioHistory.length === 10) this.ratioHistory.shift();
      this.ratioHistory.push(this.totalRatio);

      const wager = getWager();
      const payout = getPayout();
      const stopLimit = getStopLimit();
      this.bankRoll.push(result);
      this.rollingStats.push(result);
    }

    getTargets = () => this.targets;

    getTotalRatio = () => this.totalRatio;

    getIsFalling = () => this.getAvgRatio(5) < this.getAvgRatio(10);

    getIsRising = () => this.getAvgRatio(5) > this.getAvgRatio(10);

    getAvgRatio = (lookback = null) => this.getAvg(this.ratioHistory, lookback);

    getAvg(fullData, lookback = null) {
      lookback = !lookback ? fullData.length : lookback;

      const data = fullData.slice(-lookback);
      const count = data.length;
      return data.reduce((sum, v) => sum + v, 0) / count;
    }

    getRatioSlope(windowSize = 5) {
      const recent = this.ratioHistory.slice(-windowSize);
      if (recent.length < 2) return 0;

      // Compute slope via least squares
      const n = recent.length;
      const sumX = (n * (n - 1)) / 2;
      const sumX2 = ((n - 1) * n * (2 * n - 1)) / 6;
      let sumY = 0;
      let sumXY = 0;

      for (let i = 0; i < n; i++) {
        const x = i;
        const y = recent[i];
        sumY += y;
        sumXY += x * y;
      }

      const numerator = n * sumXY - sumX * sumY;
      const denominator = n * sumX2 - sumX * sumX;
      return denominator === 0 ? 0 : numerator / denominator;
    }

    generateTargets() {
      return this.getPayouts().map((payout) => initTarget(payout));
    }

    getPayouts() {
      return [5, 10, 20];
    }
  }

  return new TargetManager();
}

let m = initTargetManager();
console.log(m);
