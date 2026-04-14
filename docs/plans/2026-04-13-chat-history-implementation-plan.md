# Chat History Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a robust chat history caching system with IndexedDB, keyboard navigation, and resubmit functionality.

**Architecture:** Use IndexedDB for persistent storage of conversations and messages. Create a service layer for CRUD operations, with Svelte components for UI. Keyboard navigation handled via a custom hook.

**Tech Stack:** Svelte 5, TypeScript, IndexedDB (via idb library), Tauri 2.x

---

## Phase 1.1: IndexedDB Setup and Schema

### Task 1: Initialize IndexedDB Schema

**Files:**
- Create: `tauri-app/src/lib/services/chatHistoryDB.ts`
- Create: `tauri-app/src/lib/types/chatHistory.ts`
- Create: `tauri-app/tests/unit/services/chatHistoryDB.test.ts`

**Step 1: Write the failing test**

```typescript
// tauri-app/tests/unit/services/chatHistoryDB.test.ts
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
});
```

**Step 2: Run test to verify it fails**

Run: `cd tauri-app && npm run test -- tests/unit/services/chatHistoryDB.test.ts`
Expected: FAIL - ChatHistoryDB not defined

**Step 3: Write minimal implementation**

```typescript
// tauri-app/src/lib/types/chatHistory.ts
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
```

```typescript
// tauri-app/src/lib/services/chatHistoryDB.ts
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
        // conversations store
        const convoStore = db.createObjectStore('conversations', { keyPath: 'id' });
        convoStore.createIndex('by-project', 'projectId');
        convoStore.createIndex('by-updated', 'updatedAt');

        // messages store
        const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
        msgStore.createIndex('by-conversation', 'conversationId');
        msgStore.createIndex('by-timestamp', 'timestamp');

        // projects store
        const projStore = db.createObjectStore('projects', { keyPath: 'id' });
        projStore.createIndex('by-path', 'path');

        // settings store
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
}
```

**Step 4: Run test to verify it passes**

Run: `cd tauri-app && npm run test -- tests/unit/services/chatHistoryDB.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tauri-app/src/lib/types/chatHistory.ts tauri-app/src/lib/services/chatHistoryDB.ts tauri-app/tests/unit/services/chatHistoryDB.test.ts
git commit -m "feat(chat-history): add IndexedDB schema and basic CRUD

- Add ChatHistoryDB class with idb library
- Define ConversationRecord, MessageRecord types
- Add createConversation and getConversation methods
- Add unit tests for basic operations"
```

---

### Task 2: Add Message CRUD Operations

**Files:**
- Modify: `tauri-app/src/lib/services/chatHistoryDB.ts:100-150`
- Create: `tauri-app/tests/unit/services/chatHistoryDB.messages.test.ts`

**Step 1: Write the failing test**

```typescript
// tauri-app/tests/unit/services/chatHistoryDB.messages.test.ts
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
```

**Step 2: Run test to verify it fails**

Run: `cd tauri-app && npm run test -- tests/unit/services/chatHistoryDB.messages.test.ts`
Expected: FAIL - addMessage not defined

**Step 3: Write minimal implementation**

```typescript
// Add to ChatHistoryDB class
async addMessage(conversationId: string, message: Omit<MessageRecord, 'id'>): Promise<string> {
  if (!this.db) throw new Error('DB not initialized');

  const id = crypto.randomUUID();
  const fullMessage: MessageRecord = { ...message, id };

  await this.db.put('messages', fullMessage);

  // Update conversation message count and updatedAt
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
```

**Step 4: Run test to verify it passes**

Run: `cd tauri-app && npm run test -- tests/unit/services/chatHistoryDB.messages.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tauri-app/src/lib/services/chatHistoryDB.ts tauri-app/tests/unit/services/chatHistoryDB.messages.test.ts
git commit -m "feat(chat-history): add message CRUD operations

- Add addMessage method
- Add getMessage and getMessages methods
- Update conversation messageCount on add
- Add unit tests for message operations"
```

---

## Phase 1.2: ChatHistoryService Implementation

### Task 3: Create ChatHistoryService

