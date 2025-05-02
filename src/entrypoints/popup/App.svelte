<script lang="ts">
import { onMount } from 'svelte';

let snapshot: SnapshotElement | null = null;

// Fetch the latest snapshot from the background script
async function fetchSnapshot() {
  try {
    const response = await browser.runtime.sendMessage({ type: 'UISNAP_GET_SNAPSHOT' });
    snapshot = response?.snapshot;
  } catch (e) {
    snapshot = null;
  }
}

onMount(fetchSnapshot);

// Type for the snapshot tree
interface SnapshotElement {
  tag: string;
  attributes: { name: string; value: string }[];
  style: Record<string, string>;
  children: SnapshotElement[];
  text?: string | null;
}
</script>

<main class="flex flex-col items-start gap-4 p-4 min-w-[320px]">
  <h1 class="text-lg font-bold">Selected Element Snapshot</h1>
  {#if snapshot}
    <div class="overflow-auto w-full max-h-96 bg-white rounded border p-2 text-xs">
      <pre>{JSON.stringify(snapshot, null, 2)}</pre>
    </div>
  {:else}
    <div class="text-gray-500">No element selected yet. Use the selector on any page.</div>
  {/if}
</main>
