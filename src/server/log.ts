// Structured, secret-free server logs: one JSON line per event on stderr.
// Never pass API keys, request headers or full URLs into `fields`.

export type LogLevel = 'info' | 'warn' | 'error';

export function formatLogLine(
  level: LogLevel,
  message: string,
  fields: Record<string, unknown> = {},
  now: Date = new Date(),
): string {
  return JSON.stringify({ level, message, time: now.toISOString(), ...fields });
}

export function logEvent(level: LogLevel, message: string, fields: Record<string, unknown> = {}): void {
  if (process.env.VITEST) return; // keep test output clean
  process.stderr.write(`${formatLogLine(level, message, fields)}\n`);
}
