<script lang="ts">
  import { onMount } from 'svelte';
  import { uiStore } from '$stores/uiStore';
  import { agentStore } from '$stores/agentStore';
  import { chatStore } from '$stores/chatStore';
  import { connectionStore } from '$stores/connectionStore';
  import { configStore } from '$stores/configStore';
  import { runtimeStore } from '$stores/runtimeStore';
  import LeftPanel from '$components/panels/LeftPanel.svelte';
  import RightPanel from '$components/panels/RightPanel.svelte';
  import SettingsPanel from '$components/settings/SettingsPanel.svelte';
  import Modal from '$components/common/Modal.svelte';
  import Button from '$components/common/Button.svelte';
  import Toast from '$components/common/Toast.svelte';
  import { ConnectionStatus } from '$types/connection';

  let actualTheme = $derived($uiStore.actualTheme);
  let settingsOpen = $derived($uiStore.settingsOpen);
  let panelLayout = $derived($uiStore.panelLayout);
  let runtimeHealth = $derived($runtimeStore);

  let showRuntimeError = $state(false);

  onMount(async () => {
    uiStore.loadFromStorage();
    agentStore.initDefaultLeader();
    configStore.loadFromStorage();

    const localConnection = {
      id: 'local',
      name: 'Local CLI',
      type: 'local' as const,
      status: ConnectionStatus.Disconnected,
      endpoint: 'ws://localhost:8765',
    };
    connectionStore.addConnection(localConnection);

    const isHealthy = await runtimeStore.checkHealth();
    if (!isHealthy) {
      showRuntimeError = true;
    }
  });

  function openSettings() {
    showRuntimeError = false;
    uiStore.openSettings();
  }

  $effect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', actualTheme === 'dark');
    }
  });
</script>

<div 
  data-testid="app-container" 
  class="h-screen w-screen flex flex-col overflow-hidden"
  style="background-color: var(--color-bg); color: var(--color-text);"
  class:dark={actualTheme === 'dark'}
>
  <div class="flex-1 flex overflow-hidden">
    <div 
      data-testid="left-panel"
      class="border-r overflow-hidden transition-all duration-200"
      style="width: {panelLayout.leftPanelCollapsed ? '0px' : panelLayout.leftPanelWidth + '%'}; border-color: var(--color-border); min-width: {panelLayout.leftPanelCollapsed ? '0' : '300px'};"
    >
      <LeftPanel />
    </div>
    
    <div 
      data-testid="right-panel"
      class="overflow-hidden transition-all duration-200"
      style="width: {panelLayout.rightPanelCollapsed ? '0px' : panelLayout.rightPanelWidth + '%'}; min-width: {panelLayout.rightPanelCollapsed ? '0' : '300px'};"
    >
      <RightPanel />
    </div>
  </div>
</div>

{#if settingsOpen}
  <SettingsPanel />
{/if}

<Toast />

{#if showRuntimeError}
  <Modal
    isOpen={showRuntimeError}
    title="Runtime Not Available"
    onClose={() => {}}
    size="md"
  >
    {#snippet children()}
      <div class="space-y-4">
        <div class="flex items-center gap-3 p-4 rounded-lg" style="background-color: var(--color-error-bg, #fee2e2); border: 1px solid var(--color-error, #ef4444);">
          <svg class="w-6 h-6 flex-shrink-0" style="color: var(--color-error, #ef4444);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p class="font-medium" style="color: var(--color-error, #ef4444);">Claw Runtime Unavailable</p>
            <p class="text-sm mt-1" style="color: var(--color-text-secondary);">
              {runtimeHealth.error || 'Failed to initialize the runtime. Please configure your AI provider settings.'}
            </p>
          </div>
        </div>

        <div class="space-y-2">
          <p class="text-sm font-medium" style="color: var(--color-text);">To fix this:</p>
          <ol class="text-sm space-y-1 list-decimal list-inside" style="color: var(--color-text-secondary);">
            <li>Click "Open Settings" below</li>
            <li>Go to AI Model settings</li>
            <li>Configure your API key (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.)</li>
            <li>Or set CLAW_DEFAULT_PROVIDER to use a different provider</li>
          </ol>
        </div>
      </div>
    {/snippet}
    {#snippet footer()}
      <Button variant="primary" onclick={openSettings}>
        Open Settings
      </Button>
    {/snippet}
  </Modal>
{/if}

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }

  :global(.dark) {
    color-scheme: dark;
  }
</style>
