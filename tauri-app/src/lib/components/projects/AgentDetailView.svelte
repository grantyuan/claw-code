<script lang="ts">
  import { projectService } from '$services/projectService';
  import type { Session, SessionLog } from '$types/project';

  interface Props {
    session: Session;
    onBack: () => void;
  }

  let { session, onBack }: Props = $props();

  let logs = $state<SessionLog[]>([]);
  let filterLevel = $state<SessionLog['level'] | 'all'>('all');
  let isLoading = $state(true);

  $effect(() => {
    loadLogs();
  });

  async function loadLogs() {
    isLoading = true;
    try {
      logs = await projectService.getSessionLogs(session.id);
    } catch (e) {
      console.error('Failed to load logs:', e);
    } finally {
      isLoading = false;
    }
  }

  function filteredLogs(): SessionLog[] {
    if (filterLevel === 'all') return logs;
    return logs.filter(l => l.level === filterLevel);
  }

  function getLevelColor(level: SessionLog['level']): string {
    switch (level) {
      case 'info': return 'text-blue-500';
      case 'warning': return 'text-yellow-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-500';
    }
  }

  function getSourceIcon(source: SessionLog['source']): string {
    switch (source) {
      case 'agent': return '🤖';
      case 'llm': return '🧠';
      case 'system': return '⚙️';
      default: return '📝';
    }
  }

  function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  async function exportLogs() {
    const content = logs
      .map(l => `[${formatTimestamp(l.timestamp)}] [${l.level.toUpperCase()}] [${l.source}] ${l.message}`)
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${session.id}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="flex flex-col h-full" style="background-color: var(--color-surface);">
  <div class="px-4 py-3 border-b flex items-center justify-between" style="border-color: var(--color-border);">
    <div class="flex items-center gap-3">
      <button
        class="p-1 rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
        onclick={onBack}
        aria-label="Go back"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div>
        <h3 class="font-medium" style="color: var(--color-text);">{session.title}</h3>
        <p class="text-xs" style="color: var(--color-text-secondary);">
          Session {session.id.slice(0, 8)}... • {session.status}
        </p>
      </div>
    </div>
    <Button variant="secondary" size="sm" onclick={exportLogs}>
      Export Logs
    </Button>
  </div>

  <div class="px-4 py-2 border-b flex items-center gap-4" style="border-color: var(--color-border);">
    <span class="text-sm" style="color: var(--color-text-secondary);">Filter:</span>
    <div class="flex gap-1">
      {#each ['all', 'info', 'warning', 'error'] as level}
        <button
          class="px-3 py-1 rounded text-xs font-medium transition-colors {filterLevel === level ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}"
          style="color: var(--color-text);"
          onclick={() => filterLevel = level as any}
        >
          {level === 'all' ? 'All' : level.charAt(0).toUpperCase() + level.slice(1)}
        </button>
      {/each}
    </div>
    <span class="text-xs" style="color: var(--color-text-secondary);">
      {filteredLogs().length} / {logs.length} logs
    </span>
  </div>

  <div class="flex-1 overflow-y-auto">
    {#if isLoading}
      <div class="flex items-center justify-center h-full">
        <div class="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full"></div>
      </div>
    {:else if filteredLogs().length === 0}
      <div class="flex flex-col items-center justify-center h-full">
        <svg class="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p class="text-sm" style="color: var(--color-text-secondary);">No logs available</p>
      </div>
    {:else}
      <div class="p-4 space-y-2">
        {#each filteredLogs() as log (log.id)}
          <div class="flex gap-3 p-2 rounded {log.level === 'error' ? 'bg-red-50 dark:bg-red-900/20' : log.level === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}">
            <span class="text-lg">{getSourceIcon(log.source)}</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs font-mono {getLevelColor(log.level)}">{log.level.toUpperCase()}</span>
                <span class="text-xs" style="color: var(--color-text-secondary);">{formatTimestamp(log.timestamp)}</span>
              </div>
              <p class="text-sm whitespace-pre-wrap" style="color: var(--color-text);">{log.message}</p>
              {#if log.details}
                <details class="mt-2">
                  <summary class="text-xs cursor-pointer" style="color: var(--color-text-secondary);">Details</summary>
                  <pre class="mt-1 p-2 rounded text-xs overflow-x-auto" style="background-color: var(--color-bg); color: var(--color-text);">{JSON.stringify(log.details, null, 2)}</pre>
                </details>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
