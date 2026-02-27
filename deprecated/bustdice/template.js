// ==UserScript==
// @name         Bustadice Template
// @namespace    http://tampermonkey.net/
// @version      2025-04-07
// @description  try to take over the world!
// @author       You
// @match        https://bustadice.com/play
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bustadice.com
// @grant        none
// ==/UserScript==


;(function () {
    "use strict"

    let lastRollSet = []
    let currentRollSet = []
    let currentRiskOnTarget = null

    function evalResult(result) {
       console.log("Result", result);
    }

    function initPrototypes() {
        Array.prototype.last = function() {
            return this[this.length - 1];
        };
        Array.prototype.first = function() {
            return this[0];
        };

        Array.prototype.median = function() {
            if (this.length === 0) return null; // Handle empty array case

            const medianIndex = Math.floor((this.length - 1) / 2); // Get the median index
            return this[medianIndex]; // Return the median element
        };
    }

    /********************* Framework *********************/

    // Utility function: Get current roll data
    function getCurrentRollData() {
        return $(".grid.grid-auto-flow-column div span")
            .map(function () {
            return $(this).text()
        })
            .get()
    }

    function doInit() {
        observeRollChanges()
        initPrototypes()
    }


function getRollResult() {
    const topRowCell = document.querySelector('table tbody tr td:nth-child(4)');
    if (!topRowCell) return -1;

    const outcomeText = topRowCell.textContent.replace("x", "");
    const result = Number(outcomeText);

    // Optional: You can still add deduplication logic if needed
    if (result === lastRollSet[0]) return -1;

    lastRollSet[0] = result;
    return result;
}

    // Observer for Bustadice "My Bets" table
    let observer = null;

    async function observeRollChanges() {
        const tableBody = await waitForSelector('table tbody');
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

            if (rollDataChanged) {
                evalResult(getRollResult());
            }
        });

        observer.observe(tableBody, {
            childList: true,
            subtree: true,
        });
    }

    function getCurrentRollData() {
        return Array.from(document.querySelectorAll('table tbody tr td:nth-child(4)')).map((cell) => cell.textContent.trim());
    }


    function arraysAreEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false
        return arr1.every((value, index) => value === arr2[index])
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

    doInit()
})()
