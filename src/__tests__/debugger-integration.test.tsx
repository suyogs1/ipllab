import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import App from '../App';

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
});

// Mock localStorage for the existing code
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('Debugger Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionStorage.getItem.mockReturnValue(null);
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  it('should render the app without crashing', () => {
    render(<App />);
    
    // Should render the main app shell
    expect(screen.getByText('AsmPlay')).toBeInTheDocument();
  });

  it('should have debugger bus provider in the component tree', () => {
    render(<App />);
    
    // The app should render without throwing errors about missing context
    expect(screen.getByText('Assembly Learning Platform')).toBeInTheDocument();
  });

  it('should show Learn tab by default', () => {
    render(<App />);
    
    // Learn tab should be active by default
    const learnTab = screen.getByTestId('learn-tab');
    expect(learnTab).toBeInTheDocument();
  });

  it('should be able to switch to debugger tab', async () => {
    render(<App />);
    
    // Click on debugger tab
    const debugTab = screen.getByTestId('debug-tab');
    fireEvent.click(debugTab);
    
    // Should show debugger content
    await waitFor(() => {
      expect(screen.getByTestId('debugger-container')).toBeInTheDocument();
    });
  });
});