<script lang="ts">
  import { configService } from '$services/configService';
  import type { ModelConfig, TieredLMConfig } from '$types/config';
  import Button from '$components/common/Button.svelte';

  let tieredLM = $state<TieredLMConfig>({
    enabled: false,
    auxiliaryModelId: null,
    fallbackChain: [],
    complexityThreshold: 0.5,
  });

  let models = $state<ModelConfig[]>([]);
  let hasUnsavedChanges = $state(false);

  $effect(() => {
    loadConfig();
  });

  async function loadConfig() {
    const config = await configService.loadGlobalConfig();
    tieredLM = config.aiModel.tieredLM;
    models = config.aiModel.models;
  }

  async function handleSave() {
    const config = await configService.loadGlobalConfig();
    config.aiModel.tieredLM = tieredLM;
    await configService.saveGlobalConfig(config);
    hasUnsavedChanges = false;
  }

  function toggleEnabled() {
    tieredLM.enabled = !tieredLM.enabled;
    hasUnsavedChanges = true;
  }

  function setAuxiliaryModel(modelId: string | null) {
    tieredLM.auxiliaryModelId = modelId;
    hasUnsavedChanges = true;
  }

  function setComplexityThreshold(value: number) {
    tieredLM.complexityThreshold = value;
    hasUnsavedChanges = true;
  }

  function addToFallbackChain(modelId: string) {
    if (!tieredLM.fallbackChain.includes(modelId)) {
      tieredLM.fallbackChain = [...tieredLM.fallbackChain, modelId];
      hasUnsavedChanges = true;
    }
  }

  function removeFromFallbackChain(modelId: string) {
    tieredLM.fallbackChain = tieredLM.fallbackChain.filter(id => id !== modelId);
    hasUnsavedChanges = true;
  }

  function moveFallbackUp(index: number) {
    if (index <= 0) return;
    const newChain = [...tieredLM.fallbackChain];
    [newChain[index - 1], newChain[index]] = [newChain[index], newChain[index - 1]];
    tieredLM.fallbackChain = newChain;
    hasUnsavedChanges = true;
  }

  function moveFallbackDown(index: number) {
    if (index >= tieredLM.fallbackChain.length - 1) return;
    const newChain = [...tieredLM.fallbackChain];
    [newChain[index], newChain[index + 1]] = [newChain[index + 1], newChain[index]];
    tieredLM.fallbackChain = newChain;
    hasUnsavedChanges = true;
  }

  function getModelName(modelId: string): string {
    return models.find(m => m.id === modelId)?.displayName || 'Unknown';
  }

  function getProviderName(modelId: string): string {
    const providerId = models.find(m => m.id === modelId)?.providerId;
    if (!providerId) return '';
    return models.find(m => m.id === modelId)?.providerId || '';
  }

  $effect(() => {
    const auxModel = models.find(m => m.id === tieredLM.auxiliaryModelId);
    if (auxModel) {
      setAuxiliaryModel(tieredLM.auxiliaryModelId);
    }
  });
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h3 class="text-lg font-medium" style="color: var(--color-text);">Tiered-LM Settings</h3>
    <div class="flex items-center gap-3">
      <span class="text-sm" style="color: var(--color-text-secondary);">
        {tieredLM.enabled ? 'Enabled' : 'Disabled'}
      </span>
      <button
        class="relative w-12 h-6 rounded-full transition-colors {tieredLM.enabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}"
        onclick={toggleEnabled}
        role="switch"
        aria-checked={tieredLM.enabled}
      >
        <span
          class="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform {tieredLM.enabled ? 'left-7' : 'left-1'}"
        ></span>
      </button>
    </div>
  </div>

  <p class="text-sm" style="color: var(--color-text-secondary);">
    Tiered-LM automatically selects appropriate models based on task complexity.
    Simple tasks use faster, cheaper models while complex tasks escalate to more capable models.
  </p>

  {#if tieredLM.enabled}
    <div class="space-y-6">
      <div class="p-4 rounded-lg border" style="border-color: var(--color-border); background: var(--color-bg);">
        <h4 class="text-md font-medium mb-3" style="color: var(--color-text);">Auxiliary Model</h4>
        <p class="text-xs mb-3" style="color: var(--color-text-secondary);">
          Select a weaker model (e.g., local Ollama) to handle simple tasks like summarization, rephrasing, and routine coding.
        </p>

        <select
          class="input w-full"
          value={tieredLM.auxiliaryModelId || ''}
          onchange={(e) => setAuxiliaryModel((e.target as HTMLSelectElement).value || null)}
        >
          <option value="">Select auxiliary model...</option>
          {#each models as model (model.id)}
            <option value={model.id}>
              {model.displayName} ({model.providerId})
            </option>
          {/each}
        </select>

        {#if tieredLM.auxiliaryModelId}
          <div class="mt-2 text-xs" style="color: var(--color-text-secondary);">
            <span class="font-medium">Selected:</span> {getModelName(tieredLM.auxiliaryModelId)}
          </div>
        {/if}
      </div>

      <div class="p-4 rounded-lg border" style="border-color: var(--color-border); background: var(--color-bg);">
        <h4 class="text-md font-medium mb-3" style="color: var(--color-text);">Fallback Chain</h4>
        <p class="text-xs mb-3" style="color: var(--color-text-secondary);">
          When the primary model fails or is unavailable, the system will try models in this order.
        </p>

        <div class="mb-3">
          <select
            class="input w-full"
            onchange={(e) => {
              const value = (e.target as HTMLSelectElement).value;
              if (value) addToFallbackChain(value);
              (e.target as HTMLSelectElement).value = '';
            }}
          >
            <option value="">Add model to fallback chain...</option>
            {#each models as model (model.id)}
              {#if !tieredLM.fallbackChain.includes(model.id)}
                <option value={model.id}>
                  {model.displayName} (Rank #{model.rank})
                </option>
              {/if}
            {/each}
          </select>
        </div>

        <div class="space-y-2">
          {#each tieredLM.fallbackChain as modelId, index (modelId)}
            <div class="flex items-center justify-between p-2 rounded" style="background: var(--color-surface);">
              <div class="flex items-center gap-3">
                <span class="text-xs px-2 py-0.5 rounded" style="background: var(--color-primary-100, #dbeafe); color: var(--color-primary-700, #1d4ed8);">
                  #{index + 1}
                </span>
                <span style="color: var(--color-text);">{getModelName(modelId)}</span>
              </div>
              <div class="flex items-center gap-1">
                <button
                  class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                  onclick={() => moveFallbackUp(index)}
                  disabled={index === 0}
                  title="Move up"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                  onclick={() => moveFallbackDown(index)}
                  disabled={index === tieredLM.fallbackChain.length - 1}
                  title="Move down"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button
                  class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                  onclick={() => removeFromFallbackChain(modelId)}
                  title="Remove"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          {/each}

          {#if tieredLM.fallbackChain.length === 0}
            <p class="text-sm text-center py-2" style="color: var(--color-text-secondary);">
              No fallback models configured. Add models above.
            </p>
          {/if}
        </div>
      </div>

      <div class="p-4 rounded-lg border" style="border-color: var(--color-border); background: var(--color-bg);">
        <h4 class="text-md font-medium mb-3" style="color: var(--color-text);">Complexity Threshold</h4>
        <p class="text-xs mb-3" style="color: var(--color-text-secondary);">
          Tasks with complexity above this threshold will use the primary model instead of auxiliary.
        </p>

        <div class="space-y-2">
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={tieredLM.complexityThreshold}
            oninput={(e) => setComplexityThreshold(parseFloat((e.target as HTMLInputElement).value))}
            class="w-full"
          />
          <div class="flex justify-between text-xs" style="color: var(--color-text-secondary);">
            <span>Low (Simple)</span>
            <span class="font-medium" style="color: var(--color-text);">{tieredLM.complexityThreshold.toFixed(1)}</span>
            <span>High (Complex)</span>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if hasUnsavedChanges}
    <div class="flex justify-end pt-4 border-t" style="border-color: var(--color-border);">
      <Button variant="primary" onclick={handleSave}>
        Save Tiered-LM Settings
      </Button>
    </div>
  {/if}
</div>
