export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id });

  let latestSnapshot: unknown = null;
  let snapshotTimeout: number | null = null;

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "UISNAP_ELEMENT_SNAPSHOT") {
      // Clear previous timeout if exists
      if (snapshotTimeout) {
        clearTimeout(snapshotTimeout);
      }

      latestSnapshot = message.payload;

      // Set a new timeout to clear the snapshot after 5 minutes
      snapshotTimeout = setTimeout(
        () => {
          latestSnapshot = null;
          snapshotTimeout = null;
        },
        5 * 60 * 1000,
      ) as unknown as number;

      sendResponse({ status: "ok" });
      return true;
    }

    if (message?.type === "UISNAP_GET_SNAPSHOT") {
      sendResponse({ snapshot: latestSnapshot });
      return true;
    }

    return false;
  });

  // Cleanup when extension is unloaded
  browser.runtime.onSuspend.addListener(() => {
    if (snapshotTimeout) {
      clearTimeout(snapshotTimeout);
    }
    latestSnapshot = null;
  });
});
