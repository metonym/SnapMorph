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
  streamingResult = "";
  sendResult = null;
  sendError = null;
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
    sendResult = "Analysis complete.";
  } catch (e) {
    sendError = "Failed to send snapshot.";
  } finally {
    sending = false;
    streaming = false;
  }
}

// Automatically send snapshot when it is set
$: if (snapshot) {
  sendSnapshot();
}
</script>

<header class="flex flex-col gap-4 p-4 pb-0 w-full">
  <div class="flex flex-col gap-0">
  <h1 class="text-lg text-blue-900">
    <svg
      width="120"
      viewBox="0 0 63 11"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4.356 9.12C3.908 9.12 3.464 9.064 3.024 8.952C2.588 8.84 2.186 8.67 1.818 8.442C1.454 8.214 1.154 7.928 0.918 7.584C0.682 7.236 0.546 6.828 0.51 6.36H2.886C2.93 6.564 3.018 6.738 3.15 6.882C3.282 7.026 3.46 7.138 3.684 7.218C3.912 7.294 4.184 7.332 4.5 7.332C4.688 7.332 4.878 7.31 5.07 7.266C5.262 7.218 5.422 7.14 5.55 7.032C5.682 6.92 5.748 6.768 5.748 6.576C5.748 6.324 5.644 6.152 5.436 6.06C5.228 5.964 4.982 5.89 4.698 5.838L3.216 5.574C2.7 5.482 2.258 5.328 1.89 5.112C1.522 4.892 1.24 4.606 1.044 4.254C0.852 3.902 0.756 3.48 0.756 2.988C0.756 2.404 0.918 1.906 1.242 1.494C1.566 1.078 2.006 0.762 2.562 0.546C3.118 0.325999 3.742 0.215999 4.434 0.215999C5.19 0.215999 5.832 0.332 6.36 0.564C6.892 0.796 7.3 1.118 7.584 1.53C7.868 1.942 8.016 2.416 8.028 2.952H5.712C5.688 2.732 5.62 2.554 5.508 2.418C5.396 2.282 5.244 2.182 5.052 2.118C4.864 2.05 4.636 2.016 4.368 2.016C3.936 2.016 3.634 2.092 3.462 2.244C3.29 2.396 3.204 2.56 3.204 2.736C3.204 2.916 3.274 3.07 3.414 3.198C3.558 3.322 3.812 3.414 4.176 3.474L5.466 3.684C6.07 3.78 6.564 3.948 6.948 4.188C7.336 4.428 7.622 4.728 7.806 5.088C7.99 5.448 8.082 5.86 8.082 6.324C8.082 6.888 7.918 7.38 7.59 7.8C7.266 8.216 6.824 8.54 6.264 8.772C5.704 9.004 5.068 9.12 4.356 9.12ZM8.54297 9V2.796H10.853V3.654C10.941 3.522 11.053 3.388 11.189 3.252C11.325 3.116 11.501 3.002 11.717 2.91C11.933 2.818 12.203 2.772 12.527 2.772C12.891 2.772 13.237 2.842 13.565 2.982C13.897 3.122 14.167 3.346 14.375 3.654C14.587 3.962 14.693 4.368 14.693 4.872V9H12.353V5.19C12.353 4.986 12.277 4.83 12.125 4.722C11.973 4.614 11.809 4.56 11.633 4.56C11.521 4.56 11.405 4.584 11.285 4.632C11.169 4.68 11.071 4.752 10.991 4.848C10.915 4.94 10.877 5.054 10.877 5.19V9H8.54297ZM17.1114 9.12C16.7234 9.12 16.3654 9.044 16.0374 8.892C15.7134 8.74 15.4534 8.518 15.2574 8.226C15.0654 7.93 14.9694 7.568 14.9694 7.14C14.9694 6.468 15.2354 5.946 15.7674 5.574C16.3034 5.202 17.1354 5.016 18.2634 5.016H18.7434V4.752C18.7434 4.552 18.6874 4.406 18.5754 4.314C18.4674 4.222 18.2954 4.18 18.0594 4.188C17.8994 4.192 17.7234 4.23 17.5314 4.302C17.3394 4.374 17.1954 4.516 17.0994 4.728H15.2094C15.2334 4.24 15.3794 3.846 15.6474 3.546C15.9154 3.242 16.2694 3.022 16.7094 2.886C17.1494 2.746 17.6354 2.676 18.1674 2.676C18.8874 2.676 19.4514 2.758 19.8594 2.922C20.2674 3.086 20.5554 3.314 20.7234 3.606C20.8914 3.894 20.9754 4.228 20.9754 4.608V9H19.0434L18.8394 8.016C18.6554 8.436 18.4274 8.726 18.1554 8.886C17.8834 9.042 17.5354 9.12 17.1114 9.12ZM17.9334 7.644C18.0454 7.644 18.1494 7.624 18.2454 7.584C18.3454 7.544 18.4314 7.49 18.5034 7.422C18.5754 7.35 18.6314 7.27 18.6714 7.182C18.7154 7.094 18.7394 7 18.7434 6.9V6.12H18.3714C18.2474 6.12 18.0894 6.144 17.8974 6.192C17.7054 6.236 17.5334 6.314 17.3814 6.426C17.2334 6.538 17.1594 6.696 17.1594 6.9C17.1594 7.132 17.2374 7.314 17.3934 7.446C17.5534 7.578 17.7334 7.644 17.9334 7.644ZM21.5109 10.932V2.796H23.8569V3.516C23.9729 3.356 24.1049 3.222 24.2529 3.114C24.4049 3.006 24.5629 2.92 24.7269 2.856C24.8909 2.792 25.0549 2.746 25.2189 2.718C25.3829 2.69 25.5369 2.676 25.6809 2.676C26.1129 2.676 26.5009 2.79 26.8449 3.018C27.1889 3.246 27.4609 3.598 27.6609 4.074C27.8609 4.546 27.9609 5.148 27.9609 5.88C27.9609 6.668 27.8409 7.3 27.6009 7.776C27.3649 8.248 27.0529 8.59 26.6649 8.802C26.2809 9.014 25.8689 9.12 25.4289 9.12C25.3009 9.12 25.1649 9.104 25.0209 9.072C24.8809 9.04 24.7389 8.99 24.5949 8.922C24.4549 8.85 24.3209 8.76 24.1929 8.652C24.0649 8.54 23.9489 8.404 23.8449 8.244V10.932H21.5109ZM24.8169 7.452C25.0769 7.452 25.3049 7.33 25.5009 7.086C25.7009 6.838 25.8009 6.436 25.8009 5.88C25.8009 5.376 25.7009 4.99 25.5009 4.722C25.3049 4.454 25.0769 4.32 24.8169 4.32C24.4769 4.32 24.2289 4.476 24.0729 4.788C23.9209 5.096 23.8449 5.46 23.8449 5.88C23.8449 6.132 23.8789 6.38 23.9469 6.624C24.0149 6.864 24.1189 7.062 24.2589 7.218C24.4029 7.374 24.5889 7.452 24.8169 7.452ZM28.2928 9V0.323999H31.7608L33.1648 5.616L34.5808 0.323999H38.0368V9H35.6968V2.712L34.0048 9H32.3248L30.6268 2.712V9H28.2928ZM41.5196 9.12C40.8796 9.12 40.3236 8.984 39.8516 8.712C39.3836 8.44 39.0196 8.066 38.7596 7.59C38.5036 7.11 38.3756 6.56 38.3756 5.94C38.3756 5.288 38.5096 4.718 38.7776 4.23C39.0496 3.738 39.4216 3.356 39.8936 3.084C40.3696 2.812 40.9156 2.676 41.5316 2.676C42.1796 2.676 42.7376 2.818 43.2056 3.102C43.6776 3.382 44.0396 3.768 44.2916 4.26C44.5476 4.752 44.6756 5.312 44.6756 5.94C44.6756 6.556 44.5456 7.104 44.2856 7.584C44.0296 8.06 43.6656 8.436 43.1936 8.712C42.7216 8.984 42.1636 9.12 41.5196 9.12ZM41.5316 7.428C41.7796 7.428 41.9656 7.344 42.0896 7.176C42.2176 7.004 42.3016 6.796 42.3416 6.552C42.3856 6.308 42.4076 6.076 42.4076 5.856C42.4076 5.632 42.3856 5.404 42.3416 5.172C42.3016 4.936 42.2176 4.74 42.0896 4.584C41.9656 4.424 41.7796 4.344 41.5316 4.344C41.2796 4.344 41.0896 4.424 40.9616 4.584C40.8376 4.74 40.7536 4.936 40.7096 5.172C40.6656 5.404 40.6436 5.632 40.6436 5.856C40.6436 6.076 40.6656 6.308 40.7096 6.552C40.7536 6.796 40.8376 7.004 40.9616 7.176C41.0896 7.344 41.2796 7.428 41.5316 7.428ZM45.0352 9V2.796H47.2912V4.512C47.3872 4.18 47.5232 3.876 47.6992 3.6C47.8792 3.32 48.1072 3.096 48.3832 2.928C48.6592 2.76 48.9892 2.676 49.3732 2.676C49.4012 2.676 49.4232 2.676 49.4392 2.676C49.4552 2.676 49.4632 2.676 49.4632 2.676V4.884C49.4512 4.88 49.4392 4.878 49.4272 4.878C49.4192 4.878 49.4052 4.876 49.3852 4.872C48.9492 4.828 48.5972 4.832 48.3292 4.884C48.0652 4.936 47.8632 5.022 47.7232 5.142C47.5832 5.258 47.4892 5.394 47.4412 5.55C47.3932 5.702 47.3692 5.86 47.3692 6.024V9H45.0352ZM49.6148 10.932V2.796H51.9608V3.516C52.0768 3.356 52.2088 3.222 52.3568 3.114C52.5088 3.006 52.6668 2.92 52.8308 2.856C52.9948 2.792 53.1588 2.746 53.3228 2.718C53.4868 2.69 53.6408 2.676 53.7848 2.676C54.2168 2.676 54.6048 2.79 54.9488 3.018C55.2928 3.246 55.5648 3.598 55.7648 4.074C55.9648 4.546 56.0648 5.148 56.0648 5.88C56.0648 6.668 55.9448 7.3 55.7048 7.776C55.4688 8.248 55.1568 8.59 54.7688 8.802C54.3848 9.014 53.9728 9.12 53.5328 9.12C53.4048 9.12 53.2688 9.104 53.1248 9.072C52.9848 9.04 52.8428 8.99 52.6988 8.922C52.5588 8.85 52.4248 8.76 52.2968 8.652C52.1688 8.54 52.0528 8.404 51.9488 8.244V10.932H49.6148ZM52.9208 7.452C53.1808 7.452 53.4088 7.33 53.6048 7.086C53.8048 6.838 53.9048 6.436 53.9048 5.88C53.9048 5.376 53.8048 4.99 53.6048 4.722C53.4088 4.454 53.1808 4.32 52.9208 4.32C52.5808 4.32 52.3328 4.476 52.1768 4.788C52.0248 5.096 51.9488 5.46 51.9488 5.88C51.9488 6.132 51.9828 6.38 52.0508 6.624C52.1188 6.864 52.2228 7.062 52.3628 7.218C52.5068 7.374 52.6928 7.452 52.9208 7.452ZM56.4211 9V0.0839996H58.7551V3.678C58.8511 3.558 58.9631 3.43 59.0911 3.294C59.2231 3.158 59.3911 3.042 59.5951 2.946C59.8031 2.846 60.0691 2.796 60.3931 2.796C60.7811 2.796 61.1391 2.876 61.4671 3.036C61.7951 3.192 62.0591 3.424 62.2591 3.732C62.4591 4.04 62.5591 4.42 62.5591 4.872V9H60.2191V5.172C60.2191 4.968 60.1411 4.816 59.9851 4.716C59.8291 4.612 59.6631 4.56 59.4871 4.56C59.3751 4.56 59.2611 4.586 59.1451 4.638C59.0331 4.686 58.9391 4.758 58.8631 4.854C58.7911 4.95 58.7551 5.066 58.7551 5.202V9H56.4211Z"
        fill="currentColor"
      />
    </svg>
    <span class="sr-only">SnapMorph</span>
  </h1>
  <div class="text-lg text-blue-900">
    Select an element on the page to analyze its accessibility.
  </div>
