<script lang="ts">
  import { configStore } from '$stores/configStore';
  import { configService } from '$services/configService';
  import type { ModelConfig, ProviderConfig } from '$types/config';
  import Button from '$components/common/Button.svelte';

  interface Props {
    onClose?: () => void;
  }

  let { onClose }: Props = $props();

  let providers = $state<ProviderConfig[]>([]);
  let models = $state<ModelConfig[]>([]);
  let defaultProviderId = $state('');
  let selectedProviderId = $state('');
  let isEditing = $state(false);
  let hasUnsavedChanges = $derived($configStore.isDirty);

  $effect(() => {
    loadConfig();
  });

  async function loadConfig() {
    const config = await configService.loadGlobalConfig();
    providers = config.aiModel.providers;
    models = config.aiModel.models;
    defaultProviderId = config.aiModel.defaultProviderId;
  }

  async function addProvider() {
    const newProvider: Omit<ProviderConfig, 'id'> = {
      name: 'New Provider',
      type: 'anthropic',
      isDefault: providers.length === 0,
    };

    const id = await configService.addProvider(newProvider);
    providers = [...providers, { ...newProvider, id }];
    configStore.setDirty(true);

    if (providers.length === 1) {
      defaultProviderId = id;
    }
  }

  async function deleteProvider(id: string) {
    await configService.deleteProvider(id);
    providers = providers.filter(p => p.id !== id);
    models = models.filter(m => m.providerId !== id);
    configStore.setDirty(true);
  }

  async function updateProvider(id: string, updates: Partial<ProviderConfig>) {
    await configService.updateProvider(id, updates);
    providers = providers.map(p => p.id === id ? { ...p, ...updates } : p);
    configStore.setDirty(true);
  }

  async function addModel() {
    if (!selectedProviderId) return;

    const newModel: Omit<ModelConfig, 'id'> = {
      providerId: selectedProviderId,
      name: 'new-model',
      displayName: 'New Model',
      rank: models.length + 1,
      capabilities: {
        vision: false,
        functionCalling: false,
        streaming: true,
        maxTokens: 4096,
        contextWindow: 200000,
      },
      isDefault: models.length === 0,
      settings: {
        temperature: 0.7,
        maxTokens: 4096,
        timeout: 120,
      },
    };

    const id = await configService.addModel(selectedProviderId, newModel);
    models = [...models, { ...newModel, id }];
    configStore.setDirty(true);
  }

  async function deleteModel(id: string) {
    await configService.deleteModel(id);
    models = models.filter(m => m.id !== id);
    configStore.setDirty(true);
  }

  async function moveModelUp(index: number) {
    if (index <= 0) return;

    const newModels = [...models];
    [newModels[index - 1], newModels[index]] = [newModels[index], newModels[index - 1]];

    newModels.forEach((m, i) => m.rank = i + 1);

    const reorderedIds = newModels.map(m => m.id);
    await configService.reorderModels(reorderedIds);
    models = newModels;
    configStore.setDirty(true);
  }

  async function moveModelDown(index: number) {
    if (index >= models.length - 1) return;

    const newModels = [...models];
    [newModels[index], newModels[index + 1]] = [newModels[index + 1], newModels[index]];

    newModels.forEach((m, i) => m.rank = i + 1);

    const reorderedIds = newModels.map(m => m.id);
    await configService.reorderModels(reorderedIds);
    models = newModels;
    configStore.setDirty(true);
  }

  async function handleSave() {
    const config = await configService.loadGlobalConfig();
    config.aiModel.providers = providers;
    config.aiModel.models = models;
    config.aiModel.defaultProviderId = defaultProviderId;

    await configService.saveGlobalConfig(config);
    configStore.markSaved();
  }

  function getProviderName(providerId: string): string {
    return providers.find(p => p.id === providerId)?.name || 'Unknown';
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h3 class="text-lg font-medium" style="color: var(--color-text);">AI Model Configuration</h3>
    <Button variant="primary" size="sm" onclick={addProvider}>
      Add Provider
    </Button>
  </div>

  <div class="space-y-4">
    <div>
      <label class="block text-sm font-medium mb-2" style="color: var(--color-text);">Default Provider</label>
      <select
        class="input w-full"
        bind:value={defaultProviderId}
        onchange={() => configStore.setDirty(true)}
      >
        {#each providers as provider (provider.id)}
          <option value={provider.id}>{provider.name} ({provider.type})</option>
        {/each}
      </select>
    </div>

    <div>
      <label class="block text-sm font-medium mb-2" style="color: var(--color-text);">Providers</label>
      <div class="space-y-2">
        {#each providers as provider (provider.id)}
          <div class="p-4 rounded-lg border" style="border-color: var(--color-border); background: var(--color-bg);">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-3">
                <input
                  type="text"
                  class="input"
                  value={provider.name}
                  onchange={(e) => updateProvider(provider.id, { name: (e.target as HTMLInputElement).value })}
                />
                <select
                  class="input"
                  value={provider.type}
                  onchange={(e) => updateProvider(provider.id, { type: (e.target as HTMLSelectElement).value as any })}
                >
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                  <option value="local">Local (Ollama)</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <Button variant="secondary" size="sm" onclick={() => deleteProvider(provider.id)}>
                Delete
              </Button>
            </div>

            {#if provider.type === 'custom'}
              <div class="mb-3">
                <label class="block text-xs font-medium mb-1" style="color: var(--color-text);">API Endpoint</label>
                <input
                  type="url"
                  class="input w-full"
                  placeholder="https://api.example.com"
                  value={provider.endpoint || ''}
                  onchange={(e) => updateProvider(provider.id, { endpoint: (e.target as HTMLInputElement).value })}
                />
              </div>
            {/if}

            <div>
              <label class="block text-xs font-medium mb-1" style="color: var(--color-text);">API Key</label>
              <input
                type="password"
                class="input w-full"
                placeholder="sk-..."
                value={provider.apiKey || ''}
                onchange={(e) => updateProvider(provider.id, { apiKey: (e.target as HTMLInputElement).value })}
              />
            </div>
          </div>
        {/each}

        {#if providers.length === 0}
          <p class="text-sm text-center py-4" style="color: var(--color-text-secondary);">
            No providers configured. Click "Add Provider" to get started.
          </p>
        {/if}
      </div>
    </div>

    <div class="border-t" style="border-color: var(--color-border);"></div>

    <div class="flex items-center justify-between">
      <h4 class="text-md font-medium" style="color: var(--color-text);">Models</h4>
      <div class="flex items-center gap-2">
        <select class="input" bind:value={selectedProviderId}>
          <option value="">Select provider...</option>
          {#each providers as provider (provider.id)}
            <option value={provider.id}>{provider.name}</option>
          {/each}
        </select>
        <Button variant="secondary" size="sm" onclick={addModel} disabled={!selectedProviderId}>
          Add Model
        </Button>
      </div>
    </div>

    <div class="space-y-2">
      {#each models.sort((a, b) => a.rank - b.rank) as model, index (model.id)}
        <div class="p-4 rounded-lg border" style="border-color: var(--color-border); background: var(--color-bg);">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <span class="px-2 py-1 rounded text-xs font-medium" style="background: var(--color-primary-100, #dbeafe); color: var(--color-primary-700, #1d4ed8);">
                #{model.rank}
              </span>
              <input
                type="text"
                class="input"
                value={model.displayName}
                onchange={(e) => configService.updateModel(model.id, { displayName: (e.target as HTMLInputElement).value })}
              />
              <span class="text-xs px-2 py-1 rounded" style="background: var(--color-surface); color: var(--color-text-secondary);">
                {getProviderName(model.providerId)}
              </span>
            </div>
            <div class="flex items-center gap-1">
              <button
                class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                onclick={() => moveModelUp(index)}
                disabled={index === 0}
                title="Move up"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                onclick={() => moveModelDown(index)}
                disabled={index === models.length - 1}
                title="Move down"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <Button variant="secondary" size="sm" onclick={() => deleteModel(model.id)}>
                Delete
              </Button>
            </div>
          </div>

          <div class="grid grid-cols-4 gap-3 text-xs">
            <div>
              <span style="color: var(--color-text-secondary);">Vision:</span>
              <span style="color: var(--color-text);">{model.capabilities.vision ? 'Yes' : 'No'}</span>
            </div>
            <div>
              <span style="color: var(--color-text-secondary);">Fn Calling:</span>
              <span style="color: var(--color-text);">{model.capabilities.functionCalling ? 'Yes' : 'No'}</span>
            </div>
            <div>
              <span style="color: var(--color-text-secondary);">Max Tokens:</span>
              <span style="color: var(--color-text);">{model.capabilities.maxTokens.toLocaleString()}</span>
            </div>
            <div>
              <span style="color: var(--color-text-secondary);">Context:</span>
              <span style="color: var(--color-text);">{model.capabilities.contextWindow.toLocaleString()}</span>
            </div>
          </div>
        </div>
      {/each}

      {#if models.length === 0}
        <p class="text-sm text-center py-4" style="color: var(--color-text-secondary);">
          No models configured. Add a provider first, then add models.
        </p>
      {/if}
    </div>
  </div>

  {#if hasUnsavedChanges}
    <div class="flex justify-end pt-4 border-t" style="border-color: var(--color-border);">
      <Button variant="primary" onclick={handleSave}>
        Save Changes
      </Button>
    </div>
  {/if}
</div>
