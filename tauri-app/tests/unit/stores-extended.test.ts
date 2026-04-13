import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ToastStore', () => {
  beforeEach(async () => {
    vi.resetModules();
  });

  it('should create toast store with empty toasts', async () => {
    const { toastStore } = await import('../../src/lib/stores/toastStore');
    const { get } = await import('svelte/store');
    const state = get(toastStore);
    expect(state.toasts).toEqual([]);
  });

  it('should show a toast message', async () => {
    const { toastStore } = await import('../../src/lib/stores/toastStore');
    const { get } = await import('svelte/store');
    toastStore.show('Test message', 'info', 0);
    const state = get(toastStore);
    expect(state.toasts.length).toBe(1);
    expect(state.toasts[0].message).toBe('Test message');
    expect(state.toasts[0].type).toBe('info');
  });

  it('should show success toast', async () => {
    const { toastStore } = await import('../../src/lib/stores/toastStore');
    const { get } = await import('svelte/store');
    toastStore.success('Success!', 0);
    const state = get(toastStore);
    expect(state.toasts.some(t => t.type === 'success' && t.message === 'Success!')).toBe(true);
  });

  it('should show error toast', async () => {
    const { toastStore } = await import('../../src/lib/stores/toastStore');
    const { get } = await import('svelte/store');
    toastStore.error('Error!', 0);
    const state = get(toastStore);
    expect(state.toasts.some(t => t.type === 'error' && t.message === 'Error!')).toBe(true);
  });

  it('should dismiss a toast by id', async () => {
    const { toastStore } = await import('../../src/lib/stores/toastStore');
    const { get } = await import('svelte/store');
    const id = toastStore.show('To dismiss', 'info', 0);
    expect(get(toastStore).toasts.length).toBe(1);
    toastStore.dismiss(id);
    expect(get(toastStore).toasts.length).toBe(0);
  });

  it('should auto-dismiss toast after duration', async () => {
    vi.useFakeTimers();
    const { toastStore } = await import('../../src/lib/stores/toastStore');
    const { get } = await import('svelte/store');
    toastStore.show('Auto dismiss', 'info', 100);
    expect(get(toastStore).toasts.length).toBe(1);
    vi.advanceTimersByTime(150);
    expect(get(toastStore).toasts.length).toBe(0);
    vi.useRealTimers();
  });
});

describe('UIStore Operations', () => {
  it('should set theme', async () => {
    const { uiStore } = await import('../../src/lib/stores/uiStore');
    const { get } = await import('svelte/store');
    uiStore.setTheme('light');
    expect(get(uiStore).theme).toBe('light');
  });

  it('should toggle sidebar', async () => {
    const { uiStore } = await import('../../src/lib/stores/uiStore');
    const { get } = await import('svelte/store');
    const before = get(uiStore).sidebarCollapsed;
    uiStore.toggleSidebar();
    expect(get(uiStore).sidebarCollapsed).toBe(!before);
  });

  it('should toggle settings', async () => {
    const { uiStore } = await import('../../src/lib/stores/uiStore');
    const { get } = await import('svelte/store');
    const before = get(uiStore).settingsOpen;
    uiStore.toggleSettings();
    expect(get(uiStore).settingsOpen).toBe(!before);
  });

  it('should set panel layout', async () => {
    const { uiStore } = await import('../../src/lib/stores/uiStore');
    const { get } = await import('svelte/store');
    uiStore.setPanelLayout({ leftPanelWidth: 60, rightPanelWidth: 40 });
    const state = get(uiStore);
    expect(state.panelLayout.leftPanelWidth).toBe(60);
    expect(state.panelLayout.rightPanelWidth).toBe(40);
  });
});

