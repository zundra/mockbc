class Stats {
  constructor(size, payout) {
    this.size = size;
    this.payout = payout;
    this.streak = 0;
    this.pstreak = 0;
    this.hitCount = 0;
    this.losingStreak = 0;
    this.winRateAtStreakStart = 0;
    this.buffer = new Array(size).fill(null);
    this.index = 0;
    this.count = 0;
    this.sum = 0;
    this.rollCount = 0;
    this.ratio = 0;
    this.breachRatio = 0;
    this.nextTarget = null;
    this.previousTarget = null;
  }

  push = (result) => {
    this.rollCount++;
    this.updateStreak(result);
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
  };

  updateStreak = (result) => {
    if (result >= this.payout) {
      this.hitCount++;
      if (this.payout === 100) this.breachRatio = this.ratio;

      if (this.streak < 0) {
        this.streakSignFlipped = true;
        this.pstreak = this.streak;
      } else {
        this.streakSignFlipped = false;
      }
      this.streak = Math.max(this.streak + 1, 1);
    } else {
      if (this.streak > 0) {
        this.streakSignFlipped = true;
        this.pstreak = this.streak;
      } else {
        this.streakSignFlipped = false;
      }
      this.streak = Math.min(this.streak - 1, -1);
    }

    this.losingStreak = this.streak < 0 ? Math.abs(this.streak) : 0;

    if (this.losingStreak === 1) {
      this.winRateWasLowWhenStreakStarted =
        this.getWinRatePercentOfTeo(100) < 80;
    } else if (this.losingStreak === 0) {
      this.winRateWasLowWhenStreakStarted = false;
    }

    this.ratio = this.getStreakDiff() / this.payout;
  };

  getWinRatePercentOfTeo = (lookback = 100) =>
    (this.getWinRate(lookback) / this.getTeo()) * 100;

  getRate = (lastN = this.count) => {
    const count = Math.min(lastN, this.count);
    if (count === 0) return 0;

    let sum = 0;
    const start = (this.index - count + this.size) % this.size;
    for (let i = 0; i < count; i++) {
      const idx = (start + i + this.size) % this.size;
      sum += this.buffer[idx] ?? 0;
    }
    return sum / count;
  };

  getWinRate = (lookback = 10) => this.getRate(lookback);

  getTeo = () => 1 / (this.getPayout() * 1.05);

  getSum = (lastN = this.count) => {
    const count = Math.min(lastN, this.count);
    if (count === 0) return 0;

    let sum = 0;
    const start = (this.index - count + this.size) % this.size;
    for (let i = 0; i < count; i++) {
      const idx = (start + i + this.size) % this.size;
      sum += this.buffer[idx] ?? 0;
    }
    return sum;
  };

  getWinRate = () => this.hitCount / this.rollCount;
  getTeo = () => 1 / (this.getPayout() * 1.04);
  getHitCount = () => this.hitCount;
  getRollCount = () => this.rollCount;
  getStreak = () => this.streak;
  getPreviousStreak = () => this.pstreak;
  getLosingStreak() {
    if (this.payout % 3 === 0) return 0;
    return this.payout * 5;
  }
  getWinRateSensitiveLosingStreak = () =>
    this.winRateWasLowWhenStreakStarted ? this.getLosingStreak() : 0;
  getPayout = () => this.payout;
  getStreakDiff = () => this.streak + this.payout;
  getRatio() {
    if (this.payout % 3 === 0) {
      return -1;
    } else if (this.payout % 2 === 0) {
      return -3;
    }
    return 0;
  }
}

class Target {
  constructor(payout) {
    this.payout = payout;
    this.stats = new Stats(100, payout);
    this.rollCount = 0;
    this.nextTarget = null;
    this.previousTarget = null;
    this.losingStreak = 0;
    this.pstreak = 0;
    this.riskOffStreakID = 0;
    this.profit = 0;
  }

  getWager = () => this.wager;

  setNextTarget(target) {
    this.nextTarget = target;
  }
  setPreviousTarget(target) {
    this.previousTarget = target;
  }

  getNextTarget = () => this.nextTarget;

