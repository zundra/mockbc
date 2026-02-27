/* Start Script */
// ==UserScript==
// @name         bc.game fast forward
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://*.game/game/limbo?fast-roll=true
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bc.game
// @require https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @grant        none
// ==/UserScript==

(function() {
    "use strict";

    const RESULTS = [];

    let lastRollSet = [];
    let currentRollSet = [];
    let rollCount = 0;
    let stopped = true;
   
    function evalResult(result) {
        RESULTS.push(result);
        rollCount++;
        checkHalts(result);
    }

    function checkHalts(result) {
        if (getStopOnMaxRolls() && rollCount >= getMaxRolls()) {
            persistResults();
            halt("Max rolls hit, rolls persisted");
            return;
        }

        if (result >= getWatchTarget()) {
            halt("Watch target hit");
            return;
        }
    }

    function persistResults() {
        console.log(RESULTS)
    }

    function halt(stopMessage) {
        console.log(stopMessage)
        $("#message").text(stopMessage);
        stopMessage = ""
        stopBetting()
        return
    }

    function getMaxRolls() {
        return  Number($("#max-rolls").val());
    }

  function getStopOnMaxRolls() {
    return getMaxRolls() !== 0;
  }

    function getWatchTarget() {
        return Number($("#watch-target").val())
    }

})()