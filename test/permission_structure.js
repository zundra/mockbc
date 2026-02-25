registerTest("permission_structure", (() => {
  const K = 1000;                 // horizon to observe
  const RED_RATIO = 0.90;       // WR_S/TEO below this counts as "red"
  const MIN_RED = 5;            // how many reds required

  let wasOn = false;
  const pending = [];           // { entryRoll, snapshots: [] }
  
  const PERM_HISTORY = [];
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

        PERM_HISTORY.push({
          event: PERM_HISTORY.length + 1,
          entryRoll: ev.entryRoll,
          wr2: Number(wr2.toFixed(3)),
          baseline: Number(BASELINE_P2.toFixed(3)),
          redCount: ev.redCount,
          avgDepth: Number(ev.avgDepth.toFixed(3))
        });

        // compute running aggregates
        const avgWr2 = PERM_HISTORY.reduce((s,e)=>s+e.wr2,0) / PERM_HISTORY.length;
        const positiveRate =
          PERM_HISTORY.filter(e => e.wr2 > BASELINE_P2).length /
          PERM_HISTORY.length;

        // attach aggregates to last row only (clean display)
        PERM_HISTORY[PERM_HISTORY.length - 1].avgWr2 =
          Number(avgWr2.toFixed(3));
        PERM_HISTORY[PERM_HISTORY.length - 1].positiveRate =
          Number((positiveRate * 100).toFixed(1));

        console.clear();
        console.table(PERM_HISTORY);

        pending.splice(i, 1);
      }
    }
  };
})());