import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Cpu, ArrowRight, Hash, FileText, Copy, Flag, Settings, HardDrive } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { PanelHeader } from '../components/ui/PanelHeader';
import { TagPill } from '../components/ui/TagPill';
import { NeonButton } from '../components/ui/NeonButton';
import { ScrollArea } from '../components/ScrollArea';

interface OpCode {
  id: string;
  name: string;
  category: string;
  description: string;
  syntax: string;
  flags: string;
  examples: Array<{
    code: string;
    description: string;
  }>;
  notes: string;
}

interface AddressingMode {
  id: string;
  name: string;
  syntax: string;
  description: string;
  examples: Array<{
    code: string;
    description: string;
  }>;
  notes: string;
  diagram: string;
}

interface Directive {
  id: string;
  name: string;
  description: string;
  syntax: string;
  examples: Array<{
    code: string;
    description: string;
  }>;
  notes: string;
}

interface Register {
  name: string;
  description: string;
  usage: string;
  notes: string;
}

interface Flag {
  name: string;
  description: string;
  usage: string;
  examples: string[];
}

interface DocsData {
  opcodes: OpCode[];
  addressing: AddressingMode[];
  directives: Directive[];
  registers: Register[];
  flags: Flag[];
}

const categoryColors = {
  data: 'success',
  memory: 'success', 
  arithmetic: 'accent',
  logic: 'accent2',
  control: 'warning',
  stack: 'danger',
  system: 'info',
} as const;

