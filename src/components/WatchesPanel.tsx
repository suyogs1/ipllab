import React, { useState, useCallback } from 'react';
import { Plus, X, Eye, EyeOff, AlertTriangle, Copy } from 'lucide-react';
import { NeonButton, TagPill } from './ui';
import { toHex } from '../utils/memory';

interface WatchExpression {
  id: string;
  expression: string;
  value: number | string;
  history: (number | string)[];
  error?: string;
  changed: boolean;
  isWatchpoint?: boolean;
  watchpointTriggered?: boolean;
}

interface WatchesPanelProps {
  watches: WatchExpression[];
  onAddWatch: (expression: string, isWatchpoint?: boolean) => void;
  onRemoveWatch: (id: string) => void;
  onToggleWatchpoint: (id: string) => void;
  onCopyValue: (value: number | string) => void;
}

export const WatchesPanel: React.FC<WatchesPanelProps> = ({
  watches,
  onAddWatch,
  onRemoveWatch,
  onToggleWatchpoint,
  onCopyValue
}) => {
  const [newExpression, setNewExpression] = useState('');
  const [showWatchpointHelp, setShowWatchpointHelp] = useState(false);

  const handleAddWatch = useCallback(() => {
    if (!newExpression.trim()) return;
    
    // Check if it's a watchpoint syntax: watch [address] or [label]
    const isWatchpoint = newExpression.trim().toLowerCase().startsWith('watch ');
    const expression = isWatchpoint ? newExpression.slice(6).trim() : newExpression.trim();
    
    onAddWatch(expression, isWatchpoint);
    setNewExpression('');
  }, [newExpression, onAddWatch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddWatch();
    }
  }, [handleAddWatch]);

  const formatValue = useCallback((value: number | string): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') {
      return `${value} (${toHex(value)})`;
    }
    return String(value);
  }, []);

  const getWatchIcon = useCallback((watch: WatchExpression) => {
    if (watch.error) {
      return <AlertTriangle className="w-4 h-4 text-red-400" />;
    }
    if (watch.isWatchpoint) {
      return watch.watchpointTriggered ? 
        <Eye className="w-4 h-4 text-orange-400" /> : 
        <Eye className="w-4 h-4 text-blue-400" />;
    }
    return <Eye className="w-4 h-4 text-slate-400" />;
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-edge/50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-300">Watches & Watchpoints</h3>
          <NeonButton
            variant="ghost"
            size="sm"
            onClick={() => setShowWatchpointHelp(!showWatchpointHelp)}
            title="Show help"
          >
            ?
          </NeonButton>
        </div>

        {/* Add watch input */}
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Expression or 'watch [address]'"
            value={newExpression}
            onChange={(e) => setNewExpression(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-3 py-2 bg-panel border border-edge rounded-lg text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent font-mono"
          />
          <NeonButton
            variant="accent"
            size="sm"
            onClick={handleAddWatch}
            disabled={!newExpression.trim()}
            title="Add watch"
          >
            <Plus className="w-4 h-4" />
          </NeonButton>
        </div>

        {/* Help text */}
        {showWatchpointHelp && (
          <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-slate-300">
            <div className="font-semibold mb-1">Watch Expressions:</div>
            <div className="space-y-1 text-slate-400">
              <div>• <code>R0</code>, <code>SP</code>, <code>BP</code> - Register values</div>
              <div>• <code>[0x1000]</code>, <code>[R0]</code>, <code>[R0+4]</code> - Memory values</div>
              <div>• <code>[label]</code> - Memory at label address</div>
            </div>
            <div className="font-semibold mt-2 mb-1">Watchpoints (pause on change):</div>
            <div className="space-y-1 text-slate-400">
              <div>• <code>watch [0x2000]</code> - Watch memory address</div>
              <div>• <code>watch [label]</code> - Watch memory at label</div>
            </div>
          </div>
        )}
      </div>

      {/* Watch list */}
      <div className="flex-1 overflow-auto">
        {watches.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            <div className="text-center">
              <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No watches</p>
              <p className="text-xs mt-1">Add expressions to monitor values</p>
            </div>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {watches.map((watch) => (
              <div
                key={watch.id}
                className={`
                  p-3 rounded-lg border transition-all duration-300
                  ${watch.error ? 'border-red-500/30 bg-red-500/5' : 
                    watch.watchpointTriggered ? 'border-orange-500/50 bg-orange-500/10' :
                    watch.changed ? 'border-accent/50 bg-accent/10' : 
                    'border-edge/30 bg-panel/50'}
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      {getWatchIcon(watch)}
                      <code className="text-sm text-slate-300 font-mono truncate">
                        {watch.expression}
                      </code>
                      {watch.isWatchpoint && (
                        <TagPill variant="secondary" className="text-xs">
                          WP
                        </TagPill>
                      )}
                      {watch.watchpointTriggered && (
                        <TagPill variant="warning" className="text-xs animate-pulse">
                          TRIGGERED
                        </TagPill>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className={`
                        text-sm font-mono
                        ${watch.error ? 'text-red-400' : 
                          watch.changed ? 'text-accent font-semibold' : 'text-slate-200'}
                      `}>
                        {watch.error ? `Error: ${watch.error}` : formatValue(watch.value)}
                      </span>
                      
                      {!watch.error && (
                        <NeonButton
                          variant="ghost"
                          size="sm"
                          onClick={() => onCopyValue(watch.value)}
                          title="Copy value"
                        >
                          <Copy className="w-3 h-3" />
                        </NeonButton>
                      )}
                    </div>

                    {/* Value history */}
                    {watch.history.length > 1 && !watch.error && (
                      <div className="mt-2 text-xs text-slate-400">
                        <span className="font-medium">History: </span>
                        {watch.history.slice(1, 4).map((histValue, index) => (
                          <span key={index} className="mr-2 font-mono">
                            {typeof histValue === 'number' ? histValue : String(histValue)}
                          </span>
                        ))}
                        {watch.history.length > 4 && <span>...</span>}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-1 ml-2">
                    {watch.isWatchpoint && (
                      <NeonButton
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleWatchpoint(watch.id)}
                        title="Toggle watchpoint"
                      >
                        <EyeOff className="w-3 h-3" />
                      </NeonButton>
                    )}
                    <NeonButton
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveWatch(watch.id)}
                      title="Remove watch"
                    >
                      <X className="w-3 h-3" />
                    </NeonButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {watches.length > 0 && (
        <div className="p-2 border-t border-edge/50 text-xs text-slate-400">
          <div className="flex justify-between">
            <span>
              {watches.filter(w => w.isWatchpoint).length} watchpoints, {watches.filter(w => !w.isWatchpoint).length} watches
            </span>
            <span>
              {watches.filter(w => w.changed).length} changed
            </span>
          </div>
        </div>
      )}
    </div>
  );
};