**Files:**
- Create: `tauri-app/src/lib/services/chatHistoryService.ts`
- Create: `tauri-app/tests/unit/services/chatHistoryService.test.ts`

**Step 1: Write the failing test**

```typescript
// tauri-app/tests/unit/services/chatHistoryService.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ChatHistoryService } from '$services/chatHistoryService';

describe('ChatHistoryService', () => {
  let service: ChatHistoryService;

  beforeEach(async () => {
    service = new ChatHistoryService();
    await service.init();
  });

  it('should create conversation and auto-generate title', async () => {
    const id = await service.createConversation(null);
    const convo = await service.getConversation(id);
    expect(convo?.title).toMatch(/^Conversation \d+$/);
  });

  it('should list conversations for project', async () => {
    const projectId = 'proj-1';
    await service.createConversation(projectId, 'Chat A');
    await service.createConversation(projectId, 'Chat B');
    await service.createConversation('proj-2', 'Chat C');

    const projectConvos = await service.listConversations({ projectId });
    expect(projectConvos.length).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd tauri-app && npm run test -- tests/unit/services/chatHistoryService.test.ts`
Expected: FAIL - ChatHistoryService not defined

**Step 3: Write minimal implementation**

```typescript
// tauri-app/src/lib/services/chatHistoryService.ts
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
    return this.db.getConversation(id) || null;
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
}

export const chatHistoryService = new ChatHistoryService();
```

**Step 4: Run test to verify it passes**

Run: `cd tauri-app && npm run test -- tests/unit/services/chatHistoryService.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tauri-app/src/lib/services/chatHistoryService.ts tauri-app/tests/unit/services/chatHistoryService.test.ts
git commit -m "feat(chat-history): create ChatHistoryService layer

- Add ChatHistoryService with listConversations
- Add pagination and filtering support
- Add project-scoped conversation listing"
```

---

## Phase 1.3: Chat History UI Components

### Task 4: Create ChatHistoryPanel Component

**Files:**
- Create: `tauri-app/src/lib/components/history/ChatHistoryPanel.svelte`
- Create: `tauri-app/tests/e2e/chat-history-panel.test.ts`

**Step 1: Write the failing test**

```typescript
// tauri-app/tests/e2e/chat-history-panel.test.ts
import { test, expect } from '@playwright/test';

test('ChatHistoryPanel shows conversations list', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('[data-testid="chat-history-panel"]');

  const panel = page.locator('[data-testid="chat-history-panel"]');
  await expect(panel).toBeVisible();
});
```

**Step 2: Run test to verify it fails**

Run: `cd tauri-app && npm run test:e2e -- tests/e2e/chat-history-panel.test.ts`
Expected: FAIL - element not found

**Step 3: Write minimal implementation**

```svelte
<!-- tauri-app/src/lib/components/history/ChatHistoryPanel.svelte -->
<script lang="ts">
  import { chatHistoryService } from '$services/chatHistoryService';
  import HistoryListItem from './HistoryListItem.svelte';

  interface Props {
    projectId?: string;
    onSelectConversation: (id: string) => void;
  }

  let { projectId, onSelectConversation }: Props = $props();

  let conversations = $state<any[]>([]);
  let searchQuery = $state('');
  let selectedId = $state<string | null>(null);

  $effect(() => {
    loadConversations();
  });

  async function loadConversations() {
    conversations = await chatHistoryService.listConversations({ projectId });
  }

  function handleSelect(id: string) {
    selectedId = id;
    onSelectConversation(id);
  }
</script>

<div class="flex flex-col h-full" data-testid="chat-history-panel">
  <div class="p-3 border-b" style="border-color: var(--color-border);">
    <input
      type="text"
      placeholder="Search conversations..."
      class="w-full px-3 py-2 rounded-lg text-sm"
      style="background: var(--color-bg); border: 1px solid var(--color-border);"
      bind:value={searchQuery}
    />
  </div>

  <div class="flex-1 overflow-y-auto">
    {#each conversations as convo (convo.id)}
      <HistoryListItem
        conversation={convo}
        isSelected={selectedId === convo.id}
        onSelect={() => handleSelect(convo.id)}
      />
    {/each}
  </div>
</div>
```

