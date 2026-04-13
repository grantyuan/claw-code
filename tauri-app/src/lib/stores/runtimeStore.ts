import { writable } from 'svelte/store';
import { apiService } from '$services/apiService';

interface RuntimeHealth {
  status: string;
  runtimeAvailable: boolean;
  sessionCount: number;
}

interface RuntimeState {
  isHealthy: boolean;
  error: string | null;
  checked: boolean;
}

const defaultState: RuntimeState = {
  isHealthy: false,
  error: null,
  checked: false,
};

function createRuntimeStore() {
  const { subscribe, set, update } = writable<RuntimeState>(defaultState);

  return {
    subscribe,

    async checkHealth() {
      try {
        const health = await apiService.checkHealth() as RuntimeHealth;
        const isHealthy = health?.runtimeAvailable === true;
        update(state => ({
          ...state,
          isHealthy,
          error: isHealthy ? null : 'Runtime not available',
          checked: true,
        }));
        return isHealthy;
      } catch (e) {
        update(state => ({
          ...state,
          isHealthy: false,
          error: e instanceof Error ? e.message : 'Failed to connect to CLI server',
          checked: true,
        }));
        return false;
      }
    },

    reset() {
      set(defaultState);
    },
  };
}

export const runtimeStore = createRuntimeStore();
