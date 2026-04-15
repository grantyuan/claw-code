type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
}

const LOG_COLORS: Record<LogLevel, string> = {
  debug: 'color: #6b7280',
  info: 'color: #3b82f6',
  warn: 'color: #f59e0b',
  error: 'color: #ef4444',
};

const LOG_PREFIXES: Record<LogLevel, string> = {
  debug: '🔍',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
};

class Logger {
  private enabled: boolean = true;
  private minLevel: LogLevel = 'debug';
  private logs: LogEntry[] = [];
  private maxLogs: number = 500;

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private formatTimestamp(): string {
    return new Date().toISOString().substr(11, 12);
  }

  private log(level: LogLevel, category: string, message: string, data?: unknown) {
    if (!this.enabled || !this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      category,
      message,
      data,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    const prefix = LOG_PREFIXES[level];
    const color = LOG_COLORS[level];
    const formattedMessage = `[${entry.timestamp}] [${category}] ${message}`;

    switch (level) {
      case 'debug':
        console.debug(`%c${prefix} ${formattedMessage}`, color, data ?? '');
        break;
      case 'info':
        console.info(`%c${prefix} ${formattedMessage}`, color, data ?? '');
        break;
      case 'warn':
        console.warn(`%c${prefix} ${formattedMessage}`, color, data ?? '');
        break;
      case 'error':
        console.error(`%c${prefix} ${formattedMessage}`, color, data ?? '');
        break;
    }
  }

  debug(category: string, message: string, data?: unknown) {
    this.log('debug', category, message, data);
  }

  info(category: string, message: string, data?: unknown) {
    this.log('info', category, message, data);
  }

  warn(category: string, message: string, data?: unknown) {
    this.log('warn', category, message, data);
  }

  error(category: string, message: string, data?: unknown) {
    this.log('error', category, message, data);
  }

  api(method: string, url: string, data?: unknown) {
    this.log('info', 'API', `${method} ${url}`, data);
  }

  apiResponse(method: string, url: string, status: number, data?: unknown) {
    const level = status >= 400 ? 'error' : 'debug';
    this.log(level, 'API', `${method} ${url} → ${status}`, data);
  }

  apiError(method: string, url: string, error: unknown) {
    this.log('error', 'API', `${method} ${url} FAILED`, error);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  clearLogs() {
    this.logs = [];
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  setMinLevel(level: LogLevel) {
    this.minLevel = level;
  }

  exportLogs(): string {
    return this.logs
      .map(e => `[${e.timestamp}] [${e.level.toUpperCase()}] [${e.category}] ${e.message}${e.data ? ` | ${JSON.stringify(e.data)}` : ''}`)
      .join('\n');
  }
}

export const logger = new Logger();

(window as any).logger = logger;
