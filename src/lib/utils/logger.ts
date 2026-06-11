export const logger = {
  info: (message: string, meta?: Record<string, any>) => 
    console.log(JSON.stringify({ level: 'info', message, timestamp: new Date().toISOString(), ...meta })),
  warn: (message: string, meta?: Record<string, any>) => 
    console.warn(JSON.stringify({ level: 'warn', message, timestamp: new Date().toISOString(), ...meta })),
  error: (message: string, meta?: Record<string, any>) => 
    console.error(JSON.stringify({ level: 'error', message, timestamp: new Date().toISOString(), ...meta })),
};
