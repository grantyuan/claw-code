<script lang="ts">
  import { sessionStore, activeSession } from '$stores/sessionStore';
  import { apiService } from '$services/apiService';
  import type { Session } from '$types/session';

  interface Props {
    onSessionChange?: (sessionId: string) => void;
  }

  let { onSessionChange }: Props = $props();

  let showSessionList = $state(false);
  let sessions = $derived($sessionStore.sessions);
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

  async function createNewSession() {
    try {
      sessionStore.setLoading(true);
      const response = await apiService.createSession(
        '/tmp',
        `Session ${sessions.length + 1}`
      );
      const newSession: Session = {
        id: response.session_id,
        name: response.name || 'New Session',
        projectPath: response.project_path || '/tmp',
        status: 'active',
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        messageCount: 0,
      };
      sessionStore.addSession(newSession);
      onSessionChange?.(newSession.id);
    } catch (e) {
      console.error('Failed to create session:', e);
    } finally {
      sessionStore.setLoading(false);
    }
  }

  async function switchToSession(sessionId: string) {
    try {
      await apiService.switchSession(sessionId);
      sessionStore.setActiveSession(sessionId);
      onSessionChange?.(sessionId);
    } catch (e) {
      console.error('Failed to switch session:', e);
    }
  }

  async function deleteSession(sessionId: string, e: Event) {
    e.stopPropagation();
    try {
      await apiService.deleteSession(sessionId);
      sessionStore.removeSession(sessionId);
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  }

  function handleClick() {
    showSessionList = !showSessionList;
    if (showSessionList) {
      loadSessions();
    }
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.session-selector')) {
      showSessionList = false;
    }
  }

  $effect(() => {
    if (showSessionList) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  });
</script>

<div class="session-selector relative">
  <button
    class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
    style="background-color: var(--color-border); color: var(--color-text);"
    onclick={handleClick}
  >
    <span class="w-2 h-2 rounded-full {current?.status === 'active' ? 'bg-green-500' : current?.status === 'running' ? 'bg-yellow-500' : 'bg-gray-400'}"></span>
    <span class="max-w-[150px] truncate">{current?.name || 'Select Session'}</span>
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </button>

  <button
    class="p-1.5 rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
    style="color: var(--color-text);"
    onclick={createNewSession}
    title="New Session"
  >
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
    </svg>
  </button>

  {#if showSessionList}
    <div
      class="absolute top-full left-0 mt-1 w-64 rounded-lg shadow-lg z-50"
      style="background-color: var(--color-surface); border: 1px solid var(--color-border);"
    >
      <div class="p-2 border-b" style="border-color: var(--color-border);">
        <span class="text-xs font-medium" style="color: var(--color-text);">Sessions ({sessions.length})</span>
      </div>

      <div class="max-h-64 overflow-y-auto">
        {#if isLoading}
          <div class="p-4 text-center">
            <span class="text-sm" style="color: var(--color-text);">Loading...</span>
          </div>
        {:else if sessions.length === 0}
          <div class="p-4 text-center">
            <span class="text-sm" style="color: var(--color-text);">No sessions</span>
            <button
              class="mt-2 text-sm text-primary-600 hover:text-primary-500"
              onclick={createNewSession}
            >
              Create first session
            </button>
          </div>
        {:else}
          {#each sessions as session (session.id)}
            <button
              class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors {session.id === current?.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''}"
              onclick={() => switchToSession(session.id)}
            >
              <span class="w-2 h-2 rounded-full {session.status === 'active' ? 'bg-green-500' : session.status === 'running' ? 'bg-yellow-500' : session.status === 'error' ? 'bg-red-500' : 'bg-gray-400'}"></span>
              <span class="flex-1 truncate text-sm" style="color: var(--color-text);">{session.name}</span>
              <span class="text-xs" style="color: var(--color-border);">{session.messageCount} msgs</span>
              <button
                class="p-1 rounded opacity-0 hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 transition-opacity"
                onclick={(e) => deleteSession(session.id, e)}
                title="Delete session"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>
