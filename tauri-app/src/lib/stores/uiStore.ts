import { writable, derived } from 'svelte/store';
import type { PanelLayout } from '$types/config';

interface UIState {
  theme: 'dark' | 'light' | 'system';
  actualTheme: 'dark' | 'light';
  panelLayout: PanelLayout;
  activeView: 'default' | 'agent-detail';
  selectedAgentId: string | null;
  modal: {
    isOpen: boolean;
    type: string | null;
    data: unknown;
  };
  sidebarCollapsed: boolean;
  settingsOpen: boolean;
}

const defaultPanelLayout: PanelLayout = {
  leftPanelWidth: 50,
  rightPanelWidth: 50,
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
};

const defaultState: UIState = {
  theme: 'system',
  actualTheme: 'dark',
  panelLayout: defaultPanelLayout,
  activeView: 'default',
  selectedAgentId: null,
  modal: {
    isOpen: false,
    type: null,
    data: null,
  },
  sidebarCollapsed: false,
  settingsOpen: false,
};

function createUIStore() {
  const { subscribe, set, update } = writable<UIState>(defaultState);

  return {
    subscribe,
    
    setTheme: (theme: 'dark' | 'light' | 'system') => {
      update(state => {
        const actualTheme = theme === 'system'
          ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : theme;
        
        if (typeof window !== 'undefined') {
          document.documentElement.classList.toggle('dark', actualTheme === 'dark');
          localStorage.setItem('clawcode-theme', theme);
        }
        
        return { ...state, theme, actualTheme };
      });
    },

    toggleSidebar: () => {
      update(state => ({ ...state, sidebarCollapsed: !state.sidebarCollapsed }));
    },

    toggleSettings: () => {
      update(state => ({ ...state, settingsOpen: !state.settingsOpen }));
    },

    setPanelLayout: (layout: Partial<PanelLayout>) => {
      update(state => ({
        ...state,
        panelLayout: { ...state.panelLayout, ...layout },
      }));
    },

    setActiveView: (view: 'default' | 'agent-detail', agentId?: string) => {
      update(state => ({
        ...state,
        activeView: view,
        selectedAgentId: agentId || null,
      }));
    },

    openModal: (type: string, data?: unknown) => {
      update(state => ({
        ...state,
        modal: { isOpen: true, type, data },
      }));
    },

    closeModal: () => {
      update(state => ({
        ...state,
        modal: { isOpen: false, type: null, data: null },
      }));
    },

    reset: () => set(defaultState),

    loadFromStorage: () => {
      if (typeof window !== 'undefined') {
        const savedTheme = localStorage.getItem('clawcode-theme') as 'dark' | 'light' | 'system' | null;
        if (savedTheme) {
          const actualTheme = savedTheme === 'system'
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : savedTheme;
          document.documentElement.classList.toggle('dark', actualTheme === 'dark');
          update(state => ({ ...state, theme: savedTheme, actualTheme }));
        } else {
          document.documentElement.classList.add('dark');
        }
      }
    },
  };
}

export const uiStore = createUIStore();

export const isDarkMode = derived(uiStore, $ui => $ui.actualTheme === 'dark');
