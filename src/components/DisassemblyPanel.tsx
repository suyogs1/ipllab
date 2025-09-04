import React, { useState, useCallback, useEffect } from 'react';
import { Search, MapPin, Copy } from 'lucide-react';
import { NeonButton } from './ui';

interface DisassemblyEntry {
  address: number;
  opcode: string;
  operands: string;
  label?: string;
  source: string;
}

interface DisassemblyPanelProps {
  disassembly: DisassemblyEntry[];
  symbols: Record<string, number>;
  currentIP: number;
  onJumpToAddress: (address: number) => void;
  onCopyAddress: (address: number) => void;
}

export const DisassemblyPanel: React.FC<DisassemblyPanelProps> = ({
  disassembly,
  symbols,
  currentIP,
  onJumpToAddress,
  onCopyAddress
}) => {
  const [filter, setFilter] = useState('');
  const [selectedAddress, setSelectedAddress] = useState<number | null>(null);

  const filteredDisassembly = disassembly.filter(entry => {
    if (!filter) return true;
    const searchTerm = filter.toLowerCase();
    return (
      entry.opcode.toLowerCase().includes(searchTerm) ||
      entry.operands.toLowerCase().includes(searchTerm) ||
      entry.label?.toLowerCase().includes(searchTerm) ||
      entry.address.toString(16).includes(searchTerm)
    );
  });

  const handleRowClick = useCallback((address: number) => {
    setSelectedAddress(address);
    onJumpToAddress(address);
  }, [onJumpToAddress]);

  const handleCopyAddress = useCallback((address: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onCopyAddress(address);
  }, [onCopyAddress]);

  // Auto-scroll to current IP
  useEffect(() => {
    const currentRow = document.querySelector(`[data-address="${currentIP}"]`);
    if (currentRow) {
      currentRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentIP]);

  return (
    <div className="flex flex-col h-full">
      {/* Header with search */}
      <div className="p-3 border-b border-edge/50">
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filter instructions..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-panel border border-edge rounded-lg text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>
      </div>

      {/* Disassembly table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm font-mono">
          <thead className="sticky top-0 bg-panel border-b border-edge/50">
            <tr>
              <th className="text-left p-2 text-slate-400 font-medium">Address</th>
              <th className="text-left p-2 text-slate-400 font-medium">Label</th>
              <th className="text-left p-2 text-slate-400 font-medium">Opcode</th>
              <th className="text-left p-2 text-slate-400 font-medium">Operands</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {filteredDisassembly.map((entry) => (
              <tr
                key={entry.address}
                data-address={entry.address}
                className={`
                  cursor-pointer hover:bg-accent/10 transition-colors
                  ${entry.address === currentIP ? 'bg-accent/20 border-l-4 border-accent' : ''}
                  ${selectedAddress === entry.address ? 'bg-blue-500/10' : ''}
                `}
                onClick={() => handleRowClick(entry.address)}
              >
                <td className="p-2 text-slate-300">
                  0x{entry.address.toString(16).padStart(4, '0').toUpperCase()}
                </td>
                <td className="p-2 text-accent">
                  {entry.label || ''}
                </td>
                <td className="p-2 text-slate-200 font-semibold">
                  {entry.opcode}
                </td>
                <td className="p-2 text-slate-300">
                  {entry.operands}
                </td>
                <td className="p-2">
                  <NeonButton
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleCopyAddress(entry.address, e)}
                    title="Copy address"
                  >
                    <Copy className="w-3 h-3" />
                  </NeonButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Symbols section */}
      {Object.keys(symbols).length > 0 && (
        <div className="border-t border-edge/50 p-3">
          <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center">
            <MapPin className="w-4 h-4 mr-1" />
            Symbols
          </h4>
          <div className="space-y-1 max-h-32 overflow-auto">
            {Object.entries(symbols).map(([label, address]) => (
              <div
                key={label}
                className="flex items-center justify-between text-xs cursor-pointer hover:bg-accent/10 p-1 rounded"
                onClick={() => handleRowClick(address)}
              >
                <span className="text-accent">{label}</span>
                <div className="flex items-center space-x-2">
                  <span className="text-slate-400">
                    0x{address.toString(16).padStart(4, '0').toUpperCase()}
                  </span>
                  <NeonButton
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleCopyAddress(address, e)}
                    title="Copy address"
                  >
                    <Copy className="w-3 h-3" />
                  </NeonButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};