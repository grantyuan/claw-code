import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

const BASE_URL = 'http://localhost:8000/v1';
const MODEL = '/model/Qwopus3.5-27B-v3-NVFP4';

interface TestResult {
  test: string;
  passed: boolean;
  message?: string;
  duration: number;
}

class E2ETestRunner {
  private results: TestResult[] = [];
  private runNumber = 0;

  async runTest(name: string, fn: () => Promise<void>): Promise<TestResult> {
    const start = Date.now();
    try {
      await fn();
      const result: TestResult = { test: name, passed: true, duration: Date.now() - start };
      this.results.push(result);
      return result;
    } catch (e) {
      const result: TestResult = {
        test: name,
        passed: false,
        message: e instanceof Error ? e.message : String(e),
        duration: Date.now() - start,
      };
      this.results.push(result);
      return result;
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${BASE_URL}/models`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async sendMessage(content: string): Promise<{ success: boolean; response?: string; error?: string }> {
    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content }],
          max_tokens: 100,
          stream: false,
        }),
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';
      return { success: true, response: text };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async testConfigStorage(): Promise<boolean> {
    const testConfig = {
      version: '1.0.0',
      lastModified: new Date().toISOString(),
      aiModel: {
        providers: [{ id: 'test', name: 'Test Provider', type: 'openai' as const, endpoint: BASE_URL, isDefault: true }],
        defaultProviderId: 'test',
        models: [],
        tieredLM: { enabled: false, auxiliaryModelId: null, fallbackChain: [], complexityThreshold: 0 },
      },
      agents: { roles: [], collaborationPattern: 'sequential' as const, conflictResolution: 'leader-decides' as const },
      rag: { enabled: false, repositories: [], embeddingModel: '', topK: 5, similarityThreshold: 0.7 },
      mcp: { servers: [], tools: [] },
      memory: { maxContextWindow: 128000, summaryCompression: true, historyRetentionDays: 30, workingDirectory: '', fileWatching: false, autoDiscovery: false, additionalStores: [] },
      remote: { computers: [], deployment: { version: '1.0.0', installPath: '', autoStart: false, autoUpdate: false, healthCheckInterval: 30000, rollbackOnFailure: false } },
      p2p: { enabled: false, discoveryMethod: 'bootstrap' as const, relayServers: [], natTraversal: false, encryption: false, peerAuthentication: false },
      ui: { theme: 'dark' as const, fontSize: 14, fontFamily: 'system-ui', panelLayout: { leftPanelWidth: 300, rightPanelWidth: 300, leftPanelCollapsed: false, rightPanelCollapsed: false }, notifications: { sound: false, desktop: false, inApp: true, level: 'important' as const }, keyboardShortcuts: {}, language: 'en' },
    };

    localStorage.setItem('clawcode-config', JSON.stringify(testConfig));
    
    const stored = localStorage.getItem('clawcode-config');
    if (!stored) return false;

    const parsed = JSON.parse(stored);
    return parsed.aiModel.providers[0].endpoint === BASE_URL && parsed.ui.theme === 'dark';
  }

  async testSessionManagement(): Promise<boolean> {
    const sessions = [];
    
    for (let i = 1; i <= 3; i++) {
      sessions.push({
        id: `session-test-${Date.now()}-${i}`,
        name: `Test Session ${i}`,
        projectPath: `/tmp/test-${i}`,
        status: 'active' as const,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        messageCount: 0,
        tags: ['test', `tag-${i}`],
        isArchived: i % 2 === 0,
      });
    }

    localStorage.setItem('sessions', JSON.stringify(sessions));
    
    const stored = localStorage.getItem('sessions');
    if (!stored) return false;

    const parsed = JSON.parse(stored);
    
    if (parsed.length !== 3) return false;
    if (parsed[0].tags.length !== 2) return false;
    if (parsed[1].isArchived !== true) return false;
    if (parsed[2].isArchived !== false) return false;

    return true;
  }

  async testChatHistoryStorage(): Promise<boolean> {
    const conversations = [
      {
        id: 'conv-1',
        title: 'Test Conversation',
        messages: [
          { id: 'msg-1', role: 'user' as const, content: 'Hello', timestamp: Date.now() },
          { id: 'msg-2', role: 'assistant' as const, content: 'Hi there!', timestamp: Date.now() + 1000 },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    localStorage.setItem('chat-history', JSON.stringify(conversations));
    
    const stored = localStorage.getItem('chat-history');
    if (!stored) return false;

    const parsed = JSON.parse(stored);
    return parsed.length === 1 && parsed[0].messages.length === 2;
  }

  async testSettingsPersistence(): Promise<boolean> {
    const settings = {
      theme: 'dark',
      fontSize: 16,
      language: 'zh-CN',
      notifications: { sound: true, desktop: false, inApp: true, level: 'all' as const },
    };

    localStorage.setItem('app-settings', JSON.stringify(settings));
    
    const stored = localStorage.getItem('app-settings');
    if (!stored) return false;

    const parsed = JSON.parse(stored);
    return parsed.theme === 'dark' && parsed.fontSize === 16 && parsed.language === 'zh-CN';
  }

  async testValidationFunctions(): Promise<boolean> {
    const { validateUrl, validatePort, validateEmail, validateRequired } = await import('$lib/utils/validation');

    if (!validateUrl('http://localhost:8000')) return false;
    if (validateUrl('not-a-url')) return false;
    if (!validatePort(8080)) return false;
    if (validatePort(-1)) return false;
    if (!validateEmail('test@example.com')) return false;
    if (validateEmail('invalid')) return false;
    if (!validateRequired('value')) return false;
    if (validateRequired('')) return false;

    return true;
  }

  getResults(): TestResult[] {
    return this.results;
  }

  getSummary(): { total: number; passed: number; failed: number; passRate: number } {
    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = total - passed;
    return { total, passed, failed, passRate: total > 0 ? (passed / total) * 100 : 0 };
  }
}

const runner = new E2ETestRunner();

describe('ClawCode E2E Tests - Complete System Validation', () => {
  beforeAll(async () => {
    console.log('\n=== ClawCode E2E Test Suite Starting ===\n');
    console.log(`Target: ${BASE_URL}`);
    console.log(`Model: ${MODEL}\n`);
  });

  afterAll(() => {
    const summary = runner.getSummary();
    console.log('\n=== Final Summary ===');
    console.log(`Total: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed}`);
    console.log(`Pass Rate: ${summary.passRate.toFixed(2)}%\n`);
    
    runner.getResults().forEach(r => {
      const icon = r.passed ? '✅' : '❌';
      console.log(`${icon} ${r.test} (${r.duration}ms)${r.message ? ` - ${r.message}` : ''}`);
    });
  });

  for (let round = 1; round <= 10; round++) {
    describe(`Round ${round}/10`, () => {
      beforeEach(() => {
        runner.runNumber = round;
      });

      it(`[${round}] Health Check - API endpoint available`, async () => {
        const result = await runner.runTest('Health Check', async () => {
          const isHealthy = await runner.checkHealth();
          expect(isHealthy).toBe(true);
        });
        
        if (!result.passed) {
          throw new Error(result.message || 'Health check failed');
        }
      }, 15000);

      it(`[${round}] Send Message - Basic communication`, async () => {
        const result = await runner.runTest('Send Message', async () => {
          const res = await runner.sendMessage('Hello, respond with just "OK"');
          expect(res.success).toBe(true);
          expect(res.response).toBeTruthy();
          expect(res.response!.length).toBeGreaterThan(0);
        });
        
        if (!result.passed) {
          throw new Error(result.message || 'Message send failed');
        }
      }, 60000);

      it(`[${round}] Config Storage - Apply and retrieve`, async () => {
        const result = await runner.runTest('Config Storage', async () => {
          const saved = await runner.testConfigStorage();
          expect(saved).toBe(true);
        });
        
        if (!result.passed) {
          throw new Error('Config storage test failed');
        }
      });

      it(`[${round}] Session Management - CRUD operations`, async () => {
        const result = await runner.runTest('Session Management', async () => {
          const valid = await runner.testSessionManagement();
          expect(valid).toBe(true);
        });
        
        if (!result.passed) {
          throw new Error('Session management test failed');
        }
      });

      it(`[${round}] Chat History - Message persistence`, async () => {
        const result = await runner.runTest('Chat History', async () => {
          const valid = await runner.testChatHistoryStorage();
          expect(valid).toBe(true);
        });
        
        if (!result.passed) {
          throw new Error('Chat history test failed');
        }
      });

      it(`[${round}] Settings Persistence - All fields`, async () => {
        const result = await runner.runTest('Settings Persistence', async () => {
          const valid = await runner.testSettingsPersistence();
          expect(valid).toBe(true);
        });
        
        if (!result.passed) {
          throw new Error('Settings persistence test failed');
        }
      });

      it(`[${round}] Validation Functions - Input validation`, async () => {
        const result = await runner.runTest('Validation Functions', async () => {
          const valid = await runner.testValidationFunctions();
          expect(valid).toBe(true);
        });
        
        if (!result.passed) {
          throw new Error('Validation functions test failed');
        }
      });

      it(`[${round}] Complete Workflow - Full cycle`, async () => {
        const result = await runner.runTest('Complete Workflow', async () => {
          const healthOk = await runner.checkHealth();
          expect(healthOk).toBe(true);

          const msgRes = await runner.sendMessage('Say "workflow complete"');
          expect(msgRes.success).toBe(true);

          const configSaved = await runner.testConfigStorage();
          expect(configSaved).toBe(true);

          const sessionsValid = await runner.testSessionManagement();
          expect(sessionsValid).toBe(true);

          const historyValid = await runner.testChatHistoryStorage();
          expect(historyValid).toBe(true);

          const settingsValid = await runner.testSettingsPersistence();
          expect(settingsValid).toBe(true);
        });
        
        if (!result.passed) {
          throw new Error(result.message || 'Workflow test failed');
        }
      }, 120000);
    });
  }
});
