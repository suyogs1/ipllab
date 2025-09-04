import { assemble, createCPU, step, AsmError } from '../runners/asmEngine';
import { RAM_SIZE } from '../utils/memory';

export interface AssertResult {
  id: string;
  ok: boolean;
  got: any;
  expected: any;
  detail?: string;
}

export interface GradeResult {
  passed: boolean;
  results: AssertResult[];
  error?: string;
  steps?: number;
}

export interface Challenge {
  id: string;
  title: string;
  prompt: string;
  starter: string;
  watches: string[];
  breakpoints?: number[];
  asserts: Array<{
    type: 'register' | 'memory' | 'registerIn' | 'memoryEqualsRange';
    reg?: string;
    addr?: string | number;
    equals?: number;
    min?: number;
    max?: number;
    range?: number[];
  }>;
  maxSteps: number;
  hints: string[];
}

/**
 * Run a challenge and grade the solution
 */
export async function runChallenge(source: string, challenge: Challenge): Promise<GradeResult> {
  try {
    // Assemble the code
    const program = assemble(source);
    
    // Initialize CPU and memory
    const cpu = createCPU();
    const ram = new Uint8Array(RAM_SIZE);
    const ramView = new DataView(ram.buffer);
    
    // Initialize RAM with data section
    for (let i = 0; i < program.dataSection.length; i++) {
      ram[i] = program.dataSection[i];
    }
    
    // Execute the program with step limit
    let steps = 0;
    const maxSteps = challenge.maxSteps || 10000;
    
    while (!cpu.halted && steps < maxSteps) {
      try {
        step(cpu, program, ramView, {
          onSys: (syscall: number) => {
            // Handle system calls silently during grading
            switch (syscall) {
              case 1: // PRINT_INT
                return `${cpu.R[0]}`;
              case 2: // PRINT_STR
                return `String at ${cpu.R[1]}`;
              case 3: // EXIT
                cpu.halted = true;
                return `Exit: ${cpu.R[0]}`;
              default:
                return '';
            }
          }
        });
        steps++;
      } catch (err) {
        return {
          passed: false,
          results: [],
          error: err instanceof Error ? err.message : 'Runtime error during execution',
          steps
        };
      }
    }
    
    if (steps >= maxSteps) {
      return {
        passed: false,
        results: [],
        error: `Execution exceeded maximum steps (${maxSteps})`,
        steps
      };
    }
    
    // Grade the assertions
    const results: AssertResult[] = [];
    let allPassed = true;
    
    for (let i = 0; i < challenge.asserts.length; i++) {
      const assert = challenge.asserts[i];
      const result: AssertResult = {
        id: `assert_${i}`,
        ok: false,
        got: null,
        expected: assert.equals
      };
      
      try {
        if (assert.type === 'register') {
          // Check register value
          const regName = assert.reg!.toUpperCase();
          let got: number;
          
          if (regName.startsWith('R') && regName.length === 2) {
            const regNum = parseInt(regName[1]);
            if (regNum >= 0 && regNum <= 7) {
              got = cpu.R[regNum];
            } else {
              throw new Error(`Invalid register: ${regName}`);
            }
          } else if (regName === 'SP') {
            got = cpu.SP;
          } else if (regName === 'BP') {
            got = cpu.BP;
          } else if (regName === 'IP') {
            got = cpu.IP;
          } else {
            throw new Error(`Unknown register: ${regName}`);
          }
          
          result.got = got;
          result.ok = got === assert.equals!;
          
          if (!result.ok) {
            result.detail = `Expected ${regName}=${assert.equals}, got ${got}`;
          }
          
        } else if (assert.type === 'registerIn') {
          // Check register value is in range
          const regName = assert.reg!.toUpperCase();
          let got: number;
          
          if (regName.startsWith('R') && regName.length === 2) {
            const regNum = parseInt(regName[1]);
            if (regNum >= 0 && regNum <= 7) {
              got = cpu.R[regNum];
            } else {
              throw new Error(`Invalid register: ${regName}`);
            }
          } else if (regName === 'SP') {
            got = cpu.SP;
          } else if (regName === 'BP') {
            got = cpu.BP;
          } else if (regName === 'IP') {
            got = cpu.IP;
          } else {
            throw new Error(`Unknown register: ${regName}`);
          }
          
          result.got = got;
          result.ok = got >= assert.min! && got <= assert.max!;
          
          if (!result.ok) {
            result.detail = `Expected ${regName} in range [${assert.min}, ${assert.max}], got ${got}`;
          }
          
        } else if (assert.type === 'memory') {
          // Check memory value
          let addr: number;
          
          if (typeof assert.addr === 'number') {
            addr = assert.addr;
          } else if (typeof assert.addr === 'string') {
            // Resolve label or expression
            addr = resolveAddress(assert.addr, program.labels);
          } else {
            throw new Error('Invalid address specification');
          }
          
          if (addr < 0 || addr >= RAM_SIZE - 3) {
            throw new Error(`Address out of bounds: ${addr}`);
          }
          
          const got = ramView.getInt32(addr, true); // Little endian
          result.got = got;
          result.ok = got === assert.equals!;
          
          if (!result.ok) {
            result.detail = `Expected memory[${addr}]=${assert.equals}, got ${got}`;
          }
          
        } else if (assert.type === 'memoryEqualsRange') {
          // Check memory range equals expected array
          let addr: number;
          
          if (typeof assert.addr === 'number') {
            addr = assert.addr;
          } else if (typeof assert.addr === 'string') {
            addr = resolveAddress(assert.addr, program.labels);
          } else {
            throw new Error('Invalid address specification');
          }
          
          if (addr < 0 || addr >= RAM_SIZE - (assert.range!.length * 4)) {
            throw new Error(`Address range out of bounds: ${addr}`);
          }
          
          const expectedRange = assert.range!;
          const gotRange: number[] = [];
          let allMatch = true;
          
          for (let i = 0; i < expectedRange.length; i++) {
            const value = ramView.getInt32(addr + (i * 4), true);
            gotRange.push(value);
            if (value !== expectedRange[i]) {
              allMatch = false;
            }
          }
          
          result.got = gotRange;
          result.expected = expectedRange;
          result.ok = allMatch;
          
          if (!result.ok) {
            result.detail = `Expected memory range [${expectedRange.join(', ')}], got [${gotRange.join(', ')}]`;
          }
        }
        
      } catch (err) {
        result.ok = false;
        result.detail = err instanceof Error ? err.message : 'Assertion evaluation error';
        result.got = 'ERROR';
      }
      
      results.push(result);
      if (!result.ok) {
        allPassed = false;
      }
    }
    
    return {
      passed: allPassed,
      results,
      steps
    };
    
  } catch (err) {
    if (err instanceof AsmError) {
      return {
        passed: false,
        results: [],
        error: `Assembly error on line ${err.line}: ${err.message}`,
        steps: 0
      };
    } else {
      return {
        passed: false,
        results: [],
        error: err instanceof Error ? err.message : 'Unknown error',
        steps: 0
      };
    }
  }
}

