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

export function validateConfig(config: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];
  return errors;
}
