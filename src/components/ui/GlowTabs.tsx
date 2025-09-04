import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface GlowTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: any) => void;
  className?: string;
}

export const GlowTabs: React.FC<GlowTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className,
}) => {
  return (
    <div className={clsx('flex space-x-1 bg-edge/50 p-1 rounded-xl backdrop-blur-sm', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          data-testid={`${tab.id}-tab`}
          className={clsx(
            'relative px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
            activeTab === tab.id
              ? 'text-accent'
              : 'text-slate-400 hover:text-slate-200'
          )}
        >
          {activeTab === tab.id && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-0 bg-accent/20 border border-accent/50 rounded-lg shadow-neon-sm"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
            />
          )}
          <span className="relative flex items-center space-x-2">
            {tab.icon}
            <span>{tab.label}</span>
          </span>
        </button>
      ))}
    </div>
  );
};