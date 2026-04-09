<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    status: 'active' | 'thinking' | 'idle' | 'error' | 'offline' | 'connected' | 'connecting' | 'disconnected' | 'reconnecting';
    label?: string;
    children?: Snippet;
  }

  let { status, label, children }: Props = $props();

  const statusClasses: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    thinking: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    idle: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    offline: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    connected: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    connecting: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    disconnected: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    reconnecting: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  };

  const dotClasses: Record<string, string> = {
    active: 'bg-green-500',
    thinking: 'bg-yellow-500 animate-pulse',
    idle: 'bg-blue-500',
    error: 'bg-red-500',
    offline: 'bg-gray-500',
    connected: 'bg-green-500',
    connecting: 'bg-yellow-500 animate-pulse',
    disconnected: 'bg-gray-500',
    reconnecting: 'bg-yellow-500 animate-pulse',
  };
</script>

<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium {statusClasses[status]}">
  <span class="w-1.5 h-1.5 rounded-full {dotClasses[status]}"></span>
  {#if children}
    {@render children()}
  {:else if label}
    {label}
  {:else}
    {status}
  {/if}
</span>
