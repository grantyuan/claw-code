<script lang="ts">
  import { configStore } from '$stores/configStore';
  import { toastStore } from '$stores/toastStore';
  import { runtimeStore } from '$stores/runtimeStore';
  import { apiService } from '$services/apiService';
  import type { GlobalConfig, AIModelGlobalConfig, ProviderConfig, ModelConfig } from '$types/config';

  let config = $derived($configStore.config);
  let showAddProvider = $state(false);
  let showAddModel = $state(false);
  let editingModelId = $state<string | null>(null);
  let testingModelId = $state<string | null>(null);
  let testResults = $state<Map<string, { success: boolean; message: string; latency?: number }>>(new Map());
  let initializingRuntime = $state(false);

  let newProviderName = $state('');
  let newProviderEndpoint = $state('http://localhost:8000/v1');
  let newProviderType = $state<'openai' | 'anthropic' | 'ollama' | 'other'>('openai');

  let newModelName = $state('');
  let newModelId = $state('');
  let newModelProviderId = $state('');
  let newModelMaxTokens = $state(4096);
  let newModelTemperature = $state(0.7);
  let newModelTopP = $state(1.0);

  let providers = $derived(config?.aiModel?.providers || []);
  let defaultProviderId = $derived(config?.aiModel?.defaultProviderId || '');
  let models = $derived(config?.aiModel?.models || []);

  function getDefaultAIModel(): AIModelGlobalConfig {
    return {
      providers: [],
      defaultProviderId: '',
      models: [],
      tieredLM: {
        enabled: false,
        auxiliaryModelId: null,
        fallbackChain: [],
        complexityThreshold: 0.5,
      },
    };
  }

  function getDefaultConfig(): GlobalConfig {
    return {
      version: '1.0.0',
      lastModified: new Date().toISOString(),
      aiModel: getDefaultAIModel(),
      agents: { roles: [], collaborationPattern: 'sequential', conflictResolution: 'leader-decides' },
      rag: { enabled: false, repositories: [], embeddingModel: '', topK: 5, similarityThreshold: 0.7 },
      mcp: { servers: [], tools: [] },
      memory: { maxContextWindow: 128000, summaryCompression: true, historyRetentionDays: 30, workingDirectory: '', fileWatching: false, autoDiscovery: false, additionalStores: [] },
      remote: { computers: [], deployment: { version: '1.0.0', installPath: '', autoStart: false, autoUpdate: false, healthCheckInterval: 30000, rollbackOnFailure: false } },
      p2p: { enabled: false, discoveryMethod: 'bootstrap', relayServers: [], natTraversal: false, encryption: false, peerAuthentication: false },
      ui: { theme: 'dark', fontSize: 14, fontFamily: 'system-ui', panelLayout: { leftPanelWidth: 300, rightPanelWidth: 300, leftPanelCollapsed: false, rightPanelCollapsed: false }, notifications: { sound: false, desktop: false, inApp: true, level: 'important' }, keyboardShortcuts: {}, language: 'en' },
    };
  }

  function getAIModel(): AIModelGlobalConfig {
    return config?.aiModel || getDefaultAIModel();
  }

  function updateAIModel(updates: Partial<AIModelGlobalConfig>) {
    const currentConfig = config || getDefaultConfig();
    const currentAIModel = getAIModel();
    
    configStore.updateConfig({
      ...currentConfig,
      aiModel: {
        providers: updates.providers ?? currentAIModel.providers,
        defaultProviderId: updates.defaultProviderId ?? currentAIModel.defaultProviderId,
        models: updates.models ?? currentAIModel.models,
        tieredLM: updates.tieredLM ?? currentAIModel.tieredLM,
      },
    });
  }

  async function testModel(model: ModelConfig) {
    const provider = providers.find((p: ProviderConfig) => p.id === model.providerId);
    if (!provider) {
      toastStore.addToast({ type: 'error', message: 'Provider not found for this model', duration: 3000 });
      return;
    }

    testingModelId = model.id;
    testResults.set(model.id, { success: false, message: 'Testing...' });

    const startTime = Date.now();

    try {
      const response = await fetch(`${provider.endpoint}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model.id,
          messages: [{ role: 'user', content: 'Say "OK" if you can hear me.' }],
          max_tokens: 10,
          temperature: model.settings?.temperature ?? 0.7,
        }),
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        testResults.set(model.id, { success: false, message: `HTTP ${response.status}: ${errorText.slice(0, 100)}`, latency });
        toastStore.addToast({ type: 'error', message: `Model test failed: HTTP ${response.status}`, duration: 4000 });
      } else {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || 'No response';
        testResults.set(model.id, { success: true, message: `Response: "${content.slice(0, 50)}${content.length > 50 ? '...' : ''}"`, latency });
        toastStore.addToast({ type: 'success', message: `Model "${model.name}" is working! (${latency}ms)`, duration: 3000 });
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      testResults.set(model.id, { success: false, message: errorMsg, latency });
      toastStore.addToast({ type: 'error', message: `Connection failed: ${errorMsg}`, duration: 4000 });
    } finally {
      testingModelId = null;
    }
  }

  async function initRuntimeWithFirstModel() {
    if (models.length === 0) {
      toastStore.addToast({ type: 'error', message: 'No models configured. Add a model first.', duration: 3000 });
      return;
    }
    if (providers.length === 0) {
      toastStore.addToast({ type: 'error', message: 'No providers configured. Add a provider first.', duration: 3000 });
      return;
    }

    const model = models[0];
    const providerId = model.providerId || '';
    const provider = providers.find((p: ProviderConfig) => p.id === providerId);
    
    if (!provider) {
      toastStore.addToast({ type: 'error', message: 'Provider not found for the default model', duration: 3000 });
      return;
    }

    initializingRuntime = true;
    toastStore.addToast({ type: 'info', message: 'Initializing runtime...', duration: 2000 });

    try {
      const result = await apiService.initRuntime(
        provider.type,
        provider.endpoint || '',
        provider.apiKey || '',
        model.id
      );

      if (result.success) {
        toastStore.addToast({ type: 'success', message: 'Runtime initialized successfully!', duration: 3000 });
        await runtimeStore.checkHealth();
      } else {
        toastStore.addToast({ type: 'error', message: `Failed to initialize runtime: ${result.error || 'Unknown error'}`, duration: 4000 });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      toastStore.addToast({ type: 'error', message: `Runtime init failed: ${errorMsg}`, duration: 4000 });
    } finally {
      initializingRuntime = false;
    }
  }

  function addProvider() {
    if (!newProviderName.trim() || !newProviderEndpoint.trim()) {
      toastStore.addToast({ type: 'error', message: 'Provider name and endpoint are required', duration: 3000 });
      return;
    }

    const newProvider: ProviderConfig = {
      id: `provider-${Date.now()}`,
      name: newProviderName.trim(),
      type: newProviderType,
      endpoint: newProviderEndpoint.trim(),
      isDefault: providers.length === 0,
    };

    updateAIModel({
      providers: [...providers, newProvider],
      defaultProviderId: getAIModel().defaultProviderId || newProvider.id,
    });

    newProviderName = '';
    newProviderEndpoint = 'http://localhost:8000/v1';
    newProviderType = 'openai';
    showAddProvider = false;

    toastStore.addToast({ type: 'success', message: `Provider "${newProvider.name}" added`, duration: 3000 });
  }

  function removeProvider(id: string) {
    const updatedProviders = providers.filter((p: ProviderConfig) => p.id !== id);
    const updatedDefaultId = defaultProviderId === id ? (updatedProviders[0]?.id || '') : defaultProviderId;

    updateAIModel({
      providers: updatedProviders,
      defaultProviderId: updatedDefaultId,
    });

    toastStore.addToast({ type: 'info', message: 'Provider removed', duration: 2000 });
  }

  function setDefaultProvider(id: string) {
    updateAIModel({
      defaultProviderId: id,
      providers: providers.map((p: ProviderConfig) => ({ ...p, isDefault: p.id === id })),
    });

    toastStore.addToast({ type: 'success', message: 'Default provider updated', duration: 2000 });
  }

  function updateProviderEndpoint(id: string, endpoint: string) {
    updateAIModel({
      providers: providers.map((p: ProviderConfig) => p.id === id ? { ...p, endpoint } : p),
    });
  }

  function resetNewModelForm() {
    newModelName = '';
    newModelId = '';
    newModelProviderId = defaultProviderId || '';
    newModelMaxTokens = 4096;
    newModelTemperature = 0.7;
    newModelTopP = 1.0;
  }

  function openAddModel() {
    resetNewModelForm();
    showAddModel = true;
  }

  function addModel() {
    if (!newModelName.trim()) {
      toastStore.addToast({ type: 'error', message: 'Model name is required', duration: 3000 });
      return;
    }
    if (!newModelId.trim()) {
      toastStore.addToast({ type: 'error', message: 'Model ID is required (e.g., gpt-4o, llama-3)', duration: 3000 });
      return;
    }
    if (!newModelProviderId) {
      toastStore.addToast({ type: 'error', message: 'Please select a provider', duration: 3000 });
      return;
    }

    const modelId = newModelId.trim();
    
    const newModel: ModelConfig = {
      id: modelId,
      name: newModelName.trim(),
      displayName: newModelName.trim(),
      providerId: newModelProviderId,
      rank: models.length,
      capabilities: {
        vision: false,
        functionCalling: true,
        streaming: true,
        maxTokens: newModelMaxTokens,
        contextWindow: newModelMaxTokens * 4,
      },
      isDefault: models.length === 0,
      settings: {
        temperature: newModelTemperature,
        maxTokens: newModelMaxTokens,
        topP: newModelTopP,
        timeout: 60000,
      },
    };

    updateAIModel({
      models: [...models, newModel],
    });

    resetNewModelForm();
    showAddModel = false;

    toastStore.addToast({ type: 'success', message: `Model "${newModel.name}" added`, duration: 3000 });
  }

  function updateModel(id: string, updates: Partial<ModelConfig>) {
    updateAIModel({
      models: models.map((m: ModelConfig) => m.id === id ? { ...m, ...updates } : m),
    });
  }

  function updateModelId(oldId: string, newId: string) {
    const trimmedNewId = newId.trim();
    if (!trimmedNewId) {
      toastStore.addToast({ type: 'error', message: 'Model ID cannot be empty', duration: 3000 });
      return;
    }
    if (trimmedNewId !== oldId && models.some((m: ModelConfig) => m.id === trimmedNewId)) {
      toastStore.addToast({ type: 'error', message: 'Model ID already exists', duration: 3000 });
      return;
    }
    updateAIModel({
      models: models.map((m: ModelConfig) => m.id === oldId ? { ...m, id: trimmedNewId } : m),
    });
    if (editingModelId === oldId) {
      editingModelId = trimmedNewId;
    }
  }

  function removeModel(id: string) {
    updateAIModel({
      models: models.filter((m: ModelConfig) => m.id !== id),
    });
    if (editingModelId === id) {
      editingModelId = null;
    }
  }
</script>

<div class="space-y-6">
  <div>
    <div class="flex items-center justify-between mb-3">
      <h4 class="text-md font-medium" style="color: var(--color-text);">AI Providers</h4>
      <button
        class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        style="background-color: var(--color-primary-500, #3b82f6); color: white;"
        onclick={() => showAddProvider = !showAddProvider}
      >
        {showAddProvider ? 'Cancel' : '+ Add Provider'}
      </button>
    </div>

    {#if showAddProvider}
      <div class="p-4 mb-4 rounded-lg border" style="background-color: var(--color-bg); border-color: var(--color-border);">
        <h5 class="text-sm font-medium mb-3" style="color: var(--color-text);">New Provider</h5>
        <div class="space-y-3">
          <div>
            <label class="block text-sm mb-1" style="color: var(--color-text-secondary);">Name</label>
            <input type="text" class="input" placeholder="e.g., Local LLM" bind:value={newProviderName} />
          </div>
          <div>
            <label class="block text-sm mb-1" style="color: var(--color-text-secondary);">Endpoint URL</label>
            <input type="text" class="input" placeholder="http://localhost:8000/v1" bind:value={newProviderEndpoint} />
            <p class="text-xs mt-1" style="color: var(--color-text-secondary);">OpenAI-compatible API endpoint</p>
          </div>
          <div>
            <label class="block text-sm mb-1" style="color: var(--color-text-secondary);">Type</label>
            <select class="input" bind:value={newProviderType}>
              <option value="openai">OpenAI Compatible</option>
              <option value="anthropic">Anthropic</option>
              <option value="ollama">Ollama</option>
              <option value="other">Other</option>
            </select>
          </div>
          <button
            class="w-full px-3 py-2 rounded-lg text-sm font-medium"
            style="background-color: var(--color-primary-500, #3b82f6); color: white;"
            onclick={addProvider}
          >
            Add Provider
          </button>
        </div>
      </div>
    {/if}

    {#if providers.length === 0}
      <div class="p-4 rounded-lg text-center" style="background-color: var(--color-bg); border: 1px dashed var(--color-border);">
        <p class="text-sm" style="color: var(--color-text-secondary);">No providers configured</p>
        <p class="text-xs mt-1" style="color: var(--color-text-secondary);">Add an OpenAI-compatible provider to start chatting</p>
      </div>
    {:else}
      <div class="space-y-2">
        {#each providers as provider (provider.id)}
          <div class="p-3 rounded-lg flex items-center gap-3" style="background-color: var(--color-bg); border: 1px solid var(--color-border);">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium" style="color: var(--color-text);">{provider.name}</span>
                {#if provider.isDefault || provider.id === defaultProviderId}
                  <span class="text-xs px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">Default</span>
                {/if}
                <span class="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800" style="color: var(--color-text-secondary);">{provider.type}</span>
              </div>
              <input
                type="text"
                class="input mt-1 text-xs"
                value={provider.endpoint}
                onchange={(e) => updateProviderEndpoint(provider.id, (e.target as HTMLInputElement).value)}
                style="font-family: monospace;"
              />
            </div>
            <div class="flex items-center gap-1">
              {#if !provider.isDefault && provider.id !== defaultProviderId}
                <button
                  class="px-2 py-1 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-700"
                  style="color: var(--color-text-secondary);"
                  onclick={() => setDefaultProvider(provider.id)}
                  title="Set as default"
                >
                  Set Default
                </button>
              {/if}
              <button
                class="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900"
                style="color: #ef4444;"
                onclick={() => removeProvider(provider.id)}
                title="Remove provider"
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

  <div>
    <div class="flex items-center justify-between mb-3">
      <h4 class="text-md font-medium" style="color: var(--color-text);">Models</h4>
      <div class="flex items-center gap-2">
        <button
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style="background-color: var(--color-success, #22c55e); color: white;"
          onclick={initRuntimeWithFirstModel}
          disabled={initializingRuntime || models.length === 0}
          title="Initialize runtime with the first configured model"
        >
          {#if initializingRuntime}
            <svg class="w-4 h-4 animate-spin inline-block mr-1" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Connecting...
          {:else}
            ⚡ Connect Runtime
          {/if}
        </button>
        <button
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style="background-color: var(--color-primary-500, #3b82f6); color: white;"
          onclick={openAddModel}
        >
          + Add Model
        </button>
      </div>
    </div>

    {#if showAddModel}
      <div class="p-4 mb-4 rounded-lg border" style="background-color: var(--color-bg); border-color: var(--color-border);">
        <h5 class="text-sm font-medium mb-3" style="color: var(--color-text);">New Model</h5>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm mb-1" style="color: var(--color-text-secondary);">Model Name *</label>
              <input type="text" class="input" placeholder="e.g., GPT-4, Claude 3" bind:value={newModelName} />
            </div>
            <div>
              <label class="block text-sm mb-1" style="color: var(--color-text-secondary);">Model ID *</label>
              <input type="text" class="input" placeholder="e.g., gpt-4o, llama-3, claude-3-opus" bind:value={newModelId} style="font-family: monospace;" />
              <p class="text-xs mt-0.5" style="color: var(--color-text-secondary);">Remote API model identifier</p>
            </div>
          </div>
          
          <div>
            <label class="block text-sm mb-1" style="color: var(--color-text-secondary);">Provider *</label>
            <select class="input" bind:value={newModelProviderId}>
              <option value="">Select a provider</option>
              {#each providers as provider}
                <option value={provider.id}>{provider.name}</option>
              {/each}
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm mb-1" style="color: var(--color-text-secondary);">Max Tokens</label>
              <input type="number" class="input" bind:value={newModelMaxTokens} min="1" max="1000000" />
            </div>
            <div>
              <label class="block text-sm mb-1" style="color: var(--color-text-secondary);">Temperature</label>
              <input type="number" class="input" bind:value={newModelTemperature} min="0" max="2" step="0.1" />
            </div>
          </div>

          <div class="flex gap-2">
            <button
              class="flex-1 px-3 py-2 rounded-lg text-sm font-medium"
              style="background-color: var(--color-primary-500, #3b82f6); color: white;"
              onclick={addModel}
            >
              Add Model
            </button>
            <button
              class="px-3 py-2 rounded-lg text-sm font-medium"
              style="background-color: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text);"
              onclick={() => { showAddModel = false; resetNewModelForm(); }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    {/if}

    {#if models.length === 0 && !showAddModel}
      <div class="p-4 rounded-lg text-center" style="background-color: var(--color-bg); border: 1px dashed var(--color-border);">
        <p class="text-sm" style="color: var(--color-text-secondary);">No models configured</p>
        <p class="text-xs mt-1" style="color: var(--color-text-secondary);">Add a model to use with your provider</p>
      </div>
    {:else}
      <div class="space-y-2">
        {#each models as model (model.id)}
          <div class="p-3 rounded-lg" style="background-color: var(--color-bg); border: 1px solid var(--color-border);">
            {#if editingModelId === model.id}
              <div class="space-y-3">
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs mb-1" style="color: var(--color-text-secondary);">Name</label>
                    <input 
                      type="text" 
                      class="input text-sm" 
                      value={model.name}
                      onchange={(e) => updateModel(model.id, { name: (e.target as HTMLInputElement).value, displayName: (e.target as HTMLInputElement).value })}
                    />
                  </div>
                  <div>
                    <label class="block text-xs mb-1" style="color: var(--color-text-secondary);">Model ID *</label>
                    <input 
                      type="text" 
                      class="input text-sm" 
                      value={model.id} 
                      style="font-family: monospace;" 
                      onchange={(e) => updateModelId(model.id, (e.target as HTMLInputElement).value)}
                    />
                  </div>
                </div>
                
                <div>
                  <label class="block text-xs mb-1" style="color: var(--color-text-secondary);">Provider</label>
                  <select 
                    class="input text-sm"
                    value={model.providerId}
                    onchange={(e) => updateModel(model.id, { providerId: (e.target as HTMLSelectElement).value })}
                  >
                    {#each providers as provider}
                      <option value={provider.id}>{provider.name}</option>
                    {/each}
                  </select>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs mb-1" style="color: var(--color-text-secondary);">Max Tokens</label>
                    <input 
                      type="number" 
                      class="input text-sm" 
                      value={model.settings?.maxTokens || 4096}
                      onchange={(e) => updateModel(model.id, { settings: { ...model.settings, maxTokens: parseInt((e.target as HTMLInputElement).value) || 4096, temperature: model.settings?.temperature ?? 0.7, topP: model.settings?.topP ?? 1.0, timeout: model.settings?.timeout ?? 60000 } })}
                    />
                  </div>
                  <div>
                    <label class="block text-xs mb-1" style="color: var(--color-text-secondary);">Temperature</label>
                    <input 
                      type="number" 
                      class="input text-sm" 
                      value={model.settings?.temperature ?? 0.7}
                      min="0" max="2" step="0.1"
                      onchange={(e) => updateModel(model.id, { settings: { ...model.settings, temperature: parseFloat((e.target as HTMLInputElement).value) || 0.7, maxTokens: model.settings?.maxTokens ?? 4096, topP: model.settings?.topP ?? 1.0, timeout: model.settings?.timeout ?? 60000 } })}
                    />
                  </div>
                </div>

                <div class="flex gap-2">
                  <button
                    class="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                    style="background-color: var(--color-primary-500, #3b82f6); color: white;"
                    onclick={() => { editingModelId = null; toastStore.addToast({ type: 'success', message: 'Model updated', duration: 2000 }); }}
                  >
                    Done
                  </button>
                  <button
                    class="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style="background-color: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text);"
                    onclick={() => editingModelId = null}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            {:else}
              <div class="flex items-center gap-3">
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium" style="color: var(--color-text);">{model.name}</span>
                    <span class="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800" style="color: var(--color-text-secondary); font-family: monospace;">
                      {model.id}
                    </span>
                  </div>
                  <div class="text-xs mt-1 flex flex-wrap gap-x-3" style="color: var(--color-text-secondary);">
                    <span>Provider: {providers.find((p: ProviderConfig) => p.id === model.providerId)?.name || 'Unknown'}</span>
                    <span>Max Tokens: {model.settings?.maxTokens || 4096}</span>
                    <span>Temp: {model.settings?.temperature ?? 0.7}</span>
                  </div>
                </div>
                <div class="flex items-center gap-1">
                  <button
                    class="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900"
                    style="color: #22c55e;"
                    onclick={() => testModel(model)}
                    disabled={testingModelId === model.id}
                    title="Test model connection"
                  >
                    {#if testingModelId === model.id}
                      <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    {:else}
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    {/if}
                  </button>
                  <button
                    class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                    style="color: var(--color-text-secondary);"
                    onclick={() => editingModelId = model.id}
                    title="Edit model"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L15.657 7H18a2 2 0 012 2v4.172l-6.586-6.586z" />
                    </svg>
                  </button>
                  <button
                    class="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900"
                    style="color: #ef4444;"
                    onclick={() => removeModel(model.id)}
                    title="Delete model"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              {#if testResults.get(model.id)}
                {@const result = testResults.get(model.id)}
                <div class="mt-2 p-2 rounded text-xs" style="background-color: {result?.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; border: 1px solid {result?.success ? '#22c55e' : '#ef4444'}; color: {result?.success ? '#22c55e' : '#ef4444'};">
                  <div class="flex items-center gap-2">
                    {#if result?.success}
                      <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    {:else}
                      <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    {/if}
                    <span class="flex-1">{result?.message}</span>
                    {#if result?.latency}
                      <span class="opacity-70">({result.latency}ms)</span>
                    {/if}
                  </div>
                </div>
              {/if}
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
