import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Play, 
  Pause, 
  StepForward, 
  RotateCcw, 
  Bug, 
  Monitor, 
  Eye, 
  Terminal, 
  Activity,
  Circle,
  Cpu,
  MemoryStick,
  Lightbulb,
  X,
  SkipBack,
  Target,
  List,
  Clock,
  Zap
} from 'lucide-react';
import { RAM_SIZE, toHex, getMemoryDump, getStackView } from '../utils/memory';
import { assemble, createCPU, resetCPU, step, AsmError } from '../runners/asmEngine';
import { GlassCard, NeonButton, GlowTabs, PanelHeader, TagPill, Toast } from './ui';
import { ScrollArea } from './ScrollArea';
import { useDebuggerBus } from '../state/debuggerBus.tsx';
import { DisassemblyPanel } from './DisassemblyPanel';
import { MemoryViewer } from './MemoryViewer';
import { TracePanel } from './TracePanel';
import { WatchesPanel } from './WatchesPanel';
import { PerformanceControls } from './PerformanceControls';

interface CPUState {
  R: number[];
  SP: number;
  BP: number;
  IP: number;
  F: {
    ZF: boolean;
    NF: boolean;
    CF: boolean;
    OF: boolean;
  };
  halted: boolean;
}

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

interface DisassemblyEntry {
  address: number;
  opcode: string;
  operands: string;
  label?: string;
  source: string;
}

interface WatchpointDef {
  id: string;
  address: number;
  size: number;
  condition?: 'read' | 'write' | 'change';
}

interface ErrorWithSuggestion extends AsmError {
  suggestion?: string;
  docUrl?: string;
}

const SAMPLE_PROGRAMS = [
  {
    name: 'Hello World',
    code: `; Hello World in EduASM
.DATA
msg: .STRING "Hello, World!"

.TEXT
start:
    MOV R1, msg        ; Load string address
    SYS #2             ; Print string
    SYS #3             ; Exit
    HALT`
  },
  {
    name: 'Sum Array',
    code: `; Sum numbers in an array
.DATA
nums: .WORD 1, 2, 3, 4, 5
count: .WORD 5

.TEXT
start:
    MOV R0, #0         ; sum = 0
    MOV R1, nums       ; array pointer
    MOV R2, count      ; counter
    LOAD R2, [R2]      ; load count value

loop:
    CMP R2, #0         ; check if done
    JZ done            ; jump if zero
    
    LOAD R3, [R1]      ; load array element
    ADD R0, R3         ; add to sum
    ADD R1, #4         ; next element (4 bytes)
    DEC R2             ; decrement counter
    JMP loop           ; repeat

done:
    SYS #1             ; print sum
    HALT`
  }
];

interface AsmDebuggerProps {
  initialCode?: string;
}

