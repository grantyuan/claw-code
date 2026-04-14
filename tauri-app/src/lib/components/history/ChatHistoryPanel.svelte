<script lang="ts">
  import { chatHistoryService } from '$services/chatHistoryService';
  import HistoryListItem from './HistoryListItem.svelte';
  import type { ConversationRecord } from '$types/chatHistory';

  interface Props {
    projectId?: string;
    onSelectConversation: (id: string) => void;
    onResubmit?: (conversationId: string, messageId: string) => void;
  }

  let { projectId, onSelectConversation, onResubmit }: Props = $props();

  let conversations = $state<ConversationRecord[]>([]);
  let searchQuery = $state('');
  let selectedId = $state<string | null>(null);
  let isLoading = $state(true);

  $effect(() => {
    loadConversations();
  });

  async function loadConversations() {
    isLoading = true;
    try {
      if (searchQuery.length >= 2) {
        conversations = await chatHistoryService.searchConversations(searchQuery);
      } else {
        conversations = await chatHistoryService.listConversations({ projectId });
      }
    } catch (e) {
      console.error('Failed to load conversations:', e);
      conversations = [];
    } finally {
      isLoading = false;
    }
  }

  function handleSelect(id: string) {
    selectedId = id;
    onSelectConversation(id);
  }

  function handleSearch() {
    loadConversations();
  }

  export function refresh() {
    loadConversations();
  }
</script>

<div class="flex flex-col h-full" data-testid="chat-history-panel">
  <div class="p-3 border-b" style="border-color: var(--color-border);">
    <div class="relative">
      <input
        type="text"
        placeholder="Search conversations..."
        class="w-full px-3 py-2 pl-10 rounded-lg text-sm"
        style="background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text);"
        bind:value={searchQuery}
        oninput={handleSearch}
      />
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style="color: var(--color-text-secondary);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
  </div>

  <div class="flex-1 overflow-y-auto">
    {#if isLoading}
      <div class="flex items-center justify-center h-32">
        <div class="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full"></div>
      </div>
    {:else if conversations.length === 0}
      <div class="flex flex-col items-center justify-center h-32 text-sm" style="color: var(--color-text-secondary);">
        <svg class="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p>No conversations yet</p>
      </div>
    {:else}
      {#each conversations as convo (convo.id)}
        <HistoryListItem
          conversation={convo}
          isSelected={selectedId === convo.id}
          onSelect={() => handleSelect(convo.id)}
        />
      {/each}
    {/if}
  </div>

  <div class="p-2 border-t" style="border-color: var(--color-border);">
    <button
      class="w-full px-3 py-2 text-sm rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
      style="color: var(--color-text-secondary);"
      onclick={() => { searchQuery = ''; loadConversations(); }}
    >
      Clear Search
    </button>
  </div>
</div>
