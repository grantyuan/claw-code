<script lang="ts">
  import { configStore } from '$stores/configStore';
  import { configService } from '$services/configService';
  import type { MCPConfig, MCPServer, ToolConfig } from '$types/config';
  import Button from '$components/common/Button.svelte';

  interface Props {
    onClose?: () => void;
  }

  let { onClose }: Props = $props();

  let mcpConfig = $state<MCPConfig>({
    servers: [],
    tools: [],
  });
  let hasUnsavedChanges = $state(false);

  $effect(() => {
    loadConfig();
  });

  async function loadConfig() {
    const config = await configService.loadGlobalConfig();
    mcpConfig = config.mcp;
  }

  async function addServer() {
    const newServer: MCPServer = {
      id: crypto.randomUUID(),
      name: 'New Server',
      url: 'http://localhost:3000',
      enabled: true,
    };
    mcpConfig.servers = [...mcpConfig.servers, newServer];
    hasUnsavedChanges = true;
  }

  async function deleteServer(id: string) {
    mcpConfig.servers = mcpConfig.servers.filter(s => s.id !== id);
    hasUnsavedChanges = true;
  }

  async function updateServer(id: string, updates: Partial<MCPServer>) {
    mcpConfig.servers = mcpConfig.servers.map(s => s.id === id ? { ...s, ...updates } : s);
    hasUnsavedChanges = true;
  }

  async function addTool() {
    const newTool: ToolConfig = {
      id: crypto.randomUUID(),
      name: 'New Tool',
      enabled: true,
      allowedAgents: [],
      safetyLevel: 'medium',
    };
    mcpConfig.tools = [...mcpConfig.tools, newTool];
    hasUnsavedChanges = true;
  }

  async function deleteTool(id: string) {
    mcpConfig.tools = mcpConfig.tools.filter(t => t.id !== id);
    hasUnsavedChanges = true;
  }

  async function updateTool(id: string, updates: Partial<ToolConfig>) {
    mcpConfig.tools = mcpConfig.tools.map(t => t.id === id ? { ...t, ...updates } : t);
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
    <h3 class="text-lg font-medium" style="color: var(--color-text);">MCP & Tools</h3>
    <Button variant="primary" size="sm" onclick={addServer}>
      Add Server
    </Button>
  </div>

  <div class="space-y-4">
    <div>
      <h4 class="text-md font-medium mb-3" style="color: var(--color-text);">MCP Servers</h4>

      <div class="space-y-2">
        {#each mcpConfig.servers as server (server.id)}
          <div class="p-4 rounded-lg border" style="border-color: var(--color-border); background: var(--color-bg);">
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-3 flex-1">
                <button
                  class="relative w-10 h-5 rounded-full transition-colors {server.enabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}"
                  onclick={() => updateServer(server.id, { enabled: !server.enabled })}
                  role="switch"
                  aria-checked={server.enabled}
                >
                  <span class="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform {server.enabled ? 'left-5' : 'left-0.5'}"></span>
                </button>
                <input
                  type="text"
                  class="input flex-1"
                  value={server.name}
                  onchange={(e) => updateServer(server.id, { name: (e.target as HTMLInputElement).value })}
                  placeholder="Server name"
                />
              </div>
              <Button variant="secondary" size="sm" onclick={() => deleteServer(server.id)}>
                Delete
              </Button>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-medium mb-1" style="color: var(--color-text);">URL</label>
                <input
                  type="url"
                  class="input w-full"
                  value={server.url}
                  onchange={(e) => updateServer(server.id, { url: (e.target as HTMLInputElement).value })}
                  placeholder="http://localhost:3000"
                />
              </div>
              <div>
                <label class="block text-xs font-medium mb-1" style="color: var(--color-text);">Authentication</label>
                <select
                  class="input w-full"
                  value={server.authentication?.type || 'none'}
                  onchange={(e) => {
                    const type = (e.target as HTMLSelectElement).value as any;
                    updateServer(server.id, {
                      authentication: type === 'none' ? undefined : { type, token: '', username: '', password: '' }
                    });
                  }}
                >
                  <option value="none">None</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="basic">Basic Auth</option>
                  <option value="api-key">API Key</option>
                </select>
              </div>
            </div>
          </div>
        {/each}

        {#if mcpConfig.servers.length === 0}
          <p class="text-sm text-center py-4" style="color: var(--color-text-secondary);">
            No MCP servers configured. Add one to enable tool calling.
          </p>
        {/if}
      </div>
    </div>

    <div class="border-t" style="border-color: var(--color-border);"></div>

    <div>
      <div class="flex items-center justify-between mb-3">
        <h4 class="text-md font-medium" style="color: var(--color-text);">Tool Configuration</h4>
        <Button variant="secondary" size="sm" onclick={addTool}>
          Add Tool
        </Button>
      </div>

      <div class="space-y-2">
        {#each mcpConfig.tools as tool (tool.id)}
          <div class="p-4 rounded-lg border" style="border-color: var(--color-border); background: var(--color-bg);">
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-3 flex-1">
                <button
                  class="relative w-10 h-5 rounded-full transition-colors {tool.enabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}"
                  onclick={() => updateTool(tool.id, { enabled: !tool.enabled })}
                  role="switch"
                  aria-checked={tool.enabled}
                >
                  <span class="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform {tool.enabled ? 'left-5' : 'left-0.5'}"></span>
                </button>
                <input
                  type="text"
                  class="input flex-1"
                  value={tool.name}
                  onchange={(e) => updateTool(tool.id, { name: (e.target as HTMLInputElement).value })}
                  placeholder="Tool name"
                />
              </div>
              <Button variant="secondary" size="sm" onclick={() => deleteTool(tool.id)}>
                Delete
              </Button>
            </div>

            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="block text-xs font-medium mb-1" style="color: var(--color-text);">Rate Limit (req/min)</label>
                <input
                  type="number"
                  class="input w-full"
                  value={tool.rateLimit || ''}
                  onchange={(e) => updateTool(tool.id, { rateLimit: parseInt((e.target as HTMLInputElement).value) || undefined })}
                  placeholder="No limit"
                />
              </div>
              <div>
                <label class="block text-xs font-medium mb-1" style="color: var(--color-text);">Safety Level</label>
                <select
                  class="input w-full"
                  value={tool.safetyLevel}
                  onchange={(e) => updateTool(tool.id, { safetyLevel: (e.target as HTMLSelectElement).value as any })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium mb-1" style="color: var(--color-text);">Allowed Agents</label>
                <input
                  type="text"
                  class="input w-full"
                  value={tool.allowedAgents.join(', ')}
                  onchange={(e) => updateTool(tool.id, { allowedAgents: (e.target as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean) })}
                  placeholder="All agents"
                />
              </div>
            </div>
          </div>
        {/each}

        {#if mcpConfig.tools.length === 0}
          <p class="text-sm text-center py-4" style="color: var(--color-text-secondary);">
            No tools configured.
          </p>
        {/if}
      </div>
    </div>
  </div>

  {#if hasUnsavedChanges}
    <div class="flex justify-end pt-4 border-t" style="border-color: var(--color-border);">
      <Button variant="primary" onclick={handleSave}>
        Save Changes
      </Button>
    </div>
  {/if}
</div>
