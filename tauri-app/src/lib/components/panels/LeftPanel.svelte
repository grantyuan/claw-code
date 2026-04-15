<script lang="ts">
  import { chatStore, messageList, activeConversation } from '$stores/chatStore';
  import { agentStore, leaderAgent } from '$stores/agentStore';
  import { uiStore } from '$stores/uiStore';
  import { runtimeStore } from '$stores/runtimeStore';
  import { sessionStore, activeSession } from '$stores/sessionStore';
  import { AgentStatus } from '$types/agent';
  import { MessageType } from '$types/message';
  import StatusBadge from '$components/common/StatusBadge.svelte';
  import SessionSelector from '$components/sessions/SessionSelector.svelte';

  let inputText = $state('');
  let isComposing = $state(false);
  let showErrorDetail = $state(false);

  let leader = $derived($leaderAgent);
  let messages = $derived($messageList);
  let conversation = $derived($activeConversation);
  let isStreaming = $derived($chatStore.isStreaming);
  let runtimeHealth = $derived($runtimeStore);
  let lastError = $derived($chatStore.lastError);
  let currentSession = $derived($activeSession);

  let messagesContainer: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  });

  function initConversation(): string | null {
    if ($chatStore.activeConversation) {
      return $chatStore.activeConversation;
    }
    const id = `conv-${Date.now()}`;
    chatStore.createConversation(id, $agentStore.leaderAgent || 'leader-default');
    console.log('[LeftPanel] Created conversation', { id });
    return id;
  }

  function handleSend() {
    if (!inputText.trim() || isStreaming) return;
    
    let convId = $chatStore.activeConversation;
    if (!convId) {
      convId = `conv-${Date.now()}`;
      chatStore.createConversation(convId, $agentStore.leaderAgent || 'leader-default');
      console.log('[LeftPanel] Created new conversation for message', { convId });
    }
    
    console.log('[LeftPanel] Sending message', { convId, content: inputText.trim() });
    chatStore.sendMessage(convId, inputText.trim());
    inputText = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function getMessageTypeClass(type: MessageType): string {
    switch (type) {
      case MessageType.User: return 'bg-primary-600 text-white';
      case MessageType.AI: return 'bg-gray-100 dark:bg-gray-800';
      case MessageType.System: return 'bg-gray-100 dark:bg-gray-800 text-gray-500 text-xs';
      case MessageType.Error: return 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800';
      case MessageType.Tool: return 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700';
      default: return 'bg-gray-100 dark:bg-gray-800';
    }
  }

  function toDate(input: string | number | Date | undefined | null): Date {
    if (!input) return new Date();
    if (input instanceof Date) {
      return isNaN(input.getTime()) ? new Date() : input;
    }
    if (typeof input === 'number') return new Date(input);
    const parsed = new Date(input);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  function formatTime(dateInput: string | number | Date | undefined | null): string {
    const date = toDate(dateInput);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function getRuntimeStatusText(): string {
    if (!runtimeHealth.checked) return 'Checking...';
    if (runtimeHealth.isHealthy) return 'Connected';
    return 'Disconnected';
  }

  function getRuntimeStatusColor(): string {
    if (!runtimeHealth.checked) return 'text-yellow-500';
    if (runtimeHealth.isHealthy) return 'text-green-500';
    return 'text-red-500';
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
      <div class="flex items-center gap-1.5 px-2 py-1 rounded text-xs" style="background-color: var(--color-bg);" title="Server: {runtimeHealth.serverUrl}">
        <span class="w-2 h-2 rounded-full {runtimeHealth.isHealthy ? 'bg-green-500' : runtimeHealth.checked ? 'bg-red-500' : 'bg-yellow-500'}"></span>
        <span class={getRuntimeStatusColor()}>{getRuntimeStatusText()}</span>
      </div>
      <button
        class="p-2 rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
        onclick={() => runtimeStore.checkHealth()}
        title="Refresh connection"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
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

  <div class="px-3 py-1.5 border-b flex items-center gap-2" style="border-color: var(--color-border);">
    <SessionSelector onSessionChange={(id) => {
      chatStore.clearError();
    }} />
    {#if currentSession}
      <span class="text-xs truncate max-w-[120px]" style="color: var(--color-text-secondary);">
        {currentSession.projectPath}
      </span>
    {/if}
  </div>

  {#if lastError}
    <div class="mx-3 mt-2 p-2 rounded-lg flex items-center gap-2 text-xs" style="background-color: var(--color-error-bg, #fee2e2); border: 1px solid var(--color-error, #ef4444); color: var(--color-error, #ef4444);">
      <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span class="flex-1">{lastError}</span>
      <button class="p-0.5 rounded hover:bg-red-200 dark:hover:bg-red-800" onclick={() => chatStore.clearError()} title="Dismiss">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  {/if}

  {#if !runtimeHealth.isHealthy && runtimeHealth.checked}
    <div class="mx-3 mt-2 p-3 rounded-lg text-xs" style="background-color: var(--color-warning-bg, #fef3c7); border: 1px solid var(--color-warning, #d97706); color: var(--color-warning, #d97706);">
      <div class="flex items-center gap-2 mb-1 font-medium">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01" />
        </svg>
        Runtime Not Connected
      </div>
      <p class="mb-2">Server: <code class="px-1 py-0.5 rounded bg-black/10">{runtimeHealth.serverUrl}</code></p>
      <p class="mb-2">{runtimeHealth.error}</p>
      
      {#if runtimeHealth.errorDetail}
        <button
          class="mb-2 text-xs underline opacity-80 hover:opacity-100"
          onclick={() => showErrorDetail = !showErrorDetail}
        >
          {showErrorDetail ? '▼ Hide details' : '▶ Show details'}
        </button>
        {#if showErrorDetail}
          <pre class="mt-1 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap" style="background-color: rgba(0,0,0,0.1); max-height: 150px;">{runtimeHealth.errorDetail}</pre>
        {/if}
      {/if}

      <div class="flex gap-2 mt-2">
        <button
          class="px-3 py-1 rounded text-xs font-medium"
          style="background-color: var(--color-warning, #d97706); color: white;"
          onclick={() => runtimeStore.checkHealth()}
        >
          Retry Connection
        </button>
        <button
          class="px-3 py-1 rounded text-xs font-medium"
          style="background-color: transparent; border: 1px solid var(--color-warning, #d97706);"
          onclick={() => uiStore.toggleSettings()}
        >
          Open Settings
        </button>
      </div>
    </div>
  {/if}

  <div class="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin" bind:this={messagesContainer}>
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
          {#if !runtimeHealth.isHealthy && runtimeHealth.checked}
            <p class="text-xs mt-3 text-yellow-600 dark:text-yellow-400">⚠️ Runtime not connected - configure settings first</p>
          {/if}
        </div>
      </div>
    {:else}
      {#each messages as message (message.id)}
        <div class="flex {message.type === MessageType.User ? 'justify-end' : 'justify-start'} gap-2 animate-fade-in">
          {#if message.type !== MessageType.User}
            <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-md">
              AI
            </div>
          {/if}
          
          <div class="max-w-[75%] {message.type === MessageType.User ? 'order-first' : ''}">
            <div class="rounded-2xl px-4 py-3 shadow-sm {getMessageTypeClass(message.type)} {message.type === MessageType.User ? 'rounded-tr-sm' : 'rounded-tl-sm'}">
              {#if message.type === MessageType.Error}
                <div class="flex items-center gap-2 mb-2 text-red-600 dark:text-red-400">
                  <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span class="text-xs font-semibold">Error</span>
                </div>
              {/if}
              
              <div class="text-sm leading-relaxed whitespace-pre-wrap break-words" style="color: {message.type === MessageType.User ? 'white' : 'var(--color-text)'};">
                {message.content}
              </div>
            </div>
            
            <div class="flex {message.type === MessageType.User ? 'justify-end' : 'justify-start'} mt-1 px-1">
              <span class="text-[10px] text-gray-400 dark:text-gray-500">
                {formatTime(message.timestamp)}
              </span>
            </div>
          </div>
          
          {#if message.type === MessageType.User}
            <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold shadow-md order-last">
              U
            </div>
          {/if}
        </div>
      {/each}

      {#if isStreaming}
        <div class="flex justify-start gap-2 animate-fade-in">
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-md">
            AI
          </div>
          <div class="max-w-[75%]">
            <div class="rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm bg-gray-100 dark:bg-gray-800">
              <div class="flex items-center gap-3">
                <div class="flex gap-1">
                  <span class="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style="animation-delay: 0ms;"></span>
                  <span class="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style="animation-delay: 150ms;"></span>
                  <span class="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style="animation-delay: 300ms;"></span>
                </div>
                <span class="text-xs text-gray-500 dark:text-gray-400">Thinking...</span>
              </div>
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
          placeholder={runtimeHealth.isHealthy ? "Type your message... (Enter to send, Shift+Enter for new line)" : "Configure runtime settings to send messages..."}
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
        class="btn btn-primary px-3 py-2 relative"
        onclick={handleSend}
        disabled={!inputText.trim() || isStreaming}
      >
        {#if isStreaming}
          <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        {:else}
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        {/if}
      </button>
    </div>
    <div class="flex items-center justify-between mt-1.5 text-xs" style="color: var(--color-text-secondary);">
      <span>
        {#if isStreaming}
          Sending message via Claw Runtime...
        {:else if runtimeHealth.isHealthy}
          Ready
        {:else}
          ⚠️ Not connected to runtime
        {/if}
      </span>
      <span>{messages.length} messages</span>
    </div>
  </div>
</div>
