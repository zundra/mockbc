let dashboardPort = null;
let contentPort = null;

console.log("📡 Background script loaded");

chrome.runtime.onConnect.addListener((port) => {
  console.log("🔌 Port connected:", port.name);

  if (port.name === "dashboard-connection") {
    dashboardPort = port;
    console.log("✅ Dashboard connected");

    port.onMessage.addListener((msg) => {
      if (contentPort) {
        contentPort.postMessage(msg);
      }
    });

    port.onDisconnect.addListener(() => {
      console.warn("⚠️ Dashboard disconnected");
      dashboardPort = null;
    });

  } else if (port.name === "content-connection") {
    contentPort = port;
    console.log("✅ Content script connected");

    port.onMessage.addListener((msg) => {
      if (dashboardPort) {
        dashboardPort.postMessage(msg);
      }
    });

    port.onDisconnect.addListener(() => {
      console.warn("⚠️ Content script disconnected");
      contentPort = null;
    });
  }
});
