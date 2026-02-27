// ==UserScript==
// @name         bc.game bands v1
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Disjoint bands + ≥target stats with EWMA (4% edge)
// @author       You
// @match        https://*/game/limbo
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  /********** Config **********/
  // --- Signal thresholds ---
  const MIN_HITS = 20; // N_eff * p_teo must be >= this
  const Z_HOT = 2.0; // fast z must be >= this
  const Z_RISE = 0.75; // fast - slow z must be >= this
  const Z_NEIGHBOR_COLD = -1.5; // neighbor band fast z <= this
  const EDGE = 0.04; // 4% house edge
  const HALF_LIFE = 2000; // rolls; EWMA half-life (acts like a soft window)

  /********** OutcomeStats (bands + ≥target) **********/
  class OutcomeStats {
    constructor({
      edge = EDGE,
      targets = [2, 3, 5, 8, 10, 20, 50, 100, 500, 1000, 5000, 10000],
      bands = OutcomeStats.logSpacedBands(1.01, 10000, 1.6),
      halfLife = HALF_LIFE
    } = {}) {
      this.edge = edge;
      this.setTargets(targets);
      this.setHalfLife(halfLife);
      this.setBands(bands);
      this.rollCount = 0;
      this.S = new Float64Array(this.bands.length); // decayed hits per band
      this.N = new Float64Array(this.bands.length); // decayed trials
    }

    static logSpacedBands(start = 1.01, stop = 10000, ratio = 1.6) {
      const out = [];
      let lo = start,
        hi = Math.max(start * ratio, start + 1e-6);
      while (lo < stop) {
        out.push([lo, Math.min(hi, stop)]);
        lo = hi;
        hi = hi * ratio;
        if (!isFinite(hi)) break;
      }
      out.push([Math.max(out[out.length - 1][1], stop), Infinity]); // tail
      return out;
    }

    setTargets(targets) {
      this.targets = [...targets].sort((a, b) => a - b);
      this.wins_ge = Object.fromEntries(this.targets.map((t) => [t, 0]));
    }
    setHalfLife(H) {
      this.halfLife = Math.max(1, H);
      this.lambda = Math.log(2) / this.halfLife;
      this.keep = 1 - this.lambda;
    }
    setBands(bands) {
      this.bands = [...bands]
        .map(([lo, hi]) => [Number(lo), Number(hi)])
        .sort((a, b) => a[0] - b[0]);
      this.P_BAND = new Float64Array(this.bands.length);
      for (let i = 0; i < this.bands.length; i++) {
        const [lo, hi] = this.bands[i];
        const p = this.P_ge(lo) - (isFinite(hi) ? this.P_ge(hi) : 0);
        this.P_BAND[i] = Math.max(0, p);
      }
      this.S = new Float64Array(this.bands.length);
      this.N = new Float64Array(this.bands.length);
    }

    // Tail probability: Pr[mult ≥ x] = (1 - edge) / x
    P_ge(x) {
      return Math.max(0, Math.min(1, (1 - this.edge) / x));
    }

    bandIndex(mult) {
      for (let i = 0; i < this.bands.length; i++) {
        const [lo, hi] = this.bands[i];
        if (mult >= lo && mult < hi) return i;
      }
      return this.bands.length - 1;
    }

    onRoll(mult) {
      this.rollCount++;
      // ≥target counters (profit lens)
      for (let i = 0; i < this.targets.length; i++) {
        if (mult >= this.targets[i]) this.wins_ge[this.targets[i]]++;
        else break;
      }
      // Disjoint band EWMA (state lens)
      const idx = this.bandIndex(mult);
      for (let i = 0; i < this.bands.length; i++) {
        this.S[i] = this.S[i] * this.keep + (i === idx ? 1 : 0);
        this.N[i] = this.N[i] * this.keep + 1;
      }
    }

    bandSnapshot() {
      const rows = [];
      for (let i = 0; i < this.bands.length; i++) {
        const p = this.P_BAND[i];
        const Neff = this.N[i];
        const p_hat = Neff > 0 ? this.S[i] / Neff : 0;
        const varp = Math.max((p * (1 - p)) / Math.max(Neff, 1), 1e-18);
        const z = (p_hat - p) / Math.sqrt(varp);
        rows.push({ band: this.bands[i], p_teo: p, p_hat, Neff, z });
      }
      return rows;
    }
  }

  /********** Your original skeleton **********/
  const fast = new OutcomeStats({ halfLife: 400 });
  const slow = new OutcomeStats({ halfLife: 4000 });
  const stats = new OutcomeStats(); // NEW: stats engine
  const targets = generateTargets(); // your legacy targets; safe to leave as-is

  let lastRollSet = [];
  let currentRollSet = [];

  injectUIElements();
  initWindowEvents();
  doInit();

  // No-op so this file runs standalone even if not defined elsewhere
  function configureMarqueeColorization() {}

