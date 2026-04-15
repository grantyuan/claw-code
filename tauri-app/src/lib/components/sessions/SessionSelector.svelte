<script lang="ts">
  import { sessionStore, activeSession } from '$stores/sessionStore';
  import { apiService } from '$services/apiService';
  import type { Session } from '$types/session';
  import NewSessionDialog from './NewSessionDialog.svelte';
  import SessionContextMenu from './SessionContextMenu.svelte';

  interface Props {
    onSessionChange?: (sessionId: string) => void;
  }

  let { onSessionChange }: Props = $props();

  let showSessionList = $state(false);
  let showNewDialog = $state(false);
  let contextMenu = $state<{ session: Session; x: number; y: number } | null>(null);

  let sessions = $derived($sessionStore.sessions.filter(s => !s.isArchived));
  let archivedSessions = $derived($sessionStore.sessions.filter(s => s.isArchived));
  let current = $derived($activeSession);
  let isLoading = $derived($sessionStore.isLoading);

  async function loadSessions() {
    try {
      sessionStore.setLoading(true);
      const response = await apiService.listSessions();
      sessionStore.setSessions(response.sessions || []);
    } catch (e) {
      console.error('Failed to load sessions:', e);
    } finally {
      sessionStore.setLoading(false);
    }
  }

  async function switchToSession(sessionId: string) {
    try {
      await apiService.switchSession(sessionId);
      sessionStore.setActiveSession(sessionId);
      showSessionList = false;
      onSessionChange?.(sessionId);
    } catch (e) {
      console.error('Failed to switch session:', e);
    }
  }

  async function handleDeleteSession(sessionId: string) {
    if (confirm('Are you sure you want to delete this session?')) {
      try {
        await apiService.deleteSession(sessionId);
        sessionStore.removeSession(sessionId);
      } catch (err) {
        console.error('Failed to delete session:', err);
      }
    }
  }

  function handleToggleArchive(sessionId: string) {
    const session = $sessionStore.sessions.find(s => s.id === sessionId);
    if (session) {
      sessionStore.updateSession(sessionId, { isArchived: !session.isArchived });
    }
  }

  function handleContextMenu(e: MouseEvent, session: Session) {
    e.preventDefault();
    e.stopPropagation();
    contextMenu = { session, x: e.clientX, y: e.clientY };
  }

  function handleRename(sessionId: string) {
    const newName = prompt('Enter new session name:');
    if (newName?.trim()) {
      sessionStore.updateSession(sessionId, { name: newName.trim() });
    }
  }

  function handleClick() {
    showSessionList = !showSessionList;
    contextMenu = null;
    if (showSessionList) {
      loadSessions();
    }
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.session-selector')) {
      showSessionList = false;
      contextMenu = null;
    }
  }

  $effect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });

  function getStatusColor(status?: string): string {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'running': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 3600);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  }
</script>

<div class="session-selector relative">
  <button
    class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
    style="background-color: var(--color-border); color: var(--color-text);"
    onclick={handleClick}
  >
    <span class="w-2 h-2 rounded-full {getStatusColor(current?.status)}"></span>
    <span class="max-w-[150px] truncate">{current?.name || 'Select Session'}</span>
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </button>

  <button
    class="p-1.5 rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
    style="color: var(--color-text);"
    onclick={() => (showNewDialog = true)}
    title="New Session"
  >
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
    </svg>
  </button>

  {#if showNewDialog}
    <NewSessionDialog
      isOpen={showNewDialog}
      onClose={() => (showNewDialog = false)}
      onSessionCreated={(id) => {
        switchToSession(id);
        showNewDialog = false;
      }}
    />
  {/if}

  {#if contextMenu}
    <SessionContextMenu
      session={contextMenu.session}
      x={contextMenu.x}
      y={contextMenu.y}
      onRename={handleRename}
      onClose={() => (contextMenu = null)}
    />
  {/if}

  {#if showSessionList}
    <div
      class="absolute top-full left-0 mt-1 w-72 rounded-lg shadow-lg z-50"
      style="background-color: var(--color-surface); border: 1px solid var(--color-border);"
    >
      <div class="p-3 border-b flex items-center justify-between" style="border-color: var(--color-border);">
        <span class="text-xs font-medium" style="color: var(--color-text);">
          Sessions ({sessions.length} active, {archivedSessions.length} archived)
        </span>
        <button
          class="text-xs px-2 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          style="color: var(--color-text-secondary);"
          onclick={() => {}}
        >
          Filter
        </button>
      </div>

      <div class="max-h-80 overflow-y-auto scrollbar-thin">
        {#if isLoading}
          <div class="p-6 text-center">
            <div class="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <span class="text-sm" style="color: var(--color-text-secondary);">Loading...</span>
          </div>
        {:else if sessions.length === 0 && archivedSessions.length === 0}
          <div class="p-6 text-center">
            <svg class="w-10 h-10 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
            <p class="text-sm mb-2" style="color: var(--color-text-secondary);">No sessions yet</p>
            <button
              class="px-4 py-2 rounded-lg text-sm text-white"
              style="background-color: var(--color-primary);"
              onclick={() => (showNewDialog = true)}
            >
              Create first session
            </button>
          </div>
        {:else}
          {#each sessions as session (session.id)}
            {@const isActive = session.id === current?.id}
            <div
              class="group w-full flex flex-col px-3 py-2.5 text-left transition-colors cursor-pointer {isActive ? 'bg-primary-50 dark:bg-primary-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}"
              onclick={() => switchToSession(session.id)}
              onkeydown={(e) => e.key === 'Enter' && switchToSession(session.id)}
              role="button"
              tabindex="0"
            >
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full flex-shrink-0 {getStatusColor(session.status)}"></span>
                <span class="flex-1 truncate text-sm font-medium" style="color: var(--color-text);">
                  {session.name}
                </span>
                
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {#if session.tags && session.tags.length > 0}
                    <span class="flex -space-x-1">
                      {#each session.tags.slice(0, 2) as tag}
                        <span class="w-4 h-4 rounded-full bg-blue-500 text-white text-[8px] flex items-center justify-center" title={tag}>
                          {tag[0].toUpperCase()}
                        </span>
                      {/each}
                    </span>
                  {/if}
                  
                  <button
                    class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                    onclick={(e) => { e.stopPropagation(); handleContextMenu(e, session); }}
                    title="More options"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                      <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
                    </svg>
                  </button>
                </div>
              </div>
              
              <div class="ml-4 mt-1 flex items-center justify-between text-xs" style="color: var(--color-text-secondary);">
                <span>{formatTime(session.lastActiveAt)}</span>
                <span>{session.messageCount} messages</span>
              </div>
            </div>
          {/each}

          {#if archivedSessions.length > 0}
            <div class="border-t p-2" style="border-color: var(--color-border);">
              <button 
                class="w-full text-xs text-left px-2 py-1 rounded flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                style="color: var(--color-text-secondary);"
                onclick={(e) => e.stopPropagation()}
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M3 10h18M5 14h14M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"/>
                </svg>
                Archived Sessions ({archivedSessions.length})
                <svg class="w-3 h-3 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  {/if}
</div>
