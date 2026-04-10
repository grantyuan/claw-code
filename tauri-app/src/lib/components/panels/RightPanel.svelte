<script lang="ts">
  import { agentStore, agentList, leaderAgent, selectedAgent, activeAgents } from '$stores/agentStore';
  import { taskStore, activeTaskList, pendingTaskList, completedTaskList, overallProgress } from '$stores/taskStore';
  import { uiStore } from '$stores/uiStore';
  import { AgentStatus, AgentRole } from '$types/agent';
  import { TaskStatus, TaskPriority } from '$types/task';
  import StatusBadge from '$components/common/StatusBadge.svelte';
  import ProgressBar from '$components/common/ProgressBar.svelte';
  import { formatTimestamp, formatDuration } from '$utils/formatting';

  let agents = $derived($agentList);
  let leader = $derived($leaderAgent);
  let selected = $derived($selectedAgent);
  let activeTasks = $derived($activeTaskList);
  let pendingTasks = $derived($pendingTaskList);
  let completedTasks = $derived($completedTaskList);
  let progress = $derived($overallProgress);
  let activeView = $derived($uiStore.activeView);

  function selectAgent(agentId: string) {
    agentStore.setSelectedAgent(agentId);
    uiStore.setActiveView('agent-detail', agentId);
  }

  function goBack() {
    agentStore.setSelectedAgent(null);
    uiStore.setActiveView('default');
  }

  function getRoleIcon(role: AgentRole): string {
    const icons: Record<string, string> = {
      leader: '👑',
      coder: '💻',
      reviewer: '🔍',
      tester: '🧪',
      planner: '📋',
      analyzer: '📊',
      custom: '⚙️',
    };
    return icons[role] || '🤖';
  }

  function getPriorityClass(priority: TaskPriority): string {
    const classes: Record<string, string> = {
      low: 'border-l-gray-400',
      medium: 'border-l-blue-400',
      high: 'border-l-yellow-400',
      critical: 'border-l-red-400',
    };
    return classes[priority] || '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && activeView === 'agent-detail') {
      goBack();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="panel h-full flex flex-col" style="background-color: var(--color-surface);">
  <div class="panel-header">
    <div class="flex items-center gap-3">
      {#if activeView === 'agent-detail' && selected}
        <button 
          class="p-1 rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
          onclick={goBack}
          title="Back to overview"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 class="text-lg font-semibold" style="color: var(--color-text);">
          {getRoleIcon(selected.role)} {selected.name}
        </h2>
      {:else}
        <h2 class="text-lg font-semibold" style="color: var(--color-text);">Agent Dashboard</h2>
      {/if}
    </div>
    <div class="flex items-center gap-2">
      <span class="text-xs px-2 py-1 rounded" style="color: var(--color-text); background-color: var(--color-border);">
        {$activeAgents.length} active
      </span>
    </div>
  </div>

  {#if activeView === 'agent-detail' && selected}
    <div class="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="text-2xl">{getRoleIcon(selected.role)}</span>
            <div>
              <h3 class="font-semibold" style="color: var(--color-text);">{selected.name}</h3>
              <p class="text-xs" style="color: var(--color-border);">{selected.model}</p>
            </div>
          </div>
          <StatusBadge status={selected.status} />
        </div>
        
        {#if selected.currentTask}
          <div class="mb-3">
            <p class="text-xs mb-1" style="color: var(--color-border);">Current Task</p>
            <p class="text-sm" style="color: var(--color-text);">{selected.currentTask}</p>
          </div>
        {/if}
        
        <ProgressBar label="Progress" progress={selected.progress} size="sm" />
      </div>

      <div class="card">
        <h4 class="font-medium mb-3" style="color: var(--color-text);">Metrics</h4>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <p class="text-xs" style="color: var(--color-border);">Tasks Completed</p>
            <p class="text-lg font-semibold" style="color: var(--color-text);">{selected.metrics.tasksCompleted}</p>
          </div>
          <div>
            <p class="text-xs" style="color: var(--color-border);">Tasks Failed</p>
            <p class="text-lg font-semibold text-red-500">{selected.metrics.tasksFailed}</p>
          </div>
          <div>
            <p class="text-xs" style="color: var(--color-border);">Avg Response</p>
            <p class="text-lg font-semibold" style="color: var(--color-text);">{formatDuration(selected.metrics.averageResponseTime)}</p>
          </div>
          <div>
            <p class="text-xs" style="color: var(--color-border);">Tokens Used</p>
            <p class="text-lg font-semibold" style="color: var(--color-text);">{selected.metrics.totalTokensUsed.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  {:else}
    <div class="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
      <div>
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-medium" style="color: var(--color-text);">Overall Progress</h3>
          <span class="text-sm font-medium" style="color: var(--color-text);">{progress}%</span>
        </div>
        <ProgressBar label="" progress={progress} showPercentage={false} size="md" />
      </div>

      <div>
        <h3 class="text-sm font-medium mb-2" style="color: var(--color-text);">Active Agents</h3>
        <div class="space-y-2">
          {#each agents as agent (agent.id)}
            <button
              class="w-full card flex items-center gap-3 p-3 cursor-pointer hover:ring-1 hover:ring-primary-500 transition-all"
              onclick={() => selectAgent(agent.id)}
            >
              <span class="text-xl">{getRoleIcon(agent.role)}</span>
              <div class="flex-1 text-left">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium" style="color: var(--color-text);">{agent.name}</span>
                  {#if agent.role === AgentRole.Leader}
                    <span class="text-xs px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300">Leader</span>
                  {/if}
                </div>
                {#if agent.currentTask}
                  <p class="text-xs truncate" style="color: var(--color-border);">{agent.currentTask}</p>
                {/if}
              </div>
              <StatusBadge status={agent.status} />
            </button>
          {/each}
        </div>
      </div>

      <div>
        <h3 class="text-sm font-medium mb-2" style="color: var(--color-text);">Active Tasks ({activeTasks.length})</h3>
        <div class="space-y-2">
          {#each activeTasks as task (task.id)}
            <div class="card p-3 border-l-4 {getPriorityClass(task.priority)}">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium" style="color: var(--color-text);">{task.name}</span>
                <span class="text-xs" style="color: var(--color-border);">{task.progress}%</span>
              </div>
              <ProgressBar label="" progress={task.progress} showPercentage={false} size="sm" variant="default" />
            </div>
          {/each}
        </div>
      </div>

      <div>
        <h3 class="text-sm font-medium mb-2" style="color: var(--color-text);">Pending Tasks ({pendingTasks.length})</h3>
        <div class="space-y-1">
          {#each pendingTasks as task (task.id)}
            <div class="flex items-center gap-2 p-2 rounded-lg" style="background-color: var(--color-bg);">
              <span class="w-2 h-2 rounded-full {task.priority === TaskPriority.Critical ? 'bg-red-400' : task.priority === TaskPriority.High ? 'bg-yellow-400' : 'bg-blue-400'}"></span>
              <span class="text-sm flex-1" style="color: var(--color-text);">{task.name}</span>
              <span class="text-xs" style="color: var(--color-border);">{task.priority}</span>
            </div>
          {/each}
        </div>
      </div>

      {#if completedTasks.length > 0}
        <div>
          <h3 class="text-sm font-medium mb-2" style="color: var(--color-text);">Completed ({completedTasks.length})</h3>
          <div class="space-y-1">
            {#each completedTasks.slice(0, 5) as task (task.id)}
              <div class="flex items-center gap-2 p-2 rounded-lg" style="background-color: var(--color-bg);">
                <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <span class="text-sm flex-1" style="color: var(--color-text);">{task.name}</span>
                {#if task.completedAt}
                  <span class="text-xs" style="color: var(--color-border);">{formatTimestamp(task.completedAt)}</span>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
