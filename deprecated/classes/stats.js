class Stats {
  constructor(size, payout) {
    this.size = size;
    this.payout = payout;
    this.buffer = new Array(size).fill(null);
    this.index = 0;
    this.count = 0;
    this.sum = 0;
    this.hitCount = 0; // running count of hits >= payout
  }

  push(value) {
    if (value == null || Number.isNaN(value)) return; // ignore invalids

    // Remove old value if overwriting
    if (this.count >= this.size) {
      const old = this.buffer[this.index];
      this.sum -= old ?? 0;
      if (old >= this.payout) this.hitCount--;
    } else {
      this.count++;
    }

    // Add new value
    this.buffer[this.index] = value;
    this.sum += value;
    if (value >= this.payout) this.hitCount++;

    // Advance index
    this.index = (this.index + 1) % this.size;
  }

  getValues = (lookback = this.count) => {
    const count = Math.min(lookback, this.count);
    const values = [];
    const start = (this.index - count + this.size) % this.size;
    for (let i = 0; i < count; i++) {
      const idx = (start + i) % this.size;
      values.push(this.buffer[idx]);
    }
    return values;
  };

  getSum = (lookback = this.count) => {
    lookback = Math.min(lookback, this.count);
    if (lookback === this.count) return this.sum;
    const vals = this.getValues(lookback);
    return vals.reduce((a, b) => a + b, 0);
  };

  getMean = (lookback = this.count) => {
    lookback = Math.min(lookback, this.count);
    if (lookback === 0) return 0;
    return this.getSum(lookback) / lookback;
  };

  getHitCount = (lookback = this.count) => {
    lookback = Math.min(lookback, this.count);
    if (lookback === this.count) return this.hitCount;
    const vals = this.getValues(lookback);
    return vals.filter((v) => v >= this.payout).length;
  };

  getHitRatePercent = (lookback = this.count) => {
    lookback = Math.min(lookback, this.count);
    if (lookback === 0) return 0;
    return (this.getHitCount(lookback) / lookback) * 100;
  };

  getVariance = (lookback = this.count) => {
    const vals = this.getValues(lookback);
    if (vals.length <= 1) return 0;
    const mean = this.getMean(lookback);
    const sumOfSquares = vals.reduce((sum, v) => sum + (v - mean) ** 2, 0);
    return sumOfSquares / (vals.length - 1);
  };

  getStdDev = (lookback = this.count) => Math.sqrt(this.getVariance(lookback));

  getMedian = (lookback = this.count) => {
    const vals = this.getValues(lookback);
    if (vals.length === 0) return null;
    const sorted = [...vals].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  };

  getWinRatePercentOfTeo = (lookback = 100) =>
    (this.getHitRatePercent(lookback) / this.getTeo()) * 100;

  getTeo = () => 1 / (this.payout * 1.04);
  getPayout = () => this.payout;
}
