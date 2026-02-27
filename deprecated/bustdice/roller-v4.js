var config = {
    roll_mode: {
        type: "combobox",
        value: "throttled",
        label: "Roll Mode",
        options: {
            throttled: {
                label: "Throttled"
            },
            unthrottled: {
                label: "Unthrottled"
            },
            live: {
                label: "Live"
            }
        }
    },
    wager: {
        label: "Wager",
        type: "balance",
        value: 100
    },
    payout: {
        label: "Payout",
        type: "multiplier",
        value: 1.98
    },
    throttle_speed: {
        label: "Throttle Speed",
        type: "multiplier",
        value: 500
    }
};


const ROLLING_STATS = initRollingStats();
let shouldStop = false;
let bet = null;

let rollCount = 0;

while (true) {
    bet = await doRoll(this);
    rollCount++;
    const result = bet.multiplier;

    ROLLING_STATS.push(result);

}

function getWager() {
    return config.wager.value;
}

function getPayout() {
    return config.payout.value;
}

async function doRoll(ctx) {
    if (isLive()) {
        return doLiveRoll(ctx);
    }

    return doSimRoll(ctx);
}

async function doLiveRoll(ctx) {
    return ctx.bet(getWager(), getPayout());
}

async function doSimRoll(ctx) {
  let throttled = isThrottled();

    if (throttled) {
        await sleep(getThrottleSpeed());
    }

    let mod = throttled ? 10 : 2;

    if (rollCount % mod === 0) {
        return ctx.bet(100, 1.01);
    }

    return ctx.skip();
}

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isThrottled() {
    return config.roll_mode.value === "throttled";
}

function isLive() {
    return config.roll_mode.value === "live";
}


function getThrottleSpeed() {
    const stats10median = ROLLING_STATS.getMedian(10)
    const stats100median = ROLLING_STATS.getMedian(100)
    const stats1000median = ROLLING_STATS.getMedian(1000)
    let throttle_speed = config.throttle_speed.value;
    return throttle_speed;

    if (stats10median > 1.98 || stats100median > 1.98 || stats1000median > 1.98) {
      throttle_speed = 0;
    } 

    return throttle_speed;
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

    return new RollingStats(1000)
}