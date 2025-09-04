import React, { createContext, useContext, useState, useCallback } from 'react';

export interface DebuggerLoad {
  source: string;
  watches?: string[];
  breakpoints?: number[];
  asserts?: any[];
  cursorLine?: number;
}

interface DebuggerBusState {
  pendingLoad?: DebuggerLoad;
  consumed: boolean;
  setPendingLoad: (load?: DebuggerLoad) => void;
  markConsumed: () => void;
  reset: () => void;
}

const DebuggerBusContext = createContext<DebuggerBusState | null>(null);

const STORAGE_KEY = 'asmplay_debugger_pending_load';

// Safe localStorage operations
function safeGetItem(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch (error) {
    console.warn('sessionStorage get failed:', error);
    return null;
  }
}

function safeSetItem(key: string, value: string): boolean {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn('sessionStorage set failed:', error);
    return false;
  }
}

function safeRemoveItem(key: string): boolean {
  try {
    sessionStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn('sessionStorage remove failed:', error);
    return false;
  }
}

export const DebuggerBusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pendingLoad, setPendingLoadState] = useState<DebuggerLoad | undefined>(() => {
    // Load from sessionStorage on initialization
    const stored = safeGetItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.warn('Failed to parse stored debugger load:', error);
        safeRemoveItem(STORAGE_KEY);
      }
    }
    return undefined;
  });
  
  const [consumed, setConsumed] = useState(false);

  const setPendingLoad = useCallback((load?: DebuggerLoad) => {
    setPendingLoadState(load);
    setConsumed(false);
    
    if (load) {
      safeSetItem(STORAGE_KEY, JSON.stringify(load));
    } else {
      safeRemoveItem(STORAGE_KEY);
    }
  }, []);

  const markConsumed = useCallback(() => {
    setConsumed(true);
    // Don't remove from sessionStorage yet - keep it for potential reloads
  }, []);

  const reset = useCallback(() => {
    setPendingLoadState(undefined);
    setConsumed(false);
    safeRemoveItem(STORAGE_KEY);
  }, []);

  const value: DebuggerBusState = {
    pendingLoad,
    consumed,
    setPendingLoad,
    markConsumed,
    reset
  };

  return (
    <DebuggerBusContext.Provider value={value}>
      {children}
    </DebuggerBusContext.Provider>
  );
};

export const useDebuggerBus = (): DebuggerBusState => {
  const context = useContext(DebuggerBusContext);
  if (!context) {
    throw new Error('useDebuggerBus must be used within a DebuggerBusProvider');
  }
  return context;
};