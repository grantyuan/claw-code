import { writable, derived } from 'svelte/store';
import type { ConnectionInfo, ConnectionStatus, ConnectionHealth } from '$types/connection';

interface ConnectionState {
  connections: Map<string, ConnectionInfo>;
  activeConnection: string | null;
  healthMetrics: Map<string, ConnectionHealth>;
  isConnecting: boolean;
  error: string | null;
}

const defaultState: ConnectionState = {
  connections: new Map(),
  activeConnection: null,
  healthMetrics: new Map(),
  isConnecting: false,
  error: null,
};

function createConnectionStore() {
  const { subscribe, set, update } = writable<ConnectionState>(defaultState);

  return {
    subscribe,

    addConnection: (connection: ConnectionInfo) => {
      update(state => {
        const connections = new Map(state.connections);
        connections.set(connection.id, connection);
        return { ...state, connections };
      });
    },

    removeConnection: (id: string) => {
      update(state => {
        const connections = new Map(state.connections);
        connections.delete(id);
        const healthMetrics = new Map(state.healthMetrics);
        healthMetrics.delete(id);
        return { 
          ...state, 
          connections,
          healthMetrics,
          activeConnection: state.activeConnection === id ? null : state.activeConnection,
        };
      });
    },

    updateConnectionStatus: (id: string, status: ConnectionStatus, error?: string) => {
      update(state => {
        const connections = new Map(state.connections);
        const connection = connections.get(id);
        if (connection) {
          connections.set(id, {
            ...connection,
            status,
            error,
            lastConnected: status === 'connected' ? new Date() : connection.lastConnected,
          });
        }
        return { ...state, connections };
      });
    },

    setActiveConnection: (id: string | null) => {
      update(state => ({ ...state, activeConnection: id }));
    },

    updateHealth: (id: string, health: ConnectionHealth) => {
      update(state => {
        const healthMetrics = new Map(state.healthMetrics);
        healthMetrics.set(id, health);
        return { ...state, healthMetrics };
      });
    },

    setConnecting: (isConnecting: boolean) => {
      update(state => ({ ...state, isConnecting }));
    },

    setError: (error: string | null) => {
      update(state => ({ ...state, error }));
    },

    reset: () => set(defaultState),
  };
}

export const connectionStore = createConnectionStore();

export const activeConnection = derived(connectionStore, $conn => {
  if (!$conn.activeConnection) return null;
  return $conn.connections.get($conn.activeConnection) || null;
});

export const connectionList = derived(connectionStore, $conn => 
  Array.from($conn.connections.values())
);

export const connectedCount = derived(connectionStore, $conn =>
  Array.from($conn.connections.values()).filter(c => c.status === 'connected').length
);