  getOverheadRatioSum() {
    const nextTarget = this.getNextTarget();

    if (!nextTarget) return this.getRatio();
    return this.getRatio() + nextTarget.getOverheadRatioSum();
  }

  getOverheadCount() {
    const next = this.getNextTarget();
    if (!next) return 1; // count self
    return 1 + next.getOverheadCount();
  }

  getOverheadUnderPressureCount() {
    const next = this.getNextTarget();
    const selfCount = this.getRatio() < 0 ? 1 : 0;

    if (!next) return selfCount;

    return selfCount + next.getOverheadUnderPressureCount();
  }

  getOverheadRatioAvg() {
    if (this.getOverheadCount() === 0) return this.getOverheadRatioSum();
    return this.getOverheadRatioSum() / this.getOverheadCount();
  }

  getPreviousTarget = () => this.previousTarget;

  getPayout() {
    return this.payout;
  }

  getRiskOnLosingStreak = () => this.losingStreak;

  push(result, stopLimit) {
    this.updateStats(result);
    this.stats.push(result);
  }

  updateStats(result) {
    if (!this.isRiskOn() && this.losingStreak === 0) return; // Continue to count the losing steak even if it goes risk off

    if (result >= this.payout) {
      if (this.losingStreak > 0) this.pstreak = this.losingStreak;
      this.losingStreak = 0;
    } else {
      this.losingStreak++;
    }
  }

  getPL = () => this.profit;

  isExtremeCompressed = () => this.isCompressed(3);
  isCompressed = (threshold = 1) => this.getLosingRatio() >= threshold;
  getWinRatePercentOfTeo = (lookback = 100) =>
    this.stats.getWinRatePercentOfTeo(lookback);
  getStreak = () => this.stats.getStreak();
  getLosingStreak = () => this.stats.getLosingStreak();
  getPreviousLosingStreak = () => this.pstreak;
  getTeo = () => this.stats.getTeo();
  getHitCount = () => this.stats.getHitCount();
  getRollCount = () => this.rollCount;
  getRatio = () => this.stats.getRatio();
  getDiff = () => this.streak + this.payout;
  getLosingRatio() {
    const ratio = this.getRatio();
    if (ratio >= 0) return 0;
    return Math.abs(ratio);
  }
}

function generatePayouts() {
  const p1 = [
    1.01,
    1.1,
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
    10,
    15
  ];

  const p2 = Array.from(
    {
      length: 9
    },
    (v, k) => 20 + k * 10
  );

  // const p3 = Array.from(
  //   {
  //     length: 10
  //   },
  //   (v, k) => 100 + k * 500
  // );

  const p3 = [500, 1000, 5000, 10000, 15000, 20000, 25000, 50000, 100000];
  const p5 = [];
  // const p4 = Array.from(
  //   {
  //     length: 10
  //   },
  //   (v, k) => 1000 + k * 1000
  // );

  // const p5 = Array.from(
  //   {
  //     length: 10
  //   },
  //   (v, k) => 10000 + k * 10000
  // );

  return [2, 3, 4, 5, 6, 7, 8, 9, 10];
}

function generateCompressionZone(minPayout = 1.01, maxPayout = 2) {
  class CompressionZone {
    constructor() {
      this.zones = [];
    }

    getZones() {
      return this.zones;
    }

    getBase() {
      return this.base;
    }

    getLength = () => this.zones.length;

    tryProcessCompression(targets, compressedRatio) {
      this.zones = [];
      let partition = [];

      for (const t of targets) {
        const compressed = t.isCompressed(compressedRatio);

        console.log(compressed, t.getRatio(), t.getLosingRatio());
        if (compressed) {
          partition.push({
            payout: t.getPayout(),
            isExtreme: t.isExtremeCompressed()
          });
        } else if (partition.length) {
          this.zones.push(partition);
          partition = [];
        }
      }

      if (partition.length) {
        this.zones.push(partition);
      }
    }

    isReady() {
      return this.zones.some(zone => zone.some(item => item.isExtreme));
    }
  }

  return new CompressionZone(minPayout, maxPayout);
}

const targets = generatePayouts().map((p) => new Target(p));

let c = generateCompressionZone(2, 5);

const zones = [];
const partition = [];

c.tryProcessCompression(targets, 1);
console.log(c.getZones());
