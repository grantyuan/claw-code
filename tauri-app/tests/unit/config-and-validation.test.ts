import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('configStore - applyConfig', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should apply config and persist to localStorage', async () => {
    const { configStore } = await import('../../src/lib/stores/configStore');
    const config = {
      aiModel: {
        provider: 'openai',
        endpoint: 'https://api.openai.com/v1',
        apiKey: 'sk-test-key-123',
        model: 'gpt-4',
        fallbackModels: [],
        temperature: 0.5,
        maxTokens: 8192,
        timeout: 60,
      },
      agents: { roles: [], collaborationPattern: 'parallel', conflictResolution: 'vote' },
      rag: { enabled: true, repositories: [], embeddingModel: 'text-embedding-3-small', topK: 10, similarityThreshold: 0.8 },
      mcp: { servers: [], tools: [] },
      memory: { maxContextWindow: 256000, summaryCompression: false, historyRetentionDays: 60, workingDirectory: '/tmp', fileWatching: false, autoDiscovery: false, additionalStores: [] },
      remote: { computers: [], deployment: { version: '0.2.0', installPath: '/usr/local/cc', autoStart: false, autoUpdate: true, healthCheckInterval: 60, rollbackOnFailure: false } },
      p2p: { enabled: true, discoveryMethod: 'dht', relayServers: ['wss://relay.example.com'], natTraversal: false, encryption: false, peerAuthentication: false },
      ui: { theme: 'light', fontSize: 16, fontFamily: 'jetbrains', panelLayout: { leftPanelWidth: 60, rightPanelWidth: 40, leftPanelCollapsed: true, rightPanelCollapsed: false }, notifications: { sound: false, desktop: false, inApp: true, level: 'errors' }, keyboardShortcuts: {}, language: 'zh' },
      project: { workingDirectory: '/home/user/project', gitIntegration: false, autoCommit: true, branchManagement: 'trunk-based', environmentVariables: { KEY1: 'val1', KEY2: 'val2' }, templates: [] },
    };

    configStore.applyConfig(config as any);

    const stored = localStorage.getItem('clawcode-config');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.aiModel.provider).toBe('openai');
    expect(parsed.aiModel.model).toBe('gpt-4');
    expect(parsed.ui.theme).toBe('light');
    expect(parsed.project.environmentVariables.KEY1).toBe('val1');
  });

  it('should load applied config from storage', async () => {
    const { configStore } = await import('../../src/lib/stores/configStore');
    const config = {
      aiModel: { provider: 'anthropic', endpoint: 'https://api.anthropic.com', model: 'claude-3-opus', fallbackModels: [], temperature: 0.7, maxTokens: 4096, timeout: 120 },
      agents: { roles: [], collaborationPattern: 'sequential', conflictResolution: 'leader-decides' },
      rag: { enabled: false, repositories: [], embeddingModel: 'text-embedding-3-small', topK: 5, similarityThreshold: 0.7 },
      mcp: { servers: [], tools: [] },
      memory: { maxContextWindow: 128000, summaryCompression: true, historyRetentionDays: 30, workingDirectory: '.', fileWatching: true, autoDiscovery: true, additionalStores: [] },
      remote: { computers: [], deployment: { version: '0.1.0', installPath: '/opt/clawcode', autoStart: true, autoUpdate: false, healthCheckInterval: 30, rollbackOnFailure: true } },
      p2p: { enabled: false, discoveryMethod: 'bootstrap', relayServers: [], natTraversal: true, encryption: true, peerAuthentication: true },
      ui: { theme: 'dark', fontSize: 14, fontFamily: 'inter', panelLayout: { leftPanelWidth: 50, rightPanelWidth: 50, leftPanelCollapsed: false, rightPanelCollapsed: false }, notifications: { sound: true, desktop: true, inApp: true, level: 'all' }, keyboardShortcuts: {}, language: 'en' },
      project: { workingDirectory: '.', gitIntegration: true, autoCommit: false, branchManagement: 'feature-branches', environmentVariables: {}, templates: [] },
    };

    configStore.applyConfig(config as any);

    const { configStore: freshStore } = await import('../../src/lib/stores/configStore');
    freshStore.loadFromStorage();

    let loadedConfig: any;
    freshStore.subscribe(state => { loadedConfig = state.config; })();
    expect(loadedConfig).not.toBeNull();
    expect(loadedConfig.aiModel.provider).toBe('anthropic');
  });
});

