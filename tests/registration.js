// =========================
// TEST HARNESS
// =========================
const OBS_TESTS = [];

function registerTest(name, fn, enabled = true) {
  OBS_TESTS.push({ name, fn, enabled });
}

function runTests(ctx) {
  for (const t of OBS_TESTS) {
    if (!t.enabled) continue;
    try {
      t.fn(ctx);
    } catch (err) {
      console.error(`[OBS_TEST ERROR] ${t.name}`, err);
    }
  }
}