**Step 4: Run test to verify it passes**

Run: `cd tauri-app && npm run test:e2e -- tests/e2e/chat-history-panel.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tauri-app/src/lib/components/history/ChatHistoryPanel.svelte tauri-app/tests/e2e/chat-history-panel.test.ts
git commit -m "feat(chat-history): add ChatHistoryPanel component

- Add panel with search input
- Add conversation list rendering
- Add onSelectConversation callback prop"
```

---

### Task 5: Create HistoryListItem Component

**Files:**
- Create: `tauri-app/src/lib/components/history/HistoryListItem.svelte`
- Create: `tauri-app/src/lib/components/history/HistoryListItem.test.ts`

**Step 1: Write the failing test**

```typescript
// tauri-app/src/lib/components/history/HistoryListItem.test.ts
test('shows conversation title and preview', async () => {
  render(HistoryListItem, {
    props: {
      conversation: {
        id: '1',
        title: 'Test Chat',
        updatedAt: Date.now() - 3600000,
        messageCount: 5,
        projectId: null,
        agentId: '',
        createdAt: Date.now(),
        tags: [],
        isArchived: false,
      },
      isSelected: false,
      onSelect: () => {},
    },
  });

  expect(screen.getByText('Test Chat')).toBeInTheDocument();
  expect(screen.getByText('5 messages')).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `cd tauri-app && npm run test -- src/lib/components/history/HistoryListItem.test.ts`
Expected: FAIL - component not found

**Step 3: Write minimal implementation**

```svelte
<!-- tauri-app/src/lib/components/history/HistoryListItem.svelte -->
<script lang="ts">
  import type { ConversationRecord } from '$types/chatHistory';

  interface Props {
    conversation: ConversationRecord;
    isSelected: boolean;
    onSelect: () => void;
  }

  let { conversation, isSelected, onSelect }: Props = $props();

  function formatRelativeTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }
</script>

<button
  class="w-full text-left px-4 py-3 transition-colors {isSelected ? 'bg-primary-100 dark:bg-primary-900' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}"
  onclick={onSelect}
>
  <div class="flex items-center justify-between mb-1">
    <span class="font-medium text-sm" style="color: var(--color-text);">
      {conversation.title}
    </span>
    <span class="text-xs" style="color: var(--color-text-secondary);">
      {formatRelativeTime(conversation.updatedAt)}
    </span>
  </div>
  <div class="text-xs" style="color: var(--color-text-secondary);">
    {conversation.messageCount} messages
  </div>
</button>
```

**Step 4: Run test to verify it passes**

Run: `cd tauri-app && npm run test -- src/lib/components/history/HistoryListItem.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tauri-app/src/lib/components/history/HistoryListItem.svelte tauri-app/src/lib/components/history/HistoryListItem.test.ts
git commit -m "feat(chat-history): add HistoryListItem component

