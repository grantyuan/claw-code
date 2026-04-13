import { writable, derived } from 'svelte/store';
import type { Session, RuntimeError, HealthStatus } from '$types/session';

interface SessionState {
  sessions: Session[];
  activeSessionId: string | null;
  isLoading: boolean;
  error: RuntimeError | null;
  health: HealthStatus | null;
}

const defaultState: SessionState = {
  sessions: [],
  activeSessionId: null,
  isLoading: false,
  error: null,
  health: null,
};

function createSessionStore() {
  const { subscribe, set, update } = writable<SessionState>(defaultState);

  return {
    subscribe,

    setLoading: (loading: boolean) => {
      update(state => ({ ...state, isLoading: loading }));
    },

    setError: (error: RuntimeError | null) => {
      update(state => ({ ...state, error }));
    },

    setHealth: (health: HealthStatus | null) => {
      update(state => ({ ...state, health }));
    },

    setSessions: (sessions: Session[]) => {
      update(state => ({ ...state, sessions }));
    },

    addSession: (session: Session) => {
      update(state => ({
        ...state,
        sessions: [...state.sessions, session],
        activeSessionId: session.id,
      }));
    },

    removeSession: (sessionId: string) => {
      update(state => {
        const sessions = state.sessions.filter(s => s.id !== sessionId);
        return {
          ...state,
          sessions,
          activeSessionId: state.activeSessionId === sessionId
            ? (sessions[0]?.id || null)
            : state.activeSessionId,
        };
      });
    },

    setActiveSession: (sessionId: string | null) => {
      update(state => ({ ...state, activeSessionId: sessionId }));
    },

    updateSession: (sessionId: string, updates: Partial<Session>) => {
      update(state => ({
        ...state,
        sessions: state.sessions.map(s =>
          s.id === sessionId ? { ...s, ...updates } : s
        ),
      }));
    },

    reset: () => set(defaultState),
  };
}

export const sessionStore = createSessionStore();

export const activeSession = derived(sessionStore, $session => {
  if (!$session.activeSessionId) return null;
  return $session.sessions.find(s => s.id === $session.activeSessionId) || null;
});

export const sessionCount = derived(sessionStore, $session => $session.sessions.length);
