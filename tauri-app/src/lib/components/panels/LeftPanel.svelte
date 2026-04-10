<script lang="ts">
  import { chatStore, messageList, activeConversation } from '$stores/chatStore';
  import { agentStore, leaderAgent } from '$stores/agentStore';
  import { uiStore } from '$stores/uiStore';
  import { AgentStatus } from '$types/agent';
  import { MessageType } from '$types/message';
  import StatusBadge from '$components/common/StatusBadge.svelte';

  let inputText = $state('');
  let isComposing = $state(false);

  let leader = $derived($leaderAgent);
  let messages = $derived($messageList);
  let conversation = $derived($activeConversation);
  let isStreaming = $derived($chatStore.isStreaming);

  function initConversation() {
    if (!$chatStore.activeConversation) {
      const id = `conv-${Date.now()}`;
      chatStore.createConversation(id, $agentStore.leaderAgent || 'leader-default');
    }
  }

  function handleSend() {
    if (!inputText.trim() || isStreaming) return;
    initConversation();
    const convId = $chatStore.activeConversation;
    if (convId) {
      chatStore.sendMessage(convId, inputText.trim());
      inputText = '';
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function getMessageTypeClass(type: MessageType): string {
    switch (type) {
      case MessageType.User: return 'ml-auto bg-primary-600 text-white';
      case MessageType.AI: return 'mr-auto';
      case MessageType.System: return 'mx-auto bg-gray-100 dark:bg-gray-800 text-gray-500 text-xs';
      case MessageType.Error: return 'mx-auto bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 text-xs';
      case MessageType.Tool: return 'mr-auto bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700';
      default: return 'mr-auto';
    }
  }

  initConversation();
</script>

<div class="panel h-full flex flex-col" style="background-color: var(--color-surface);">
  <div class="panel-header">
    <div class="flex items-center gap-3">
      <h2 class="text-lg font-semibold" style="color: var(--color-text);">Claw Chat</h2>
      {#if leader}
        <StatusBadge status={leader.status} label={leader.status} />
      {/if}
    </div>
    <div class="flex items-center gap-2">
      {#if leader}
        <span class="text-xs px-2 py-1 rounded" style="color: var(--color-text); background-color: var(--color-border);">
          {leader.model}
        </span>
      {/if}
      <button 
        class="p-2 rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
        onclick={() => uiStore.toggleSettings()}
        title="Settings"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>
  </div>

  <div class="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
    {#if messages.length === 0}
      <div class="flex items-center justify-center h-full">
        <div class="text-center">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
            <svg class="w-8 h-8 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <p class="text-sm" style="color: var(--color-text);">Start a conversation with the Leader Agent</p>
          <p class="text-xs mt-1" style="color: var(--color-border);">Type your message below</p>
        </div>
      </div>
    {:else}
      {#each messages as message (message.id)}
        <div class="flex {message.type === MessageType.User ? 'justify-end' : 'justify-start'}">
          <div class="max-w-[80%] rounded-xl px-4 py-2.5 {getMessageTypeClass(message.type)}">
            {#if message.type === MessageType.AI || message.type === MessageType.Tool}
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs font-medium opacity-70">
                  {message.type === MessageType.AI ? 'AI' : 'Tool'}
                </span>
              </div>
            {/if}
            <div class="text-sm whitespace-pre-wrap">{message.content}</div>
            <div class="text-xs opacity-50 mt-1">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      {/each}
      
      {#if isStreaming}
        <div class="flex justify-start">
          <div class="max-w-[80%] rounded-xl px-4 py-2.5 mr-auto">
            <div class="flex items-center gap-2">
              <div class="flex gap-1">
                <span class="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style="animation-delay: 0ms;"></span>
                <span class="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style="animation-delay: 150ms;"></span>
                <span class="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style="animation-delay: 300ms;"></span>
              </div>
              <span class="text-xs opacity-70">Thinking...</span>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </div>

  <div class="p-4 border-t" style="border-color: var(--color-border);">
    <div class="flex items-end gap-2">
      <div class="flex-1 relative">
        <textarea
          class="input resize-none pr-10"
          rows="1"
          placeholder="Type your message..."
          bind:value={inputText}
          onkeydown={handleKeydown}
          oninput={() => {
            const el = event?.target as HTMLTextAreaElement;
            if (el) el.style.height = 'auto', el.style.height = Math.min(el.scrollHeight, 120) + 'px';
          }}
          disabled={isStreaming}
        ></textarea>
      </div>
      <button
        class="btn btn-primary px-3 py-2"
        onclick={handleSend}
        disabled={!inputText.trim() || isStreaming}
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </button>
    </div>
  </div>
</div>
