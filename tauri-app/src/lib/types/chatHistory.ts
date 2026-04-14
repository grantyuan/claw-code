export interface ConversationRecord {
  id: string;
  projectId: string | null;
  title: string;
  agentId: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  tags: string[];
  isArchived: boolean;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  metadata?: MessageMetadata;
}

export interface Attachment {
  id: string;
  type: 'image' | 'file' | 'code';
  name: string;
  mimeType: string;
  data: string;
  size: number;
}

export interface MessageMetadata {
  model?: string;
  provider?: string;
  tokens?: number;
  latency?: number;
  error?: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  path: string;
  conversationIds: string[];
  lastAccessedAt: number;
}

export interface HistorySettings {
  id: 'default';
  retentionDays: number | null;
  autoCleanupEnabled: boolean;
  maxMessagesPerConversation: number;
  streamingCacheSize: number;
}
