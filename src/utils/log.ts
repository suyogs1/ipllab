/**
 * Centralized logging for debugger
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
}

const isDevelopment = import.meta.env.DEV;

function createLogger(prefix: string): Logger {
  return {
    debug: (message: string, ...args: any[]) => {
      if (isDevelopment) {
        console.debug(`[${prefix}] ${message}`, ...args);
      }
    },
    
    info: (message: string, ...args: any[]) => {
      console.info(`[${prefix}] ${message}`, ...args);
    },
    
    warn: (message: string, ...args: any[]) => {
      console.warn(`[${prefix}] ${message}`, ...args);
    },
    
    error: (message: string, ...args: any[]) => {
      console.error(`[${prefix}] ${message}`, ...args);
    }
  };
}

export const debuggerLog = createLogger('Debugger');
export const engineLog = createLogger('Engine');
export const editorLog = createLogger('Editor');