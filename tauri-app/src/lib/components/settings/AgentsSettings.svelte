<script lang="ts">
  import { configStore } from '$stores/configStore';
  import { agentStore } from '$stores/agentStore';
  import { toastStore } from '$stores/toastStore';

  let config = $derived($configStore.config);
  let agentRoles = $derived(config?.agents?.roles || []);
  let collaborationPattern = $derived(config?.agents?.collaborationPattern || 'sequential');
  let conflictResolution = $derived(config?.agents?.conflictResolution || 'leader-decides');

  let showAddRole = $state(false);
  let newRoleName = $state('');
  let newRoleType = $state('worker');
  let newRoleDescription = $state('');

  function addRole() {
    if (!newRoleName.trim()) {
      toastStore.addToast({ type: 'error', message: 'Role name is required', duration: 3000 });
      return;
    }

    const newRole = {
      id: `role-${Date.now()}`,
      name: newRoleName.trim(),
      type: newRoleType,
      description: newRoleDescription.trim(),
      capabilities: [],
      systemPrompt: '',
    };

    configStore.updateConfig({
      ...config,
      agents: {
        ...config?.agents,
        roles: [...agentRoles, newRole],
      },
    });

    agentStore.addAgent({
      id: newRole.id,
      name: newRole.name,
      role: newRole.type,
      status: 'idle',
      capabilities: newRole.capabilities,
    });

    newRoleName = '';
    newRoleType = 'worker';
    newRoleDescription = '';
    showAddRole = false;

    toastStore.addToast({ type: 'success', message: `Role "${newRole.name}" added`, duration: 3000 });
  }

  function removeRole(id: string) {
    configStore.updateConfig({
      ...config,
      agents: {
        ...config?.agents,
        roles: agentRoles.filter((r: any) => r.id !== id),
      },
    });

    agentStore.removeAgent(id);
    toastStore.addToast({ type: 'info', message: 'Role removed', duration: 2000 });
  }

  function updateCollaborationPattern(pattern: string) {
    collaborationPattern = pattern;
    configStore.updateConfig({
      ...config,
      agents: {
        ...config?.agents,
        collaborationPattern: pattern,
      },
    });
    toastStore.addToast({ type: 'success', message: `Collaboration pattern set to "${pattern}"`, duration: 2000 });
  }

  function updateConflictResolution(strategy: string) {
    conflictResolution = strategy;
    configStore.updateConfig({
      ...config,
      agents: {
        ...config?.agents,
        conflictResolution: strategy,
      },
    });
    toastStore.addToast({ type: 'success', message: `Conflict resolution set to "${strategy}"`, duration: 2000 });
  }

  const collaborationPatterns = [
    { value: 'sequential', label: 'Sequential', desc: 'Agents work one after another in order' },
    { value: 'parallel', label: 'Parallel', desc: 'Agents work simultaneously on different tasks' },
    { value: 'hierarchical', label: 'Hierarchical', desc: 'Leader delegates tasks to workers' },
    { value: 'collaborative', label: 'Collaborative', desc: 'Agents discuss and decide together' },
  ];

  const conflictStrategies = [
    { value: 'leader-decides', label: 'Leader Decides', desc: 'The leader agent makes the final call' },
    { value: 'voting', label: 'Voting', desc: 'Majority vote among agents' },
    { value: 'consensus', label: 'Consensus', desc: 'All agents must agree' },
    { value: 'priority', label: 'Priority-based', desc: 'Higher priority agent wins' },
  ];
</script>

