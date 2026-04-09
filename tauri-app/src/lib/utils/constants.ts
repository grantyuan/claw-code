export const APP_NAME = 'ClawCode';
export const APP_VERSION = '0.1.0';

export const DEFAULT_WS_PORT = 8765;
export const DEFAULT_REST_PORT = 8766;
export const DEFAULT_SSH_PORT = 22;

export const WS_RECONNECT_INTERVAL = 3000;
export const WS_MAX_RECONNECT_ATTEMPTS = 10;
export const WS_HEARTBEAT_INTERVAL = 30000;

export const MAX_MESSAGE_HISTORY = 1000;
export const MAX_AGENT_LOG_SIZE = 10 * 1024 * 1024;
export const TASK_ARCHIVE_DAYS = 30;

export const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-400',
  thinking: 'text-yellow-400',
  idle: 'text-blue-400',
  error: 'text-red-400',
  offline: 'text-gray-400',
  connected: 'text-green-400',
  connecting: 'text-yellow-400',
  disconnected: 'text-gray-400',
  reconnecting: 'text-yellow-400',
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-gray-400',
  medium: 'text-blue-400',
  high: 'text-yellow-400',
  critical: 'text-red-400',
};
