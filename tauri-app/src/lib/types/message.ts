export enum MessageType {
  User = 'user',
  AI = 'ai',
  System = 'system',
  Error = 'error',
  Tool = 'tool',
}

export interface Message {
  id: string;
  conversationId: string;
  type: MessageType;
  content: string;
  sender?: string;
  timestamp: Date;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  model?: string;
  tokens?: number;
  cost?: number;
  files?: string[];
  codeBlocks?: CodeBlock[];
  references?: string[];
}

export interface CodeBlock {
  language: string;
  code: string;
  filename?: string;
  lineStart?: number;
  lineEnd?: number;
}

export interface StreamChunk {
  messageId: string;
  chunk: string;
  isComplete: boolean;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  agentId: string;
  createdAt: Date;
  updatedAt: Date;
}
