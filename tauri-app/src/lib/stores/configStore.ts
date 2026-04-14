import { writable, derived } from 'svelte/store';
import type { GlobalConfig } from '$types/config';

interface ConfigState {
  config: GlobalConfig | null;
  isDirty: boolean;
  isValid: boolean;
  errors: Map<string, string>;
  lastSaved: Date | null;
}

const defaultState: ConfigState = {
  config: null,
  isDirty: false,
  isValid: true,
  errors: new Map(),
  lastSaved: null,
};

function createConfigStore() {
  const { subscribe, set, update } = writable<ConfigState>(defaultState);

  return {
    subscribe,

    setConfig: (config: GlobalConfig) => {
      update(state => ({ ...state, config, isDirty: false }));
    },

    updateConfig: <K extends keyof GlobalConfig>(key: K, value: GlobalConfig[K]) => {
      update(state => {
        if (!state.config) return state;
        return {
          ...state,
          config: { ...state.config, [key]: value },
          isDirty: true,
        };
      });
    },

    setDirty: (isDirty: boolean) => {
      update(state => ({ ...state, isDirty }));
    },

    setValidation: (isValid: boolean, errors?: Map<string, string>) => {
      update(state => ({ ...state, isValid, errors: errors || new Map() }));
    },

    markSaved: () => {
      update(state => ({
        ...state,
        isDirty: false,
        lastSaved: new Date(),
      }));
    },

    reset: () => set(defaultState),

    loadFromStorage: () => {
      try {
        const saved = localStorage.getItem('clawcode-config');
        if (saved) {
          const config = JSON.parse(saved);
          update(state => ({ ...state, config, lastSaved: new Date() }));
        }
      } catch (error) {
        console.error('Failed to load config from storage:', error);
      }
    },

    saveToStorage: () => {
      let configToSave: GlobalConfig | null = null;
      update(state => {
        configToSave = state.config;
        if (state.config) {
          try {
            localStorage.setItem('clawcode-config', JSON.stringify(state.config));
            return { ...state, isDirty: false, lastSaved: new Date() };
          } catch (error) {
            console.error('Failed to save config to storage:', error);
          }
        }
        return state;
      });
      return configToSave;
    },
  };
}

export const configStore = createConfigStore();

export const hasUnsavedChanges = derived(configStore, $config => $config.isDirty);

export const configErrors = derived(configStore, $config =>
  Array.from($config.errors.entries())
);
