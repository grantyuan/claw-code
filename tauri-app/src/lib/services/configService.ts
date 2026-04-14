import type {
  GlobalConfig,
  ProjectConfig,
  EffectiveConfig,
  ConfigBackup,
  ProviderConfig,
  ModelConfig,
} from '$types/config';

const CONFIG_VERSION = '2.0.0';
const GLOBAL_CONFIG_PATH = '~/.config/clawcode/config.json';
const BACKUP_DIR = '~/.config/clawcode/backups';

function getDefaultGlobalConfig(): GlobalConfig {
  const defaultProviders: ProviderConfig[] = [
    {
      id: 'anthropic-default',
      name: 'Anthropic',
      type: 'anthropic',
      endpoint: 'https://api.anthropic.com',
      apiKey: '',
      isDefault: true,
    },
    {
      id: 'openai-default',
      name: 'OpenAI',
      type: 'openai',
      endpoint: 'https://api.openai.com/v1',
      apiKey: '',
      isDefault: false,
    },
    {
      id: 'ollama-default',
      name: 'Ollama',
      type: 'ollama',
      endpoint: 'http://localhost:11434/v1',
      apiKey: '',
      isDefault: false,
    },
  ];

  const defaultModels: ModelConfig[] = [
    {
      id: 'claude-opus-4-5',
      providerId: 'anthropic-default',
      name: 'claude-opus-4-5',
      displayName: 'Claude Opus 4',
      rank: 1,
      capabilities: { vision: true, functionCalling: true, streaming: true, maxTokens: 4096, contextWindow: 200000 },
      isDefault: true,
      settings: { temperature: 0.7, maxTokens: 4096, timeout: 120 },
    },
    {
      id: 'claude-sonnet-4-5',
      providerId: 'anthropic-default',
      name: 'claude-sonnet-4-5',
      displayName: 'Claude Sonnet 4',
      rank: 2,
      capabilities: { vision: true, functionCalling: true, streaming: true, maxTokens: 4096, contextWindow: 200000 },
      isDefault: false,
      settings: { temperature: 0.7, maxTokens: 4096, timeout: 120 },
    },
    {
      id: 'gpt-4o',
      providerId: 'openai-default',
      name: 'gpt-4o',
      displayName: 'GPT-4o',
      rank: 3,
      capabilities: { vision: true, functionCalling: true, streaming: true, maxTokens: 4096, contextWindow: 128000 },
      isDefault: false,
      settings: { temperature: 0.7, maxTokens: 4096, timeout: 120 },
    },
  ];

  return {
    version: CONFIG_VERSION,
    lastModified: new Date().toISOString(),
    aiModel: {
      providers: defaultProviders,
      defaultProviderId: 'anthropic-default',
      models: defaultModels,
      tieredLM: {
        enabled: false,
        auxiliaryModelId: null,
        fallbackChain: [],
        complexityThreshold: 0.5,
      },
    },
    agents: {
      roles: [],
      collaborationPattern: 'sequential',
      conflictResolution: 'leader-decides',
    },
    rag: {
      enabled: false,
      repositories: [],
      embeddingModel: 'text-embedding-3-small',
      topK: 5,
      similarityThreshold: 0.7,
    },
    mcp: {
      servers: [],
      tools: [],
    },
    memory: {
      maxContextWindow: 200000,
      summaryCompression: true,
      historyRetentionDays: 30,
      workingDirectory: '',
      fileWatching: true,
      autoDiscovery: true,
      additionalStores: [],
    },
    remote: {
      computers: [],
      deployment: {
        version: '1.0.0',
        installPath: '/opt/clawcode',
        autoStart: false,
        autoUpdate: false,
        healthCheckInterval: 60,
        rollbackOnFailure: true,
      },
    },
    p2p: {
      enabled: false,
      discoveryMethod: 'bootstrap',
      relayServers: [],
      natTraversal: true,
      encryption: true,
      peerAuthentication: true,
    },
    ui: {
      theme: 'dark',
      fontSize: 14,
      fontFamily: 'inter',
      panelLayout: {
        leftPanelWidth: 25,
        rightPanelWidth: 75,
        leftPanelCollapsed: false,
        rightPanelCollapsed: false,
      },
      notifications: {
        sound: true,
        desktop: true,
        inApp: true,
        level: 'all',
      },
      keyboardShortcuts: {},
      language: 'en',
    },
  };
}

class ConfigService {
  private globalConfig: GlobalConfig | null = null;
  private projectConfigs: Map<string, ProjectConfig> = new Map();

