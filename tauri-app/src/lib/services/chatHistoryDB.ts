import { openDB, type IDBPDatabase } from 'idb';
import type { ConversationRecord, MessageRecord, ProjectRecord, HistorySettings } from '$types/chatHistory';

const DB_NAME = 'ChatHistoryDB';
const DB_VERSION = 1;

interface ChatHistoryDBSchema {
  conversations: {
    key: string;
    value: ConversationRecord;
    indexes: { 'by-project': string; 'by-updated': number };
  };
  messages: {
    key: string;
    value: MessageRecord;
    indexes: { 'by-conversation': string; 'by-timestamp': number };
  };
  projects: {
    key: string;
    value: ProjectRecord;
    indexes: { 'by-path': string };
  };
  settings: {
    key: string;
    value: HistorySettings;
  };
}

export class ChatHistoryDB {
  private db: IDBPDatabase<ChatHistoryDBSchema> | null = null;

  async init(): Promise<void> {
    this.db = await openDB<ChatHistoryDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const convoStore = db.createObjectStore('conversations', { keyPath: 'id' });
        convoStore.createIndex('by-project', 'projectId');
        convoStore.createIndex('by-updated', 'updatedAt');

        const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
        msgStore.createIndex('by-conversation', 'conversationId');
        msgStore.createIndex('by-timestamp', 'timestamp');

        const projStore = db.createObjectStore('projects', { keyPath: 'id' });
        projStore.createIndex('by-path', 'path');

        db.createObjectStore('settings', { keyPath: 'id' });
      },
    });
  }

  async getVersion(): Promise<number> {
    return DB_VERSION;
  }

  async createConversation(projectId: string | null, title?: string): Promise<string> {
    if (!this.db) throw new Error('DB not initialized');

    const id = crypto.randomUUID();
    const now = Date.now();
    const conversation: ConversationRecord = {
      id,
      projectId,
      title: title || 'New Conversation',
      agentId: '',
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      tags: [],
      isArchived: false,
    };

    await this.db.put('conversations', conversation);
    return id;
  }

  async getConversation(id: string): Promise<ConversationRecord | undefined> {
    if (!this.db) throw new Error('DB not initialized');
    return this.db.get('conversations', id);
  }

  async getAllConversations(): Promise<ConversationRecord[]> {
    if (!this.db) throw new Error('DB not initialized');
    return this.db.getAll('conversations');
  }

  async addMessage(conversationId: string, message: Omit<MessageRecord, 'id'>): Promise<string> {
    if (!this.db) throw new Error('DB not initialized');

    const id = crypto.randomUUID();
    const fullMessage: MessageRecord = { ...message, id };

    await this.db.put('messages', fullMessage);

    const conversation = await this.db.get('conversations', conversationId);
    if (conversation) {
      conversation.messageCount++;
      conversation.updatedAt = Date.now();
      await this.db.put('conversations', conversation);
    }

    return id;
  }

  async getMessage(id: string): Promise<MessageRecord | undefined> {
    if (!this.db) throw new Error('DB not initialized');
    return this.db.get('messages', id);
  }

  async getMessages(conversationId: string): Promise<MessageRecord[]> {
    if (!this.db) throw new Error('DB not initialized');
    const index = this.db.transaction('messages').store.index('by-conversation');
    const messages = await index.getAll(conversationId);
    return messages.sort((a, b) => a.timestamp - b.timestamp);
  }

  async deleteConversation(id: string): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');
    await this.db.delete('conversations', id);
  }

  async updateConversation(id: string, updates: Partial<ConversationRecord>): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');
    const conversation = await this.db.get('conversations', id);
    if (conversation) {
      const updated = { ...conversation, ...updates };
      await this.db.put('conversations', updated);
    }
  }

  async searchConversations(query: string): Promise<ConversationRecord[]> {
    if (!this.db) throw new Error('DB not initialized');
    const all = await this.getAllConversations();
    const lowerQuery = query.toLowerCase();
    return all.filter(c =>
      c.title.toLowerCase().includes(lowerQuery) ||
      c.tags.some(t => t.toLowerCase().includes(lowerQuery))
    );
  }

  async searchMessages(query: string): Promise<MessageRecord[]> {
    if (!this.db) throw new Error('DB not initialized');
    const all = await this.db.getAll('messages');
    const lowerQuery = query.toLowerCase();
    return all.filter(m => m.content.toLowerCase().includes(lowerQuery));
  }
}
