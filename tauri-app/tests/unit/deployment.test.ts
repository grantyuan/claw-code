import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import DeploymentProgress from '$lib/components/deployment/DeploymentProgress.svelte';

describe('DeploymentProgress Component', () => {
  it('renders deployment progress dialog', () => {
    const onClose = vi.fn();
    const { container } = render(DeploymentProgress, {
      props: {
        deploymentId: 'test-deployment',
        onClose,
      },
    });

    expect(container).toBeTruthy();
  });

  it('displays deployment title', () => {
    const onClose = vi.fn();
    const { getByText } = render(DeploymentProgress, {
      props: {
        deploymentId: 'test-deployment',
        onClose,
      },
    });

    expect(getByText('Remote Deployment Progress')).toBeTruthy();
  });
});
