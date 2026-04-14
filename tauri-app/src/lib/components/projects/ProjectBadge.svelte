<script lang="ts">
  import type { Project } from '$types/project';

  interface Props {
    project: Project;
    size?: 'sm' | 'md' | 'lg';
    showIcon?: boolean;
    onclick?: () => void;
  }

  let { project, size = 'sm', showIcon = false, onclick }: Props = $props();

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const dotSizes = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };
</script>

{#if onclick}
  <button
    class="inline-flex items-center gap-1.5 rounded-full transition-opacity hover:opacity-80 {sizeClasses[size]}"
    style="background-color: {project.color}20; color: {project.color};"
    onclick={onclick}
    title={project.path}
  >
    <span class="{dotSizes[size]} rounded-full" style="background-color: {project.color};"></span>
    {#if showIcon && project.icon}
      <span>{project.icon}</span>
    {/if}
    <span class="font-medium">{project.name}</span>
  </button>
{:else}
  <span
    class="inline-flex items-center gap-1.5 {sizeClasses[size]}"
    style="background-color: {project.color}20; color: {project.color};"
    title={project.path}
  >
    <span class="{dotSizes[size]} rounded-full" style="background-color: {project.color};"></span>
    {#if showIcon && project.icon}
      <span>{project.icon}</span>
    {/if}
    <span class="font-medium">{project.name}</span>
  </span>
{/if}
