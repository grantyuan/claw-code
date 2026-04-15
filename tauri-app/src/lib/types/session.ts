export type SessionStatus = 'active' | 'idle' | 'running' | 'error';

export interface AIModelConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface Session {
  id: string;
  name: string;
  projectPath: string;
  status: SessionStatus;
  createdAt: number;
  lastActiveAt: number;
  messageCount: number;
  agentId?: string;
  tags?: string[];
  isArchived?: boolean;
  currentModel?: AIModelConfig;
}

export interface RuntimeError {
  type: RuntimeErrorType;
  message: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
}

export enum RuntimeErrorType {
  CLI_NOT_AVAILABLE = 'CLI_NOT_AVAILABLE',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  MESSAGE_DELIVERY_FAILED = 'MESSAGE_DELIVERY_FAILED',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

export interface HealthStatus {
  status: string;
  runtimeAvailable: boolean;
  sessionCount: number;
}
