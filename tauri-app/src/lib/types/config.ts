import type { AgentConfig } from './agent';

export interface Config {
  aiModel: AIModelConfig;
  agents: AgentConfigs;
  rag: RAGConfig;
  mcp: MCPConfig;
  memory: MemoryConfig;
  remote: RemoteConfig;
  p2p: P2PConfig;
  ui: UIConfig;
  project: ProjectConfig;
}

export interface AIModelConfig {
  provider: 'anthropic' | 'openai' | 'local' | 'custom';
  endpoint: string;
  apiKey?: string;
  model: string;
  fallbackModels?: string[];
  temperature: number;
  maxTokens: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  timeout: number;
}

export interface AgentConfigs {
  roles: AgentConfig[];
  collaborationPattern: 'sequential' | 'parallel' | 'hybrid';
  conflictResolution: 'leader-decides' | 'vote' | 'priority';
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
  workingDirectory: string;
  gitIntegration: boolean;
  autoCommit: boolean;
  branchManagement: string;
  environmentVariables: Record<string, string>;
  templates: string[];
}
