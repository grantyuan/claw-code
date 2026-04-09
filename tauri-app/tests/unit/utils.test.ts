import { describe, it, expect } from 'vitest';

describe('Validation Utilities', () => {
  it('should validate URLs correctly', async () => {
    const { validateUrl } = await import('../../src/lib/utils/validation');
    expect(validateUrl('https://api.anthropic.com')).toBe(true);
    expect(validateUrl('http://localhost:8765')).toBe(true);
    expect(validateUrl('not-a-url')).toBe(false);
    expect(validateUrl('')).toBe(false);
  });

  it('should validate IP addresses correctly', async () => {
    const { validateIpAddress } = await import('../../src/lib/utils/validation');
    expect(validateIpAddress('192.168.1.1')).toBe(true);
    expect(validateIpAddress('10.0.0.1')).toBe(true);
    expect(validateIpAddress('not-an-ip')).toBe(false);
  });

  it('should validate port numbers correctly', async () => {
    const { validatePort } = await import('../../src/lib/utils/validation');
    expect(validatePort(22)).toBe(true);
    expect(validatePort(8080)).toBe(true);
    expect(validatePort(0)).toBe(false);
    expect(validatePort(70000)).toBe(false);
    expect(validatePort(1.5)).toBe(false);
  });

  it('should validate required fields', async () => {
    const { validateRequired } = await import('../../src/lib/utils/validation');
    expect(validateRequired('hello')).toBe(true);
    expect(validateRequired('')).toBe(false);
    expect(validateRequired('   ')).toBe(false);
  });
});

describe('Formatting Utilities', () => {
  it('should format timestamps correctly', async () => {
    const { formatTimestamp } = await import('../../src/lib/utils/formatting');
    const now = new Date();
    expect(formatTimestamp(now)).toBe('just now');
    
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    expect(formatTimestamp(oneMinuteAgo)).toContain('m ago');
  });

  it('should format durations correctly', async () => {
    const { formatDuration } = await import('../../src/lib/utils/formatting');
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(1500)).toBe('1.5s');
    expect(formatDuration(65000)).toBe('1m 5s');
  });

  it('should format numbers correctly', async () => {
    const { formatNumber } = await import('../../src/lib/utils/formatting');
    expect(formatNumber(500)).toBe('500');
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(1500000)).toBe('1.5M');
  });

  it('should format percentages correctly', async () => {
    const { formatPercentage } = await import('../../src/lib/utils/formatting');
    expect(formatPercentage(75.4)).toBe('75%');
    expect(formatPercentage(100)).toBe('100%');
    expect(formatPercentage(0)).toBe('0%');
  });

  it('should truncate text correctly', async () => {
    const { truncateText } = await import('../../src/lib/utils/formatting');
    expect(truncateText('Hello', 10)).toBe('Hello');
    expect(truncateText('Hello World', 8)).toBe('Hello...');
  });
});
