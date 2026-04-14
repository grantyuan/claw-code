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
    if (selected === null) {
      return null;
    }
    if (Array.isArray(selected)) {
      return selected.length > 0 ? selected[0] : null;
    }
    return selected;
  } catch {
    return null;
  }
}
