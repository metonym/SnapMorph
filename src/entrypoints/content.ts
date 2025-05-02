export default defineContentScript({
  matches: ["*://*/*"],
  main() {
    let lastHovered: HTMLElement | null = null;
    let highlightBox: HTMLDivElement | null = null;
    let selecting = false;

    // Create a highlight overlay
    function createHighlightBox() {
      if (highlightBox) return;
      highlightBox = document.createElement("div");
      highlightBox.style.position = "fixed";
      highlightBox.style.pointerEvents = "none";
      highlightBox.style.zIndex = "999999";
      highlightBox.style.border = "2px solid #007aff";
      highlightBox.style.background = "rgba(0,122,255,0.1)";
      highlightBox.style.transition = "all 0.1s";
      document.body.appendChild(highlightBox);
    }

    function removeHighlightBox() {
      if (highlightBox) {
        highlightBox.remove();
        highlightBox = null;
      }
    }

    function updateHighlightBox(el: HTMLElement) {
      const rect = el.getBoundingClientRect();
      createHighlightBox();
      if (highlightBox) {
        highlightBox.style.left = `${rect.left + window.scrollX}px`;
        highlightBox.style.top = `${rect.top + window.scrollY}px`;
        highlightBox.style.width = `${rect.width}px`;
        highlightBox.style.height = `${rect.height}px`;
        highlightBox.style.display = "block";
      }
    }

    function handleMouseOver(e: MouseEvent) {
      if (selecting) return;
      const target = e.target as HTMLElement;
      if (
        !target ||
        target === document.body ||
        target === document.documentElement
      )
        return;
      lastHovered = target;
      updateHighlightBox(target);
    }

    function handleMouseOut(e: MouseEvent) {
      if (selecting) return;
      if (highlightBox) highlightBox.style.display = "none";
      lastHovered = null;
    }

    function handleClick(e: MouseEvent) {
      if (!lastHovered) return;
      e.preventDefault();
      e.stopPropagation();
      selecting = true;
      removeHighlightBox();
      document.removeEventListener("mouseover", handleMouseOver, true);
      document.removeEventListener("mouseout", handleMouseOut, true);
      document.removeEventListener("click", handleClick, true);
      // Snapshot the selected element
      const snapshot = snapshotElement(lastHovered);
      // Log the selected DOM markup
      console.log("[UISNAP] Selected DOM markup:", lastHovered.outerHTML);
      // Send to background using extension messaging
      browser.runtime.sendMessage({
        type: "UISNAP_ELEMENT_SNAPSHOT",
        payload: snapshot,
      });
      // Try to open the extension popup (if possible)
      if (
        browser.runtime.getManifest().browser_action ||
        browser.runtime.getManifest().action
      ) {
        browser.runtime.sendMessage({ type: "UISNAP_OPEN_POPUP" });
      }
    }

    // Recursively snapshot DOM and computed styles
    type SnapshotElement = {
      tag: string;
      attributes: { name: string; value: string }[];
      style: Record<string, string>;
      children: SnapshotElement[];
      text?: string | null;
    };
    function snapshotElement(el: HTMLElement): SnapshotElement {
      const computed = window.getComputedStyle(el);
      const style: Record<string, string> = {};
      for (const prop of computed) {
        style[prop] = computed.getPropertyValue(prop);
      }
      return {
        tag: el.tagName,
        attributes: Array.from(el.attributes).map((attr) => ({
          name: attr.name,
          value: attr.value,
        })),
        style,
        children: Array.from(el.children).map((child) =>
          snapshotElement(child as HTMLElement),
        ),
        text:
          el.childNodes.length === 1 &&
          el.childNodes[0].nodeType === Node.TEXT_NODE
            ? el.textContent
            : undefined,
      };
    }

    function enableSelection() {
      selecting = false;
      console.log(
        "[UISNAP] enableSelection called, selecting reset to",
        selecting,
      );
      document.removeEventListener("mouseover", handleMouseOver, true);
      document.removeEventListener("mouseout", handleMouseOut, true);
      document.removeEventListener("click", handleClick, true);
      removeHighlightBox();
      document.addEventListener("mouseover", handleMouseOver, true);
      document.addEventListener("mouseout", handleMouseOut, true);
      document.addEventListener("click", handleClick, true);
      console.log("[UISNAP] Event listeners attached");
    }

    // Listen for messages from the popup to start over or double text
    browser.runtime.onMessage.addListener((message) => {
      if (message?.type === "UISNAP_START_OVER") {
        console.log("[UISNAP] Received UISNAP_START_OVER message");
        enableSelection();
      }
      if (message?.type === "UISNAP_DOUBLE_TEXT") {
        if (selecting && lastHovered) {
          // Double the text content of the selected element
          lastHovered.textContent =
            lastHovered.textContent + lastHovered.textContent;
        }
      }
    });

    // Initial enable
    enableSelection();
  },
});
