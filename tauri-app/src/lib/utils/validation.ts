export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function validateIpAddress(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

export function validatePort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validateRequired(value: string): boolean {
  return value.trim().length > 0;
}

export function validateSshKeyPath(path: string): boolean {
  return path.startsWith('/') || path.startsWith('~') || path.startsWith('./');
}

export function validateApiKey(key: string): boolean {
  return key.length >= 8;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface AIModelConfig {
  provider: string;
  endpoint: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
}

export interface RAGConfig {
  enabled: boolean;
  topK: number;
  similarityThreshold: number;
}

export interface UIConfig {
  theme: string;
  fontSize: number;
}

export function validateConfig(config: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (config.aiModel) {
    const ai = config.aiModel as AIModelConfig;
    if (!ai.endpoint || !validateUrl(ai.endpoint)) {
      errors.push({ field: 'aiModel.endpoint', message: 'Invalid endpoint URL' });
    }
    if (ai.temperature !== undefined && (ai.temperature < 0 || ai.temperature > 2)) {
      errors.push({ field: 'aiModel.temperature', message: 'Temperature must be between 0 and 2' });
    }
    if (ai.maxTokens !== undefined && ai.maxTokens <= 0) {
      errors.push({ field: 'aiModel.maxTokens', message: 'Max tokens must be positive' });
    }
    if (ai.timeout !== undefined && ai.timeout <= 0) {
      errors.push({ field: 'aiModel.timeout', message: 'Timeout must be positive' });
    }
  }

  if (config.rag) {
    const rag = config.rag as RAGConfig;
    if (rag.topK !== undefined && rag.topK <= 0) {
      errors.push({ field: 'rag.topK', message: 'TopK must be positive' });
    }
    if (rag.similarityThreshold !== undefined && (rag.similarityThreshold < 0 || rag.similarityThreshold > 1)) {
      errors.push({ field: 'rag.similarityThreshold', message: 'Similarity threshold must be between 0 and 1' });
    }
  }

  if (config.ui) {
    const ui = config.ui as UIConfig;
    if (ui.fontSize !== undefined && (ui.fontSize < 8 || ui.fontSize > 32)) {
      errors.push({ field: 'ui.fontSize', message: 'Font size must be between 8 and 32' });
    }
  }

  return errors;
}

export interface ConfigWarning {
  field: string;
  message: string;
}

export interface RemoteComputer {
  host?: string;
  username?: string;
}

export interface RemoteConfig {
  computers?: RemoteComputer[];
  deployment?: { version?: string };
}

export interface P2PConfig {
  relayServers?: string[];
}

export function validateConfigWarnings(config: Record<string, unknown>): ConfigWarning[] {
  const warnings: ConfigWarning[] = [];

  const remote = config.remote as RemoteConfig | undefined;
  if (remote?.computers) {
    remote.computers.forEach((computer, index) => {
      if (!computer.host || computer.host.trim() === '') {
        warnings.push({ field: `remote.computers[${index}].host`, message: 'Host cannot be empty' });
      }
      if (!computer.username || computer.username.trim() === '') {
        warnings.push({ field: `remote.computers[${index}].username`, message: 'Username cannot be empty' });
      }
    });
  }

  const p2pConfig = config.p2p as P2PConfig | undefined;
  if (p2pConfig?.relayServers) {
    p2pConfig.relayServers.forEach((server, index) => {
      if (!validateUrl(server)) {
        warnings.push({ field: `p2p.relayServers[${index}]`, message: 'Invalid relay server URL' });
      }
    });
  }

  return warnings;
}
