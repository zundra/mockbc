$(".onboarding-step-PURCHASE_BONUS").remove();


let state = {
    current: 0,
    previous: 0
};

let loaded = false;
let count = 0;
let delta = 0;
let completed = 0;
let remaining = 0;
let remainingPercent = 0;
const path = "https://www.myinstants.com/media/sounds/ding-sound-effect_2.mp3";

 function playSound() {
    var audio = new Audio(path)
    audio.type = "audio/wav"
    audio.play()
  }

setInterval(() => {
    let el = document.querySelector('[role="progressbar"]');

    if (!el) return;

    pct = parseFloat(el.getAttribute("aria-valuenow"))
    remainingPercent = 100 - pct;

    if (!loaded) {
        console.log(`[First Load] Current:  ${pct}`)
        loaded = true;
        state.current = pct;
    } else if (state.current !== pct) {
        playSound();
        completed++;
        state.previous = state.current;
        state.current = pct;
        if (delta === 0) {
            delta = state.current - state.previous;
        }

        remaining = remainingPercent / delta;

        console.clear();
        console.log(`DETECTED CHANGE] Current: ${state.current}, Previous: ${state.previous}, Delta: ${delta}, Completed: ${completed}, Remaining: ${remaining}`);
    }

}, 1000);