// --- Signal Lab: online conditional-lift validator ---
const SignalLab = (() => {
  const THRESHOLDS = [1.92, 3, 4, 5, 10]; // test these Ts
  const W = 12;                            // window length
  const EPS = 0.008;                       // min lift over baseline (0.8%)
  const Z = 1.96;                          // ~95% Wilson CI

  // theoretical baseline p_T ≈ 1 - 0.96/T
  const p0 = T => Math.max(0, Math.min(1, 1 - 0.96 / T));

  // choose cluster size C slightly above expected hits in W
  const Cmap = Object.fromEntries(
    THRESHOLDS.map(T => {
      const expHits = p0(T) * W;
      return [T, Math.max(1, Math.ceil(expHits) + 2)];
    })
  );

  // per-T state
  const state = Object.fromEntries(
    THRESHOLDS.map(T => [T, {
      buf: Array(W).fill(0), idx: 0, filled: 0,
      prevTrigger: false,
      n: 0, x: 0, // counts of (triggered, and next <T)
      valid: false
    }])
  );

  // Wilson lower bound
  const wilsonLB = (x, n) => {
    if (n === 0) return 0;
    const phat = x / n;
    const denom = 1 + (Z*Z)/n;
    const centre = phat + (Z*Z)/(2*n);
    const rad = Z * Math.sqrt((phat*(1-phat) + (Z*Z)/(4*n)) / n);
    return Math.max(0, (centre - rad) / denom);
  };

  // feed one new outcome value (multiplier)
  function push(value) {
    for (const T of THRESHOLDS) {
      const s = state[T];
      const hit = value < T ? 1 : 0;

      // if previous step had trigger, this value resolves it
      if (s.prevTrigger) {
        s.n += 1;
        s.x += hit;
        const lb = wilsonLB(s.x, s.n);
        s.valid = (lb > p0(T) + EPS);
        s.prevTrigger = false; // consumed
      }

      // update buffer
      s.buf[s.idx] = hit;
      s.idx = (s.idx + 1) % W;
      if (s.filled < W) s.filled++;

      // compute current trigger for *next* step
      const sum = s.buf.reduce((a,b)=>a+b, 0);
      const triggerNow = (s.filled === W) && (sum >= Cmap[T]);
      // set flag so *next* incoming value will evaluate it
      s.prevTrigger = s.prevTrigger || triggerNow;
    }
  }

  // is signal considered valid right now for a given T?
  function isValid(T) { return !!state[T]?.valid; }

  // Expose internals for debug
  function debug() { return { state, Cmap, p0: Object.fromEntries(THRESHOLDS.map(T=>[T,p0(T)])) }; }

  return { push, isValid, debug, THRESHOLDS };
})();
