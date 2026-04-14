export interface Project {
  id: string;
  name: string;
  path: string;
  description?: string;
  color: string;
  icon?: string;
  createdAt: number;
  lastAccessedAt: number;
  sessionCount: number;
}

export interface Session {
  id: string;
  projectId: string;
  title: string;
  status: 'active' | 'paused' | 'completed' | 'error';
  agentId: string;
  conversationId: string;
  createdAt: number;
  updatedAt: number;
  logs: SessionLog[];
}

export interface SessionLog {
  id: string;
  sessionId: string;
  timestamp: number;
  level: 'info' | 'warning' | 'error';
  source: 'agent' | 'llm' | 'system';
  message: string;
  details?: Record<string, any>;
}

export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  hasConfig: boolean;
  sessionCount: number;
  lastAccessedAt: number;
}

export interface ProjectStats {
  totalProjects: number;
  activeSessions: number;
  totalConversations: number;
  lastActivityAt: number;
}

export const PROJECT_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
] as const;

export function getRandomProjectColor(): string {
  return PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)];
}

export function createDefaultProject(path: string, name?: string): Project {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: name || path.split('/').pop() || 'Untitled Project',
    path,
    description: '',
    color: getRandomProjectColor(),
    icon: '📁',
    createdAt: now,
    lastAccessedAt: now,
    sessionCount: 0,
  };
}

export function createSession(projectId: string, agentId: string, title?: string): Session {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    projectId,
    title: title || 'New Session',
    status: 'active',
    agentId,
    conversationId: '',
    createdAt: now,
    updatedAt: now,
    logs: [],
  };
}

export function createSessionLog(
  sessionId: string,
  level: SessionLog['level'],
  source: SessionLog['source'],
  message: string,
  details?: Record<string, any>
): SessionLog {
  return {
    id: crypto.randomUUID(),
    sessionId,
    timestamp: Date.now(),
    level,
    source,
    message,
    details,
  };
}
