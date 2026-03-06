export function logInfo(message: string, context?: Record<string, unknown>) {
  console.info(JSON.stringify({ level: 'info', message, ...context, timestamp: new Date().toISOString() }));
}

export function logError(message: string, context?: Record<string, unknown>) {
  console.error(
    JSON.stringify({ level: 'error', message, ...context, timestamp: new Date().toISOString() })
  );
}
