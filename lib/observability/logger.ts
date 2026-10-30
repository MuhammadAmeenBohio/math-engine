export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = Record<string, unknown>;

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  child(context: LogContext): Logger;
}

const REDACTED = '[redacted]';
const MAX_DEPTH = 4;
const MAX_STRING_LENGTH = 2_000;
const MAX_STACK_LENGTH = 8_000;

const SENSITIVE_KEY_PATTERN =
  /(password|passwd|secret|token|authorization|cookie|api[-_]?key|apikey|connection[-_]?string|mongodb|database[-_]?url|dsn|session)/i;

const CONNECTION_URI_PATTERN = /\b(mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis):\/\/\S+/gi;
const BEARER_TOKEN_PATTERN = /\b(Bearer)\s+[A-Za-z0-9._~+/=-]+/gi;

function redactString(value: string, maxLength = MAX_STRING_LENGTH): string {
  const redacted = value
    .replace(CONNECTION_URI_PATTERN, '$1://[redacted]')
    .replace(BEARER_TOKEN_PATTERN, '$1 [redacted]');

  return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}…` : redacted;
}

function serializeError(error: Error, seen = new WeakSet<object>()): LogContext {
  if (seen.has(error)) return { name: error.name, message: '[circular]' };
  seen.add(error);

  const serialized: LogContext = {
    name: error.name,
    message: redactString(error.message),
    stack: error.stack ? redactString(error.stack, MAX_STACK_LENGTH) : undefined,
  };

  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause !== undefined) {
    serialized.cause =
      cause instanceof Error ? serializeError(cause, seen) : redact(cause, 1, new WeakSet());
  }

  return serialized;
}

function redact(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;

  if (value instanceof Error) return serializeError(value);

  if (typeof value === 'string') {
    return redactString(value);
  }

  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function') return '[function]';
  if (typeof value !== 'object') return value;

  if (depth >= MAX_DEPTH) return '[max-depth]';
  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redact(item, depth + 1, seen);
  }
  return result;
}

function redactContext(context: LogContext): LogContext {
  const redacted = redact(context, 0, new WeakSet());
  return redacted && typeof redacted === 'object' && !Array.isArray(redacted)
    ? (redacted as LogContext)
    : {};
}

function emit(level: LogLevel, message: string, context: LogContext, base: LogContext): void {
  const entry: LogContext = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...redactContext(context),
    // Base fields win so requestId/route cannot be overwritten by a caller.
    ...redactContext(base),
  };

  if (process.env.NODE_ENV === 'production') {
    console[level](JSON.stringify(entry));
    return;
  }

  console[level](`[${level}] ${message}`, entry);
}

export function createLogger(base: LogContext = {}): Logger {
  const log = (level: LogLevel) => (message: string, context: LogContext = {}) =>
    emit(level, message, context, base);

  return {
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
    child(context: LogContext) {
      return createLogger({ ...base, ...context });
    },
  };
}

export const logger = createLogger({ service: 'math-engine' });
