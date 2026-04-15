import { connectionStore } from '$stores/connectionStore';
import { DEFAULT_REST_PORT } from '$utils/constants';
import { logger } from '$utils/logger';
import type { ConnectionInfo } from '$types/connection';

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `http://localhost:${DEFAULT_REST_PORT}`;
    logger.info('API', 'ApiService initialized', { baseUrl: this.baseUrl });
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url;
    logger.info('API', 'Base URL updated', { baseUrl: this.baseUrl });
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const startTime = Date.now();

    logger.api(method, url, body);

    try {
      const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);
      const latency = Date.now() - startTime;

      logger.apiResponse(method, url, response.status, { latency });

      if (!response.ok) {
        let errorBody = '';
        try {
          errorBody = await response.text();
        } catch {
          errorBody = 'Unable to read error response';
        }

        const errorDetail = {
          status: response.status,
          statusText: response.statusText,
          url,
          body: errorBody.substring(0, 500),
        };

        logger.error('API', `HTTP Error ${response.status}`, errorDetail);

        throw new Error(`HTTP ${response.status} ${response.statusText}: ${errorBody.substring(0, 200)}`);
      }

      const data = await response.json();
      logger.debug('API', `Response data for ${path}`, data);
      return data;
    } catch (error) {
      const latency = Date.now() - startTime;

      if (error instanceof TypeError && error.message.includes('fetch')) {
        const networkError = {
          url,
          method,
          latency,
          error: error.message,
          hint: 'Server may not be running or CORS may be blocking the request',
        };
        logger.error('API', 'Network error (server unreachable)', networkError);
        throw new Error(`Cannot connect to server at ${url}. Is the CLI server running? (Error: ${error.message})`);
      }

      logger.apiError(method, url, { error, latency });
      throw error;
    }
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  async sendMessage(content: string, conversationId: string, model?: string, provider?: string): Promise<any> {
    logger.info('API', 'Sending message', { conversationId, model, provider, contentLength: content.length });
    return this.post('/api/chat', { content, conversation_id: conversationId, model, provider });
  }

  async checkHealth(): Promise<any> {
    logger.info('API', 'Checking health endpoint');
    try {
      const result = await this.get('/api/health');
      logger.info('API', 'Health check successful', result);
      return result;
    } catch (error) {
      logger.error('API', 'Health check failed', error);
      throw error;
    }
  }

  async listSessions(): Promise<any> {
    return this.get('/api/sessions');
  }

  async createSession(projectPath: string, name?: string): Promise<any> {
    logger.info('API', 'Creating session', { projectPath, name });
    return this.post('/api/sessions', { project_path: projectPath, name });
  }

  async getSession(sessionId: string): Promise<any> {
    return this.get(`/api/sessions/${sessionId}`);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.delete(`/api/sessions/${sessionId}`);
  }

  async switchSession(sessionId: string): Promise<any> {
    return this.post(`/api/sessions/${sessionId}/switch`, {});
  }

  async getAgents(): Promise<any[]> {
    return this.get('/api/agents');
  }

  async getTasks(): Promise<any[]> {
    return this.get('/api/tasks');
  }

  async createTask(task: any): Promise<any> {
    return this.post('/api/tasks', task);
  }

  async cancelTask(taskId: string): Promise<void> {
    await this.delete(`/api/tasks/${taskId}`);
  }

  async getConfig(): Promise<any> {
    return this.get('/api/config');
  }

  async updateConfig(config: any): Promise<any> {
    return this.put('/api/config', config);
  }

  async initRuntime(provider: string, endpoint: string, apiKey: string, model: string): Promise<any> {
    logger.info('API', 'Initializing runtime', { provider, endpoint, model });
    return this.post('/api/runtime/init', { provider, endpoint, api_key: apiKey, model });
  }

  async healthCheck(): Promise<{ status: string; uptime: number }> {
    return this.get('/api/health');
  }

  async deployRemote(host: string, port: number, username: string, authMethod: string): Promise<any> {
    return this.post('/api/deploy', { host, port, username, authMethod });
  }

  async exportConversation(conversationId: string, format: 'json' | 'markdown'): Promise<string> {
    return this.get(`/api/history/export/${conversationId}?format=${format}`);
  }

  async batchHistoryOperations(action: 'delete' | 'archive', ids: string[]): Promise<number> {
    return this.post('/api/history/batch', { action, ids });
  }
}

export const apiService = new ApiService();
