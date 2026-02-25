registerTest("permission_structure", (() => {
  const K = 20;                 // horizon to observe
  const RED_RATIO = 0.90;       // WR_S/TEO below this counts as "red"
  const MIN_RED = 5;            // how many reds required

  let wasOn = false;
  const pending = [];           // { entryRoll, snapshots: [] }
  
  console.log("Successfully registered permission structure test");

  function getRowShortRatio(targetRow) {
    // You need to adapt this accessor to your TARGETS structure.
    // Expectation: targetRow has .wrShort and .teo (or equivalents).
    if (!targetRow) return null;

    const wrS = targetRow.wrShort ?? targetRow.wrS ?? targetRow.shortWR ?? null;
    const teo = targetRow.teo ?? targetRow.TEO ?? null;

    if (wrS == null || teo == null || teo <= 0) return null;
    return wrS / teo;
  }

  return function (ctx) {

    const { rollCount, targets } = ctx;

    // --- compute permission ON/OFF ---
    let redCount = 0;
    let depths = [];

    for (const target of targets) {
      const row = target.getPayout();
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
        // summarize: how many >=2 hits in next K rolls (you can expand later)
        const hits2 = ev.results.filter(x => x >= 2).length;
        const wr2 = hits2 / K;

        console.log(
          `[PERM K=${K}] entry=${ev.entryRoll} wr2=${wr2.toFixed(3)} (hits=${hits2}/${K}) redCount=${ev.redCount} avgDepth=${ev.avgDepth.toFixed(3)}`
        );

        pending.splice(i, 1);
      }
    }
  };
})());