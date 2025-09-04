/**
 * Enhanced Assembly Debugger with line awareness and resizable UI
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  Square,
  StepForward,
  SkipForward,
  RotateCcw,
  Bug,
  Eye,
  Terminal,
  HardDrive,
  Activity,
  Settings,
} from "lucide-react";
import { NeonButton } from "./ui/NeonButton";
import { GlassCard } from "./ui/GlassCard";
import { PanelHeader } from "./ui/PanelHeader";
import { TagPill } from "./ui/TagPill";
import { GlowTabs } from "./ui/GlowTabs";
import { MemoryViewer } from "./MemoryViewer";
import { WatchesPanel } from "./WatchesPanel";
import { TracePanel } from "./TracePanel";
import { PerformanceControls } from "./PerformanceControls";
import { DebuggerLayout } from "./DebuggerLayout";
import ErrorBoundary from "./ErrorBoundary";
import { useDebuggerBus } from "../state/debuggerBus";
import { createRAM, RAM_SIZE } from "../utils/memory";
import {
  assemble,
  createCPU,
  resetCPU,
  step,
  run,
  type CPU,
  type Program,
  AsmError,
} from "../runners/asmEngine";
import {
  findExecutableLines,
  snapToExecutableLine,
  toOneBased,
  toZeroBased,
} from "../utils/positions";
import {
  createIdentityAdapter,
  type SourceMapAdapter,
} from "../utils/sourceMap";
import { debuggerLog } from "../utils/log";
import {
  validateBreakpoint,
  validateStepEvent,
  type Breakpoint,
} from "../utils/validation";

interface DebuggerState {
  cpu: CPU;
  ram: DataView;
  program: Program | null;
  sourceMap: SourceMapAdapter;
  executableLines: Set<number>;
  breakpoints: Map<number, Breakpoint>;
  watches: Array<{
    id: string;
    expression: string;
    value: number | string;
    history: (number | string)[];
    error?: string;
    changed: boolean;
  }>;
  running: boolean;
  currentLine: number | null;
  consoleOutput: string[];
  error: string | null;
}

interface AsmDebuggerProps {
  initialCode?: string;
  readonly?: boolean;
  theme?: "light" | "dark" | "system";
}

const AsmDebugger: React.FC<AsmDebuggerProps> = ({
  initialCode = "",
  readonly = false,
  theme = "dark",
}) => {
  const { pendingLoad, consumed, markConsumed, reset: resetBus } =
    useDebuggerBus();
  const [code, setCode] = useState(initialCode ?? "");
  const [debuggerState, setDebuggerState] = useState<DebuggerState>(() => ({
    cpu: createCPU(),
    ram: createRAM(),
    program: null,
    sourceMap: createIdentityAdapter(),
    executableLines: new Set(),
    breakpoints: new Map(),
    watches: [],
    running: false,
    currentLine: null,
    consoleOutput: [],
    error: null,
  }));

  const [activePanel, setActivePanel] = useState("registers");
  const [speed, setSpeed] = useState(1);
  const [batchSize, setBatchSize] = useState(100);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  // Load pending code from debugger bus
  useEffect(() => {
    if (pendingLoad && !consumed) {
      debuggerLog.debug('Loading pending code from bus', pendingLoad);
      
      setCode(pendingLoad.source);
      
      // Set up breakpoints
      if (pendingLoad.breakpoints) {
        const newBreakpoints = new Map<number, Breakpoint>();
        pendingLoad.breakpoints.forEach(line => {
          try {
            const bp = validateBreakpoint({ line, enabled: true });
            newBreakpoints.set(line, bp);
          } catch (error) {
            debuggerLog.warn('Invalid breakpoint from bus:', error);
          }
        });
        
        setDebuggerState(prev => ({
          ...prev,
          breakpoints: newBreakpoints
        }));
      }
      
      // Set up watches
      if (pendingLoad.watches) {
        const newWatches = pendingLoad.watches.map((expr, index) => ({
          id: `watch_${index}`,
          expression: expr,
          value: 0,
          history: [],
          changed: false
        }));
        
        setDebuggerState(prev => ({
          ...prev,
          watches: newWatches
        }));
      }
      
      markConsumed();
    }
  }, [pendingLoad, consumed, markConsumed]);

  // Assemble code when it changes
  useEffect(() => {
    if (!code.trim()) return;
    
    try {
      debuggerLog.debug('Assembling code');
      const program = assemble(code);
      const executableLines = findExecutableLines(code);
      
      setDebuggerState(prev => ({
        ...prev,
        program,
        executableLines,
        error: null
      }));
      
      debuggerLog.debug('Assembly successful', { 
        instructions: program.ast.length,
        executableLines: executableLines.size 
      });
      
    } catch (error) {
      const errorMsg = error instanceof AsmError 
        ? `Line ${error.line}: ${error.message}`
        : error instanceof Error 
        ? error.message 
        : 'Assembly failed';
      
      setDebuggerState(prev => ({
        ...prev,
        program: null,
        error: errorMsg
      }));
      
      debuggerLog.error('Assembly failed:', error);
    }
  }, [code]);

  // Handle Monaco editor setup
  const handleEditorDidMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Set up keyboard shortcuts
    editor.addCommand(monaco.KeyMod.F9, () => {
      const position = editor.getPosition();
      if (position) {
        toggleBreakpoint(position.lineNumber);
      }
    });
    
    editor.addCommand(monaco.KeyMod.F10, () => {
      handleStep('over');
    });
    
    editor.addCommand(monaco.KeyMod.F11, () => {
      handleStep('into');
    });
    
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.F11, () => {
      handleStep('out');
    });
    
    // Update breakpoint decorations
    updateBreakpointDecorations();
    
    debuggerLog.debug('Monaco editor mounted with shortcuts');
  }, []);

  const updateBreakpointDecorations = useCallback(() => {
    if (!editorRef.current || !monacoRef.current) return;
    
    const decorations = Array.from(debuggerState.breakpoints.entries()).map(([line, bp]) => ({
      range: new monacoRef.current.Range(line, 1, line, 1),
      options: {
        isWholeLine: true,
        className: 'breakpoint-line',
        glyphMarginClassName: bp.enabled ? 'breakpoint-glyph' : 'breakpoint-glyph-disabled',
        glyphMarginHoverMessage: { value: `Breakpoint at line ${line}` }
      }
    }));
    
    // Add current execution line
    if (debuggerState.currentLine) {
      decorations.push({
        range: new monacoRef.current.Range(debuggerState.currentLine, 1, debuggerState.currentLine, 1),
        options: {
          isWholeLine: true,
          className: 'current-execution-line',
          glyphMarginClassName: 'current-execution-glyph'
        }
      });
    }
    
    editorRef.current.deltaDecorations([], decorations);
  }, [debuggerState.breakpoints, debuggerState.currentLine]);

  useEffect(() => {
    updateBreakpointDecorations();
  }, [updateBreakpointDecorations]);

  const toggleBreakpoint = useCallback((line: number) => {
    const { line: snappedLine, snapped } = snapToExecutableLine(line, debuggerState.executableLines);
    
    if (snapped) {
      // Show toast about snapping
      debuggerLog.info(`Breakpoint moved to line ${snappedLine} (nearest executable)`);
    }
    
    setDebuggerState(prev => {
      const newBreakpoints = new Map(prev.breakpoints);
      
      if (newBreakpoints.has(snappedLine)) {
        newBreakpoints.delete(snappedLine);
      } else {
        newBreakpoints.set(snappedLine, { line: snappedLine, enabled: true });
      }
      
      return { ...prev, breakpoints: newBreakpoints };
    });
  }, [debuggerState.executableLines]);

  const handleReset = useCallback(() => {
    debuggerLog.debug('Resetting debugger state');
    
    setDebuggerState(prev => {
      const newCpu = createCPU();
      const newRam = createRAM();
      
      // Reinitialize RAM with data section if program exists
      if (prev.program) {
        for (let i = 0; i < prev.program.dataSection.length; i++) {
          newRam.setUint8(i, prev.program.dataSection[i]);
        }
      }
      
      return {
        ...prev,
        cpu: newCpu,
        ram: newRam,
        running: false,
        currentLine: null,
        consoleOutput: [],
        error: null
      };
    });
  }, []);

  const handleStep = useCallback((type: 'into' | 'over' | 'out') => {
    if (!debuggerState.program || debuggerState.running) return;
    
    try {
      const stepEvent = validateStepEvent({ type, count: 1 });
      debuggerLog.debug('Stepping', stepEvent);
      
      setDebuggerState(prev => {
        const newState = { ...prev };
        
        if (newState.cpu.halted) {
          debuggerLog.warn('Cannot step: CPU halted');
          return prev;
        }
        
        try {
          step(newState.cpu, newState.program!, newState.ram, {
            onSys: (syscall: number) => {
              switch (syscall) {
                case 1: // PRINT_INT
                  const output = `${newState.cpu.R[0]}`;
                  newState.consoleOutput = [...newState.consoleOutput, output];
                  return output;
                case 2: // PRINT_STR
                  const strAddr = newState.cpu.R[1];
                  let str = '';
                  for (let i = 0; i < 256; i++) {
                    if (strAddr + i >= RAM_SIZE) break;
                    const byte = newState.ram.getUint8(strAddr + i);
                    if (byte === 0) break;
                    str += String.fromCharCode(byte);
                  }
                  newState.consoleOutput = [...newState.consoleOutput, str];
                  return str;
                case 3: // EXIT
                  newState.consoleOutput = [...newState.consoleOutput, `Exit: ${newState.cpu.R[0]}`];
                  return `Exit: ${newState.cpu.R[0]}`;
                default:
                  return '';
              }
            }
          });
          
          // Update current line based on IP
          if (newState.program && newState.cpu.IP < newState.program.ast.length) {
            const instruction = newState.program.ast[newState.cpu.IP];
            newState.currentLine = instruction.line;
          } else {
            newState.currentLine = null;
          }
          
          // Update watches
          newState.watches = newState.watches.map(watch => {
            try {
              const newValue = evaluateWatchExpression(watch.expression, newState.cpu, newState.ram, newState.program?.labels || {});
              const changed = newValue !== watch.value;
              
              return {
                ...watch,
                value: newValue,
                history: changed ? [watch.value, ...watch.history.slice(0, 9)] : watch.history,
                changed,
                error: undefined
              };
            } catch (error) {
              return {
                ...watch,
                error: error instanceof Error ? error.message : 'Evaluation error',
                changed: false
              };
            }
          });
          
        } catch (error) {
          newState.error = error instanceof AsmError 
            ? `Line ${error.line}: ${error.message}`
            : error instanceof Error 
            ? error.message 
            : 'Execution error';
          
          debuggerLog.error('Step execution failed:', error);
        }
        
        return newState;
      });
      
    } catch (error) {
      debuggerLog.error('Step validation failed:', error);
    }
  }, [debuggerState.program, debuggerState.running]);

  const handleRun = useCallback(() => {
    if (!debuggerState.program || debuggerState.running) return;
    
    debuggerLog.debug('Starting execution');
    
    setDebuggerState(prev => ({ ...prev, running: true }));
    
    // Use setTimeout to avoid blocking UI
    setTimeout(() => {
      setDebuggerState(prev => {
        const newState = { ...prev };
        
        try {
          const result = run(newState.cpu, newState.program!, newState.ram, {
            maxSteps: 10000,
            breakpoints: new Set(Array.from(newState.breakpoints.keys())),
            onSys: (syscall: number) => {
              switch (syscall) {
                case 1:
                  const output = `${newState.cpu.R[0]}`;
                  newState.consoleOutput = [...newState.consoleOutput, output];
                  return output;
                case 2:
                  const strAddr = newState.cpu.R[1];
                  let str = '';
                  for (let i = 0; i < 256; i++) {
                    if (strAddr + i >= RAM_SIZE) break;
                    const byte = newState.ram.getUint8(strAddr + i);
                    if (byte === 0) break;
                    str += String.fromCharCode(byte);
                  }
                  newState.consoleOutput = [...newState.consoleOutput, str];
                  return str;
                case 3:
                  newState.consoleOutput = [...newState.consoleOutput, `Exit: ${newState.cpu.R[0]}`];
                  return `Exit: ${newState.cpu.R[0]}`;
                default:
                  return '';
              }
            }
          });
          
          debuggerLog.debug('Execution completed', result);
          
          // Update current line
          if (newState.program && newState.cpu.IP < newState.program.ast.length) {
            const instruction = newState.program.ast[newState.cpu.IP];
            newState.currentLine = instruction.line;
          } else {
            newState.currentLine = null;
          }
          
        } catch (error) {
          newState.error = error instanceof AsmError 
            ? `Line ${error.line}: ${error.message}`
            : error instanceof Error 
            ? error.message 
            : 'Execution error';
          
          debuggerLog.error('Execution failed:', error);
        }
        
        return { ...newState, running: false };
      });
    }, 10);
  }, [debuggerState.program, debuggerState.running]);

  const addWatch = useCallback((expression: string) => {
    const newWatch = {
      id: `watch_${Date.now()}`,
      expression,
      value: 0,
      history: [],
      changed: false
    };
    
    setDebuggerState(prev => ({
      ...prev,
      watches: [...prev.watches, newWatch]
    }));
  }, []);

  const removeWatch = useCallback((id: string) => {
    setDebuggerState(prev => ({
      ...prev,
      watches: prev.watches.filter(w => w.id !== id)
    }));
  }, []);

  const copyValue = useCallback((value: number | string) => {
    navigator.clipboard.writeText(String(value));
  }, []);
  const evaluateWatchExpression = (
    expr: string, 
    cpu: CPU, 
    ram: DataView, 
    labels: Record<string, number>
  ): number | string => {
    const trimmed = expr.trim().toUpperCase();
    
    // Register values
    if (trimmed.match(/^R[0-7]$/)) {
      const regNum = parseInt(trimmed[1]);
      return cpu.R[regNum];
    }
    
    if (trimmed === 'SP') return cpu.SP;
    if (trimmed === 'BP') return cpu.BP;
    if (trimmed === 'IP') return cpu.IP;
    
    // Memory values [addr]
    const memMatch = trimmed.match(/^\[(.+)\]$/);
    if (memMatch) {
      const addrExpr = memMatch[1];
      let addr: number;
      
      // Handle label references
      if (labels[addrExpr.toLowerCase()]) {
        addr = labels[addrExpr.toLowerCase()];
      } else if (addrExpr.match(/^[A-Z_][A-Z0-9_]*\+\d+$/)) {
        // Handle label+offset
        const [label, offset] = addrExpr.split('+');
        addr = labels[label.toLowerCase()] + parseInt(offset);
      } else {
        addr = parseInt(addrExpr, 16) || parseInt(addrExpr, 10);
      }
      
      if (addr >= 0 && addr < RAM_SIZE - 3) {
        return ram.getInt32(addr, true);
      }
    }
    
    throw new Error(`Invalid expression: ${expr}`);
  };

  const panels = [
    { id: "registers", label: "Registers", icon: <Settings className="w-4 h-4" /> },
    { id: "memory", label: "Memory", icon: <HardDrive className="w-4 h-4" /> },
    { id: "watches", label: "Watches", icon: <Eye className="w-4 h-4" /> },
    { id: "console", label: "Console", icon: <Terminal className="w-4 h-4" /> },
    { id: "trace", label: "Trace", icon: <Activity className="w-4 h-4" /> },
  ];

  const renderEditor = () => (
    <GlassCard className="h-full">
      <PanelHeader
        title="Assembly Debugger"
        subtitle={
          debuggerState.program
            ? `${debuggerState.program.ast.length} instructions`
            : "No program loaded"
        }
        icon={<Bug className="w-5 h-5" />}
        actions={
          <div className="flex items-center space-x-2">
            <TagPill variant={debuggerState.cpu.halted ? "danger" : "success"}>
              {debuggerState.cpu.halted ? "Halted" : "Ready"}
            </TagPill>
            {debuggerState.running && (
              <TagPill variant="warning">Running</TagPill>
            )}
          </div>
        }
      />

      <div className="flex-1 flex flex-col min-h-0">
        {/* Controls */}
        {/* ... (your existing controls unchanged) */}

        {/* Monaco Editor */}
        <div className="flex-1 min-h-0" data-testid="code-editor">
          <MonacoEditor
            value={code}
            onChange={setCode}
            language="asm"
            theme={theme}
            onMount={handleEditorDidMount}
            options={{
              readOnly: readonly,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 14,
              lineNumbers: "on",
              glyphMargin: true,
              folding: false,
              automaticLayout: true,
            }}
          />
        </div>
      </div>
    </GlassCard>
  );

  return (
    <div className="h-full" data-testid="debugger-container">
      <ErrorBoundary
        compact
        onReset={() => {
          handleReset();
          resetBus();
        }}
      >
        <DebuggerLayout
          debuggerPanel={/* renderDebugPanel() */}
          onLayoutChange={(layout) => {
            debuggerLog.debug("Layout changed:", layout);
          }}
        >
          {renderEditor()}
        </DebuggerLayout>
      </ErrorBoundary>
    </div>
  );
};

