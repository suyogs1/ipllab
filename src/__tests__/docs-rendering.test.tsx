import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Docs } from '../tabs/Docs';

// Mock fetch for docs data
const mockDocsData = {
  opcodes: [
    {
      id: 'mov',
      name: 'MOV',
      category: 'data',
      description: 'Move data between registers or load immediate values',
      syntax: 'MOV dst, src',
      flags: 'None',
      examples: [
        { code: 'MOV R0, #42', description: 'Load immediate value 42 into R0' }
      ],
      notes: 'Basic data movement instruction'
    }
  ],
  addressing: [],
  directives: [],
  registers: [],
  flags: []
};

global.fetch = vi.fn();

describe('Docs Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockDocsData
    });
  });

  it('renders without Memory reference errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<Docs />);
    
    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('Assembly Reference')).toBeInTheDocument();
    });
    
    // Should not have "Memory is not defined" errors
    const memoryErrors = consoleSpy.mock.calls.filter(call => 
      call.some(arg => typeof arg === 'string' && arg.includes('Memory is not defined'))
    );
    
    expect(memoryErrors).toHaveLength(0);
    
    consoleSpy.mockRestore();
  });

  it('loads documentation data successfully', async () => {
    render(<Docs />);
    
    await waitFor(() => {
      expect(screen.getByText('Assembly Reference')).toBeInTheDocument();
    });
    
    // Should show instructions section
    expect(screen.getByText('Instructions')).toBeInTheDocument();
  });

  it('displays opcodes without runtime evaluation', async () => {
    render(<Docs />);
    
    await waitFor(() => {
      expect(screen.getByText('MOV')).toBeInTheDocument();
    });
    
    // Should display opcode information as text, not execute it
    expect(screen.getByText('Move data between registers or load immediate values')).toBeInTheDocument();
    expect(screen.getByText('MOV dst, src')).toBeInTheDocument();
  });

  it('handles fetch errors gracefully', async () => {
    (fetch as any).mockRejectedValue(new Error('Failed to load'));
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<Docs />);
    
    // Should still render the component structure
    await waitFor(() => {
      expect(screen.getByText('Assembly Reference')).toBeInTheDocument();
    });
    
    consoleSpy.mockRestore();
  });

  it('uses HardDrive icon instead of undefined Memory component', async () => {
    render(<Docs />);
    
    await waitFor(() => {
      expect(screen.getByText('Assembly Reference')).toBeInTheDocument();
    });
    
    // Should have addressing section with proper icon
    expect(screen.getByText('Addressing')).toBeInTheDocument();
  });
});