<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label: string;
    progress: number;
    max?: number;
    showPercentage?: boolean;
    variant?: 'default' | 'success' | 'warning' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    children?: Snippet;
  }

  let { label, progress, max = 100, showPercentage = true, variant = 'default', size = 'md', children }: Props = $props();

  const variantClasses: Record<string, string> = {
    default: 'bg-primary-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    danger: 'bg-red-600',
  };

  const sizeClasses: Record<string, string> = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  let percentage = $derived(Math.min(Math.max(Math.round((progress / max) * 100), 0), 100));
</script>

<div class="w-full">
  <div class="flex justify-between items-center mb-1">
    <span class="text-sm font-medium" style="color: var(--color-text);">{label}</span>
    {#if showPercentage}
      <span class="text-sm" style="color: var(--color-text);">{percentage}%</span>
    {/if}
  </div>
  <div class="w-full rounded-full overflow-hidden" style="background-color: var(--color-border);">
    <div 
      class="rounded-full transition-all duration-300 ease-out {variantClasses[variant]} {sizeClasses[size]}"
      style="width: {percentage}%"
    ></div>
  </div>
  {#if children}
    <div class="mt-1">
      {@render children()}
    </div>
  {/if}
</div>
