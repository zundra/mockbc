// Utility function: Extract the last roll result
async function observeRollChanges(onRoll) {
    (function () {
        const origFetch = window.fetch;

        window.fetch = function (...args) {
            const p = origFetch.apply(this, args);

            p.then((res) => {
                try {
                    const url = typeof args[0] === "string" ? args[0] : args[0]?.url;

                    if (!url || !url.includes("/_api/casino/") || !url.includes("/bet"))
                        return;

                    const clone = res.clone();

                    clone.text().then((text) => {
                        if (!text) return;

                        let data;
                        try {
                            data = JSON.parse(text);
                        } catch {
                            return;
                        }

                        const result =
                              data?.limboBet?.state?.result ??
                              data?.diceBet?.state?.result ??
                              data?.plinkoBet?.state?.result ??
                              data?.crashBet?.state?.result;

                        if (Number.isFinite(result)) {
                            onRoll(parseFloat(result.toFixed(2)));
                        }
                    });
                } catch {}
            });

            return p;
        };
    })();
}