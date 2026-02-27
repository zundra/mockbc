class Target {
    constructor(payout) {
        this.payout = payout;
        this.streak = 0;
        this.pstreak = 0;
        this.hitCount = 0;
        this.rollCount = 0;
        this.leftTarget = null;
        this.rightTarget = null;
    }

    getPayout() {
        return this.payout;
    }

    setLeftTarget(target) {
        this.leftTarget = target;
    }

    setRightTarget(target) {
        this.rightTarget = target;
    }

    getLeftTarget() {
        return this.leftTarget;
    }

    getRightTarget() {
        return this.rightTarget;
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

    getStreak() {
        return this.streak;
    }

    getLosingStreak() {
        return this.streak < 0 ? this.streak : 0;
    }

    getRatio() {
        return Math.floor(this.getLosingStreak() / this.payout);
    }

    getLSRatioAbs() {
        return Math.abs(this.getLSRatio());
    }

    getWinRatePercentOfTeo() {
        return (this.getWinRate() / this.getTeo()) * 100
    }

    getWinRate() {
        return this.hitCount / this.rollCount
    }

    getHitCount() {
        return this.hitCount;
    }

    getRollCount() {
        return this.rollCount;
    }

    getTeoPercent(target) {
        return this.getTeo() * 100;
    }

    getTeo() {
        return 1 / (this.payout * 1.05);
    }

    getStrength() {
        return Math.ceil(this.payout + this.streak) / this.payout;
    }




    /* Automation Functions */
    riskOnConditionsMet() {
        return this.isRiskOff() && false; // Strategy specific
    }

    riskOnConditionsReversed() {
        return this.isRiskOn() && false // Strategy specific
    }

    isRiskOnReady() {
        return false; // Strategy specific
    }

    goRiskOff() {
        this.state = 0;
    }

    goPotentialRiskOn() {
        this.state = 1;
    }

    goRiskOn(wager) {
        this.state = 2;
    }

    isRiskOff() {
        return this.state === 0
    }

    isPotentialRiskOn() {
        return this.state === 1;
    }

    isRiskOn() {
        return this.state === 2
    }
}