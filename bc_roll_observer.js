let observer = null
let lastRollSet = [];
let currentRollSet = [];

function getCurrentRollData() {
  return $(".grid.grid-auto-flow-column div span")
    .map(function () {
      return $(this).text();
    })
    .get();
}

function getRollResult() {
  const temp = lastRollSet
  lastRollSet = currentRollSet
  currentRollSet = temp
  currentRollSet.length = 0

  currentRollSet = $(".grid.grid-auto-flow-column div span")
    .map(function () {
      return Number($(this).text().replace("x", ""))
    })
    .get()

  if (arraysAreEqual(currentRollSet, lastRollSet)) {
    return -1
  }

  return currentRollSet[currentRollSet.length - 1]
}

// Observer for Bustadice "My Bets" table


async function observeRollChanges(onRoll) {
  const gridElement = await waitForSelector(".grid.grid-auto-flow-column")
  let previousRollData = getCurrentRollData()

  // If an observer already exists, disconnect it before creating a new one
  if (observer) {
    observer.disconnect()
  }

  observer = new MutationObserver((mutationsList) => {
    let rollDataChanged = false

    for (const mutation of mutationsList) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        const currentRollData = getCurrentRollData()
        if (!arraysAreEqual(previousRollData, currentRollData)) {
          rollDataChanged = true
          previousRollData = currentRollData
        }
      }
    }

    if (rollDataChanged) {
      onRoll(getRollResult())
    }
  })

  observer.observe(gridElement, {
    childList: true,
    subtree: true,
  })
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