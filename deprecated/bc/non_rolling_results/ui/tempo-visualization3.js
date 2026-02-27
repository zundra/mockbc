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
  let lastRollSet = [], currentRollSet = [];
  const tempoHistoryMap = {};
  const maxBeats = 1000;
  const beatSpacing = 10;
  const laneHeight = 30;
  const labelPadding = 60;

  const ROLL_HANDLER = initRollHandler();
  ROLL_HANDLER.getTargets().forEach(t => tempoHistoryMap[t.getPayout()] = []);

  function evalResult(result) {
    ROLL_HANDLER.addResult(result);
    updateCanvas(result);
  }

  function updateCanvas(result) {
    ROLL_HANDLER.getTargets().forEach(target => {
      const payout = target.getPayout();
      const hit = result >= payout;
      let mark = false;
      if (hit) {
        const isLate = target.getStreak() > payout;
        mark = isLate ? { late: true } : true;
      }
      tempoHistoryMap[payout].push(mark);
      if (tempoHistoryMap[payout].length > maxBeats) {
        tempoHistoryMap[payout].shift();
      }
    });
  }

  function renderStandaloneTempoWidget(win, tempoHistoryMap, ROLL_HANDLER) {
    const $ = win.jQuery;
    const style = `
      body { margin: 0; background: #111; overflow: hidden; }
      #tempoWrapper { position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: auto; }
      canvas { display: block; }
    `;
    $("<style>").text(style).appendTo($(win.document.head));

    const $wrapper = $('<div id="tempoWrapper"></div>');
    const $canvas = $('<canvas id="tempoCanvas"></canvas>');
    $wrapper.append($canvas);
    $(win.document.body).append($wrapper);

    const canvas = $canvas[0];
    const ctx = canvas.getContext("2d");

    function resizeCanvas() {
      canvas.width = win.innerWidth;
      canvas.height = Math.max(Object.keys(tempoHistoryMap).length * 40 + 40, win.innerHeight);
    }

    resizeCanvas();
    win.addEventListener("resize", resizeCanvas);

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const targets = Object.keys(tempoHistoryMap).map(Number).sort((a, b) => a - b);
      const maxBeatsVisible = Math.floor((canvas.width - labelPadding) / beatSpacing);

      targets.forEach((target, index) => {
        const y = index * laneHeight + laneHeight / 2;
        const beats = tempoHistoryMap[target];
        const teo = 1 / (target * 1.05);
        const expectedInterval = Math.round(1 / teo);

        ctx.strokeStyle = "#333";
        ctx.beginPath();
        ctx.moveTo(labelPadding, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();

        ctx.fillStyle = "#ccc";
        ctx.font = "14px monospace";
        ctx.textAlign = "right";
        ctx.fillText(`${target}x`, labelPadding - 10, y + 5);

        ctx.fillStyle = "rgba(255,255,100,0.2)";
        for (let i = 0; i < maxBeatsVisible; i++) {
          if (i % expectedInterval === 0) {
            const x = labelPadding + i * beatSpacing;
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, 2 * Math.PI);
            ctx.fill();
          }
        }

        const recentBeats = beats.slice(-maxBeatsVisible);
        recentBeats.forEach((hit, i) => {
          if (hit) {
            const x = labelPadding + i * beatSpacing;
            const targetObj = ROLL_HANDLER.getTargets().find(t => t.getPayout() === target);
            const isLate = Math.abs(targetObj?.getLosingStreak?.()) > target;
            ctx.fillStyle = isLate ? "red" : "lime";
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
          }
        });
      });

      requestAnimationFrame(draw);
    }

    draw();
  }

  function initRollHandler() {
    const payouts = [...[1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2, 3, 4, 5, 6, 7, 8, 9], ...Array.from({ length: 10 }, (_, k) => 10 + k * 10), ...[100, 200, 300, 400, 500, 1000, 10000, 100000]];

    class Target {
      constructor(payout) {
        this.payout = payout;
        this.streak = 0;
        this.hitCount = 0;
        this.rollCount = 0;
      }
      getPayout() { return this.payout; }
      addResult(result) {
        this.rollCount++;
        if (result >= this.payout) {
          this.hitCount++;
          this.streak = Math.max(this.streak + 1, 1);
        } else {
          this.streak = Math.min(this.streak - 1, -1);
        }
      }
      getStreak() { return this.streak; }
      getLosingStreak() { return this.streak < 0 ? this.streak : 0; }
    }

    class RollHandler {
      constructor(targets) {
        this.targets = targets;
      }
      getTargets() { return this.targets; }
      addResult(result) {
        this.targets.forEach(target => target.addResult(result));
      }
    }

    const targets = payouts.map(p => new Target(p));
    return new RollHandler(targets);
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

  function getRollResult() {
    const temp = lastRollSet;
    lastRollSet = currentRollSet;
    currentRollSet = temp;
    currentRollSet.length = 0;

    currentRollSet = $(".grid.grid-auto-flow-column div span").map(function () {
      return Number($(this).text().replace("x", ""));
    }).get();

    return currentRollSet[currentRollSet.length - 1];
  }

    async function observeRollChanges() {
    const targetSelector = ".grid.grid-auto-flow-column";
    const gridElement = await waitForSelector(".grid.grid-auto-flow-column");
    let previous = [];

    const observer = new MutationObserver(() => {
      const current = $(".grid.grid-auto-flow-column div span").map(function () {
        return $(this).text();
      }).get();

      if (current.toString() !== previous.toString()) {
        previous = current;
        evalResult(getRollResult());
      }
    });

    observer.observe(gridElement, { childList: true, subtree: true });
  }

  window.addEventListener("beforeunload", () => {
    if (newWindow && !newWindow.closed) newWindow.close();
  });

  window.addEventListener("load", () => {
    newWindow = window.open("", "", "width=500,height=600");
    newWindow.document.write("<html><head><title>Tempo Sync</title></head><body></body></html>");
    newWindow.document.close();

    const script = newWindow.document.createElement("script");
    script.src = "https://code.jquery.com/jquery-3.6.0.min.js";
    script.onload = () => renderStandaloneTempoWidget(newWindow, tempoHistoryMap, ROLL_HANDLER);
    newWindow.document.head.appendChild(script);

    observeRollChanges();
  }, false);
})();