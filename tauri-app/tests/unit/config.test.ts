import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Project Configuration', () => {
  it('should have valid tsconfig.json', () => {
    const configPath = join(process.cwd(), 'tsconfig.json');
    expect(existsSync(configPath)).toBe(true);
    
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(config.compilerOptions).toBeDefined();
    expect(config.compilerOptions.target).toBe('ES2020');
    expect(config.compilerOptions.module).toBe('ESNext');
    expect(config.compilerOptions.strict).toBe(true);
  });

  it('should have valid vite.config.ts', () => {
    const configPath = join(process.cwd(), 'vite.config.ts');
    expect(existsSync(configPath)).toBe(true);
  });

  it('should have valid svelte.config.js', () => {
    const configPath = join(process.cwd(), 'svelte.config.js');
    expect(existsSync(configPath)).toBe(true);
  });
});
