/* Start Script */
// ==UserScript==
// @name         bc.game fastest roll v4
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  try to take over the world!
// @author       You
// @match        https://*.game/game/limbo
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bc.game
// @require https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const TARGETS = generateTargets();
  const HIGH_HITS = initHighHits();
  let firstLoad = true;
  let lastRollSet = [];
  let currentRollSet = [];
  let rollCount = 0;
  let losingStreak = 0;
  let stopped = true;
  let hitCount = 0;
  let profit = 0;
  let wager = 0;

  // Fields
  let lsField = null;
  let highHitThresholdField = null;
  let hitCountTargetField = null;
  let maxRollField = null;
  let restHighHitField = null;
  let highHitResetThresholdField = null;
  let maxLossField = null;

  let highHit = 0;
  let highHitRound = 0;
  let highHitLosingStreak = 0;

  let teo = 0;

  injectUI();
  initWindowEvents();

  function evalResult(result) {
    rollCount++;

    if (result > highHit) {
      highHit = result;
      highHitRound = rollCount;
      highHitLosingStreak = 0;
    } else {
      highHitLosingStreak++;
    }

    let payout = getPayout();

    if (result >= payout) {
      hitCount++;

      losingStreak = 0;
      profit += payout * getWager() - getWager();
    } else {
      losingStreak++;
      profit -= getWager();
    }

    HIGH_HITS.addResult(result);
    setStreaks(result);
    updateUI();
    checkHalts(result);
    setNextBet();
  }

  function setNextBet() {
    const payout = getPayout();

    if (!getUseProgressiveWager()) return;

    if (losingStreak > 0 && losingStreak % Math.ceil(payout / 2) === 0) {
      wager = wager * 2;
      setWager(wager);
    } else if (losingStreak === 0) {
      wager = getBaseWager();
      setWager(wager);
    }
  }

  function setStreaks(result) {
    for (let i = 0; i < TARGETS.length; i++) {
      TARGETS[i].push(result);
    }
  }

  function checkHalts(result) {
    const payout = getPayout();

    if (getHaltOnLows()) {
      let breached = TARGETS.filter(
        (target) => target.getPayout() < 2 && target.haltMessage != null
      );
      if (breached.length !== 0) {
        halt(breached[0].haltMessage);
        return;
      }
    }

    if (getRiskOn()) {
      if (losingStreak >= Math.floor(payout - 1)) {
        losingStreak = 0;
        halt(`Max rolls during risk on Losing Streak: ${losingStreak}`);
        return;
      } else if (result >= payout) {
        hitCount = 0;
        halt(`Target hit during risk on: Payout: ${payout}, Result: ${result}`);
        return;
      }
    }

    if (getUseProgressiveWager() && hitCount >= getHitCountTarget()) {
      halt(`Progresive wager hit`);
      return;
    }

    if (getStopOnMaxLoss() && maxLossExceeded()) {
      halt("Max loss exceeded:", profit);
      return;
    }

    if (getStopOnProfit() && profit >= getProfitTarget()) {
      halt(`Profit target hit ${profit.toFixed(4)}`);
      return;
    }

    if (getStopOnMaxRolls() && rollCount >= getMaxRolls()) {
      halt("Max rolls hit");
      return;
    }

    if (getRiskOn()) return;

    const skewed1 = TARGETS.filter(
      (t) =>
        t.nature.score > 0.7 &&
        t.getWinRatePercentOfTeo(100) < 50 &&
        t.getLosingStreak() >= (t.getPayout() * 6) &&
        t.ratio < -10
    ).sort(
      (a, b) =>
        b.nature.score * Math.abs(b.ratio) - a.nature.score * Math.abs(a.ratio)
    );

    if (skewed1.length) {
      const t = skewed1[0];
      halt(
        `[Target ${t.payout}× coil] NS=${t.nature.score.toFixed(
          2
        )} WR=${t
          .getWinRatePercentOfTeo(100)
          .toFixed(2)} Ratio=${t.ratio.toFixed(2)}`
      );
      return;
    }

    const skewed2 = TARGETS.filter(
      (t) =>
        t.nature.score > 0.8 &&
        t.getLosingStreak() >= (t.getPayout() * 7)
    ).sort(
      (a, b) =>
        b.nature.score * Math.abs(b.ratio) - a.nature.score * Math.abs(a.ratio)
    );

    if (skewed2.length) {
      const t = skewed[0];
      halt(
        `[Target ${t.payout}× coil] NS=${t.nature.score.toFixed(
          2
        )} LS=${t.ratio.getLosingStreak()}`
      );
      return;
    }
    if (getStopOnLosingStreak()) {
      let breached = TARGETS.filter((target) => target.haltMessage != null);
      if (breached.length !== 0) {
        halt(breached[0].haltMessage);
        return;
      }
    }
  }

  // function generateTargets() {
  //   return $("#watch-payouts")
  //     .val()
  //     .split(" ")
  //     .map((p) => createTarget(p));
  // }

  function generateTargets() {
    return generatePayouts().map((p) => createTarget(p.toFixed(2)));
  }

  function createTarget(payout) {
    class RollingCounter {
      constructor(size) {
        this.size = size;
        this.hits = new Array(size).fill(0);
        this.index = 0;
        this.count = 0;
      }
      push(isHit) {
        this.hits[this.index] = isHit ? 1 : 0;
        this.index = (this.index + 1) % this.size;
        this.count = Math.min(this.count + 1, this.size);
      }
      getHitRate() {
        return (
          this.hits.slice(0, this.count).reduce((a, b) => a + b, 0) / this.count
        );
      }
    }

    class Target {
      constructor(payout) {
        this.payout = parseFloat(payout);
        this.rollingCounter = new RollingCounter(100);
        this.losingStreak = 0;
        this.hitCount = 0;
        this.rollCount = 0;
        this.haltMessage = null;
        this.ratio = 0;
        this.rawRatio = parseFloat(payout);
        this.lsdiff = 0;
        this.e = 0.02;

        // nature substate
        this.nature = {
          emaDev: 0,
          prevEmaDev: 0,
          score: 0,
          direction: 0,
          z: 0
        };
      }

      // ===============================
      // === Core performance metrics ===
      // ===============================
      getWinRatePercentOfTeo(lookback) {
        const theo = 1 / this.payout;
        const actual = this.rollingCounter.getHitRate();
        return (actual / theo) * 100;
      }

      getLosingStreak = () => this.losingStreak

      getPayout = () => this.payout

      push(result) {
        const winBump = this.payout - 1 + this.e;
        const loseBump = -1 + this.e;

        if (result >= this.payout) {
          this.haltMessage = null;
          this.losingStreak = 0;
          this.rawRatio = (this.rawRatio ?? 0) + winBump;
          this.ratio = this.rawRatio / this.payout;
        } else {
          this.losingStreak = (this.losingStreak ?? 0) + 1;
          this.rawRatio = (this.rawRatio ?? 0) + loseBump;
          this.ratio = this.rawRatio / this.payout;

          if (this.losingStreak >= this.payout * getLosingStreakMultiplier()) {
            this.haltMessage = `[Losing Streak Threshold Breached] Payout: ${this.payout}, Streak: ${this.losingStreak}`;
          } else {
            this.haltMessage = null;
          }
        }
        this.rollingCounter.push(result >= this.payout);
        this.updateNature(100);
      }

      getHTMLID = () =>
        this.payout
          .toString()
          .replace(/\./g, "_")
          .replace(/[^\w-]/g, "");

      // =====================================
      // === Intrinsic Nature’s Choice logic ===
      // =====================================

      // Binomial noise (std deviation of hit-rate as % of TEO)
      _teoNoisePercent(window) {
        const p = 1 / this.payout;
        if (window <= 0 || p <= 0 || p >= 1) return 1e6;
        const stdHitRate = Math.sqrt((p * (1 - p)) / window);
        return (stdHitRate / p) * 100;
      }

      // Exponential moving average
      _emaUpdate(prev, value, alpha = 0.2) {
        return alpha * value + (1 - alpha) * prev;
      }

      // Logistic squash (0..1)
      _logistic01(x, k = 0.9, z0 = 1.0) {
        return 1 / (1 + Math.exp(-k * (x - z0)));
      }

      /**
       * Update this target’s Nature’s Choice state.
       * @param {number} window - lookback window size (samples)
       * @param {number} alpha - EMA smoothing (0–1)
       */
      updateNature(window = 100, alpha = 0.2) {
        const theoProb = 1 / this.payout;
        const wrp = this.getWinRatePercentOfTeo(window); // e.g., 97.3
        const dev = wrp - 100; // deviation from perfect 100%
        const noisePct = Math.max(1e-6, this._teoNoisePercent(window));
        const z = Math.abs(dev) / noisePct;

        const prev = this.nature.emaDev;
        const emaDev = this._emaUpdate(prev, dev, alpha);
        const score = this._logistic01(Math.abs(emaDev) / noisePct, 0.95, 1.0);
        const direction = (emaDev === 0 ? 0 : emaDev > 0 ? +1 : -1) * -1;

        Object.assign(this.nature, {
          prevEmaDev: prev,
          emaDev,
          score,
          direction,
          z
        });

        return this.nature;
      }

      /**
       * Simple helper for deciding if reversion pressure is tradable.
       * @param {number} threshold - 0–1 threshold for action
       */
      isNatureActive(threshold = 0.6) {
        return this.nature.score > threshold;
      }
    }

    return new Target(payout);
  }

  function generatePayouts() {
    const a1 = [1.01, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9];
    const a2 = Array.from(
      {
        length: 9
      },
      (v, k) => 2 + k * 1
    );

  
    // const a2 = Array.from(
    //   {
    //     length: 100
    //   },
    //   (v, k) => 2 + k * 1
    // );

    return [...a1, ...a2];
  }

  function halt(stopMessage) {
    if (getIsTestMode()) {
      mbc.stop();
    }
    console.log(stopMessage);
    $("#message-box").text(stopMessage);
    stopMessage = "";
    stopBetting();
    return;
  }

  function updateUI() {
    $("#roll-count").html(rollCount);
    $("#hit-count").html(hitCount);
    $("#high-hit")
      .html(
        `${highHit} | ${highHitLosingStreak} | ${Math.round(
          rollCount - highHit
        )}`
      )
      .css({
        backgroundColor:
          highHitLosingStreak > highHit * 3 ? "red" : "transparent"
      });

    $("#profit-loss")
      .html(profit.toFixed(4))
      .css({
        backgroundColor: `${
          profit > 0 ? "green" : profit < 0 ? "red" : "transparent"
        }`
      });

    updateStreakRows();
    updateHighHits();
  }

  function updateStreakRows() {
    if (!$.trim($("#stats-body").html())) {
      const rows = createStreakRows();
      $("#stats-body").append(createStreakRows());
    }

    for (let i = 0; i < TARGETS.length; i++) {
      const target = TARGETS[i];
      const payout = target.payout;
      const ls = target.losingStreak;
      const streakId = target.getHTMLID();
      const diff = target.lsdiff;
      const ratio = target.ratio;
      const wrp = target.getWinRatePercentOfTeo();
      const ns = target.nature.score;

      $(`#payout-${streakId}`).html(isNaN(payout) ? "—" : payout.toFixed(2));

      $(`#ratio-${streakId}`).html(isNaN(ratio) ? "—" : ratio.toFixed(2));

      $(`#win-rate-percent-${streakId}`).html(
        isNaN(wrp) ? "—" : wrp.toFixed(2)
      );

      $(`#nature-score-${streakId}`).html(isNaN(ns) ? "—" : ns.toFixed(2));

      $(`#streak-${streakId}`).html(isNaN(ls) ? "—" : ls);

      const $ratioCol = $(`#ratio-${streakId}`).closest("td");

      if (!isNaN(ratio)) {
        if (ratio >= 3) {
          $ratioCol.css("background-color", "green");
        } else if (ratio <= -3) {
          $ratioCol.css("background-color", "red");
        } else {
          $ratioCol.css("background-color", "transparent");
        }
      } else {
        $ratioCol.css("background-color", ""); // Reset
      }

      const $streakCol = $(`#streak-${streakId}`).closest("td");

      if (!isNaN(ls)) {
        if (ls >= payout * 3) {
          $streakCol.css("background-color", "red");
        } else {
          $streakCol.css("background-color", "transparent");
        }
      } else {
        $streakCol.css("background-color", ""); // Reset
      }
    }
  }

  function updateHighHits() {
        const highHits = HIGH_HITS.getResults()

        $("#highHit-hit")
          .text(`${highHits.highHit.hit}`)
          .css({
            backgroundColor:
              highHits.highHit.hitDelta < 0 ? "red" : "transparent",
          })
        $("#highHit-remaining").text(`${highHits.highHit.rollsRemaining}`)
        $("#highHit-delta").text(`${highHits.highHit.hitDelta.toFixed(2)}`)

        $("#highHit50-hit")
          .text(`${highHits.highHit50.hit}`)
          .css({
            backgroundColor:
              highHits.highHit50.hitDelta < 0 ? "red" : "transparent",
          })
        $("#highHit50-remaining").text(`${highHits.highHit50.rollsRemaining}`)
        $("#highHit50-delta").text(`${highHits.highHit50.hitDelta.toFixed(2)}`)

        $("#highHit100-hit")
          .text(`${highHits.highHit100.hit}`)
          .css({
            backgroundColor:
              highHits.highHit100.hitDelta < 0 ? "red" : "transparent",
          })
        $("#highHit100-remaining").text(`${highHits.highHit100.rollsRemaining}`)
        $("#highHit100-delta").text(
          `${highHits.highHit100.hitDelta.toFixed(2)}`,
        )

        $("#highHit1000-hit")
          .text(`${highHits.highHit1000.hit}`)
          .css({
            backgroundColor:
              highHits.highHit1000.hitDelta < 0 ? "red" : "transparent",
          })
        $("#highHit1000-remaining").text(
          `${highHits.highHit1000.rollsRemaining}`,
        )
        $("#highHit1000-delta").text(
          `${highHits.highHit1000.hitDelta.toFixed(2)}`,
        )

        $("#highHit10000-hit")
          .text(`${highHits.highHit10000.hit}`)
          .css({
            backgroundColor:
              highHits.highHit10000.hitDelta < 0 ? "red" : "transparent",
          })
        $("#highHit10000-remaining").text(
          `${highHits.highHit10000.rollsRemaining}`,
        )
        $("#highHit10000-delta").text(
          `${highHits.highHit10000.hitDelta.toFixed(2)}`,
        )
  }
  function getStopOnMaxRolls() {
    return getMaxRolls() !== 0;
  }

  function getStopOnLosingStreak() {
    return getLosingStreakMultiplier() !== 0;
  }

  function getStopOnHitCount() {
    return getHitCountTarget() !== 0;
  }

  function getStopOnProfit() {
    return getProfitTarget() !== 0;
  }

  function getProfitTarget() {
    return Number($("#profit-target").val());
  }

  function getStopOnMaxLoss() {
    return getMaxLoss() !== 0;
  }

  function getMaxLoss() {
    if (!maxLossField) {
      maxLossField = $("#max-loss");
    }
    return Number(maxLossField.val());
  }

  function getRiskOn() {
    return $("#risk-on").prop("checked");
  }

  function getUseProgressiveWager() {
    return $("#use-progressive-wager").prop("checked");
  }

  function getHaltOnLows() {
    return $("#halt-on-lows").prop("checked");
  }

  function getResetHighHitOnBigHit() {
    return $("#reset-high-hit-on-big-hit").prop("checked");
  }

  function getResetOnStart() {
    return $("#reset-on-start").prop("checked");
  }

  function getHighHitResetThreshold() {
    if (!highHitResetThresholdField) {
      highHitResetThresholdField = $("#high-hit-reset-threshold");
    }
    return Number(highHitResetThresholdField.val());
  }

  function getHitCountTarget() {
    if (!hitCountTargetField) {
      hitCountTargetField = $("#hit-count-target");
    }
    return Number(hitCountTargetField.val());
  }

  function getMaxRolls() {
    if (!maxRollField) {
      maxRollField = $("#max-rolls");
    }
    return Number(maxRollField.val());
  }

  function getLosingStreakMultiplier() {
    if (!lsField) {
      lsField = $("#ls-multiplier");
    }
    return Number(lsField.val());
  }

  function getHighHitThreshold() {
    if (!highHitThresholdField) {
      highHitThresholdField = $("#high-hit-threshold");
    }
    return Number(highHitThresholdField.val());
  }

  function initHighHits() {
    class HighHits {
      constructor() {
        this.rollCount = 0
        this.highHit = 0
        this.round = 0

        this.intervals = [50, 100, 1000, 10000]
        this.data = new Map()

        for (const interval of this.intervals) {
          this.data.set(interval, {
            highHit: 0,
            round: 0,
          })
        }
      }

      addResult(result) {
        this.rollCount++

        // Update global high hit
        if (result > this.highHit) {
          this.highHit = result
          this.round = this.rollCount
        }

        for (const interval of this.intervals) {
          if (this.rollCount % interval === 0) {
            this.data.set(interval, { highHit: 0, round: 0 })
          }

          const entry = this.data.get(interval)
          if (result > entry.highHit) {
            this.data.set(interval, {
              highHit: result,
              round: this.rollCount,
            })
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
            rollsRemaining: Infinity,
          },
        }

        for (const interval of this.intervals) {
          const { highHit, round } = this.data.get(interval)
          const roundDelta = this.rollCount - round
          const rollsRemaining = Math.max(0, interval - roundDelta)

          results[`highHit${interval}`] = {
            hit: highHit,
            round,
            roundDelta,
            hitDelta: highHit - roundDelta,
            rollsRemaining,
          }
        }

        return results
      }
    }
    return new HighHits()
  }
  function initWindowEvents() {
    $("#set-risk-on-btn").click(function () {
      setWager(getScaledWager());
      $("#risk-on").prop("checked", true);
      $("#roll-mode").val("half-target");
      $("#hit-count-target").val(1);
      $("#profit-target").val(0.01);
    });

    $("#set-risk-off-btn").click(function () {
      $("#risk-on").prop("checked", false);
      $("#roll-mode").val("none");
      $("#hit-count-target").val(0);
      $("#profit-target").val(0);
      $("#use-progressive-wager").prop("checked", false);
      setWager(0);
    });

    $("#double-wager-btn").click(function () {
      setWager(Math.min(1, getWager() * 2));
    });

    $("#half-wager-btn").click(function () {
      setWager(Math.max(0.0001, getWager() / 2));
    });

    $("#zero-wager-btn").click(function () {
      setWager(0);
      $("#use-progressive-wager").prop("checked", false);
    });

    $("#start-betting-btn").click(function () {
      startBetting();
    });

    $("#stop-betting-btn").click(function () {
      stopBetting();
    });
    $(document).on("keypress", function (e) {
      if (e.which === 122) {
        if (stopped) {
          startBetting();
        } else {
          stopBetting();
        }
      }
    });

    $("#watch-payouts").on("change", function () {
      TARGETS = null;
    });

    $("#control-panel").draggable({
      scroll: false
    });
    $("#stats-panel").draggable({
      scroll: false
    });
  }

  function maxLossExceeded() {
    if (profit >= 0) return;

    return Math.abs(profit) >= getMaxLoss();
  }

  function getScaledWager(scalingFactor = 0.9) {
    const target = getPayout();
    const baseWager = getBaseWager();
    return Math.max(0.0001, baseWager * Math.pow(1.01 / target, scalingFactor));
  }

  function getBaseWager() {
    return getBalance() * 0.01;
  }

  function getBalance() {
    let rawText = $(".ml-3 .font-extrabold").text().trim();
    return parseFloat(rawText.replace(/[^\d.]/g, ""));
  }

  function getMaxWager() {
    return parseFloat($("#max-wager").val());
  }

  function getBalance() {
    let rawText = $(".ml-3 .font-extrabold").text().trim();
    return parseFloat(rawText.replace(/[^\d.]/g, ""));
  }

  function getWager() {
    if (getIsTestMode()) {
      return Number($("#wager").val());
    }

    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Amount")'
    );
    const inputField = payoutFieldGroup.find("input");

    return Number(inputField.val());
  }

  function setWager(amount) {
    const payout = getPayout(); // whatever’s currently selected in UI

    if (getUseProgressiveWager()) {
      amount = Math.min(amount, getMaxWager());
    }

    if (getIsTestMode()) {
      $("#wager").val(amount);
      return;
    }

    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Amount")'
    );
    const inputField = payoutFieldGroup.find("input");

    if (inputField.length) {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      ).set;
      nativeSetter.call(inputField[0], amount);
      inputField[0].dispatchEvent(new Event("input", { bubbles: true }));
      inputField[0].dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function setPayout(amount) {
    if (getIsTestMode()) {
      $("#payout").val(amount);
      return;
    }

    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Payout")'
    );
    const inputField = payoutFieldGroup.find("input");

    if (inputField.length) {
      let nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      ).set;

      nativeSetter.call(inputField[0], amount); // Update input field value

      let event = new Event("input", {
        bubbles: true
      });
      inputField[0].dispatchEvent(event);

      let reactEvent = new Event("change", {
        bubbles: true
      });
      inputField[0].dispatchEvent(reactEvent); // React listens for change events

      // console.log(`Payout set to: ${amount}`);
    } else {
      console.error("Payout input field not found!");
    }
  }

  function getPayout() {
    if (getIsTestMode()) {
      return Number($("#payout").val());
    }

    const payoutFieldGroup = $('div[role="group"]').has(
      'label:contains("Payout")'
    );
    const inputField = payoutFieldGroup.find("input");

    return Number(inputField.val());
  }

  // Utility function: Get current roll data
  function getCurrentRollData() {
    return $(".grid.grid-auto-flow-column div span")
      .map(function () {
        return $(this).text();
      })
      .get();
  }

  function getTeo() {
    return 1 / (getPayout() * 1.05);
  }

  // Function to start the betting process
  function startBetting() {
    if (firstLoad || getResetOnStart()) {
      firstLoad = false;
      TARGETS = null;
      highHitLosingStreak = 0;
      highHitRound = 0;
    }

    if (getUseProgressiveWager()) {
      wager = getBaseWager();
      setWager(wager);
    }

    rollCount = 0;
    profit = 0;
    hitCount = 0;
    stopped = false;

    if (getIsTestMode()) {
      mbc.start();
    } else {
      doBet(); // Start the async loop
    }
  }

  function stopBetting() {
    stopped = true;
    if (getIsTestMode()) {
      mbc.stop();
    }
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function doInit() {
    observeRollChanges();
    configureMarqueeColorization();
  }

  async function doBet() {
    while (!stopped) {
      // Trigger the button click

      $(".button-brand:first").trigger("click");

      // Wait for 1 second (1000 ms) before clicking again
      await delay(10);

      // Stop condition check inside the loop
      if (stopped) {
        console.log("Stopped betting.");
        return; // Break the loop if stop is true
      }
    }
  }

  // Utility function: Extract the last roll result
  function getRollResult() {
    const temp = lastRollSet;
    lastRollSet = currentRollSet;
    currentRollSet = temp;
    currentRollSet.length = 0;

    currentRollSet = $(".grid.grid-auto-flow-column div span")
      .map(function () {
        return Number($(this).text().replace("x", ""));
      })
      .get();

    if (arraysAreEqual(currentRollSet, lastRollSet)) {
      return -1;
    }

    return currentRollSet[currentRollSet.length - 1];
  }

  // Observer to monitor roll changes in the grid
  let observer = null; // Store observer globally

  async function observeRollChanges() {
    const gridElement = await waitForSelector(".grid.grid-auto-flow-column");
    let previousRollData = getCurrentRollData();

    // If an observer already exists, disconnect it before creating a new one
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver((mutationsList) => {
      let rollDataChanged = false;

      for (const mutation of mutationsList) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          const currentRollData = getCurrentRollData();
          if (!arraysAreEqual(previousRollData, currentRollData)) {
            rollDataChanged = true;
            previousRollData = currentRollData;
          }
        }
      }

      if (rollDataChanged) {
        evalResult(getRollResult());
      }
    });

    observer.observe(gridElement, {
      childList: true,
      subtree: true
    });
  }

  function arraysAreEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((value, index) => value === arr2[index]);
  }

  function waitForSelector(selector) {
    const pause = 10; // Interval between checks (milliseconds)
    let maxTime = 50000; // Maximum wait time (milliseconds)

    return new Promise((resolve, reject) => {
      function inner() {
        if (maxTime <= 0) {
          reject(
            new Error("Timeout: Element not found for selector: " + selector)
          );
          return;
        }

        // Try to find the element using the provided selector
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
          return;
        }

        maxTime -= pause;
        setTimeout(inner, pause);
      }

      inner();
    });
  }

  // === Nature's Choice Pressure for Limbo ===
  // Assumes: target.payout (Number), target.getWinRatePercentOfTeo(window) (Number)
  // Persists internal state on target.nature

  // Binomial noise (as % of TEO) for window N and hit prob p
  function teoNoisePercent(p, N) {
    if (N <= 0 || p <= 0 || p >= 1) return 1e6; // guard
    // std of hit-rate = sqrt(p(1-p)/N)
    const stdHitRate = Math.sqrt((p * (1 - p)) / N);
    // std of (actual/teo)*100 around 100% ≈ (stdHitRate / p) * 100
    return (stdHitRate / p) * 100;
  }

  // Smooth with EMA
  function emaUpdate(prev, value, alpha) {
    return alpha * value + (1 - alpha) * prev;
  }

  // Logistic squashing to 0..1; center ~ z0
  function logistic01(x, k = 0.9, z0 = 1.0) {
    return 1 / (1 + Math.exp(-k * (x - z0)));
  }

  /**
   * Update Nature's Choice pressure for a single target.
   * @param {Object} target - your Target instance (needs payout, getWinRatePercentOfTeo(window))
   * @param {number} window - rolling window used for winRatePercentOfTeo (e.g., 100 or 250)
   * @param {number} alpha  - EMA smoothing (default 0.2)
   */
  function updateNaturePressure(target, window, alpha = 0.2) {
    initNatureFields(target);

    // Theoretical hit prob for Limbo ~ 1/payout (adjust if your edge model differs)
    const p = 1 / target.payout;

    // Deviation from equilibrium (100% == perfectly fair vs TEO)
    const wrp = target.getWinRatePercentOfTeo(window); // e.g., 96.3, 103.7, etc.
    const dev = wrp - 100; // negative => underpay, positive => overpay

    // Normalize by expected sampling noise to get "how unusual" current state is
    const noisePct = Math.max(1e-6, teoNoisePercent(p, window));
    const z = Math.abs(dev) / noisePct; // standardized deviation magnitude

    // Smooth the deviation; direction is opposite sign (reversion toward 100%)
    const prev = target.nature.emaDev;
    const emaDev = emaUpdate(prev, dev, alpha);

    // Magnitude -> logistic 0..1. z0=1 means pressure "turns on" around 1σ
    const score = logistic01(Math.abs(emaDev) / noisePct, 0.95, 1.0);

    // Direction back to mean (negative dev means underpaying -> revert upward => direction -1)
    const direction = (emaDev === 0 ? 0 : emaDev > 0 ? +1 : -1) * -1;

    // Persist
    target.nature.prevEmaDev = prev;
    target.nature.emaDev = emaDev;
    target.nature.z = z;
    target.nature.score = score;
    target.nature.direction = direction;

    return target.nature;
  }

  // --- Optional: pick the next target by Nature's Choice pressure ---
  /**
   * Rank targets by strongest reversion pressure (highest score), with a simple filter
   * to avoid ultra-thin windows or noisy states.
   * @param {Array} targets
   * @param {number} window
   * @returns {Object} best target (or null)
   */
  function chooseNatureTarget(targets, window) {
    let best = null;
    let bestScore = 0;

    for (const t of targets) {
      const np = updateNaturePressure(t, window);
      // Example gate: require at least mild pressure and some stability (|emaDev| > tiny)
      if (np && np.score > bestScore && Math.abs(np.emaDev) > 0.05) {
        best = t;
        bestScore = np.score;
      }
    }
    return best;
  }

  // --- Example wiring ---
  // In your roll loop:
  // for (const t of TARGETS) updateNaturePressure(t, /*window=*/100);
  // const pick = chooseNatureTarget(TARGETS, 100);
  // if (pick) setCurrentTarget(pick); // your existing flow

  function generateAlertSounds() {
    return {
      1: new Audio("https://zundra.github.io/script-alerts/1.mp3"),
      2: new Audio("https://zundra.github.io/script-alerts/2.mp3"),
      3: new Audio("https://zundra.github.io/script-alerts/3.mp3"),
      4: new Audio("https://zundra.github.io/script-alerts/4.mp3"),
      5: new Audio("https://zundra.github.io/script-alerts/5.mp3"),
      6: new Audio("https://zundra.github.io/script-alerts/6.mp3"),
      7: new Audio("https://zundra.github.io/script-alerts/7.mp3"),
      8: new Audio("https://zundra.github.io/script-alerts/8.mp3"),
      9: new Audio("https://zundra.github.io/script-alerts/9.mp3"),
      10: new Audio("https://zundra.github.io/script-alerts/10.mp3"),
      20: new Audio("https://zundra.github.io/script-alerts/20.mp3"),
      30: new Audio("https://zundra.github.io/script-alerts/30.mp3"),
      40: new Audio("https://zundra.github.io/script-alerts/40.mp3"),
      50: new Audio("https://zundra.github.io/script-alerts/50.mp3"),
      60: new Audio("https://zundra.github.io/script-alerts/60.mp3"),
      70: new Audio("https://zundra.github.io/script-alerts/70.mp3"),
      80: new Audio("https://zundra.github.io/script-alerts/80.mp3"),
      90: new Audio("https://zundra.github.io/script-alerts/90.mp3"),
      100: new Audio("https://zundra.github.io/script-alerts/100.mp3"),
      200: new Audio("https://zundra.github.io/script-alerts/200.mp3"),
      300: new Audio("https://zundra.github.io/script-alerts/300.mp3"),
      400: new Audio("https://zundra.github.io/script-alerts/400.mp3"),
      500: new Audio("https://zundra.github.io/script-alerts/500.mp3"),
      600: new Audio("https://zundra.github.io/script-alerts/600.mp3"),
      700: new Audio("https://zundra.github.io/script-alerts/700.mp3"),
      800: new Audio("https://zundra.github.io/script-alerts/800.mp3"),
      900: new Audio("https://zundra.github.io/script-alerts/900.mp3"),
      hundred: new Audio("https://zundra.github.io/script-alerts/hundred.mp3"),
      thousand: new Audio(
        "https://zundra.github.io/script-alerts/thousand.mp3"
      ),
      million: new Audio("https://zundra.github.io/script-alerts/million.mp3"),
      hit: new Audio("https://zundra.github.io/script-alerts/hit.mp3"),
      target: new Audio("https://zundra.github.io/script-alerts/target.mp3"),
      stop: new Audio("https://zundra.github.io/script-alerts/stop.mp3"),
      roll: new Audio("https://zundra.github.io/script-alerts/roll.mp3")
    };
  }
  function injectUI() {
    $("<style>")
      .prop("type", "text/css")
      .html(
        `
            .container {
                z-index: 9999;
                background: #1e1e1e;
                color: #fff;
                padding: 16px;
                width: 350px;
                border-radius: 10px;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
                font-family: Arial, sans-serif;
                font-size: 14px;
                line-height: 1.6;
                cursor: grab;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .container-header {
                background: #333;
                padding: 12px;
                font-weight: bold;
                border-radius: 8px 8px 0 0;
                font-size: 16px;
                cursor: grab;
                text-align: center;
            }


            #stats-panel {
                position: fixed;
                top: 200px;
                right: 400px;

            }

            #control-panel {
                position: fixed;
                top: 200px;
                right: 100px;

            }

            .message-box {
                margin: 12px 0;
                background-color: #444;
                padding: 10px;
                border-radius: 6px;
                color: white;
                font-size: 0.9rem;
                text-align: center;
            }

            .button-group {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                justify-content: center;
            }

            .button-group button {
                flex: 1;
                background: #2d89ef;
                color: white;
                border: none;
                padding: 8px 12px;
                font-size: 13px;
                font-weight: bold;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease-in-out;
                text-align: center;
                min-width: 80px;
            }

            .button-group button:hover {
                background: #1c6ac9;
            }

            .button-group button:active {
                transform: scale(0.95);
            }

            .control-group {
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: #292929;
                padding: 8px;
                border-radius: 6px;
            }

            .control-group label {
                font-size: 13px;
                color: #ccc;
            }

            .control-group input[type="number"],
            .control-group select {
                width: 80px;
                padding: 6px;
                border-radius: 4px;
                border: none;
                text-align: right;
                font-size: 13px;
                background: #444;
                color: white;
            }

            .control-group input[type="checkbox"] {
                transform: scale(1.2);
            }


             /* Draggable Stats Pane */
              .stats-pane {
              position: absolute;
              top: 300px;
              left: 470px;
              background-color: rgba(42, 45, 46, 0.95);
              padding: 15px;
              border-radius: 8px;
              box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
              z-index: 1000;
              cursor: move;
              width: 300px;
              }
              .stats-pane h2 {
              font-size: 1rem;
              color: #00bcd4;
              margin-bottom: 10px;
              }
              .stats-pane div {
              margin-bottom: 5px;
              font-size: 0.9rem;
              }
              .stats-pane span {
              color: #fff;
              font-weight: bold;
              }
                    .stats-block {
      margin-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      padding-bottom: 5px;
      background-color: #1e1e1e; border: 1px solid #333; border-radius: 6px; padding: 10px; margin-top: 10px; color: #ccc; font-family: sans-serif; font-size: 13px; overflow-x: auto;
      }
        `
      )
      .appendTo("head");
    let html = `
  <div class="container" id="stats-panel">
    <div class="container-header">⚙️ Stats Panel</div>
          <div class="stats-block">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid #444;">
                  <th style="position: sticky; left: 0; background-color: #1e1e1e; z-index: 1; text-align: left; padding: 6px; white-space: nowrap;">Payout</th>
                  <th style="text-align: left; padding: 6px;">Streak</th>
                  <th style="text-align: left; padding: 6px;">Ratio</th>
                  <th style="text-align: left; padding: 6px;">WR%Teo</th>
                  <th style="text-align: left; padding: 6px;">NS</th>
                </tr>
              </thead>
              <tbody id="stats-body">
              </tbody>
            </table>
          </div>
     <div class="stats-block">
        <h3>High Hits</h3>
        <table style="font-size: 11px; width: 100%; text-align: right;">
           <thead>
              <tr style="text-align: center;">
                 <th style="width: 25%;">Rolls</th>
                 <th style="width: 25%;">Hit</th>
                 <th style="width: 25%;">Δ</th>
                 <th style="width: 25%;">Left</th>
              </tr>
           </thead>
           <tbody>
              <tr>
                 <td>50</td>
                 <td><span id="highHit50-hit"></span></td>
                 <td><span id="highHit50-delta"></span></td>
                 <td><span id="highHit50-remaining"></span></td>
              </tr>
              <tr>
                 <td>100</td>
                 <td><span id="highHit100-hit">0</span></td>
                 <td><span id="highHit100-delta">0</span></td>
                 <td><span id="highHit100-remaining">0</span></td>
              </tr>
              <tr>
                 <td>1000</td>
                 <td><span id="highHit1000-hit">0</span></td>
                 <td><span id="highHit1000-delta">0</span></td>
                 <td><span id="highHit1000-remaining">0</span></td>
              </tr>
              <tr>
                 <td>10000</td>
                 <td><span id="highHit10000-hit">0</span></td>
                 <td><span id="highHit10000-delta">0</span></td>
                 <td><span id="highHit10000-remaining">0</span></td>
              </tr>
              <tr>
                 <td>Global</td>
                 <td><span id="highHit-hit">0</span></td>
                 <td><span id="highHit-delta">0</span></td>
                 <td><span id="highHit-remaining">0</span></td>
              </tr>
           </tbody>
        </table>
     </div>
  </div>
  

    <div class="container" id="control-panel">
  <div class="container-header">⚙️ Control Panel</div>

  <div id="message-box" class="message-box"></div>

  <div id="stats" class="stats-box" style="
            margin: 12px 0;
            background-color: #444;
            padding: 10px;
            border-radius: 6px;
            color: white;
            font-size: 0.9rem;
            text-align: center;
        ">
    <div>Profit / Loss: <span id="profit-loss"></span></div>
    <div>Roll Count: <span id="roll-count"></span></div>
    <div>Hit Count: <span id="hit-count"></span></div>
    <div>High Hit: <span id="high-hit"></span></div>



  </div>
  <div class="button-group">
    <button id="start-betting-btn">Start Betting</button>
    <button id="stop-betting-btn">Stop Betting</button>
    <button id="set-risk-on-btn">Risk On</button>
    <button id="set-risk-off-btn">Risk Off</button>
    <button id="zero-wager-btn">Zero Wager</button>
    <button id="double-wager-btn">Double Wager</button>
    <button id="half-wager-btn">Half Wager</button>
  </div>

  <div class="control-group">
    <label>Risk On</label>
    <input id="risk-on" type="checkbox" />
  </div>
  <div class="control-group">
    <label>Halt on Lows</label>
    <input id="halt-on-lows" type="checkbox" />
  </div>
  <div class="control-group">
    <label>Use Progressive Wager</label>
    <input id="use-progressive-wager" type="checkbox" />
  </div>

  <div class="control-group">
    <label>Max Wager</label>
    <input type="number" id="max-wager" value="0.1" />
  </div>

  <div class="control-group">
    <label>Losing Streak Multiplier</label>
    <select id="ls-multiplier">
      <option value="0" selected>0</option>
      <option value="0.05">0.05</option>
      <option value="0.1">0.1</option>
      <option value="0.2">0.2</option>
      <option value="0.3">0.3</option>
      <option value="0.4">0.4</option>
      <option value="0.5">0.5</option>
      <option value="1">1</option>
      <option value="1.5">1.5</option>
      <option value="2">2</option>
      <option value="2.5">2.5</option>
      <option value="3">3</option>
      <option value="3.5">3.5</option>
      <option value="4">4</option>
      <option value="4.5">4.5</option>
      <option value="5">5</option>
      <option value="5.5">5.5</option>
      <option value="6">6</option>
      <option value="6.5">6.5</option>
      <option value="7" selected>7</option>
      <option value="7.5">7.5</option>
      <option value="8">8</option>
      <option value="8.5">8.5</option>
      <option value="9">9</option>
      <option value="9.5">9.5</option>
      <option value="10">10</option>
    </select>
  </div>

  <div class="control-group">
    <label>Max Rolls</label>
    <input type="number" id="max-rolls" value="0" />
  </div>

  <div class="control-group">
    <label>Max Loss</label>
    <input type="number" id="max-loss" value="1" />
  </div>

  <div class="control-group">
    <label>Reset On Start</label>
    <input id="reset-on-start" type="checkbox" />
  </div>

  <div class="control-group">
    <label>Reset High Hit on Big Hit</label>
    <input id="reset-high-hit-on-big-hit" type="checkbox" checked />
  </div>

  <div class="control-group">
    <label>High Hit Reset Threshold</label>
    <input type="number" id="high-hit-reset-threshold" value="100" />
  </div>

  <div class="control-group">
    <label>Hit Count Target</label>
    <input type="number" id="hit-count-target" value="0" />
  </div>

  <div class="control-group">
    <label>Profit Target</label>
    <input type="number" id="profit-target" value="0" />
  </div>

  <div class="control-group">
    <label>High Hit Threshold</label>
    <select id="high-hit-threshold">
      <option value="0">0</option>
      <option value="0.05">0.05</option>
      <option value="0.1">0.1</option>
      <option value="0.2">0.2</option>
      <option value="0.3">0.3</option>
      <option value="0.4">0.4</option>
      <option value="0.5">0.5</option>
      <option value="1">1</option>
      <option value="1.5">1.5</option>
      <option value="2">2</option>
      <option value="2.5">2.5</option>
      <option value="3">3</option>
      <option value="3.5">3.5</option>
      <option value="4">4</option>
      <option value="4.5">4.5</option>
      <option value="5">5</option>
      <option value="5.5">5.5</option>
      <option value="6">6</option>
      <option value="6.5">6.5</option>
      <option value="7" selected>7</option>
      <option value="7.5">7.5</option>
      <option value="8">8</option>
      <option value="8.5">8.5</option>
      <option value="9">9</option>
      <option value="9.5">9.5</option>
      <option value="10">10</option>
    </select>
  </div>

  <div class="control-group">
    <label>Max Rolls</label>
    <input type="number" id="max-rolls" value="0" />
  </div>

  <div class="control-group">
    <label>Watch Payouts</label>
    <textarea style="color: black" id="watch-payouts">2 5 10 20 50 100 1000 10000</textarea>
  </div>

</div>
`;

    $("body").prepend(html);
  }

  function createStreakRows() {
    return TARGETS.map(
      (target) =>
        `<tr>
        <td style="position: sticky; left: 0; background-color: #1e1e1e; text-align: left; padding: 4px 6px; white-space: nowrap;">${
          target.payout
        }</td>
        <td><span id="streak-${target.getHTMLID()}"></span></td>
        <td><span id="ratio-${target.getHTMLID()}"></span></td>
        <td><span id="win-rate-percent-${target.getHTMLID()}"></span></td>
        <td><span id="nature-score-${target.getHTMLID()}"></span></td>
      </tr>`
    ).join("");
  }

  function configureMarqueeColorization() {
    // ------- CONFIG -------
    const H_THRESHOLD = 1.92;
    const V_THRESH = 10;
    const V_PAYOUTS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

    // ------- STYLE (beat Tailwind + nested elements) -------
    (function injectStyle() {
      if (document.getElementById("bcg-low-style")) return;
      const el = document.createElement("style");
      el.id = "bcg-low-style";
      el.textContent = `
      .grid.grid-auto-flow-column .btn-like.bcg-low,
      .grid.grid-auto-flow-column .btn-like.bcg-lower,
      .grid.grid-auto-flow-column .btn-like.bcg-both { background-color:#b3261e !important; color:#fff !important; }
      .grid.grid-auto-flow-column .btn-like.bcg-lower { background-color:#d02a20 !important; }
      .grid.grid-auto-flow-column .btn-like.bcg-both  { background-color:#ff3b30 !important;
        box-shadow:0 0 .5rem rgba(255,59,48,.7),0 0 1.25rem rgba(255,59,48,.35) !important;
        transform:translateZ(0); animation:bcg-pulse 1.2s ease-in-out infinite;
      }
      /* Force inner spans/icons, regardless of !text-[#B3BEC1] */
      .grid.grid-auto-flow-column .btn-like.bcg-low *,
      .grid.grid-auto-flow-column .btn-like.bcg-lower *,
      .grid.grid-auto-flow-column .btn-like.bcg-both * { color:#fff !important; fill:#fff !important; stroke:#fff !important; }
      @keyframes bcg-pulse {
        0%{box-shadow:0 0 .35rem rgba(255,59,48,.6),0 0 1rem rgba(255,59,48,.25)}
        50%{box-shadow:0 0 .9rem rgba(255,59,48,.9),0 0 1.6rem rgba(255,59,48,.45)}
        100%{box-shadow:0 0 .35rem rgba(255,59,48,.6),0 0 1rem rgba(255,59,48,.25)}
      }
    `;
      document.head.appendChild(el);
    })();

    // ------- UTILS -------
    const parseNum = (t) => {
      const n = parseFloat(String(t || "").replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : null;
    };

    // Snapshot hot payouts from your table (used ONLY for future tiles)
    let HOT_SET = [];
    function snapshotHotPayouts() {
      const tbody = document.querySelector("#output-table tbody");
      if (!tbody) return;
      const hot = [];
      tbody.querySelectorAll("tr").forEach((row) => {
        const tds = row.querySelectorAll("td");
        if (tds.length < 2) return;
        const payout = parseNum((tds[0].textContent || "").trim());
        const streak = parseNum(tds[1]?.querySelector("span")?.textContent);
        if (
          payout != null &&
          streak != null &&
          V_PAYOUTS.includes(payout) &&
          Math.abs(streak) >= V_THRESH
        ) {
          hot.push(payout);
        }
      });
      hot.sort((a, b) => a - b);
      HOT_SET = hot;
    }

    // ------- STATE & ENGINE -------
    const lastText = new WeakMap(); // tile -> last seen text
    const gridRun = new WeakMap(); // grid -> { lastLow }

    function classify(grid, tile, value) {
      // Clear classes from the PREVIOUS value (we only do this when text changed)
      tile.classList.remove("bcg-low", "bcg-lower", "bcg-both");

      const run = gridRun.get(grid) ?? { lastLow: null };
      if (value < H_THRESHOLD) {
        const converges = HOT_SET.length && HOT_SET.some((P) => value < P);
        if (converges) {
          tile.classList.add("bcg-both");
        } else {
          if (run.lastLow !== null && value < run.lastLow) {
            tile.classList.add("bcg-lower");
          } else {
            tile.classList.add("bcg-low");
          }
          run.lastLow = value;
        }
      } else {
        // break in the <1.92 run
        run.lastLow = null;
      }
      gridRun.set(grid, run);
    }

    function maybeUpdate(grid, tile) {
      // Use innerText to be resilient to span splits
      const nowTxt = (tile.innerText || tile.textContent || "").trim();
      if (!nowTxt) return;

      // Only react when the TEXT changed (prevents retro flips)
      if (lastText.get(tile) === nowTxt) return;
      lastText.set(tile, nowTxt);

      const v = parseNum(nowTxt);
      if (v == null) return;
      classify(grid, tile, v);
    }

    function scanGrid(grid) {
      grid
        .querySelectorAll(".btn-like")
        .forEach((tile) => maybeUpdate(grid, tile));
    }

    // ------- WIRING -------
    // 1) Initial snapshot + quick first paint
    snapshotHotPayouts();
    document.querySelectorAll(".grid.grid-auto-flow-column").forEach(scanGrid);

    // 2) Robust “tick” that catches silent updates (some frameworks dodge MOs)
    let tickTimer = 0;
    (function tick() {
      // Query grids fresh each tick (grids can mount later)
      const grids = document.querySelectorAll(".grid.grid-auto-flow-column");
      grids.forEach(scanGrid);
      tickTimer = window.setTimeout(() => requestAnimationFrame(tick), 120); // ~8 fps
    })();

    // 3) MutationObserver (still helps when available)
    const docObs = new MutationObserver((muts) => {
      let needRescan = false;
      for (const m of muts) {
        if (m.type === "childList") needRescan = true;
        if (m.type === "characterData") {
          const tile = m.target?.parentElement?.closest?.(".btn-like");
          const grid = tile?.closest?.(".grid.grid-auto-flow-column");
          if (tile && grid) maybeUpdate(grid, tile);
        }
      }
      if (needRescan) {
        document
          .querySelectorAll(".grid.grid-auto-flow-column")
          .forEach(scanGrid);
      }
    });
    docObs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });

    // 4) Watch your table to refresh HOT_SET (future tiles only)
    const tbody = document.querySelector("#output-table tbody");
    if (tbody) {
      const tableObs = new MutationObserver(() => {
        if (tableObs._t) cancelAnimationFrame(tableObs._t);
        tableObs._t = requestAnimationFrame(snapshotHotPayouts);
      });
      tableObs.observe(tbody, {
        childList: true,
        subtree: true,
        characterData: true
      });
      setInterval(snapshotHotPayouts, 1500); // safety: some tables render off-DOM then swap
    }

    // Debug helpers
    window.__bcg = {
      hot: () => HOT_SET.slice(),
      grids: () =>
        [...document.querySelectorAll(".grid.grid-auto-flow-column")].length,
      sample: () =>
        [...document.querySelectorAll(".grid.grid-auto-flow-column .btn-like")]
          .slice(-6)
          .map((t) => this.innerText.trim()),
      lastText,
      gridRun
    };
  }

  doInit();
})();

function getIsTestMode() {
  const inputField = $("#test-mode");
  return inputField.length !== 0 && inputField.prop("checked");
}

let mbc;
if (getIsTestMode()) {
  mbc = new MockBC(
    0,
    "Y83TpC2hj2SnjiNEDJwN",
    "9b98254e8986dd95349fc754b4b087b5d0ddf9771026d68fe4ed661c869420b4"
  );
}
