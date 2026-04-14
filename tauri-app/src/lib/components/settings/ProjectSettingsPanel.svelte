<script lang="ts">
  import { configService } from '$services/configService';
  import type { ProjectConfig, ProjectRules, ExclusionSettings } from '$types/config';
  import Button from '$components/common/Button.svelte';

  interface Props {
    projectPath: string;
    onClose?: () => void;
  }

  let { projectPath, onClose }: Props = $props();

  let projectConfig = $state<ProjectConfig | null>(null);
  let isLoading = $state(true);
  let hasUnsavedChanges = $state(false);

  let inheritGlobal = $state(true);
  let rules = $state<ProjectRules>({
    enabled: false,
    instructions: '',
    additionalRules: [],
  });
  let exclusions = $state<ExclusionSettings>({
    directories: [],
    files: [],
    patterns: [],
  });

  let newDirectory = $state('');
  let newFile = $state('');
  let newPattern = $state('');

  $effect(() => {
    loadProjectConfig();
  });

  async function loadProjectConfig() {
    isLoading = true;
    try {
      const config = await configService.loadProjectConfig(projectPath);
      if (config) {
        projectConfig = config;
        inheritGlobal = config.inheritGlobal;
        rules = config.project.rules;
        exclusions = config.project.exclusions;
      } else {
        projectConfig = await configService.createProjectConfig(projectPath, true);
        inheritGlobal = true;
      }
    } catch (e) {
      console.error('Failed to load project config:', e);
    } finally {
      isLoading = false;
    }
  }

  async function handleSave() {
    if (!projectConfig) return;

    projectConfig.inheritGlobal = inheritGlobal;
    projectConfig.project.rules = rules;
    projectConfig.project.exclusions = exclusions;

    await configService.saveProjectConfig(projectPath, projectConfig);
    hasUnsavedChanges = false;
  }

  async function restoreDefaults() {
    if (!confirm('This will reset all project settings to global defaults. Continue?')) return;

    inheritGlobal = true;
    rules = {
      enabled: false,
      instructions: '',
      additionalRules: [],
    };
    exclusions = {
      directories: ['node_modules', '.git', 'dist', 'build', 'target', '__pycache__'],
      files: ['*.log', '*.tmp', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'],
      patterns: ['**/cache/**', '**/tmp/**', '**/.DS_Store'],
    };

    hasUnsavedChanges = true;
    await handleSave();
  }

  function addDirectory() {
    if (!newDirectory.trim()) return;
    exclusions.directories = [...exclusions.directories, newDirectory.trim()];
    newDirectory = '';
    hasUnsavedChanges = true;
  }

  function removeDirectory(dir: string) {
    exclusions.directories = exclusions.directories.filter(d => d !== dir);
    hasUnsavedChanges = true;
  }

  function addFile() {
    if (!newFile.trim()) return;
    exclusions.files = [...exclusions.files, newFile.trim()];
    newFile = '';
    hasUnsavedChanges = true;
  }

  function removeFile(file: string) {
    exclusions.files = exclusions.files.filter(f => f !== file);
    hasUnsavedChanges = true;
  }

  function addPattern() {
    if (!newPattern.trim()) return;
    exclusions.patterns = [...exclusions.patterns, newPattern.trim()];
    newPattern = '';
    hasUnsavedChanges = true;
  }

  function removePattern(pattern: string) {
    exclusions.patterns = exclusions.patterns.filter(p => p !== pattern);
    hasUnsavedChanges = true;
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
  <div class="w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden flex" style="background-color: var(--color-surface); border: 1px solid var(--color-border);">
    <div class="flex-1 flex flex-col overflow-hidden">
      <div class="px-6 py-4 border-b flex items-center justify-between" style="border-color: var(--color-border);">
        <div>
          <h2 class="text-lg font-semibold" style="color: var(--color-text);">Project Settings</h2>
          <p class="text-xs mt-1" style="color: var(--color-text-secondary);">{projectPath}</p>
        </div>
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

      {#if isLoading}
        <div class="flex items-center justify-center h-64">
          <div class="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full"></div>
        </div>
      {:else}
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          <div class="flex items-center justify-between p-4 rounded-lg border" style="border-color: var(--color-border); background: var(--color-bg);">
            <div>
              <h3 class="font-medium" style="color: var(--color-text);">Inherit Global Settings</h3>
              <p class="text-xs mt-1" style="color: var(--color-text-secondary);">
                When enabled, project uses global configuration with project-specific overrides below.
              </p>
            </div>
            <button
              class="relative w-12 h-6 rounded-full transition-colors {inheritGlobal ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}"
              onclick={() => { inheritGlobal = !inheritGlobal; hasUnsavedChanges = true; }}
              role="switch"
              aria-checked={inheritGlobal}
            >
              <span
                class="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform {inheritGlobal ? 'left-7' : 'left-1'}"
              ></span>
            </button>
          </div>

          <div class="space-y-6">
            <div class="p-4 rounded-lg border" style="border-color: var(--color-border); background: var(--color-bg);">
              <h3 class="font-medium mb-3" style="color: var(--color-text);">Exclusion Settings</h3>
              <p class="text-xs mb-4" style="color: var(--color-text-secondary);">
                Configure directories, files, and patterns to restrict LLM read/write access.
              </p>

              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium mb-2" style="color: var(--color-text);">Directories</label>
                  <div class="flex gap-2 mb-2">
                    <input
                      type="text"
                      class="input flex-1"
                      placeholder="e.g., node_modules"
                      bind:value={newDirectory}
                      onkeydown={(e) => e.key === 'Enter' && addDirectory()}
                    />
                    <Button variant="secondary" size="sm" onclick={addDirectory}>Add</Button>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    {#each exclusions.directories as dir (dir)}
                      <span class="px-2 py-1 rounded text-xs flex items-center gap-1" style="background: var(--color-surface); color: var(--color-text);">
                        {dir}
                        <button onclick={() => removeDirectory(dir)} class="hover:text-red-500">
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    {/each}
                  </div>
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2" style="color: var(--color-text);">File Patterns</label>
                  <div class="flex gap-2 mb-2">
                    <input
                      type="text"
                      class="input flex-1"
                      placeholder="e.g., *.log"
                      bind:value={newFile}
                      onkeydown={(e) => e.key === 'Enter' && addFile()}
                    />
                    <Button variant="secondary" size="sm" onclick={addFile}>Add</Button>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    {#each exclusions.files as file (file)}
                      <span class="px-2 py-1 rounded text-xs flex items-center gap-1" style="background: var(--color-surface); color: var(--color-text);">
                        {file}
                        <button onclick={() => removeFile(file)} class="hover:text-red-500">
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    {/each}
                  </div>
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2" style="color: var(--color-text);">Glob Patterns</label>
                  <div class="flex gap-2 mb-2">
                    <input
                      type="text"
                      class="input flex-1"
                      placeholder="e.g., **/cache/**"
                      bind:value={newPattern}
                      onkeydown={(e) => e.key === 'Enter' && addPattern()}
                    />
                    <Button variant="secondary" size="sm" onclick={addPattern}>Add</Button>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    {#each exclusions.patterns as pattern (pattern)}
                      <span class="px-2 py-1 rounded text-xs flex items-center gap-1" style="background: var(--color-surface); color: var(--color-text);">
                        {pattern}
                        <button onclick={() => removePattern(pattern)} class="hover:text-red-500">
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    {/each}
                  </div>
                </div>
              </div>
            </div>

            <div class="p-4 rounded-lg border" style="border-color: var(--color-border); background: var(--color-bg);">
              <div class="flex items-center justify-between mb-3">
                <h3 class="font-medium" style="color: var(--color-text);">Project Rules (CLAUDE.md style)</h3>
                <button
                  class="relative w-10 h-5 rounded-full transition-colors {rules.enabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}"
                  onclick={() => { rules.enabled = !rules.enabled; hasUnsavedChanges = true; }}
                  role="switch"
                  aria-checked={rules.enabled}
                >
                  <span
                    class="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform {rules.enabled ? 'left-5' : 'left-0.5'}"
                  ></span>
                </button>
              </div>

              {#if rules.enabled}
                <div class="space-y-3">
                  <div>
                    <label class="block text-xs font-medium mb-1" style="color: var(--color-text);">Project Instructions</label>
                    <textarea
                      class="input w-full h-32 font-mono text-sm"
                      placeholder="Enter project-specific instructions for the LLM..."
                      bind:value={rules.instructions}
                      oninput={() => hasUnsavedChanges = true}
                    ></textarea>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </div>

        <div class="px-6 py-4 border-t flex justify-between" style="border-color: var(--color-border);">
          <Button variant="secondary" onclick={restoreDefaults}>
            Restore Defaults
          </Button>
          <div class="flex gap-3">
            <Button variant="secondary" onclick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onclick={handleSave} disabled={!hasUnsavedChanges}>
              Save Changes
            </Button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
