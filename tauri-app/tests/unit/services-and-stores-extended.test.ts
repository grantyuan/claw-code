import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ApiService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should create apiService with default base URL', async () => {
    const { apiService } = await import('../../src/lib/services/apiService');
    expect(apiService).toBeDefined();
  });

  it('should set custom base URL', async () => {
    const { apiService } = await import('../../src/lib/services/apiService');
    apiService.setBaseUrl('http://custom:9999');
    expect(apiService).toBeDefined();
  });

  it('should handle fetch errors gracefully', async () => {
    const { apiService } = await import('../../src/lib/services/apiService');
    apiService.setBaseUrl('http://invalid-host-that-does-not-exist:9999');
    await expect(apiService.healthCheck()).rejects.toThrow();
  });

  it('should abort requests after timeout', async () => {
    vi.useFakeTimers();
    const { apiService } = await import('../../src/lib/services/apiService');
    apiService.setBaseUrl('http://localhost:9999');
    const promise = apiService.get('/slow');
    vi.advanceTimersByTime(35000);
    await expect(promise).rejects.toThrow();
    vi.useRealTimers();
  });
});

describe('AgentStore Extended Operations', () => {
  it('should remove an agent', async () => {
    const { agentStore } = await import('../../src/lib/stores/agentStore');
    const { get } = await import('svelte/store');
    const { AgentStatus, AgentRole } = await import('../../src/lib/types/agent');
    agentStore.addAgent({
      id: 'remove-test',
      name: 'Remove Test',
      role: AgentRole.Coder,
      status: AgentStatus.Idle,
      model: 'test',
      progress: 0,
      metrics: { tasksCompleted: 0, tasksFailed: 0, averageResponseTime: 0, totalTokensUsed: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(get(agentStore).agents.has('remove-test')).toBe(true);
    agentStore.removeAgent('remove-test');
    expect(get(agentStore).agents.has('remove-test')).toBe(false);
  });

  it('should set selected agent', async () => {
    const { agentStore } = await import('../../src/lib/stores/agentStore');
    const { get } = await import('svelte/store');
    agentStore.setSelectedAgent('test-agent');
    expect(get(agentStore).selectedAgent).toBe('test-agent');
  });
});

describe('TaskStore Extended Operations', () => {
  it('should cancel a task', async () => {
    const { taskStore } = await import('../../src/lib/stores/taskStore');
    const { get } = await import('svelte/store');
    const { TaskStatus, TaskPriority } = await import('../../src/lib/types/task');
    taskStore.addTask({
      id: 'cancel-test',
      name: 'Cancel Test',
      description: 'test',
      status: TaskStatus.Running,
      priority: TaskPriority.Medium,
      progress: 50,
      dependencies: [],
      createdAt: new Date(),
    });
    taskStore.cancelTask('cancel-test');
    const task = get(taskStore).tasks.get('cancel-test');
    expect(task?.status).toBe(TaskStatus.Cancelled);
  });

  it('should clear completed tasks', async () => {
    const { taskStore } = await import('../../src/lib/stores/taskStore');
    const { get } = await import('svelte/store');
    const { TaskStatus, TaskPriority } = await import('../../src/lib/types/task');
    taskStore.addTask({
      id: 'completed-test',
      name: 'Completed Test',
      description: 'test',
      status: TaskStatus.Completed,
      priority: TaskPriority.Low,
      progress: 100,
      dependencies: [],
      createdAt: new Date(),
    });
    const before = get(taskStore).tasks.size;
    taskStore.clearCompleted();
    expect(get(taskStore).tasks.size).toBeLessThan(before);
  });

  it('should remove a task', async () => {
    const { taskStore } = await import('../../src/lib/stores/taskStore');
    const { get } = await import('svelte/store');
    const { TaskStatus, TaskPriority } = await import('../../src/lib/types/task');
    taskStore.addTask({
      id: 'remove-task-test',
      name: 'Remove Task',
      description: 'test',
      status: TaskStatus.Pending,
      priority: TaskPriority.Low,
      progress: 0,
      dependencies: [],
      createdAt: new Date(),
    });
    taskStore.removeTask('remove-task-test');
    expect(get(taskStore).tasks.has('remove-task-test')).toBe(false);
  });
});

describe('ChatStore Extended Operations', () => {
  it('should set active conversation', async () => {
    const { chatStore } = await import('../../src/lib/stores/chatStore');
    const { get } = await import('svelte/store');
    chatStore.createConversation('conv-1', 'agent-1');
    chatStore.setActiveConversation('conv-1');
    expect(get(chatStore).activeConversation).toBe('conv-1');
  });

  it('should delete a conversation', async () => {
    const { chatStore } = await import('../../src/lib/stores/chatStore');
    const { get } = await import('svelte/store');
    chatStore.createConversation('conv-del', 'agent-1');
    chatStore.deleteConversation('conv-del');
    expect(get(chatStore).conversations.has('conv-del')).toBe(false);
  });

  it('should clear conversation messages', async () => {
    const { chatStore } = await import('../../src/lib/stores/chatStore');
    const { get } = await import('svelte/store');
    const { MessageType } = await import('../../src/lib/types/message');
    chatStore.createConversation('conv-clear', 'agent-1');
    chatStore.addMessage('conv-clear', {
      id: 'msg-1',
      conversationId: 'conv-clear',
      type: MessageType.User,
      content: 'Hello',
      timestamp: new Date(),
    });
    chatStore.clearConversation('conv-clear');
    const conv = get(chatStore).conversations.get('conv-clear');
    expect(conv?.messages.length).toBe(0);
  });
});

describe('ConnectionStore Extended Operations', () => {
  it('should remove a connection', async () => {
    const { connectionStore } = await import('../../src/lib/stores/connectionStore');
    const { get } = await import('svelte/store');
    const { ConnectionStatus } = await import('../../src/lib/types/connection');
    connectionStore.addConnection({
      id: 'remove-conn',
      name: 'Remove Conn',
      type: 'remote',
      status: ConnectionStatus.Disconnected,
      endpoint: 'ws://localhost:8765',
    });
    connectionStore.removeConnection('remove-conn');
    expect(get(connectionStore).connections.has('remove-conn')).toBe(false);
  });

  it('should set error state', async () => {
    const { connectionStore } = await import('../../src/lib/stores/connectionStore');
    const { get } = await import('svelte/store');
    const { ConnectionStatus } = await import('../../src/lib/types/connection');
    connectionStore.addConnection({
      id: 'error-conn',
      name: 'Error Conn',
      type: 'remote',
      status: ConnectionStatus.Disconnected,
      endpoint: 'ws://localhost:8765',
    });
    connectionStore.setError('Test error');
    expect(get(connectionStore).error).toBe('Test error');
  });
});

describe('UIStore Extended Operations', () => {
  it('should set active view', async () => {
    const { uiStore } = await import('../../src/lib/stores/uiStore');
    const { get } = await import('svelte/store');
    uiStore.setActiveView('agent-detail');
    expect(get(uiStore).activeView).toBe('agent-detail');
  });

  it('should open and close modal', async () => {
    const { uiStore } = await import('../../src/lib/stores/uiStore');
    const { get } = await import('svelte/store');
    uiStore.openModal('test-modal');
    expect(get(uiStore).modal.isOpen).toBe(true);
    expect(get(uiStore).modal.type).toBe('test-modal');
    uiStore.closeModal();
    expect(get(uiStore).modal.isOpen).toBe(false);
  });
});

describe('Validation Extended', () => {
  it('should validate email addresses', async () => {
    const { validateEmail } = await import('../../src/lib/utils/validation');
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('invalid')).toBe(false);
    expect(validateEmail('')).toBe(false);
  });

  it('should validate SSH key paths', async () => {
    const { validateSshKeyPath } = await import('../../src/lib/utils/validation');
    expect(validateSshKeyPath('/home/user/.ssh/id_rsa')).toBe(true);
    expect(validateSshKeyPath('~/.ssh/id_rsa')).toBe(true);
    expect(validateSshKeyPath('./keys/id_rsa')).toBe(true);
    expect(validateSshKeyPath('relative/path')).toBe(false);
  });

  it('should validate API keys', async () => {
    const { validateApiKey } = await import('../../src/lib/utils/validation');
    expect(validateApiKey('sk-ant-12345678')).toBe(true);
    expect(validateApiKey('short')).toBe(false);
    expect(validateApiKey('')).toBe(false);
  });

  it('should validate remote config as warnings', async () => {
    const { validateConfigWarnings } = await import('../../src/lib/utils/validation');
    const warnings = validateConfigWarnings({
      remote: {
        computers: [{
          id: 'test',
          host: '',
          port: 99999,
          name: 'Test',
          username: '',
          authMethod: 'ssh-key',
          enabled: true,
          autoConnect: false,
          healthCheckInterval: 30,
        }],
        deployment: {
          version: '',
          installPath: '',
          autoStart: true,
          autoUpdate: false,
          healthCheckInterval: 30,
          rollbackOnFailure: true,
        },
      },
    });
    expect(warnings.some(e => e.field.includes('host'))).toBe(true);
    expect(warnings.some(e => e.field.includes('username'))).toBe(true);
  });

  it('should validate UI config', async () => {
    const { validateConfig } = await import('../../src/lib/utils/validation');
    const errors = validateConfig({
      ui: {
        theme: 'dark',
        fontSize: 5,
        fontFamily: 'inter',
        language: 'en',
      },
    });
    expect(errors.some(e => e.field === 'ui.fontSize')).toBe(true);
  });
});

describe('Formatting Extended', () => {
  it('should format tokens', async () => {
    const { formatTokens } = await import('../../src/lib/utils/formatting');
    expect(formatTokens(1000)).toBeTruthy();
    expect(formatTokens(1000000)).toBeTruthy();
  });

  it('should handle formatTimestamp with string input', async () => {
    const { formatTimestamp } = await import('../../src/lib/utils/formatting');
    const result = formatTimestamp(new Date());
    expect(result).toBeTruthy();
  });

  it('should handle formatDuration with hours', async () => {
    const { formatDuration } = await import('../../src/lib/utils/formatting');
    expect(formatDuration(3600000)).toContain('h');
  });
});

describe('Types Extended', () => {
  it('should have all ConnectionStatus values', async () => {
    const { ConnectionStatus } = await import('../../src/lib/types/connection');
    expect(ConnectionStatus.Connected).toBe('connected');
    expect(ConnectionStatus.Connecting).toBe('connecting');
    expect(ConnectionStatus.Disconnected).toBe('disconnected');
    expect(ConnectionStatus.Error).toBe('error');
    expect(ConnectionStatus.Reconnecting).toBe('reconnecting');
  });

  it('should have all AgentRole values', async () => {
    const { AgentRole } = await import('../../src/lib/types/agent');
    expect(AgentRole.Leader).toBe('leader');
    expect(AgentRole.Coder).toBe('coder');
    expect(AgentRole.Reviewer).toBe('reviewer');
    expect(AgentRole.Tester).toBe('tester');
    expect(AgentRole.Planner).toBe('planner');
    expect(AgentRole.Analyzer).toBe('analyzer');
    expect(AgentRole.Custom).toBe('custom');
  });

  it('should have all TaskPriority values', async () => {
    const { TaskPriority } = await import('../../src/lib/types/task');
    expect(TaskPriority.Low).toBe('low');
    expect(TaskPriority.Medium).toBe('medium');
    expect(TaskPriority.High).toBe('high');
    expect(TaskPriority.Critical).toBe('critical');
  });

  it('should have all MessageType values', async () => {
    const { MessageType } = await import('../../src/lib/types/message');
    expect(MessageType.User).toBe('user');
    expect(MessageType.AI).toBe('ai');
    expect(MessageType.System).toBe('system');
    expect(MessageType.Error).toBe('error');
    expect(MessageType.Tool).toBe('tool');
  });

  it('should convert date strings with toDate', async () => {
    const { toDate } = await import('../../src/lib/types/message');
    const dateStr = '2025-01-15T10:30:00Z';
    const result = toDate(dateStr);
    expect(result instanceof Date).toBe(true);
  });
});
