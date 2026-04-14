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
  let hasUnsavedChanges = $derived($configStore.isDirty);
  let sortedModels = $derived([...models].sort((a, b) => a.rank - b.rank));

  function getSortedModelsForProvider(providerId: string): ModelConfig[] {
    return models.filter(m => m.providerId === providerId).sort((a, b) => a.rank - b.rank);
  }

  const PROVIDER_DEFAULTS = {
    anthropic: {
      endpoint: 'https://api.anthropic.com',
      name: 'Anthropic'
    },
    openai: {
      endpoint: 'https://api.openai.com/v1',
      name: 'OpenAI'
    },
    ollama: {
      endpoint: 'http://localhost:11434/v1',
      name: 'Ollama'
    },
    other: {
      endpoint: '',
      name: 'Custom Provider'
    }
  };

  const COMMON_MODELS = {
    anthropic: [
      { name: 'claude-opus-4-5', displayName: 'Claude Opus 4', capabilities: { vision: true, functionCalling: true, streaming: true, maxTokens: 4096, contextWindow: 200000 } },
      { name: 'claude-sonnet-4-5', displayName: 'Claude Sonnet 4', capabilities: { vision: true, functionCalling: true, streaming: true, maxTokens: 4096, contextWindow: 200000 } },
      { name: 'claude-haiku-3-5', displayName: 'Claude Haiku 3.5', capabilities: { vision: true, functionCalling: true, streaming: true, maxTokens: 4096, contextWindow: 200000 } },
    ],
    openai: [
      { name: 'gpt-4o', displayName: 'GPT-4o', capabilities: { vision: true, functionCalling: true, streaming: true, maxTokens: 4096, contextWindow: 128000 } },
      { name: 'gpt-4-turbo', displayName: 'GPT-4 Turbo', capabilities: { vision: true, functionCalling: true, streaming: true, maxTokens: 4096, contextWindow: 128000 } },
      { name: 'gpt-3.5-turbo', displayName: 'GPT-3.5 Turbo', capabilities: { vision: false, functionCalling: true, streaming: true, maxTokens: 4096, contextWindow: 16385 } },
    ],
    ollama: [
      { name: 'llama3', displayName: 'Llama 3', capabilities: { vision: false, functionCalling: false, streaming: true, maxTokens: 4096, contextWindow: 8192 } },
      { name: 'mistral', displayName: 'Mistral', capabilities: { vision: false, functionCalling: false, streaming: true, maxTokens: 4096, contextWindow: 8192 } },
      { name: 'codellama', displayName: 'Code Llama', capabilities: { vision: false, functionCalling: false, streaming: true, maxTokens: 4096, contextWindow: 16384 } },
    ],
    other: []
  };

  $effect(() => {
    loadConfig();
  });

  async function loadConfig() {
    const config = await configService.loadGlobalConfig();
    providers = config.aiModel.providers;
    models = config.aiModel.models;
    defaultProviderId = config.aiModel.defaultProviderId;
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

  function onProviderTypeChange(providerId: string, type: ProviderConfig['type']) {
    const defaults = PROVIDER_DEFAULTS[type];
    updateProvider(providerId, {
      type,
      endpoint: defaults.endpoint,
      name: defaults.name,
    });
  }

  async function addPresetModels(providerId: string) {
    const provider = providers.find(p => p.id === providerId);
    if (!provider) return;

    const presets = COMMON_MODELS[provider.type] || [];
    const existingNames = models.filter(m => m.providerId === providerId).map(m => m.name);

    for (const preset of presets) {
      if (!existingNames.includes(preset.name)) {
        const newModel: Omit<ModelConfig, 'id'> = {
          providerId,
          name: preset.name,
          displayName: preset.displayName,
          rank: models.length + 1,
          capabilities: preset.capabilities,
          isDefault: false,
          settings: { temperature: 0.7, maxTokens: 4096, timeout: 120 },
        };
        const id = await configService.addModel(providerId, newModel);
        models = [...models, { ...newModel, id }];
      }
    }
    configStore.setDirty(true);
  }

  async function addCustomModel(providerId: string) {
    const customName = prompt('Enter custom model name (e.g., gpt-4-turbo):');
    if (!customName) return;

    const newModel: Omit<ModelConfig, 'id'> = {
      providerId,
      name: customName,
      displayName: customName,
      rank: models.length + 1,
      capabilities: { vision: false, functionCalling: false, streaming: true, maxTokens: 4096, contextWindow: 128000 },
      isDefault: false,
      settings: { temperature: 0.7, maxTokens: 4096, timeout: 120 },
    };

    const id = await configService.addModel(providerId, newModel);
    models = [...models, { ...newModel, id }];
    configStore.setDirty(true);
  }

  async function deleteModel(id: string) {
    await configService.deleteModel(id);
    models = models.filter(m => m.id !== id);
    configStore.setDirty(true);
  }

  async function moveModelUp(index: number) {
    const sortedModels = [...models].sort((a, b) => a.rank - b.rank);
    if (index <= 0) return;

    [sortedModels[index - 1], sortedModels[index]] = [sortedModels[index], sortedModels[index - 1]];
    sortedModels.forEach((m, i) => m.rank = i + 1);

    const reorderedIds = sortedModels.map(m => m.id);
    await configService.reorderModels(reorderedIds);
    models = sortedModels;
    configStore.setDirty(true);
  }

  async function moveModelDown(index: number) {
    const sortedModels = [...models].sort((a, b) => a.rank - b.rank);
    if (index >= sortedModels.length - 1) return;

    [sortedModels[index], sortedModels[index + 1]] = [sortedModels[index + 1], sortedModels[index]];
    sortedModels.forEach((m, i) => m.rank = i + 1);

    const reorderedIds = sortedModels.map(m => m.id);
    await configService.reorderModels(reorderedIds);
    models = sortedModels;
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

  function getModelsForProvider(providerId: string): ModelConfig[] {
    return models.filter(m => m.providerId === providerId);
  }

  function getProviderTypeLabel(type: ProviderConfig['type']): string {
    switch (type) {
      case 'anthropic': return 'Anthropic';
      case 'openai': return 'OpenAI';
      case 'ollama': return 'Ollama';
      case 'other': return 'Other Protocol';
    }
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h3 class="text-lg font-medium" style="color: var(--color-text);">AI Model Configuration</h3>
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
          <option value={provider.id}>{provider.name} ({getProviderTypeLabel(provider.type)})</option>
        {/each}
      </select>
    </div>

    <div>
      <label class="block text-sm font-medium mb-2" style="color: var(--color-text);">Providers</label>
      <div class="space-y-2">
        {#each providers as provider (provider.id)}
          <div class="p-4 rounded-lg border" style="border-color: var(--color-border); background: var(--color-bg);">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-3 flex-1">
                <input
                  type="text"
                  class="input w-48"
                  value={provider.name}
                  onchange={(e) => updateProvider(provider.id, { name: (e.target as HTMLInputElement).value })}
                />
                <select
                  class="input"
                  value={provider.type}
                  onchange={(e) => onProviderTypeChange(provider.id, (e.target as HTMLSelectElement).value as ProviderConfig['type'])}
                >
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                  <option value="ollama">Ollama</option>
                  <option value="other">Other Protocol</option>
                </select>
              </div>
              <Button variant="secondary" size="sm" onclick={() => deleteProvider(provider.id)}>
                Delete
              </Button>
            </div>

            <div class="mb-3">
              <label class="block text-xs font-medium mb-1" for="endpoint-{provider.id}" style="color: var(--color-text);">API Endpoint</label>
              <input
                id="endpoint-{provider.id}"
                type="url"
                class="input w-full"
                placeholder="https://api.example.com"
                value={provider.endpoint || ''}
                onchange={(e) => updateProvider(provider.id, { endpoint: (e.target as HTMLInputElement).value })}
              />
              {#if provider.type !== 'other'}
                <p class="text-xs mt-1" style="color: var(--color-text-secondary);">
                  Default: {PROVIDER_DEFAULTS[provider.type].endpoint}
                </p>
              {/if}
            </div>

            <div>
              <label class="block text-xs font-medium mb-1" for="apikey-{provider.id}" style="color: var(--color-text);">API Key</label>
              <input
                id="apikey-{provider.id}"
                type="password"
                class="input w-full"
                placeholder="sk-..."
                value={provider.apiKey || ''}
                onchange={(e) => updateProvider(provider.id, { apiKey: (e.target as HTMLInputElement).value })}
              />
            </div>

            <div class="mt-4 pt-4 border-t" style="border-color: var(--color-border);">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium" style="color: var(--color-text);">Models for {provider.name}</span>
                <div class="flex gap-2">
                  <Button variant="secondary" size="sm" onclick={() => addPresetModels(provider.id)}>
                    Add Preset
                  </Button>
                  <Button variant="secondary" size="sm" onclick={() => addCustomModel(provider.id)}>
                    Add Custom
                  </Button>
                </div>
              </div>

              {#if getModelsForProvider(provider.id).length === 0}
                <p class="text-xs py-2" style="color: var(--color-text-secondary);">
                  No models configured. Click "Add Preset" or "Add Custom" to add models.
                </p>
              {:else}
                <div class="space-y-1">
                  {#each getSortedModelsForProvider(provider.id) as model, index (model.id)}
                    <div class="flex items-center justify-between p-2 rounded" style="background: var(--color-surface);">
                      <div class="flex items-center gap-2">
                        <span class="px-2 py-0.5 rounded text-xs font-medium" style="background: var(--color-primary-100, #dbeafe); color: var(--color-primary-700, #1d4ed8);">
                          #{model.rank}
                        </span>
                        <span style="color: var(--color-text);">{model.displayName}</span>
                        <span class="text-xs" style="color: var(--color-text-secondary);">({model.name})</span>
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
                          disabled={index === getModelsForProvider(provider.id).length - 1}
                          title="Move down"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <button
                          class="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600"
                          onclick={() => deleteModel(model.id)}
                          title="Delete"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        {/each}

        {#if providers.length === 0}
          <p class="text-sm text-center py-4" style="color: var(--color-text-secondary);">
            No providers configured. Please add a provider.
          </p>
        {/if}
      </div>
    </div>
  </div>

  <div class="border-t" style="border-color: var(--color-border);"></div>

  <div>
    <h4 class="text-md font-medium mb-3" style="color: var(--color-text);">All Models (Ranked)</h4>
    <p class="text-xs mb-3" style="color: var(--color-text-secondary);">
      Models are ranked by capability (1 = best). Lower-ranked models serve as fallbacks for higher-ranked ones.
    </p>

    <div class="space-y-2">
      {#each sortedModels as model, index (model.id)}
        <div class="p-3 rounded-lg border flex items-center justify-between" style="border-color: var(--color-border); background: var(--color-bg);">
          <div class="flex items-center gap-3">
            <span class="px-2 py-1 rounded text-sm font-bold" style="background: var(--color-primary-500); color: white;">
              {model.rank}
            </span>
            <div>
              <div class="font-medium" style="color: var(--color-text);">{model.displayName}</div>
              <div class="text-xs" style="color: var(--color-text-secondary);">
                {providers.find(p => p.id === model.providerId)?.name || 'Unknown'} • {model.name}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button
              class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              onclick={() => moveModelUp(index)}
              disabled={index === 0}
              title="Move up (higher rank)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              onclick={() => moveModelDown(index)}
              disabled={index === models.length - 1}
              title="Move down (lower rank)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      {/each}

      {#if models.length === 0}
        <p class="text-sm text-center py-4" style="color: var(--color-text-secondary);">
          No models configured. Add a provider and models above.
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
