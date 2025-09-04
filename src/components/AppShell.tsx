import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BookOpen, 
  Bug, 
  FileText, 
  Command, 
  Moon, 
  Sun,
  Award,
  Flame,
  Menu,
  X
} from 'lucide-react';
import { APP_NAME, TAGLINE } from '../config/brand';
import { GlowTabs } from './ui/GlowTabs';
import { NeonButton } from './ui/NeonButton';
import { TagPill } from './ui/TagPill';
import { CommandPalette } from './CommandPalette';

type TabType = 'learn' | 'debug' | 'docs';

interface AppShellProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  children: React.ReactNode;
  onCommandAction?: (action: string) => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  onTabChange,
  children,
  onCommandAction,
}) => {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [streak, setStreak] = useState(7);
  const [badges, setBadges] = useState(3);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const tabs = [
    {
      id: 'learn' as const,
      label: 'Learn',
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      id: 'debug' as const,
      label: 'Debugger',
      icon: <Bug className="w-4 h-4" />,
    },
    {
      id: 'docs' as const,
      label: 'Docs',
      icon: <FileText className="w-4 h-4" />,
    },
  ];

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden bg-bg text-slate-200">
      {/* Animated background */}
      <div className="cyber-bg" />
      
      {/* Header */}
      <header className="relative z-10 bg-panel/80 backdrop-blur-md border-b border-edge shadow-glass">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo and title */}
            <motion.div 
              className="flex items-center space-x-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-accent to-accent2 rounded-xl flex items-center justify-center shadow-neon-sm">
                  <span className="text-bg font-bold text-xl">A</span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-accent to-accent2 rounded-xl blur-lg opacity-30 -z-10" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-accent to-accent2 bg-clip-text text-transparent">
                  {APP_NAME}
                </h1>
                <p className="text-xs text-slate-400">{TAGLINE}</p>
              </div>
            </motion.div>

            {/* Desktop controls */}
            <div className="hidden md:flex items-center space-x-4">
              {/* Stats */}
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1">
                  <Flame className="w-4 h-4 text-warn" />
                  <span className="text-sm font-medium">{streak}</span>
                  <span className="text-xs text-slate-400">day streak</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Award className="w-4 h-4 text-accent2" />
                  <span className="text-sm font-medium">{badges}</span>
                  <span className="text-xs text-slate-400">badges</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2">
                <NeonButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCommandPaletteOpen(true)}
                  className="flex items-center space-x-2"
                >
                  <Command className="w-4 h-4" />
                  <span className="hidden lg:inline">Command</span>
                  <TagPill size="sm" className="hidden lg:inline-flex">
                    ⌘K
                  </TagPill>
                </NeonButton>
                
                <NeonButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDarkMode(!isDarkMode)}
                >
                  {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </NeonButton>
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <NeonButton
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </NeonButton>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden bg-panel/90 backdrop-blur-md border-b border-edge"
        >
          <div className="px-6 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1">
                  <Flame className="w-4 h-4 text-warn" />
                  <span className="text-sm font-medium">{streak} day streak</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Award className="w-4 h-4 text-accent2" />
                  <span className="text-sm font-medium">{badges} badges</span>
                </div>
              </div>
              <NeonButton
                variant="ghost"
                size="sm"
                onClick={() => setIsDarkMode(!isDarkMode)}
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </NeonButton>
            </div>
            <NeonButton
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsCommandPaletteOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="w-full justify-center"
            >
              <Command className="w-4 h-4 mr-2" />
              Open Command Palette
            </NeonButton>
          </div>
        </motion.div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-64 bg-panel/50 backdrop-blur-sm border-r border-edge">
          <div className="flex flex-col w-full p-4">
            <GlowTabs
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={onTabChange}
              className="flex-col space-x-0 space-y-1 bg-transparent p-0"
            />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-h-0 overflow-hidden">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden bg-panel/80 backdrop-blur-md border-t border-edge">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center py-3 px-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-accent bg-accent/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.icon}
              <span className="text-xs mt-1">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onDebugAction={onCommandAction}
      />
    </div>
  );
};