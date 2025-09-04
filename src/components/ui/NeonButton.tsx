import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface NeonButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  isLoading?: boolean;
}

export const NeonButton: React.FC<NeonButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  isLoading = false,
  className,
  disabled,
  ...props
}) => {
  const baseClasses = 'relative font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: 'bg-accent/20 text-accent border border-accent/50 hover:bg-accent/30 hover:shadow-neon-sm focus-visible:ring-accent backdrop-blur-sm',
    secondary: 'bg-accent2/20 text-accent2 border border-accent2/50 hover:bg-accent2/30 hover:shadow-neon-sm focus-visible:ring-accent2 backdrop-blur-sm',
    danger: 'bg-danger/20 text-danger border border-danger/50 hover:bg-danger/30 hover:shadow-neon-sm focus-visible:ring-danger backdrop-blur-sm',
    ghost: 'text-slate-300 hover:text-accent hover:bg-accent/10 focus-visible:ring-accent',
    accent: 'bg-accent/20 text-accent border border-accent/50 hover:bg-accent/30 hover:shadow-neon-sm focus-visible:ring-accent backdrop-blur-sm',
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-4 py-2 text-sm rounded-xl',
    lg: 'px-6 py-3 text-base rounded-xl',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={clsx(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>Loading...</span>
        </div>
      ) : (
        children
      )}
    </motion.button>
  );
};