const AsmDebugger: React.FC<AsmDebuggerProps> = ({ initialCode }) => {
  const { pendingLoad, consumed, markConsumed } = useDebuggerBus();
  const [editorReady, setEditorReady] = useState(false);
  const [code, setCode] = useState(() => {
    return initialCode || localStorage.getItem('asmplay_code') || SAMPLE_PROGRAMS[0]?.code || '';
  });

  const [cpu, setCpu] = useState<CPUState>({
    R: new Array(8).fill(0),
    SP: RAM_SIZE - 4,
    BP: RAM_SIZE - 4,
    IP: 0,
    F: { ZF: false, NF: false, CF: false, OF: false },
    halted: false
  });

  const [isRunning, setIsRunning] = useState(false);
  const [breakpoints, setBreakpoints] = useState<Set<number>>(new Set());
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [error, setError] = useState<ErrorWithSuggestion | null>(null);
  const [memoryView, setMemoryView] = useState({ start: 0, length: 256, followSP: false });
  const [runSpeed, setRunSpeed] = useState(1);
  const [ram, setRam] = useState<Uint8Array>(new Uint8Array(RAM_SIZE));

  // Watch expressions and watchpoints
  const [watches, setWatches] = useState<WatchExpression[]>([]);
  const [watchpoints, setWatchpoints] = useState<WatchpointDef[]>([]);

  // Trace recorder
  const [isRecording, setIsRecording] = useState(false);
  const [trace, setTrace] = useState<TraceSnapshot[]>([]);
  const [traceIndex, setTraceIndex] = useState(-1);
  const [maxTraceEntries] = useState(1024);

  // Disassembly and symbols
  const [disassembly, setDisassembly] = useState<DisassemblyEntry[]>([]);
  const [symbols, setSymbols] = useState<Record<string, number>>({});

  // Performance
  const [batchSize, setBatchSize] = useState(250);
  const [stepsPerSecond, setStepsPerSecond] = useState(0);

  // UI state
  const [selectedPanel, setSelectedPanel] = useState<'registers' | 'watches' | 'memory' | 'trace' | 'console' | 'disassembly'>('registers');
  const [memoryInput, setMemoryInput] = useState('0x0000');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const programRef = useRef<any>(null);
  const ramViewRef = useRef<DataView>(new DataView(new ArrayBuffer(RAM_SIZE)));
  const runIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const performanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Evaluate watch expression
  const evaluateWatch = useCallback((expression: string): { value: number | string; error?: string } => {
    try {
      const expr = expression.trim().toUpperCase();

      // Register references
      if (/^R[0-7]$/.test(expr)) {
        const regNum = parseInt(expr[1]);
        return { value: cpu.R[regNum] };
      }

      if (expr === 'SP') return { value: cpu.SP };
      if (expr === 'BP') return { value: cpu.BP };
      if (expr === 'IP') return { value: cpu.IP };

      // Memory references [addr], [0x1234], [R0], [R0+4]
      const memMatch = expr.match(/^\[(.+)\]$/);
      if (memMatch) {
        const inner = memMatch[1];
        let addr = 0;

        // [0x1234] or [1234]
        if (/^0x[0-9A-F]+$/i.test(inner) || /^\d+$/.test(inner)) {
          addr = parseInt(inner, inner.startsWith('0x') ? 16 : 10);
        }
        // [R0] or [R0+4] or [R0-4]
        else if (/^R[0-7]([+-]\d+)?$/.test(inner)) {
          const regMatch = inner.match(/^R([0-7])([+-]\d+)?$/);
          if (regMatch) {
            const regNum = parseInt(regMatch[1]);
            const offset = regMatch[2] ? parseInt(regMatch[2]) : 0;
            addr = cpu.R[regNum] + offset;
          }
        }
        // [SP] or [BP]
        else if (inner === 'SP') {
          addr = cpu.SP;
        } else if (inner === 'BP') {
          addr = cpu.BP;
        }
        // [label] - would need program context
        else if (programRef.current?.labels?.[inner.toLowerCase()]) {
          addr = programRef.current.labels[inner.toLowerCase()];
        } else {
          return { value: 0, error: `Unknown label: ${inner}` };
        }

        if (addr < 0 || addr >= RAM_SIZE - 3) {
          return { value: 0, error: `Address out of bounds: ${toHex(addr)}` };
        }

        try {
          const value = ramViewRef.current.getInt32(addr, true);
          return { value };
        } catch {
          return { value: 0, error: `Cannot read memory at ${toHex(addr)}` };
        }
      }

      // Immediate hex values
      if (/^0x[0-9A-F]+$/i.test(expr)) {
        return { value: parseInt(expr, 16) };
      }

      // Immediate decimal values
      if (/^\d+$/.test(expr)) {
        return { value: parseInt(expr, 10) };
      }

      return { value: 0, error: `Invalid expression: ${expression}` };
    } catch (err) {
      return { value: 0, error: err instanceof Error ? err.message : 'Evaluation error' };
    }
  }, [cpu, programRef]);

  // Update watches
  const updateWatches = useCallback(() => {
    setWatches(prev => prev.map(watch => {
      const result = evaluateWatch(watch.expression);
      const newValue = result.error ? `Error: ${result.error}` : result.value;
      const changed = newValue !== watch.value;

      return {
        ...watch,
        value: newValue,
        history: changed ? [newValue, ...watch.history.slice(0, 4)] : watch.history,
        error: result.error,
        changed
      };
    }));
  }, [evaluateWatch]);

  // Initialize worker
  useEffect(() => {
    // Create worker
    workerRef.current = new Worker(new URL('../runners/asmWorker.ts', import.meta.url), {
      type: 'module'
    });

    // Handle worker messages
    workerRef.current.onmessage = (event) => {
      const response = event.data;
      
      switch (response.type) {
        case 'step_complete':
        case 'run_complete':
        case 'breakpoint_hit':
        case 'watchpoint_hit':
        case 'cursor_reached':
          if (response.cpu) {
            setCpu({
              R: response.cpu.R,
              SP: response.cpu.SP,
              BP: response.cpu.BP,
              IP: response.cpu.IP,
              F: response.cpu.F,
              halted: response.cpu.halted
            });
          }
          
          if (response.memoryChanges) {
            // Update RAM with changes
            const newRam = new Uint8Array(ram);
            for (const change of response.memoryChanges) {
              if (change.size === 4) {
                const view = new DataView(newRam.buffer);
                view.setInt32(change.address, change.value, true);
              } else {
                newRam[change.address] = change.value;
              }
            }
            setRam(newRam);
            ramViewRef.current = new DataView(newRam.buffer);
          }
          
          if (response.consoleOutput) {
            setConsoleOutput(response.consoleOutput);
          }
          
          if (response.hitWatchpoint) {
            const wp = response.hitWatchpoint;
            setToastMessage(`Watchpoint hit at ${toHex(wp.address)}: ${wp.oldValue} → ${wp.newValue}`);
            
            // Mark watchpoint as triggered
            setWatches(prev => prev.map(w => 
              w.isWatchpoint && w.expression.includes(toHex(wp.address)) 
                ? { ...w, watchpointTriggered: true }
                : w
            ));
          }
          
          if (response.traceSnapshot && isRecording) {
            setTrace(prev => {
              const newTrace = [...prev, response.traceSnapshot!];
              if (newTrace.length > maxTraceEntries) {
                newTrace.shift();
              }
              return newTrace;
            });
            setTraceIndex(prev => Math.min(prev + 1, maxTraceEntries - 1));
          }
          
          setIsRunning(false);
          setError(null);
          break;
          
        case 'error':
          if (response.error) {
            // Enhance error with documentation help
            enhanceError(response.error).then(enhancedError => {
              setError(enhancedError);
            }).catch(() => {
              // Fallback to original error if enhancement fails
              setError({
                line: response.error.line,
                message: response.error.message,
                hint: response.error.hint
              });
            });
          }
          setIsRunning(false);
          break;
          
        case 'disassembly':
          if (response.disassembly) {
            setDisassembly(response.disassembly);
          }
          if (response.symbols) {
            setSymbols(response.symbols);
          }
          break;
      }
    };

    // Handle worker errors
    workerRef.current.onerror = (error) => {
      console.error('Worker error:', error);
      const workerError = {
        line: 0,
        message: 'Worker error: ' + error.message,
        hint: 'Try refreshing the page'
      };
      
      enhanceError(workerError as AsmError).then(enhancedError => {
        setError(enhancedError);
      }).catch(() => {
        setError(workerError);
      });
      setIsRunning(false);
    };

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      if (performanceTimerRef.current) {
        clearInterval(performanceTimerRef.current);
      }
    };
  }, []);

  // Initialize
  useEffect(() => {
    ramViewRef.current = new DataView(ram.buffer);
  }, [ram]);

  // Update code when initialCode changes
  useEffect(() => {
    if (initialCode && initialCode !== code) {
      setCode(initialCode);
    }
  }, [initialCode]);

  // Save code to localStorage
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem('asmplay_code', code);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [code]);

  // Handle editor ready state
  useEffect(() => {
    if (editorRef.current) {
      setEditorReady(true);
    }
  }, []);

  // Additional check for editor ready on mount
  useEffect(() => {
    const checkEditorReady = () => {
      if (editorRef.current && !editorReady) {
        setEditorReady(true);
      }
    };
    
    // Check immediately and after a short delay
    checkEditorReady();
    const timer = setTimeout(checkEditorReady, 100);
    
    return () => clearTimeout(timer);
  }, [editorReady]);

  // Reset function - defined early to avoid initialization issues
  const handleReset = useCallback(() => {
    if (runIntervalRef.current) {
      clearInterval(runIntervalRef.current);
      runIntervalRef.current = null;
    }
    
    if (performanceTimerRef.current) {
      clearInterval(performanceTimerRef.current);
      performanceTimerRef.current = null;
    }

    setIsRunning(false);
    setError(null);
    setConsoleOutput([]);
    setTrace([]);
    setTraceIndex(-1);
    setStepsPerSecond(0);

    const newRam = new Uint8Array(RAM_SIZE);
    setRam(newRam);
    ramViewRef.current = new DataView(newRam.buffer);

    setCpu({
      R: new Array(8).fill(0),
      SP: RAM_SIZE - 4,
      BP: RAM_SIZE - 4,
      IP: 0,
      F: { ZF: false, NF: false, CF: false, OF: false },
      halted: false
    });

    // Reset watchpoint triggers
    setWatches(prev => prev.map(w => ({ ...w, watchpointTriggered: false })));

    programRef.current = null;
    
    if (workerRef.current) {
      workerRef.current.postMessage({ cmd: 'reset' });
    }
  }, []);

  // Handle pending debugger loads
  useEffect(() => {
    if (pendingLoad && !consumed && editorReady) {
      // Set editor content
      setCode(pendingLoad.source);
      
      // Apply breakpoints
      if (pendingLoad.breakpoints) {
        setBreakpoints(new Set(pendingLoad.breakpoints));
      }
      
      // Set up watches
      if (pendingLoad.watches && pendingLoad.watches.length > 0) {
        const newWatches = pendingLoad.watches.map((expression, index) => ({
          id: `load_${Date.now()}_${index}`,
          expression,
          value: 0,
          history: [0],
          changed: false
        }));
        setWatches(newWatches);
      }
      
      // Move cursor to specified line
      if (pendingLoad.cursorLine !== undefined && editorRef.current) {
        setTimeout(() => {
          if (editorRef.current) {
            const lines = pendingLoad.source.split('\n');
            let charPos = 0;
            
            for (let i = 0; i < pendingLoad.cursorLine && i < lines.length; i++) {
              charPos += lines[i].length + 1;
            }
            
            editorRef.current.focus();
            editorRef.current.setSelectionRange(charPos, charPos);
          }
        }, 100);
      }
      
      // Mark as consumed
      markConsumed();
      
      // Reset CPU state for fresh start
      handleReset();
    }
  }, [pendingLoad, consumed, editorReady, markConsumed, handleReset]);

  // Highlight error line
  const highlightErrorLine = useCallback((lineNum: number) => {
    if (editorRef.current && lineNum > 0) {
      const lines = code.split('\n');
      let charPos = 0;

      for (let i = 0; i < lineNum - 1 && i < lines.length; i++) {
        charPos += lines[i].length + 1;
      }

      const lineLength = lines[lineNum - 1]?.length || 0;
      editorRef.current.focus();
      editorRef.current.setSelectionRange(charPos, charPos + lineLength);
    }
  }, [code]);

  // Enhanced error messages with suggestions from documentation
  const enhanceError = useCallback(async (error: AsmError): Promise<ErrorWithSuggestion> => {
    // Try to load documentation for opcode help
    try {
      const response = await fetch('/asm_docs.json');
      if (response.ok) {
        const docs = await response.json();
        
        // Extract opcode from error message
        const opcodeMatch = error.message.match(/\b(MOV|LOAD|STORE|ADD|SUB|MUL|DIV|CMP|JMP|JZ|JNZ|JL|JG|JLE|JGE|PUSH|POP|CALL|RET|AND|OR|XOR|SHL|SHR|INC|DEC|SYS|HALT)\b/i);
        
        if (opcodeMatch) {
          const opcodeName = opcodeMatch[1].toLowerCase();
          const opcodeDoc = docs.opcodes.find((op: any) => op.id === opcodeName);
          
          if (opcodeDoc) {
            return {
              ...error,
              suggestion: `${opcodeDoc.syntax} - ${opcodeDoc.notes}`,
              docUrl: `#opcode-${opcodeName}`
            };
          }
        }
      }
    } catch (e) {
      // Fallback to static suggestions if docs loading fails
    }

    // Static fallback suggestions
    const suggestions: Record<string, { suggestion: string; docUrl?: string }> = {
      'LOAD needs memory operand': {
        suggestion: 'Use LOAD R0, [address] or LOAD R0, [R1+4]. LOAD reads from memory to register.',
        docUrl: '#opcode-load'
      },
      'STORE destination must be memory': {
        suggestion: 'Use STORE [address], R0 or STORE [R1], R0. STORE writes register to memory.',
        docUrl: '#opcode-store'
      },
      'Invalid immediate value': {
        suggestion: 'Use #123 for immediate values. The # prefix indicates a constant.',
        docUrl: '#addressing-immediate'
      },
      'Undefined label': {
        suggestion: 'Define labels with "labelname:" before using them in instructions.',
        docUrl: '#directives'
      },
      'Invalid register': {
        suggestion: 'Use R0-R7 for general registers, or SP/BP for stack operations.',
        docUrl: '#registers'
      },
      'Division by zero': {
        suggestion: 'Check divisor is not zero before DIV instruction.',
        docUrl: '#opcode-div'
      },
      'Stack underflow': {
        suggestion: 'Ensure PUSH before POP. Stack operations must be balanced.',
        docUrl: '#opcode-pop'
      },
      'Memory access violation': {
        suggestion: 'Check memory addresses are within valid range (0 to RAM_SIZE).',
        docUrl: '#memory-safety'
      }
    };

    const match = Object.keys(suggestions).find(key => error.message.includes(key));
    if (match) {
      return {
        ...error,
        suggestion: suggestions[match].suggestion,
        docUrl: suggestions[match].docUrl
      };
    }

    return error;
  }, []);

  // Assemble code and get disassembly
  const handleAssemble = useCallback(() => {
    if (!workerRef.current) return;
    
    workerRef.current.postMessage({
      cmd: 'assemble_step',
      source: code,
      breakpoints: Array.from(breakpoints),
      watchpoints: watchpoints,
      enableTrace: isRecording,
      maxSteps: 1
    });
    
    // Also get disassembly
    setTimeout(() => {
      if (workerRef.current) {
        workerRef.current.postMessage({ cmd: 'get_disassembly' });
      }
    }, 100);
  }, [code, breakpoints, watchpoints, isRecording]);

  // Execute single step
  const handleStep = useCallback(() => {
    if (isRunning || cpu.halted || !workerRef.current) return;

    setIsRunning(true);
    workerRef.current.postMessage({
      cmd: 'assemble_step',
      source: code,
      breakpoints: Array.from(breakpoints),
      watchpoints: watchpoints,
      enableTrace: isRecording
    });
  }, [cpu, isRunning, code, breakpoints, watchpoints, isRecording]);

  // Run with speed control
  const handleRun = useCallback(() => {
    if (isRunning || !workerRef.current) return;

    setIsRunning(true);
    setError(null);
    setConsoleOutput(prev => [...prev, '🚀 Running program...']);

    // Start performance monitoring
    const startTime = Date.now();
    let lastStepCount = 0;
    
    performanceTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const currentSteps = trace.length;
      const stepsThisSecond = currentSteps - lastStepCount;
      setStepsPerSecond(stepsThisSecond);
      lastStepCount = currentSteps;
    }, 1000);

    workerRef.current.postMessage({
      cmd: 'assemble_run',
      source: code,
      breakpoints: Array.from(breakpoints),
      watchpoints: watchpoints,
      enableTrace: isRecording,
      speed: runSpeed,
      maxSteps: runSpeed === 0 ? 100000 : 10000
    });
  }, [isRunning, code, breakpoints, watchpoints, isRecording, runSpeed, trace.length]);



  // Watch management
  const addWatch = useCallback((expression: string, isWatchpoint: boolean = false) => {
    if (!expression.trim()) return;

    const id = Date.now().toString();
    const result = evaluateWatch(expression);

    const newWatch: WatchExpression = {
      id,
      expression: expression.trim(),
      value: result.error ? `Error: ${result.error}` : result.value,
      history: [result.error ? `Error: ${result.error}` : result.value],
      error: result.error,
      changed: false,
      isWatchpoint,
      watchpointTriggered: false
    };

    setWatches(prev => [...prev, newWatch]);

    // If it's a watchpoint, add to watchpoints list
    if (isWatchpoint && !result.error) {
      try {
        const addr = parseWatchpointAddress(expression);
        const newWatchpoint: WatchpointDef = {
          id,
          address: addr,
          size: 4, // Default to 4-byte words
          condition: 'change'
        };
        
        setWatchpoints(prev => [...prev, newWatchpoint]);
        
        // Update worker
        if (workerRef.current) {
          workerRef.current.postMessage({
            cmd: 'set_watchpoints',
            watchpoints: [...watchpoints, newWatchpoint]
          });
        }
      } catch (err) {
        console.error('Failed to create watchpoint:', err);
      }
    }
  }, [evaluateWatch, watchpoints]);

  const removeWatch = useCallback((id: string) => {
    setWatches(prev => prev.filter(w => w.id !== id));
    setWatchpoints(prev => {
      const filtered = prev.filter(wp => wp.id !== id);
      
      // Update worker
      if (workerRef.current) {
        workerRef.current.postMessage({
          cmd: 'set_watchpoints',
          watchpoints: filtered
        });
      }
      
      return filtered;
    });
  }, []);

  const toggleWatchpoint = useCallback((id: string) => {
    setWatches(prev => prev.map(w => 
      w.id === id ? { ...w, isWatchpoint: !w.isWatchpoint } : w
    ));
  }, []);

  // Parse watchpoint address from expression
  const parseWatchpointAddress = useCallback((expression: string): number => {
    const expr = expression.trim();
    
    // [0x1234] or [1234]
    const memMatch = expr.match(/^\[(.+)\]$/);
    if (memMatch) {
      const inner = memMatch[1];
      if (/^0x[0-9A-F]+$/i.test(inner)) {
        return parseInt(inner, 16);
      } else if (/^\d+$/.test(inner)) {
        return parseInt(inner, 10);
      } else if (symbols[inner.toLowerCase()]) {
        return symbols[inner.toLowerCase()];
      }
    }
    
    throw new Error(`Invalid watchpoint expression: ${expression}`);
  }, [symbols]);

  // Memory navigation
  const handleMemoryGoto = useCallback(() => {
    try {
      let addr = 0;
      const input = memoryInput.trim();

      if (input.startsWith('0x')) {
        addr = parseInt(input, 16);
      } else if (/^\d+$/.test(input)) {
        addr = parseInt(input, 10);
      } else if (programRef.current?.labels?.[input.toLowerCase()]) {
        addr = programRef.current.labels[input.toLowerCase()];
      } else {
        throw new Error(`Invalid address: ${input}`);
      }

      if (addr < 0 || addr >= RAM_SIZE) {
        throw new Error(`Address out of bounds: ${addr}`);
      }

      setMemoryView(prev => ({ ...prev, start: addr & ~0xF }));
    } catch (err) {
      setConsoleOutput(prev => [...prev, `Memory goto error: ${err instanceof Error ? err.message : 'Invalid address'}`]);
    }
  }, [memoryInput]);

  const followSP = useCallback(() => {
    setMemoryView(prev => ({
      ...prev,
      start: Math.max(0, (cpu.SP - 64) & ~0xF),
      followSP: !prev.followSP
    }));
  }, [cpu.SP]);

  // Toggle breakpoint
  const toggleBreakpoint = useCallback((line: number) => {
    setBreakpoints(prev => {
      const newBreakpoints = new Set(prev);
      if (newBreakpoints.has(line)) {
        newBreakpoints.delete(line);
      } else {
        newBreakpoints.add(line);
      }
      return newBreakpoints;
    });
  }, []);

  // Advanced debugging features
  const handleStepBack = useCallback(() => {
    if (!workerRef.current) return;
    
    workerRef.current.postMessage({ cmd: 'step_back' });
  }, []);

  const handleContinueToCursor = useCallback(() => {
    if (!workerRef.current || isRunning) return;
    
    // Get cursor position in editor
    const editor = editorRef.current;
    if (!editor) return;
    
    const cursorPos = editor.selectionStart;
    const textBeforeCursor = code.substring(0, cursorPos);
    const lineNumber = textBeforeCursor.split('\n').length - 1;
    
    setIsRunning(true);
    workerRef.current.postMessage({
      cmd: 'continue_to_cursor',
      cursorAddress: lineNumber,
      breakpoints: Array.from(breakpoints),
      watchpoints: watchpoints,
      maxSteps: 10000
    });
  }, [isRunning, code, breakpoints, watchpoints]);

  const handleToggleTrace = useCallback(() => {
    setIsRecording(prev => !prev);
  }, []);

  const handleClearTrace = useCallback(() => {
    setTrace([]);
    setTraceIndex(-1);
  }, []);

  const handleJumpToTrace = useCallback((index: number) => {
    if (index >= 0 && index < trace.length) {
      setTraceIndex(index);
      // Could restore CPU state here if needed
    }
  }, [trace.length]);

  // Disassembly handlers
  const handleJumpToAddress = useCallback((address: number) => {
    setCpu(prev => ({ ...prev, IP: address }));
  }, []);

  const handleCopyAddress = useCallback((address: number) => {
    const hexAddr = toHex(address);
    navigator.clipboard.writeText(hexAddr);
    setToastMessage(`Copied ${hexAddr} to clipboard`);
  }, []);

  const handleCopyValue = useCallback((value: number | string) => {
    navigator.clipboard.writeText(String(value));
    setToastMessage(`Copied ${value} to clipboard`);
  }, []);

  // Load sample program
  const loadSample = useCallback((sample: typeof SAMPLE_PROGRAMS[0]) => {
    setCode(sample.code);
    handleReset();
  }, [handleReset]);

  // Handle gutter click for breakpoints
  const handleGutterClick = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    if (!editorRef.current) return;

    const rect = editorRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top + editorRef.current.scrollTop;
    const lineHeight = 20;
    const lineNumber = Math.floor(y / lineHeight);

    if (e.clientX - rect.left < 50) {
      e.preventDefault();
      toggleBreakpoint(lineNumber);
    }
  }, [toggleBreakpoint]);

  // Update memory view when following SP
  useEffect(() => {
    if (memoryView.followSP) {
      setMemoryView(prev => ({
        ...prev,
        start: Math.max(0, (cpu.SP - 64) & ~0xF)
      }));
    }
  }, [cpu.SP, memoryView.followSP]);

  // Update watches when CPU state changes
  useEffect(() => {
    updateWatches();

    // Clear changed flags after animation
    const timer = setTimeout(() => {
      setWatches(prev => prev.map(w => ({ ...w, changed: false })));
    }, 600);

    return () => clearTimeout(timer);
  }, [cpu, updateWatches]);

  const memoryDump = getMemoryDump(new DataView(ram.buffer), memoryView.start, memoryView.length);

  const debugTabs = [
    { id: 'registers' as const, label: 'Registers', icon: <Cpu className="w-4 h-4" /> },
    { id: 'watches' as const, label: 'Watches', icon: <Eye className="w-4 h-4" /> },
    { id: 'memory' as const, label: 'Memory', icon: <MemoryStick className="w-4 h-4" /> },
    { id: 'disassembly' as const, label: 'Disassembly', icon: <List className="w-4 h-4" /> },
    { id: 'trace' as const, label: 'Trace', icon: <Clock className="w-4 h-4" /> },
    { id: 'console' as const, label: 'Console', icon: <Terminal className="w-4 h-4" /> },
  ];

  return (
    <div className="h-full flex flex-col" data-testid="debugger-container">
      {/* Header */}
      <div className="p-4 border-b border-edge/50">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center">
                <Bug className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-200">Assembly Debugger</h2>
                <p className="text-sm text-slate-400">Step through and analyze your code</p>
              </div>
            </div>

            {/* Sample Programs */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-slate-400">Samples:</span>
              <select
                onChange={(e) => {
                  const sample = SAMPLE_PROGRAMS.find(s => s.name === e.target.value);
                  if (sample) loadSample(sample);
                }}
                className="px-3 py-1 bg-panel border border-edge rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-accent"
                value=""
              >
                <option value="">Load Sample...</option>
                {SAMPLE_PROGRAMS.map(prog => (
                  <option key={prog.name} value={prog.name}>
                    {prog.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-3 flex-wrap gap-y-2">
            <NeonButton
              onClick={handleAssemble}
              variant="primary"
              title="Assemble code"
            >
              <Bug className="w-4 h-4 mr-2" />
              Assemble
            </NeonButton>

            <div className="w-px h-6 bg-edge"></div>

            <NeonButton
              onClick={handleStep}
              disabled={isRunning || cpu.halted}
              variant="secondary"
              title="Step Over (F10)"
            >
              <StepForward className="w-4 h-4 mr-2" />
              Step
            </NeonButton>

            <NeonButton
              onClick={handleStepBack}
              disabled={isRunning || traceIndex <= 0}
              variant="ghost"
              title="Step Back"
            >
              <SkipBack className="w-4 h-4 mr-2" />
              Back
            </NeonButton>

            <NeonButton
              onClick={handleRun}
              disabled={isRunning}
              variant={isRunning ? "danger" : "primary"}
              title="Run (Ctrl+Enter)"
            >
              {isRunning ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run
                </>
              )}
            </NeonButton>

            <NeonButton
              onClick={handleContinueToCursor}
              disabled={isRunning || cpu.halted}
              variant="secondary"
              title="Continue to Cursor"
            >
              <Target className="w-4 h-4 mr-2" />
              To Cursor
            </NeonButton>

            <div className="w-px h-6 bg-edge"></div>

            <NeonButton
              onClick={handleReset}
              variant="ghost"
              title="Reset CPU and memory"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </NeonButton>

            {/* Performance Controls */}
            <div className="ml-4">
              <PerformanceControls
                speed={runSpeed}
                onSpeedChange={setRunSpeed}
                isRunning={isRunning}
                stepsPerSecond={stepsPerSecond}
                batchSize={batchSize}
                onBatchSizeChange={setBatchSize}
              />
            </div>

            {/* Status indicators */}
            <div className="flex items-center space-x-2 ml-auto">
              <NeonButton
                onClick={handleToggleTrace}
                variant={isRecording ? "accent" : "ghost"}
                size="sm"
                title={isRecording ? "Stop trace recording" : "Start trace recording"}
              >
                <Clock className="w-4 h-4 mr-1" />
                {isRecording ? 'Recording' : 'Trace'}
              </NeonButton>
              
              {cpu.halted && (
                <TagPill variant="warning">
                  <Circle className="w-3 h-3 mr-1" />
                  Halted
                </TagPill>
              )}
              {isRunning && (
                <TagPill variant="accent">
                  <Activity className="w-3 h-3 mr-1" />
                  Running
                </TagPill>
              )}
              {isRecording && (
                <TagPill variant="accent">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-1" />
                  REC
                </TagPill>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Code Editor */}
        <div className="flex-1 flex flex-col">
          <GlassCard className="flex-1 m-4 mr-2">
            <PanelHeader
              title="Assembly Code"
              subtitle="F9: Breakpoint | F10: Step | Ctrl+Enter: Run"
              icon={<Monitor className="w-4 h-4" />}
            />

            <div className="flex-1 relative overflow-hidden">
              <textarea
                ref={editorRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onClick={handleGutterClick}
                data-testid="code-editor"
                className="w-full h-full p-4 pl-12 font-mono text-sm resize-none border-none outline-none bg-bg/30 text-slate-200 placeholder-slate-400"
                style={{
                  lineHeight: '20px',
                  tabSize: 4
                }}
                spellCheck={false}
                placeholder="Enter your EduASM code here..."
              />

              {/* Line numbers */}
              <div className="absolute left-0 top-0 w-10 h-full bg-edge/50 border-r border-edge pointer-events-none">
                {code.split('\n').map((_, index) => (
                  <div
                    key={index}
                    className="h-5 flex items-center justify-end pr-2 text-xs text-slate-400 font-mono"
                    style={{ lineHeight: '20px' }}
                  >
                    {index + 1}
                  </div>
                ))}
              </div>

              {/* Breakpoint indicators */}
              <div className="absolute left-0 top-0 w-10 h-full pointer-events-none">
                {Array.from(breakpoints).map(line => (
                  <div
                    key={line}
                    data-testid="breakpoint-indicator"
                    className="absolute w-3 h-3 bg-danger rounded-full border border-danger shadow-neon-sm"
                    style={{
                      top: `${line * 20 + 3}px`,
                      left: '2px'
                    }}
                    title={`Breakpoint at line ${line + 1}`}
                  />
                ))}
              </div>

              {/* Current line indicator */}
              {cpu.IP >= 0 && !cpu.halted && (
                <div
                  className="absolute left-0 w-full bg-accent/20 pointer-events-none border-l-4 border-accent"
                style={{
                  top: `${cpu.IP * 20}px`,
                  height: '20px'
                }}
                title={`Currently executing line ${cpu.IP + 1}`}
              />
            )}

            {/* Error line indicator */}
            {error && error.line > 0 && (
              <div
                className="absolute left-0 w-full bg-red-200 opacity-60 pointer-events-none border-l-4 border-red-500"
                style={{
                  top: `${(error.line - 1) * 20}px`,
                  height: '20px'
                }}
                title={`Error on line ${error.line}`}
              />
            )}
          </div>

            {/* Enhanced Error Display */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-t border-edge/50 p-4 bg-danger/10"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-danger font-mono text-sm">
                      <button
                        className="hover:underline text-left"
                        onClick={() => highlightErrorLine(error.line)}
                        title="Click to highlight error line"
                      >
                        Line {error.line}: {error.message}
                      </button>
                    </div>
                    {error.hint && (
                      <div className="text-warn text-xs mt-2 flex items-center">
                        <Lightbulb className="w-3 h-3 mr-1" />
                        {error.hint}
                      </div>
                    )}
                    {error.suggestion && (
                      <div className="text-accent text-xs mt-1 flex items-center">
                        <Lightbulb className="w-3 h-3 mr-1" />
                        Try: {error.suggestion}
                      </div>
                    )}
                  </div>
                  <NeonButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setError(null)}
                    title="Dismiss error"
                  >
                    ✕
                  </NeonButton>
                </div>
              </motion.div>
            )}
          </GlassCard>
        </div>

        {/* Right Panel */}
        <div className="w-96 flex flex-col">
          <GlassCard className="flex-1 m-4 ml-2">
            <div className="p-4 border-b border-edge/50">
              <GlowTabs
                tabs={debugTabs}
                activeTab={selectedPanel}
                onTabChange={setSelectedPanel}
                className="w-full"
              />
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-hidden">
              {selectedPanel === 'registers' && (
                <div className="space-y-6">
                  {/* CPU Registers */}
                  <div>
                    <h4 className="font-semibold text-slate-200 mb-3 flex items-center">
                      <Cpu className="w-4 h-4 mr-2 text-accent" />
                      General Purpose
                    </h4>
                    <div className="space-y-2">
                      {cpu.R.map((value, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex justify-between items-center py-2 px-3 bg-edge/30 rounded-lg border border-edge/50"
                        >
                          <span className="font-mono text-sm text-accent">R{index}</span>
                          <div className="text-right">
                            <span className="font-mono text-sm text-slate-200">{toHex(value)}</span>
                            <span className="text-xs text-slate-400 ml-2">({value})</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Special Registers */}
                  <div>
                    <h4 className="font-semibold text-slate-200 mb-3 flex items-center">
                      <MemoryStick className="w-4 h-4 mr-2 text-accent2" />
                      Special
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center py-2 px-3 bg-edge/30 rounded-lg border border-edge/50">
                        <span className="font-mono text-sm text-accent2">SP</span>
                        <div className="text-right">
                          <span className="font-mono text-sm text-slate-200">{toHex(cpu.SP)}</span>
                          <span className="text-xs text-slate-400 ml-2">({cpu.SP})</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center py-2 px-3 bg-edge/30 rounded-lg border border-edge/50">
                        <span className="font-mono text-sm text-accent2">BP</span>
                        <div className="text-right">
                          <span className="font-mono text-sm text-slate-200">{toHex(cpu.BP)}</span>
                          <span className="text-xs text-slate-400 ml-2">({cpu.BP})</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center py-2 px-3 bg-edge/30 rounded-lg border border-edge/50">
                        <span className="font-mono text-sm text-accent2">IP</span>
                        <div className="text-right">
                          <span className="font-mono text-sm text-slate-200">{toHex(cpu.IP)}</span>
                          <span className="text-xs text-slate-400 ml-2">({cpu.IP})</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Flags */}
                  <div>
                    <h4 className="font-semibold text-slate-200 mb-3 flex items-center">
                      <Activity className="w-4 h-4 mr-2 text-warn" />
                      Flags
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(cpu.F).map(([flag, value]) => (
                        <TagPill
                          key={flag}
                          variant={value ? 'success' : 'default'}
                          className="justify-center"
                        >
                          {flag}
                        </TagPill>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            {selectedPanel === 'watches' && (
              <WatchesPanel
                watches={watches}
                onAddWatch={addWatch}
                onRemoveWatch={removeWatch}
                onToggleWatchpoint={toggleWatchpoint}
                onCopyValue={handleCopyValue}
              />
            )}

            {selectedPanel === 'memory' && (
              <MemoryViewer
                ram={ramViewRef.current}
                currentSP={cpu.SP}
                symbols={symbols}
                onAddressChange={(addr) => setMemoryView(prev => ({ ...prev, start: addr }))}
              />
            )}

            {selectedPanel === 'disassembly' && (
              <DisassemblyPanel
                disassembly={disassembly}
                symbols={symbols}
                currentIP={cpu.IP}
                onJumpToAddress={handleJumpToAddress}
                onCopyAddress={handleCopyAddress}
              />
            )}

            {selectedPanel === 'trace' && (
              <TracePanel
                isRecording={isRecording}
                trace={trace}
                currentIndex={traceIndex}
                maxEntries={maxTraceEntries}
                onToggleRecording={handleToggleTrace}
                onStepBack={handleStepBack}
                onClearTrace={handleClearTrace}
                onJumpToTrace={handleJumpToTrace}
              />
            )}

            {selectedPanel === 'oldmemory' && (
              <div className="p-4">
                {/* Add Watch */}
                <div className="mb-4">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newWatchExpression}
                      onChange={(e) => setNewWatchExpression(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addWatch()}
                      placeholder="R0, [0x1000], [R1+4]..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={addWatch}
                      className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      Add
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Examples: R0, SP, [0x1000], [R1+4], [label]
                  </div>
                </div>

                {/* Watch List */}
                <div className="space-y-2">
                  {watches.map(watch => (
                    <div
                      key={watch.id}
                      data-testid="watch-expression"
                      className={`p-3 border rounded transition-all duration-300 ${watch.changed ? 'bg-yellow-50 border-yellow-300 animate-pulse' : 'bg-gray-50 border-gray-200'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm text-blue-600">{watch.expression}</span>
                        <button
                          onClick={() => removeWatch(watch.id)}
                          className="text-red-500 hover:text-red-700 text-xs"
                          title="Remove watch"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="mt-1">
                        {watch.error ? (
                          <span className="text-red-600 text-xs">{watch.error}</span>
                        ) : (
                          <div>
                            <span className="font-mono text-sm">
                              {typeof watch.value === 'number' ? toHex(watch.value) : watch.value}
                            </span>
                            {typeof watch.value === 'number' && (
                              <span className="text-xs text-gray-500 ml-2">({watch.value})</span>
                            )}
                          </div>
                        )}
                      </div>
                      {watch.history.length > 1 && (
                        <div className="mt-2 text-xs text-gray-500">
                          <div className="font-medium">History:</div>
                          <div className="space-y-1">
                            {watch.history.slice(1, 4).map((val, idx) => (
                              <div key={idx} className="font-mono">
                                {typeof val === 'number' ? toHex(val) : val}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {watches.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      <div className="text-4xl mb-2">👁</div>
                      <div>No watch expressions</div>
                      <div className="text-sm">Add expressions to monitor values</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedPanel === 'console' && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="font-semibold text-slate-200 flex items-center">
                      <Terminal className="w-4 h-4 mr-2 text-ok" />
                      Console Output
                    </h4>
                    <NeonButton
                      size="sm"
                      variant="ghost"
                      onClick={() => setConsoleOutput([])}
                    >
                      Clear
                    </NeonButton>
                  </div>

                  <ScrollArea className="bg-bg/50 border border-edge/50 rounded-xl p-3 font-mono text-sm h-64">
                    {consoleOutput.length === 0 ? (
                      <div className="text-slate-500">Console output will appear here...</div>
                    ) : (
                      consoleOutput.map((line, index) => (
                        <div key={index} className="mb-1 text-ok">
                          {line}
                        </div>
                      ))
                    )}
                  </ScrollArea>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Status Bar */}
      <div className="border-t border-edge/50 px-4 py-3 bg-panel/50 backdrop-blur-sm">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <TagPill variant={cpu.halted ? 'warning' : isRunning ? 'accent' : 'default'} size="sm">
              Status: {cpu.halted ? 'Halted' : isRunning ? 'Running' : 'Ready'}
            </TagPill>
            <span className="text-slate-400">IP: <span className="text-accent font-mono">{cpu.IP}</span></span>
            <span className="text-slate-400">SP: <span className="text-accent2 font-mono">{toHex(cpu.SP)}</span></span>
            {watches.length > 0 && (
              <TagPill variant="accent" size="sm">
                Watches: {watches.length}
              </TagPill>
            )}
          </div>
          <div className="flex items-center space-x-4 text-xs text-slate-400">
            <span>RAM: {RAM_SIZE / 1024}KB</span>
            <span>Breakpoints: {breakpoints.size}</span>
            {trace.length > 0 && <span>Trace: {trace.length}/{maxTraceEntries}</span>}
          </div>
        </div>
      </div>

      {/* Toast notifications */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type="info"
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
};

export default AsmDebugger;