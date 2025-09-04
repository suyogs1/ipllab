// EduASM Web Worker - Off-main-thread assembler execution with step limits

import { assemble, createCPU, resetCPU, step, CPU, Program, AsmError } from './asmEngine';
import { createRAM, RAM_SIZE } from '../utils/memory';

interface WorkerMessage {
  cmd: 'assemble_run' | 'assemble_step' | 'reset' | 'continue' | 'set_breakpoints' | 'set_watchpoints' | 'continue_to_cursor' | 'step_back' | 'get_disassembly';
  source?: string;
  breakpoints?: number[];
  watchpoints?: WatchpointDef[];
  speed?: number;
  maxSteps?: number;
  cursorAddress?: number;
  enableTrace?: boolean;
}

interface WatchpointDef {
  id: string;
  address: number;
  size: number; // 1, 2, or 4 bytes
  condition?: 'read' | 'write' | 'change';
}

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

interface MemoryChange {
  address: number;
  value: number;
  size: number; // 1, 2, or 4 bytes
}

interface TraceSnapshot {
  ip: number;
  line: number;
  op: string;
  operands: string;
  registers: number[];
  flags: { ZF: boolean; NF: boolean; CF: boolean; OF: boolean };
  memoryDiff?: MemoryChange[];
  timestamp: number;
}

interface DisassemblyEntry {
  address: number;
  opcode: string;
  operands: string;
  label?: string;
  source: string;
}

interface WorkerResponse {
  type: 'success' | 'error' | 'step_complete' | 'run_complete' | 'breakpoint_hit' | 'watchpoint_hit' | 'cursor_reached' | 'disassembly';
  cpu?: CPUState;
  memoryChanges?: MemoryChange[];
  consoleOutput?: string[];
  error?: {
    line: number;
    message: string;
    hint?: string;
  };
  stepsExecuted?: number;
  hitBreakpoint?: boolean;
  hitWatchpoint?: {
    id: string;
    address: number;
    oldValue: number;
    newValue: number;
  };
  pauseReason?: 'breakpoint' | 'watchpoint' | 'cursor' | 'halt' | 'error' | 'step_limit';
  traceSnapshot?: TraceSnapshot;
  disassembly?: DisassemblyEntry[];
  symbols?: Record<string, number>;
}

// Worker state
let cpu: CPU;
let program: Program | null = null;
let ram: DataView;
let breakpoints = new Set<number>();
let watchpoints = new Map<string, WatchpointDef>();
let watchpointValues = new Map<number, number>();
let consoleOutput: string[] = [];
let lastMemorySnapshot: Uint8Array;

// Trace recording
let traceEnabled = false;
let traceBuffer: TraceSnapshot[] = [];
let traceIndex = -1;
const MAX_TRACE_ENTRIES = 1024;

// Initialize worker state
function initializeWorker() {
  cpu = createCPU();
  ram = createRAM();
  lastMemorySnapshot = new Uint8Array(RAM_SIZE);
  consoleOutput = [];
  watchpoints.clear();
  watchpointValues.clear();
  traceBuffer = [];
  traceIndex = -1;
  traceEnabled = false;
}

// Convert CPU to serializable state
function serializeCPU(cpu: CPU): CPUState {
  return {
    R: Array.from(cpu.R),
    SP: cpu.SP,
    BP: cpu.BP,
    IP: cpu.IP,
    F: { ...cpu.F },
    halted: cpu.halted
  };
}

// Detect memory changes since last snapshot
function getMemoryChanges(): MemoryChange[] {
  const changes: MemoryChange[] = [];
  const currentSnapshot = new Uint8Array(ram.buffer);
  
  for (let i = 0; i < RAM_SIZE; i += 4) {
    // Check 4-byte words for efficiency
    let changed = false;
    for (let j = 0; j < 4 && i + j < RAM_SIZE; j++) {
      if (currentSnapshot[i + j] !== lastMemorySnapshot[i + j]) {
        changed = true;
        break;
      }
    }
    
    if (changed) {
      try {
        const value = ram.getInt32(i, true); // little-endian
        changes.push({
          address: i,
          value,
          size: 4
        });
      } catch {
        // Handle edge case near end of memory
        for (let j = 0; j < 4 && i + j < RAM_SIZE; j++) {
          if (currentSnapshot[i + j] !== lastMemorySnapshot[i + j]) {
            changes.push({
              address: i + j,
              value: currentSnapshot[i + j],
              size: 1
            });
          }
        }
      }
    }
  }
  
  // Update snapshot
  lastMemorySnapshot.set(currentSnapshot);
  return changes;
}

