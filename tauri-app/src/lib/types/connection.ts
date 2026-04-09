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
