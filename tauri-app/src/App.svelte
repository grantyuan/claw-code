<script lang="ts">
  import { onMount } from 'svelte';
  import { uiStore, isDarkMode } from '$stores/uiStore';
  import { agentStore } from '$stores/agentStore';
  import { chatStore } from '$stores/chatStore';
  import { connectionStore } from '$stores/connectionStore';
  import LeftPanel from '$components/panels/LeftPanel.svelte';
  import RightPanel from '$components/panels/RightPanel.svelte';
  import SettingsPanel from '$components/settings/SettingsPanel.svelte';
  import Toast from '$components/common/Toast.svelte';
  import { ConnectionStatus } from '$types/connection';

  $: actualTheme = $uiStore.actualTheme;
  $: settingsOpen = $uiStore.settingsOpen;
  $: panelLayout = $uiStore.panelLayout;

  onMount(() => {
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
  });

  $: if (actualTheme === 'dark') {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.add('dark');
    }
  } else {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('dark');
    }
  }

  import { configStore } from '$stores/configStore';
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
