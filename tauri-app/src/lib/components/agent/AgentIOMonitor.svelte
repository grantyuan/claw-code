<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { listen } from '@tauri-apps/api/event';

  interface Props {
    agentId: string;
    onClose: () => void;
  }

  let { agentId, onClose }: Props = $props();

  interface AgentIOEvent {
    agentId: string;
    type: 'input' | 'output' | 'error' | 'tool_call' | 'tool_result';
    content: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
  }

  let events = $state<AgentIOEvent[]>([]);
  let unlisten: (() => void) | null = null;
  let autoScroll = $state(true);
  let containerRef: HTMLDivElement | null = null;

  onMount(async () => {
    unlisten = await listen<AgentIOEvent>('agent-io', (event) => {
      if (event.payload.agentId === agentId) {
        events = [...events, event.payload];
        
        if (autoScroll && containerRef) {
          setTimeout(() => {
            containerRef?.scrollTo({
              top: containerRef.scrollHeight,
              behavior: 'smooth'
            });
          }, 10);
        }
      }
    });
  });

  onDestroy(() => {
    if (unlisten) {
      unlisten();
    }
  });

  function getEventIcon(type: string): string {
    switch (type) {
      case 'input': return '📥';
      case 'output': return '📤';
      case 'error': return '❌';
      case 'tool_call': return '🔧';
      case 'tool_result': return '📋';
      default: return '•';
    }
  }

  function getEventColor(type: string): string {
    switch (type) {
      case 'input': return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
      case 'output': return 'border-green-500 bg-green-50 dark:bg-green-900/20';
      case 'error': return 'border-red-500 bg-red-50 dark:bg-red-900/20';
      case 'tool_call': return 'border-purple-500 bg-purple-50 dark:bg-purple-900/20';
      case 'tool_result': return 'border-orange-500 bg-orange-50 dark:bg-orange-900/20';
      default: return 'border-gray-500 bg-gray-50 dark:bg-gray-900/20';
    }
  }

  function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  function formatContent(content: string): string {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  }

  function clearEvents() {
    events = [];
  }

  function toggleAutoScroll() {
    autoScroll = !autoScroll;
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true">
  <div class="w-full max-w-4xl max-h-[85vh] rounded-xl shadow-2xl overflow-hidden flex flex-col" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
    <div class="px-6 py-4 border-b flex items-center justify-between" style="border-color: var(--color-border);">
      <div class="flex items-center gap-3">
        <h2 class="text-lg font-semibold" style="color: var(--color-text);">Agent I/O Monitor</h2>
        <span class="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800" style="color: var(--color-text);">Agent: {agentId}</span>
      </div>
      <div class="flex items-center gap-2">
        <button 
          class="p-1 rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 text-sm"
          onclick={toggleAutoScroll}
          title={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
        >
          {autoScroll ? '📜 Auto-scroll ON' : '📜 Auto-scroll OFF'}
        </button>
        <button 
          class="p-1 rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 text-sm"
          onclick={clearEvents}
          title="Clear events"
        >
          🗑️ Clear
        </button>
        <button 
          class="p-1 rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-700" 
          onclick={onClose}
          aria-label="Close agent I/O monitor"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4" bind:this={containerRef}>
      {#if events.length === 0}
        <div class="flex flex-col items-center justify-center h-32">
          <p class="text-sm" style="color: var(--color-text);">No I/O events recorded yet...</p>
          <p class="text-xs mt-1 text-gray-400">Events will appear here as the agent processes tasks</p>
        </div>
      {:else}
        <div class="space-y-2">
          {#each events as event, i}
            <div class="border-l-4 rounded-r-lg p-3 {getEventColor(event.type)}">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span class="text-lg">{getEventIcon(event.type)}</span>
                  <span class="font-medium text-sm capitalize">{event.type.replace('_', ' ')}</span>
                </div>
                <span class="text-xs text-gray-400">{formatTimestamp(event.timestamp)}</span>
              </div>
              <pre class="text-xs overflow-x-auto whitespace-pre-wrap break-words" style="color: var(--color-text);">{formatContent(event.content)}</pre>
              {#if event.metadata}
                <div class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <details class="text-xs">
                    <summary class="cursor-pointer text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Metadata</summary>
                    <pre class="mt-1 text-xs overflow-x-auto">{JSON.stringify(event.metadata, null, 2)}</pre>
                  </details>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="px-6 py-3 border-t flex items-center justify-between" style="border-color: var(--color-border);">
      <div class="text-xs text-gray-400">
        {events.length} event(s) recorded
      </div>
      <button 
        class="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors text-sm"
        onclick={onClose}
      >
        Close
      </button>
    </div>
  </div>
</div>
