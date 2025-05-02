<script context="module" lang="ts">
export interface SnapshotElement {
  tag: string;
  attributes: { name: string; value: string }[];
  style: Record<string, string>;
  children: SnapshotElement[];
  text?: string | null;
}
</script>

<script lang="ts">
export let node: import('./TreeView.svelte').SnapshotElement;
</script>

{#if node}
  <div style="margin-left: 1em;">
    <div><b>{node.tag}</b>
      {#if node.attributes && node.attributes.length > 0}
        {#each node.attributes as attr}
          {' '}{attr.name}="{attr.value}"
        {/each}
      {/if}
    </div>
    {#if node.text}
      <div style="color: #555">{node.text}</div>
    {/if}
    {#if node.children && node.children.length > 0}
      <div>
        {#each node.children as child}
          <svelte:self node={child} />
        {/each}
      </div>
    {/if}
  </div>
{/if} 