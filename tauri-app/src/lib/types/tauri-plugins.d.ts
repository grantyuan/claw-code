declare module '@tauri-apps/plugin-dialog' {
  interface OpenDialogOptions {
    directory?: boolean;
    multiple?: boolean;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }

  export function open(options?: OpenDialogOptions): Promise<string | null | string[]>;
}

declare module '@tauri-apps/plugin-fs' {
  export function readFile(path: string, options?: { encoding: string }): Promise<string>;
  export function writeFile(path: string, data: string | Uint8Array, options?: { encoding?: string }): Promise<void>;
  export function exists(path: string): Promise<boolean>;
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
}
