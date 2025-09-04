import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ScrollArea } from '../components/ScrollArea';

describe('ScrollArea Component', () => {
  it('renders children correctly', () => {
    render(
      <ScrollArea>
        <div>Test content</div>
      </ScrollArea>
    );
    
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('applies correct CSS classes for scrolling', () => {
    const { container } = render(
      <ScrollArea className="custom-class">
        <div>Scrollable content</div>
      </ScrollArea>
    );
    
    const scrollArea = container.firstChild as HTMLElement;
    expect(scrollArea).toHaveClass('min-h-0');
    expect(scrollArea).toHaveClass('h-full');
    expect(scrollArea).toHaveClass('overflow-y-auto');
    expect(scrollArea).toHaveClass('overscroll-contain');
    expect(scrollArea).toHaveClass('custom-class');
  });

  it('has proper scrollbar styling classes', () => {
    const { container } = render(
      <ScrollArea>
        <div>Content</div>
      </ScrollArea>
    );
    
    const scrollArea = container.firstChild as HTMLElement;
    expect(scrollArea).toHaveClass('rounded-lg');
    expect(scrollArea.className).toContain('shadow-[inset_0_0_0_1px_rgba(110,243,255,.15)]');
  });
});