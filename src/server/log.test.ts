import { describe, expect, it } from 'vitest';
import { formatLogLine } from './log.js';

describe('formatLogLine', () => {
  it('produces one JSON line with level, message, time and fields', () => {
    const line = formatLogLine('warn', 'AI plan attempt failed', { attempt: 1 }, new Date('2026-11-25T10:00:00Z'));
    expect(JSON.parse(line)).toEqual({
      level: 'warn',
      message: 'AI plan attempt failed',
      time: '2026-11-25T10:00:00.000Z',
      attempt: 1,
    });
    expect(line).not.toContain('\n');
  });
});
