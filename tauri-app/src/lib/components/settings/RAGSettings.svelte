<script lang="ts">
  import { configStore } from '$stores/configStore';
  import { configService } from '$services/configService';
  import type { RAGConfig, KnowledgeRepository } from '$types/config';
  import Button from '$components/common/Button.svelte';

  interface Props {
    onClose?: () => void;
  }

  let { onClose }: Props = $props();

  let ragConfig = $state<RAGConfig>({
    enabled: false,
    repositories: [],
    embeddingModel: 'text-embedding-3-small',
    topK: 5,
    similarityThreshold: 0.7,
  });
  let hasUnsavedChanges = $state(false);

  $effect(() => {
    loadConfig();
  });

  async function loadConfig() {
    const config = await configService.loadGlobalConfig();
    ragConfig = config.rag;
  }

  async function addRepository() {
    const newRepo: KnowledgeRepository = {
      id: crypto.randomUUID(),
      name: 'New Repository',
      type: 'local',
      path: '',
      syncFrequency: 3600,
    };
    ragConfig.repositories = [...ragConfig.repositories, newRepo];
    hasUnsavedChanges = true;
  }

  async function deleteRepository(id: string) {
    ragConfig.repositories = ragConfig.repositories.filter(r => r.id !== id);
    hasUnsavedChanges = true;
  }

  async function updateRepository(id: string, updates: Partial<KnowledgeRepository>) {
    ragConfig.repositories = ragConfig.repositories.map(r => r.id === id ? { ...r, ...updates } : r);
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
    <h3 class="text-lg font-medium" style="color: var(--color-text);">RAG & Knowledge</h3>
    <div class="flex items-center gap-3">
      <span class="text-sm" style="color: var(--color-text-secondary);">
        {ragConfig.enabled ? 'Enabled' : 'Disabled'}
      </span>
      <button
        class="relative w-12 h-6 rounded-full transition-colors {ragConfig.enabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}"
        onclick={() => { ragConfig.enabled = !ragConfig.enabled; hasUnsavedChanges = true; }}
        role="switch"
        aria-checked={ragConfig.enabled}
      >
        <span class="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform {ragConfig.enabled ? 'left-7' : 'left-1'}"></span>
      </button>
    </div>
  </div>

  {#if ragConfig.enabled}
    <div class="space-y-4">
      <div class="p-4 rounded-lg border" style="border-color: var(--color-border); background: var(--color-bg);">
        <h4 class="text-md font-medium mb-3" style="color: var(--color-text);">Embedding Settings</h4>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-2" style="color: var(--color-text);">Embedding Model</label>
            <select
              class="input w-full"
              bind:value={ragConfig.embeddingModel}
              onchange={() => hasUnsavedChanges = true}
            >
              <option value="text-embedding-3-small">OpenAI text-embedding-3-small</option>
              <option value="text-embedding-3-large">OpenAI text-embedding-3-large</option>
              <option value="text-embedding-ada-002">OpenAI text-embedding-ada-002</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2" style="color: var(--color-text);">Top-K Results</label>
            <input
              type="number"
              class="input w-full"
              bind:value={ragConfig.topK}
              min="1"
              max="20"
              oninput={() => hasUnsavedChanges = true}
            />
          </div>
        </div>

        <div class="mt-4">
          <label class="block text-sm font-medium mb-2" style="color: var(--color-text);">Similarity Threshold</label>
          <div class="space-y-2">
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              bind:value={ragConfig.similarityThreshold}
              oninput={() => hasUnsavedChanges = true}
              class="w-full"
            />
            <div class="flex justify-between text-xs" style="color: var(--color-text-secondary);">
              <span>More Results (0)</span>
              <span class="font-medium" style="color: var(--color-text);">{ragConfig.similarityThreshold.toFixed(1)}</span>
              <span>Higher Quality (1)</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-md font-medium" style="color: var(--color-text);">Knowledge Repositories</h4>
          <Button variant="secondary" size="sm" onclick={addRepository}>
            Add Repository
          </Button>
        </div>

        <div class="space-y-2">
          {#each ragConfig.repositories as repo (repo.id)}
            <div class="p-4 rounded-lg border" style="border-color: var(--color-border); background: var(--color-bg);">
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-3 flex-1">
                  <select
                    class="input"
                    value={repo.type}
                    onchange={(e) => updateRepository(repo.id, { type: (e.target as HTMLSelectElement).value as any })}
                  >
                    <option value="local">Local Directory</option>
                    <option value="remote">Remote URL</option>
                    <option value="database">Database</option>
                  </select>
                  <input
                    type="text"
                    class="input flex-1"
                    value={repo.name}
                    onchange={(e) => updateRepository(repo.id, { name: (e.target as HTMLInputElement).value })}
                    placeholder="Repository name"
                  />
                </div>
                <Button variant="secondary" size="sm" onclick={() => deleteRepository(repo.id)}>
                  Delete
                </Button>
              </div>

              {#if repo.type === 'local'}
                <div>
                  <label class="block text-xs font-medium mb-1" style="color: var(--color-text);">Path</label>
                  <input
                    type="text"
                    class="input w-full"
                    value={repo.path || ''}
                    onchange={(e) => updateRepository(repo.id, { path: (e.target as HTMLInputElement).value })}
                    placeholder="/path/to/knowledge"
                  />
                </div>
              {:else if repo.type === 'remote'}
                <div>
                  <label class="block text-xs font-medium mb-1" style="color: var(--color-text);">URL</label>
                  <input
                    type="url"
                    class="input w-full"
                    value={repo.url || ''}
                    onchange={(e) => updateRepository(repo.id, { url: (e.target as HTMLInputElement).value })}
                    placeholder="https://example.com/knowledge"
                  />
                </div>
              {/if}

              <div class="mt-3">
                <label class="block text-xs font-medium mb-1" style="color: var(--color-text);">Sync Frequency (seconds)</label>
                <input
                  type="number"
                  class="input w-full"
                  value={repo.syncFrequency}
                  onchange={(e) => updateRepository(repo.id, { syncFrequency: parseInt((e.target as HTMLInputElement).value) || 3600 })}
                  min="60"
                />
              </div>
            </div>
          {/each}

          {#if ragConfig.repositories.length === 0}
            <p class="text-sm text-center py-4" style="color: var(--color-text-secondary);">
              No repositories configured. Add one to start using RAG.
            </p>
          {/if}
        </div>
      </div>
    </div>
  {:else}
    <p class="text-sm" style="color: var(--color-text-secondary);">
      Enable RAG to configure knowledge repositories for enhanced context retrieval.
    </p>
  {/if}

  {#if hasUnsavedChanges}
    <div class="flex justify-end pt-4 border-t" style="border-color: var(--color-border);">
      <Button variant="primary" onclick={handleSave}>
        Save Changes
      </Button>
    </div>
  {/if}
</div>
