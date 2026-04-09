export enum TaskStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export enum TaskPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}

export interface TaskInfo {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedAgent?: string;
  progress: number;
  estimatedTime?: number;
  actualTime?: number;
  dependencies: string[];
  result?: TaskResult;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface TaskResult {
  success: boolean;
  output?: string;
  error?: string;
  artifacts?: TaskArtifact[];
  metrics?: TaskMetrics;
}

export interface TaskArtifact {
  type: 'file' | 'code' | 'document' | 'image';
  name: string;
  path?: string;
  content?: string;
  url?: string;
}

export interface TaskMetrics {
  tokensUsed: number;
  apiCalls: number;
  executionTime: number;
  retryCount: number;
}

export interface TaskUpdate {
  taskId: string;
  status?: TaskStatus;
  progress?: number;
  assignedAgent?: string;
  result?: TaskResult;
  timestamp: Date;
}

export interface TaskRequest {
  name: string;
  description: string;
  priority: TaskPriority;
  dependencies?: string[];
  assignedAgent?: string;
  config?: Record<string, unknown>;
}
