/**
 * Standalone debugger route - can be used outside learning context
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bug, BookOpen, Code, Play } from 'lucide-react';
import AsmDebugger from '../components/AsmDebugger';
import { GlassCard } from '../components/ui/GlassCard';
import { PanelHeader } from '../components/ui/PanelHeader';
import { NeonButton } from '../components/ui/NeonButton';
import { GlowTabs } from '../components/ui/GlowTabs';
import { ScrollArea } from '../components/ScrollArea';
import { DebuggerBusProvider } from '../state/debuggerBus';

interface DebuggerStandaloneProps {
  initialFile?: string;
  initialBreakpoints?: Array<{ path: string; line: number }>;
  readonly?: boolean;
  theme?: 'light' | 'dark' | 'system';
}

const examples = {
  'hello.asm': `; Hello World Example
.DATA
msg: .STRING "Hello, World!"

.TEXT
start:
    MOV R1, msg     ; Load string address
    SYS #2          ; Print string
    MOV R0, #0      ; Exit code 0
    SYS #3          ; Exit program
    HALT`,
    
  'controlflow.asm': `; Control Flow Example
.DATA
numbers: .WORD 5, 3, 8, 1, 9
len: .WORD 5

.TEXT
start:
    MOV R0, #0          ; Initialize sum
    MOV R1, numbers     ; Array pointer
    LOAD R2, [len]      ; Load length
    
loop:
    CMP R2, #0          ; Check if done
    JZ done             ; Jump if zero
    
    LOAD R3, [R1]       ; Load current element
    ADD R0, R3          ; Add to sum
    ADD R1, #4          ; Move to next element
    DEC R2              ; Decrement counter
    JMP loop            ; Continue loop
    
done:
    SYS #1              ; Print sum
    MOV R0, #0          ; Exit code
    SYS #3              ; Exit
    HALT`
};

export const DebuggerStandalone: React.FC<DebuggerStandaloneProps> = ({
  initialFile,
  initialBreakpoints = [],
  readonly = false,
  theme = 'dark'
}) => {
  const [activeTab, setActiveTab] = useState<'debugger' | 'instructions'>('debugger');
  const [selectedExample, setSelectedExample] = useState<string>('hello.asm');
  const [code, setCode] = useState(() => {
    if (initialFile && examples[initialFile as keyof typeof examples]) {
      return examples[initialFile as keyof typeof examples];
    }
    return examples['hello.asm'];
  });

  const tabs = [
    { id: 'debugger' as const, label: 'Debugger', icon: <Bug className="w-4 h-4" /> },
    { id: 'instructions' as const, label: 'Instructions', icon: <BookOpen className="w-4 h-4" /> }
  ];

  const loadExample = (exampleName: string) => {
    setSelectedExample(exampleName);
    setCode(examples[exampleName as keyof typeof examples]);
  };

  const renderInstructions = () => (
    <div className="h-full">
      <ScrollArea>
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-3xl font-bold bg-gradient-to-r from-accent to-accent2 bg-clip-text text-transparent mb-4">
              Standalone Debugger
            </h1>
            <p className="text-slate-400 text-lg">
              Use the IPL Lab debugger outside the learning environment
            </p>
          </motion.div>

          {/* Quickstart */}
          <GlassCard>
            <PanelHeader
              title="Quickstart Guide"
              icon={<Play className="w-4 h-4" />}
            />
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-accent text-xs font-bold">1</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-200">Load or write assembly code</h4>
                    <p className="text-sm text-slate-400">Use the examples below or write your own EduASM code</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-accent text-xs font-bold">2</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-200">Set breakpoints</h4>
                    <p className="text-sm text-slate-400">Click in the gutter or press F9 to toggle breakpoints</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-accent text-xs font-bold">3</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-200">Run or step through code</h4>
                    <p className="text-sm text-slate-400">Use Run button or F10/F11 to step through execution</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-accent text-xs font-bold">4</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-200">Monitor state</h4>
                    <p className="text-sm text-slate-400">Watch registers, memory, and console output in the side panels</p>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Examples */}
          <GlassCard>
            <PanelHeader
              title="Example Programs"
              icon={<Code className="w-4 h-4" />}
            />
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(examples).map(([name, source]) => (
                  <div
                    key={name}
                    className={`p-4 border rounded-xl cursor-pointer transition-all ${
                      selectedExample === name
                        ? 'border-accent/50 bg-accent/10'
                        : 'border-edge/50 bg-edge/20 hover:border-accent/30'
                    }`}
                    onClick={() => loadExample(name)}
                  >
                    <h4 className="font-medium text-slate-200 mb-2">{name}</h4>
                    <p className="text-sm text-slate-400 mb-3">
                      {name === 'hello.asm' ? 'Basic program with string output' : 'Array processing with loops'}
                    </p>
                    <pre className="text-xs font-mono text-slate-300 bg-bg/50 p-2 rounded overflow-x-auto">
                      {source.split('\n').slice(0, 4).join('\n')}
                      {source.split('\n').length > 4 && '\n...'}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          {/* Embedding Guide */}
          <GlassCard>
            <PanelHeader
              title="Embedding the Debugger"
              icon={<Code className="w-4 h-4" />}
            />
            <div className="p-6 space-y-4">
              <p className="text-slate-300">
                You can embed the debugger in your own applications:
              </p>
              
              <div className="bg-bg/50 border border-edge/50 rounded-lg p-4">
                <pre className="text-sm font-mono text-accent overflow-x-auto">
{`import { DebuggerStandalone } from '@ipl/debugger';

<DebuggerStandalone 
  initialFile="examples/hello.asm"
  theme="system"
  readonly={false}
/>`}
                </pre>
              </div>
              
              <div className="space-y-2 text-sm text-slate-400">
                <p><strong>Props:</strong></p>
                <ul className="space-y-1 ml-4">
                  <li>• <code>initialFile</code> - Load example file on mount</li>
                  <li>• <code>readonly</code> - Disable code editing</li>
                  <li>• <code>theme</code> - Editor theme (light/dark/system)</li>
                  <li>• <code>initialBreakpoints</code> - Set breakpoints on load</li>
                </ul>
              </div>
            </div>
          </GlassCard>

          {/* Technical Notes */}
          <GlassCard>
            <PanelHeader
              title="Technical Notes"
              icon={<Settings className="w-4 h-4" />}
            />
            <div className="p-6 space-y-4 text-sm text-slate-300">
              <div>
                <h4 className="font-medium text-slate-200 mb-2">Executable Lines</h4>
                <p className="text-slate-400">
                  Breakpoints automatically snap to the nearest executable line. Comments and blank lines are skipped.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium text-slate-200 mb-2">Keyboard Shortcuts</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>F9 - Toggle breakpoint</div>
                  <div>F10 - Step over</div>
                  <div>F11 - Step into</div>
                  <div>Shift+F11 - Step out</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-slate-200 mb-2">Layout Options</h4>
                <p className="text-slate-400">
                  Use the layout controls to dock the debugger right, bottom, or fullscreen. 
                  Layout preferences are saved automatically.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <div className="h-full">
      <div className="p-4 border-b border-edge/50">
        <GlowTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>
      
      <div className="flex-1 min-h-0">
        {activeTab === 'debugger' ? (
          <DebuggerBusProvider>
            <AsmDebugger
              initialCode={code}
              readonly={readonly}
              theme={theme}
            />
          </DebuggerBusProvider>
        ) : (
          renderInstructions()
        )}
      </div>
    </div>
  );
};

export default DebuggerStandalone;