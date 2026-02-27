document.addEventListener("DOMContentLoaded", () => {
  initWindowEvents();
  setupLiveUpdates();
});

let port;
let rollCount = 0;
let highHit = 0;
let highHitLosingStreak = 0;
let hitCount = 0;
let profit = 0;
let losingStreak = 0;
let losingStreak1 = 0;
let losingStreak2 = 0;
let losingStreak3 = 0;
let losingStreak4 = 0;
let losingStreak5 = 0;

function setupLiveUpdates() {
  console.log("📡 Connecting from dashboard:", chrome.runtime.id);
  port = chrome.runtime.connect({ name: "dashboard-connection" });

  port.onDisconnect.addListener(() => {
    const err = chrome.runtime.lastError;
    if (err) {
      console.error("🚨 Port connection failed:", err.message);
    } else {
      console.warn("⚠️ Port disconnected");
    }
  });

  port.onMessage.addListener((msg) => {
    if (msg.type === "stats-update") {
      rollCount = msg.rollCount;
      highHit = msg.highHit;
      highHitLosingStreak = msg.highHitLosingStreak;
      hitCount = msg.hitCount;
      profit = msg.profit;
      losingStreak = msg.losingStreak;
      losingStreak1 = msg.losingStreak1;
      losingStreak2 = msg.losingStreak2;
      losingStreak3 = msg.losingStreak3;
      losingStreak4 = msg.losingStreak4;
      losingStreak5 = msg.losingStreak5;
      updateUI();
    }
  });
}

// === Message sending to content.js via background.js ===

function sendToContent(msg) {
  if (port) {
    port.postMessage(msg);
  } else {
    console.warn("⚠️ No port connection to background script");
  }
}

function startBetting() {
  sendToContent({ type: "start-betting" });
}

function stopBetting() {
  sendToContent({ type: "stop-betting" });
}

function setWager(amount) {
  sendToContent({ type: "set-wager", value: amount });
}

function getWager() {
  return 0.0001;
}

function getScaledWager() {
  return 0.0005;
}

// === UI Bindings ===

function initWindowEvents() {
  $("#set-risk-on-btn").click(() => {
    $("#set-risk-on-btn").hide();
    $("#set-risk-off-btn").show();
    setWager(getScaledWager());
    $("#risk-on").prop("checked", true);
    $("#roll-mode").val("half-target");
    $("#hit-count-target").val(1);
    $("#profit-target").val(0.01);
  });

  $("#set-risk-off-btn").click(() => {
    $("#set-risk-on-btn").show();
    $("#set-risk-off-btn").hide();
    $("#risk-on").prop("checked", false);
    $("#roll-mode").val("none");
    $("#hit-count-target").val(0);
    $("#profit-target").val(0);
    setWager(0);
  });

  $("#double-wager-btn").click(() => {
    setWager(Math.min(1, getWager() * 2));
  });

  $("#half-wager-btn").click(() => {
    setWager(Math.max(0.0001, getWager() / 2));
  });

  $("#zero-wager-btn").click(() => {
    setWager(0);
  });

  $("#start-betting-btn").click(startBetting);
  $("#stop-betting-btn").click(stopBetting);
}

// === UI Updater ===

function updateUI() {
  $("#roll-count").html(rollCount);
  $("#high-hit")
    .html(`${highHit} | ${highHitLosingStreak} | ${Math.round(rollCount - highHit)}`)
    .css({
      backgroundColor: highHitLosingStreak > highHit * 3 ? "red" : "transparent"
    });

  updateStreakRow(6, losingStreak, getPayout());
  updateStreakRow(1, losingStreak1, getWatchPayout1());
  updateStreakRow(2, losingStreak2, getWatchPayout2());
  updateStreakRow(3, losingStreak3, getWatchPayout3());
  updateStreakRow(4, losingStreak4, getWatchPayout4());
  updateStreakRow(5, losingStreak5, getWatchPayout5());
}

function updateStreakRow(streakId, streak, payout) {
  const diff = payout - streak;
  const ratio = diff / payout;

  $(`#losing-streak-${streakId}`).html(isNaN(streak) ? "—" : streak);
  $(`#losing-streak-${streakId}-payout`).html(isNaN(payout) ? "—" : payout.toFixed(2));
  $(`#losing-streak-${streakId}-ratio`).html(isNaN(payout) ? "—" : ratio.toFixed(2));
  $(`#losing-streak-${streakId}-diff`).html(isNaN(diff) ? "NaN" : diff.toFixed(2));

  const $row = $(`#losing-streak-${streakId}-diff`).closest("tr");
  if (!isNaN(diff) && !isNaN(payout) && Math.abs(diff) >= payout * 3) {
    $row.css("background-color", "#661c1c");
  } else {
    $row.css("background-color", "");
  }
}

// === Stubbed Payout Getters ===
// Replace with dynamic values from storage/content later

function getPayout() { return 1.92; }
function getWatchPayout1() { return 2; }
function getWatchPayout2() { return 10; }
function getWatchPayout3() { return 20; }
function getWatchPayout4() { return 50; }
function getWatchPayout5() { return 100; }
