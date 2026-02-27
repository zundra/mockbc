// ==UserScript==
// @name         Bustadice Script Saver
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Auto-load and save Bustadice scripts using localStorage
// @author       you
// @match        https://bustadice.com/play
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = "bustadice_script";
    const CHECK_INTERVAL = 500;

    function injectScript(scriptText) {
        const textarea = document.querySelector('textarea');
        if (textarea && textarea.value !== scriptText) {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
            nativeInputValueSetter.call(textarea, scriptText);

            // Now dispatch both "input" and "change" to trigger React listeners
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function addSaveButton() {
        if (document.querySelector('#saveScriptBtn')) return;

        const textarea = document.querySelector('textarea');
        if (!textarea) return;

        const saveBtn = document.createElement("button");
        saveBtn.innerText = "💾 Save Script";
        saveBtn.id = "saveScriptBtn";
        saveBtn.style = "position: absolute; top: 10px; right: 20px; z-index: 1000;";
        saveBtn.onclick = () => {
            const currentScript = textarea.value;
            localStorage.setItem(STORAGE_KEY, currentScript);
            alert("Script saved!");
        };

        document.body.appendChild(saveBtn);
    }

    function tryInit() {
        const savedScript = localStorage.getItem(STORAGE_KEY);
        if (savedScript) {
            injectScriptEditorScript(savedScript);
        }
        addSaveButton();
    }

    // Wait for textarea to appear
    const interval = setInterval(() => {
        const textarea = document.querySelector('textarea');
        if (textarea) {
            clearInterval(interval);
            tryInit();
        }
    }, CHECK_INTERVAL);

})();