  async loadGlobalConfig(): Promise<GlobalConfig> {
    if (this.globalConfig) {
      return this.globalConfig;
    }

    try {
      const response = await fetch(`/api/config/global`);
      if (response.ok) {
        this.globalConfig = await response.json();
      } else {
        this.globalConfig = getDefaultGlobalConfig();
      }
    } catch {
      this.globalConfig = getDefaultGlobalConfig();
    }

    return this.globalConfig!;
  }

  async saveGlobalConfig(config: GlobalConfig): Promise<void> {
    config.lastModified = new Date().toISOString();
    config.version = CONFIG_VERSION;

    await fetch('/api/config/global', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    this.globalConfig = config;
  }

  async resetGlobalConfig(): Promise<GlobalConfig> {
    const defaultConfig = getDefaultGlobalConfig();
    await this.saveGlobalConfig(defaultConfig);
    return defaultConfig;
  }

  async backupGlobalConfig(): Promise<ConfigBackup> {
    const response = await fetch('/api/config/backup', {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to create backup');
    }

    return response.json();
  }

  async listBackups(): Promise<ConfigBackup[]> {
    const response = await fetch('/api/config/backups');
    if (!response.ok) {
      return [];
    }
    return response.json();
  }

  async restoreBackup(backupId: string): Promise<GlobalConfig> {
    const response = await fetch(`/api/config/backups/${backupId}/restore`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to restore backup');
    }

    const config = await response.json();
    this.globalConfig = config;
    return config;
  }

  async loadProjectConfig(projectPath: string): Promise<ProjectConfig | null> {
    if (this.projectConfigs.has(projectPath)) {
      return this.projectConfigs.get(projectPath)!;
    }

    try {
      const response = await fetch(`/api/config/project?path=${encodeURIComponent(projectPath)}`);
      if (response.ok) {
        const config = await response.json();
        this.projectConfigs.set(projectPath, config);
        return config;
      }
    } catch {
      // Project config doesn't exist yet
    }

    return null;
  }

  async saveProjectConfig(projectPath: string, config: ProjectConfig): Promise<void> {
    config.version = CONFIG_VERSION;

    await fetch('/api/config/project', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: projectPath, config }),
    });

