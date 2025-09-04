import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog } from '@headlessui/react';
import { 
  Search, 
  Play, 
  StepForward, 
  SkipForward, 
  Circle, 
  MapPin, 
  Eye,
  BookOpen,
  Bug,
  FileText,
  Zap
} from 'lucide-react';
import { clsx } from 'clsx';

interface Command {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLesson?: (lessonId: string) => void;
  onOpenChallenge?: (challengeId: string) => void;
  onDebugAction?: (action: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenLesson,
  onOpenChallenge,
  onDebugAction,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: Command[] = useMemo(() => [
    // Learning commands
    {
      id: 'open-basics',
      title: 'Open Assembly Basics',
      subtitle: 'Learn fundamental assembly concepts',
      icon: <BookOpen className="w-4 h-4" />,
      action: () => onOpenLesson?.('basics'),
      keywords: ['learn', 'basics', 'assembly', 'fundamentals'],
    },
    {
      id: 'open-registers',
      title: 'Open Registers Lesson',
      subtitle: 'Understanding CPU registers',
      icon: <BookOpen className="w-4 h-4" />,
      action: () => onOpenLesson?.('registers'),
      keywords: ['learn', 'registers', 'cpu', 'memory'],
    },
    {
      id: 'open-fibonacci',
      title: 'Open Fibonacci Challenge',
      subtitle: 'Implement Fibonacci sequence',
      icon: <Zap className="w-4 h-4" />,
      action: () => onOpenChallenge?.('fibonacci'),
      keywords: ['challenge', 'fibonacci', 'sequence', 'algorithm'],
    },
    
    // Debug commands
    {
      id: 'run-code',
      title: 'Run Code',
      subtitle: 'Execute the current program',
      icon: <Play className="w-4 h-4" />,
      action: () => onDebugAction?.('run'),
      keywords: ['run', 'execute', 'start', 'play'],
    },
    {
      id: 'step-over',
      title: 'Step Over',
      subtitle: 'Execute next instruction',
      icon: <StepForward className="w-4 h-4" />,
      action: () => onDebugAction?.('step'),
      keywords: ['step', 'next', 'instruction', 'debug'],
    },
    {
      id: 'continue',
      title: 'Continue',
      subtitle: 'Continue execution',
      icon: <SkipForward className="w-4 h-4" />,
      action: () => onDebugAction?.('continue'),
      keywords: ['continue', 'resume', 'run'],
    },
    {
      id: 'toggle-breakpoint',
      title: 'Toggle Breakpoint',
      subtitle: 'Add or remove breakpoint at current line',
      icon: <Circle className="w-4 h-4" />,
      action: () => onDebugAction?.('breakpoint'),
      keywords: ['breakpoint', 'break', 'stop', 'pause'],
    },
    {
      id: 'goto-address',
      title: 'Go to Address',
      subtitle: 'Jump to memory address',
      icon: <MapPin className="w-4 h-4" />,
      action: () => onDebugAction?.('goto'),
      keywords: ['goto', 'address', 'jump', 'memory'],
    },
    {
      id: 'toggle-follow-sp',
      title: 'Toggle Follow Stack Pointer',
      subtitle: 'Auto-scroll to stack pointer',
      icon: <Eye className="w-4 h-4" />,
      action: () => onDebugAction?.('follow-sp'),
      keywords: ['follow', 'stack', 'pointer', 'scroll'],
    },
    
    // Documentation
    {
      id: 'open-docs',
      title: 'Open Documentation',
      subtitle: 'Assembly reference and guides',
      icon: <FileText className="w-4 h-4" />,
      action: () => onDebugAction?.('docs'),
      keywords: ['docs', 'documentation', 'reference', 'help'],
    },
  ], [onOpenLesson, onOpenChallenge, onDebugAction]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    
    const searchTerm = query.toLowerCase();
    return commands.filter(command =>
      command.title.toLowerCase().includes(searchTerm) ||
      command.subtitle?.toLowerCase().includes(searchTerm) ||
      command.keywords.some(keyword => keyword.includes(searchTerm))
    );
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          onClose();
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog
          as={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          open={isOpen}
          onClose={onClose}
          className="fixed inset-0 z-50 overflow-y-auto"
        >
          <div className="flex min-h-screen items-start justify-center p-4 pt-[10vh]">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="relative w-full max-w-2xl bg-panel backdrop-blur-md border border-edge rounded-2xl shadow-glass overflow-hidden"
            >
              {/* Search input */}
              <div className="flex items-center px-4 py-3 border-b border-edge/50">
                <Search className="w-5 h-5 text-slate-400 mr-3" />
                <input
                  type="text"
                  placeholder="Search commands..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent text-slate-200 placeholder-slate-400 focus:outline-none"
                  autoFocus
                />
                <kbd className="hidden sm:inline-block px-2 py-1 text-xs text-slate-400 bg-slate-700/50 rounded border border-slate-600">
                  ESC
                </kbd>
              </div>

              {/* Commands list */}
              <div className="max-h-96 overflow-y-auto">
                {filteredCommands.length === 0 ? (
                  <div className="px-4 py-8 text-center text-slate-400">
                    No commands found for "{query}"
                  </div>
                ) : (
                  <div className="py-2">
                    {filteredCommands.map((command, index) => (
                      <button
                        key={command.id}
                        onClick={() => {
                          command.action();
                          onClose();
                        }}
                        className={clsx(
                          'w-full flex items-center px-4 py-3 text-left transition-colors focus:outline-none',
                          index === selectedIndex
                            ? 'bg-accent/20 text-accent'
                            : 'text-slate-300 hover:bg-slate-700/30'
                        )}
                      >
                        <div className="flex items-center justify-center w-8 h-8 mr-3 rounded-lg bg-slate-700/50">
                          {command.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{command.title}</div>
                          {command.subtitle && (
                            <div className="text-sm opacity-70">{command.subtitle}</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-edge/50 bg-slate-900/50">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Use ↑↓ to navigate, ↵ to select</span>
                  <div className="flex items-center space-x-2">
                    <kbd className="px-1.5 py-0.5 bg-slate-700/50 rounded border border-slate-600">
                      Ctrl
                    </kbd>
                    <span>+</span>
                    <kbd className="px-1.5 py-0.5 bg-slate-700/50 rounded border border-slate-600">
                      K
                    </kbd>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
};