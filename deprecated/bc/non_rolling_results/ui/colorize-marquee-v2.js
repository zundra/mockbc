// ==UserScript==
// @name        Colorize Marquee V2 (+Vertical Convergence Pop)
// @namespace   http://tampermonkey.net/
// @version     2025-08-12
// @description Color marquee <1.92x and POP tiles that also extend hot vertical streaks
// @author      You
// @match       https://*/game/limbo
// @icon        https://www.google.com/s2/favicons?sz=64&domain=bc.app
// @grant       none
// ==/UserScript==

(() => {
  // ===== CONFIG =====
  const H_THRESHOLD = 1.92;      // your baseline for horizontal color
  const V_THRESH = 10;           // vertical streak depth to consider "hot" (tweak)
  const V_PAYOUTS = [2,3,4,5,6,7,8,9,10]; // which payout rows to consider for vertical heat

  // ===== STYLE =====
  const injectStyle = () => {
    if (document.getElementById('bcg-low-style')) return;
    const style = document.createElement('style');
    style.id = 'bcg-low-style';
    style.textContent = `
      .bcg-low { background-color: #b3261e !important; color: #fff !important; }
      .bcg-both {
        background-color: #ff3b30 !important;
        color: #fff !important;
        box-shadow: 0 0 0.5rem rgba(255,59,48,0.7), 0 0 1.25rem rgba(255,59,48,0.35) !important;
        transform: translateZ(0); /* kick GPU for smoother anim */
        animation: bcg-pulse 1.2s ease-in-out infinite;
      }
      @keyframes bcg-pulse {
        0%   { box-shadow: 0 0 0.35rem rgba(255,59,48,0.6), 0 0 1rem rgba(255,59,48,0.25); }
        50%  { box-shadow: 0 0 0.9rem rgba(255,59,48,0.9),  0 0 1.6rem rgba(255,59,48,0.45); }
        100% { box-shadow: 0 0 0.35rem rgba(255,59,48,0.6), 0 0 1rem rgba(255,59,48,0.25); }
      }
    `;
    document.head.appendChild(style);
  };

  // ===== UTILS =====
  const parseNum = (t) => {
    const v = parseFloat(String(t || '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(v) ? v : null;
  };

  // Read your #output-table and build a set of "hot" payouts
  // A tile with value v "extends" payout P if v < P (i.e., a miss for that target).
  const getHotPayouts = () => {
    const hot = [];
    const tbody = document.querySelector('#output-table tbody');
    if (!tbody) return hot;

    // Build a quick map payout->abs(streak)
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 2) return;
      const payoutTxt = (tds[0].textContent || '').trim(); // e.g. "3.00x"
      const streakEl = tds[1].querySelector('span');
      const streak = parseNum(streakEl?.textContent);
      const payout = parseNum(payoutTxt);
      if (payout !== null && streak !== null) {
        if (V_PAYOUTS.includes(payout) && Math.abs(streak) >= V_THRESH) {
          hot.push(payout); // store numeric payout like 3,4,5...
        }
      }
    });

    // Sort ascending for quick comparisons
    hot.sort((a,b) => a - b);
    return hot;
  };

  // ===== COLORIZE =====
  const recolor = () => {
    const hotPayouts = getHotPayouts();

    document.querySelectorAll('.grid.grid-auto-flow-column .btn-like').forEach(tile => {
      const v = parseNum(tile.textContent);
      tile.classList.remove('bcg-low','bcg-both');

      if (v === null) return;

      // Horizontal rule: mark red if < 1.92
      if (v < H_THRESHOLD) {
        // If this tile is also a miss for ANY hot payout (v < P), then pop it
        const converges = hotPayouts.length > 0 && hotPayouts.some(P => v < P);
        if (converges) {
          tile.classList.add('bcg-both');
        } else {
          tile.classList.add('bcg-low');
        }
      }
    });
  };

  // ===== OBSERVE =====
  const startObserver = () => {
    const grids = document.querySelectorAll('.grid.grid-auto-flow-column');
    const tableBody = document.querySelector('#output-table tbody');

    if (!grids.length && !tableBody) return;

    const onMut = () => {
      if (startObserver._raf) cancelAnimationFrame(startObserver._raf);
      startObserver._raf = requestAnimationFrame(recolor);
    };

    const obsOpts = { childList: true, subtree: true, characterData: true };
    const observers = [];

    grids.forEach(g => {
      const mo = new MutationObserver(onMut);
      mo.observe(g, obsOpts);
      observers.push(mo);
    });

    if (tableBody) {
      const mo = new MutationObserver(onMut);
      mo.observe(tableBody, obsOpts);
      observers.push(mo);
    }

    // expose for debugging if needed
    window.__bcgObservers = observers;
  };

  injectStyle();
  recolor();
  startObserver();
})();
