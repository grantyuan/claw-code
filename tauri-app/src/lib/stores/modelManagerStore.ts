import { writable, derived } from 'svelte/store';
import type { AIModelGlobalConfig, ModelConfig } from '$types/config';

interface ModelManagerState {
  activeModelId: string;
  isFallbackMode: boolean;
  failureCounts: Record<string, number>;
}

const initialState: ModelManagerState = {
  activeModelId: '',
  isFallbackMode: false,
  failureCounts: {},
};

function createModelManagerStore() {
  const { subscribe, set, update } = writable<ModelManagerState>(initialState);

  return {
    subscribe,

    initialize: (config: AIModelGlobalConfig) => {
      const defaultModel = config.models.find(m => m.isDefault);
      set({
        activeModelId: defaultModel?.id || config.models[0]?.id || '',
        isFallbackMode: false,
        failureCounts: {},
      });
    },

    setActiveModel: (modelId: string) => {
      update(state => ({ ...state, activeModelId: modelId }));
    },

    getActiveProfile: (config: AIModelGlobalConfig): ModelConfig | null => {
      let activeId = '';
      const unsub = subscribe(s => { activeId = s.activeModelId; });
      unsub();
      return config.models.find(m => m.id === activeId) || null;
    },

    getActiveModelId: (): string => {
      let id = '';
      const unsub = subscribe(s => { id = s.activeModelId; });
      unsub();
      return id;
    },

    isFallback: (): boolean => {
      let v = false;
      const unsub = subscribe(s => { v = s.isFallbackMode; });
      unsub();
      return v;
    },

    reportSuccess: (modelId: string) => {
      update(state => ({
        ...state,
        failureCounts: { ...state.failureCounts, [modelId]: 0 },
      }));
    },

    reportFailure: (modelId: string, _error: string, config: AIModelGlobalConfig): ModelConfig | null => {
      let fallback: ModelConfig | null = null;
      update(state => {
        const counts = { ...state.failureCounts };
        counts[modelId] = (counts[modelId] || 0) + 1;

        if (!config.tieredLM.enabled) {
          return { ...state, failureCounts: counts };
        }

        const threshold = 3;
        if (counts[modelId] >= threshold) {
          const next = getNextBestModel(modelId, config);
          if (next) {
            fallback = next;
            return {
              ...state,
              activeModelId: next.id,
              isFallbackMode: true,
              failureCounts: counts,
            };
          }
        }
        return { ...state, failureCounts: counts };
      });
      return fallback;
    },

    onNewConversation: (config: AIModelGlobalConfig) => {
      update(state => {
        if (state.isFallbackMode) {
          const defaultModel = config.models.find(m => m.isDefault);
          if (defaultModel) {
            return {
              ...state,
              activeModelId: defaultModel.id,
              isFallbackMode: false,
            };
          }
        }
        return state;
      });
    },

    getSortedEnabledModels: (config: AIModelGlobalConfig): ModelConfig[] => {
      return [...(config.models || [])]
        .filter(m => m.isDefault || config.defaultProviderId)
        .sort((a, b) => a.rank - b.rank);
    },

    resetAllFailures: () => {
      update(state => ({ ...state, failureCounts: {} }));
    },
  };
}

function getNextBestModel(currentModelId: string, config: AIModelGlobalConfig): ModelConfig | null {
  const models = (config.models || [])
    .filter(m => m.id !== currentModelId)
    .sort((a, b) => a.rank - b.rank);

  const current = config.models.find(m => m.id === currentModelId);
  if (!current) return models[0] || null;

  const lower = models.find(m => m.rank > current.rank);
  if (lower) return lower;

  return models[0] || null;
}

export const modelManagerStore = createModelManagerStore();
