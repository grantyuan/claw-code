import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import AgentIOMonitor from '$lib/components/agent/AgentIOMonitor.svelte';

describe('AgentIOMonitor Component', () => {
  it('renders agent I/O monitor dialog', () => {
    const onClose = vi.fn();
    const { container } = render(AgentIOMonitor, {
      props: {
        agentId: 'test-agent',
        onClose,
      },
    });

    expect(container).toBeTruthy();
  });

  it('displays agent I/O title', () => {
    const onClose = vi.fn();
    const { getByText } = render(AgentIOMonitor, {
      props: {
        agentId: 'test-agent',
        onClose,
      },
    });

    expect(getByText('Agent I/O Monitor')).toBeTruthy();
  });

  it('displays agent ID', () => {
    const onClose = vi.fn();
    const { getByText } = render(AgentIOMonitor, {
      props: {
        agentId: 'test-agent-123',
        onClose,
      },
    });

    expect(getByText(/test-agent-123/)).toBeTruthy();
  });
});
