export type LogLevel = 'info' | 'success' | 'warn' | 'error';

function prefix(level: LogLevel): string {
  const icons: Record<LogLevel, string> = {
    info: 'ℹ️',
    success: '✅',
    warn: '⚠️',
    error: '❌',
  };
  return `${icons[level]} [${new Date().toLocaleTimeString('en-IN')}]`;
}

export const logger = {
  info(msg: string, ...args: unknown[]) {
    console.log(prefix('info'), msg, ...args);
  },
  success(msg: string, ...args: unknown[]) {
    console.log(prefix('success'), msg, ...args);
  },
  warn(msg: string, ...args: unknown[]) {
    console.warn(prefix('warn'), msg, ...args);
  },
  error(msg: string, ...args: unknown[]) {
    console.error(prefix('error'), msg, ...args);
  },
};
