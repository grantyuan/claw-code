<script lang="ts">
  import { configStore } from '$stores/configStore';
  import { configService } from '$services/configService';
  import type { AgentConfig, AgentConfigs } from '$types/config';
  import Button from '$components/common/Button.svelte';

  interface Props {
    onClose?: () => void;
  }

  let { onClose }: Props = $props();

  let agentsConfig = $state<AgentConfigs>({
    roles: [],
    collaborationPattern: 'sequential',
    conflictResolution: 'leader-decides',
  });
  let hasUnsavedChanges = $state(false);

  $effect(() => {
    loadConfig();
  });

  async function loadConfig() {
    const config = await configService.loadGlobalConfig();
    agentsConfig = config.agents;
  }

  async function addAgent() {
    const newAgent: AgentConfig = {
      id: crypto.randomUUID(),
      name: 'New Agent',
      type: 'worker',
      capabilities: [],
      config: {},
    };
    agentsConfig.roles = [...agentsConfig.roles, newAgent];
    hasUnsavedChanges = true;
  }

  async function deleteAgent(id: string) {
    agentsConfig.roles = agentsConfig.roles.filter(a => a.id !== id);
    hasUnsavedChanges = true;
  }

  async function updateAgent(id: string, updates: Partial<AgentConfig>) {
    agentsConfig.roles = agentsConfig.roles.map(a => a.id === id ? { ...a, ...updates } : a);
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
    <h3 class="text-lg font-medium" style="color: var(--color-text);">Agents Configuration</h3>
    <Button variant="primary" size="sm" onclick={addAgent}>
      Add Agent
    </Button>
  </div>

  <div class="space-y-4">
    <div class="p-4 rounded-lg border" style="border-color: var(--color-border); background: var(--color-bg);">
      <h4 class="text-md font-medium mb-3" style="color: var(--color-text);">Collaboration Settings</h4>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-2" style="color: var(--color-text);">Collaboration Pattern</label>
          <select
            class="input w-full"
            bind:value={agentsConfig.collaborationPattern}
            onchange={() => hasUnsavedChanges = true}
          >
            <option value="sequential">Sequential - Agents work one after another</option>
            <option value="parallel">Parallel - Agents work simultaneously</option>
            <option value="hybrid">Hybrid - Mix of sequential and parallel</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium mb-2" style="color: var(--color-text);">Conflict Resolution</label>
          <select
            class="input w-full"
            bind:value={agentsConfig.conflictResolution}
            onchange={() => hasUnsavedChanges = true}
          >
            <option value="leader-decides">Leader Decides</option>
            <option value="vote">Vote - Majority wins</option>
            <option value="priority">Priority - Higher priority wins</option>
          </select>
        </div>
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium mb-2" style="color: var(--color-text);">Agent Roles</label>

      <div class="space-y-2">
        {#each agentsConfig.roles as agent (agent.id)}
          <div class="p-4 rounded-lg border" style="border-color: var(--color-border); background: var(--color-bg);">
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-3">
                <select
                  class="input"
                  value={agent.type}
                  onchange={(e) => updateAgent(agent.id, { type: (e.target as HTMLSelectElement).value as any })}
                >
                  <option value="leader">Leader</option>
                  <option value="worker">Worker</option>
                  <option value="specialist">Specialist</option>
                </select>
                <input
                  type="text"
                  class="input"
                  value={agent.name}
                  onchange={(e) => updateAgent(agent.id, { name: (e.target as HTMLInputElement).value })}
                  placeholder="Agent name"
                />
              </div>
              <Button variant="secondary" size="sm" onclick={() => deleteAgent(agent.id)}>
                Delete
              </Button>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-medium mb-1" style="color: var(--color-text);">Model ID</label>
                <input
                  type="text"
                  class="input w-full"
                  value={agent.modelId || ''}
                  onchange={(e) => updateAgent(agent.id, { modelId: (e.target as HTMLInputElement).value || undefined })}
                  placeholder="e.g., claude-opus-4"
                />
              </div>
              <div>
                <label class="block text-xs font-medium mb-1" style="color: var(--color-text);">Provider ID</label>
                <input
                  type="text"
                  class="input w-full"
                  value={agent.providerId || ''}
                  onchange={(e) => updateAgent(agent.id, { providerId: (e.target as HTMLInputElement).value || undefined })}
                  placeholder="e.g., anthropic"
                />
              </div>
            </div>

            <div class="mt-3">
              <label class="block text-xs font-medium mb-1" style="color: var(--color-text);">Capabilities</label>
              <div class="flex flex-wrap gap-2">
                {#each ['coding', 'reasoning', 'creativity', 'analysis', 'research', 'writing'] as cap}
                  <label class="flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer" style="background: var(--color-surface);">
                    <input
                      type="checkbox"
                      checked={agent.capabilities.includes(cap)}
                      onchange={(e) => {
                        const checked = (e.target as HTMLInputElement).checked;
                        const newCaps = checked
                          ? [...agent.capabilities, cap]
                          : agent.capabilities.filter(c => c !== cap);
                        updateAgent(agent.id, { capabilities: newCaps });
                      }}
                    />
                    <span style="color: var(--color-text);">{cap}</span>
                  </label>
                {/each}
              </div>
            </div>
          </div>
        {/each}

        {#if agentsConfig.roles.length === 0}
          <p class="text-sm text-center py-4" style="color: var(--color-text-secondary);">
            No agents configured. Click "Add Agent" to create one.
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