/**
 * Resolve address from string (label or expression)
 */
function resolveAddress(addrStr: string, labels: Record<string, number>): number {
  const addr = addrStr.trim();
  
  // Handle simple numeric addresses
  if (/^\d+$/.test(addr)) {
    return parseInt(addr, 10);
  }
  
  if (/^0x[0-9a-f]+$/i.test(addr)) {
    return parseInt(addr, 16);
  }
  
  // Handle label + offset (e.g., "array+4", "data+8")
  const offsetMatch = addr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\+\s*(\d+)$/);
  if (offsetMatch) {
    const labelName = offsetMatch[1].toLowerCase();
    const offset = parseInt(offsetMatch[2], 10);
    
    if (labels[labelName] !== undefined) {
      return labels[labelName] + offset;
    } else {
      throw new Error(`Unknown label: ${labelName}`);
    }
  }
  
  // Handle simple label
  const labelName = addr.toLowerCase();
  if (labels[labelName] !== undefined) {
    return labels[labelName];
  }
  
  throw new Error(`Cannot resolve address: ${addr}`);
}

/**
 * Load challenges from JSON
 */
export async function loadChallenges(): Promise<Record<string, Challenge[]>> {
  try {
    const response = await fetch('/asm_challenges.json');
    if (!response.ok) {
      throw new Error(`Failed to load challenges: ${response.statusText}`);
    }
    const data = await response.json();
    return data.challenges;
  } catch (err) {
    console.error('Error loading challenges:', err);
    return { beginner: [], intermediate: [], advanced: [] };
  }
}

