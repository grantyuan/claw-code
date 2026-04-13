import { connectionStore } from '$stores/connectionStore';
import { DEFAULT_REST_PORT } from '$utils/constants';
import type { ConnectionInfo } from '$types/connection';

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `http://localhost:${DEFAULT_REST_PORT}`;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  async sendMessage(content: string, conversationId: string, model?: string, provider?: string): Promise<any> {
    return this.post('/api/chat', { content, conversation_id: conversationId, model, provider });
  }

  async listSessions(): Promise<any> {
    return this.get('/api/sessions');
  }

  async createSession(projectPath: string, name?: string): Promise<any> {
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

  async healthCheck(): Promise<{ status: string; uptime: number }> {
    return this.get('/api/health');
  }

  async deployRemote(host: string, port: number, username: string, authMethod: string): Promise<any> {
    return this.post('/api/deploy', { host, port, username, authMethod });
  }
}

export const apiService = new ApiService();