    this.projectConfigs.set(projectPath, config);
  }

  async createProjectConfig(projectPath: string, inheritGlobal: boolean): Promise<ProjectConfig> {
    const config: ProjectConfig = {
      version: CONFIG_VERSION,
      projectId: crypto.randomUUID(),
      projectPath,
      inheritGlobal,
      overrides: inheritGlobal ? null : {},
      project: {
        workingDirectory: projectPath,
        rules: {
          enabled: false,
          instructions: '',
          additionalRules: [],
        },
        exclusions: {
          directories: ['node_modules', '.git', 'dist', 'build', 'target', '__pycache__'],
          files: ['*.log', '*.tmp', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'],
          patterns: ['**/cache/**', '**/tmp/**', '**/.DS_Store'],
        },
      },
    };

    await this.saveProjectConfig(projectPath, config);
    return config;
  }

  async deleteProjectConfig(projectPath: string): Promise<void> {
    await fetch(`/api/config/project?path=${encodeURIComponent(projectPath)}`, {
      method: 'DELETE',
    });

    this.projectConfigs.delete(projectPath);
  }

  async getEffectiveConfig(projectPath: string | null): Promise<EffectiveConfig> {
    const globalConfig = await this.loadGlobalConfig();

    if (!projectPath) {
      return {
        global: globalConfig,
        project: null,
        merged: {
          providers: globalConfig.aiModel.providers,
          models: globalConfig.aiModel.models,
          tieredLM: globalConfig.aiModel.tieredLM,
          agents: globalConfig.agents,
          rag: globalConfig.rag,
          mcp: globalConfig.mcp,
          memory: globalConfig.memory,
          remote: globalConfig.remote,
          p2p: globalConfig.p2p,
          ui: globalConfig.ui,
          rules: {
            enabled: false,
            instructions: '',
            additionalRules: [],
          },
          exclusions: {
            directories: [],
            files: [],
            patterns: [],
          },
        },
      };
    }

    const projectConfig = await this.loadProjectConfig(projectPath);

    if (!projectConfig) {
      return {
        global: globalConfig,
        project: null,
        merged: {
          providers: globalConfig.aiModel.providers,
          models: globalConfig.aiModel.models,
          tieredLM: globalConfig.aiModel.tieredLM,
          agents: globalConfig.agents,
          rag: globalConfig.rag,
          mcp: globalConfig.mcp,
          memory: globalConfig.memory,
          remote: globalConfig.remote,
          p2p: globalConfig.p2p,
          ui: globalConfig.ui,
          rules: {
            enabled: false,
            instructions: '',
            additionalRules: [],
          },
          exclusions: {
            directories: ['node_modules', '.git', 'dist', 'build'],
            files: [],
            patterns: [],
          },
        },
      };
    }

    const merged = this.mergeConfigs(globalConfig, projectConfig);

    return {
      global: globalConfig,
      project: projectConfig,
      merged,
    };
  }

  private mergeConfigs(global: GlobalConfig, project: ProjectConfig): EffectiveConfig['merged'] {
    if (project.inheritGlobal && !project.overrides) {
      return {
        providers: global.aiModel.providers,
        models: global.aiModel.models,
        tieredLM: global.aiModel.tieredLM,
        agents: global.agents,
        rag: global.rag,
        mcp: global.mcp,
        memory: global.memory,
        remote: global.remote,
        p2p: global.p2p,
        ui: global.ui,
        rules: project.project.rules,
        exclusions: project.project.exclusions,
      };
    }

    const overrides = project.overrides;

    return {
      providers: overrides?.aiModel?.providers || global.aiModel.providers,
      models: overrides?.aiModel?.models || global.aiModel.models,
      tieredLM: overrides?.aiModel?.tieredLM || global.aiModel.tieredLM,
      agents: { ...global.agents, ...overrides?.agents },
      rag: { ...global.rag, ...overrides?.rag },
      mcp: { ...global.mcp, ...overrides?.mcp },
      memory: { ...global.memory, ...overrides?.memory },
      remote: { ...global.remote, ...overrides?.remote },
      p2p: { ...global.p2p, ...overrides?.p2p },
      ui: { ...global.ui, ...overrides?.ui },
      rules: project.project.rules,
      exclusions: project.project.exclusions,
    };
  }

  async addModel(providerId: string, model: Omit<ModelConfig, 'id'>): Promise<string> {
    const config = await this.loadGlobalConfig();
    const id = crypto.randomUUID();

    config.aiModel.models.push({
      ...model,
      id,
      providerId,
    });

    await this.saveGlobalConfig(config);
    return id;
  }

  async updateModel(modelId: string, updates: Partial<ModelConfig>): Promise<void> {
    const config = await this.loadGlobalConfig();
    const index = config.aiModel.models.findIndex(m => m.id === modelId);

    if (index !== -1) {
      config.aiModel.models[index] = { ...config.aiModel.models[index], ...updates };
      await this.saveGlobalConfig(config);
    }
  }

  async deleteModel(modelId: string): Promise<void> {
    const config = await this.loadGlobalConfig();
    config.aiModel.models = config.aiModel.models.filter(m => m.id !== modelId);
    await this.saveGlobalConfig(config);
  }

  async reorderModels(modelIds: string[]): Promise<void> {
    const config = await this.loadGlobalConfig();

    const reordered = modelIds
      .map((id, index) => {
        const model = config.aiModel.models.find(m => m.id === id);
        if (model) {
          return { ...model, rank: index + 1 };
        }
        return null;
      })
      .filter((m): m is ModelConfig => m !== null);

    config.aiModel.models = reordered;
    await this.saveGlobalConfig(config);
  }

  async addProvider(provider: Omit<ProviderConfig, 'id'>): Promise<string> {
    const config = await this.loadGlobalConfig();
    const id = crypto.randomUUID();

    config.aiModel.providers.push({
      ...provider,
      id,
    });

    await this.saveGlobalConfig(config);
    return id;
  }

  async updateProvider(providerId: string, updates: Partial<ProviderConfig>): Promise<void> {
    const config = await this.loadGlobalConfig();
    const index = config.aiModel.providers.findIndex(p => p.id === providerId);

    if (index !== -1) {
      config.aiModel.providers[index] = { ...config.aiModel.providers[index], ...updates };
      await this.saveGlobalConfig(config);
    }
  }

  async deleteProvider(providerId: string): Promise<void> {
    const config = await this.loadGlobalConfig();
    config.aiModel.providers = config.aiModel.providers.filter(p => p.id !== providerId);
    config.aiModel.models = config.aiModel.models.filter(m => m.providerId !== providerId);
    await this.saveGlobalConfig(config);
  }

  async validateConfig(config: GlobalConfig): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!config.aiModel.providers.length) {
      errors.push('At least one AI provider must be configured');
    }

    if (!config.aiModel.models.length) {
      errors.push('At least one AI model must be configured');
    }

    const defaultProvider = config.aiModel.providers.find(p => p.id === config.aiModel.defaultProviderId);
    if (!defaultProvider && config.aiModel.providers.length > 0) {
      errors.push('A default provider must be selected');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const configService = new ConfigService();