// ✅ Fixed Monaco Editor wrapper
const MonacoEditor: React.FC<{
  value?: string;
  onChange: (value: string) => void;
  language?: string;
  theme?: string;
  onMount: (editor: any, monaco: any) => void;
  options?: any;
}> = ({
  value = "",
  onChange,
  language = "plaintext",
  theme = "vs-dark",
  onMount,
  options = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const [monaco, setMonaco] = useState<any>(null);

  useEffect(() => {
    const loadMonaco = async () => {
      try {
        const monacoModule = await import("monaco-editor");
        setMonaco(monacoModule);
      } catch (error) {
        debuggerLog.error("Failed to load Monaco:", error);
      }
    };
    loadMonaco();
  }, []);

  useEffect(() => {
    if (!monaco || !containerRef.current || editorRef.current) return;

    const editor = monaco.editor.create(containerRef.current, {
      value: value ?? "",
      language,
      theme:
        theme === "dark"
          ? "vs-dark"
          : theme === "light"
          ? "vs"
          : "vs-dark",
      automaticLayout: true,
      ...options,
    });

    editorRef.current = editor;

    editor.onDidChangeModelContent(() => {
      onChange(editor.getValue() ?? "");
    });

    onMount(editor, monaco);

    return () => {
      editor.dispose();
      editorRef.current = null;
    };
  }, [monaco, onMount]);

  useEffect(() => {
    if (
      editorRef.current &&
      value !== undefined &&
      value !== editorRef.current.getValue()
    ) {
      editorRef.current.setValue(value);
    }
  }, [value]);

  return <div ref={containerRef} className="h-full" />;
};

export default AsmDebugger;