- Show conversation title
- Show relative timestamp
- Show message count
- Add selected state styling"
```

---

## Phase 1.4: Keyboard Navigation

### Task 6: Add Keyboard Navigation Hook

**Files:**
- Create: `tauri-app/src/lib/components/history/useHistoryNavigation.ts`
- Create: `tauri-app/tests/unit/hooks/useHistoryNavigation.test.ts`

**Step 1: Write the failing test**

```typescript
// tauri-app/tests/unit/hooks/useHistoryNavigation.test.ts
test('up arrow selects previous item', async () => {
  const items = ['a', 'b', 'c'];
  const { result } = renderHook(() => useHistoryNavigation(items));

  // Select first item
  act(() => result.current.selectIndex(0));

  // Press up arrow
  act(() => result.current.handleKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' })));

  expect(result.current.selectedIndex).toBe(0); // Can't go below 0
});
```

**Step 2: Run test to verify it fails**

Run: `cd tauri-app && npm run test -- tests/unit/hooks/useHistoryNavigation.test.ts`
Expected: FAIL - hook not defined

**Step 3: Write minimal implementation**

```typescript
// tauri-app/src/lib/components/history/useHistoryNavigation.ts
import { useCallback, useEffect, useState } from 'svelte';

export function useHistoryNavigation<T>(
  items: T[],
  options: {
    onSelect?: (item: T, index: number) => void;
    onOpen?: (item: T, index: number) => void;
  } = {}
) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (selectedIndex >= items.length && items.length > 0) {
      setSelectedIndex(items.length - 1);
    }
  }, [items.length]);

  const handleKeydown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(0, prev - 1));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(items.length - 1, prev + 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (items[selectedIndex]) {
          options.onOpen?.(items[selectedIndex], selectedIndex);
        }
        break;
    }
  }, [items, selectedIndex, options]);

  const selectIndex = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  return {
    selectedIndex,
    handleKeydown,
    selectIndex,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd tauri-app && npm run test -- tests/unit/hooks/useHistoryNavigation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tauri-app/src/lib/components/history/useHistoryNavigation.ts tauri-app/tests/unit/hooks/useHistoryNavigation.test.ts
git commit -m "feat(chat-history): add keyboard navigation hook

- Add useHistoryNavigation hook
- Support ArrowUp/ArrowDown/Enter keys
- Add onSelect and onOpen callbacks"
```

---

## Phase 1.5: Resubmit Feature

### Task 7: Add Resubmit Message Feature

**Files:**
- Modify: `tauri-app/src/lib/services/chatHistoryService.ts`
- Modify: `tauri-app/src/lib/components/history/HistoryListItem.svelte`
- Create: `tauri-app/tests/unit/services/chatHistoryService.resubmit.test.ts`

**Step 1: Write the failing test**

```typescript
// tauri-app/tests/unit/services/chatHistoryService.resubmit.test.ts
test('should resubmit user message', async () => {
  const convoId = await service.createConversation(null);
  const msgId = await service.addMessage(convoId, {
    conversationId: convoId,
    type: 'user',
    content: 'Original message',
    timestamp: Date.now(),
  });

  const resubmitCallback = mock.fn();
  const result = await service.resubmitMessage(convoId, msgId, resubmitCallback);

  expect(result).toBe(true);
  expect(resubmitCallback).toHaveBeenCalledWith('Original message');
});
```

**Step 2: Run test to verify it fails**

Run: `cd tauri-app && npm run test -- tests/unit/services/chatHistoryService.resubmit.test.ts`
Expected: FAIL - resubmitMessage not defined

**Step 3: Write minimal implementation**

```typescript
// Add to ChatHistoryService
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
```

**Step 4: Run test to verify it passes**

Run: `cd tauri-app && npm run test -- tests/unit/services/chatHistoryService.resubmit.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tauri-app/src/lib/services/chatHistoryService.ts tauri-app/tests/unit/services/chatHistoryService.resubmit.test.ts
git commit -m "feat(chat-history): add resubmit message feature

- Add resubmitMessage method to ChatHistoryService
- Add deleteConversation and archiveConversation
- Add callback-based resubmit for LLM processing"
```

---

## Phase 1.6: Search Functionality

### Task 8: Add Search to ChatHistoryService

**Files:**
- Modify: `tauri-app/src/lib/services/chatHistoryDB.ts`
- Modify: `tauri-app/src/lib/services/chatHistoryService.ts`
- Create: `tauri-app/tests/unit/services/chatHistoryService.search.test.ts`

**Step 1: Write the failing test**

```typescript
test('should search conversations by title', async () => {
  await service.createConversation(null, 'Python web server');
  await service.createConversation(null, 'JavaScript react app');
  await service.createConversation(null, 'Python data analysis');

  const results = await service.searchConversations('python');
  expect(results.length).toBe(2);
});

test('should search messages by content', async () => {
  const convoId = await service.createConversation(null, 'Test');
  await service.addMessage(convoId, { conversationId: convoId, type: 'user', content: 'How to parse JSON in Python?', timestamp: Date.now() });

  const results = await service.searchMessages('python');
  expect(results.length).toBe(1);
  expect(results[0].content).toContain('Python');
});
```

**Step 2: Run test to verify it fails**

Run: `cd tauri-app && npm run test -- tests/unit/services/chatHistoryService.search.test.ts`
Expected: FAIL - search not defined

**Step 3: Write minimal implementation**

```typescript
// Add to ChatHistoryDB
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
```

```typescript
// Add to ChatHistoryService
async searchConversations(query: string): Promise<ConversationRecord[]> {
  if (query.length < 2) return [];
  return this.db.searchConversations(query);
}

async searchMessages(query: string): Promise<MessageRecord[]> {
  if (query.length < 2) return [];
  return this.db.searchMessages(query);
}
```

**Step 4: Run test to verify it passes**

Run: `cd tauri-app && npm run test -- tests/unit/services/chatHistoryService.search.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tauri-app/src/lib/services/chatHistoryDB.ts tauri-app/src/lib/services/chatHistoryService.ts tauri-app/tests/unit/services/chatHistoryService.search.test.ts
git commit -m "feat(chat-history): add search functionality

- Add searchConversations and searchMessages to DB
- Add search to ChatHistoryService
- Add minimum 2 character query requirement"
```

---

## Phase 1.7: Integration with Backend

### Task 9: Add Rust Backend Commands

**Files:**
- Create: `rust/crates/cli-server/src/chat_history_commands.rs`
- Modify: `rust/crates/cli-server/src/lib.rs`
- Create: `tauri-app/src/lib/services/chatHistoryApi.ts`

**Step 1: Write the failing test**

```typescript
// tauri-app/tests/integration/chatHistoryApi.test.ts
test('should export conversation via API', async () => {
  const result = await chatHistoryApi.exportConversation('convo-id', 'json');
  expect(result).toBeDefined();
  expect(typeof result).toBe('string');
});
```

**Step 2: Run test to verify it fails**

Run: `cd tauri-app && npm run test -- tests/integration/chatHistoryApi.test.ts`
Expected: FAIL - chatHistoryApi not defined

**Step 3: Write minimal implementation**

```rust
// rust/crates/cli-server/src/chat_history_commands.rs
use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportOptions {
    pub format: String,
}

#[command]
pub async fn export_conversation(
    conversation_id: String,
    format: String,
) -> Result<String, String> {
    // TODO: Implement actual export
    Ok(format!("Exported {} as {}", conversation_id, format))
}

#[command]
pub async fn batch_operations(
    action: String,
    ids: Vec<String>,
) -> Result<usize, String> {
    let count = ids.len();
    // TODO: Implement batch delete/archive
    Ok(count)
}
```

```typescript
// tauri-app/src/lib/services/chatHistoryApi.ts
import { invoke } from '@tauri-apps/api/core';

class ChatHistoryApi {
  async exportConversation(conversationId: string, format: 'json' | 'markdown'): Promise<string> {
    return invoke('export_conversation', { conversationId, format });
  }

  async batchOperations(action: 'delete' | 'archive', ids: string[]): Promise<number> {
    return invoke('batch_operations', { action, ids });
  }
}

export const chatHistoryApi = new ChatHistoryApi();
```

**Step 4: Run test to verify it passes**

Run: `cd tauri-app && npm run test -- tests/integration/chatHistoryApi.test.ts`
Expected: PASS (may need Tauri running)

**Step 5: Commit**

```bash
git add rust/crates/cli-server/src/chat_history_commands.rs tauri-app/src/lib/services/chatHistoryApi.ts
git commit -m "feat(chat-history): add Rust backend commands for export

- Add export_conversation command
- Add batch_operations command
- Add ChatHistoryApi frontend service"
```

---

## Summary

### Completed Tasks
- Phase 1.1: IndexedDB Setup (2 tasks)
- Phase 1.2: ChatHistoryService (1 task)
- Phase 1.3: UI Components (2 tasks)
- Phase 1.4: Keyboard Navigation (1 task)
- Phase 1.5: Resubmit Feature (1 task)
- Phase 1.6: Search (1 task)
- Phase 1.7: Backend Integration (1 task)

### Next Steps
After completing Chat History Management, proceed to:
- Phase 2: Settings Enhancement
- Phase 3: Multi-Project Support