function evalResult(result) {
  if (result === -1) return;
  fast.onRoll(result);   // FEED fast
  slow.onRoll(result);   // FEED slow
  updateUI();
}

  function updateUI() {
    renderUI();
  }

function renderUI() {
  const { states, go, watch, fRows, sRows } = computeSignals();

  const $table = $("#bands-output-table");
  const head = `...`;

  const body = `
    <tbody>
      ${states.map(st => {
        const r = fRows[st.i];
        const cls = !st.gating ? "gated"
                  : st.go ? "go"
                  : st.watch ? "watch"
                  : (r.z <= -2 ? "cold" : "");
        const pill = !st.gating ? `<span class="pill none">GATED</span>`
                  : st.go ? `<span class="pill go">GO</span>`
                  : st.watch ? `<span class="pill watch">WATCH</span>`
                  : (r.z <= -2 ? `<span class="pill cold">COLD</span>` : `<span class="pill none">—</span>`);

        return `
          <tr class="${cls}">
            <td style="text-align:left;">${bandLabel(r.band)}</td>
            <td>${pct(r.p_hat)}</td>
            <td>${pct(r.p_teo)}</td>
            <td>${pct(r.p_hat - r.p_teo)}</td>
            <td>${fmt(r.z,2)}</td>
            <td>${fmt(r.Neff,0)}</td>   <!-- FIX here -->
            <td style="text-align:left;">${pill}
              <span style="opacity:.6; margin-left:6px;">
                ${st.gating
                  ? `Δz=${fmt(r.z - sRows[st.i].z, 2)}${st.neighborCold ? ' · neighbor cold' : ''}`
                  : `need ≥ ${MIN_HITS} eff hits`}
              </span>
            </td>
          </tr>`;
      }).join("")}
    </tbody>`;

  $table.html(head + body);

   // signals list (top 5)
    const sigsElId = "#bands-signals";
    if (!document.querySelector(sigsElId)) {
      $("#sv-stats-panel").append(
        `<div id="bands-signals" style="margin-top:8px;"></div>`
      );
    }
    const sigHtml = go.length
      ? go
          .slice(0, 5)
          .map(
            (s) =>
              `<div class="mono" style="margin-top:6px;">
           <span class="pill go">GO</span> ≥ <b>${fast.bands[s.i][0].toFixed(
             2
           )}x</b>
           <span style="opacity:.7;">(${bandLabel(fast.bands[s.i])})</span>
           — z=${fmt(s.f.z, 2)}, Δz=${fmt(s.f.z - s.s.z, 2)}
         </div>`
          )
          .join("")
      : watch.length
      ? watch
          .slice(0, 5)
          .map(
            (s) =>
              `<div class="mono" style="margin-top:6px;">
               <span class="pill watch">WATCH</span> ≥ <b>${fast.bands[
                 s.i
               ][0].toFixed(2)}x</b>
               <span style="opacity:.7;">(${bandLabel(fast.bands[s.i])})</span>
               — z=${fmt(s.f.z, 2)}, Δz=${fmt(s.f.z - s.s.z, 2)}
             </div>`
          )
          .join("")
      : `<div class="mono" style="margin-top:6px; opacity:.7;">No signals</div>`;

    $("#bands-signals").html(`<div class="rowhead">Signals</div>${sigHtml}`);
}

