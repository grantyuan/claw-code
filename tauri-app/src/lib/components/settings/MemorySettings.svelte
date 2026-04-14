<script lang="ts">
  import { configStore } from '$stores/configStore';
  import { configService } from '$services/configService';
  import type { MemoryConfig, MemoryStore } from '$types/config';
  import Button from '$components/common/Button.svelte';

  interface Props {
    onClose?: () => void;
  }

  let { onClose }: Props = $props();

  let memoryConfig = $state<MemoryConfig>({
    maxContextWindow: 200000,
    summaryCompression: true,
    historyRetentionDays: 30,
    workingDirectory: '',
    fileWatching: true,
    autoDiscovery: true,
    additionalStores: [],
  });
  let hasUnsavedChanges = $state(false);

  $effect(() => {
    loadConfig();
  });

  async function loadConfig() {
    const config = await configService.loadGlobalConfig();
    memoryConfig = config.memory;
  }

  async function addStore() {
    const newStore: MemoryStore = {
      id: crypto.randomUUID(),
      type: 'database',
      connection: '',
      enabled: true,
    };
    memoryConfig.additionalStores = [...memoryConfig.additionalStores, newStore];
    hasUnsavedChanges = true;
  }

  async function deleteStore(id: string) {
    memoryConfig.additionalStores = memoryConfig.additionalStores.filter(s => s.id !== id);
    hasUnsavedChanges = true;
  }

  async function updateStore(id: string, updates: Partial<MemoryStore>) {
    memoryConfig.additionalStores = memoryConfig.additionalStores.map(s => s.id === id ? { ...s, ...updates } : s);
    hasUnsavedChanges = true;
  }

  function handleSave() {
    configStore.setDirty(true);
    configStore.saveToStorage();
    hasUnsavedChanges = false;
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h3 class="text-lg font-medium" style="color: var(--color-text);">Memory Configuration</h3>
    <Button variant="primary" size="sm" onclick={handleSave} disabled={!hasUnsavedChanges}>
      Save
    </Button>
  </div>

  <div class="space-y-4">
    <div class="p-4 rounded-lg border" style="border-color: var(--color-border); background: var(--color-bg);">
      <h4 class="text-md font-medium mb-3" style="color: var(--color-text);">Context Settings</h4>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-2" style="color: var(--color-text);">Max Context Window</label>
          <input
            type="number"
            class="input w-full"
            bind:value={memoryConfig.maxContextWindow}
            oninput={() => hasUnsavedChanges = true}
            min="10000"
            max="1000000"
          />
          <p class="text-xs mt-1" style="color: var(--color-text-secondary);">
            Current: {memoryConfig.maxContextWindow.toLocaleString()} tokens
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2" style="color: var(--color-text);">History Retention (days)</label>
          <input
            type="number"
            class="input w-full"
            bind:value={memoryConfig.historyRetentionDays}
            oninput={() => hasUnsavedChanges = true}
            min="1"
            max="365"
          />
        </div>
      </div>

      <div class="mt-4 space-y-3">
        <label class="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            bind:checked={memoryConfig.summaryCompression}
            onchange={() => hasUnsavedChanges = true}
          />
          <div>
            <span style="color: var(--color-text);">Summary Compression</span>
            <p class="text-xs" style="color: var(--color-text-secondary);">Automatically compress older messages to save context space</p>
          </div>
        </label>

        <label class="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            bind:checked={memoryConfig.fileWatching}
            onchange={() => hasUnsavedChanges = true}
          />
          <div>
            <span style="color: var(--color-text);">File Watching</span>
            <p class="text-xs" style="color: var(--color-text-secondary);">Monitor file changes for context</p>
          </div>
        </label>

        <label class="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            bind:checked={memoryConfig.autoDiscovery}
            onchange={() => hasUnsavedChanges = true}
          />
          <div>
            <span style="color: var(--color-text);">Auto Discovery</span>
            <p class="text-xs" style="color: var(--color-text-secondary);">Automatically detect project structure and relevant files</p>
          </div>
        </label>
      </div>
    </div>

    <div class="p-4 rounded-lg border" style="border-color: var(--color-border); background: var(--color-bg);">
      <h4 class="text-md font-medium mb-3" style="color: var(--color-text);">Working Directory</h4>

      <div>
        <label class="block text-sm font-medium mb-2" style="color: var(--color-text);">Default Working Directory</label>
        <input
          type="text"
          class="input w-full"
          bind:value={memoryConfig.workingDirectory}
          oninput={() => hasUnsavedChanges = true}
          placeholder="~/.clawcode/workspace"
        />
        <p class="text-xs mt-1" style="color: var(--color-text-secondary);">
          Where agent working files and temporary data are stored
        </p>
      </div>
    </div>

    <div>
      <div class="flex items-center justify-between mb-3">
        <h4 class="text-md font-medium" style="color: var(--color-text);">Additional Memory Stores</h4>
        <Button variant="secondary" size="sm" onclick={addStore}>
          Add Store
        </Button>
      </div>

      <div class="space-y-2">
        {#each memoryConfig.additionalStores as store (store.id)}
          <div class="p-4 rounded-lg border" style="border-color: var(--color-border); background: var(--color-bg);">
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-3 flex-1">
                <button
                  class="relative w-10 h-5 rounded-full transition-colors {store.enabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}"
                  onclick={() => updateStore(store.id, { enabled: !store.enabled })}
                  role="switch"
                  aria-checked={store.enabled}
                >
                  <span class="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform {store.enabled ? 'left-5' : 'left-0.5'}"></span>
                </button>
                <select
                  class="input"
                  value={store.type}
                  onchange={(e) => updateStore(store.id, { type: (e.target as HTMLSelectElement).value as any })}
                >
                  <option value="database">Database</option>
                  <option value="cache">Cache</option>
                  <option value="file">File System</option>
                </select>
              </div>
              <Button variant="secondary" size="sm" onclick={() => deleteStore(store.id)}>
                Delete
              </Button>
            </div>

            <div>
              <label class="block text-xs font-medium mb-1" style="color: var(--color-text);">Connection String</label>
              <input
                type="text"
                class="input w-full"
                value={store.connection}
                onchange={(e) => updateStore(store.id, { connection: (e.target as HTMLInputElement).value })}
                placeholder={store.type === 'database' ? 'postgresql://localhost:5432/memory' : '/path/to/store'}
              />
            </div>
          </div>
        {/each}

        {#if memoryConfig.additionalStores.length === 0}
          <p class="text-sm text-center py-4" style="color: var(--color-text-secondary);">
            No additional memory stores configured.
          </p>
        {/if}
      </div>
    </div>
  </div>
</div>
