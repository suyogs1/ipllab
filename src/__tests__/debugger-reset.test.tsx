import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AsmDebugger from '../components/AsmDebugger';
import { DebuggerBusProvider } from '../state/debuggerBus';

// Mock the worker
vi.mock('../runners/asmWorker.ts', () => ({
  default: vi.fn(() => ({
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null,
    onerror: null
  }))
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <DebuggerBusProvider>
    {children}
  </DebuggerBusProvider>
);

describe('AsmDebugger Reset Functionality', () => {
  it('renders without crashing', () => {
    render(
      <TestWrapper>
        <AsmDebugger />
      </TestWrapper>
    );
    
    expect(screen.getByText('Assembly Debugger')).toBeInTheDocument();
  });

  it('has reset button available', () => {
    render(
      <TestWrapper>
        <AsmDebugger />
      </TestWrapper>
    );
    
    const resetButton = screen.getByText('Reset');
    expect(resetButton).toBeInTheDocument();
  });

  it('does not reference handleReset before initialization', () => {
    // This test ensures the component renders without the initialization error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <TestWrapper>
        <AsmDebugger />
      </TestWrapper>
    );
    
    // Should not have any console errors about handleReset
    const handleResetErrors = consoleSpy.mock.calls.filter(call => 
      call.some(arg => typeof arg === 'string' && arg.includes('handleReset'))
    );
    
    expect(handleResetErrors).toHaveLength(0);
    
    consoleSpy.mockRestore();
  });

  it('reset button is clickable without errors', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <TestWrapper>
        <AsmDebugger />
      </TestWrapper>
    );
    
    const resetButton = screen.getByText('Reset');
    
    // Should not throw when clicking reset
    expect(() => {
      fireEvent.click(resetButton);
    }).not.toThrow();
    
    // Should not log any errors
    expect(consoleSpy).not.toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });
});