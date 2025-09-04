import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface TagPillProps {
  children: React.ReactNode;
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'secondary' | 'info' | 'accent2';
  size?: 'sm' | 'md';
  className?: string;
}

export const TagPill: React.FC<TagPillProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  className,
}) => {
  const variantClasses = {
    default: 'bg-slate-700/50 text-slate-300 border-slate-600/50',
    accent: 'bg-accent/20 text-accent border-accent/50',
    success: 'bg-ok/20 text-ok border-ok/50',
    warning: 'bg-warn/20 text-warn border-warn/50',
    danger: 'bg-danger/20 text-danger border-danger/50',
    secondary: 'bg-accent2/20 text-accent2 border-accent2/50',
    info: 'bg-accent/20 text-accent border-accent/50',
    accent2: 'bg-accent2/20 text-accent2 border-accent2/50',
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={clsx(
        'inline-flex items-center font-medium rounded-full border backdrop-blur-sm',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </motion.span>
  );
};