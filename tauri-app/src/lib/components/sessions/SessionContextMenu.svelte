<script lang="ts">
  import { sessionStore } from '$stores/sessionStore';
  import type { Session, SessionStatus } from '$types/session';

  interface Props {
    session: Session;
    x: number;
    y: number;
    onRename?: (sessionId: string) => void;
    onClose: () => void;
  }

  let { session, x, y, onRename, onClose }: Props = $props();

  const menuItems = [
    { 
      id: 'switch', 
      label: 'Switch to Session', 
      icon: 'M8 7h12M8 12h12m-12 5h12' 
    },
    { 
      id: 'rename', 
      label: 'Rename', 
      icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L15.657 7H18a2 2 0 012 2v4.172' 
    },
    { 
      id: 'archive', 
      label: session.isArchived ? 'Unarchive' : 'Archive',
      icon: 'M5 8h14M3 10h18M5 14h14M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z'
    },
    { 
      id: 'duplicate', 
      label: 'Duplicate', 
      icon: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z' 
    },
    { 
      id: 'delete', 
      label: 'Delete', 
      icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
      isDestructive: true
    },
  ];

  async function handleAction(actionId: string) {
    switch (actionId) {
      case 'switch':
        sessionStore.setActiveSession(session.id);
        break;
      
      case 'rename':
        if (onRename) {
          onRename(session.id);
        }
        break;

      case 'archive':
        sessionStore.updateSession(session.id, { isArchived: !session.isArchived });
        break;

      case 'duplicate':
        try {
          const response = await import('$services/apiService').then(m => m.apiService);
          const api = await response.default;
          await api.createSession(session.projectPath, `${session.name} (Copy)`);
        } catch (e) {
          console.error('Failed to duplicate session:', e);
        }
        break;

      case 'delete':
        if (confirm(`Are you sure you want to delete "${session.name}"?`)) {
          try {
            const response = await import('$services/apiService').then(m => m.apiService);
            const api = await response.default;
            await api.deleteSession(session.id);
            sessionStore.removeSession(session.id);
          } catch (e) {
            console.error('Failed to delete session:', e);
          }
        }
        break;
    }

    onClose();
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.context-menu')) {
      onClose();
    }
  }

  function getIconPath(iconPath: string): string {
    return iconPath;
  }

  $effect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });
</script>

<div class="fixed inset-0 z-50" style="pointer-events: none;">
  <div 
    class="context-menu rounded-lg shadow-lg py-1 min-w-[180px]"
    style="
      position: absolute; 
      left: {x}px; 
      top: {y}px; 
      background-color: var(--color-surface); 
      border: 1px solid var(--color-border); 
      pointer-events: auto;
    "
  >
    {#each menuItems as item}
      <button
        class="w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
        style="color: {item.isDestructive ? '#ef4444' : 'var(--color-text)'};"
        onclick={() => handleAction(item.id)}
      >
        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d={getIconPath(item.icon)} />
        </svg>
        <span>{item.label}</span>
        
        {#if item.id === 'archive'}
          <span class="ml-auto text-xs px-1.5 py-0.5 rounded-full"
            style="background-color: {session.isArchived ? 'var(--color-primary)' : 'transparent'}; color: {session.isArchived ? 'white' : 'var(--color-text-secondary)'};"
          >
            {session.isArchived ? 'ON' : 'OFF'}
          </span>
        {/if}
      </button>
    {/each}

    <div class="border-t my-1" style="border-color: var(--color-border);"></div>

    <div class="px-3 py-2 text-xs" style="color: var(--color-text-secondary);">
      <div>Created: {new Date(session.createdAt).toLocaleDateString()}</div>
      <div>Messages: {session.messageCount}</div>
      <div>Status: {session.status}</div>
      {#if session.tags?.length}
        <div class="flex gap-1 mt-1 flex-wrap">
          {#each session.tags as tag}
            <span class="px-1.5 py-0.5 rounded-full text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
              {tag}
            </span>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
