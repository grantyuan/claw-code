<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { listen } from '@tauri-apps/api/event';

  interface Props {
    deploymentId: string;
    onClose: () => void;
  }

  let { deploymentId, onClose }: Props = $props();

  interface DeploymentProgress {
    step: number;
    name: string;
    status: 'Pending' | 'InProgress' | 'Completed' | 'Failed';
    message: string;
    timestamp: number;
  }

  let progress = $state<DeploymentProgress[]>([]);
  let isComplete = $state(false);
  let hasError = $state(false);
  let unlisten: (() => void) | null = null;

  onMount(async () => {
    unlisten = await listen<DeploymentProgress>('deployment-progress', (event) => {
      progress = [...progress, event.payload];
      
      if (event.payload.status === 'Failed') {
        hasError = true;
      }
      
      if (event.payload.status === 'Completed' && event.payload.name.includes('Verify')) {
        isComplete = true;
      }
    });
  });

  onDestroy(() => {
    if (unlisten) {
      unlisten();
    }
  });

  function getStatusIcon(status: string): string {
    switch (status) {
      case 'Pending': return '⏳';
      case 'InProgress': return '🔄';
      case 'Completed': return '✅';
      case 'Failed': return '❌';
      default: return '•';
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'Pending': return 'text-gray-400';
      case 'InProgress': return 'text-blue-500';
      case 'Completed': return 'text-green-500';
      case 'Failed': return 'text-red-500';
      default: return 'text-gray-400';
    }
  }

  function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true">
  <div class="w-full max-w-3xl max-h-[80vh] rounded-xl shadow-2xl overflow-hidden flex flex-col" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
    <div class="px-6 py-4 border-b flex items-center justify-between" style="border-color: var(--color-border);">
      <div class="flex items-center gap-3">
        <h2 class="text-lg font-semibold" style="color: var(--color-text);">Remote Deployment Progress</h2>
        {#if isComplete && !hasError}
          <span class="px-2 py-1 rounded text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">Completed</span>
        {:else if hasError}
          <span class="px-2 py-1 rounded text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">Failed</span>
        {:else}
          <span class="px-2 py-1 rounded text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">In Progress</span>
        {/if}
      </div>
      <button 
        class="p-1 rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-700" 
        onclick={onClose}
        aria-label="Close deployment progress"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-6">
      {#if progress.length === 0}
        <div class="flex flex-col items-center justify-center h-32">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p class="mt-3 text-sm" style="color: var(--color-text);">Initializing deployment...</p>
        </div>
      {:else}
        <div class="space-y-3">
          {#each progress as step, i}
            <div class="flex items-start gap-3 p-3 rounded-lg border" style="border-color: var(--color-border); background-color: var(--color-background);">
              <span class="text-xl">{getStatusIcon(step.status)}</span>
              <div class="flex-1">
                <div class="flex items-center justify-between">
                  <h4 class="font-medium {getStatusColor(step.status)}">{step.name}</h4>
                  <span class="text-xs text-gray-400">{formatTimestamp(step.timestamp)}</span>
                </div>
                <p class="text-sm mt-1" style="color: var(--color-text);">{step.message}</p>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="px-6 py-4 border-t flex justify-end gap-3" style="border-color: var(--color-border);">
      {#if isComplete || hasError}
        <button 
          class="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
          onclick={onClose}
        >
          Close
        </button>
      {:else}
        <button 
          class="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors"
          onclick={onClose}
        >
          Cancel
        </button>
      {/if}
    </div>
  </div>
</div>
