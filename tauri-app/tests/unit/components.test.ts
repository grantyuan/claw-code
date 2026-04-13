import { describe, it, expect } from 'vitest';

describe('Button Component Structure', () => {
  it('should have Button component file', async () => {
    const mod = await import('../../src/lib/components/common/Button.svelte');
    expect(mod.default).toBeDefined();
  });

  it('should have Modal component file', async () => {
    const mod = await import('../../src/lib/components/common/Modal.svelte');
    expect(mod.default).toBeDefined();
  });

  it('should have ProgressBar component file', async () => {
    const mod = await import('../../src/lib/components/common/ProgressBar.svelte');
    expect(mod.default).toBeDefined();
  });

  it('should have StatusBadge component file', async () => {
    const mod = await import('../../src/lib/components/common/StatusBadge.svelte');
    expect(mod.default).toBeDefined();
  });

  it('should have Toast component file', async () => {
    const mod = await import('../../src/lib/components/common/Toast.svelte');
    expect(mod.default).toBeDefined();
  });

  it('should have LeftPanel component file', async () => {
    const mod = await import('../../src/lib/components/panels/LeftPanel.svelte');
    expect(mod.default).toBeDefined();
  });

  it('should have RightPanel component file', async () => {
    const mod = await import('../../src/lib/components/panels/RightPanel.svelte');
    expect(mod.default).toBeDefined();
  });

  it('should have SettingsPanel component file', async () => {
    const mod = await import('../../src/lib/components/settings/SettingsPanel.svelte');
    expect(mod.default).toBeDefined();
  });

  it('should have App component file', async () => {
    const mod = await import('../../src/App.svelte');
    expect(mod.default).toBeDefined();
  });
});

describe('Component Imports Consistency', () => {
  it('should export all stores from index', async () => {
    const mod = await import('../../src/lib/stores/index');
    expect(mod.uiStore).toBeDefined();
    expect(mod.connectionStore).toBeDefined();
    expect(mod.chatStore).toBeDefined();
    expect(mod.agentStore).toBeDefined();
    expect(mod.taskStore).toBeDefined();
    expect(mod.configStore).toBeDefined();
    expect(mod.toastStore).toBeDefined();
  });

  it('should export all services from index', async () => {
    const mod = await import('../../src/lib/services/index');
    expect(mod.apiService).toBeDefined();
    expect(mod.webSocketService).toBeDefined();
  });

  it('should export all types from index', async () => {
    const mod = await import('../../src/lib/types/index');
    expect(mod.AgentStatus).toBeDefined();
    expect(mod.TaskStatus).toBeDefined();
    expect(mod.ConnectionStatus).toBeDefined();
    expect(mod.MessageType).toBeDefined();
  });

  it('should export all utils from index', async () => {
    const mod = await import('../../src/lib/utils/index');
    expect(mod.validateUrl).toBeDefined();
    expect(mod.validateConfig).toBeDefined();
    expect(mod.formatTimestamp).toBeDefined();
    expect(mod.APP_NAME).toBeDefined();
    expect(mod.APP_VERSION).toBeDefined();
  });
});
