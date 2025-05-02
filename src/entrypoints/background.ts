export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id });

  let latestSnapshot: unknown = null;

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "UISNAP_ELEMENT_SNAPSHOT") {
      latestSnapshot = message.payload;
      // Optionally acknowledge
      sendResponse({ status: "ok" });
      return true;
    }
    if (message?.type === "UISNAP_GET_SNAPSHOT") {
      sendResponse({ snapshot: latestSnapshot });
      return true;
    }
    return false;
  });
});
