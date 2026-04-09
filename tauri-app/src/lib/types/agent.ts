export enum AgentStatus {
  Active = 'active',
  Thinking = 'thinking',
  Idle = 'idle',
  Error = 'error',
  Offline = 'offline',
}

export enum AgentRole {
  Leader = 'leader',
  Coder = 'coder',
  Reviewer = 'reviewer',
  Tester = 'tester',
  Planner = 'planner',
  Analyzer = 'analyzer',
  Custom = 'custom',
}

export interface AgentInfo {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  model: string;
  currentTask?: string;
  progress: number;
  metrics: AgentMetrics;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  averageResponseTime: number;
  totalTokensUsed: number;
  cpuUsage?: number;
  memoryUsage?: number;
}

export interface AgentConfig {
  id: string;
  role: AgentRole;
  model: string;
  systemPrompt?: string;
  tools?: string[];
  maxTokens?: number;
  temperature?: number;
  autonomyLevel: number;
  verificationRequired: boolean;
}

export interface AgentStatusUpdate {
  agentId: string;
  status: AgentStatus;
  currentTask?: string;
  progress?: number;
  metrics?: Partial<AgentMetrics>;
  timestamp: Date;
}
