class Stats {
  constructor(size) {
    this.size = size;
    this.buffer = new Array(size).fill(null);
    this.index = 0;
    this.count = 0;
    this.sum = 0;
  }

  push(value) {
    if (value == null || Number.isNaN(value)) return;

    const oldValue = this.buffer[this.index];

    // If buffer full, subtract overwritten value
    if (this.count === this.size && oldValue != null) {
      this.sum -= oldValue;
    }

    this.buffer[this.index] = value;
    this.sum += value;

    if (this.count < this.size) {
      this.count++;
    }

    this.index = (this.index + 1) % this.size;
  }

  getValues(lookback = this.count) {
    const count = Math.min(lookback, this.count);
    const values = [];
    const start = (this.index - count + this.size) % this.size;

    for (let i = 0; i < count; i++) {
      const idx = (start + i) % this.size;
      values.push(this.buffer[idx]);
    }

    return values;
  }

  getSum(lookback = this.count) {
    lookback = Math.min(lookback, this.count);

    if (lookback === this.count) return this.sum;

    const vals = this.getValues(lookback);
    return vals.reduce((a, b) => a + b, 0);
  }

  getMean(lookback = this.count) {
    lookback = Math.min(lookback, this.count);
    if (lookback === 0) return 0;
    return this.getSum(lookback) / lookback;
  }

  getVariance(lookback = this.count) {
    const vals = this.getValues(lookback);
    if (vals.length <= 1) return 0;

    const mean = this.getMean(lookback);
    const sumOfSquares = vals.reduce(
      (sum, v) => sum + (v - mean) ** 2,
      0
    );

    return sumOfSquares / (vals.length - 1);
  }

  getStdDev(lookback = this.count) {
    return Math.sqrt(this.getVariance(lookback));
  }

  getMedian(lookback = this.count) {
    const vals = this.getValues(lookback);
    if (vals.length === 0) return null;

    const sorted = [...vals].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
}
