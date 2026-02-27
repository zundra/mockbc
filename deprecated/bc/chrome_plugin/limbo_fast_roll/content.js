let dashboardPort = null;

chrome.runtime.onConnect.addListener((port) => {
  console.log("CONTENT ADDED LISTENER FOR PORT", port);
  
  if (port.name === "dashboard-connection") {
    dashboardPort = port;
    console.log("✅ Dashboard connected");

    port.onDisconnect.addListener(() => {
      console.log("❌ Dashboard disconnected");
      dashboardPort = null;
    });

    port.onMessage.addListener((msg) => {
      switch (msg.type) {
        case "start-betting":
          startBetting();
          break;
        case "stop-betting":
          stopBetting();
          break;
        case "set-wager":
          setWager(msg.value);
          break;
        case "get-stats":
          port.postMessage({
            type: "stats-update",
            rollCount,
            highHit,
            highHitLosingStreak,
            hitCount,
            profit,
            losingStreak,
            losingStreak1,
            losingStreak2,
            losingStreak3,
            losingStreak4,
            losingStreak5
          });
          break;
      }
    });
  }
});

(function () {
  "use strict";

  let lastRollSet = [];
  let currentRollSet = [];
  let observer = null;

  // Fields
  let watchPayout1Field = null;
  let watchPayout2Field = null;
  let watchPayout3Field = null;
  let watchPayout4Field = null;
  let watchPayout5Field = null;

  // Stats
  let rollCount = 0;
  let losingStreak = 0;
  let stopped = true;
  let hitCount = 0;
  let profit = 0;
  let highHit = 0;
  let highHitRound = 0;
  let losingStreak1 = 0;
  let losingStreak2 = 0;
  let losingStreak3 = 0;
  let losingStreak4 = 0;
  let losingStreak5 = 0;
  let highHitLosingStreak = 0;

  function evalResult(result) {
    if (result !== -1) {
      updateStats(result);
      pushStatsToDashboard();
    }
  }

  function updateStats(result) {
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

    setStreaks(result);
  }

  function setStreaks(result) {
    if (result >= getWatchPayout1()) {
      losingStreak1 = 0;
    } else {
      losingStreak1++;
    }

    if (result >= getWatchPayout2()) {
      losingStreak2 = 0;
    } else {
      losingStreak2++;
    }

    if (result >= getWatchPayout3()) {
      losingStreak3 = 0;
    } else {
      losingStreak3++;
    }

    if (result >= getWatchPayout4()) {
      losingStreak4 = 0;
    } else {
      losingStreak4++;
    }

    if (result >= getWatchPayout5()) {
      losingStreak5 = 0;
    } else {
      losingStreak5++;
    }
  }

  function pushStatsToDashboard() {
    if (!dashboardPort) return;

    dashboardPort.postMessage({
      type: "stats-update",
      stopped,
      rollCount,
      highHit,
      highHitLosingStreak,
      hitCount,
      profit,
      losingStreak,
      losingStreak1,
      losingStreak2,
      losingStreak3,
      losingStreak4,
      losingStreak5
    });
  }

  function getCurrentRollData() {
    return $(".grid.grid-auto-flow-column div span")
      .map(function () {
        return $(this).text();
      })
      .get();
  }

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

  function arraysAreEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((val, i) => val === arr2[i]);
  }

  function getPayout() {
    return 1.92;
  }

  function getWager() {
    return 0.0001;
  }

  function getWatchPayout1() {
    if (!watchPayout1Field) watchPayout1Field = $("#watch-payout-1");
    return Number(watchPayout1Field.val());
  }

  function getWatchPayout2() {
    if (!watchPayout2Field) watchPayout2Field = $("#watch-payout-2");
    return Number(watchPayout2Field.val());
  }

  function getWatchPayout3() {
    if (!watchPayout3Field) watchPayout3Field = $("#watch-payout-3");
    return Number(watchPayout3Field.val());
  }

  function getWatchPayout4() {
    if (!watchPayout4Field) watchPayout4Field = $("#watch-payout-4");
    return Number(watchPayout4Field.val());
  }

  function getWatchPayout5() {
    if (!watchPayout5Field) watchPayout5Field = $("#watch-payout-5");
    return Number(watchPayout5Field.val());
  }

  function waitForSelector(selector) {
    return new Promise((resolve, reject) => {
      const pause = 10;
      let maxTime = 5000;
      function check() {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        maxTime -= pause;
        if (maxTime <= 0) return reject(new Error("Timeout: " + selector));
        setTimeout(check, pause);
      }
      check();
    });
  }

  async function observeRollChanges() {
    const gridElement = await waitForSelector(".grid.grid-auto-flow-column");
    let previousRollData = getCurrentRollData();

    if (observer) observer.disconnect();

    observer = new MutationObserver((mutations) => {
      let changed = false;

      for (const mutation of mutations) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          const newRollData = getCurrentRollData();
          if (!arraysAreEqual(previousRollData, newRollData)) {
            changed = true;
            previousRollData = newRollData;
          }
        }
      }

      if (changed) {
        const result = getRollResult();
        evalResult(result);
      }
    });

    observer.observe(gridElement, { childList: true, subtree: true });
  }

  observeRollChanges();

  // Stubbed betting logic
  function startBetting() {
    console.log("🟢 Betting started");
    stopped = false;
  }

  function stopBetting() {
    console.log("⛔ Betting stopped");
    stopped = true;
  }

  function setWager(amount) {
    console.log("💰 Wager set to", amount);
    // Implement if needed
  }
})();
