import { writable, get } from 'svelte/store';
import { connectionStore } from '$stores/connectionStore';
import { agentStore } from '$stores/agentStore';
import { chatStore } from '$stores/chatStore';
import { taskStore } from '$stores/taskStore';
import { ConnectionStatus } from '$types/connection';
import { AgentStatus } from '$types/agent';
import { MessageType } from '$types/message';
import { WS_RECONNECT_INTERVAL, WS_MAX_RECONNECT_ATTEMPTS, WS_HEARTBEAT_INTERVAL } from '$utils/constants';
import type { WebSocketMessage } from '$types/connection';
import type { AgentStatusUpdate } from '$types/agent';
import type { TaskUpdate } from '$types/task';
import type { StreamChunk } from '$types/message';

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private messageQueue: string[] = [];

  connect(endpoint: string, connectionId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    connectionStore.updateConnectionStatus(connectionId, ConnectionStatus.Connecting);
    connectionStore.setConnecting(true);

    try {
      this.ws = new WebSocket(endpoint);

      this.ws.onopen = () => {
        connectionStore.updateConnectionStatus(connectionId, ConnectionStatus.Connected);
        connectionStore.setActiveConnection(connectionId);
        connectionStore.setConnecting(false);
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.flushMessageQueue();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        connectionStore.updateConnectionStatus(connectionId, ConnectionStatus.Disconnected);
        this.stopHeartbeat();
        this.attemptReconnect(endpoint, connectionId);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        connectionStore.updateConnectionStatus(connectionId, ConnectionStatus.Error, 'Connection error');
        connectionStore.setConnecting(false);
      };
    } catch (error) {
      connectionStore.updateConnectionStatus(connectionId, ConnectionStatus.Error, String(error));
      connectionStore.setConnecting(false);
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.reconnectAttempts = WS_MAX_RECONNECT_ATTEMPTS;
    this.ws?.close();
    this.ws = null;
  }

  send(message: WebSocketMessage): void {
    const data = JSON.stringify(message);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      this.messageQueue.push(data);
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'agent_status_update':
        agentStore.updateAgentStatus(message.payload as AgentStatusUpdate);
        break;
      case 'task_update':
        taskStore.updateTask(message.payload as TaskUpdate);
        break;
      case 'message_chunk':
        chatStore.appendStreamChunk(message.payload as StreamChunk);
        break;
      case 'agent_created':
        agentStore.addAgent(message.payload as any);
        break;
      case 'task_completed':
        taskStore.updateTask(message.payload as TaskUpdate);
        break;
      case 'error':
        console.error('Server error:', message.payload);
        break;
      case 'system_notification':
        console.info('System notification:', message.payload);
        break;
      case 'pong':
        break;
      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'ping', payload: null, timestamp: new Date() });
    }, WS_HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private attemptReconnect(endpoint: string, connectionId: string): void {
    if (this.reconnectAttempts >= WS_MAX_RECONNECT_ATTEMPTS) {
      connectionStore.updateConnectionStatus(connectionId, ConnectionStatus.Error, 'Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = WS_RECONNECT_INTERVAL * Math.pow(1.5, this.reconnectAttempts - 1);
    
    connectionStore.updateConnectionStatus(connectionId, ConnectionStatus.Reconnecting);
    
    setTimeout(() => {
      this.connect(endpoint, connectionId);
    }, delay);
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const data = this.messageQueue.shift();
      if (data && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(data);
      }
    }
  }
}

export const webSocketService = new WebSocketService();
