<script lang="ts">
import { marked } from "marked";
import { onMount } from "svelte";

let snapshot: SnapshotElement | null = null;
let backendMessage: string | null = null;
let backendLoading = true;
let backendError: string | null = null;

let sending = false;
let sendResult: string | null = null;
let sendError: string | null = null;

let streamingResult = "";
let streaming = false;

// Type for the snapshot tree
interface SnapshotElement {
  tag: string;
  attributes: { name: string; value: string }[];
  style: Record<string, string>;
  children: SnapshotElement[];
  text?: string | null;
}

// Fetch the latest snapshot from the background script
async function fetchSnapshot() {
  try {
    const response = await browser.runtime.sendMessage({
      type: "UISNAP_GET_SNAPSHOT",
    });
    snapshot = response?.snapshot;
  } catch (e) {
    snapshot = null;
  }
}

async function fetchBackendMessage() {
  backendLoading = true;
  backendError = null;
  backendMessage = null;
  try {
    const res = await fetch("http://localhost:8000/");
    if (!res.ok) throw new Error("Failed to fetch backend");
    const data = await res.json();
    backendMessage = data.message;
  } catch (e) {
    backendError = "Could not connect to backend.";
  } finally {
    backendLoading = false;
  }
}

onMount(() => {
  fetchSnapshot();
  fetchBackendMessage();
});

function styleToString(style: Record<string, string>): string {
  return Object.entries(style)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

// Recursively render the snapshot as HTML
function renderSnapshot(node: SnapshotElement): string {
  if (!node) return "";
  const attrs = node.attributes
    .map((attr) => `${attr.name}="${attr.value.replace(/"/g, "&quot;")}"`)
    .join(" ");
  const style = styleToString(node.style);
  const open = `<${node.tag}${attrs ? ` ${attrs}` : ""}${style ? ` style="${style}"` : ""}>`;
  const close = `</${node.tag}>`;
  const children = node.children?.map(renderSnapshot).join("") || "";
  const text = node.text ? node.text : "";
  return `${open}${text}${children}${close}`;
}

// Start over: clear snapshot and re-enable selection
async function startOver() {
  snapshot = null;
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (tab?.id) {
    await browser.tabs.sendMessage(tab.id, { type: "UISNAP_START_OVER" });
  }
}

// Utility to extract only color styles
function filterColorStyles(
  style: Record<string, string>,
): Record<string, string> {
  const colorProps = [
    "color",
    "background-color",
    "border-color",
    "outline-color",
    "text-decoration-color",
    // Add more color-related CSS properties as needed
  ];
  const filtered: Record<string, string> = {};
  for (const key of colorProps) {
    if (style[key]) filtered[key] = style[key];
  }
  return filtered;
}

// Recursively optimize the snapshot
function optimizeSnapshot(node: SnapshotElement): SnapshotElement {
  return {
    tag: node.tag,
    attributes: node.attributes,
    style: filterColorStyles(node.style),
    children: node.children?.map(optimizeSnapshot) || [],
    text: node.text ?? null,
  };
}

// Send snapshot to backend
async function sendSnapshot() {
  if (!snapshot) return;
  sending = true;
  streaming = true;
  streamingResult = "";
  sendResult = null;
  sendError = null;
  try {
    const serialized = JSON.stringify(snapshot);
    const optimized = JSON.stringify(optimizeSnapshot(snapshot));
    const res = await fetch("http://localhost:8000/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot, serialized, optimized }),
    });
    if (!res.body) throw new Error("No response body");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        // Parse SSE data lines
        const blocks = chunk.split(/\n\n/);
        for (const block of blocks) {
          if (block.startsWith("data: ")) {
            const data = block.slice(6);
            if (data === "[DONE]") {
              done = true;
            } else {
              streamingResult += data;
            }
          }
        }
      }
      done = done || doneReading;
    }
    sendResult = "LLM response complete.";
  } catch (e) {
    sendError = "Failed to send snapshot.";
  } finally {
    sending = false;
    streaming = false;
  }
}
</script>

<header class="flex flex-col gap-4 p-4 pb-0 w-full">
<h1 class="text-lg font-bold">SnapMorph</h1>
  <div class="flex flex-row gap-2">
    <button
      class="mb-2 px-3 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 self-end"
      on:click={startOver}
    >
      New selection
    </button>
    <button
      class="mb-2 px-3 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 self-end"
      on:click={sendSnapshot}
      disabled={sending}
    >
      {sending ? "Analyzing..." : "Analyze"}
    </button>
  </div>
</header>
<main class="flex flex-row gap-4 p-4 pb-0 mb-4 w-full">
  
  <!-- Left column: Preview and JSON -->
  <div class="flex flex-col flex-1 w-1/2">
   
    <div>
      {#if streaming}
        <div class="text-xs text-blue-700 mb-2">
          Analyzing and streaming response...
        </div>
      {/if}
      {#if sendResult}
        <div class="text-xs text-green-700 mb-2">{sendResult}</div>
      {/if}
      {#if sendError}
        <div class="text-xs text-red-600 mb-2">{sendError}</div>
      {/if}
    </div>
    {#if snapshot}
     

      <div class="mb-4 w-full border rounded bg-white p-2">
        <h2 class="font-semibold text-sm mb-2">Live Preview</h2>
        <div
          class="border bg-gray-50 p-2 overflow-auto"
          style="min-height:90px; max-height:800px; max-width:100%; width:fit-content; height:fit-content; display:block;"
        >
          {@html renderSnapshot(snapshot)}
        </div>
      </div>
      <div
        class="overflow-auto w-full max-h-72 bg-white rounded border p-2 text-xs"
      >
        <pre>{JSON.stringify(snapshot, null, 2)}</pre>
      </div>
    {:else}
      <div class="text-gray-500">
        No element selected yet. Use the selector on any page.
      </div>
    {/if}
  </div>
  <!-- Right column: LLM streaming result -->
  <div class="flex flex-col flex-1 w-1/2">
    {#if streamingResult}
      <div
        class="text-xs text-gray-800 whitespace-pre-wrap mb-2 border rounded bg-gray-50 p-2 max-h-[80vh] overflow-auto"
      >
        {@html marked(streamingResult)}
      </div>
    {/if}
  </div>
</main>
