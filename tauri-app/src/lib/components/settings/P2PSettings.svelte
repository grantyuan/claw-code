<script lang="ts">
  import { configStore } from '$stores/configStore';
  import { configService } from '$services/configService';
  import type { P2PConfig } from '$types/config';
  import Button from '$components/common/Button.svelte';

  interface Props {
    onClose?: () => void;
  }

  let { onClose }: Props = $props();

  let p2pConfig = $state<P2PConfig>({
    enabled: false,
    discoveryMethod: 'bootstrap',
    relayServers: [],
    natTraversal: true,
    encryption: true,
    peerAuthentication: true,
  });
  let newRelayServer = $state('');
  let hasUnsavedChanges = $state(false);

  $effect(() => {
    loadConfig();
  });

  async function loadConfig() {
    const config = await configService.loadGlobalConfig();
    p2pConfig = config.p2p;
  }

  function addRelayServer() {
    if (!newRelayServer.trim()) return;
    p2pConfig.relayServers = [...p2pConfig.relayServers, newRelayServer.trim()];
    newRelayServer = '';
    hasUnsavedChanges = true;
  }

  function removeRelayServer(server: string) {
    p2pConfig.relayServers = p2pConfig.relayServers.filter(s => s !== server);
    hasUnsavedChanges = true;
  }

  function handleSave() {
    configStore.setDirty(true);
    configStore.saveToStorage();
    hasUnsavedChanges = false;
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h3 class="text-lg font-medium" style="color: var(--color-text);">P2P Network</h3>
    <div class="flex items-center gap-3">
      <span class="text-sm" style="color: var(--color-text-secondary);">
        {p2pConfig.enabled ? 'Enabled' : 'Disabled'}
      </span>
      <button
        class="relative w-12 h-6 rounded-full transition-colors {p2pConfig.enabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}"
        onclick={() => { p2pConfig.enabled = !p2pConfig.enabled; hasUnsavedChanges = true; }}
        role="switch"
        aria-checked={p2pConfig.enabled}
      >
        <span class="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform {p2pConfig.enabled ? 'left-7' : 'left-1'}"></span>
      </button>
    </div>
  </div>

  {#if p2pConfig.enabled}
    <div class="space-y-4">
      <div class="p-4 rounded-lg border" style="border-color: var(--color-border); background: var(--color-bg);">
        <h4 class="text-md font-medium mb-3" style="color: var(--color-text);">Discovery Method</h4>

        <div class="space-y-2">
          <label class="flex items-center gap-3 cursor-pointer p-2 rounded" style="background: var(--color-surface);">
            <input
              type="radio"
              name="discovery"
              value="bootstrap"
              bind:group={p2pConfig.discoveryMethod}
              onchange={() => hasUnsavedChanges = true}
            />
            <div>
              <span style="color: var(--color-text);">Bootstrap Server</span>
              <p class="text-xs" style="color: var(--color-text-secondary);">Use known servers to discover peers</p>
            </div>
          </label>

          <label class="flex items-center gap-3 cursor-pointer p-2 rounded" style="background: var(--color-surface);">
            <input
              type="radio"
              name="discovery"
              value="mdns"
              bind:group={p2pConfig.discoveryMethod}
              onchange={() => hasUnsavedChanges = true}
            />
            <div>
              <span style="color: var(--color-text);">mDNS</span>
              <p class="text-xs" style="color: var(--color-text-secondary);">Local network discovery</p>
            </div>
          </label>

          <label class="flex items-center gap-3 cursor-pointer p-2 rounded" style="background: var(--color-surface);">
            <input
              type="radio"
              name="discovery"
              value="dht"
              bind:group={p2pConfig.discoveryMethod}
              onchange={() => hasUnsavedChanges = true}
            />
            <div>
              <span style="color: var(--color-text);">DHT</span>
              <p class="text-xs" style="color: var(--color-text-secondary);">Distributed hash table for peer discovery</p>
            </div>
          </label>
        </div>
      </div>

      <div class="p-4 rounded-lg border" style="border-color: var(--color-border); background: var(--color-bg);">
        <h4 class="text-md font-medium mb-3" style="color: var(--color-text);">Security</h4>

        <div class="space-y-3">
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={p2pConfig.encryption}
              onchange={() => hasUnsavedChanges = true}
            />
            <div>
              <span style="color: var(--color-text);">End-to-End Encryption</span>
              <p class="text-xs" style="color: var(--color-text-secondary);">Encrypt all peer-to-peer communications</p>
            </div>
          </label>

          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={p2pConfig.peerAuthentication}
              onchange={() => hasUnsavedChanges = true}
            />
            <div>
              <span style="color: var(--color-text);">Peer Authentication</span>
              <p class="text-xs" style="color: var(--color-text-secondary);">Verify peer identity before connecting</p>
            </div>
          </label>

          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={p2pConfig.natTraversal}
              onchange={() => hasUnsavedChanges = true}
            />
            <div>
              <span style="color: var(--color-text);">NAT Traversal</span>
              <p class="text-xs" style="color: var(--color-text-secondary);">Enable connections through NAT gateways</p>
            </div>
          </label>
        </div>
      </div>

      <div class="p-4 rounded-lg border" style="border-color: var(--color-border); background: var(--color-bg);">
        <h4 class="text-md font-medium mb-3" style="color: var(--color-text);">Relay Servers</h4>

        <div class="flex gap-2 mb-3">
          <input
            type="text"
            class="input flex-1"
            placeholder="wss://relay.example.com"
            bind:value={newRelayServer}
            onkeydown={(e) => e.key === 'Enter' && addRelayServer()}
          />
          <Button variant="secondary" size="sm" onclick={addRelayServer}>
            Add
          </Button>
        </div>

        <div class="space-y-1">
          {#each p2pConfig.relayServers as server}
            <div class="flex items-center justify-between p-2 rounded" style="background: var(--color-surface);">
              <span class="text-sm" style="color: var(--color-text);">{server}</span>
              <button
                class="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                onclick={() => removeRelayServer(server)}
              >
                <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {:else}
    <p class="text-sm" style="color: var(--color-text-secondary);">
      Enable P2P networking to connect with other peers directly.
    </p>
  {/if}

  {#if hasUnsavedChanges}
    <div class="flex justify-end pt-4 border-t" style="border-color: var(--color-border);">
      <Button variant="primary" onclick={handleSave}>
        Save Changes
      </Button>
    </div>
  {/if}
</div>
