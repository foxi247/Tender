type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
}

function formatLog(level: LogLevel, message: string, data?: unknown): LogEntry {
  return {
    level,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}

export const logger = {
  info(message: string, data?: unknown) {
    const entry = formatLog('info', message, data);
    console.log(`[INFO] ${entry.timestamp} — ${message}`, data ? data : '');
    return entry;
  },

  warn(message: string, data?: unknown) {
    const entry = formatLog('warn', message, data);
    console.warn(`[WARN] ${entry.timestamp} — ${message}`, data ? data : '');
    return entry;
  },

  error(message: string, data?: unknown) {
    const entry = formatLog('error', message, data);
    console.error(`[ERROR] ${entry.timestamp} — ${message}`, data ? data : '');
    return entry;
  },

  debug(message: string, data?: unknown) {
    if (process.env.NODE_ENV === 'development') {
      const entry = formatLog('debug', message, data);
      console.debug(`[DEBUG] ${entry.timestamp} — ${message}`, data ? data : '');
      return entry;
    }
  },
};