</div>
  <div class="flex flex-row gap-2">
    <button
      class="mb-2 px-3 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 self-end"
      on:click={startOver}
    >
      New selection
    </button>
  </div>
</header>
<main class="flex flex-row gap-4 p-4 pb-0 mb-4 w-full">
  <!-- Left column: Preview and JSON -->
  <div class="flex flex-col flex-1 w-1/2">
    {#if snapshot}
      <div class="mb-4 w-full border rounded bg-white p-2">
        <h2 class="font-semibold text-sm mb-2">Live Preview</h2>
        <div
          class="border p-8 overflow-hidden"
          style="min-height:120px; max-height:800px; max-width:100%; width:fit-content; height:fit-content; display:block;"
        >
          {@html renderSnapshot(snapshot)}
        </div>
      </div>
      <div
        class="overflow-auto w-full max-h-48 bg-white rounded border p-2 text-xs"
      >
        <pre>{JSON.stringify(snapshot, null, 2)}</pre>
      </div>
    {:else}
      <div class="text-blue-500">
        No element selected yet. Use the selector on any page.
      </div>
    {/if}
  </div>
  <!-- Right column: LLM streaming result -->
  <div class="flex flex-col flex-1 w-1/2">
    <div class="-mt-6">
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
    {#if streamingResult}
      <div
        id="result"
        class="text-xs text-blue-900 whitespace-pre-wrap mb-2 border border-blue-600 rounded bg-blue-50 p-2 max-h-[80vh] overflow-auto"
      >
        {@html marked(streamingResult)}
      </div>
    {/if}
  </div>
</main>

<style>
  :global(#result > ol) {
    display: flex;
  }
</style>