export const Docs: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('opcodes');
  const [docsData, setDocsData] = useState<DocsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDocs = async () => {
      try {
        const response = await fetch('/asm_docs.json');
        if (response.ok) {
          const data = await response.json();
          setDocsData(data);
        }
      } catch (error) {
        console.error('Failed to load documentation:', error);
      } finally {
        setLoading(false);
      }
    };
    loadDocs();
  }, []);

  if (loading || !docsData) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-slate-400">Loading documentation...</div>
      </div>
    );
  }

  const filteredOpcodes = docsData.opcodes.filter(opcode => {
    const matchesSearch = opcode.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         opcode.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         opcode.notes.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || opcode.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredAddressing = docsData.addressing.filter(mode => {
    return mode.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           mode.description.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredDirectives = docsData.directives.filter(directive => {
    return directive.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           directive.description.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const categories = ['all', 'data', 'memory', 'arithmetic', 'logic', 'control', 'stack', 'system'];
  const sections = [
    { id: 'opcodes', name: 'Instructions', icon: Cpu },
    { id: 'addressing', name: 'Addressing', icon: HardDrive },
    { id: 'directives', name: 'Directives', icon: Hash },
    { id: 'registers', name: 'Registers', icon: Settings },
    { id: 'flags', name: 'Flags', icon: Flag }
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="h-full min-h-0">
      <ScrollArea>
        <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-accent to-accent2 bg-clip-text text-transparent">
            Assembly Reference
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Complete reference for assembly language instructions, addressing modes, and directives.
          </p>
        </motion.div>

        {/* Search and filters */}
        <GlassCard className="p-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search documentation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-edge/50 border border-edge rounded-xl text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
            
            {/* Section tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <NeonButton
                    key={section.id}
                    variant={selectedSection === section.id ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedSection(section.id)}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {section.name}
                  </NeonButton>
                );
              })}
            </div>

            {/* Category filters (only for opcodes) */}
            {selectedSection === 'opcodes' && (
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <NeonButton
                    key={category}
                    variant={selectedCategory === category ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </NeonButton>
                ))}
              </div>
            )}
          </div>
        </GlassCard>

        {/* Content based on selected section */}
        {selectedSection === 'opcodes' && (
          <GlassCard>
            <PanelHeader
              title="Instructions"
              subtitle={`${filteredOpcodes.length} instructions`}
              icon={<Cpu className="w-5 h-5" />}
            />
            <ScrollArea className="p-6 space-y-4 max-h-[600px]">
              {filteredOpcodes.map((opcode, index) => (
                <motion.div
                  key={opcode.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 bg-edge/30 rounded-xl border border-edge/50 hover:border-accent/30 transition-colors"
                  id={`opcode-${opcode.id}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-mono font-semibold text-accent">
                        {opcode.name}
                      </h3>
                      <TagPill variant={categoryColors[opcode.category as keyof typeof categoryColors]} size="sm">
                        {opcode.category}
                      </TagPill>
                      {opcode.flags !== 'None' && (
                        <TagPill variant="info" size="sm">
                          Flags: {opcode.flags}
                        </TagPill>
                      )}
                    </div>
                  </div>
                  <p className="text-slate-300 mb-3">{opcode.description}</p>
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wide">Syntax</span>
                      <div className="flex items-center space-x-2 mt-1">
                        <code className="flex-1 p-2 bg-bg/50 rounded text-accent font-mono text-sm">
                          {opcode.syntax}
                        </code>
                        <button
                          onClick={() => copyToClipboard(opcode.syntax)}
                          className="p-2 text-slate-400 hover:text-accent transition-colors"
                          title="Copy syntax"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wide">Examples</span>
                      <div className="mt-1 space-y-2">
                        {opcode.examples.map((example, i) => (
                          <div key={i} className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <code className="flex-1 p-2 bg-bg/50 rounded text-ok font-mono text-sm">
                                {example.code}
                              </code>
                              <button
                                onClick={() => copyToClipboard(example.code)}
                                className="p-2 text-slate-400 hover:text-ok transition-colors"
                                title="Copy example"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                            <p className="text-xs text-slate-400 ml-2">{example.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    {opcode.notes && (
                      <div>
                        <span className="text-xs text-slate-400 uppercase tracking-wide">Notes</span>
                        <p className="mt-1 text-sm text-slate-300 bg-edge/20 p-2 rounded">
                          {opcode.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </ScrollArea>
          </GlassCard>
        )}

        {selectedSection === 'addressing' && (
          <GlassCard>
            <PanelHeader
              title="Addressing Modes"
              subtitle={`${filteredAddressing.length} modes`}
              icon={<HardDrive className="w-5 h-5" />}
            />
            <ScrollArea className="p-6 space-y-4 max-h-[600px]">
              {filteredAddressing.map((mode, index) => (
                <motion.div
                  key={mode.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 bg-edge/30 rounded-xl border border-edge/50"
                  id={`addressing-${mode.id}`}
                >
                  <div className="flex items-center space-x-2 mb-3">
                    <ArrowRight className="w-5 h-5 text-accent" />
                    <h3 className="text-lg font-semibold text-slate-200">{mode.name}</h3>
                    <code className="px-2 py-1 bg-accent/20 text-accent rounded text-sm font-mono">
                      {mode.syntax}
                    </code>
                  </div>
                  <p className="text-slate-300 mb-3">{mode.description}</p>
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wide">Examples</span>
                      <div className="mt-1 space-y-2">
                        {mode.examples.map((example, i) => (
                          <div key={i} className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <code className="flex-1 p-2 bg-bg/50 rounded text-accent2 font-mono text-sm">
                                {example.code}
                              </code>
                              <button
                                onClick={() => copyToClipboard(example.code)}
                                className="p-2 text-slate-400 hover:text-accent2 transition-colors"
                                title="Copy example"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                            <p className="text-xs text-slate-400 ml-2">{example.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wide">Flow Diagram</span>
                      <p className="mt-1 text-sm text-slate-300 bg-edge/20 p-2 rounded font-mono">
                        {mode.diagram}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wide">Notes</span>
                      <p className="mt-1 text-sm text-slate-300 bg-edge/20 p-2 rounded">
                        {mode.notes}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </ScrollArea>
          </GlassCard>
        )}

        {selectedSection === 'directives' && (
          <GlassCard>
            <PanelHeader
              title="Assembler Directives"
              subtitle={`${filteredDirectives.length} directives`}
              icon={<Hash className="w-5 h-5" />}
            />
            <ScrollArea className="p-6 space-y-4 max-h-[600px]">
              {filteredDirectives.map((directive, index) => (
                <motion.div
                  key={directive.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 bg-edge/30 rounded-xl border border-edge/50"
                  id={`directive-${directive.id}`}
                >
                  <div className="flex items-center space-x-2 mb-3">
                    <FileText className="w-5 h-5 text-warn" />
                    <h3 className="text-lg font-mono font-semibold text-slate-200">{directive.name}</h3>
                  </div>
                  <p className="text-slate-300 mb-3">{directive.description}</p>
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wide">Syntax</span>
                      <div className="flex items-center space-x-2 mt-1">
                        <code className="flex-1 p-2 bg-bg/50 rounded text-warn font-mono text-sm">
                          {directive.syntax}
                        </code>
                        <button
                          onClick={() => copyToClipboard(directive.syntax)}
                          className="p-2 text-slate-400 hover:text-warn transition-colors"
                          title="Copy syntax"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wide">Examples</span>
                      <div className="mt-1 space-y-2">
                        {directive.examples.map((example, i) => (
                          <div key={i} className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <code className="flex-1 p-2 bg-bg/50 rounded text-warn font-mono text-sm whitespace-pre">
                                {example.code}
                              </code>
                              <button
                                onClick={() => copyToClipboard(example.code)}
                                className="p-2 text-slate-400 hover:text-warn transition-colors"
                                title="Copy example"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                            <p className="text-xs text-slate-400 ml-2">{example.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wide">Notes</span>
                      <p className="mt-1 text-sm text-slate-300 bg-edge/20 p-2 rounded">
                        {directive.notes}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </ScrollArea>
          </GlassCard>
        )}

        {selectedSection === 'registers' && (
          <GlassCard>
            <PanelHeader
              title="CPU Registers"
              subtitle={`${docsData.registers.length} registers`}
              icon={<Settings className="w-5 h-5" />}
            />
            <ScrollArea className="p-6 space-y-4 max-h-[600px]">
              {docsData.registers.map((register, index) => (
                <motion.div
                  key={register.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 bg-edge/30 rounded-xl border border-edge/50"
                >
                  <div className="flex items-center space-x-2 mb-3">
                    <Settings className="w-5 h-5 text-info" />
                    <h3 className="text-lg font-mono font-semibold text-slate-200">{register.name}</h3>
                  </div>
                  <p className="text-slate-300 mb-3">{register.description}</p>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wide">Usage</span>
                      <p className="mt-1 text-sm text-slate-300 bg-edge/20 p-2 rounded">
                        {register.usage}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wide">Notes</span>
                      <p className="mt-1 text-sm text-slate-300 bg-edge/20 p-2 rounded">
                        {register.notes}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </ScrollArea>
          </GlassCard>
        )}

        {selectedSection === 'flags' && (
          <GlassCard>
            <PanelHeader
              title="CPU Flags"
              subtitle={`${docsData.flags.length} flags`}
              icon={<Flag className="w-5 h-5" />}
            />
            <ScrollArea className="p-6 space-y-4 max-h-[600px]">
              {docsData.flags.map((flag, index) => (
                <motion.div
                  key={flag.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 bg-edge/30 rounded-xl border border-edge/50"
                >
                  <div className="flex items-center space-x-2 mb-3">
                    <Flag className="w-5 h-5 text-accent2" />
                    <h3 className="text-lg font-mono font-semibold text-slate-200">{flag.name}</h3>
                  </div>
                  <p className="text-slate-300 mb-3">{flag.description}</p>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wide">Usage</span>
                      <p className="mt-1 text-sm text-slate-300 bg-edge/20 p-2 rounded">
                        {flag.usage}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 uppercase tracking-wide">Examples</span>
                      <div className="mt-1 space-y-1">
                        {flag.examples.map((example, i) => (
                          <p key={i} className="text-sm text-slate-300 bg-edge/20 p-2 rounded">
                            {example}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </ScrollArea>
          </GlassCard>
        )}
        </div>
      </ScrollArea>
    </div>
  );
};