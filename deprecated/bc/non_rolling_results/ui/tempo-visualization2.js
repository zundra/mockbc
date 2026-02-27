/* Start Script */
// ==UserScript==
// @name         bc.game tempo
// @namespace    http://tampermonkey.net/
// @version      0.1
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

  let newWindow = null;
  let rollCount = 0;
  let lastRollSet = [];
  let currentRollSet = [];
  const tempoHistoryMap = {};
  const maxBeats = 200;
  const beatSpacing = 10;

  const ROLL_HANDLER = initRollHandler();
  ROLL_HANDLER.getTargets().forEach((t) => {
    tempoHistoryMap[t.getPayout()] = [];
  });

  function evalResult(result) {
    rollCount++;
    ROLL_HANDLER.addResult(result);
    updateGhostBeats(result);
  }

  function updateGhostBeats(result) {
    ROLL_HANDLER.getTargets().forEach((target) => {
      const payout = target.getPayout();
      const beats = tempoHistoryMap[payout];
      const windowState = target.getWindowState();
      const rollHit = result >= target.getPayout()

      beats.push({ windowState, rollHit });

      if (beats.length > maxBeats) {
        beats.shift();
      }
    });
  }

  function renderGhostDots(newWindow, tempoHistoryMap) {
    const $ = newWindow.jQuery;

    const style = `
      body {
        margin: 0;
        background-color: #111;
        overflow: hidden;
      }
      #tempoWrapper {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: auto;
      }
      canvas {
        display: block;
      }
    `;
    $("<style>").text(style).appendTo($(newWindow.document.head));

    const $wrapper = $('<div id="tempoWrapper"></div>');
    const $canvas = $('<canvas id="tempoCanvas"></canvas>');
    $wrapper.append($canvas);
    $(newWindow.document.body).append($wrapper);

    const canvas = $canvas[0];
    const ctx = canvas.getContext("2d");

    function resizeCanvas() {
      canvas.width = newWindow.innerWidth;
      canvas.height = Math.max(
        Object.keys(tempoHistoryMap).length * 40 + 40,
        newWindow.innerHeight,
      );
    }

    resizeCanvas();
    newWindow.addEventListener("resize", resizeCanvas);

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const targets = ROLL_HANDLER.getTargets();
      const laneHeight = 30;
      const labelPadding = 60;

      targets.forEach((target, index) => {
        const payout = target.getPayout();
        const beats = tempoHistoryMap[payout].slice(-maxBeats);
        const y = index * laneHeight + laneHeight / 2;

        // Line
        ctx.strokeStyle = "#333";
        ctx.beginPath();
        ctx.moveTo(labelPadding, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();

        // Label
        ctx.fillStyle = "#ccc";
        ctx.font = "14px monospace";
        ctx.textAlign = "right";
        ctx.fillText(`${payout}x`, labelPadding - 10, y + 5);

        // Ghost Dots
        beats.forEach((beat, i) => {
          const x = labelPadding + i * beatSpacing;

          let color = "transparent";

          if (beat.rollHit) {
            color = "green";
          } else if (beat.windowState === -1) {
            color = "red";
          } else if (beat.windowState === 1) {
            color = "rgba(200, 200, 200, 0.25)";
          }
          
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, 2 * Math.PI);
          ctx.fill();
        });
      });

      requestAnimationFrame(draw);
    }

    draw();
  }

  // -----------------------------------
  // BC.GAME DOM Observers
  // -----------------------------------

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

  async function observeRollChanges() {
    const gridElement = await waitForSelector(".grid.grid-auto-flow-column");
    let previousRollData = getCurrentRollData();

    const observer = new MutationObserver(() => {
      const currentRollData = getCurrentRollData();
      if (!arraysAreEqual(previousRollData, currentRollData)) {
        previousRollData = currentRollData;
        const result = getRollResult();
        if (result !== -1) evalResult(result);
      }
    });

    observer.observe(gridElement, { childList: true, subtree: true });
  }

  // -----------------------------------
  // Logic
  // -----------------------------------

  function initRollHandler() {
    const payouts = [
      1.5, 1.6, 1.7, 1.8, 1.9, 2, 3, 4, 5, 6, 7, 8, 9,
      ...Array.from({ length: 10 }, (_, k) => 10 + k * 10),
      200, 300, 400, 500, 600, 700, 800, 900, 1000,
    ];

    class Target {
      constructor(payout) {
        this.payout = payout;
        this.streak = 0;
        this.hitCount = 0;
        this.rollCount = 0;
      }

      getPayout() {
        return this.payout;
      }

      addResult(result) {
        this.rollCount++;
        if (result >= this.payout) {
          this.hitCount++;
          this.streak = Math.max(this.streak + 1, 1);
        } else {
          this.streak = Math.min(this.streak - 1, -1);
        }

        if (isTeoMark()) {
          if (this.getLosingStreak() >= this.getPayout()) {
            this.windowState = -1;
          } else {
            this.windowState = 1;
          }
        }
        else {
          if(this.windowState === 1) {
            this.windowState = 0;
          }
        }
      }

      getLosingStreak() {
        return this.streak < 0 ? Math.abs(this.streak) : 0;
      }

      getTeo() {
        return this.payout * 1.05;
      }

      getWindowState() {
        return this.windowState;
      }

      isTeoMark() {
        return this.rollCount % Math.ceil(this.getTeo()) === 0;
      }

      missedCheckpoint() {
        return this.getLosingStreak() > this.getPayout();
      }
    }

    class RollHandler {
      constructor(targets) {
        this.targets = targets;
      }

      getTargets() {
        return this.targets;
      }

      addResult(result) {
        this.targets.forEach((target) => target.addResult(result));
      }
    }

    const targets = payouts.map((p) => new Target(p));
    return new RollHandler(targets);
  }

  function arraysAreEqual(arr1, arr2) {
    return arr1.length === arr2.length && arr1.every((v, i) => v === arr2[i]);
  }

  function waitForSelector(selector) {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const el = document.querySelector(selector);
        if (el) {
          clearInterval(interval);
          resolve(el);
        }
      }, 50);
    });
  }

  window.addEventListener("load", () => {
    newWindow = window.open("", "", "width=1200,height=800");
    newWindow.document.write(
      "<html><head><title>Tempo Ghost</title></head><body></body></html>",
    );
    newWindow.document.close();

    const script = newWindow.document.createElement("script");
    script.src = "https://code.jquery.com/jquery-3.6.0.min.js";
    script.onload = () => {
      renderGhostDots(newWindow, tempoHistoryMap);
      observeRollChanges();
    };
    newWindow.document.head.appendChild(script);
  });
})();
