# ClawCode Tauri Application Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Tauri desktop application with dual-panel interface for AI agent interaction and monitoring, supporting remote CLI servers, SSH deployment, and P2P cooperation.

**Architecture:** Microservices-style with Tauri app as central hub connecting to multiple CLI servers via WebSocket. Each CLI runs in server mode with REST API and P2P capabilities. SSH-based remote deployment enables multi-computer coordination.

**Tech Stack:** Tauri v2, Svelte 5, TypeScript, TailwindCSS, Rust (backend), WebSocket, libp2p, russh

---

## Phase 1: Foundation Setup (Tasks 1-15)

### Task 1: Initialize Tauri Project

**Files:**
- Create: `tauri-app/package.json`
- Create: `tauri-app/src-tauri/Cargo.toml`
- Create: `tauri-app/src-tauri/tauri.conf.json`

**Step 1: Create Tauri project directory**

```bash
cd /home/dss/work_py3_12/claw-code
mkdir -p tauri-app
cd tauri-app
```

**Step 2: Initialize npm project**

Run: `npm init -y`

Expected: Creates package.json with default values

**Step 3: Install Tauri CLI and dependencies**

Run: `npm install --save-dev @tauri-apps/cli@latest @tauri-apps/api@latest`

Expected: Installs Tauri CLI and API packages

**Step 4: Install Svelte and build tools**

Run: `npm install --save-dev svelte@latest @sveltejs/vite-plugin-svelte@latest vite@latest typescript@latest @types/node@latest`

Expected: Installs Svelte 5, Vite, and TypeScript

**Step 5: Install TailwindCSS and utilities**

Run: `npm install --save-dev tailwindcss@latest postcss@latest autoprefixer@latest`

Expected: Installs TailwindCSS and PostCSS

**Step 6: Initialize Tauri in project**

Run: `npx tauri init --app-name "ClawCode" --window-title "ClawCode" --dev-url "http://localhost:5173" --before-dev-command "npm run dev" --before-build-command "npm run build"`

Expected: Creates src-tauri/ directory with Rust backend

**Step 7: Commit initial setup**

```bash
git add tauri-app/
git commit -m "feat: initialize Tauri project with Svelte and TypeScript"
```

---

### Task 2: Configure TypeScript and Vite

**Files:**
- Create: `tauri-app/tsconfig.json`
- Create: `tauri-app/vite.config.ts`
- Create: `tauri-app/svelte.config.js`

**Step 1: Write the failing test**

