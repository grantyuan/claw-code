/**
 * Open a native folder selection dialog using Tauri's dialog plugin.
 * Returns the selected folder path, or null if cancelled / Tauri unavailable.
 */
export async function browseFolder(currentPath?: string): Promise<string | null> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      directory: true,
      multiple: false,
      defaultPath: currentPath || undefined,
    });
    // open() returns string | string[] | null
    if (typeof selected === 'string') return selected;
    if (Array.isArray(selected) && selected.length > 0) return selected[0];
    return null;
  } catch {
    // Tauri runtime not available (browser / E2E test environment)
    return null;
  }
}
