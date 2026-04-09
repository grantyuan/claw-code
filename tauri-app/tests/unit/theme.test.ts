import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('TailwindCSS Configuration', () => {
  it('should have tailwind.config.js with dark mode support', () => {
    const configPath = join(process.cwd(), 'tailwind.config.js');
    expect(existsSync(configPath)).toBe(true);
    
    const configContent = readFileSync(configPath, 'utf-8');
    expect(configContent).toContain('darkMode');
    expect(configContent).toContain('class');
  });

  it('should have global.css with Tailwind import', () => {
    const cssPath = join(process.cwd(), 'src/static/styles/global.css');
    expect(existsSync(cssPath)).toBe(true);
    
    const cssContent = readFileSync(cssPath, 'utf-8');
    expect(cssContent).toContain('tailwindcss');
  });

  it('should have postcss.config.js', () => {
    const configPath = join(process.cwd(), 'postcss.config.js');
    expect(existsSync(configPath)).toBe(true);
  });
});
