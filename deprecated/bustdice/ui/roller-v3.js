var config = {
  wager: {
    label: "Wager",
    type: "balance",
    value: 100
  },
  target: {
    label: "Target",
    type: "multiplier",
    value: 10
  },
  sim_mode: {
        label: "Sim Mode",
        type: "checkbox",
        value: false        
  },
    skip_only: {
        label: "Skip Only",
        type: "checkbox",
        value: true        
    },
  roll_mode: {
    type: "combobox",
    value: "analytics",
    label: "Roll Mode",
    options: {
      analytics: { label: "Analytics" },
      expected_hits: { label: "Expected Hits" },
      quarter: { label: "Quarter Target" },
      half: { label: "Half Target" },
      full: { label: "Full Target" },
      explicit: { label: "Explicit" }
    }
  },
  profit_target: {
    label: "Profit Target",
    type: "multiplier",
    value: 0
  },
  hit_count_target: {
    label: "Hit Count Target",
    type: "multiplier",
    value: 0
  },
  max_rolls: {
    label: "Max Rolls",
    type: "multiplier",
    value: 0
  },
    use_throttle: {
        label: "Use Throttle",
        type: "checkbox",
        value: true        
    },
    throttle_speed: {
        label: "Throttle Speed",
        type: "multiplier",
        value: 500
    }
};

let bet = null;

let rollCount = 0;

const SESSION = defaultSession();
SESSION.start(getRollConfig());

while (true) {
  bet = await doRoll(this);

  const result = bet.multiplier;

  if (!analyticsMode()) {
    evalResult(result);
  }

  rollCount++;

  if (SESSION.isStopped()) {
    this.notify(SESSION.getStopReason());
    console.log(SESSION.getStopReason());
    break;
  }

  if (config.use_throttle.value) {
    await sleep(config.throttle_speed.value)   
  }
}

async function doRoll(ctx) {
  if (simMode()) {
    return doSimRoll(ctx)
  }

  return doLiveRoll(ctx);
}

async function doLiveRoll(ctx) {
  return ctx.bet(getWager(), getPayout());
}

async function doSimRoll(ctx) {
    if (!config.skip_only.value && rollCount % 2 === 0) {
        return ctx.bet(100, 1.01)
    } 
    
    return ctx.skip();
}

function evalResult(result) {
  SESSION.addRoll(result, getWager(), getRollConfig());
}

function getWager() {
  return config.wager.value;
}

function getPayout() {
  return config.target.value;
}

function getRollConfig() {
  const payout = getPayout();
  const maxRolls = getMaxRolls();
  const hitCountTarget = getHitCountTarget();
  const profitTarget = getProfitTarget();

  const rollMode = getRollMode();

  return {
    payout: payout,
    maxRolls: maxRolls,
    hitCountTarget: hitCountTarget,
    profitTarget: profitTarget,
    rollMode: rollMode
  };
}

function getMaxRolls() {
  switch (getRollMode()) {
    case "explicit":
    case "expected_hits":
      return config.max_rolls.value;
    case "full":
      return Math.floor(getPayout());
    case "half":
      return Math.floor(getPayout() / 2);
    case "quarter":
      return Math.floor(getPayout() / 4);
    default:
      return -1;
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function analyticsMode() {
  return config.roll_mode.value === "analytics"
}

function simMode() {
  return config.sim_mode.value || config.roll_mode.value === "analytics";
}

function getHitCountTarget() {
  return Math.max(1, config.hit_count_target.value);
}

function getRollMode() {
  return config.roll_mode.value;
}

function getProfitTarget() {
  return config.profit_target.value;
}

function defaultSession() {
  return {
    state: {
      stopped: true,
      reason: ""
    },
    losingStreak: 0,
    losingStreakTargetDelta: 0,
    hitCount: 0,
    sessionRollCount: 0,
    globalRollCount: 0,
    rollMode: "",
    stopOnExpectedHits: false,
    maxRolls: 0,
    stopOnMaxRolls: false,
    payout: 0,
    profitLoss: 0,
    getWinRate() {
      return this.hitCount / this.sessionRollCount;
    },
    getTeo() {
      return 1 / (this.payout * 1.01);
    },
    getPL() {
      return this.profitLoss;
    },
    getCurrentWinRate() {
      return this.hitCount / this.sessionRollCount;
    },
    getGlobalRollCount: function () {
      return this.globalRollCount;
    },
    getSessionRollCount: function () {
      return this.sessionRollCount;
    },
    start: function (rollConfig) {
      this.reset();
      this.setRollConfigVariables(rollConfig);
      this.state.stopped = false;
      this.profitLoss = 0;
      this.expectedHits = 0;
      this.maxRolls = rollConfig.maxRolls;
    },
    reset: function () {
      this.state.stopped = true;
      this.state.reason = "";
      this.sessionRollCount = 0;
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
    addRoll: function (result, wager, rollConfig) {
      this.setRollConfigVariables(rollConfig);

      this.sessionRollCount++;
      this.globalRollCount++;

      if (result >= this.payout) {
        this.hitCount++;
        this.profitLoss += this.payout * wager - wager;
        this.losingStreak = 0;
      } else {
        this.profitLoss -= wager;
        this.losingStreak++;
      }

      this.checkRiskOnHalts(result);
      this.checkStopOnMaxRolls();
    },
    checkRiskOnHalts(result) {
      this.checkStopOnProfitTarget(result);
      this.checkStopOnHitCount();
      this.checkStopOnMaxRolls();

      if (this.rollMode === "expected_hits") this.checkStopOnExpectedHits();
    },

    setRollConfigVariables(rollConfig) {
      this.payout = rollConfig.payout;
      this.maxRolls = rollConfig.maxRolls;
      this.payout = rollConfig.payout;
      this.profitTarget = rollConfig.profitTarget;
      this.rollMode = rollConfig.rollMode;
      this.stopOnExpectedHits = rollConfig.stopOnExpectedHits;
      this.hitCountTarget = this.getHitCountTarget(rollConfig);
    },

    getHitCountTarget(rollConfig) {
      if (this.rollMode === "expected_hits") {
        return Math.floor((this.getTeo() / 100) * this.maxRolls * 100);
      }

      return rollConfig.hitCountTarget;
    },
    checkStopOnExpectedHits: function () {
      const expectedHits = (this.getTeo() / 100) * this.maxRolls * 100;

      if (this.stopOnExpectedHits) {
        if (this.hitCount >= expectedHits) {
          this.stop(
            `Target hit or exceeded expected hits: ${
              this.hitCount
            } / ${expectedHits.toFixed(2)} over ${this.sessionRollCount} rolls`
          );
          return;
        }
      }
    },

    checkStopOnHitCount: function (result) {
      if (this.hitCountTarget === 0) return;

      if (this.hitCount < this.hitCountTarget) return;

      this.stop(
        `Target ${this.payout} hit ${this.hitCount} times, Delta: (${this.losingStreakTargetDelta})`
      );
    },
    checkStopOnMaxRolls() {
      if (this.maxRolls < 1) return;

      if (this.sessionRollCount >= this.maxRolls) {
        this.stop(`Stopped on max rolls ${this.sessionRollCount}`);
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
    stop(reason = "", notify = false) {
      this.state.reason = reason;
      this.state.stopped = true;
      console.log(reason);
    }
  };
}

