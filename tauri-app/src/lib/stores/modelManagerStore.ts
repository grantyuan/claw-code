import { writable, derived } from 'svelte/store';
import type { Config, ModelProfile } from '$types/config';

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

    initialize: (config: Config) => {
      set({
        activeModelId: config.defaultModelId || '',
        isFallbackMode: false,
        failureCounts: {},
      });
    },

    setActiveModel: (modelId: string) => {
      update(state => ({ ...state, activeModelId: modelId }));
    },

    getActiveProfile: (config: Config): ModelProfile | null => {
      let activeId = '';
      const unsub = subscribe(s => { activeId = s.activeModelId; });
      unsub();
      return config.modelProfiles?.find(p => p.id === activeId && p.enabled) || null;
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

    reportFailure: (modelId: string, _error: string, config: Config): ModelProfile | null => {
      let fallback: ModelProfile | null = null;
      update(state => {
        const counts = { ...state.failureCounts };
        counts[modelId] = (counts[modelId] || 0) + 1;

        if (!config.fallbackConfig?.enabled) {
          return { ...state, failureCounts: counts };
        }

        const threshold = config.fallbackConfig.maxConsecutiveFailures || 3;
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

    onNewConversation: (config: Config) => {
      update(state => {
        if (config.fallbackConfig?.retryDefaultOnNewConversation && state.isFallbackMode) {
          return {
            ...state,
            activeModelId: config.defaultModelId,
            isFallbackMode: false,
          };
        }
        return state;
      });
    },

    getSortedEnabledProfiles: (config: Config): ModelProfile[] => {
      return [...(config.modelProfiles || [])]
        .filter(p => p.enabled)
        .sort((a, b) => a.capabilityRank - b.capabilityRank);
    },

    resetAllFailures: () => {
      update(state => ({ ...state, failureCounts: {} }));
    },
  };
}

function getNextBestModel(currentModelId: string, config: Config): ModelProfile | null {
  const profiles = (config.modelProfiles || [])
    .filter(p => p.enabled && p.id !== currentModelId)
    .sort((a, b) => a.capabilityRank - b.capabilityRank);

  const current = config.modelProfiles?.find(p => p.id === currentModelId);
  if (!current) return profiles[0] || null;

  // 优先选 rank 更高的（数字更大 = 能力更弱但可用）
  const higher = profiles.find(p => p.capabilityRank > current.capabilityRank);
  if (higher) return higher;

  // 没有更高 rank 的，选第一个可用的
  return profiles[0] || null;
}

export const modelManagerStore = createModelManagerStore();
