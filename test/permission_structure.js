registerTest("permission_structure", (() => {
  const K = 1000;                 // horizon to observe
  const RED_RATIO = 0.90;       // WR_S/TEO below this counts as "red"
  const MIN_RED = 5;            // how many reds required

  let wasOn = false;
  const pending = [];           // { entryRoll, snapshots: [] }
  
  const PERM_SUMMARY = {
    totalEvents: 0,
    totalWr2: 0,
    totalHits2: 0,
    totalRollsObserved: 0,
    positiveWindows: 0
  };

  const BASELINE_P2 = 1 / (2 * 1.01);

  console.log("Successfully registered permission structure test");

  function getRowShortRatio(targetRow) {
    // You need to adapt this accessor to your TARGETS structure.
    // Expectation: targetRow has .wrShort and .teo (or equivalents).
    if (!targetRow) return null;

    const wrS = targetRow.stats.getWinRate(targetRow.shortWindow);
    const teo = targetRow.getTeo();

    if (wrS == null || teo == null || teo <= 0) return null;
    return wrS / teo;
  }

  return function (ctx) {

    const { rollCount, targets } = ctx;

    // --- compute permission ON/OFF ---
    let redCount = 0;
    let depths = [];

    for (const row of targets) {
      const ratio = getRowShortRatio(row);
      if (ratio == null) continue;

      if (ratio < RED_RATIO) {
        redCount++;
        depths.push(1 - ratio);
      }
    }

    const avgDepth = depths.length ? depths.reduce((a,b)=>a+b,0) / depths.length : 0;
    const on = redCount >= MIN_RED;

    // detect OFF -> ON
    if (!wasOn && on) {
      pending.push({ entryRoll: rollCount, redCount, avgDepth, results: [] });
      console.log(`[PERM ON] roll=${rollCount} redCount=${redCount} avgDepth=${avgDepth.toFixed(3)}`);
    }

    wasOn = on;

    // settle any pending observations after K rolls
    for (let i = pending.length - 1; i >= 0; i--) {
      const ev = pending[i];
      const age = rollCount - ev.entryRoll;

      if (age > 0 && age <= K) {
        ev.results.push(ctx.result);
      }

      if (age === K) {

        const hits2 = ev.results.filter(x => x >= 2).length;
        const wr2 = hits2 / K;

        // ---- accumulate ----
        PERM_SUMMARY.totalEvents++;
        PERM_SUMMARY.totalWr2 += wr2;
        PERM_SUMMARY.totalHits2 += hits2;
        PERM_SUMMARY.totalRollsObserved += K;

        if (wr2 > BASELINE_P2) {
          PERM_SUMMARY.positiveWindows++;
        }

        const avgWr2 = PERM_SUMMARY.totalWr2 / PERM_SUMMARY.totalEvents;
        const positiveRate = PERM_SUMMARY.positiveWindows / PERM_SUMMARY.totalEvents;

        console.log(
          `[PERM EVENT ${PERM_SUMMARY.totalEvents}] wr2=${wr2.toFixed(3)} | ` +
          `avgWr2=${avgWr2.toFixed(3)} | ` +
          `positiveRate=${(positiveRate*100).toFixed(1)}% | ` +
          `baseline=${BASELINE_P2.toFixed(3)}`
        );

        pending.splice(i, 1);
      }
    }
  };
})());