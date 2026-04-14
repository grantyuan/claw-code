<script lang="ts">
  import type { ConversationRecord } from '$types/chatHistory';

  interface Props {
    conversation: ConversationRecord;
    isSelected: boolean;
    onSelect: () => void;
  }

  let { conversation, isSelected, onSelect }: Props = $props();

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

<button
  class="w-full text-left px-4 py-3 transition-colors {isSelected ? 'bg-primary-100 dark:bg-primary-900' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}"
  onclick={onSelect}
>
  <div class="flex items-center justify-between mb-1">
    <span class="font-medium text-sm" style="color: var(--color-text);">
      {conversation.title}
    </span>
    <span class="text-xs" style="color: var(--color-text-secondary);">
      {formatRelativeTime(conversation.updatedAt)}
    </span>
  </div>
  <div class="text-xs" style="color: var(--color-text-secondary);">
    {conversation.messageCount} messages
  </div>
  {#if conversation.projectId}
    <div class="mt-1">
      <span class="text-xs px-2 py-0.5 rounded" style="background: var(--color-primary-100, #dbeafe); color: var(--color-primary-700, #1d4ed8);">
        Project
      </span>
    </div>
  {/if}
</button>
