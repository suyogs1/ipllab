import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, Pin, PinOff, Navigation } from 'lucide-react';
import { NeonButton } from './ui';
import { toHex, getMemoryDump } from '../utils/memory';

interface MemoryViewerProps {
  ram: DataView;
  currentSP: number;
  symbols: Record<string, number>;
  onAddressChange?: (address: number) => void;
}

export const MemoryViewer: React.FC<MemoryViewerProps> = ({
  ram,
  currentSP,
  symbols,
  onAddressChange
}) => {
  const [startAddress, setStartAddress] = useState(0);
  const [addressInput, setAddressInput] = useState('0x0000');
  const [followSP, setFollowSP] = useState(false);
  const [bytesPerRow] = useState(16);
  const [rowCount] = useState(16);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update start address when following SP
  useEffect(() => {
    if (followSP) {
      const newStart = Math.max(0, (currentSP - 64) & ~0xF);
      setStartAddress(newStart);
      setAddressInput(`0x${newStart.toString(16).padStart(4, '0').toUpperCase()}`);
    }
  }, [currentSP, followSP]);

  const handleAddressGoto = useCallback(() => {
    try {
      let addr = 0;
      const input = addressInput.trim();

      if (input.startsWith('0x') || input.startsWith('0X')) {
        addr = parseInt(input, 16);
      } else if (/^\d+$/.test(input)) {
        addr = parseInt(input, 10);
      } else if (symbols[input.toLowerCase()]) {
        addr = symbols[input.toLowerCase()];
      } else {
        throw new Error(`Invalid address: ${input}`);
      }

      if (addr < 0 || addr >= ram.byteLength) {
        throw new Error(`Address out of bounds: ${addr}`);
      }

      const alignedAddr = addr & ~0xF; // Align to 16-byte boundary
      setStartAddress(alignedAddr);
      setAddressInput(`0x${alignedAddr.toString(16).padStart(4, '0').toUpperCase()}`);
      onAddressChange?.(alignedAddr);
    } catch (err) {
      console.error('Memory goto error:', err);
    }
  }, [addressInput, symbols, ram.byteLength, onAddressChange]);

  const handleScroll = useCallback((direction: 'up' | 'down') => {
    const delta = direction === 'up' ? -bytesPerRow : bytesPerRow;
    const newStart = Math.max(0, Math.min(startAddress + delta, ram.byteLength - (rowCount * bytesPerRow)));
    setStartAddress(newStart);
    setAddressInput(`0x${newStart.toString(16).padStart(4, '0').toUpperCase()}`);
    onAddressChange?.(newStart);
  }, [startAddress, bytesPerRow, rowCount, ram.byteLength, onAddressChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddressGoto();
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      handleScroll('up');
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      handleScroll('down');
    }
  }, [handleAddressGoto, handleScroll]);

  const toggleFollowSP = useCallback(() => {
    setFollowSP(prev => !prev);
  }, []);

  // Generate memory dump
  const memoryLines = getMemoryDump(ram, startAddress, rowCount * bytesPerRow);

  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      {/* Header with controls */}
      <div className="p-3 border-b border-edge/50 space-y-2">
        <div className="flex items-center space-x-2">
          <div className="flex-1 flex items-center space-x-2">
            <input
              type="text"
              placeholder="Address (hex/dec/label)"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 px-3 py-1 bg-panel border border-edge rounded-lg text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent font-mono"
            />
            <NeonButton
              variant="secondary"
              size="sm"
              onClick={handleAddressGoto}
              title="Go to address"
            >
              <Navigation className="w-4 h-4" />
            </NeonButton>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <NeonButton
              variant="ghost"
              size="sm"
              onClick={() => handleScroll('up')}
              title="Page Up"
            >
              <ChevronUp className="w-4 h-4" />
            </NeonButton>
            <NeonButton
              variant="ghost"
              size="sm"
              onClick={() => handleScroll('down')}
              title="Page Down"
            >
              <ChevronDown className="w-4 h-4" />
            </NeonButton>
          </div>

          <NeonButton
            variant={followSP ? "accent" : "ghost"}
            size="sm"
            onClick={toggleFollowSP}
            title={followSP ? "Stop following SP" : "Follow SP"}
          >
            {followSP ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
            <span className="ml-1 text-xs">SP</span>
          </NeonButton>
        </div>
      </div>

      {/* Memory display */}
      <div className="flex-1 overflow-auto">
        <div className="p-3 font-mono text-sm">
          {memoryLines.map((line, index) => {
            const lineAddress = startAddress + (index * bytesPerRow);
            const isStackRegion = lineAddress >= currentSP - 32 && lineAddress <= currentSP + 32;
            const containsSP = lineAddress <= currentSP && currentSP < lineAddress + bytesPerRow;

            return (
              <div
                key={lineAddress}
                className={`
                  py-1 px-2 rounded transition-colors
                  ${isStackRegion ? 'bg-blue-500/10' : ''}
                  ${containsSP ? 'bg-accent/20 border-l-4 border-accent' : ''}
                  hover:bg-slate-700/30
                `}
              >
                <div className="flex items-center">
                  <span className="text-slate-400 mr-4 select-none">
                    {line.split(':')[0]}:
                  </span>
                  <div className="flex-1 grid grid-cols-16 gap-1 text-center">
                    {line.split('|')[0].split(':')[1].trim().split(' ').slice(0, 16).map((byte, byteIndex) => {
                      const byteAddress = lineAddress + byteIndex;
                      const isSP = byteAddress === currentSP;
                      
                      return (
                        <span
                          key={byteIndex}
                          className={`
                            px-1 rounded text-xs
                            ${isSP ? 'bg-accent text-bg font-bold' : 'text-slate-300'}
                            ${byte === '  ' ? '' : 'hover:bg-accent/30 cursor-pointer'}
                          `}
                          title={isSP ? `SP: ${toHex(byteAddress)}` : `${toHex(byteAddress)}: 0x${byte}`}
                        >
                          {byte || '  '}
                        </span>
                      );
                    })}
                  </div>
                  <span className="ml-4 text-slate-500 select-none">
                    |{line.split('|')[1]}|
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer with info */}
      <div className="p-2 border-t border-edge/50 text-xs text-slate-400">
        <div className="flex justify-between">
          <span>SP: {toHex(currentSP)}</span>
          <span>{bytesPerRow} bytes/row • {rowCount} rows</span>
        </div>
      </div>
    </div>
  );
};