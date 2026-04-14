import { ChatHistoryDB } from './chatHistoryDB';
import type { ConversationRecord, MessageRecord } from '$types/chatHistory';

export interface ListOptions {
  projectId?: string | null;
  limit?: number;
  offset?: number;
  includeArchived?: boolean;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

class ChatHistoryService {
  private db: ChatHistoryDB;

  constructor() {
    this.db = new ChatHistoryDB();
  }

  async init(): Promise<void> {
    await this.db.init();
  }

  async createConversation(projectId: string | null, title?: string): Promise<string> {
    return this.db.createConversation(projectId, title);
  }

  async getConversation(id: string): Promise<ConversationRecord | null> {
    const result = await this.db.getConversation(id);
    return result ?? null;
  }

  async listConversations(options: ListOptions = {}): Promise<ConversationRecord[]> {
    const { projectId, limit = 50, offset = 0, includeArchived = false } = options;
    const allConvos = await this.db.getAllConversations();

    let filtered = allConvos.filter(c => {
      if (!includeArchived && c.isArchived) return false;
      if (projectId !== undefined && c.projectId !== projectId) return false;
      return true;
    });

    filtered.sort((a, b) => b.updatedAt - a.updatedAt);

    return filtered.slice(offset, offset + limit);
  }

  async addMessage(conversationId: string, message: Omit<MessageRecord, 'id'>): Promise<string> {
    return this.db.addMessage(conversationId, message);
  }

  async getMessages(conversationId: string, options?: PaginationOptions): Promise<MessageRecord[]> {
    return this.db.getMessages(conversationId);
  }

  async resubmitMessage(
    conversationId: string,
    messageId: string,
    callback: (content: string) => void | Promise<void>
  ): Promise<boolean> {
    const messages = await this.getMessages(conversationId);
    const message = messages.find(m => m.id === messageId);

    if (!message) {
      return false;
    }

    if (message.type !== 'user') {
      return false;
    }

    await callback(message.content);
    return true;
  }

  async deleteConversation(id: string): Promise<void> {
    await this.db.deleteConversation(id);
  }

  async archiveConversation(id: string): Promise<void> {
    await this.db.updateConversation(id, { isArchived: true });
  }

  async searchConversations(query: string): Promise<ConversationRecord[]> {
    if (query.length < 2) return [];
    return this.db.searchConversations(query);
  }

  async searchMessages(query: string): Promise<MessageRecord[]> {
    if (query.length < 2) return [];
    return this.db.searchMessages(query);
  }
}

export const chatHistoryService = new ChatHistoryService();
