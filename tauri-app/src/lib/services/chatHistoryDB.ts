import type { ConversationRecord, MessageRecord, ProjectRecord, HistorySettings } from '$types/chatHistory';

const DB_NAME = 'ChatHistoryDB';
const DB_VERSION = 1;

export class ChatHistoryDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('conversations')) {
          const convoStore = db.createObjectStore('conversations', { keyPath: 'id' });
          convoStore.createIndex('by-project', 'projectId');
          convoStore.createIndex('by-updated', 'updatedAt');
        }

        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('by-conversation', 'conversationId');
          msgStore.createIndex('by-timestamp', 'timestamp');
        }

        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      };
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

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('conversations', 'readwrite');
      const store = tx.objectStore('conversations');
      const request = store.put(conversation);
      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  async getConversation(id: string): Promise<ConversationRecord | undefined> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('conversations', 'readonly');
      const store = tx.objectStore('conversations');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllConversations(): Promise<ConversationRecord[]> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('conversations', 'readonly');
      const store = tx.objectStore('conversations');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async addMessage(conversationId: string, message: Omit<MessageRecord, 'id'>): Promise<string> {
    if (!this.db) throw new Error('DB not initialized');

    const id = crypto.randomUUID();
    const fullMessage: MessageRecord = { ...message, id };

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['messages', 'conversations'], 'readwrite');
      const msgStore = tx.objectStore('messages');
      const convoStore = tx.objectStore('conversations');

      msgStore.put(fullMessage);

      const convoRequest = convoStore.get(conversationId);
      convoRequest.onsuccess = () => {
        const conversation = convoRequest.result;
        if (conversation) {
          conversation.messageCount++;
          conversation.updatedAt = Date.now();
          convoStore.put(conversation);
        }
      };

      tx.oncomplete = () => resolve(id);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMessage(id: string): Promise<MessageRecord | undefined> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getMessages(conversationId: string): Promise<MessageRecord[]> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const index = store.index('by-conversation');
      const request = index.getAll(conversationId);
      request.onsuccess = () => {
        const messages = request.result || [];
        resolve(messages.sort((a: MessageRecord, b: MessageRecord) => a.timestamp - b.timestamp));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteConversation(id: string): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('conversations', 'readwrite');
      const store = tx.objectStore('conversations');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateConversation(id: string, updates: Partial<ConversationRecord>): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('conversations', 'readwrite');
      const store = tx.objectStore('conversations');
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const conversation = getRequest.result;
        if (conversation) {
          const updated = { ...conversation, ...updates };
          const putRequest = store.put(updated);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async searchConversations(query: string): Promise<ConversationRecord[]> {
    const all = await this.getAllConversations();
    const lowerQuery = query.toLowerCase();
    return all.filter(c =>
      c.title.toLowerCase().includes(lowerQuery) ||
      c.tags.some(t => t.toLowerCase().includes(lowerQuery))
    );
  }

  async searchMessages(query: string): Promise<MessageRecord[]> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const request = store.getAll();
      request.onsuccess = () => {
        const all = request.result || [];
        const lowerQuery = query.toLowerCase();
        resolve(all.filter((m: MessageRecord) => m.content.toLowerCase().includes(lowerQuery)));
      };
      request.onerror = () => reject(request.error);
    });
  }
}
