import 'fake-indexeddb/auto';
import { vi } from 'vitest';

Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => Math.random().toString(36).substring(2, 15)),
  },
  writable: true,
  configurable: true,
});
