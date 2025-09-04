import React, { useState, useCallback } from 'react';
import { Gauge, Zap, Clock, Settings } from 'lucide-react';
import { NeonButton, TagPill } from './ui';

interface PerformanceControlsProps {
  speed: number;
  onSpeedChange: (speed: number) => void;
  isRunning: boolean;
  stepsPerSecond?: number;
  batchSize: number;
  onBatchSizeChange: (size: number) => void;
}

export const PerformanceControls: React.FC<PerformanceControlsProps> = ({
  speed,
  onSpeedChange,
  isRunning,
  stepsPerSecond = 0,
  batchSize,
  onBatchSizeChange
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const speedOptions = [
    { value: 0, label: 'Max', description: 'No throttling', icon: <Zap className="w-4 h-4" /> },
    { value: 1, label: '1x', description: '~10 steps/sec', icon: <Clock className="w-4 h-4" /> },
    { value: 2, label: '2x', description: '~20 steps/sec', icon: <Clock className="w-4 h-4" /> },
    { value: 4, label: '4x', description: '~40 steps/sec', icon: <Clock className="w-4 h-4" /> },
    { value: 8, label: '8x', description: '~80 steps/sec', icon: <Clock className="w-4 h-4" /> }
  ];

  const batchOptions = [50, 100, 250, 500, 1000];

  const handleSpeedChange = useCallback((newSpeed: number) => {
    onSpeedChange(newSpeed);
  }, [onSpeedChange]);

  const handleBatchSizeChange = useCallback((newSize: number) => {
    onBatchSizeChange(newSize);
  }, [onBatchSizeChange]);

  const formatStepsPerSecond = useCallback((steps: number) => {
    if (steps === 0) return '0';
    if (steps < 1000) return steps.toFixed(0);
    if (steps < 1000000) return `${(steps / 1000).toFixed(1)}K`;
    return `${(steps / 1000000).toFixed(1)}M`;
  }, []);

  return (
    <div className="space-y-3">
      {/* Speed Control */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <Gauge className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-400">Speed:</span>
        </div>
        
        <div className="flex items-center space-x-1">
          {speedOptions.map((option) => (
            <NeonButton
              key={option.value}
              variant={speed === option.value ? "accent" : "ghost"}
              size="sm"
              onClick={() => handleSpeedChange(option.value)}
              title={option.description}
              className="min-w-[3rem]"
            >
              {option.value === 0 ? option.icon : null}
              <span className={option.value === 0 ? "ml-1" : ""}>{option.label}</span>
            </NeonButton>
          ))}
        </div>

        {/* Performance indicator */}
        {isRunning && stepsPerSecond > 0 && (
          <TagPill variant="accent" className="animate-pulse">
            {formatStepsPerSecond(stepsPerSecond)} steps/s
          </TagPill>
        )}
      </div>

      {/* Advanced controls toggle */}
      <div className="flex items-center justify-between">
        <NeonButton
          variant="ghost"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs"
        >
          <Settings className="w-3 h-3 mr-1" />
          Advanced
        </NeonButton>

        {/* Current settings summary */}
        <div className="text-xs text-slate-400">
          Batch: {batchSize} steps
        </div>
      </div>

      {/* Advanced controls */}
      {showAdvanced && (
        <div className="p-3 bg-panel/50 border border-edge/30 rounded-lg space-y-3">
          <div className="text-xs font-semibold text-slate-300 mb-2">Performance Tuning</div>
          
          {/* Batch size control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-400">Batch Size:</label>
              <span className="text-xs text-slate-300 font-mono">{batchSize} steps</span>
            </div>
            
            <div className="flex items-center space-x-1">
              {batchOptions.map((size) => (
                <NeonButton
                  key={size}
                  variant={batchSize === size ? "accent" : "ghost"}
                  size="sm"
                  onClick={() => handleBatchSizeChange(size)}
                  className="text-xs px-2 py-1"
                >
                  {size}
                </NeonButton>
              ))}
            </div>
            
            <div className="text-xs text-slate-500">
              Higher batch sizes improve performance but reduce UI responsiveness
            </div>
          </div>

          {/* Performance tips */}
          <div className="space-y-1 text-xs text-slate-500">
            <div className="font-medium text-slate-400">Tips:</div>
            <div>• Use "Max" speed for long-running programs</div>
            <div>• Increase batch size if UI feels sluggish</div>
            <div>• Lower speeds help with debugging</div>
          </div>
        </div>
      )}

      {/* Speed descriptions */}
      <div className="text-xs text-slate-500">
        {speedOptions.find(opt => opt.value === speed)?.description}
      </div>
    </div>
  );
};