<div class="space-y-6">
  <div>
    <h4 class="text-md font-medium mb-3" style="color: var(--color-text);">Collaboration Pattern</h4>
    <p class="text-sm mb-3" style="color: var(--color-text-secondary);">How agents work together on tasks</p>
    <div class="grid grid-cols-2 gap-2">
      {#each collaborationPatterns as pattern}
        <button
          class="p-3 rounded-lg text-left transition-colors border {collaborationPattern === pattern.value ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : ''}"
          style="border-color: {collaborationPattern === pattern.value ? 'var(--color-primary-500, #3b82f6)' : 'var(--color-border)'}; background-color: {collaborationPattern === pattern.value ? 'var(--color-primary-50, #eff6ff)' : 'var(--color-bg)'};"
          onclick={() => updateCollaborationPattern(pattern.value)}
        >
          <div class="text-sm font-medium" style="color: var(--color-text);">{pattern.label}</div>
          <div class="text-xs mt-1" style="color: var(--color-text-secondary);">{pattern.desc}</div>
        </button>
      {/each}
    </div>
  </div>

  <div>
    <h4 class="text-md font-medium mb-3" style="color: var(--color-text);">Conflict Resolution</h4>
    <p class="text-sm mb-3" style="color: var(--color-text-secondary);">How disagreements between agents are resolved</p>
    <div class="grid grid-cols-2 gap-2">
      {#each conflictStrategies as strategy}
        <button
          class="p-3 rounded-lg text-left transition-colors border {conflictResolution === strategy.value ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : ''}"
          style="border-color: {conflictResolution === strategy.value ? 'var(--color-primary-500, #3b82f6)' : 'var(--color-border)'}; background-color: {conflictResolution === strategy.value ? 'var(--color-primary-50, #eff6ff)' : 'var(--color-bg)'};"
          onclick={() => updateConflictResolution(strategy.value)}
        >
          <div class="text-sm font-medium" style="color: var(--color-text);">{strategy.label}</div>
          <div class="text-xs mt-1" style="color: var(--color-text-secondary);">{strategy.desc}</div>
        </button>
      {/each}
    </div>
  </div>

  <div>
    <div class="flex items-center justify-between mb-3">
      <div>
        <h4 class="text-md font-medium" style="color: var(--color-text);">Agent Roles</h4>
        <p class="text-sm" style="color: var(--color-text-secondary);">Define the roles agents can play</p>
      </div>
      <button
        class="px-3 py-1.5 rounded-lg text-sm font-medium"
        style="background-color: var(--color-primary-500, #3b82f6); color: white;"
        onclick={() => showAddRole = !showAddRole}
      >
        {showAddRole ? 'Cancel' : '+ Add Role'}
      </button>
    </div>

    {#if showAddRole}
      <div class="p-4 mb-4 rounded-lg border" style="background-color: var(--color-bg); border-color: var(--color-border);">
        <div class="space-y-3">
          <div>
            <label class="block text-sm mb-1" style="color: var(--color-text-secondary);">Role Name</label>
            <input type="text" class="input" placeholder="e.g., Code Reviewer" bind:value={newRoleName} />
          </div>
          <div>
            <label class="block text-sm mb-1" style="color: var(--color-text-secondary);">Type</label>
            <select class="input" bind:value={newRoleType}>
              <option value="leader">Leader</option>
              <option value="worker">Worker</option>
              <option value="reviewer">Reviewer</option>
              <option value="specialist">Specialist</option>
            </select>
          </div>
          <div>
            <label class="block text-sm mb-1" style="color: var(--color-text-secondary);">Description</label>
            <textarea class="input resize-none" rows="2" placeholder="What does this agent do?" bind:value={newRoleDescription}></textarea>
          </div>
          <button
            class="w-full px-3 py-2 rounded-lg text-sm font-medium"
            style="background-color: var(--color-primary-500, #3b82f6); color: white;"
            onclick={addRole}
          >
            Add Role
          </button>
        </div>
      </div>
    {/if}

    {#if agentRoles.length === 0}
      <div class="p-4 rounded-lg text-center" style="background-color: var(--color-bg); border: 1px dashed var(--color-border);">
        <p class="text-sm" style="color: var(--color-text-secondary);">No agent roles configured</p>
        <p class="text-xs mt-1" style="color: var(--color-text-secondary);">Add roles to define how agents collaborate</p>
      </div>
    {:else}
      <div class="space-y-2">
        {#each agentRoles as role (role.id)}
          <div class="p-3 rounded-lg flex items-center gap-3" style="background-color: var(--color-bg); border: 1px solid var(--color-border);">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium" style="color: var(--color-text);">{role.name}</span>
                <span class="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">{role.type}</span>
              </div>
              {#if role.description}
                <p class="text-xs mt-1" style="color: var(--color-text-secondary);">{role.description}</p>
              {/if}
            </div>
            <button
              class="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900"
              style="color: #ef4444;"
              onclick={() => removeRole(role.id)}
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
