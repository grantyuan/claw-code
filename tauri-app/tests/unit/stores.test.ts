import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';

describe('Svelte Stores', () => {
  it('should create uiStore with theme state', async () => {
    const { uiStore } = await import('../../src/lib/stores/uiStore');
    const state = get(uiStore);
    expect(state).toHaveProperty('theme');
    expect(state).toHaveProperty('actualTheme');
    expect(state).toHaveProperty('panelLayout');
  });

  it('should create connectionStore with connection state', async () => {
    const { connectionStore } = await import('../../src/lib/stores/connectionStore');
    const state = get(connectionStore);
    expect(state).toHaveProperty('connections');
    expect(state).toHaveProperty('activeConnection');
  });

  it('should create chatStore with conversation state', async () => {
    const { chatStore } = await import('../../src/lib/stores/chatStore');
    const state = get(chatStore);
    expect(state).toHaveProperty('conversations');
    expect(state).toHaveProperty('activeConversation');
  });

  it('should create agentStore with agent state', async () => {
    const { agentStore } = await import('../../src/lib/stores/agentStore');
    const state = get(agentStore);
    expect(state).toHaveProperty('agents');
    expect(state).toHaveProperty('leaderAgent');
  });

  it('should create taskStore with task state', async () => {
    const { taskStore } = await import('../../src/lib/stores/taskStore');
    const state = get(taskStore);
    expect(state).toHaveProperty('tasks');
    expect(state).toHaveProperty('activeTasks');
  });

  it('should create configStore with configuration state', async () => {
    const { configStore } = await import('../../src/lib/stores/configStore');
    const state = get(configStore);
    expect(state).toHaveProperty('config');
    expect(state).toHaveProperty('isDirty');
  });
});

describe('AgentStore Operations', () => {
  it('should add and retrieve agents', async () => {
    const { agentStore } = await import('../../src/lib/stores/agentStore');
    const { AgentRole, AgentStatus } = await import('../../src/lib/types/agent');
    
    agentStore.addAgent({
      id: 'test-agent-1',
      name: 'Test Agent',
      role: AgentRole.Coder,
      status: AgentStatus.Idle,
      model: 'test-model',
      progress: 0,
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        averageResponseTime: 0,
        totalTokensUsed: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const state = get(agentStore);
    expect(state.agents.has('test-agent-1')).toBe(true);
    
    agentStore.reset();
  });

  it('should update agent status', async () => {
    const { agentStore } = await import('../../src/lib/stores/agentStore');
    const { AgentRole, AgentStatus } = await import('../../src/lib/types/agent');
    
    agentStore.addAgent({
      id: 'test-agent-2',
      name: 'Test Agent 2',
      role: AgentRole.Coder,
      status: AgentStatus.Idle,
      model: 'test-model',
      progress: 0,
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        averageResponseTime: 0,
        totalTokensUsed: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    agentStore.updateAgentStatus({
      agentId: 'test-agent-2',
      status: AgentStatus.Active,
      timestamp: new Date(),
    });

    const state = get(agentStore);
    const agent = state.agents.get('test-agent-2');
    expect(agent?.status).toBe(AgentStatus.Active);
    
    agentStore.reset();
  });
});

describe('TaskStore Operations', () => {
  it('should add and categorize tasks', async () => {
    const { taskStore } = await import('../../src/lib/stores/taskStore');
    const { TaskStatus, TaskPriority } = await import('../../src/lib/types/task');
    
    taskStore.addTask({
      id: 'test-task-1',
      name: 'Test Task',
      description: 'A test task',
      status: TaskStatus.Pending,
      priority: TaskPriority.Medium,
      progress: 0,
      dependencies: [],
      createdAt: new Date(),
    });

    const state = get(taskStore);
    expect(state.tasks.has('test-task-1')).toBe(true);
    expect(state.pendingTasks).toContain('test-task-1');
    
    taskStore.reset();
  });

  it('should update task progress', async () => {
    const { taskStore } = await import('../../src/lib/stores/taskStore');
    const { TaskStatus, TaskPriority } = await import('../../src/lib/types/task');
    
    taskStore.addTask({
      id: 'test-task-2',
      name: 'Test Task 2',
      description: 'Another test task',
      status: TaskStatus.Running,
      priority: TaskPriority.High,
      progress: 0,
      dependencies: [],
      createdAt: new Date(),
    });

    taskStore.updateTask({
      taskId: 'test-task-2',
      progress: 50,
      timestamp: new Date(),
    });

    const state = get(taskStore);
    const task = state.tasks.get('test-task-2');
    expect(task?.progress).toBe(50);
    
    taskStore.reset();
  });
});

describe('ChatStore Operations', () => {
  it('should create conversations', async () => {
    const { chatStore } = await import('../../src/lib/stores/chatStore');
    
    chatStore.createConversation('conv-1', 'agent-1', 'Test Conversation');
    
    const state = get(chatStore);
    expect(state.conversations.has('conv-1')).toBe(true);
    expect(state.activeConversation).toBe('conv-1');
    
    chatStore.reset();
  });

  it('should send messages', async () => {
    const { chatStore } = await import('../../src/lib/stores/chatStore');
    
    chatStore.createConversation('conv-2', 'agent-1');
    chatStore.sendMessage('conv-2', 'Hello, world!');
    
    const state = get(chatStore);
    const conversation = state.conversations.get('conv-2');
    expect(conversation?.messages.length).toBe(1);
    expect(conversation?.messages[0].content).toBe('Hello, world!');
    
    chatStore.reset();
  });
});
