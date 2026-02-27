class Target {
  constructor(payout) {
    this.payout = payout;
    this.teo = 1 / (this.payout * 1.05);
    this.streak = 0;
    this.pstreak = 0;
    this.hitCount = 0;
    this.rollCount = 0;
  }

  getPayout() {
    return this.payout;
  }

  addResult(result) {
    this.rollCount++;
    this.updateStreak(result);
  }

  updateStreak(result) {
    if (result >= this.payout) {
      this.hitCount++;
      if (this.streak < 0) this.pstreak = this.streak;
      this.streak = Math.max(this.streak + 1, 1);
    } else {
      if (this.streak > 0) this.pstreak = this.streak;
      this.streak = Math.min(this.streak - 1, -1);
    }
  }

  getStreak = () => this.streak;
  getLosingStreak = () => (this.streak < 0 ? this.streak : 0);
  getTeo = () => this.teo;
  getHitCount = () => this.hitCount;
  getRollCount = () => this.rollCount;
}

let t = new Target(4)
console.log(t.getTeo());
