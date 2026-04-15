import { writable } from 'svelte/store';
import { apiService } from '$services/apiService';
import { logger } from '$utils/logger';
import { DEFAULT_REST_PORT } from '$utils/constants';

interface RuntimeHealth {
  status: string;
  runtime: {
    available: boolean;
    session_count: number;
  };
}

interface RuntimeState {
  isHealthy: boolean;
  error: string | null;
  errorDetail: string | null;
  checked: boolean;
  lastCheck: string | null;
  serverUrl: string;
}

const defaultState: RuntimeState = {
  isHealthy: false,
  error: null,
  errorDetail: null,
  checked: false,
  lastCheck: null,
  serverUrl: `http://localhost:${DEFAULT_REST_PORT}`,
};

function createRuntimeStore() {
  const { subscribe, set, update } = writable<RuntimeState>(defaultState);

  return {
    subscribe,

    async checkHealth() {
      const serverUrl = apiService.getBaseUrl();
      logger.info('Runtime', 'Starting health check...', { serverUrl });

      update(state => ({
        ...state,
        serverUrl,
      }));

      try {
        const health = await apiService.checkHealth() as RuntimeHealth;
        const isHealthy = health?.runtime?.available === true;

        logger.info('Runtime', 'Health check result', { isHealthy, health });

        update(state => ({
          ...state,
          isHealthy,
          error: isHealthy ? null : 'Runtime not available',
          errorDetail: isHealthy ? null : `Server responded but runtime is not available. Response: ${JSON.stringify(health)}`,
          checked: true,
          lastCheck: new Date().toISOString(),
        }));

        return isHealthy;
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Failed to connect to CLI server';
        const errorDetail = e instanceof Error
          ? `${e.message}\n\nServer URL: ${serverUrl}\n\nPossible causes:\n1. CLI server is not running (run 'cargo run --bin claw-cli' in rust/ directory)\n2. Server is running on a different port\n3. Firewall blocking the connection\n4. CORS policy blocking the request`
          : 'Unknown error';

        logger.error('Runtime', 'Health check failed', { errorMessage, errorDetail });

        update(state => ({
          ...state,
          isHealthy: false,
          error: errorMessage,
          errorDetail,
          checked: true,
          lastCheck: new Date().toISOString(),
        }));

        return false;
      }
    },

    reset() {
      set(defaultState);
    },

    getServerUrl(): string {
      return apiService.getBaseUrl();
    },
  };
}

export const runtimeStore = createRuntimeStore();