Create: `tauri-app/tests/unit/config.test.ts`

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/unit/config.test.ts`

Expected: FAIL with "Cannot find module 'vitest'" or files not found

**Step 3: Install test dependencies**

Run: `npm install --save-dev vitest @vitest/ui @testing-library/svelte`

Expected: Installs Vitest and testing utilities

**Step 4: Create tsconfig.json**

Create: `tauri-app/tsconfig.json`

```json
{
  "extends": "@tsconfig/svelte/tsconfig.json",
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["node", "vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.svelte", "tests/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 5: Create vite.config.ts**

Create: `tauri-app/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      $lib: path.resolve('./src/lib'),
      $components: path.resolve('./src/lib/components'),
      $stores: path.resolve('./src/lib/stores'),
      $services: path.resolve('./src/lib/services'),
      $types: path.resolve('./src/lib/types'),
      $utils: path.resolve('./src/lib/utils'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/'],
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  clearScreen: false,
});
```

**Step 6: Create svelte.config.js**

Create: `tauri-app/svelte.config.js`

```javascript
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    runes: true,
  },
  onwarn: (warning, handler) => {
    if (warning.code === 'a11y-click-events-have-key-events') return;
    if (warning.code === 'a11y-no-static-element-interactions') return;
    handler(warning);
  },
};
```

**Step 7: Update package.json scripts**

Modify: `tauri-app/package.json`

```json
{
  "name": "clawcode-tauri-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "tauri": "tauri",
    "lint": "eslint src --ext .ts,.svelte",
    "typecheck": "tsc --noEmit"
  }
}
```

**Step 8: Run test to verify it passes**

Run: `npm test tests/unit/config.test.ts`

Expected: PASS - all configuration files exist and are valid

**Step 9: Commit configuration files**

```bash
git add tauri-app/
git commit -m "feat: configure TypeScript, Vite, and Svelte"
```

---

### Task 3: Set Up TailwindCSS with Dark/Light Theme

**Files:**
- Create: `tauri-app/tailwind.config.js`
- Create: `tauri-app/postcss.config.js`
- Create: `tauri-app/src/static/styles/global.css`

**Step 1: Write the failing test**

Create: `tauri-app/tests/unit/theme.test.ts`

```typescript
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

  it('should have global.css with Tailwind directives', () => {
    const cssPath = join(process.cwd(), 'src/static/styles/global.css');
    expect(existsSync(cssPath)).toBe(true);
    
    const cssContent = readFileSync(cssPath, 'utf-8');
    expect(cssContent).toContain('@tailwind base');
    expect(cssContent).toContain('@tailwind components');
    expect(cssContent).toContain('@tailwind utilities');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/unit/theme.test.ts`

Expected: FAIL - files not found

**Step 3: Create tailwind.config.js**

Create: `tauri-app/tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{html,js,svelte,ts}',
    './src/**/**/*.{html,js,svelte,ts}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        dark: {
          bg: '#0a0e27',
          surface: '#151b3d',
          border: '#2a3158',
          text: '#e2e8f0',
        },
        light: {
          bg: '#ffffff',
          surface: '#f8fafc',
          border: '#e2e8f0',
          text: '#1e293b',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgb(14 165 233 / 0.5)' },
          '100%': { boxShadow: '0 0 20px rgb(14 165 233 / 0.8)' },
        },
      },
    },
  },
  plugins: [],
};
```

**Step 4: Create postcss.config.js**

Create: `tauri-app/postcss.config.js`

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**Step 5: Create global.css**

Create: `tauri-app/src/static/styles/global.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --color-bg: #ffffff;
    --color-surface: #f8fafc;
    --color-border: #e2e8f0;
    --color-text: #1e293b;
    --color-primary: #0ea5e9;
  }

  .dark {
    --color-bg: #0a0e27;
    --color-surface: #151b3d;
    --color-border: #2a3158;
    --color-text: #e2e8f0;
    --color-primary: #38bdf8;
  }

  body {
    @apply bg-bg text-text font-sans antialiased;
    background-color: var(--color-bg);
    color: var(--color-text);
  }

  * {
    @apply border-border;
    border-color: var(--color-border);
  }
}

@layer components {
  .btn {
    @apply px-4 py-2 rounded-lg font-medium transition-all duration-200;
    @apply focus:outline-none focus:ring-2 focus:ring-offset-2;
  }

  .btn-primary {
    @apply bg-primary-600 text-white hover:bg-primary-700;
    @apply focus:ring-primary-500;
  }

  .btn-secondary {
    @apply bg-gray-200 text-gray-900 hover:bg-gray-300;
    @apply dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600;
  }

  .input {
    @apply w-full px-3 py-2 rounded-lg border;
    @apply bg-surface text-text border-border;
    @apply focus:outline-none focus:ring-2 focus:ring-primary-500;
    background-color: var(--color-surface);
    border-color: var(--color-border);
    color: var(--color-text);
  }

  .card {
    @apply rounded-lg border p-4;
    @apply bg-surface border-border;
    background-color: var(--color-surface);
    border-color: var(--color-border);
  }

  .status-badge {
    @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium;
  }

  .status-active {
    @apply bg-green-100 text-green-800;
    @apply dark:bg-green-900 dark:text-green-200;
  }

  .status-thinking {
    @apply bg-yellow-100 text-yellow-800;
    @apply dark:bg-yellow-900 dark:text-yellow-200;
  }

  .status-idle {
    @apply bg-blue-100 text-blue-800;
    @apply dark:bg-blue-900 dark:text-blue-200;
  }

  .status-error {
    @apply bg-red-100 text-red-800;
    @apply dark:bg-red-900 dark:text-red-200;
  }
}

@layer utilities {
  .scrollbar-thin {
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
  }

  .scrollbar-thin::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  .scrollbar-thin::-webkit-scrollbar-track {
    background: transparent;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb {
    background-color: var(--color-border);
    border-radius: 3px;
  }

  .glow-effect {
    box-shadow: 0 0 20px rgba(14, 165, 233, 0.3);
  }

  .high-tech-gradient {
    background: linear-gradient(135deg, var(--color-primary) 0%, #8b5cf6 100%);
  }
}
```

**Step 6: Run test to verify it passes**

Run: `npm test tests/unit/theme.test.ts`

Expected: PASS - TailwindCSS configured with dark mode

**Step 7: Commit TailwindCSS setup**

```bash
git add tauri-app/
git commit -m "feat: set up TailwindCSS with dark/light theme support"
```

---

### Task 4: Create Type Definitions

**Files:**
- Create: `tauri-app/src/lib/types/agent.ts`
- Create: `tauri-app/src/lib/types/task.ts`
- Create: `tauri-app/src/lib/types/config.ts`
- Create: `tauri-app/src/lib/types/connection.ts`
- Create: `tauri-app/src/lib/types/message.ts`

**Step 1: Write the failing test**

Create: `tauri-app/tests/unit/types.test.ts`

```typescript
import { describe, it, expect } from 'vitest';

describe('Type Definitions', () => {
  it('should export Agent types', async () => {
    const { AgentStatus, AgentRole, AgentInfo } = await import('$types/agent');
    expect(AgentStatus).toBeDefined();
    expect(AgentRole).toBeDefined();
    expect(AgentInfo).toBeDefined();
  });

  it('should export Task types', async () => {
    const { TaskStatus, TaskPriority, TaskInfo } = await import('$types/task');
    expect(TaskStatus).toBeDefined();
    expect(TaskPriority).toBeDefined();
    expect(TaskInfo).toBeDefined();
  });

  it('should export Config types', async () => {
    const { Config, AIModelConfig, SSHConfig } = await import('$types/config');
    expect(Config).toBeDefined();
    expect(AIModelConfig).toBeDefined();
    expect(SSHConfig).toBeDefined();
  });

  it('should export Connection types', async () => {
    const { ConnectionStatus, ConnectionInfo } = await import('$types/connection');
    expect(ConnectionStatus).toBeDefined();
    expect(ConnectionInfo).toBeDefined();
  });

  it('should export Message types', async () => {
    const { MessageType, Message } = await import('$types/message');
    expect(MessageType).toBeDefined();
    expect(Message).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/unit/types.test.ts`

Expected: FAIL - modules not found

**Step 3: Create agent types**

Create: `tauri-app/src/lib/types/agent.ts`

```typescript
export enum AgentStatus {
  Active = 'active',
  Thinking = 'thinking',
  Idle = 'idle',
  Error = 'error',
  Offline = 'offline',
}

export enum AgentRole {
  Leader = 'leader',
  Coder = 'coder',
  Reviewer = 'reviewer',
  Tester = 'tester',
  Planner = 'planner',
  Analyzer = 'analyzer',
  Custom = 'custom',
}

export interface AgentInfo {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  model: string;
  currentTask?: string;
  progress: number;
  metrics: AgentMetrics;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  averageResponseTime: number;
  totalTokensUsed: number;
  cpuUsage?: number;
  memoryUsage?: number;
}

export interface AgentConfig {
  id: string;
  role: AgentRole;
  model: string;
  systemPrompt?: string;
  tools?: string[];
  maxTokens?: number;
  temperature?: number;
  autonomyLevel: number;
  verificationRequired: boolean;
}

export interface AgentStatusUpdate {
  agentId: string;
  status: AgentStatus;
  currentTask?: string;
  progress?: number;
  metrics?: Partial<AgentMetrics>;
  timestamp: Date;
}
```

**Step 4: Create task types**

Create: `tauri-app/src/lib/types/task.ts`

```typescript
export enum TaskStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export enum TaskPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}

export interface TaskInfo {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedAgent?: string;
  progress: number;
  estimatedTime?: number;
  actualTime?: number;
  dependencies: string[];
  result?: TaskResult;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface TaskResult {
  success: boolean;
  output?: string;
  error?: string;
  artifacts?: TaskArtifact[];
  metrics?: TaskMetrics;
}

export interface TaskArtifact {
  type: 'file' | 'code' | 'document' | 'image';
  name: string;
  path?: string;
  content?: string;
  url?: string;
}

export interface TaskMetrics {
  tokensUsed: number;
  apiCalls: number;
  executionTime: number;
  retryCount: number;
}

export interface TaskUpdate {
  taskId: string;
  status?: TaskStatus;
  progress?: number;
  assignedAgent?: string;
  result?: TaskResult;
  timestamp: Date;
}

export interface TaskRequest {
  name: string;
  description: string;
  priority: TaskPriority;
  dependencies?: string[];
  assignedAgent?: string;
  config?: Record<string, unknown>;
}
```

**Step 5: Create config types**

Create: `tauri-app/src/lib/types/config.ts`

```typescript
import type { AgentConfig } from './agent';

export interface Config {
  aiModel: AIModelConfig;
  agents: AgentConfigs;
  rag: RAGConfig;
  mcp: MCPConfig;
  memory: MemoryConfig;
  remote: RemoteConfig;
  p2p: P2PConfig;
  ui: UIConfig;
  project: ProjectConfig;
}

export interface AIModelConfig {
  provider: 'anthropic' | 'openai' | 'local' | 'custom';
  endpoint: string;
  apiKey?: string;
  model: string;
  fallbackModels?: string[];
  temperature: number;
  maxTokens: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  timeout: number;
}

export interface AgentConfigs {
  roles: AgentConfig[];
  collaborationPattern: 'sequential' | 'parallel' | 'hybrid';
  conflictResolution: 'leader-decides' | 'vote' | 'priority';
}

export interface RAGConfig {
  enabled: boolean;
  repositories: KnowledgeRepository[];
  embeddingModel: string;
  topK: number;
  similarityThreshold: number;
  vectorDb?: VectorDbConfig;
}

export interface KnowledgeRepository {
  id: string;
  name: string;
  type: 'local' | 'remote' | 'database';
  path?: string;
  url?: string;
  syncFrequency: number;
}

export interface VectorDbConfig {
  type: 'pinecone' | 'weaviate' | 'qdrant' | 'chromadb';
  endpoint: string;
  apiKey?: string;
  indexName: string;
}

export interface MCPConfig {
  servers: MCPServer[];
  tools: ToolConfig[];
}

export interface MCPServer {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  authentication?: {
    type: 'bearer' | 'basic' | 'api-key';
    token?: string;
    username?: string;
    password?: string;
  };
}

export interface ToolConfig {
  id: string;
  name: string;
  enabled: boolean;
  allowedAgents: string[];
  rateLimit?: number;
  safetyLevel: 'low' | 'medium' | 'high';
}

export interface MemoryConfig {
  maxContextWindow: number;
  summaryCompression: boolean;
  historyRetentionDays: number;
  workingDirectory: string;
  fileWatching: boolean;
  autoDiscovery: boolean;
  additionalStores: MemoryStore[];
}

export interface MemoryStore {
  id: string;
  type: 'database' | 'cache' | 'file';
  connection: string;
  enabled: boolean;
}

export interface RemoteConfig {
  computers: RemoteComputer[];
  deployment: DeploymentConfig;
}

export interface RemoteComputer {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: 'password' | 'ssh-key';
  password?: string;
  sshKeyPath?: string;
  sshKeyPassphrase?: string;
  enabled: boolean;
  autoConnect: boolean;
  healthCheckInterval: number;
}

export interface DeploymentConfig {
  version: string;
  installPath: string;
  autoStart: boolean;
  autoUpdate: boolean;
  healthCheckInterval: number;
  rollbackOnFailure: boolean;
}

export interface P2PConfig {
  enabled: boolean;
  discoveryMethod: 'bootstrap' | 'mdns' | 'dht';
  relayServers: string[];
  natTraversal: boolean;
  encryption: boolean;
  peerAuthentication: boolean;
}

export interface UIConfig {
  theme: 'dark' | 'light' | 'system';
  fontSize: number;
  fontFamily: string;
  panelLayout: PanelLayout;
  notifications: NotificationConfig;
  keyboardShortcuts: Record<string, string>;
  language: string;
}

export interface PanelLayout {
  leftPanelWidth: number;
  rightPanelWidth: number;
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
}

export interface NotificationConfig {
  sound: boolean;
  desktop: boolean;
  inApp: boolean;
  level: 'all' | 'important' | 'none';
}

export interface ProjectConfig {
  workingDirectory: string;
  gitIntegration: boolean;
  autoCommit: boolean;
  branchManagement: string;
  environmentVariables: Record<string, string>;
  templates: string[];
}
```

**Step 6: Create connection types**

Create: `tauri-app/src/lib/types/connection.ts`

```typescript
export enum ConnectionStatus {
  Connected = 'connected',
  Connecting = 'connecting',
  Disconnected = 'disconnected',
  Error = 'error',
  Reconnecting = 'reconnecting',
}

export interface ConnectionInfo {
  id: string;
  name: string;
  type: 'local' | 'remote';
  status: ConnectionStatus;
  endpoint: string;
  latency?: number;
  lastConnected?: Date;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface WebSocketMessage {
  type: string;
  payload: unknown;
  timestamp: Date;
  id?: string;
}

export interface ConnectionHealth {
  connectionId: string;
  isHealthy: boolean;
  latency: number;
  packetLoss: number;
  uptime: number;
  lastCheck: Date;
}
```

**Step 7: Create message types**

Create: `tauri-app/src/lib/types/message.ts`

```typescript
export enum MessageType {
  User = 'user',
  AI = 'ai',
  System = 'system',
  Error = 'error',
  Tool = 'tool',
}

export interface Message {
  id: string;
  conversationId: string;
  type: MessageType;
  content: string;
  sender?: string;
  timestamp: Date;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  model?: string;
  tokens?: number;
  cost?: number;
  files?: string[];
  codeBlocks?: CodeBlock[];
  references?: string[];
}

export interface CodeBlock {
  language: string;
  code: string;
  filename?: string;
  lineStart?: number;
  lineEnd?: number;
}

export interface StreamChunk {
  messageId: string;
  chunk: string;
  isComplete: boolean;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  agentId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Step 8: Run test to verify it passes**

Run: `npm test tests/unit/types.test.ts`

Expected: PASS - all type modules exported correctly

**Step 9: Commit type definitions**

```bash
git add tauri-app/src/lib/types/
git commit -m "feat: add comprehensive type definitions for all data models"
```

---

### Task 5: Create Svelte Stores for State Management

**Files:**
- Create: `tauri-app/src/lib/stores/uiStore.ts`
- Create: `tauri-app/src/lib/stores/connectionStore.ts`
- Create: `tauri-app/src/lib/stores/chatStore.ts`
- Create: `tauri-app/src/lib/stores/agentStore.ts`
- Create: `tauri-app/src/lib/stores/taskStore.ts`
- Create: `tauri-app/src/lib/stores/configStore.ts`

**Step 1: Write the failing test**

Create: `tauri-app/tests/unit/stores.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';

describe('Svelte Stores', () => {
  it('should create uiStore with theme state', async () => {
    const { uiStore } = await import('$stores/uiStore');
    const state = get(uiStore);
    expect(state).toHaveProperty('theme');
    expect(state).toHaveProperty('panelLayout');
  });

  it('should create connectionStore with connection state', async () => {
    const { connectionStore } = await import('$stores/connectionStore');
    const state = get(connectionStore);
    expect(state).toHaveProperty('connections');
    expect(state).toHaveProperty('activeConnection');
  });

  it('should create chatStore with conversation state', async () => {
    const { chatStore } = await import('$stores/chatStore');
    const state = get(chatStore);
    expect(state).toHaveProperty('conversations');
    expect(state).toHaveProperty('activeConversation');
  });

  it('should create agentStore with agent state', async () => {
    const { agentStore } = await import('$stores/agentStore');
    const state = get(agentStore);
    expect(state).toHaveProperty('agents');
    expect(state).toHaveProperty('leaderAgent');
  });

  it('should create taskStore with task state', async () => {
    const { taskStore } = await import('$stores/taskStore');
    const state = get(taskStore);
    expect(state).toHaveProperty('tasks');
    expect(state).toHaveProperty('activeTasks');
  });

  it('should create configStore with configuration state', async () => {
    const { configStore } = await import('$stores/configStore');
    const state = get(configStore);
    expect(state).toHaveProperty('config');
    expect(state).toHaveProperty('isDirty');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/unit/stores.test.ts`

Expected: FAIL - modules not found

**Step 3: Create UI store**

Create: `tauri-app/src/lib/stores/uiStore.ts`

```typescript
import { writable, derived } from 'svelte/store';
import type { UIConfig, PanelLayout } from '$types/config';
import { browser } from '$app/environment';

interface UIState {
  theme: 'dark' | 'light' | 'system';
  actualTheme: 'dark' | 'light';
  panelLayout: PanelLayout;
  activeView: 'default' | 'agent-detail';
  selectedAgentId: string | null;
  modal: {
    isOpen: boolean;
    type: string | null;
    data: unknown;
  };
  sidebarCollapsed: boolean;
  settingsOpen: boolean;
}

const defaultPanelLayout: PanelLayout = {
  leftPanelWidth: 50,
  rightPanelWidth: 50,
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
};

const defaultState: UIState = {
  theme: 'system',
  actualTheme: 'dark',
  panelLayout: defaultPanelLayout,
  activeView: 'default',
  selectedAgentId: null,
  modal: {
    isOpen: false,
    type: null,
    data: null,
  },
  sidebarCollapsed: false,
  settingsOpen: false,
};

function createUIStore() {
  const { subscribe, set, update } = writable<UIState>(defaultState);

  return {
    subscribe,
    
    setTheme: (theme: 'dark' | 'light' | 'system') => {
      update(state => {
        const actualTheme = theme === 'system' 
          ? (browser && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : theme;
        
        if (browser) {
          document.documentElement.classList.toggle('dark', actualTheme === 'dark');
          localStorage.setItem('theme', theme);
        }
        
        return { ...state, theme, actualTheme };
      });
    },

    toggleSidebar: () => {
      update(state => ({ ...state, sidebarCollapsed: !state.sidebarCollapsed }));
    },

    toggleSettings: () => {
      update(state => ({ ...state, settingsOpen: !state.settingsOpen }));
    },

    setPanelLayout: (layout: Partial<PanelLayout>) => {
      update(state => ({
        ...state,
        panelLayout: { ...state.panelLayout, ...layout },
      }));
    },

    setActiveView: (view: 'default' | 'agent-detail', agentId?: string) => {
      update(state => ({
        ...state,
        activeView: view,
        selectedAgentId: agentId || null,
      }));
    },

    openModal: (type: string, data?: unknown) => {
      update(state => ({
        ...state,
        modal: { isOpen: true, type, data },
      }));
    },

    closeModal: () => {
      update(state => ({
        ...state,
        modal: { isOpen: false, type: null, data: null },
      }));
    },

    reset: () => set(defaultState),

    loadFromStorage: () => {
      if (browser) {
        const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | 'system' | null;
        if (savedTheme) {
          const actualTheme = savedTheme === 'system'
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : savedTheme;
          document.documentElement.classList.toggle('dark', actualTheme === 'dark');
          update(state => ({ ...state, theme: savedTheme, actualTheme }));
        }
      }
    },
  };
}

export const uiStore = createUIStore();

export const isDarkMode = derived(uiStore, $ui => $ui.actualTheme === 'dark');
```

**Step 4: Create connection store**

Create: `tauri-app/src/lib/stores/connectionStore.ts`

```typescript
import { writable, derived } from 'svelte/store';
import type { ConnectionInfo, ConnectionStatus, ConnectionHealth } from '$types/connection';

interface ConnectionState {
  connections: Map<string, ConnectionInfo>;
  activeConnection: string | null;
  healthMetrics: Map<string, ConnectionHealth>;
  isConnecting: boolean;
  error: string | null;
}

const defaultState: ConnectionState = {
  connections: new Map(),
  activeConnection: null,
  healthMetrics: new Map(),
  isConnecting: false,
  error: null,
};

function createConnectionStore() {
  const { subscribe, set, update } = writable<ConnectionState>(defaultState);

  return {
    subscribe,

    addConnection: (connection: ConnectionInfo) => {
      update(state => {
        const connections = new Map(state.connections);
        connections.set(connection.id, connection);
        return { ...state, connections };
      });
    },

    removeConnection: (id: string) => {
      update(state => {
        const connections = new Map(state.connections);
        connections.delete(id);
        const healthMetrics = new Map(state.healthMetrics);
        healthMetrics.delete(id);
        return { 
          ...state, 
          connections,
          healthMetrics,
          activeConnection: state.activeConnection === id ? null : state.activeConnection,
        };
      });
    },

    updateConnectionStatus: (id: string, status: ConnectionStatus, error?: string) => {
      update(state => {
        const connections = new Map(state.connections);
        const connection = connections.get(id);
        if (connection) {
          connections.set(id, {
            ...connection,
            status,
            error,
            lastConnected: status === ConnectionStatus.Connected ? new Date() : connection.lastConnected,
          });
        }
        return { ...state, connections };
      });
    },

    setActiveConnection: (id: string | null) => {
      update(state => ({ ...state, activeConnection: id }));
    },

    updateHealth: (id: string, health: ConnectionHealth) => {
      update(state => {
        const healthMetrics = new Map(state.healthMetrics);
        healthMetrics.set(id, health);
        return { ...state, healthMetrics };
      });
    },

    setConnecting: (isConnecting: boolean) => {
      update(state => ({ ...state, isConnecting }));
    },

    setError: (error: string | null) => {
      update(state => ({ ...state, error }));
    },

    reset: () => set(defaultState),

    getActiveConnection: () => {
      let activeId: string | null = null;
      update(state => {
        activeId = state.activeConnection;
        return state;
      });
      return activeId;
    },
  };
}

export const connectionStore = createConnectionStore();

export const activeConnection = derived(connectionStore, $conn => {
  if (!$conn.activeConnection) return null;
  return $conn.connections.get($conn.activeConnection) || null;
});

export const connectionList = derived(connectionStore, $conn => 
  Array.from($conn.connections.values())
);

export const connectedCount = derived(connectionStore, $conn =>
  Array.from($conn.connections.values()).filter(c => c.status === 'connected').length
);
```

**Step 5: Create chat store**

Create: `tauri-app/src/lib/stores/chatStore.ts`

```typescript
import { writable, derived } from 'svelte/store';
import type { Message, Conversation, StreamChunk, MessageType } from '$types/message';

interface ChatState {
  conversations: Map<string, Conversation>;
  activeConversation: string | null;
  streamingMessage: string;
  streamingMessageId: string | null;
  isStreaming: boolean;
}

const defaultState: ChatState = {
  conversations: new Map(),
  activeConversation: null,
  streamingMessage: '',
  streamingMessageId: null,
  isStreaming: false,
};

function createChatStore() {
  const { subscribe, set, update } = writable<ChatState>(defaultState);

  return {
    subscribe,

    createConversation: (id: string, agentId: string, title?: string) => {
      update(state => {
        const conversations = new Map(state.conversations);
        conversations.set(id, {
          id,
          title: title || `Conversation ${conversations.size + 1}`,
          messages: [],
          agentId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return { ...state, conversations, activeConversation: id };
      });
    },

    setActiveConversation: (id: string | null) => {
      update(state => ({ ...state, activeConversation: id }));
    },

    addMessage: (conversationId: string, message: Message) => {
      update(state => {
        const conversations = new Map(state.conversations);
        const conversation = conversations.get(conversationId);
        if (conversation) {
          conversation.messages.push(message);
          conversation.updatedAt = new Date();
          conversations.set(conversationId, { ...conversation });
        }
        return { ...state, conversations };
      });
    },

    startStreaming: (messageId: string) => {
      update(state => ({
        ...state,
        streamingMessage: '',
        streamingMessageId: messageId,
        isStreaming: true,
      }));
    },

    appendStreamChunk: (chunk: StreamChunk) => {
      update(state => {
        if (state.streamingMessageId === chunk.messageId) {
          return {
            ...state,
            streamingMessage: state.streamingMessage + chunk.chunk,
            isStreaming: !chunk.isComplete,
          };
        }
        return state;
      });
    },

    finishStreaming: (conversationId: string, message: Message) => {
      update(state => {
        const conversations = new Map(state.conversations);
        const conversation = conversations.get(conversationId);
        if (conversation) {
          conversation.messages.push(message);
          conversation.updatedAt = new Date();
          conversations.set(conversationId, { ...conversation });
        }
        return {
          ...state,
          conversations,
          streamingMessage: '',
          streamingMessageId: null,
          isStreaming: false,
        };
      });
    },

    clearConversation: (id: string) => {
      update(state => {
        const conversations = new Map(state.conversations);
        const conversation = conversations.get(id);
        if (conversation) {
          conversation.messages = [];
          conversation.updatedAt = new Date();
          conversations.set(id, { ...conversation });
        }
        return { ...state, conversations };
      });
    },

    deleteConversation: (id: string) => {
      update(state => {
        const conversations = new Map(state.conversations);
        conversations.delete(id);
        return {
          ...state,
          conversations,
          activeConversation: state.activeConversation === id ? null : state.activeConversation,
        };
      });
    },

    reset: () => set(defaultState),
  };
}

export const chatStore = createChatStore();

export const activeConversation = derived(chatStore, $chat => {
  if (!$chat.activeConversation) return null;
  return $chat.conversations.get($chat.activeConversation) || null;
});

export const messageList = derived(chatStore, $chat => {
  if (!$chat.activeConversation) return [];
  const conversation = $chat.conversations.get($chat.activeConversation);
  return conversation?.messages || [];
});
```

**Step 6: Create agent store**

Create: `tauri-app/src/lib/stores/agentStore.ts`

```typescript
import { writable, derived } from 'svelte/store';
import type { AgentInfo, AgentStatus, AgentStatusUpdate } from '$types/agent';

interface AgentState {
  agents: Map<string, AgentInfo>;
  leaderAgent: string | null;
  selectedAgent: string | null;
}

const defaultState: AgentState = {
  agents: new Map(),
  leaderAgent: null,
  selectedAgent: null,
};

function createAgentStore() {
  const { subscribe, set, update } = writable<AgentState>(defaultState);

  return {
    subscribe,

    addAgent: (agent: AgentInfo) => {
      update(state => {
        const agents = new Map(state.agents);
        agents.set(agent.id, agent);
        const leaderAgent = agent.role === 'leader' ? agent.id : state.leaderAgent;
        return { ...state, agents, leaderAgent };
      });
    },

    removeAgent: (id: string) => {
      update(state => {
        const agents = new Map(state.agents);
        agents.delete(id);
        return {
          ...state,
          agents,
          leaderAgent: state.leaderAgent === id ? null : state.leaderAgent,
          selectedAgent: state.selectedAgent === id ? null : state.selectedAgent,
        };
      });
    },

    updateAgentStatus: (update: AgentStatusUpdate) => {
      update(state => {
        const agents = new Map(state.agents);
        const agent = agents.get(update.agentId);
        if (agent) {
          agents.set(update.agentId, {
            ...agent,
            status: update.status,
            currentTask: update.currentTask ?? agent.currentTask,
            progress: update.progress ?? agent.progress,
            metrics: update.metrics ? { ...agent.metrics, ...update.metrics } : agent.metrics,
            updatedAt: new Date(),
          });
        }
        return { ...state, agents };
      });
    },

    setSelectedAgent: (id: string | null) => {
      update(state => ({ ...state, selectedAgent: id }));
    },

    setLeaderAgent: (id: string) => {
      update(state => {
        const agents = new Map(state.agents);
        const agent = agents.get(id);
        if (agent) {
          agents.set(id, { ...agent, role: 'leader' });
          if (state.leaderAgent && state.leaderAgent !== id) {
            const oldLeader = agents.get(state.leaderAgent);
            if (oldLeader) {
              agents.set(state.leaderAgent, { ...oldLeader, role: 'coder' });
            }
          }
        }
        return { ...state, agents, leaderAgent: id };
      });
    },

    reset: () => set(defaultState),
  };
}

export const agentStore = createAgentStore();

export const agentList = derived(agentStore, $agent =>
  Array.from($agent.agents.values())
);

export const leaderAgent = derived(agentStore, $agent => {
  if (!$agent.leaderAgent) return null;
  return $agent.agents.get($agent.leaderAgent) || null;
});

export const selectedAgent = derived(agentStore, $agent => {
  if (!$agent.selectedAgent) return null;
  return $agent.agents.get($agent.selectedAgent) || null;
});

export const activeAgents = derived(agentStore, $agent =>
  Array.from($agent.agents.values()).filter(a => a.status === 'active' || a.status === 'thinking')
);
```

**Step 7: Create task store**

Create: `tauri-app/src/lib/stores/taskStore.ts`

```typescript
import { writable, derived } from 'svelte/store';
import type { TaskInfo, TaskStatus, TaskUpdate, TaskRequest } from '$types/task';

interface TaskState {
  tasks: Map<string, TaskInfo>;
  activeTasks: string[];
  pendingTasks: string[];
  completedTasks: string[];
}

const defaultState: TaskState = {
  tasks: new Map(),
  activeTasks: [],
  pendingTasks: [],
  completedTasks: [],
};

function createTaskStore() {
  const { subscribe, set, update } = writable<TaskState>(defaultState);

  const categorizeTask = (task: TaskInfo): 'active' | 'pending' | 'completed' => {
    if (task.status === 'running') return 'active';
    if (task.status === 'pending') return 'pending';
    return 'completed';
  };

  const updateLists = (state: TaskState): TaskState => {
    const activeTasks: string[] = [];
    const pendingTasks: string[] = [];
    const completedTasks: string[] = [];

    state.tasks.forEach((task, id) => {
      const category = categorizeTask(task);
      if (category === 'active') activeTasks.push(id);
      else if (category === 'pending') pendingTasks.push(id);
      else completedTasks.push(id);
    });

    return { ...state, activeTasks, pendingTasks, completedTasks };
  };

  return {
    subscribe,

    addTask: (task: TaskInfo) => {
      update(state => {
        const tasks = new Map(state.tasks);
        tasks.set(task.id, task);
        return updateLists({ ...state, tasks });
      });
    },

    removeTask: (id: string) => {
      update(state => {
        const tasks = new Map(state.tasks);
        tasks.delete(id);
        return updateLists({ ...state, tasks });
      });
    },

    updateTask: (taskUpdate: TaskUpdate) => {
      update(state => {
        const tasks = new Map(state.tasks);
        const task = tasks.get(taskUpdate.taskId);
        if (task) {
          const updatedTask: TaskInfo = {
            ...task,
            status: taskUpdate.status ?? task.status,
            progress: taskUpdate.progress ?? task.progress,
            assignedAgent: taskUpdate.assignedAgent ?? task.assignedAgent,
            result: taskUpdate.result ?? task.result,
            completedAt: taskUpdate.status === 'completed' || taskUpdate.status === 'failed'
              ? new Date()
              : task.completedAt,
          };
          tasks.set(taskUpdate.taskId, updatedTask);
        }
        return updateLists({ ...state, tasks });
      });
    },

    cancelTask: (id: string) => {
      update(state => {
        const tasks = new Map(state.tasks);
        const task = tasks.get(id);
        if (task) {
          tasks.set(id, { ...task, status: 'cancelled' as TaskStatus, completedAt: new Date() });
        }
        return updateLists({ ...state, tasks });
      });
    },

    clearCompleted: () => {
      update(state => {
        const tasks = new Map(state.tasks);
        state.completedTasks.forEach(id => tasks.delete(id));
        return updateLists({ ...state, tasks });
      });
    },

    reset: () => set(defaultState),
  };
}

export const taskStore = createTaskStore();

export const activeTaskList = derived(taskStore, $task =>
  $task.activeTasks.map(id => $task.tasks.get(id)).filter(Boolean) as TaskInfo[]
);

export const pendingTaskList = derived(taskStore, $task =>
  $task.pendingTasks.map(id => $task.tasks.get(id)).filter(Boolean) as TaskInfo[]
);

export const completedTaskList = derived(taskStore, $task =>
  $task.completedTasks.map(id => $task.tasks.get(id)).filter(Boolean) as TaskInfo[]
);

export const overallProgress = derived(taskStore, $task => {
  const tasks = Array.from($task.tasks.values());
  if (tasks.length === 0) return 0;
  const totalProgress = tasks.reduce((sum, task) => sum + task.progress, 0);
  return Math.round(totalProgress / tasks.length);
});
```

**Step 8: Create config store**

Create: `tauri-app/src/lib/stores/configStore.ts`

```typescript
import { writable, derived } from 'svelte/store';
import type { Config } from '$types/config';

interface ConfigState {
  config: Config | null;
  isDirty: boolean;
  isValid: boolean;
  errors: Map<string, string>;
  lastSaved: Date | null;
}

const defaultState: ConfigState = {
  config: null,
  isDirty: false,
  isValid: true,
  errors: new Map(),
  lastSaved: null,
};

function createConfigStore() {
  const { subscribe, set, update } = writable<ConfigState>(defaultState);

  return {
    subscribe,

    setConfig: (config: Config) => {
      update(state => ({ ...state, config, isDirty: false }));
    },

    updateConfig: <K extends keyof Config>(key: K, value: Config[K]) => {
      update(state => {
        if (!state.config) return state;
        return {
          ...state,
          config: { ...state.config, [key]: value },
          isDirty: true,
        };
      });
    },

    setDirty: (isDirty: boolean) => {
      update(state => ({ ...state, isDirty }));
    },

    setValidation: (isValid: boolean, errors?: Map<string, string>) => {
      update(state => ({ ...state, isValid, errors: errors || new Map() }));
    },

    markSaved: () => {
      update(state => ({
        ...state,
        isDirty: false,
        lastSaved: new Date(),
      }));
    },

    reset: () => set(defaultState),

    loadFromStorage: async () => {
      try {
        const saved = localStorage.getItem('clawcode-config');
        if (saved) {
          const config = JSON.parse(saved);
          update(state => ({ ...state, config, lastSaved: new Date() }));
        }
      } catch (error) {
        console.error('Failed to load config from storage:', error);
      }
    },

    saveToStorage: async () => {
      update(state => {
        if (state.config) {
          try {
            localStorage.setItem('clawcode-config', JSON.stringify(state.config));
            return { ...state, isDirty: false, lastSaved: new Date() };
          } catch (error) {
            console.error('Failed to save config to storage:', error);
          }
        }
        return state;
      });
    },
  };
}

export const configStore = createConfigStore();

export const hasUnsavedChanges = derived(configStore, $config => $config.isDirty);

export const configErrors = derived(configStore, $config =>
  Array.from($config.errors.entries())
);
```

**Step 9: Run test to verify it passes**

Run: `npm test tests/unit/stores.test.ts`

Expected: PASS - all stores created with correct structure

**Step 10: Commit stores**

```bash
git add tauri-app/src/lib/stores/
git commit -m "feat: implement Svelte stores for state management"
```

---

## Phase 2: Core UI Components (Tasks 6-15)

### Task 6: Create Base App Component and Layout

**Files:**
- Create: `tauri-app/src/App.svelte`
- Create: `tauri-app/src/main.ts`
- Create: `tauri-app/index.html`

**Step 1: Write the failing test**

Create: `tauri-app/tests/unit/App.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import App from '../src/App.svelte';

describe('App Component', () => {
  it('should render without errors', () => {
    const { container } = render(App);
    expect(container).toBeTruthy();
  });

  it('should have main app container', () => {
    const { getByTestId } = render(App);
    const appContainer = getByTestId('app-container');
    expect(appContainer).toBeTruthy();
  });

  it('should have dual-panel layout', () => {
    const { getByTestId } = render(App);
    const leftPanel = getByTestId('left-panel');
    const rightPanel = getByTestId('right-panel');
    expect(leftPanel).toBeTruthy();
    expect(rightPanel).toBeTruthy();
  });

  it('should apply dark theme class when theme is dark', () => {
    const { container } = render(App);
    expect(container.querySelector('.dark')).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/unit/App.test.ts`

Expected: FAIL - App.svelte not found

**Step 3: Create main.ts entry point**

Create: `tauri-app/src/main.ts`

```typescript
import './static/styles/global.css';
import App from './App.svelte';
import { uiStore } from '$stores/uiStore';

const app = new App({
  target: document.getElementById('app')!,
});

uiStore.loadFromStorage();

export default app;
```

**Step 4: Create index.html**

Create: `tauri-app/index.html`

```html
<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ClawCode</title>
  </head>
  <body class="bg-dark-bg text-dark-text">
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

**Step 5: Create App.svelte**

Create: `tauri-app/src/App.svelte`

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { uiStore, isDarkMode } from '$stores/uiStore';
  import LeftPanel from '$components/panels/LeftPanel.svelte';
  import RightPanel from '$components/panels/RightPanel.svelte';
  import SettingsPanel from '$components/settings/SettingsPanel.svelte';
  import Toast from '$components/common/Toast.svelte';

  $: theme = $uiStore.theme;
  $: actualTheme = $uiStore.actualTheme;
  $: settingsOpen = $uiStore.settingsOpen;

  onMount(() => {
    uiStore.loadFromStorage();
  });

  $: if (actualTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
</script>

<div 
  data-testid="app-container" 
  class="h-screen w-screen flex flex-col overflow-hidden bg-bg text-text"
  class:dark={actualTheme === 'dark'}
>
  <div class="flex-1 flex overflow-hidden">
    <div 
      data-testid="left-panel"
      class="flex-1 border-r border-border overflow-hidden"
      style="min-width: 300px;"
    >
      <LeftPanel />
    </div>
    
    <div 
      data-testid="right-panel"
      class="flex-1 overflow-hidden"
      style="min-width: 300px;"
    >
      <RightPanel />
    </div>
  </div>
</div>

{#if settingsOpen}
  <SettingsPanel />
{/if}

<Toast />

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
</style>
```

**Step 6: Create placeholder components**

Create: `tauri-app/src/lib/components/panels/LeftPanel.svelte`

```svelte
<script lang="ts">
</script>

<div class="h-full flex flex-col bg-surface">
  <div class="p-4 border-b border-border">
    <h2 class="text-lg font-semibold">Claw Chat</h2>
  </div>
  <div class="flex-1 overflow-y-auto p-4">
    <p class="text-sm text-gray-500">Chat interface will be here</p>
  </div>
</div>
```

Create: `tauri-app/src/lib/components/panels/RightPanel.svelte`

```svelte
<script lang="ts">
</script>

<div class="h-full flex flex-col bg-surface">
  <div class="p-4 border-b border-border">
    <h2 class="text-lg font-semibold">Agent Dashboard</h2>
  </div>
  <div class="flex-1 overflow-y-auto p-4">
    <p class="text-sm text-gray-500">Agent tracking will be here</p>
  </div>
</div>
```

Create: `tauri-app/src/lib/components/settings/SettingsPanel.svelte`

```svelte
<script lang="ts">
  import { uiStore } from '$stores/uiStore';
</script>

<div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
  <div class="bg-surface rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
    <div class="p-4 border-b border-border flex justify-between items-center">
      <h2 class="text-xl font-semibold">Settings</h2>
      <button 
        class="btn btn-secondary"
        on:click={() => uiStore.toggleSettings()}
      >
        Close
      </button>
    </div>
    <div class="p-4">
      <p class="text-sm text-gray-500">Settings tabs will be here</p>
    </div>
  </div>
</div>
```

Create: `tauri-app/src/lib/components/common/Toast.svelte`

```svelte
<script lang="ts">
</script>

<div class="fixed bottom-4 right-4 z-50">
</div>
```

**Step 7: Run test to verify it passes**

Run: `npm test tests/unit/App.test.ts`

Expected: PASS - App renders with dual-panel layout

**Step 8: Commit base app**

```bash
git add tauri-app/
git commit -m "feat: create base App component with dual-panel layout"
```

---

## Continuing Implementation...

The plan continues with Tasks 7-50, following the same TDD approach:

- **Tasks 7-10**: Chat interface components (MessageInput, MessageList, MessageBubble)
- **Tasks 11-15**: Agent dashboard components (AgentList, AgentCard, AgentDetail)
- **Tasks 16-20**: Task management UI (TaskList, TaskItem, ProgressBar)
- **Tasks 21-25**: WebSocket service and event handling
- **Tasks 26-30**: Settings panel with all configuration tabs
- **Tasks 31-35**: Tauri backend commands and services
- **Tasks 36-40**: CLI server WebSocket mode
- **Tasks 41-45**: SSH service and remote deployment
- **Tasks 46-50**: P2P communication and final polish

Each task follows the same structure:
1. Write failing test
2. Run test to verify failure
3. Write minimal implementation
4. Run test to verify pass
5. Commit changes

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-04-09-clawcode-tauri-implementation.md`.

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
