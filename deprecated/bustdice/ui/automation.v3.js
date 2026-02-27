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
    profit_target: {
        label: "Profit Target",
        type: "multiplier",
        value: 100000
    },
    max_payout: {
        label: "Max Payout",
        type: "multiplier",
        value: 20
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
    },
    strength_threshold: {
        label: "Strength Threshold",
        type: "multiplier",
        value: 7
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
const rollEngine = initRollEngine(this)

rollEngine.sessionHandler.start(getRollConfig())

while (true) {
    bet = await doRoll(this);

    const result = bet.multiplier;

    evalResult(result);
}

function evalResult(result) {
    rollEngine.sessionHandler.addResult(result, getWager(), getRollConfig())
}

function getPayout() {
	return 1.98;
}

function getWager() {
    return config.wager.value;
}

async function doRoll(ctx) {
    if (rollEngine.sessionHandler.riskOnTarget) {
        return await doLiveRoll(ctx);
    }

    return await doSimRoll(ctx);
}

async function doLiveRoll(ctx) {
    return await ctx.bet(100, rollEngine.sessionHandler.riskOnTarget.getPayout());
}

async function doSimRoll(ctx) {
    if (rollEngine.sessionHandler.rollCount % 2 === 0) {
        return ctx.bet(100, 1.01)
    }

    const result = ctx.skip();
    return result;
}


async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRollConfig() {
    const payout = getPayout()
    const profitTarget = getProfitTarget()
    const minPayout = getMinPayout()
    const maxPayout = getMaxPayout()
    const shortLookback = getShortLookback()
    const midLookback = getMidLookback()
    const longLookback = getLongLookback()
    const scoreThreshold = getScoreThreshold()
    const strengthThreshold = getStrengthThreshold()

    return {
        payout: payout,
        profitTarget: profitTarget,
        minPayout: minPayout,
        maxPayout: maxPayout,
        shortLookback: shortLookback,
        midLookback: midLookback,
        longLookback: longLookback,
        scoreThreshold: scoreThreshold,
        strengthThreshold: strengthThreshold,
    }
}

function getProfitTarget() {
	return config.profit_target.value;
}

function getMinPayout() {
    return config.min_payout.value;
}

function getMaxPayout() {
    return config.max_payout.value;
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

function getStrengthThreshold() {
    return config.strength_threshold.value;
}

function initRollEngine(ctx) {
    let rollCount = 0
    const targets = generateTargets()
    const rollingStats = initRollingStats()

    class SessionHandler {
        constructor(ctx) {
            this.state = {
                stopped: true,
                reason: "",
            }
            this.riskOnTarget = null;
            this.losingStreak = 0
            this.ctx = ctx
            this.hitCount = 0
            this.rollCount = 0
            this.payout = 0
            this.wagerRatio = 0
            this.profitLoss = 0
            this.maxRolls = 0
            this.minPayout = 0
            this.maxPayout = 0;
            this.shortLookback = 0
            this.midLookback = 0
            this.longLookback = 0
            this.scoreThreshold = 0
            this.strengthThreshold = 0
            this.stopOnWin = false
        }

        getWinRate() {
            return this.hitCount / this.rollCount
        }

        getTeo() {
            return 1 / (this.payout * 1.01)
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

        start(rollConfig) {
            this.reset()
            this.setRollConfigVariables(rollConfig)
            this.state.stopped = false
            this.profitLoss = 0
        }

        reset() {
            this.state.stopped = true
            this.state.reason = ""
            this.rollCount = 0
            this.losingStreak = 0
            this.hitCount = 0
            this.wagerRatio = 1
        }

        isStopped() {
            return this.state.stopped
        }

        getStopReason() {
            return this.state.reason
        }

        isRunning() {
            return !this.isStopped()
        }

        addResult(result, wager, rollConfig) {
            this.setRollConfigVariables(rollConfig)
            rollingStats.push(result)
            this.rollCount++
                rollCount++
                targets.forEach((target) => target.addResult(result))

            if (result >= this.payout) {
                this.hitCount++
                    this.profitLoss += this.payout * wager - wager
                const diff = this.payout - this.losingStreak
                this.wagerRatio = Math.min(1, 1 - diff / this.payout)
                this.losingStreak = 0
            } else {
                this.profitLoss -= wager
                this.losingStreak++
                    this.wagerRatio = 1
            }

            if (!this.riskOnTarget) {
                this.evalRiskOff();
            } else {
                this.evalRiskOn(result);
            }
        }

        evalRiskOff() {
            if (this.checkStrengthRiskScoreThreshold()) return;
            if (this.checkStrengthThreshold()) return;
        }

        evalRiskOn(result) {
            if (result >= this.riskOnTarget.getPayout()) {
                this.goRiskOff(`Target hit ${this.riskOnTarget.getPayout}`);
            }
        }

        setRollConfigVariables(rollConfig) {
            this.watchTarget = rollConfig.watchTarget
            this.payout = rollConfig.payout
            this.maxRolls = rollConfig.maxRolls
            this.hitCountTarget = rollConfig.hitCountTarget
            this.profitTarget = rollConfig.profitTarget
            this.rollMode = rollConfig.rollMode
            this.stopOnExpectedHits = rollConfig.stopOnExpectedHits
            this.selectedPayoutLSMultiplier = rollConfig.selectedPayoutLSMultiplier
            this.minPayout = rollConfig.minPayout
            this.maxPayout = rollConfig.maxPayout
            this.shortLookback = rollConfig.shortLookback
            this.midLookback = rollConfig.midLookback
            this.longLookback = rollConfig.longLookback
            this.scoreThreshold = rollConfig.scoreThreshold
            this.strengthThreshold = rollConfig.strengthThreshold
        }

        checkWindUpHalt() {
            if (!this.isWindUp()) return
            this.stop(`Wind up halt triggered`)
        }

        checkSelectedPayoutLosingStreak() {
            if (
                this.losingStreak >=
                this.payout * this.selectedPayoutLSMultiplier
            ) {
                this.stop(
                    `Selected payout hit max losing streak multiplier: ${this.losingStreak}`,
                    true,
                )
            }
        }

        checkStrengthThreshold() {
            const results = this.getTargetsExceedingStrengthThreshold(
                this.minPayout,
                this.maxPayout,
                this.shortLookback,
                this.midLookback,
                this.longLookback, -this.strengthThreshold,
            )

            if (results.length != 0) {
                const riskOnTarget = results.first();
                const message = `🛑 Going risk on with target ${riskOnTarget.getPayout()} due to exceeding strength threshold`
                this.goRiskOn(riskOnTarget, message)
                return true;
            }

            return false;
        }

        checkStrengthRiskScoreThreshold() {
            const results = this.getTargetsExceedingStrengthRiskScoreThreshold(
                this.minPayout,
                this.maxPayout, -this.scoreThreshold, -3,
            )

            if (results.length !== 0) {
                const riskOnTarget = results.first();
                const message = `🛑 Going risk on with target ${riskOnTarget.getPayout()} due to exceeding risk score threshold`
                this.goRiskOn(riskOnTarget, message)
                return true;
            }

            return false;
        }

        checkStopOnProfitTarget() {
            if (this.profitTarget === 0) return
            if (this.profitLoss < this.profitTarget) return

            this.stop(
                `Stopped on profit target Profit Target: ${this.profitTarget}, Profit: ${this.profitLoss.toFixed(5)}`,
            )
        }

        getTargetsExceedingStrengthThreshold(
            minPayout,
            maxPayout,
            shortLookback,
            midLookback,
            longLookback,
            threshold,
        ) {
            if (rollCount < longLookback) return []
            return targets.filter(
                (target) =>
                target.getPayout() >= minPayout && target.getPayout() <= maxPayout &&
                target.exceedsStrengthThreshold(
                    shortLookback,
                    midLookback,
                    longLookback,
                    threshold
                )
            )
        }

        getTargetsExceedingStrengthRiskScoreThreshold(
            minPayout,
            maxPayout,
            riskScoreThreshold,
            strengthThreshold,
        ) {
            return targets.filter(
                (target) =>
                target.getPayout() >= minPayout && target.getPayout() <= maxPayout &&
                target.exceedsStrengthRiskScoreThreshold(
                    riskScoreThreshold,
                    strengthThreshold
                )
            )
        }

        goRiskOn(riskOnTarget, reason) {
            this.riskOnTarget = riskOnTarget;
            this.ctx.notify(reason);
        }

        goRiskOff(reason) {
            this.riskOnTarget = null;
            this.ctx.notify(reason);
        }
    }

    class RollEngine {
        constructor(ctx) {
            this.sessionHandler = new SessionHandler(ctx)
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
            getWinRate = (lookback) => this.stats.getRate(lookback);
            losingStreakExceedsN = (n) =>
                this.getLSRatioAbs() > n * this.stats.getPayout()

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

            exceedsAllThresholds = (
                shortLookback,
                midLookback,
                longLookback,
                scoreThreshold,
            ) => {
                if (this.getRollCount() < this.payout * 10) return false
                const ls = this.getLSRatioAbs()
                const short = this.getHitPoolDeviationScoreLookback(shortLookback)
                const mid = this.getHitPoolDeviationScoreLookback(midLookback)
                const long = this.getHitPoolDeviationScoreLookback(longLookback)
                const score = ((short + mid + long) / 3) * ls
                return score < -scoreThreshold
            }

            exceedsStrengthThreshold = (
                shortLookback,
                midLookback,
                longLookback,
                threshold,
            ) => {
                if (this.getRollCount() < this.payout * 10) return false
                const ls = this.getLSRatioAbs()
                const short = this.stats.getWinRate(shortLookback)
                const mid = this.stats.getWinRate(midLookback)
                const long = this.stats.getWinRate(longLookback)
                const strength = this.getStrength()
                return short < 90 && mid < 90 && long < 90 && strength < threshold
            }

            exceedsStrengthRiskScoreThreshold = (
                riskScoreThreshold,
                strengthThreshold,
            ) => {
                if (this.getRollCount() < this.payout * 10) return false
                const riskScore = this.getRiskScore();
                const strength = this.getStrength()
                return riskScore < riskScoreThreshold && strength < strengthThreshold
            }

            getWinRatePercentsOfTeo = () => {
                const lookbacks = this.getLookbacks().slice();
                lookbacks.push(Infinity)
                return lookbacks.map((lookback) =>
                    this.getWinRatePercentOfTeo(lookback),
                )

            }

            getExpectedVsActualHits(lookback) {
                const lb = Math.min(lookback, this.getRollCount())
                let expected = lb * this.getTeo();
                let actual = lb * this.getWinRate(lb);

                const balance = expected - actual;

                return {
                    expected: expected,
                    actual: actual,
                    rollCount: this.rollCount,
                    balance: balance,
                    backgroundColor: balance > 1 ? "red" : "transparent"
                };
            }

            getExpectedVsActualHitsUIData() {
                const lookbacks = this.getLookbacks().slice();
                lookbacks.push(Infinity)
                return lookbacks.map((lookback) =>
                    this.getExpectedVsActualHits(lookback),
                )

            }

            getRiskScore() {
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


            getStrengthUIData() {
                const strength = this.getStrength();

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
            ...Array.from({
                length: 10
            }, (_, k) => 10 + k * 10),
        ]
    }
    return new RollEngine(ctx)
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
            return sorted.length % 2 === 0 ?
                (sorted[mid - 1] + sorted[mid]) / 2 :
                sorted[mid]
        }
    }

    return new RollingStats(10000)
}