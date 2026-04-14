<script lang="ts">
  import { uiStore } from '$stores/uiStore';
  import { configStore } from '$stores/configStore';
  import AIModelSettings from './AIModelSettings.svelte';
  import TieredLMSettings from './TieredLMSettings.svelte';
  import Button from '$components/common/Button.svelte';

  let activeTab = $state('ai-model');
  let hasUnsavedChanges = $derived($configStore.isDirty);

  const tabs = [
    { id: 'ai-model', label: 'AI Model', icon: '🤖' },
    { id: 'tiered-lm', label: 'Tiered-LM', icon: '🔄' },
    { id: 'agents', label: 'Agents', icon: '👥' },
    { id: 'rag', label: 'RAG & Knowledge', icon: '📚' },
    { id: 'mcp', label: 'MCP & Tools', icon: '🔧' },
    { id: 'memory', label: 'Memory', icon: '🧠' },
    { id: 'remote', label: 'Remote & SSH', icon: '🖥️' },
    { id: 'p2p', label: 'P2P Network', icon: '🌐' },
    { id: 'ui', label: 'UI/UX', icon: '🎨' },
  ];

  function handleClose() {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        uiStore.toggleSettings();
      }
    } else {
      uiStore.toggleSettings();
    }
  }

  function handleSave() {
    configStore.saveToStorage();
    configStore.markSaved();
  }

  function handleCancel() {
    configStore.loadFromStorage();
    uiStore.toggleSettings();
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
  <div class="w-full max-w-5xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden flex" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
    <div class="w-56 border-r flex flex-col" style="border-color: var(--color-border);">
      <div class="px-4 py-4 border-b" style="border-color: var(--color-border);">
        <h2 class="text-lg font-semibold" style="color: var(--color-text);">Settings</h2>
      </div>
      <nav class="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {#each tabs as tab}
          <button
            class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors {activeTab === tab.id ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}"
            style="color: var(--color-text);"
            onclick={() => activeTab = tab.id}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        {/each}
      </nav>
    </div>

    <div class="flex-1 flex flex-col overflow-hidden">
      <div class="px-6 py-4 border-b flex items-center justify-between" style="border-color: var(--color-border);">
        <h3 class="text-lg font-medium" style="color: var(--color-text);">
          {tabs.find(t => t.id === activeTab)?.label || 'Settings'}
        </h3>
        <div class="flex items-center gap-2">
          {#if hasUnsavedChanges}
            <span class="text-xs px-2 py-1 rounded" style="background-color: var(--color-warning-bg, #fef3c7); color: var(--color-warning, #d97706);">Unsaved changes</span>
          {/if}
          <button class="p-1 rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-700" onclick={handleClose} aria-label="Close settings">
            <svg class="w-5 h-5" style="color: var(--color-text);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-6 scrollbar-thin">
        {#if activeTab === 'ai-model'}
          <AIModelSettings />
        {:else if activeTab === 'tiered-lm'}
          <TieredLMSettings />
        {:else if activeTab === 'remote'}
          <div class="space-y-6">
            <div>
              <h4 class="text-md font-medium mb-3" style="color: var(--color-text);">Remote Computers</h4>
              <div class="p-4 mb-3 rounded-lg" style="background-color: var(--color-bg); border: 1px solid var(--color-border);">
                <p class="text-sm" style="color: var(--color-text-secondary);">No remote computers configured</p>
                <Button variant="primary" size="sm" class="mt-2">Add Computer</Button>
              </div>
            </div>
            <div>
              <h4 class="text-md font-medium mb-3" style="color: var(--color-text);">SSH Configuration</h4>
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium mb-1" style="color: var(--color-text);">Default SSH Port</label>
                  <input type="number" class="input" value="22" min="1" max="65535" />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1" style="color: var(--color-text);">SSH Key Path</label>
                  <input type="text" class="input" placeholder="~/.ssh/id_rsa" />
                </div>
              </div>
            </div>
            <div>
              <h4 class="text-md font-medium mb-3" style="color: var(--color-text);">Deployment Settings</h4>
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium mb-1" style="color: var(--color-text);">Install Path</label>
                  <input type="text" class="input" placeholder="/opt/clawcode" />
                </div>
                <div class="flex items-center gap-2">
                  <input type="checkbox" id="auto-start" checked />
                  <label for="auto-start" class="text-sm" style="color: var(--color-text);">Auto-start on boot</label>
                </div>
                <div class="flex items-center gap-2">
                  <input type="checkbox" id="auto-update" />
                  <label for="auto-update" class="text-sm" style="color: var(--color-text);">Auto-update</label>
                </div>
              </div>
            </div>
          </div>
        {:else if activeTab === 'ui'}
          <div class="space-y-6">
            <div>
              <label class="block text-sm font-medium mb-1" style="color: var(--color-text);">Theme</label>
              <select class="input" onchange={(e) => uiStore.setTheme((e.target as HTMLSelectElement).value as 'dark' | 'light' | 'system')}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1" style="color: var(--color-text);">Font Size</label>
              <input type="range" min="12" max="20" step="1" value="14" class="w-full" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1" style="color: var(--color-text);">Font Family</label>
              <select class="input">
                <option value="inter">Inter</option>
                <option value="jetbrains">JetBrains Mono</option>
                <option value="system">System Default</option>
              </select>
            </div>
            <div>
              <h4 class="text-md font-medium mb-3" style="color: var(--color-text);">Notifications</h4>
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <input type="checkbox" id="sound" checked />
                  <label for="sound" class="text-sm" style="color: var(--color-text);">Sound alerts</label>
                </div>
                <div class="flex items-center gap-2">
                  <input type="checkbox" id="desktop" checked />
                  <label for="desktop" class="text-sm" style="color: var(--color-text);">Desktop notifications</label>
                </div>
                <div class="flex items-center gap-2">
                  <input type="checkbox" id="inapp" checked />
                  <label for="inapp" class="text-sm" style="color: var(--color-text);">In-app notifications</label>
                </div>
              </div>
            </div>
          </div>
        {:else}
          <div class="flex items-center justify-center h-40">
            <p class="text-sm" style="color: var(--color-text-secondary);">Configuration for {tabs.find(t => t.id === activeTab)?.label} coming soon</p>
          </div>
        {/if}
      </div>

      <div class="px-6 py-4 border-t flex justify-end gap-3" style="border-color: var(--color-border);">
        <Button variant="secondary" onclick={handleCancel}>Cancel</Button>
        <button
          class="px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style="background-color: var(--color-primary-500, #3b82f6); color: white;"
          onclick={handleSave}
          disabled={!hasUnsavedChanges}
        >
          Save Changes
        </button>
      </div>
    </div>
  </div>
</div>
