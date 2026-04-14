export interface GlobalConfig {
  version: string;
  lastModified: string;
  aiModel: AIModelGlobalConfig;
  agents: AgentConfigs;
  rag: RAGConfig;
  mcp: MCPConfig;
  memory: MemoryConfig;
  remote: RemoteConfig;
  p2p: P2PConfig;
  ui: UIConfig;
}

export interface AIModelGlobalConfig {
  providers: ProviderConfig[];
  defaultProviderId: string;
  models: ModelConfig[];
  tieredLM: TieredLMConfig;
}

export interface ProviderConfig {
  id: string;
  name: string;
  type: 'anthropic' | 'openai' | 'ollama' | 'other';
  endpoint?: string;
  apiKey?: string;
  isDefault: boolean;
}

export interface ModelConfig {
  id: string;
  providerId: string;
  name: string;
  displayName: string;
  rank: number;
  capabilities: ModelCapabilities;
  isDefault: boolean;
  settings: ModelSettings;
}

export interface ModelCapabilities {
  vision: boolean;
  functionCalling: boolean;
  streaming: boolean;
  maxTokens: number;
  contextWindow: number;
}

export interface ModelSettings {
  temperature: number;
  maxTokens: number;
  topP?: number;
  timeout: number;
}

export interface TieredLMConfig {
  enabled: boolean;
  auxiliaryModelId: string | null;
  fallbackChain: string[];
  complexityThreshold: number;
}

export interface AgentConfigs {
  roles: AgentConfig[];
  collaborationPattern: 'sequential' | 'parallel' | 'hybrid';
  conflictResolution: 'leader-decides' | 'vote' | 'priority';
}

export interface AgentConfig {
  id: string;
  name: string;
  type: 'leader' | 'worker' | 'specialist';
  modelId?: string;
  providerId?: string;
  capabilities: string[];
  config: Record<string, any>;
}

export interface RAGConfig {
  enabled: boolean;
  repositories: KnowledgeRepository[];
  embeddingModel: string;
  topK: number;
  similarityThreshold: number;
  vectorDb?: VectorDbConfig;
}

export interface KnowledgeRepository {
  id: string;
  name: string;
  type: 'local' | 'remote' | 'database';
  path?: string;
  url?: string;
  syncFrequency: number;
}

export interface VectorDbConfig {
  type: 'pinecone' | 'weaviate' | 'qdrant' | 'chromadb';
  endpoint: string;
  apiKey?: string;
  indexName: string;
}

export interface MCPConfig {
  servers: MCPServer[];
  tools: ToolConfig[];
}

export interface MCPServer {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  authentication?: {
    type: 'bearer' | 'basic' | 'api-key';
    token?: string;
    username?: string;
    password?: string;
  };
}

export interface ToolConfig {
  id: string;
  name: string;
  enabled: boolean;
  allowedAgents: string[];
  rateLimit?: number;
  safetyLevel: 'low' | 'medium' | 'high';
}

export interface MemoryConfig {
  maxContextWindow: number;
  summaryCompression: boolean;
  historyRetentionDays: number;
  workingDirectory: string;
  fileWatching: boolean;
  autoDiscovery: boolean;
  additionalStores: MemoryStore[];
}

export interface MemoryStore {
  id: string;
  type: 'database' | 'cache' | 'file';
  connection: string;
  enabled: boolean;
}

export interface RemoteConfig {
  computers: RemoteComputer[];
  deployment: DeploymentConfig;
}

export interface RemoteComputer {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: 'password' | 'ssh-key';
  password?: string;
  sshKeyPath?: string;
  sshKeyPassphrase?: string;
  enabled: boolean;
  autoConnect: boolean;
  healthCheckInterval: number;
}

export interface DeploymentConfig {
  version: string;
  installPath: string;
  autoStart: boolean;
  autoUpdate: boolean;
  healthCheckInterval: number;
  rollbackOnFailure: boolean;
}

export interface P2PConfig {
  enabled: boolean;
  discoveryMethod: 'bootstrap' | 'mdns' | 'dht';
  relayServers: string[];
  natTraversal: boolean;
  encryption: boolean;
  peerAuthentication: boolean;
}

export interface UIConfig {
  theme: 'dark' | 'light' | 'system';
  fontSize: number;
  fontFamily: string;
  panelLayout: PanelLayout;
  notifications: NotificationConfig;
  keyboardShortcuts: Record<string, string>;
  language: string;
}

export interface PanelLayout {
  leftPanelWidth: number;
  rightPanelWidth: number;
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
}

export interface NotificationConfig {
  sound: boolean;
  desktop: boolean;
  inApp: boolean;
  level: 'all' | 'important' | 'none';
}

export interface ProjectConfig {
  version: string;
  projectId: string;
  projectPath: string;
  inheritGlobal: boolean;
  overrides: ProjectOverrides | null;
  project: ProjectSettings;
}

export interface ProjectOverrides {
  aiModel?: Partial<AIModelGlobalConfig>;
  agents?: Partial<AgentConfigs>;
  rag?: Partial<RAGConfig>;
  mcp?: Partial<MCPConfig>;
  memory?: Partial<MemoryConfig>;
  remote?: Partial<RemoteConfig>;
  p2p?: Partial<P2PConfig>;
  ui?: Partial<UIConfig>;
}

export interface ProjectSettings {
  workingDirectory: string;
  rules: ProjectRules;
  exclusions: ExclusionSettings;
}

export interface ProjectRules {
  enabled: boolean;
  instructions: string;
  additionalRules: AdditionalRule[];
}

export interface AdditionalRule {
  id: string;
  name: string;
  pattern: string;
  content: string;
  priority: number;
}

export interface ExclusionSettings {
  directories: string[];
  files: string[];
  patterns: string[];
}

export interface EffectiveConfig {
  global: GlobalConfig;
  project: ProjectConfig | null;
  merged: MergedConfig;
}

export interface MergedConfig {
  providers: ProviderConfig[];
  models: ModelConfig[];
  tieredLM: TieredLMConfig;
  agents: AgentConfigs;
  rag: RAGConfig;
  mcp: MCPConfig;
  memory: MemoryConfig;
  remote: RemoteConfig;
  p2p: P2PConfig;
  ui: UIConfig;
  rules: ProjectRules;
  exclusions: ExclusionSettings;
}

export interface ConfigBackup {
  id: string;
  timestamp: string;
  version: string;
  path: string;
  size: number;
}