describe('ConnectionStore Operations', () => {
  it('should add a connection', async () => {
    const { connectionStore } = await import('../../src/lib/stores/connectionStore');
    const { get } = await import('svelte/store');
    const { ConnectionStatus } = await import('../../src/lib/types/connection');
    connectionStore.addConnection({
      id: 'test-conn',
      name: 'Test Connection',
      type: 'remote',
      status: ConnectionStatus.Disconnected,
      endpoint: 'ws://localhost:8765',
    });
    const state = get(connectionStore);
    expect(state.connections.size).toBeGreaterThan(0);
    expect(state.connections.has('test-conn')).toBe(true);
  });

  it('should update connection status', async () => {
    const { connectionStore } = await import('../../src/lib/stores/connectionStore');
    const { get } = await import('svelte/store');
    const { ConnectionStatus } = await import('../../src/lib/types/connection');
    connectionStore.addConnection({
      id: 'status-test',
      name: 'Status Test',
      type: 'remote',
      status: ConnectionStatus.Disconnected,
      endpoint: 'ws://localhost:8765',
    });
    connectionStore.updateConnectionStatus('status-test', ConnectionStatus.Connected);
    const state = get(connectionStore);
    const conn = state.connections.get('status-test');
    expect(conn?.status).toBe(ConnectionStatus.Connected);
  });

  it('should set active connection', async () => {
    const { connectionStore } = await import('../../src/lib/stores/connectionStore');
    const { get } = await import('svelte/store');
    const { ConnectionStatus } = await import('../../src/lib/types/connection');
    connectionStore.addConnection({
      id: 'active-test',
      name: 'Active Test',
      type: 'remote',
      status: ConnectionStatus.Connected,
      endpoint: 'ws://localhost:8765',
    });
    connectionStore.setActiveConnection('active-test');
    expect(get(connectionStore).activeConnection).toBe('active-test');
  });
});

describe('ConfigStore Operations', () => {
  it('should set dirty state', async () => {
    const { configStore } = await import('../../src/lib/stores/configStore');
    const { get } = await import('svelte/store');
    configStore.setDirty(true);
    expect(get(configStore).isDirty).toBe(true);
    configStore.setDirty(false);
    expect(get(configStore).isDirty).toBe(false);
  });

  it('should set validation state', async () => {
    const { configStore } = await import('../../src/lib/stores/configStore');
    const { get } = await import('svelte/store');
    configStore.setValidation(true);
    expect(get(configStore).isValid).toBe(true);
    configStore.setValidation(false, new Map([['field', 'error']]));
    expect(get(configStore).isValid).toBe(false);
    expect(get(configStore).errors.size).toBeGreaterThan(0);
  });

  it('should mark as saved', async () => {
    const { configStore } = await import('../../src/lib/stores/configStore');
    const { get } = await import('svelte/store');
    configStore.setDirty(true);
    configStore.markSaved();
    expect(get(configStore).isDirty).toBe(false);
  });
});

describe('ValidateConfig', () => {
  it('should validate AI model config', async () => {
    const { validateConfig } = await import('../../src/lib/utils/validation');
    const errors = validateConfig({
      aiModel: {
        provider: 'anthropic',
        endpoint: 'not-a-url',
        model: 'test',
        temperature: 5,
        maxTokens: 0,
        timeout: 0,
      },
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.field === 'aiModel.endpoint')).toBe(true);
    expect(errors.some(e => e.field === 'aiModel.temperature')).toBe(true);
    expect(errors.some(e => e.field === 'aiModel.maxTokens')).toBe(true);
    expect(errors.some(e => e.field === 'aiModel.timeout')).toBe(true);
  });

  it('should pass valid config', async () => {
    const { validateConfig } = await import('../../src/lib/utils/validation');
    const errors = validateConfig({
      aiModel: {
        provider: 'anthropic',
        endpoint: 'https://api.anthropic.com',
        model: 'claude-3-opus',
        temperature: 0.7,
        maxTokens: 4096,
        timeout: 120,
      },
    });
    expect(errors.length).toBe(0);
  });

  it('should validate RAG config', async () => {
    const { validateConfig } = await import('../../src/lib/utils/validation');
    const errors = validateConfig({
      rag: {
        enabled: true,
        repositories: [],
        embeddingModel: 'test',
        topK: 0,
        similarityThreshold: 1.5,
      },
    });
    expect(errors.some(e => e.field === 'rag.topK')).toBe(true);
    expect(errors.some(e => e.field === 'rag.similarityThreshold')).toBe(true);
  });
});
