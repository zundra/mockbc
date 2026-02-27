/* Start Script */
// ==UserScript==
// @name         bc.game automation v4
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://*.game/game/limbo*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bc.game
// @require https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @grant        none
// ==/UserScript==


(function() {
    "use strict"

    var body = $('body');

    let html = `<div id="wagering-panel" style="
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 9999;
    background: #222;
    color: #fff;
    padding: 16px;
    width: 320px;
    border-radius: 8px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
    font-family: Arial, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    cursor: grab;
">
    <div id="wagering-header" style="
        font-size: 16px;
        font-weight: bold;
        cursor: grab;
        padding-bottom: 8px;
        border-bottom: 1px solid #444;
        text-align: center;
    ">
        🏆 Wagering Stats
    </div>

    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
        <input id="test-mode" type="checkbox" style="transform: scale(1.2);" />
        Test Mode
    </label>

    <div style="margin: 12px 0;">
        <strong>Profit Loss:</strong> <span id="profit-loss" style="color: #0f0;">0</span>
    </div>
    <div style="margin-bottom: 16px;">
        <strong>Current Wager:</strong> <span id="current-wager" style="color: #ff0;">0</span>
    </div>

    <label>Base Wager</label>
    <input type="number" id="base-wager" value="0.01" style="width: 100%; padding: 6px; margin-bottom: 10px; border-radius: 4px; border: none; background: #333; color: #fff;">

    <label>Max Loss</label>
    <input type="number" id="max-loss" value="2" style="width: 100%; padding: 6px; margin-bottom: 10px; border-radius: 4px; border: none; background: #333; color: #fff;">

    <label>Losing Streak Multiplier</label>
    <select id="ls-multiplier" style="width: 100%; padding: 6px; margin-bottom: 10px; border-radius: 4px; border: none; background: #333; color: #fff;">
        <option value="1">1</option>
        <option value="1.5">1.5</option>
        <option value="2">2</option>
        <option value="2.5">2.5</option>
        <option value="3">3</option>
        <option value="3.5">3.5</option>
        <option value="4" selected>4</option>
        <option value="4.5">4.5</option>
        <option value="5">5</option>
        <option value="5.5">5.5</option>
        <option value="6">6</option>
        <option value="6.5">6.5</option>
        <option value="7">7</option>
        <option value="7.5">7.5</option>
        <option value="8">8</option>
        <option value="8.5">8.5</option>
        <option value="9">9</option>
        <option value="9.5">9.5</option>
        <option value="10">10</option>
    </select>

    <label>Min Percent Below TEO</label>
    <select id="min-percent-below-teo" style="width: 100%; padding: 6px; margin-bottom: 10px; border-radius: 4px; border: none; background: #333; color: #fff;">
        <option value="100">100</option>
        <option value="90">90</option>
        <option value="80">80</option>
        <option value="70" selected>70</option>
        <option value="60">60</option>
        <option value="50">50</option>
        <option value="40">40</option>
        <option value="20">20</option>
        <option value="10">10</option>
        <option value="5">5</option>
        <option value="0">0</option>
    </select>

    <label>Start Target</label>
    <input type="number" id="target-start" value="5" style="width: 100%; padding: 6px; margin-bottom: 10px; border-radius: 4px; border: none; background: #333; color: #fff;">

    <label>Max Target</label>
    <input type="number" id="target-max" value="15" style="width: 100%; padding: 6px; margin-bottom: 10px; border-radius: 4px; border: none; background: #333; color: #fff;">

    <label>Target Step</label>
    <input type="number" id="target-step" value="0.5" style="width: 100%; padding: 6px; margin-bottom: 10px; border-radius: 4px; border: none; background: #333; color: #fff;">
</div>

`;

    body.prepend($(html));

    let baseWager = 0;

    class RollHandler {
        constructor() {
            this.targets = []
            this.config = {}
            this.startTarget = 0;
            this.totalProfitLoss = 0;
        }


        setConfig(config) {
            this.config = config
            this.startTarget = config.start
            const priorTargets = this.targets // Store existing targets before reset
            this.targets = this.generateTargets(
                config.start,
                config.step,
                config.length,
            )

            this.targets.forEach((obj) => {
                const priorTarget = priorTargets.find((p) => p.target === obj.target)

                if (priorTarget) {
                    obj.streak = priorTarget.streak
                    obj.hitCount = priorTarget.hitCount
                    obj.rollingResults = [...priorTarget.rollingResults] // Preserve buffer
                } else {
                    obj.streak = 0
                    obj.hitCount = 0
                }
            })
        }

        getPL() {
            return this.targets.reduce((sum, target) => sum + target.riskState.profitLoss, 0);
        }

        getStartTarget() {
            return this.startTarget;
        }

        getConfig() {
            return this.config
        }

        addResult(result) {
            if (this.targets.length === 0) return

            this.targets.forEach((obj) => {
                obj.addResult(result)
            })
        }

        getTargets() {
            return this.targets
        }

        getStreak(target) {
            const targetObj = this.targets.find((r) => r.target === target)
            return targetObj ? targetObj.streak : null
        }


        LSTiers(lsm) {
            const targetsInStreak = this.getTargetsInLosingStreak(lsm); // Get filtered targets
            const tiers = [];

            let currentTier = [];
            let currentStreak = null;

            for (const target of targetsInStreak) {
                if (currentStreak === null || target.streak !== currentStreak) {
                    // If the streak changes, start a new tier
                    if (currentTier.length > 0) {
                        tiers.push([...currentTier]);
                    }
                    currentTier = [target];
                    currentStreak = target.streak; // Use `streak` instead of `losingStreak`
                } else {
                    currentTier.push(target);
                }
            }

            if (currentTier.length > 0) {
                tiers.push([...currentTier]);
            }

            return tiers;
        }


        overheadLSTiers(lsm, referenceTarget) {
            // 🔍 Count how many tiers contain targets that exceed `referenceTarget`
            return this.LSTiers(lsm).filter(tier => tier.some(target => target.target >= referenceTarget.target))
        }

        getTargetsInLosingStreak(lsm) {
            return this.targets.sort((a, b) => b.target - a.target)
                .filter(target => Math.abs(target.getLosingStreak()) >= (target.target * lsm));
        }

        getPotentialTargets(lsm, minPercentBelowTeo) {
            return this.targets
                .filter(target =>
                    target.isRiskOff() && // Ensure only risk-off targets are considered
                    Math.abs(target.getLosingStreak()) >= target.target * lsm && // LSM-based filtering
                    target.getWinRatePercentOfTeo(100) < minPercentBelowTeo // Below TEO requirement
                )
                .sort((a, b) => b.target - a.target); // Sort descending by target value
        }

        getFirstTargetInLosingStreak(lsm) {
            return this.getTargetsInLosingStreak(lsm).first()
        }

        getLastTargetInLosingStreak(lsm) {
            return this.getTargetsInLosingStreak(lsm).last()
        }

        getMedianTargetInLosingStreak(lsm) {
            return this.getTargetsInLosingStreak(lsm).median()
        }

        generateTargets() {
            const start = getStartTarget();
            const max = getMaxTarget();
            const step = getTargetStep();
            const length = Math.floor((max - start) / step) + 1; // ✅ Fix: Ensure we include 'max' in the range

            const targets = Array.from({
                    length: length,
                },
                (v, k) => start + k * step
            );

            console.log(targets);
            class Target {
                constructor(n) {
                    this.target = Number(n.toFixed(2));
                    this.streak = 0;
                    this.pstreak = 0;
                    this.hitCount = 0;
                    this.rollingResults = [];
                    this.bufferSize = 1000;
                    this.winRateCount = 0;
                    this.winRateMean = 0;
                    this.winRateSumOfSquares = 0;
                    this.winRates = [];
                    this.teoCache = null;
                    this.riskState = this.getDefaultRiskState();
                    this.riskOnStartWinRate = 0;
                    this.potentialRiskOnStartWinRate = 0;
                }

                goRiskOn(wager) {
                    this.riskState.state = 2;
                    this.riskState.baseWager = this.riskState.wager = this.getScaledWager(wager);
                    this.riskOnStartWinRate = this.getWinRate(100);
                }

                getScaledWager(baseWager, scalingFactor = 1.2) {
                    if (this.target <= ROLL_HANDLER.getStartTarget()) return baseWager; // Ensure no division by zero

                    return baseWager * Math.pow(ROLL_HANDLER.getStartTarget() / this.target, scalingFactor);
                }

                isRiskOn() {
                    return this.riskState.state === 2
                }

                isRiskOnReady() {
                    return this.getWinRate(100) > this.potentialRiskOnStartWinRate;
                }

                goPotentialRiskOn() {
                    this.riskState.state = 1
                    this.potentialRiskOnStartWinRate = this.getWinRate(100);
                }

                isPotentialRiskOn() {
                    return this.riskState.state === 1
                }

                goRiskOff() {
                    const previousPL = this.riskState.profitLoss; // Preserve profit/loss
                    this.riskState = this.getDefaultRiskState(); // Reset everything else
                    this.riskState.profitLoss = previousPL; // Restore profit/loss
                }

                isRiskOff() {
                    return this.riskState.state === 0
                }

                calculateTeo() {
                    return 1 / (this.target * 1.05)
                }

                maintainBufferSize() {
                    if (this.rollingResults.length > this.bufferSize) {
                        this.rollingResults.shift();
                    }
                }

                getDefaultRiskState() {
                    return {
                        state: 0, // 0 risk of, 1 potential 2, risk on
                        streak: 0,
                        pstreak: 0,
                        attemptCount: 0,
                        rollCount: 0,
                        hitCount: 0,
                        baseWager: 0,
                        hitTargetDelta: 0,
                        winRates: [],
                        wager: 0,
                        profitLoss: 0,
                        hitCountTarget: 0,
                        winRatePenalty: 0,
                        winRateDelta: 0,
                        getWorkingArray: (array, lookback) => {
                            if (array.length < lookback) return array.slice()

                            return array.slice(array.length - lookback)
                        },
                        getLosingStreak: () => {
                            if (this.riskState.streak > 0) return 0;
                            return this.riskState.streak;
                        },

                        getLosingStreakAbs() {
                            return Math.abs(this.getLosingStreak())
                        },
                        getPriorLosingStreak: () => {
                            if (this.riskState.pstreak > 0) return 0;
                            return this.riskState.pstreak;
                        },
                        percentOfTeo: (lookback = 100) => ((this.riskState.winRateAvg(lookback) / this.calculateTeo()) * 100),
                        winRateAvg: (lookback) => {
                            const data = this.riskState.getWorkingArray(this.riskState.winRates, lookback);

                            if (!Array.isArray(data) || data.length === 0) {
                                return 0; // Return null if input is not a valid array or is empty
                            }

                            const sum = data.reduce((acc, num) => acc + num, 0);
                            return sum / data.length;
                        },

                        getSkipCount: () => this.riskState.hitTargetDelta,

                        update: (result) => {
                            this.riskState.rollCount++;


                            if (result >= this.target) {
                                this.riskState.hitCount++;

                                this.riskState.hitTargetDelta += (this.target - this.riskState.getLosingStreak())


                                if (this.riskState.streak < 0) {
                                    this.riskState.pstreak = this.riskState.streak;
                                }

                                this.riskState.streak = this.riskState.streak >= 1 ? this.riskState.streak + 1 : 1;
                                this.riskState.profitLoss += (this.target * this.riskState.wager) - this.riskState.wager;
                            } else {

                                if (this.riskState.hitTargetDelta > 0) {
                                    this.riskState.hitTargetDelta--;
                                }

                                if (this.riskState.streak > 0) {
                                    this.riskState.pstreak = this.riskState.streak;
                                }

                                this.riskState.streak = this.riskState.streak > 0 ? -1 : this.riskState.streak - 1;
                                this.riskState.profitLoss -= this.riskState.wager;

                                const lsAbs = this.riskState.getLosingStreakAbs();

                                if (lsAbs != 0 && lsAbs % Math.floor(this.target) === 0) {
                                    this.riskState.attemptCount++;
                                }
                            }


                            if (this.riskState.winRates.length === 100) this.riskState.winRates.shift();
                            this.riskState.winRates.push(this.riskState.hitCount / this.riskState.rollCount)
                        },
                        getPL: () => this.riskState.profitLoss
                    };
                }

                getWinRatePercentOfTeo(lookback = 100) {
                    return (this.getWinRate() / this.getTeo()) * 100;
                }

                shouldGoRiskOff(result, lsm) {

                    if (result >= this.target && this.riskState.attemptCount > (Math.ceil(this.target / 100 * 100))) {
                        console.log(`Exeeded attempt count ${this.riskState.attemptCount}, going risk off`);
                        return true;
                    }

                    if (this.riskState.percentOfTeo(100) > 110 && (this.riskState.rollCount >= this.target * 10)) {
                        console.log(`Percent of Teo exeeded ${this.riskState.percentOfTeo(100)}, going risk off`);
                        return true;
                    }

                    if (this.riskState.getPL() >=  (this.riskState.baseWager * (2 * this.target)) - (this.riskState.baseWager * 1.04)) {
                        console.log(`Profit target hit ${this.riskState.getPL()}, going risk off`);
                        return true;
                    }
                    return null;
                }

                getWinRateStdDev() {
                    return this.winRateCount > 1 ?
                        Math.sqrt(this.winRateSumOfSquares / (this.winRateCount - 1)) :
                        0;
                }

                addWinRate(value) {
                    this.winRateCount++;
                    let delta = value - this.winRateMean;
                    let delta2 = value - (this.winRateMean + delta / this.winRateCount);
                    this.winRateMean += delta / this.winRateCount;
                    this.winRateSumOfSquares += delta * delta2;
                }

                removeWinRate(value) {
                    if (this.winRateCount <= 1) {
                        this.winRateCount = 0;
                        this.winRateMean = 0;
                        this.winRateSumOfSquares = 0;
                        return;
                    }
                    this.winRateCount--;
                    let delta = value - this.winRateMean;
                    let delta2 = value - (this.winRateMean - delta / this.winRateCount);
                    this.winRateMean -= delta / this.winRateCount;
                    this.winRateSumOfSquares -= delta * delta2;
                }

                getLosingStreak() {
                    return this.streak < 0 ? this.streak : 0;
                }

                getLosingStreakAbs() {
                    return Math.abs(this.getLosingStreak())
                }

                addResult(result) {
                    if (this.isRiskOn()) {
                        this.updateRiskOnResult(result);
                        return;
                    }
                    this.updateGlobalResult(result);
                }

                updateRiskOnResult(result) {
                    this.riskState.update(result);
                    this.adjustWager();
                    this.updateGlobalResult(result);
                }

                adjustWager() {
                    this.riskState.wager = Math.min(1, this.getProgressiveWager2(this.riskState.baseWager));
                }

                // getProgressiveWager(wager) {
                //     const streak = Math.abs(this.getLosingStreak());

                //     if (streak === 0) return this.riskState.baseWager;

                //     const multiplier = (this.getTeo() / 2);
                //     return (this.riskState.baseWager * multiplier)
                // }


                getProgressiveWager2(baseWager) {

                    const streak = this.riskState.getLosingStreakAbs()
                    
                    if (this.riskState.getPL() < 0 && streak === 0) return this.riskState.wager;

                    const multiplier = this.target !== 0 ? Math.ceil(streak / this.target) : 0
                    return baseWager * (multiplier + this.riskState.attemptCount * 3)
                }

                updateGlobalResult(result) {
                    this.updateStreak(result);
                    this.updateRollingResults(result);
                    this.addWinRate(this.getWinRate());
                }

                updateStreak(result) {
                    if (result >= this.target) {
                        if (this.streak < 0) this.pstreak = this.streak;
                        this.streak = this.streak >= 1 ? this.streak + 1 : 1;
                    } else {
                        if (this.streak > 0) this.pstreak = this.streak;
                        this.streak = this.streak > 0 ? -1 : this.streak - 1;
                    }
                }

                updateRollingResults(result) {
                    this.rollingResults.push(result >= this.target ? 1 : 0);
                    this.maintainBufferSize();
                }

                getWinRate(lookback = 100) {
                    const data = this.rollingResults.slice(-lookback);
                    if (data.length === 0) return 0;
                    return (100 * data.reduce((sum, val) => sum + val, 0)) / data.length;
                }

                getTeo() {
                    if (!this.teoCache) {
                        this.teoCache = 100 / (this.target * 1.04);
                    }
                    return this.teoCache;
                }
            }

            return targets.map(n => new Target(n));
        }
    }


    function evalResult(result) {
        const payout = getPayout()

        ROLL_HANDLER.addResult(result)

        evalRiskState(result)
        evalHalts()
        if (currentRiskOnTarget) {
            handleRiskOnRolling();
        } else {
            handleRiskOffSetup();
        }

        updateUI();
    }

    function handleRiskOffSetup() {
        if (currentRiskOnTarget) return;

        currentRiskOnTarget = getNextRiskOnTarget();

        if (currentRiskOnTarget) {
            setPayout(currentRiskOnTarget.target)

            if (isTestMode()) {
                setWager(0)
            } else {
                setWager(currentRiskOnTarget.riskState.wager);
            }
        }
    }

    function handleRiskOnRolling() {
        // maybeSwitchRiskOnTarget();
        setWager(currentRiskOnTarget.riskState.wager);
    }

    function evalRiskState(result) {
        if (currentRiskOnTarget) {
            if (currentRiskOnTarget.shouldGoRiskOff(result, getLosingStreakMultiplier())) {
                printRiskOnState();
                currentRiskOnTarget.goRiskOff()
                currentRiskOnTarget = null
                setWager(0)
                setPayout(1.01)
            }
        }
    }

    function evalHalts() {
        const maxLoss = getMaxLoss();
        const profitLoss = ROLL_HANDLER.getPL();

        if (profitLoss <= -(maxLoss)) {
            halt(`Max loss exceeded, Max Loss: ${maxLoss}, Total Loss: ${profitLoss}`)
        }
    }

    function getNextRiskOnTarget() {
        const targets = ROLL_HANDLER.getTargets();

        const target = targets.find(target =>
            target.isPotentialRiskOn() && target.isRiskOnReady()
        );

        if (target) {
            target.goRiskOn(getBaseWager());
            return target; // Return the target without removing it
        }

        return null;
    }

    function maybeSwitchRiskOnTarget() {
        if (!currentRiskOnTarget) return;

        if (isRiskOnTargetStruggling(currentRiskOnTarget)) {
            const betterTarget = findBetterRiskOnTarget(currentRiskOnTarget);

            if (betterTarget) {
                console.log(`Switching risk-on target from ${currentRiskOnTarget.target} to ${betterTarget.target}`);
                currentRiskOnTarget.goRiskOff();
                currentRiskOnTarget = betterTarget;
                currentRiskOnTarget.goRiskOn(getWager());
            }
        }
    }

    function isRiskOnTargetStruggling(target) {
        return target.riskState.getLosingStreak() < -Math.floor(target.target / 2) // Example: If losing streak > half of target
            ||
            target.riskState.percentOfTeo(100) < 50; // Example: If win rate is below 80% of expected TEO
    }

    function findBetterRiskOnTarget(currentTarget) {
        return ROLL_HANDLER.getTargets()
            .filter(target => target.isPotentialRiskOn() && target.isRiskOnReady())
            .reduce((best, target) => {
                return (!best || target.getWinRate(100) > best.getWinRate(100)) && target.target > currentTarget.target * 0.9 ?
                    target :
                    best;
            }, null);
    }


    async function queueRiskOnCandidates() {
        const lsm = getLosingStreakMultiplier();
        const minPercentBelowTeo = getMinPercentBelowTeo();
        const targets = ROLL_HANDLER.getPotentialTargets(lsm, minPercentBelowTeo);

        if (targets.length === 0) return;

        await Promise.all(targets.flat().map(target => target.goPotentialRiskOn()));
    }

    function reapInvalidPotentialRiskOnTargets() {
        const targets = ROLL_HANDLER.getTargets();

        targets.forEach(target => {
            if (target.isPotentialRiskOn() && !target.isRiskOnReady()) {
                target.goRiskOff(); // Reset back to risk-off state
            }
        });
    }

    function updateUI() {
        if (currentRiskOnTarget) printRiskOnState();
        $("#profit-loss").text(ROLL_HANDLER.getPL().toFixed(5));
        $("#current-wager").text(currentRiskOnTarget ? currentRiskOnTarget.riskState.wager.toFixed() : 0)
    }

    function printRiskOnState() {
        const teo = currentRiskOnTarget.calculateTeo();
        const shortWinRate = currentRiskOnTarget.riskState.winRateAvg(Math.floor(currentRiskOnTarget.target * 10));
        const shortWinRatePTeo = currentRiskOnTarget.riskState.percentOfTeo(Math.floor(currentRiskOnTarget.target * 20));
        const longWinRate = currentRiskOnTarget.riskState.winRateAvg(Math.floor(currentRiskOnTarget.target * 20));
        const diffWinRate = shortWinRate - longWinRate;
        const longWinRatePTeo = currentRiskOnTarget.riskState.percentOfTeo(Math.floor(currentRiskOnTarget.target * 20));

        console.log("===== Risk On State ====")
        console.log(`Target: ${currentRiskOnTarget.target},
            Win Rate Short: ${shortWinRate.toFixed(2)},
            Win Rate Long: ${longWinRate.toFixed(2)}  (${shortWinRatePTeo.toFixed(2)}),
            Win Rate Diff: ${diffWinRate.toFixed(2)} (${longWinRatePTeo.toFixed(2)}),
            LS: ${currentRiskOnTarget.riskState.getLosingStreak()},
            Wager: ${currentRiskOnTarget.riskState.wager}, 
            P/L: ${currentRiskOnTarget.riskState.profitLoss.toFixed(5)},
            Total P/L: ${ROLL_HANDLER.getPL().toFixed(5)}`

        )
        console.log("====================")
    }

    function halt(stopMessage) {
        console.log(stopMessage)
        setMessage(stopMessage)
        SESSION.stop()
        stopMessage = ""
        stopBetting()
        return
    }

    function setMessage(message) {
        console.log(message)
        // $("#message").html(message)
    }

    async function processRiskOnQueue() {
        while (true) {
            reapInvalidPotentialRiskOnTargets(); // Cleanup invalid targets
            await queueRiskOnCandidates();
            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay before next cycle
        }
    }

    function isTestMode() {
        return $("#test-mode").prop("checked")
    }

    function getLosingStreakMultiplier() {
        return Number($("#ls-multiplier").val())
    }


    function getStartTarget() {
        return Number($("#target-start").val())
    }

    function getMaxTarget() {
        return Number($("#target-max").val())
    }

    function getTargetStep() {
        return Number($("#target-step").val())
    }

    function getMaxLoss() {
        return Number($("#max-loss").val())
    }

    function getMinPercentBelowTeo() {
        return Number($("#min-percent-below-teo").val())
    }

    function getBaseWager() {
        return Number($("#base-wager").val())
    }


    // Simple Moving Average (SMA) function
    function calculateSMA(data, period = 5) {
        if (data.length < period) return data // Not enough data to smooth

        let smoothed = []
        for (let i = 0; i <= data.length - period; i++) {
            let subset = data.slice(i, i + period)
            let avg = subset.reduce((sum, val) => sum + val, 0) / subset.length
            smoothed.push(avg)
        }

        return smoothed
    }

    // Make dynamic depending on specific script
    function getTargetConfiguration() {
        let config = {};

        config.start = 3
        config.step = 1
        config.length = 17;
        return config;
    }



    /********************* Framework *********************/

    const ROLL_HANDLER = new RollHandler();
    const SESSION = defaultSession();
    let lastRollSet = []
    let currentRollSet = []
    let currentRiskOnTarget = null

    function defaultSession() {
        return {
            sessionRollCount: 0,
            state: 0,
            profitLoss: 0,
            start: function() {
                this.state = 1
            },
            stop: function() {
                this.state = 0;
            },
            isStopped: function() {
                return this.state === 0
            },
            isRunning: function() {
                return this.state === 1;
            }
        }
    }

    // Utility function: Get current roll data
    function getCurrentRollData() {
        return $(".grid.grid-auto-flow-column div span")
            .map(function() {
                return $(this).text()
            })
            .get()
    }

    // Function to start the betting process
    function startBetting() {
        const config = getTargetConfiguration();
        const currentConfig = ROLL_HANDLER.getConfig();

        if (JSON.stringify(config) !== JSON.stringify(currentConfig)) {
            ROLL_HANDLER.setConfig(config);
        }

        setWager(0)
        SESSION.start();
        doBet() // Start the async loop
    }

    function stopBetting() {
        SESSION.stop();
    }

    function getPayout() {
        const payoutFieldGroup = $('div[role="group"]').has(
            'label:contains("Payout")',
        )
        const inputField = payoutFieldGroup.find("input")

        return Number(inputField.val())
    }

    function setPayout(amount) {
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

    function setWager(amount) {
        const payoutFieldGroup = $('div[role="group"]').has(
            'label:contains("Amount")'
        );
        const inputField = payoutFieldGroup.find("input");

        if (inputField.length) {
            const currentValue = parseFloat(inputField.val());

            if (currentValue !== amount) { // Only set if different
                let nativeSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype,
                    "value"
                ).set;

                nativeSetter.call(inputField[0], amount);
                inputField[0].dispatchEvent(new Event("input", {
                    bubbles: true
                }));
                inputField[0].dispatchEvent(new Event("change", {
                    bubbles: true
                }));
                // console.log(`Wager set to: ${amount}`);
            }
        } else {
            console.error("Wager input field not found!");
        }
    }

    function getWager() {
        const payoutFieldGroup = $('div[role="group"]').has('label:contains("Amount")', )
        const inputField = payoutFieldGroup.find("input")
        return Number(inputField.val())
    }

    function doInit() {
        observeRollChanges()
        initPrototypes()
        initUI();
        bindHotKeys()
    }

    function setBaseWager() {
        baseWager = getWager();
        baseWager = baseWager === 0 ? 0.0001 : baseWager;
    }

    function initUI() {
        $(document).ready(function() {
            $("#wagering-panel").draggable({
                handle: "#wagering-header", // Only drag from the header
                containment: "window", // Prevent dragging out of the viewport
                scroll: false
            });
        });
    }

    function initPrototypes() {
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

    }

    function bindHotKeys() {
        $(document).on("keypress", function(e) {
            if (e.which === 122) {
                if (SESSION.isStopped()) {
                    startBetting()
                } else {
                    stopBetting()
                }
            }
        })
    }

    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    async function doBet() {
        while (SESSION.isRunning()) {
            // Trigger the button click

            $(".button-brand:first").trigger("click")

            // Wait for 1 second (1000 ms) before clicking again
            await delay(10)

            // Stop condition check inside the loop
            if (SESSION.isStopped()) {
                console.log("Stopped betting.")
                return // Break the loop if stop is true
            }
        }
    }

    // Utility function: Extract the last roll result
    function getRollResult() {
        const temp = lastRollSet
        lastRollSet = currentRollSet
        currentRollSet = temp
        currentRollSet.length = 0

        currentRollSet = $(".grid.grid-auto-flow-column div span")
            .map(function() {
                return Number($(this).text().replace("x", ""))
            })
            .get()

        if (arraysAreEqual(currentRollSet, lastRollSet)) {
            return -1
        }

        return currentRollSet[currentRollSet.length - 1]
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
        if (arr1.length !== arr2.length) return false
        return arr1.every((value, index) => value === arr2[index])
    }

    function waitForSelector(selector) {
        const pause = 10 // Interval between checks (milliseconds)
        let maxTime = 50000 // Maximum wait time (milliseconds)

        return new Promise((resolve, reject) => {
            function inner() {
                if (maxTime <= 0) {
                    reject(
                        new Error("Timeout: Element not found for selector: " + selector),
                    )
                    return
                }

                // Try to find the element using the provided selector
                const element = document.querySelector(selector)
                if (element) {
                    resolve(element)
                    return
                }

                maxTime -= pause
                setTimeout(inner, pause)
            }

            inner()
        })
    }

    doInit();
    processRiskOnQueue()
})()