// Check watchpoints for memory changes
function checkWatchpoints(memoryChanges: MemoryChange[]): { id: string; address: number; oldValue: number; newValue: number } | null {
  for (const change of memoryChanges) {
    for (const [id, watchpoint] of watchpoints) {
      const wpStart = watchpoint.address;
      const wpEnd = wpStart + watchpoint.size;
      const changeStart = change.address;
      const changeEnd = changeStart + change.size;
      
      // Check if memory ranges overlap
      if (changeStart < wpEnd && changeEnd > wpStart) {
        const oldValue = watchpointValues.get(watchpoint.address) || 0;
        const newValue = getWatchpointValue(watchpoint);
        
        if (oldValue !== newValue) {
          watchpointValues.set(watchpoint.address, newValue);
          return {
            id,
            address: watchpoint.address,
            oldValue,
            newValue
          };
        }
      }
    }
  }
  return null;
}

// Get current value at watchpoint address
function getWatchpointValue(watchpoint: WatchpointDef): number {
  try {
    switch (watchpoint.size) {
      case 1:
        return ram.getUint8(watchpoint.address);
      case 2:
        return ram.getUint16(watchpoint.address, true);
      case 4:
        return ram.getInt32(watchpoint.address, true);
      default:
        return 0;
    }
  } catch {
    return 0;
  }
}

// Initialize watchpoint values
function initializeWatchpointValues() {
  for (const [_, watchpoint] of watchpoints) {
    watchpointValues.set(watchpoint.address, getWatchpointValue(watchpoint));
  }
}

// Record trace snapshot
function recordTrace(beforeStep: boolean = true): void {
  if (!traceEnabled || !program) return;
  
  const instruction = program.ast[cpu.IP];
  if (!instruction) return;
  
  const snapshot: TraceSnapshot = {
    ip: cpu.IP,
    line: instruction.line,
    op: instruction.op,
    operands: instruction.source.split(/\s+/).slice(1).join(' '),
    registers: Array.from(cpu.R),
    flags: { ...cpu.F },
    timestamp: Date.now()
  };
  
  // Add to circular buffer
  if (traceBuffer.length >= MAX_TRACE_ENTRIES) {
    traceBuffer.shift();
  }
  traceBuffer.push(snapshot);
  traceIndex = traceBuffer.length - 1;
}

// Step back using trace
function stepBack(): boolean {
  if (traceIndex <= 0 || traceBuffer.length === 0) {
    return false;
  }
  
  traceIndex--;
  const snapshot = traceBuffer[traceIndex];
  
  // Restore CPU state
  cpu.IP = snapshot.ip;
  cpu.R.set(snapshot.registers);
  cpu.F = { ...snapshot.flags };
  
  return true;
}

// Generate disassembly
function generateDisassembly(): DisassemblyEntry[] {
  if (!program) return [];
  
  return program.ast.map((instruction, index) => ({
    address: index,
    opcode: instruction.op,
    operands: instruction.operands.map(op => {
      if (op.type === 'reg') {
        const regIndex = op.value as number;
        if (regIndex === -1) return 'SP';
        if (regIndex === -2) return 'BP';
        return `R${regIndex}`;
      } else if (op.type === 'imm') {
        return `#${op.value}`;
      } else if (op.type === 'mem') {
        if (op.indirect) {
          const regIndex = op.value as number;
          const regName = regIndex === -1 ? 'SP' : regIndex === -2 ? 'BP' : `R${regIndex}`;
          return op.offset ? `[${regName}${op.offset >= 0 ? '+' : ''}${op.offset}]` : `[${regName}]`;
        } else {
          return `[${typeof op.value === 'string' ? op.value : `0x${op.value.toString(16)}`}]`;
        }
      } else if (op.type === 'label') {
        return op.value as string;
      }
      return String(op.value);
    }).join(', '),
    label: Object.keys(program.labels).find(label => program.labels[label] === index),
    source: instruction.source
  }));
}

// Syscall handler
function handleSyscall(syscall: number, cpu: CPU, ram: DataView): void {
  try {
    switch (syscall) {
      case 1: // PRINT_INT R0
        const intValue = cpu.R[0];
        consoleOutput.push(`${intValue}`);
        break;
        
      case 2: // PRINT_STR [R1]
        const strAddr = cpu.R[1];
        if (strAddr < 0 || strAddr >= RAM_SIZE) {
          throw new Error(`Invalid string address: 0x${strAddr.toString(16)}`);
        }
        
        let str = '';
        for (let i = 0; i < 1024; i++) { // Max string length
          if (strAddr + i >= RAM_SIZE) break;
          const byte = ram.getUint8(strAddr + i);
          if (byte === 0) break; // Null terminator
          str += String.fromCharCode(byte);
        }
        consoleOutput.push(str);
        break;
        
      case 3: // EXIT
        const exitCode = cpu.R[0];
        consoleOutput.push(`Program exited with code ${exitCode}`);
        cpu.halted = true;
        break;
        
      default:
        throw new Error(`Unknown syscall: ${syscall}`);
    }
  } catch (error) {
    const errorMsg = `SYSCALL ERROR: ${error instanceof Error ? error.message : String(error)}`;
    consoleOutput.push(errorMsg);
    throw new AsmError(cpu.IP + 1, errorMsg);
  }
}