describe('validateConfigWarnings', () => {
  it('should warn about empty host in remote computers', async () => {
    const { validateConfigWarnings } = await import('../../src/lib/utils/validation');
    const warnings = validateConfigWarnings({
      remote: {
        computers: [{
          id: 'test',
          host: '',
          port: 22,
          name: 'Test',
          username: 'admin',
          authMethod: 'ssh-key',
          enabled: true,
          autoConnect: false,
          healthCheckInterval: 30,
        }],
        deployment: { version: '0.1.0', installPath: '/opt', autoStart: true, autoUpdate: false, healthCheckInterval: 30, rollbackOnFailure: true },
      },
    });
    expect(warnings.some(w => w.field.includes('host'))).toBe(true);
  });

  it('should warn about invalid relay server URL', async () => {
    const { validateConfigWarnings } = await import('../../src/lib/utils/validation');
    const warnings = validateConfigWarnings({
      p2p: {
        enabled: true,
        discoveryMethod: 'bootstrap',
        relayServers: ['not-a-valid-url'],
        natTraversal: true,
        encryption: true,
        peerAuthentication: true,
      },
    });
    expect(warnings.some(w => w.field.includes('relayServers'))).toBe(true);
  });

  it('should not warn for valid remote computers', async () => {
    const { validateConfigWarnings } = await import('../../src/lib/utils/validation');
    const warnings = validateConfigWarnings({
      remote: {
        computers: [{
          id: 'test',
          host: '192.168.1.100',
          port: 22,
          name: 'Test',
          username: 'admin',
          authMethod: 'ssh-key',
          enabled: true,
          autoConnect: false,
          healthCheckInterval: 30,
        }],
        deployment: { version: '0.1.0', installPath: '/opt', autoStart: true, autoUpdate: false, healthCheckInterval: 30, rollbackOnFailure: true },
      },
    });
    expect(warnings.length).toBe(0);
  });

  it('should not warn for valid relay server URLs', async () => {
    const { validateConfigWarnings } = await import('../../src/lib/utils/validation');
    const warnings = validateConfigWarnings({
      p2p: {
        enabled: true,
        discoveryMethod: 'bootstrap',
        relayServers: ['wss://relay.example.com'],
        natTraversal: true,
        encryption: true,
        peerAuthentication: true,
      },
    });
    expect(warnings.length).toBe(0);
  });
});

describe('CSS input class', () => {
  it('should have appearance auto for input elements', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const cssPath = path.join(process.cwd(), 'src/static/styles/global.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    expect(css).toContain('appearance: auto');
    expect(css).toContain('cursor: text');
    expect(css).toContain('cursor: pointer');
  });
});

describe('Rust serde camelCase alignment', () => {
  it('should have rename_all camelCase on all config structs', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const configPath = path.join(process.cwd(), 'src-tauri/src/models/config.rs');
    const content = fs.readFileSync(configPath, 'utf-8');
    const structCount = (content.match(/pub struct/g) || []).length;
    const camelCaseCount = (content.match(/rename_all = "camelCase"/g) || []).length;
    expect(camelCaseCount).toBe(structCount);
  });

  it('should have rename type on KnowledgeRepository repo_type', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const configPath = path.join(process.cwd(), 'src-tauri/src/models/config.rs');
    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toContain('#[serde(rename = "type")]');
  });
});
