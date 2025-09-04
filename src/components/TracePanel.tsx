import React, { useState, useCallback } from 'react';
import { Play, Pause, SkipBack, RotateCcw, Clock } from 'lucide-react';
import { NeonButton, TagPill } from './ui';
import { toHex } from '../utils/memory';

interface TraceSnapshot {
  ip: number;
  line: number;
  op: string;
  operands: string;
  registers: number[];
  flags: { ZF: boolean; NF: boolean; CF: boolean; OF: boolean };
  memoryDiff?: any[];
  timestamp: number;
}

interface TracePanelProps {
  isRecording: boolean;
  trace: TraceSnapshot[];
  currentIndex: number;
  maxEntries: number;
  onToggleRecording: () => void;
  onStepBack: () => void;
  onClearTrace: () => void;
  onJumpToTrace: (index: number) => void;
}

export const TracePanel: React.FC<TracePanelProps> = ({
  isRecording,
  trace,
  currentIndex,
  maxEntries,
  onToggleRecording,
  onStepBack,
  onClearTrace,
  onJumpToTrace
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleTraceClick = useCallback((index: number) => {
    setSelectedIndex(index);
    onJumpToTrace(index);
  }, [onJumpToTrace]);

  const formatTimestamp = useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  }, []);

  const formatFlags = useCallback((flags: TraceSnapshot['flags']) => {
    const flagStr = [
      flags.ZF ? 'Z' : '-',
      flags.NF ? 'N' : '-',
      flags.CF ? 'C' : '-',
      flags.OF ? 'O' : '-'
    ].join('');
    return flagStr;
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header with controls */}
      <div className="p-3 border-b border-edge/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <NeonButton
              variant={isRecording ? "danger" : "accent"}
              size="sm"
              onClick={onToggleRecording}
              title={isRecording ? "Stop recording" : "Start recording"}
            >
              {isRecording ? (
                <>
                  <Pause className="w-4 h-4 mr-1" />
                  Recording
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1" />
                  Record
                </>
              )}
            </NeonButton>

            <NeonButton
              variant="secondary"
              size="sm"
              onClick={onStepBack}
              disabled={currentIndex <= 0 || trace.length === 0}
              title="Step back"
            >
              <SkipBack className="w-4 h-4" />
            </NeonButton>

            <NeonButton
              variant="ghost"
              size="sm"
              onClick={onClearTrace}
              title="Clear trace"
            >
              <RotateCcw className="w-4 h-4" />
            </NeonButton>
          </div>

          <div className="flex items-center space-x-2">
            {isRecording && (
              <TagPill variant="accent">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-1" />
                REC
              </TagPill>
            )}
            <TagPill variant="secondary">
              {trace.length}/{maxEntries}
            </TagPill>
          </div>
        </div>

        <div className="text-xs text-slate-400">
          {trace.length === 0 ? (
            "No trace data. Enable recording and execute instructions."
          ) : (
            `${trace.length} entries • Current: ${currentIndex + 1}`
          )}
        </div>
      </div>

      {/* Trace entries */}
      <div className="flex-1 overflow-auto">
        {trace.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            <div className="text-center">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No trace entries</p>
              <p className="text-xs mt-1">Start recording to capture execution history</p>
            </div>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {trace.map((entry, index) => (
              <div
                key={index}
                className={`
                  p-2 rounded-lg cursor-pointer transition-colors border
                  ${index === currentIndex ? 'bg-accent/20 border-accent' : 'border-transparent'}
                  ${selectedIndex === index ? 'bg-blue-500/10 border-blue-500/30' : ''}
                  hover:bg-slate-700/30
                `}
                onClick={() => handleTraceClick(index)}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-400 font-mono">
                      #{index.toString().padStart(3, '0')}
                    </span>
                    <span className="text-xs text-slate-400">
                      IP: {toHex(entry.ip, 4)}
                    </span>
                    <span className="text-xs text-slate-400">
                      Line: {entry.line}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </div>

                <div className="font-mono text-sm">
                  <span className="text-accent font-semibold">{entry.op}</span>
                  {entry.operands && (
                    <span className="text-slate-300 ml-2">{entry.operands}</span>
                  )}
                </div>

                <div className="flex items-center justify-between mt-1 text-xs">
                  <div className="flex items-center space-x-3">
                    <span className="text-slate-400">
                      Flags: <span className="font-mono text-slate-300">{formatFlags(entry.flags)}</span>
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {entry.registers.slice(0, 4).map((reg, regIndex) => (
                      <span key={regIndex} className="text-slate-400">
                        R{regIndex}: <span className="text-slate-300 font-mono">{reg}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {entry.memoryDiff && entry.memoryDiff.length > 0 && (
                  <div className="mt-1 text-xs text-orange-400">
                    Memory changes: {entry.memoryDiff.length} locations
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {trace.length > 0 && (
        <div className="p-2 border-t border-edge/50 text-xs text-slate-400">
          <div className="flex justify-between">
            <span>
              Buffer: {((trace.length / maxEntries) * 100).toFixed(1)}% full
            </span>
            <span>
              Step back available: {currentIndex > 0 ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};