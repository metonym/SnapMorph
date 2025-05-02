<script lang="ts">
import { onMount } from "svelte";

let snapshot: SnapshotElement | null = null;
let backendMessage: string | null = null;
let backendLoading = true;
let backendError: string | null = null;

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
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    await browser.tabs.sendMessage(tab.id, { type: "UISNAP_START_OVER" });
  }
}
</script>

<main class="flex flex-col items-start gap-4 p-4 min-w-[320px]">
  <h1 class="text-lg font-bold">SnapMorph</h1>
  <div class="mb-2 w-full">
    {#if backendLoading}
      <span class="text-xs text-gray-500">Connecting to backend...</span>
    {:else if backendError}
      <span class="text-xs text-red-600">{backendError}</span>
    {:else if backendMessage}
      <span class="text-xs text-green-700">{backendMessage}</span>
    {/if}
  </div>
  {#if snapshot}
    <button class="mb-2 px-3 py-1 rounded bg-red-600 text-white text-xs hover:bg-red-700 self-end" on:click={startOver}>
      Start Over
    </button>
    <div class="mb-4 w-full border rounded bg-white p-2">
      <h2 class="font-semibold text-sm mb-2">Live Preview</h2>
      <div
        class="border bg-gray-50 p-2 overflow-auto"
        style="max-height:500px; max-width:100%; width:fit-content; height:fit-content; display:block;"
      >
        {@html renderSnapshot(snapshot)}
      </div>
    </div>
    <div class="overflow-auto w-full max-h-96 bg-white rounded border p-2 text-xs">
      <pre>{JSON.stringify(snapshot, null, 2)}</pre>
    </div>
  {:else}
    <div class="text-gray-500">No element selected yet. Use the selector on any page.</div>
  {/if}
</main>