// Execute single step with error handling
function executeStep(): boolean {
  if (cpu.halted || !program) {
    return false;
  }
  
  if (cpu.IP < 0 || cpu.IP >= program.ast.length) {
    cpu.halted = true;
    return false;
  }
  
  try {
    // Record trace before step
    if (traceEnabled) {
      recordTrace(true);
    }
    
    step(cpu, program, ram, {
      onSys: (syscall: number) => {
        handleSyscall(syscall, cpu, ram);
        return '';
      }
    });
    return true;
  } catch (error) {
    if (error instanceof AsmError) {
      throw error;
    } else {
      const line = program.ast[cpu.IP]?.line || cpu.IP + 1;
      throw new AsmError(line, error instanceof Error ? error.message : String(error));
    }
  }
}

// Message handler
self.onmessage = function(event: MessageEvent<WorkerMessage>) {
  const { cmd, source, breakpoints: newBreakpoints, watchpoints: newWatchpoints, speed, maxSteps, cursorAddress, enableTrace } = event.data;
  
  try {
    switch (cmd) {
      case 'reset':
        initializeWorker();
        program = null;
        
        self.postMessage({
          type: 'success',
          cpu: serializeCPU(cpu),
          memoryChanges: [],
          consoleOutput: []
        } as WorkerResponse);
        break;
        
      case 'set_breakpoints':
        if (newBreakpoints) {
          breakpoints = new Set(newBreakpoints);
        }
        
        self.postMessage({
          type: 'success'
        } as WorkerResponse);
        break;
        
      case 'set_watchpoints':
        if (newWatchpoints) {
          watchpoints.clear();
          for (const wp of newWatchpoints) {
            watchpoints.set(wp.id, wp);
          }
          initializeWatchpointValues();
        }
        
        self.postMessage({
          type: 'success'
        } as WorkerResponse);
        break;
        
      case 'step_back':
        const stepped = stepBack();
        if (stepped) {
          const memoryChanges = getMemoryChanges();
          
          self.postMessage({
            type: 'step_complete',
            cpu: serializeCPU(cpu),
            memoryChanges,
            consoleOutput: [...consoleOutput],
            stepsExecuted: -1,
            pauseReason: 'step_limit'
          } as WorkerResponse);
        } else {
          self.postMessage({
            type: 'error',
            error: {
              line: 0,
              message: 'Cannot step back - no trace history available'
            }
          } as WorkerResponse);
        }
        break;
        
      case 'get_disassembly':
        const disassembly = generateDisassembly();
        const symbols = program?.labels || {};
        
        self.postMessage({
          type: 'disassembly',
          disassembly,
          symbols
        } as WorkerResponse);
        break;
        
      case 'assemble_run':
      case 'assemble_step':
        if (!source) {
          throw new Error('No source code provided');
        }
        
        // Assemble the program
        try {
          program = assemble(source);
          resetCPU(cpu);
          consoleOutput = [];
          
          // Initialize memory with data section
          const newRam = createRAM();
          for (let i = 0; i < program.dataSection.length; i++) {
            const byte = program.dataSection[i];
            if (byte !== undefined) {
              newRam.setUint8(i, byte);
            }
          }
          ram = newRam;
          lastMemorySnapshot = new Uint8Array(RAM_SIZE);
          
          // Set trace mode
          if (enableTrace !== undefined) {
            traceEnabled = enableTrace;
            if (traceEnabled) {
              traceBuffer = [];
              traceIndex = -1;
            }
          }
          
          // Initialize watchpoints
          initializeWatchpointValues();
          
        } catch (error) {
          if (error instanceof AsmError) {
            self.postMessage({
              type: 'error',
              error: {
                line: error.line,
                message: error.message,
                hint: error.hint
              }
            } as WorkerResponse);
            return;
          } else {
            throw error;
          }
        }
        
        if (cmd === 'assemble_step') {
          // Execute single step
          try {
            const stepped = executeStep();
            const memoryChanges = getMemoryChanges();
            
            // Check watchpoints
            const hitWatchpoint = checkWatchpoints(memoryChanges);
            
            self.postMessage({
              type: hitWatchpoint ? 'watchpoint_hit' : 'step_complete',
              cpu: serializeCPU(cpu),
              memoryChanges,
              consoleOutput: [...consoleOutput],
              stepsExecuted: stepped ? 1 : 0,
              hitWatchpoint,
              pauseReason: hitWatchpoint ? 'watchpoint' : undefined,
              traceSnapshot: traceEnabled && traceBuffer.length > 0 ? traceBuffer[traceBuffer.length - 1] : undefined
            } as WorkerResponse);
            
          } catch (error) {
            if (error instanceof AsmError) {
              self.postMessage({
                type: 'error',
                error: {
                  line: error.line,
                  message: error.message,
                  hint: error.hint
                }
              } as WorkerResponse);
            } else {
              throw error;
            }
          }
        } else {
          // Execute until halt, breakpoint, or step limit
          const stepLimit = maxSteps || 100000;
          let stepsExecuted = 0;
          let hitBreakpoint = false;
          
          try {
            let pauseReason: 'breakpoint' | 'watchpoint' | 'cursor' | 'halt' | 'error' | 'step_limit' = 'halt';
            let hitWatchpoint: { id: string; address: number; oldValue: number; newValue: number } | undefined;
            
            while (!cpu.halted && stepsExecuted < stepLimit) {
              // Check for breakpoint
              if (breakpoints.has(cpu.IP)) {
                hitBreakpoint = true;
                pauseReason = 'breakpoint';
                break;
              }
              
              const stepped = executeStep();
              if (!stepped) {
                pauseReason = cpu.halted ? 'halt' : 'error';
                break;
              }
              
              stepsExecuted++;
              
              // Check memory changes and watchpoints
              const memoryChanges = getMemoryChanges();
              hitWatchpoint = checkWatchpoints(memoryChanges);
              if (hitWatchpoint) {
                pauseReason = 'watchpoint';
                break;
              }
              
              // Yield periodically to prevent blocking
              if (stepsExecuted % 250 === 0) {
                // Use setTimeout instead of await
                setTimeout(() => {}, 0);
              }
            }
            
            if (stepsExecuted >= stepLimit) {
              pauseReason = 'step_limit';
            }
            
            const memoryChanges = getMemoryChanges();
            
            self.postMessage({
              type: hitBreakpoint ? 'breakpoint_hit' : hitWatchpoint ? 'watchpoint_hit' : 'run_complete',
              cpu: serializeCPU(cpu),
              memoryChanges,
              consoleOutput: [...consoleOutput],
              stepsExecuted,
              hitBreakpoint,
              hitWatchpoint,
              pauseReason
            } as WorkerResponse);
            
          } catch (error) {
            if (error instanceof AsmError) {
              self.postMessage({
                type: 'error',
                error: {
                  line: error.line,
                  message: error.message,
                  hint: error.hint
                },
                cpu: serializeCPU(cpu),
                memoryChanges: getMemoryChanges(),
                consoleOutput: [...consoleOutput],
                stepsExecuted
              } as WorkerResponse);
            } else {
              throw error;
            }
          }
        }
        break;
        
      case 'continue_to_cursor':
        if (!program) {
          throw new Error('No program loaded');
        }
        
        if (cursorAddress === undefined) {
          throw new Error('No cursor address provided');
        }
        
        const stepLimit2 = maxSteps || 100000;
        let stepsExecuted2 = 0;
        let pauseReason2: 'breakpoint' | 'watchpoint' | 'cursor' | 'halt' | 'error' | 'step_limit' = 'halt';
        let hitWatchpoint2: { id: string; address: number; oldValue: number; newValue: number } | undefined;
        let hitBreakpoint2 = false;
        
        try {
          while (!cpu.halted && stepsExecuted2 < stepLimit2) {
            // Check if we reached cursor
            if (cpu.IP === cursorAddress) {
              pauseReason2 = 'cursor';
              break;
            }
            
            // Check for breakpoint (but continue past cursor)
            if (breakpoints.has(cpu.IP) && cpu.IP !== cursorAddress) {
              hitBreakpoint2 = true;
              pauseReason2 = 'breakpoint';
              break;
            }
            
            const stepped = executeStep();
            if (!stepped) {
              pauseReason2 = cpu.halted ? 'halt' : 'error';
              break;
            }
            
            stepsExecuted2++;
            
            // Check watchpoints
            const memoryChanges = getMemoryChanges();
            hitWatchpoint2 = checkWatchpoints(memoryChanges);
            if (hitWatchpoint2) {
              pauseReason2 = 'watchpoint';
              break;
            }
            
            // Yield periodically
            if (stepsExecuted2 % 250 === 0) {
              setTimeout(() => {}, 0);
            }
          }
          
          if (stepsExecuted2 >= stepLimit2) {
            pauseReason2 = 'step_limit';
          }
          
          const memoryChanges = getMemoryChanges();
          
          self.postMessage({
            type: pauseReason2 === 'cursor' ? 'cursor_reached' : 
                  hitBreakpoint2 ? 'breakpoint_hit' : 
                  hitWatchpoint2 ? 'watchpoint_hit' : 'run_complete',
            cpu: serializeCPU(cpu),
            memoryChanges,
            consoleOutput: [...consoleOutput],
            stepsExecuted: stepsExecuted2,
            hitBreakpoint: hitBreakpoint2,
            hitWatchpoint: hitWatchpoint2,
            pauseReason: pauseReason2
          } as WorkerResponse);
          
        } catch (error) {
          if (error instanceof AsmError) {
            self.postMessage({
              type: 'error',
              error: {
                line: error.line,
                message: error.message,
                hint: error.hint
              },
              cpu: serializeCPU(cpu),
              memoryChanges: getMemoryChanges(),
              consoleOutput: [...consoleOutput],
              stepsExecuted: stepsExecuted2
            } as WorkerResponse);
          } else {
            throw error;
          }
        }
        break;
        
      case 'continue':
        if (!program) {
          throw new Error('No program loaded');
        }
        
        const stepLimit = maxSteps || 100000;
        let stepsExecuted = 0;
        let hitBreakpoint = false;
        
        try {
          let pauseReason3: 'breakpoint' | 'watchpoint' | 'cursor' | 'halt' | 'error' | 'step_limit' = 'halt';
          let hitWatchpoint3: { id: string; address: number; oldValue: number; newValue: number } | undefined;
          
          while (!cpu.halted && stepsExecuted < stepLimit) {
            // Check for breakpoint (skip current IP if we're already on one)
            if (stepsExecuted > 0 && breakpoints.has(cpu.IP)) {
              hitBreakpoint = true;
              pauseReason3 = 'breakpoint';
              break;
            }
            
            const stepped = executeStep();
            if (!stepped) {
              pauseReason3 = cpu.halted ? 'halt' : 'error';
              break;
            }
            
            stepsExecuted++;
            
            // Check watchpoints
            const memoryChanges = getMemoryChanges();
            hitWatchpoint3 = checkWatchpoints(memoryChanges);
            if (hitWatchpoint3) {
              pauseReason3 = 'watchpoint';
              break;
            }
            
            // Yield periodically
            if (stepsExecuted % 250 === 0) {
              setTimeout(() => {}, 0);
            }
          }
          
          if (stepsExecuted >= stepLimit) {
            pauseReason3 = 'step_limit';
          }
          
          const memoryChanges = getMemoryChanges();
          
          self.postMessage({
            type: hitBreakpoint ? 'breakpoint_hit' : hitWatchpoint3 ? 'watchpoint_hit' : 'run_complete',
            cpu: serializeCPU(cpu),
            memoryChanges,
            consoleOutput: [...consoleOutput],
            stepsExecuted,
            hitBreakpoint,
            hitWatchpoint: hitWatchpoint3,
            pauseReason: pauseReason3
          } as WorkerResponse);
          
        } catch (error) {
          if (error instanceof AsmError) {
            self.postMessage({
              type: 'error',
              error: {
                line: error.line,
                message: error.message,
                hint: error.hint
              },
              cpu: serializeCPU(cpu),
              memoryChanges: getMemoryChanges(),
              consoleOutput: [...consoleOutput],
              stepsExecuted
            } as WorkerResponse);
          } else {
            throw error;
          }
        }
        break;
        
      default:
        throw new Error(`Unknown command: ${cmd}`);
    }
    
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: {
        line: 0,
        message: error instanceof Error ? error.message : String(error)
      }
    } as WorkerResponse);
  }
};

// Handle worker errors
self.onerror = function(error) {
  self.postMessage({
    type: 'error',
    error: {
      line: 0,
      message: `Worker error: ${error.message || 'Unknown error'}`
    }
  } as WorkerResponse);
};

self.onunhandledrejection = function(event) {
  self.postMessage({
    type: 'error',
    error: {
      line: 0,
      message: `Unhandled promise rejection: ${event.reason}`
    }
  } as WorkerResponse);
};

// Initialize on startup
initializeWorker();