/**
 * Load lessons from JSON
 */
export async function loadLessons(): Promise<any[]> {
  try {
    const response = await fetch('/asm_lessons.json');
    if (!response.ok) {
      throw new Error(`Failed to load lessons: ${response.statusText}`);
    }
    const data = await response.json();
    return data.lessons;
  } catch (err) {
    console.error('Error loading lessons:', err);
    return [];
  }
}

/**
 * Validate challenge structure
 */
export function validateChallenge(challenge: any): challenge is Challenge {
  return (
    typeof challenge === 'object' &&
    typeof challenge.id === 'string' &&
    typeof challenge.title === 'string' &&
    typeof challenge.prompt === 'string' &&
    typeof challenge.starter === 'string' &&
    Array.isArray(challenge.watches) &&
    Array.isArray(challenge.asserts) &&
    typeof challenge.maxSteps === 'number' &&
    Array.isArray(challenge.hints) &&
    challenge.asserts.every((assert: any) => 
      typeof assert === 'object' &&
      (assert.type === 'register' || assert.type === 'memory') &&
      typeof assert.equals === 'number'
    )
  );
}

/**
 * Get completion status from localStorage
 */
export function getCompletionStatus(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem('asmplay_completions');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Save completion status to localStorage
 */
export function saveCompletion(challengeId: string): void {
  try {
    const completions = getCompletionStatus();
    completions[challengeId] = true;
    localStorage.setItem('asmplay_completions', JSON.stringify(completions));
  } catch (err) {
    console.error('Failed to save completion:', err);
  }
}

/**
 * Show confetti animation for successful completion
 */
export function showConfetti(): void {
  // Simple confetti effect using CSS animations
  const confetti = document.createElement('div');
  confetti.className = 'confetti-container';
  confetti.innerHTML = `
    <div class="confetti">🎉</div>
    <div class="confetti">🎊</div>
    <div class="confetti">✨</div>
    <div class="confetti">🌟</div>
    <div class="confetti">🎈</div>
  `;
  
  // Add CSS for animation
  const style = document.createElement('style');
  style.textContent = `
    .confetti-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
    }
    .confetti {
      position: absolute;
      font-size: 2rem;
      animation: confetti-fall 3s ease-out forwards;
    }
    .confetti:nth-child(1) { left: 10%; animation-delay: 0s; }
    .confetti:nth-child(2) { left: 30%; animation-delay: 0.5s; }
    .confetti:nth-child(3) { left: 50%; animation-delay: 1s; }
    .confetti:nth-child(4) { left: 70%; animation-delay: 1.5s; }
    .confetti:nth-child(5) { left: 90%; animation-delay: 2s; }
    
    @keyframes confetti-fall {
      0% {
        top: -10%;
        transform: rotate(0deg);
        opacity: 1;
      }
      100% {
        top: 100%;
        transform: rotate(360deg);
        opacity: 0;
      }
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(confetti);
  
  // Clean up after animation
  setTimeout(() => {
    document.body.removeChild(confetti);
    document.head.removeChild(style);
  }, 4000);
}