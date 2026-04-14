import { describe, it, expect, beforeEach } from 'vitest';
import { ChatHistoryDB } from '$services/chatHistoryDB';

describe('ChatHistoryDB', () => {
  let db: ChatHistoryDB;

  beforeEach(async () => {
    db = new ChatHistoryDB();
    await db.init();
  });

  it('should initialize with correct schema version', async () => {
    const version = await db.getVersion();
    expect(version).toBe(1);
  });

  it('should create conversation and return id', async () => {
    const id = await db.createConversation('test-project', 'Test Chat');
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
  });

  it('should store and retrieve conversation', async () => {
    const id = await db.createConversation('test-project', 'Test Chat');
    const conversation = await db.getConversation(id);
    expect(conversation).toBeDefined();
    expect(conversation?.title).toBe('Test Chat');
    expect(conversation?.projectId).toBe('test-project');
  });

  it('should add message to conversation', async () => {
    const convoId = await db.createConversation(null, 'Test');
    const messageId = await db.addMessage(convoId, {
      conversationId: convoId,
      type: 'user',
      content: 'Hello',
      timestamp: Date.now(),
    });

    expect(messageId).toBeDefined();
    const message = await db.getMessage(messageId);
    expect(message?.content).toBe('Hello');
  });

  it('should get messages for conversation ordered by timestamp', async () => {
    const convoId = await db.createConversation(null);
    await db.addMessage(convoId, { conversationId: convoId, type: 'user', content: 'First', timestamp: 1000 });
    await db.addMessage(convoId, { conversationId: convoId, type: 'user', content: 'Second', timestamp: 2000 });

    const messages = await db.getMessages(convoId);
    expect(messages.length).toBe(2);
    expect(messages[0].content).toBe('First');
    expect(messages[1].content).toBe('Second');
  });

  it('should delete conversation', async () => {
    const id = await db.createConversation(null, 'To Delete');
    await db.deleteConversation(id);
    const conversation = await db.getConversation(id);
    expect(conversation).toBeUndefined();
  });

  it('should update conversation', async () => {
    const id = await db.createConversation(null, 'Original Title');
    await db.updateConversation(id, { title: 'Updated Title' });
    const conversation = await db.getConversation(id);
    expect(conversation?.title).toBe('Updated Title');
  });

  it('should search conversations by title', async () => {
    await db.createConversation(null, 'Python web server');
    await db.createConversation(null, 'JavaScript react app');

    const results = await db.searchConversations('python');
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Python web server');
  });

  it('should search messages by content', async () => {
    const convoId = await db.createConversation(null, 'Test');
    await db.addMessage(convoId, { conversationId: convoId, type: 'user', content: 'How to parse JSON in Python?', timestamp: Date.now() });

    const results = await db.searchMessages('python');
    expect(results.length).toBe(1);
    expect(results[0].content).toContain('Python');
  });
});