function computeSignals() {
  const fRows = fast.bandSnapshot();
  const sRows = slow.bandSnapshot();

  const states = fRows.map((f, i) => {
    const s = sRows[i];

    // FIX: use Neff (not N_eff)
    const hitsEff = f.Neff * f.p_teo;
    const gating = hitsEff >= MIN_HITS;

    const hotNow = f.z >= Z_HOT;
    const rising = (f.z - s.z) >= Z_RISE;

    const neighborCold =
      (i > 0 && fRows[i - 1].z <= Z_NEIGHBOR_COLD) ||
      (i < fRows.length - 1 && fRows[i + 1].z <= Z_NEIGHBOR_COLD);

    const go = gating && hotNow && rising && neighborCold;
    const watch = !go && gating && (hotNow || rising) && neighborCold;

    return { i, f, s, hitsEff, gating, hotNow, rising, neighborCold, go, watch };
  });

  if (states.some(x => x.go)) setHeaderMode("live");
  else if (states.some(x => x.watch)) setHeaderMode("watch");
  else setHeaderMode("none");

  const go = states.filter(x => x.go)
                   .sort((a,b) => (b.f.z - b.s.z) - (a.f.z - a.s.z));
  const watch = states.filter(x => x.watch)
                      .sort((a,b) => (b.f.z - b.s.z) - (a.f.z - a.s.z));

  // RETURN sRows so render can reuse it
  return { states, go, watch, fRows, sRows };
}


  function bandLabel([lo, hi]) {
    return isFinite(hi)
      ? `[${fmt(lo, 2)} – ${fmt(hi, 2)})`
      : `[${fmt(lo, 2)} +)`;
  }
  function fmt(n, d = 2) {
    return Number.isFinite(n) ? n.toFixed(d) : "—";
  }
  function pct(n, d = 2) {
    return Number.isFinite(n) ? (n * 100).toFixed(d) + "%" : "—";
  }

  function setHeaderMode(mode) {
    const el = $("#sv-stats-panel-header");
    el.removeClass("mode-live mode-watch mode-none").addClass(
      mode === "live"
        ? "mode-live"
        : mode === "watch"
        ? "mode-watch"
        : "mode-none"
    );
  }

  // Utility function: Get current roll data
  function getCurrentRollData() {
    return $(".grid.grid-auto-flow-column div span")
      .map(function () {
        return $(this).text();
      })
      .get();
  }

  function initWindowEvents() {
    $("#sv-stats-panel").draggable({
      containment: "window",
      scroll: false
    });
  }

  function initPrototypes() {
    Array.prototype.last = function () {
      return this[this.length - 1];
    };
    Array.prototype.first = function () {
      return this[0];
    };
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function doInit() {
    observeRollChanges();
    configureMarqueeColorization();
  }

  function generateTargets() {
    class Target {
      constructor(payout) {
        this.payout = payout;
        this.teo = 1 / (this.payout * 1.04);
        this.streak = 0;
        this.pstreak = 0;
        this.hitCount = 0;
        this.rollCount = 0;
      }
      getPayout() {
        return this.payout;
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
      getStreak = () => this.streak;
      getLosingStreak = () => (this.streak < 0 ? this.streak : 0);
      getTeo = () => this.teo;
      getHitCount = () => this.hitCount;
      getRollCount = () => this.rollCount;
      getHTMLID = () =>
        this.payout
          .toString()
          .replace(/\./g, "_")
          .replace(/[^\w-]/g, "");
    }
    return generatePayouts().map((payout) => new Target(payout));
  }

  function generatePayouts() {
    return [
      1.01,
      1.1,
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
      10,
      15,
      20,
      25,
      30,
      40,
      50,
      60,
      70,
      80,
      90,
      100,
      200,
      300,
      400,
      500,
      1000,
      2000,
      3000,
      4000,
      5000,
      10000,
      25000,
      50000,
      100000,
      500000,
      1000000
    ];
  }

  // Extract last roll result
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

    if (arraysAreEqual(currentRollSet, lastRollSet)) return -1;
    return currentRollSet[currentRollSet.length - 1];
  }

  // MutationObserver to watch the roll grid
  let observer = null;
  async function observeRollChanges() {
    const gridElement = await waitForSelector(".grid.grid-auto-flow-column");
    let previousRollData = getCurrentRollData();
    if (observer) observer.disconnect();

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
      if (rollDataChanged) evalResult(getRollResult());
    });

    observer.observe(gridElement, { childList: true, subtree: true });
  }

  function arraysAreEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((value, index) => value === arr2[index]);
  }

  function waitForSelector(selector) {
    const pause = 10,
      maxWait = 50000;
    let left = maxWait;
    return new Promise((resolve, reject) => {
      (function poll() {
        if (left <= 0) return reject(new Error("Timeout: " + selector));
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        left -= pause;
        setTimeout(poll, pause);
      })();
    });
  }

  function injectUIElements() {
    $("<style>")
      .prop("type", "text/css")
      .html(
        `
      #sv-stats-panel-header { background:#333; padding:12px; font-weight:bold; text-align:center; border-radius:8px 8px 0 0; font-size:16px; cursor:grab; }
      #sv-stats-panel { position:fixed; top:200px; right:100px; z-index:9999; background:#1e1e1e; color:#fff; padding:16px; width:520px; border-radius:10px; box-shadow:0 4px 15px rgba(0,0,0,0.4); font-family:Arial,sans-serif; font-size:14px; line-height:1.6; cursor:grab; }
      #bands-output-table { width:100%; border-collapse:collapse; }
      #bands-output-table th, #bands-output-table td { padding:6px 8px; border-bottom:1px solid #333; text-align:right; }
      #bands-output-table th { color:#bbb; position:sticky; top:0; background:#1a1a1a; }
      /* row color states */
#bands-output-table tr.go    { background: rgba(18, 64, 36, 0.65); }
#bands-output-table tr.watch { background: rgba(74, 64, 16, 0.55); }
#bands-output-table tr.cold  { background: rgba(86, 22, 22, 0.60); }
#bands-output-table tr.gated { opacity: 0.45; }

.pill { display:inline-block; padding:2px 6px; border-radius:999px; font-size:11px; font-weight:600; }
.pill.go    { background:#1e6f3e; color:#c8f6d5; }
.pill.watch { background:#6d5d1c; color:#fff0b3; }
.pill.cold  { background:#6f1d1d; color:#ffd0d0; }
.pill.none  { background:#2f2f2f; color:#bbb; }

/* header modes */
#sv-stats-panel-header.mode-live  { background:#184a2c !important; }
#sv-stats-panel-header.mode-watch { background:#4a3f18 !important; }
#sv-stats-panel-header.mode-none  { background:#333 !important; }

    `
      )
      .appendTo("head");

    const uiHTML = `
      <div id="sv-stats-panel">
        <div id="sv-stats-panel-header">📊 Bands (EWMA half-life ${HALF_LIFE})</div>
        <div style="background:#1e1e1e; border:1px solid #333; border-radius:6px; padding:10px; margin-top:10px; color:#ccc; overflow-x:auto;">
          <table id="bands-output-table"><tbody></tbody></table>
        </div>
      </div>`;
    $("body").prepend(uiHTML);

    $("#sv-stats-panel").draggable({
      containment: "window",
      scroll: false,
      handle: "#sv-stats-panel-header"
    });
  }


})();

