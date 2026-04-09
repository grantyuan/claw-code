import { describe, it, expect } from 'vitest';

describe('Type Definitions', () => {
  it('should export Agent types', async () => {
    const mod = await import('../../src/lib/types/agent');
    expect(mod.AgentStatus).toBeDefined();
    expect(mod.AgentRole).toBeDefined();
  });

  it('should export Task types', async () => {
    const mod = await import('../../src/lib/types/task');
    expect(mod.TaskStatus).toBeDefined();
    expect(mod.TaskPriority).toBeDefined();
  });

  it('should export Connection types', async () => {
    const mod = await import('../../src/lib/types/connection');
    expect(mod.ConnectionStatus).toBeDefined();
  });

  it('should export Message types', async () => {
    const mod = await import('../../src/lib/types/message');
    expect(mod.MessageType).toBeDefined();
  });

  it('should have correct AgentStatus values', async () => {
    const { AgentStatus } = await import('../../src/lib/types/agent');
    expect(AgentStatus.Active).toBe('active');
    expect(AgentStatus.Thinking).toBe('thinking');
    expect(AgentStatus.Idle).toBe('idle');
    expect(AgentStatus.Error).toBe('error');
    expect(AgentStatus.Offline).toBe('offline');
  });

  it('should have correct TaskStatus values', async () => {
    const { TaskStatus } = await import('../../src/lib/types/task');
    expect(TaskStatus.Pending).toBe('pending');
    expect(TaskStatus.Running).toBe('running');
    expect(TaskStatus.Completed).toBe('completed');
    expect(TaskStatus.Failed).toBe('failed');
    expect(TaskStatus.Cancelled).toBe('cancelled');
  });

  it('should have correct ConnectionStatus values', async () => {
    const { ConnectionStatus } = await import('../../src/lib/types/connection');
    expect(ConnectionStatus.Connected).toBe('connected');
    expect(ConnectionStatus.Connecting).toBe('connecting');
    expect(ConnectionStatus.Disconnected).toBe('disconnected');
  });
});
