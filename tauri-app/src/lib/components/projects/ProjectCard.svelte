<script lang="ts">
  import type { Project } from '$types/project';
  import ProjectBadge from './ProjectBadge.svelte';

  interface Props {
    project: Project;
    onSelect: () => void;
    onSettings?: () => void;
  }

  let { project, onSelect, onSettings }: Props = $props();

  function formatRelativeTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }
</script>

<div
  class="p-4 rounded-lg border transition-colors hover:border-primary-300 dark:hover:border-primary-700"
  style="border-color: var(--color-border); background-color: var(--color-bg);"
>
  <div class="flex items-start justify-between mb-3">
    <div class="flex items-center gap-3">
      <span class="w-4 h-4 rounded-full" style="background-color: {project.color};"></span>
      <div>
        <h3 class="font-medium" style="color: var(--color-text);">
          {project.name}
          {#if project.icon}
            <span class="ml-1">{project.icon}</span>
          {/if}
        </h3>
        <p class="text-xs mt-0.5 truncate max-w-xs" style="color: var(--color-text-secondary);">
          {project.path}
        </p>
      </div>
    </div>
    {#if onSettings}
      <button
        class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        onclick={(e) => { e.stopPropagation(); onSettings?.(); }}
        aria-label="Project settings"
      >
        <svg class="w-4 h-4" style="color: var(--color-text-secondary);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    {/if}
  </div>

  {#if project.description}
    <p class="text-sm mb-3 line-clamp-2" style="color: var(--color-text-secondary);">
      {project.description}
    </p>
  {/if}

  <div class="flex items-center justify-between">
    <div class="flex items-center gap-4 text-xs" style="color: var(--color-text-secondary);">
      <span>{project.sessionCount} sessions</span>
      <span>Last active: {formatRelativeTime(project.lastAccessedAt)}</span>
    </div>
  </div>

  <button
    class="w-full mt-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-800"
    onclick={onSelect}
  >
    Open Project
  </button>
</div>
