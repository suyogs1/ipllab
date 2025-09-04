import React from 'react';
import { clsx } from 'clsx';

interface ScrollAreaProps {
  children: React.ReactNode;
  className?: string;
}

export const ScrollArea: React.FC<ScrollAreaProps> = ({ children, className }) => {
  return (
    <div 
      className={clsx(
        'min-h-0 h-full overflow-y-auto overscroll-contain',
        'rounded-lg shadow-[inset_0_0_0_1px_rgba(110,243,255,.15)]',
        // Add default padding if no padding classes are provided
        !className?.includes('p-') && !className?.includes('px-') && !className?.includes('py-') ? 'p-4' : '',
        className
      )}
      style={{ 
        flex: '1 1 0%',
        minHeight: 0
      }}
    >
      {children}
    </div>
  );
};