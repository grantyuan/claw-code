<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    isOpen: boolean;
    title: string;
    onClose: () => void;
    children: Snippet;
    footer?: Snippet;
    size?: 'sm' | 'md' | 'lg';
  }

  let { isOpen, title, onClose, children, footer, size = 'md' }: Props = $props();

  const sizeClasses: Record<string, string> = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
  };

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
  >
    <div class="w-full {sizeClasses[size]} rounded-xl shadow-2xl overflow-hidden" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
      <div class="flex items-center justify-between px-6 py-4 border-b" style="border-color: var(--color-border);">
        <h2 class="text-lg font-semibold" style="color: var(--color-text);">{title}</h2>
        <button 
          class="p-1 rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
          onclick={onClose}
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div class="px-6 py-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
        {@render children()}
      </div>
      
      {#if footer}
        <div class="px-6 py-4 border-t flex justify-end gap-3" style="border-color: var(--color-border);">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}
