<script lang="ts">
  import { sessionStore, activeSession } from '$stores/sessionStore';
  import { apiService } from '$services/apiService';
  import type { Session } from '$types/session';

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSessionCreated?: (sessionId: string) => void;
  }

  let { isOpen, onClose, onSessionCreated }: Props = $props();

  let name = $state('');
  let projectPath = $state('/home/user/projects');
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  async function handleSubmit() {
    if (!name.trim()) {
      error = 'Session name is required';
      return;
    }
    
    try {
      isLoading = true;
      error = null;

      const response = await apiService.createSession(projectPath, name);
      const newSession: Session = {
        id: response.session_id,
        name: response.name || name,
        projectPath: response.project_path || projectPath,
        status: 'active',
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        messageCount: 0,
      };

      sessionStore.addSession(newSession);
      onSessionCreated?.(newSession.id);
      
      name = '';
      onClose();
    } catch (e) {
      error = `Failed to create session: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      isLoading = false;
    }
  }

  function handleCancel() {
    name = '';
    error = null;
    onClose();
  }

  $effect(() => {
    if (isOpen) {
      error = null;
    }
  });
</script>

{#if isOpen}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={handleCancel}>
    <div 
      class="rounded-lg shadow-xl w-full max-w-md mx-4"
      style="background-color: var(--color-surface); border: 1px solid var(--color-border);"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4" style="color: var(--color-text);">New Session</h3>

        {#if error}
          <div class="mb-4 p-3 rounded-lg text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        {/if}

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1" style="color: var(--color-text-secondary);">
              Session Name
            </label>
            <input
              type="text"
              bind:value={name}
              placeholder="Enter session name..."
              class="w-full px-3 py-2 rounded-lg text-sm"
              style="background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text);"
              disabled={isLoading}
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-1" style="color: var(--color-text-secondary);">
              Project Path
            </label>
            <input
              type="text"
              bind:value={projectPath}
              placeholder="/path/to/project"
              class="w-full px-3 py-2 rounded-lg text-sm"
              style="background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text);"
              disabled={isLoading}
            />
          </div>
        </div>

        <div class="flex justify-end gap-3 mt-6">
          <button
            onclick={handleCancel}
            disabled={isLoading}
            class="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
            style="color: var(--color-text-secondary);"
          >
            Cancel
          </button>
          <button
            onclick={handleSubmit}
            disabled={isLoading || !name.trim()}
            class="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white"
            style="background-color: var(--color-primary); opacity: {isLoading || !name.trim() ? '0.5' : '1'};"
          >
            {#if isLoading}
              <span class="inline-flex items-center gap-2">
                <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Creating...
              </span>
            {:else}
              Create Session
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
