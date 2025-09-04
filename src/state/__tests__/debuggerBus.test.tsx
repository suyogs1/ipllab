import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, renderHook, act } from '@testing-library/react';
import { DebuggerBusProvider, useDebuggerBus, type DebuggerLoad } from '../debuggerBus.tsx';

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
});

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <DebuggerBusProvider>{children}</DebuggerBusProvider>
);

describe('DebuggerBus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with no pending load', () => {
    mockSessionStorage.getItem.mockReturnValue(null);
    
    const { result } = renderHook(() => useDebuggerBus(), {
      wrapper: TestWrapper,
    });

    expect(result.current.pendingLoad).toBeUndefined();
    expect(result.current.consumed).toBe(false);
  });

  it('should set and retrieve pending load', () => {
    mockSessionStorage.getItem.mockReturnValue(null);
    
    const { result } = renderHook(() => useDebuggerBus(), {
      wrapper: TestWrapper,
    });

    const testLoad: DebuggerLoad = {
      source: 'MOV R0, #42',
      watches: ['R0'],
      breakpoints: [0],
      cursorLine: 0,
    };

    act(() => {
      result.current.setPendingLoad(testLoad);
    });

    expect(result.current.pendingLoad).toEqual(testLoad);
    expect(result.current.consumed).toBe(false);
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      'asmplay_debugger_pending_load',
      JSON.stringify(testLoad)
    );
  });

  it('should mark load as consumed', () => {
    mockSessionStorage.getItem.mockReturnValue(null);
    
    const { result } = renderHook(() => useDebuggerBus(), {
      wrapper: TestWrapper,
    });

    const testLoad: DebuggerLoad = {
      source: 'MOV R0, #42',
    };

    act(() => {
      result.current.setPendingLoad(testLoad);
    });

    act(() => {
      result.current.markConsumed();
    });

    expect(result.current.consumed).toBe(true);
    expect(result.current.pendingLoad).toEqual(testLoad);
  });

  it('should reset state', () => {
    mockSessionStorage.getItem.mockReturnValue(null);
    
    const { result } = renderHook(() => useDebuggerBus(), {
      wrapper: TestWrapper,
    });

    const testLoad: DebuggerLoad = {
      source: 'MOV R0, #42',
    };

    act(() => {
      result.current.setPendingLoad(testLoad);
      result.current.markConsumed();
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.pendingLoad).toBeUndefined();
    expect(result.current.consumed).toBe(false);
    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('asmplay_debugger_pending_load');
  });

  it('should restore from sessionStorage on initialization', () => {
    const storedLoad: DebuggerLoad = {
      source: 'MOV R1, #100',
      watches: ['R1'],
    };
    
    mockSessionStorage.getItem.mockReturnValue(JSON.stringify(storedLoad));
    
    const { result } = renderHook(() => useDebuggerBus(), {
      wrapper: TestWrapper,
    });

    expect(result.current.pendingLoad).toEqual(storedLoad);
    expect(result.current.consumed).toBe(false);
  });

  it('should handle corrupted sessionStorage data gracefully', () => {
    mockSessionStorage.getItem.mockReturnValue('invalid json');
    
    const { result } = renderHook(() => useDebuggerBus(), {
      wrapper: TestWrapper,
    });

    expect(result.current.pendingLoad).toBeUndefined();
    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('asmplay_debugger_pending_load');
  });

  it('should throw error when used outside provider', () => {
    expect(() => {
      renderHook(() => useDebuggerBus());
    }).toThrow('useDebuggerBus must be used within a DebuggerBusProvider');
  });
});