import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface PanelHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({
  title,
  subtitle,
  icon,
  actions,
  className,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={clsx(
        'flex items-center justify-between p-4 border-b border-edge/50',
        className
      )}
    >
      <div className="flex items-center space-x-3">
        {icon && (
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/20 text-accent">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-lg font-semibold text-slate-200">{title}</h3>
          {subtitle && (
            <p className="text-sm text-slate-400">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center space-x-2">
          {actions}
        </div>
      )}
    </motion.div>
  );
};