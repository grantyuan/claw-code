<script lang="ts">
  import { projectService } from '$services/projectService';
  import type { Project } from '$types/project';
  import Button from '$components/common/Button.svelte';

  interface Props {
    selectedProjectId?: string | null;
    onSelectProject: (project: Project) => void;
    onClose?: () => void;
  }

  let { selectedProjectId = null, onSelectProject, onClose }: Props = $props();

  let projects = $state<Project[]>([]);
  let searchQuery = $state('');
  let isLoading = $state(true);

  $effect(() => {
    loadProjects();
  });

  async function loadProjects() {
    isLoading = true;
    try {
      await projectService.init();
      projects = await projectService.listProjects();
    } catch (e) {
      console.error('Failed to load projects:', e);
    } finally {
      isLoading = false;
    }
  }

  function filteredProjects(): Project[] {
    if (!searchQuery.trim()) return projects;

    const query = searchQuery.toLowerCase();
    return projects.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.path.toLowerCase().includes(query)
    );
  }

  function handleSelect(project: Project) {
    onSelectProject(project);
    onClose?.();
  }

  async function handleCreateProject() {
    const path = prompt('Enter project directory path:');
    if (path) {
      try {
        const project = await projectService.createProject(path);
        projects = [...projects, project];
        handleSelect(project);
      } catch (e) {
        console.error('Failed to create project:', e);
        alert('Failed to create project');
      }
    }
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
  <div class="w-full max-w-2xl max-h-[80vh] rounded-xl shadow-2xl overflow-hidden" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
    <div class="px-6 py-4 border-b flex items-center justify-between" style="border-color: var(--color-border);">
      <h2 class="text-lg font-semibold" style="color: var(--color-text);">Select Project</h2>
      <button
        class="p-1 rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
        onclick={onClose}
        aria-label="Close"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="p-4 border-b" style="border-color: var(--color-border);">
      <div class="relative">
        <input
          type="text"
          placeholder="Search projects..."
          class="w-full px-4 py-2 pl-10 rounded-lg"
          style="background-color: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text);"
          bind:value={searchQuery}
        />
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style="color: var(--color-text-secondary);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
    </div>

    <div class="max-h-96 overflow-y-auto">
      {#if isLoading}
        <div class="flex items-center justify-center h-32">
          <div class="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full"></div>
        </div>
      {:else if filteredProjects().length === 0}
        <div class="flex flex-col items-center justify-center h-32">
          <svg class="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p class="text-sm" style="color: var(--color-text-secondary);">No projects found</p>
        </div>
      {:else}
        {#each filteredProjects() as project (project.id)}
          <button
            class="w-full px-4 py-3 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 {selectedProjectId === project.id ? 'bg-primary-100 dark:bg-primary-900' : ''}"
            onclick={() => handleSelect(project)}
          >
            <div class="flex items-center gap-3">
              <span class="w-3 h-3 rounded-full" style="background-color: {project.color};"></span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-medium" style="color: var(--color-text);">{project.name}</span>
                  {#if project.icon}
                    <span>{project.icon}</span>
                  {/if}
                </div>
                <p class="text-xs truncate mt-0.5" style="color: var(--color-text-secondary);">{project.path}</p>
              </div>
              <div class="text-xs" style="color: var(--color-text-secondary);">
                {project.sessionCount} sessions
              </div>
            </div>
          </button>
        {/each}
      {/if}
    </div>

    <div class="px-4 py-3 border-t" style="border-color: var(--color-border);">
      <Button variant="secondary" size="sm" class="w-full" onclick={handleCreateProject}>
        + Create New Project
      </Button>
    </div>
  </div>
</div>
