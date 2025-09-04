// EduASM Engine - Educational assembler with 64KB memory and comprehensive ISA

export interface Flags {
  ZF: boolean; // Zero flag
  NF: boolean; // Negative flag  
  CF: boolean; // Carry/borrow flag
  OF: boolean; // Overflow flag
}

export interface CPU {
  R: Int32Array; // R0-R7 general purpose registers (8 registers)
  SP: number;    // Stack pointer
  BP: number;    // Base pointer
  IP: number;    // Instruction pointer
  F: Flags;      // Flags register
  halted: boolean;
}

export interface Operand {
  type: 'reg' | 'imm' | 'mem' | 'label';
  value: number | string;
  offset?: number; // For [Rk+imm] addressing
  indirect?: boolean; // For [Rk] addressing
}

export interface Instruction {
  op: string;
  operands: Operand[];
  line: number;
  source: string;
}

export interface Program {
  lines: string[];
  ast: Instruction[];
  labels: Record<string, number>;
  dataSection: Uint8Array;
  textStart: number;
  lineMap: Map<number, number>; // instruction index -> source line
}

export class AsmError extends Error {
  constructor(public line: number, message: string, public hint?: string) {
    super(`Line ${line}: ${message}`);
    this.name = 'AsmError';
  }
}

export const RAM_SIZE = 65536; // 64KB memory
const STACK_START = RAM_SIZE - 4;

// Register name to index mapping
const REGISTERS: Record<string, number> = {
  'R0': 0, 'R1': 1, 'R2': 2, 'R3': 3,
  'R4': 4, 'R5': 5, 'R6': 6, 'R7': 7,
  'SP': -1, 'BP': -2
};

/**
 * Initialize CPU state for EduASM
 */
export function createCPU(): CPU {
  return {
    R: new Int32Array(8), // R0-R7
    SP: STACK_START,
    BP: STACK_START,
    IP: 0,
    F: { ZF: false, NF: false, CF: false, OF: false },
    halted: false
  };
}

/**
 * Reset CPU to initial state
 */
export function resetCPU(cpu: CPU): void {
  cpu.R.fill(0);
  cpu.SP = STACK_START;
  cpu.BP = STACK_START;
  cpu.IP = 0;
  cpu.F.ZF = false;
  cpu.F.NF = false;
  cpu.F.CF = false;
  cpu.F.OF = false;
  cpu.halted = false;
}

/**
 * Parse operand string into structured operand with comprehensive error handling
 */
function parseOperand(token: string, labels: Record<string, number>, lineNum: number): Operand {
  token = token.replace(/,$/, '').trim(); // Remove trailing comma and whitespace
  
  if (!token) {
    throw new AsmError(lineNum, 'Empty operand', 'Operands cannot be empty');
  }
  
  // Immediate value #42
  if (token.startsWith('#')) {
    const valueStr = token.slice(1);
    const value = parseInt(valueStr, 10);
    if (isNaN(value)) {
      throw new AsmError(lineNum, `Invalid immediate value: ${token}`, 'Use #123 for immediate values');
    }
    return { type: 'imm', value };
  }
  
  // Memory addressing [addr], [Rk], [Rk+imm], [Rk-imm]
  if (token.startsWith('[') && token.endsWith(']')) {
    const inner = token.slice(1, -1).trim();
    
    if (!inner) {
      throw new AsmError(lineNum, 'Empty memory reference []', 'Memory references need an address or register');
    }
    
    // [Rk+imm] or [Rk-imm]
    const offsetMatch = inner.match(/^(R[0-7]|SP|BP)\s*([+-])\s*(\d+)$/i);
    if (offsetMatch) {
      const reg = offsetMatch[1].toUpperCase();
      const sign = offsetMatch[2];
      const offsetValue = parseInt(offsetMatch[3], 10);
      
      if (isNaN(offsetValue)) {
        throw new AsmError(lineNum, `Invalid offset in ${token}`, 'Offset must be a number');
      }
      
      const offset = offsetValue * (sign === '+' ? 1 : -1);
      
      if (!(reg in REGISTERS)) {
        throw new AsmError(lineNum, `Invalid register: ${reg}`, 'Valid registers: R0-R7, SP, BP');
      }
      
      return { type: 'mem', value: REGISTERS[reg], offset, indirect: true };
    }
    
    // [Rk] - register indirect
    const upperInner = inner.toUpperCase();
    if (upperInner in REGISTERS) {
      return { type: 'mem', value: REGISTERS[upperInner], indirect: true };
    }
    
    // [addr] - absolute address
    const addr = parseInt(inner, 10);
    if (!isNaN(addr)) {
      if (addr < 0 || addr >= RAM_SIZE) {
        throw new AsmError(lineNum, `Address ${addr} out of bounds`, `Valid range: 0-${RAM_SIZE-1}`);
      }
      return { type: 'mem', value: addr };
    }
    
    // [label] - label reference
    return { type: 'mem', value: inner };
  }
  
  // Register
  const upperToken = token.toUpperCase();
  if (upperToken in REGISTERS) {
    return { type: 'reg', value: REGISTERS[upperToken] };
  }
  
  // Numeric immediate (without #)
  const num = parseInt(token, 10);
  if (!isNaN(num)) {
    return { type: 'imm', value: num };
  }
  
  // Label
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token)) {
    return { type: 'label', value: token };
  }
  
  throw new AsmError(lineNum, `Invalid operand: ${token}`, 'Use #imm, Rk, [addr], or label');
}

/**
 * Two-pass EduASM assembler with comprehensive error handling
 */
export function assemble(source: string): Program {
  const lines = source.split('\n');
  const ast: Instruction[] = [];
  const labels: Record<string, number> = {};
  const dataSection = new Uint8Array(8192); // 8KB data section
  const lineMap = new Map<number, number>(); // instruction index -> source line
  
  let currentAddress = 0;
  let inDataSection = false;
  let dataPtr = 0;
  let textStart = 0;
  
  // Pass 1: Parse structure, collect labels, handle directives
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('//')) {
      continue;
    }
    
    // Directives
    if (trimmed.startsWith('.')) {
      const parts = trimmed.split(/\s+/);
      const directive = parts[0].toUpperCase();
      
      switch (directive) {
        case '.DATA':
          inDataSection = true;
          continue;
          
        case '.TEXT':
          inDataSection = false;
          textStart = currentAddress;
          continue;
          
        case '.ORG':
          if (parts.length < 2) {
            throw new AsmError(lineNum, '.ORG requires address', 'Usage: .ORG 1000');
          }
          const orgAddr = parseInt(parts[1], 10);
          if (isNaN(orgAddr) || orgAddr < 0) {
            throw new AsmError(lineNum, 'Invalid .ORG address', 'Address must be a positive number');
          }
          currentAddress = orgAddr;
          continue;
          
        case '.WORD':
          if (inDataSection) {
            if (parts.length < 2) {
              throw new AsmError(lineNum, '.WORD requires values', 'Usage: .WORD 1, 2, 3');
            }
            const valueStr = parts.slice(1).join(' ');
            const values = valueStr.split(',').map(v => {
              const num = parseInt(v.trim(), 10);
              if (isNaN(num)) {
                throw new AsmError(lineNum, `Invalid .WORD value: ${v.trim()}`, 'Values must be integers');
              }
              return num;
            });
            
            for (const val of values) {
              if (dataPtr + 4 > dataSection.length) {
                throw new AsmError(lineNum, 'Data section overflow', 'Too much data defined');
              }
              // Store as little-endian 32-bit
              dataSection[dataPtr++] = val & 0xFF;
              dataSection[dataPtr++] = (val >> 8) & 0xFF;
              dataSection[dataPtr++] = (val >> 16) & 0xFF;
              dataSection[dataPtr++] = (val >> 24) & 0xFF;
            }
          }
          continue;
          
        case '.BYTE':
          if (inDataSection) {
            if (parts.length < 2) {
              throw new AsmError(lineNum, '.BYTE requires values', 'Usage: .BYTE 65, 66, 67');
            }
            const valueStr = parts.slice(1).join(' ');
            const values = valueStr.split(',').map(v => {
              const num = parseInt(v.trim(), 10);
              if (isNaN(num) || num < 0 || num > 255) {
                throw new AsmError(lineNum, `Invalid .BYTE value: ${v.trim()}`, 'Values must be 0-255');
              }
              return num;
            });
            
            for (const val of values) {
              if (dataPtr >= dataSection.length) {
                throw new AsmError(lineNum, 'Data section overflow', 'Too much data defined');
              }
              dataSection[dataPtr++] = val;
            }
          }
          continue;
          
        case '.STRING':
          if (inDataSection) {
            const match = trimmed.match(/\.STRING\s+"([^"]*)"/i);
            if (!match) {
              throw new AsmError(lineNum, 'Invalid .STRING format', 'Usage: .STRING "Hello World"');
            }
            const str = match[1];
            
            for (let j = 0; j < str.length; j++) {
              if (dataPtr >= dataSection.length) {
                throw new AsmError(lineNum, 'Data section overflow', 'String too long');
              }
              dataSection[dataPtr++] = str.charCodeAt(j);
            }
            // Add null terminator
            if (dataPtr >= dataSection.length) {
              throw new AsmError(lineNum, 'Data section overflow', 'No space for null terminator');
            }
            dataSection[dataPtr++] = 0;
          }
          continue;
          
        default:
          throw new AsmError(lineNum, `Unknown directive: ${directive}`, 'Valid directives: .DATA, .TEXT, .ORG, .WORD, .BYTE, .STRING');
      }
    }
    
    // Label definition
    if (trimmed.includes(':')) {
      const colonIndex = trimmed.indexOf(':');
      const labelName = trimmed.slice(0, colonIndex).trim();
      
      if (!labelName) {
        throw new AsmError(lineNum, 'Empty label name', 'Labels must have a name before the colon');
      }
      
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(labelName)) {
        throw new AsmError(lineNum, `Invalid label name: ${labelName}`, 'Labels must start with letter/underscore, contain only alphanumeric/underscore');
      }
      
      if (labels[labelName] !== undefined) {
        throw new AsmError(lineNum, `Duplicate label: ${labelName}`, 'Each label can only be defined once');
      }
      
      if (inDataSection) {
        labels[labelName] = dataPtr;
      } else {
        labels[labelName] = currentAddress;
      }
      
      // Check for directive after label
      const afterColon = trimmed.slice(colonIndex + 1).trim();
      if (afterColon && !afterColon.startsWith(';') && !afterColon.startsWith('//')) {
        // Handle label: directive on same line
        if (afterColon.startsWith('.WORD')) {
          const parts = afterColon.split(/\s+/);
          if (parts.length < 2) {
            throw new AsmError(lineNum, '.WORD requires values', 'Usage: label: .WORD 1, 2, 3');
          }
          const valueStr = parts.slice(1).join(' ');
          const values = valueStr.split(',').map(v => {
            const num = parseInt(v.trim(), 10);
            if (isNaN(num)) {
              throw new AsmError(lineNum, `Invalid .WORD value: ${v.trim()}`, 'Values must be integers');
            }
            return num;
          });
          
          for (const val of values) {
            if (dataPtr + 4 > dataSection.length) {
              throw new AsmError(lineNum, 'Data section overflow', 'Too much data defined');
            }
            dataSection[dataPtr++] = val & 0xFF;
            dataSection[dataPtr++] = (val >> 8) & 0xFF;
            dataSection[dataPtr++] = (val >> 16) & 0xFF;
            dataSection[dataPtr++] = (val >> 24) & 0xFF;
          }
        } else if (!inDataSection) {
          // Instruction after label
          const tokens = afterColon.split(/\s+/);
          const op = tokens[0].toUpperCase();
          
          ast.push({
            op,
            operands: [],
            line: lineNum,
            source: afterColon
          });
          
          currentAddress++;
        }
      }
      continue;
    }
    
    // Instruction (only in text section)
    if (!inDataSection) {
      const tokens = trimmed.split(/\s+/);
      const op = tokens[0].toUpperCase();
      
      // Validate instruction exists
      const validOps = [
        'NOP', 'HALT', 'MOV', 'LOAD', 'STORE', 'LEA',
        'ADD', 'SUB', 'MUL', 'DIV', 'INC', 'DEC',
        'AND', 'OR', 'XOR', 'NOT', 'SHL', 'SHR',
        'CMP', 'JMP', 'JZ', 'JNZ', 'JC', 'JNC', 'JN', 'JNN',
        'JG', 'JGE', 'JL', 'JLE', 'PUSH', 'POP', 'CALL', 'RET', 'SYS'
      ];
      
      if (!validOps.includes(op)) {
        throw new AsmError(lineNum, `Unknown instruction: ${op}`, `Valid instructions: ${validOps.join(', ')}`);
      }
      
      ast.push({
        op,
        operands: [],
        line: lineNum,
        source: trimmed
      });
      
      currentAddress++;
    }
  }
  
  // Pass 2: Parse operands and validate
  let astIndex = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;
    
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('//') || 
        trimmed.startsWith('.')) {
      continue;
    }
    
    // Handle label: instruction on same line
    let instructionPart = trimmed;
    if (trimmed.includes(':')) {
      const colonIndex = trimmed.indexOf(':');
      const afterColon = trimmed.slice(colonIndex + 1).trim();
      if (afterColon && !afterColon.startsWith(';') && !afterColon.startsWith('//')) {
        instructionPart = afterColon;
      } else {
        continue; // Just a label
      }
    }
    
    const tokens = instructionPart.split(/\s+/);
    const op = tokens[0].toUpperCase();
    
    if (astIndex >= ast.length) {
      throw new AsmError(lineNum, 'Internal assembler error', 'AST index out of bounds');
    }
    
    const instruction = ast[astIndex];
    const operands: Operand[] = [];
    
    // Parse operands
    if (tokens.length > 1) {
      const operandStr = tokens.slice(1).join(' ');
      const operandTokens = operandStr.split(',').map(t => t.trim()).filter(t => t);
      
      for (const token of operandTokens) {
        operands.push(parseOperand(token, labels, lineNum));
      }
    }
    
    // Validate operand count for each instruction
    validateInstructionOperands(op, operands, lineNum);
    
    instruction.operands = operands;
    astIndex++;
  }
  
  // Validate all labels are resolved
  for (const instruction of ast) {
    for (const operand of instruction.operands) {
      if (operand.type === 'label' && !(operand.value in labels)) {
        throw new AsmError(instruction.line, `Undefined label: ${operand.value}`, 'Make sure the label is defined with labelname:');
      }
      if (operand.type === 'mem' && typeof operand.value === 'string' && !(operand.value in labels)) {
        throw new AsmError(instruction.line, `Undefined label in memory reference: ${operand.value}`, 'Make sure the label is defined with labelname:');
      }
    }
  }
  
  return {
    lines,
    ast,
    labels,
    dataSection,
    textStart
  };
}

/**
 * Validate instruction operand count and types
 */
function validateInstructionOperands(op: string, operands: Operand[], lineNum: number): void {
  const expectedCounts: Record<string, number | number[]> = {
    'NOP': 0, 'HALT': 0,
    'MOV': 2, 'LOAD': 2, 'STORE': 2, 'LEA': 2,
    'ADD': 2, 'SUB': 2, 'MUL': 2, 'DIV': 2,
    'AND': 2, 'OR': 2, 'XOR': 2, 'SHL': 2, 'SHR': 2,
    'INC': 1, 'DEC': 1, 'NOT': 1,
    'CMP': 2, 'JMP': 1, 'JZ': 1, 'JNZ': 1, 'JC': 1, 'JNC': 1,
    'JN': 1, 'JNN': 1, 'JG': 1, 'JGE': 1, 'JL': 1, 'JLE': 1,
    'PUSH': 1, 'POP': 1, 'CALL': 1, 'RET': 0, 'SYS': 1
  };
  
  const expected = expectedCounts[op];
  if (expected === undefined) {
    throw new AsmError(lineNum, `Unknown instruction: ${op}`);
  }
  
  const actual = operands.length;
  const expectedArray = Array.isArray(expected) ? expected : [expected];
  
  if (!expectedArray.includes(actual)) {
    const expectedStr = expectedArray.length === 1 ? String(expectedArray[0]) : expectedArray.join(' or ');
    throw new AsmError(lineNum, `${op} expects ${expectedStr} operand(s), got ${actual}`, 
      `Check the instruction manual for ${op}`);
  }
}

/**
 * Resolve operand value with bounds checking
 */
function resolveOperand(operand: Operand, cpu: CPU, ram: DataView, labels: Record<string, number>): number {
  switch (operand.type) {
    case 'imm':
      return operand.value as number;
    
    case 'reg':
      const regIndex = operand.value as number;
      if (regIndex === -1) return cpu.SP;
      if (regIndex === -2) return cpu.BP;
      if (regIndex < 0 || regIndex >= 8) {
        throw new Error(`Invalid register index: ${regIndex}`);
      }
      return cpu.R[regIndex];
    
    case 'mem':
      let addr: number;
      
      if (typeof operand.value === 'string') {
        // Label reference
        addr = labels[operand.value];
        if (addr === undefined) {
          throw new Error(`Undefined label: ${operand.value}`);
        }
      } else if (operand.indirect) {
        // Register indirect [Rk] or [Rk+offset]
        const regIndex = operand.value;
        const baseAddr = (regIndex === -1 ? cpu.SP : regIndex === -2 ? cpu.BP : cpu.R[regIndex]);
        addr = baseAddr + (operand.offset || 0);
      } else {
        // Absolute address
        addr = operand.value;
      }
      
      if (addr < 0 || addr >= RAM_SIZE - 3) {
        throw new Error(`Memory access out of bounds: ${addr} (valid range: 0-${RAM_SIZE-4})`);
      }
      
      return ram.getInt32(addr, true); // Little endian
    
    case 'label':
      const labelAddr = labels[operand.value as string];
      if (labelAddr === undefined) {
        throw new Error(`Undefined label: ${operand.value}`);
      }
      return labelAddr;
    
    default:
      throw new Error(`Invalid operand type: ${operand.type}`);
  }
}

/**
 * Set flags based on arithmetic result with proper overflow detection
 */
function setFlags(cpu: CPU, result: number, a?: number, b?: number, operation: 'add' | 'sub' | 'mul' | 'div' | 'cmp' | 'logic' = 'logic'): void {
  cpu.F.ZF = result === 0;
  cpu.F.NF = result < 0;
  
  // Carry and overflow flags for arithmetic operations
  if (operation === 'add' && a !== undefined && b !== undefined) {
    // Unsigned carry: result doesn't fit in 32 bits
    const unsignedResult = (a >>> 0) + (b >>> 0);
    cpu.F.CF = unsignedResult > 0xFFFFFFFF;
    
    // Signed overflow: signs of operands same but result sign different
    const signA = a < 0;
    const signB = b < 0;
    const signResult = result < 0;
    cpu.F.OF = (signA === signB) && (signA !== signResult);
  } else if (operation === 'sub' && a !== undefined && b !== undefined) {
    // Unsigned borrow
    cpu.F.CF = (a >>> 0) < (b >>> 0);
    
    // Signed overflow: different signs and result sign matches subtrahend
    const signA = a < 0;
    const signB = b < 0;
    const signResult = result < 0;
    cpu.F.OF = (signA !== signB) && (signB === signResult);
  } else if (operation === 'mul' && a !== undefined && b !== undefined) {
    // For multiplication, check if result fits in 32-bit signed range
    const product = BigInt(a) * BigInt(b);
    cpu.F.CF = product > 0x7FFFFFFFF || product < -0x800000000;
    cpu.F.OF = cpu.F.CF;
  } else {
    // For other operations, clear carry and overflow
    cpu.F.CF = false;
    cpu.F.OF = false;
  }
}

/**
 * Execute single instruction with comprehensive error handling
 */
export function step(cpu: CPU, program: Program, ram: DataView, hooks?: { onSys?: (syscall: number, cpu: CPU, ram: DataView) => string }): void {
  if (cpu.halted) {
    return;
  }
  
  if (cpu.IP < 0 || cpu.IP >= program.ast.length) {
    cpu.halted = true;
    return;
  }
  
  const instruction = program.ast[cpu.IP];
  const { op, operands } = instruction;
  
  try {
    switch (op) {
      case 'NOP':
        break;
      
      case 'HALT':
        cpu.halted = true;
        return;
      
      case 'MOV': {
        const src = operands[1].type === 'label' 
          ? program.labels[operands[1].value as string]
          : resolveOperand(operands[1], cpu, ram, program.labels);
        
        if (operands[0].type === 'reg') {
          const regIndex = operands[0].value as number;
          if (regIndex === -1) cpu.SP = src;
          else if (regIndex === -2) cpu.BP = src;
          else cpu.R[regIndex] = src;
        } else {
          throw new Error('MOV destination must be register');
        }
        break;
      }
      
      case 'LOAD': {
        const value = resolveOperand(operands[1], cpu, ram, program.labels);
        
        if (operands[0].type === 'reg') {
          const regIndex = operands[0].value as number;
          if (regIndex === -1) cpu.SP = value;
          else if (regIndex === -2) cpu.BP = value;
          else cpu.R[regIndex] = value;
        } else {
          throw new Error('LOAD destination must be register');
        }
        break;
      }
      
      case 'STORE': {
        const value = resolveOperand(operands[1], cpu, ram, program.labels);
        
        if (operands[0].type !== 'mem') {
          throw new Error('STORE destination must be memory reference');
        }
        
        let addr: number;
        if (typeof operands[0].value === 'string') {
          addr = program.labels[operands[0].value];
        } else if (operands[0].indirect) {
          const regIndex = operands[0].value;
          const baseAddr = (regIndex === -1 ? cpu.SP : regIndex === -2 ? cpu.BP : cpu.R[regIndex]);
          addr = baseAddr + (operands[0].offset || 0);
        } else {
          addr = operands[0].value;
        }
        
        if (addr < 0 || addr >= RAM_SIZE - 3) {
          throw new Error(`Memory store out of bounds: ${addr}`);
        }
        
        ram.setInt32(addr, value, true);
        break;
      }
      
      case 'LEA': {
        if (operands[0].type !== 'reg') {
          throw new Error('LEA destination must be register');
        }
        
        let addr: number;
        if (operands[1].type === 'label') {
          addr = program.labels[operands[1].value as string];
        } else if (operands[1].type === 'mem' && typeof operands[1].value === 'string') {
          addr = program.labels[operands[1].value];
        } else {
          addr = operands[1].value as number;
        }
        
        const regIndex = operands[0].value as number;
        if (regIndex === -1) cpu.SP = addr;
        else if (regIndex === -2) cpu.BP = addr;
        else cpu.R[regIndex] = addr;
        break;
      }
      
      case 'ADD': {
        const regIndex = operands[0].value as number;
        const a = regIndex === -1 ? cpu.SP : regIndex === -2 ? cpu.BP : cpu.R[regIndex];
        const b = resolveOperand(operands[1], cpu, ram, program.labels);
        const result = a + b;
        
        if (regIndex === -1) cpu.SP = result;
        else if (regIndex === -2) cpu.BP = result;
        else cpu.R[regIndex] = result;
        
        setFlags(cpu, result, a, b, 'add');
        break;
      }
      
      case 'SUB': {
        const regIndex = operands[0].value as number;
        const a = regIndex === -1 ? cpu.SP : regIndex === -2 ? cpu.BP : cpu.R[regIndex];
        const b = resolveOperand(operands[1], cpu, ram, program.labels);
        const result = a - b;
        
        if (regIndex === -1) cpu.SP = result;
        else if (regIndex === -2) cpu.BP = result;
        else cpu.R[regIndex] = result;
        
        setFlags(cpu, result, a, b, 'sub');
        break;
      }
      
      case 'MUL': {
        const regIndex = operands[0].value as number;
        const a = regIndex === -1 ? cpu.SP : regIndex === -2 ? cpu.BP : cpu.R[regIndex];
        const b = resolveOperand(operands[1], cpu, ram, program.labels);
        const result = Math.imul(a, b); // 32-bit signed multiplication
        
        if (regIndex === -1) cpu.SP = result;
        else if (regIndex === -2) cpu.BP = result;
        else cpu.R[regIndex] = result;
        
        setFlags(cpu, result, a, b, 'mul');
        break;
      }
      
      case 'DIV': {
        const b = resolveOperand(operands[1], cpu, ram, program.labels);
        
        if (b === 0) {
          cpu.F.CF = true;
          throw new Error('Division by zero');
        }
        
        const regIndex = operands[0].value as number;
        const a = regIndex === -1 ? cpu.SP : regIndex === -2 ? cpu.BP : cpu.R[regIndex];
        const result = Math.trunc(a / b); // Truncate towards zero
        
        if (regIndex === -1) cpu.SP = result;
        else if (regIndex === -2) cpu.BP = result;
        else cpu.R[regIndex] = result;
        
        setFlags(cpu, result, a, b, 'div');
        break;
      }
      
      case 'INC': {
        const regIndex = operands[0].value as number;
        const current = regIndex === -1 ? cpu.SP : regIndex === -2 ? cpu.BP : cpu.R[regIndex];
        const result = current + 1;
        
        if (regIndex === -1) cpu.SP = result;
        else if (regIndex === -2) cpu.BP = result;
        else cpu.R[regIndex] = result;
        
        setFlags(cpu, result, current, 1, 'add');
        break;
      }
      
      case 'DEC': {
        const regIndex = operands[0].value as number;
        const current = regIndex === -1 ? cpu.SP : regIndex === -2 ? cpu.BP : cpu.R[regIndex];
        const result = current - 1;
        
        if (regIndex === -1) cpu.SP = result;
        else if (regIndex === -2) cpu.BP = result;
        else cpu.R[regIndex] = result;
        
        setFlags(cpu, result, current, 1, 'sub');
        break;
      }
      
      case 'AND': {
        const regIndex = operands[0].value as number;
        const a = regIndex === -1 ? cpu.SP : regIndex === -2 ? cpu.BP : cpu.R[regIndex];
        const b = resolveOperand(operands[1], cpu, ram, program.labels);
        const result = a & b;
        
        if (regIndex === -1) cpu.SP = result;
        else if (regIndex === -2) cpu.BP = result;
        else cpu.R[regIndex] = result;
        
        setFlags(cpu, result);
        break;
      }
      
      case 'OR': {
        const regIndex = operands[0].value as number;
        const a = regIndex === -1 ? cpu.SP : regIndex === -2 ? cpu.BP : cpu.R[regIndex];
        const b = resolveOperand(operands[1], cpu, ram, program.labels);
        const result = a | b;
        
        if (regIndex === -1) cpu.SP = result;
        else if (regIndex === -2) cpu.BP = result;
        else cpu.R[regIndex] = result;
        
        setFlags(cpu, result);
        break;
      }
      
      case 'XOR': {
        const regIndex = operands[0].value as number;
        const a = regIndex === -1 ? cpu.SP : regIndex === -2 ? cpu.BP : cpu.R[regIndex];
        const b = resolveOperand(operands[1], cpu, ram, program.labels);
        const result = a ^ b;
        
        if (regIndex === -1) cpu.SP = result;
        else if (regIndex === -2) cpu.BP = result;
        else cpu.R[regIndex] = result;
        
        setFlags(cpu, result);
        break;
      }
      
      case 'NOT': {
        const regIndex = operands[0].value as number;
        const current = regIndex === -1 ? cpu.SP : regIndex === -2 ? cpu.BP : cpu.R[regIndex];
        const result = ~current;
        
        if (regIndex === -1) cpu.SP = result;
        else if (regIndex === -2) cpu.BP = result;
        else cpu.R[regIndex] = result;
        
        setFlags(cpu, result);
        break;
      }
      
      case 'SHL': {
        const regIndex = operands[0].value as number;
        const current = regIndex === -1 ? cpu.SP : regIndex === -2 ? cpu.BP : cpu.R[regIndex];
        const shift = resolveOperand(operands[1], cpu, ram, program.labels);
        
        if (shift < 0 || shift > 31) {
          throw new Error(`Invalid shift amount: ${shift} (must be 0-31)`);
        }
        
        const result = current << shift;
        
        if (regIndex === -1) cpu.SP = result;
        else if (regIndex === -2) cpu.BP = result;
        else cpu.R[regIndex] = result;
        
        // Set carry to last bit shifted out
        cpu.F.CF = shift > 0 && ((current >>> (32 - shift)) & 1) === 1;
        setFlags(cpu, result);
        break;
      }
      
      case 'SHR': {
        const regIndex = operands[0].value as number;
        const current = regIndex === -1 ? cpu.SP : regIndex === -2 ? cpu.BP : cpu.R[regIndex];
        const shift = resolveOperand(operands[1], cpu, ram, program.labels);
        
        if (shift < 0 || shift > 31) {
          throw new Error(`Invalid shift amount: ${shift} (must be 0-31)`);
        }
        
        const result = current >>> shift; // Logical right shift
        
        if (regIndex === -1) cpu.SP = result;
        else if (regIndex === -2) cpu.BP = result;
        else cpu.R[regIndex] = result;
        
        // Set carry to last bit shifted out
        cpu.F.CF = shift > 0 && ((current >>> (shift - 1)) & 1) === 1;
        setFlags(cpu, result);
        break;
      }
      
      case 'CMP': {
        const a = resolveOperand(operands[0], cpu, ram, program.labels);
        const b = resolveOperand(operands[1], cpu, ram, program.labels);
        const result = a - b;
        setFlags(cpu, result, a, b, 'cmp');
        break;
      }
      
      case 'JMP': {
        const target = resolveOperand(operands[0], cpu, ram, program.labels);
        if (target < 0 || target >= program.ast.length) {
          throw new Error(`Jump target out of bounds: ${target}`);
        }
        cpu.IP = target;
        return; // Don't increment IP
      }
      
      case 'JZ':
        if (cpu.F.ZF) {
          const target = resolveOperand(operands[0], cpu, ram, program.labels);
          cpu.IP = target;
          return;
        }
        break;
      
      case 'JNZ':
        if (!cpu.F.ZF) {
          const target = resolveOperand(operands[0], cpu, ram, program.labels);
          cpu.IP = target;
          return;
        }
        break;
      
      case 'JC':
        if (cpu.F.CF) {
          const target = resolveOperand(operands[0], cpu, ram, program.labels);
          cpu.IP = target;
          return;
        }
        break;
      
      case 'JNC':
        if (!cpu.F.CF) {
          const target = resolveOperand(operands[0], cpu, ram, program.labels);
          cpu.IP = target;
          return;
        }
        break;
      
      case 'JN':
        if (cpu.F.NF) {
          const target = resolveOperand(operands[0], cpu, ram, program.labels);
          cpu.IP = target;
          return;
        }
        break;
      
      case 'JNN':
        if (!cpu.F.NF) {
          const target = resolveOperand(operands[0], cpu, ram, program.labels);
          cpu.IP = target;
          return;
        }
        break;
      
      case 'JG':
        if (!cpu.F.ZF && cpu.F.NF === cpu.F.OF) {
          const target = resolveOperand(operands[0], cpu, ram, program.labels);
          cpu.IP = target;
          return;
        }
        break;
      
      case 'JGE':
        if (cpu.F.NF === cpu.F.OF) {
          const target = resolveOperand(operands[0], cpu, ram, program.labels);
          cpu.IP = target;
          return;
        }
        break;
      
      case 'JL':
        if (cpu.F.NF !== cpu.F.OF) {
          const target = resolveOperand(operands[0], cpu, ram, program.labels);
          cpu.IP = target;
          return;
        }
        break;
      
      case 'JLE':
        if (cpu.F.ZF || cpu.F.NF !== cpu.F.OF) {
          const target = resolveOperand(operands[0], cpu, ram, program.labels);
          cpu.IP = target;
          return;
        }
        break;
      
      case 'PUSH': {
        const value = resolveOperand(operands[0], cpu, ram, program.labels);
        cpu.SP -= 4;
        if (cpu.SP < 0) {
          throw new Error('Stack overflow');
        }
        ram.setInt32(cpu.SP, value, true);
        break;
      }
      
      case 'POP': {
        if (cpu.SP >= RAM_SIZE - 4) {
          throw new Error('Stack underflow');
        }
        const value = ram.getInt32(cpu.SP, true);
        cpu.SP += 4;
        
        if (operands[0].type === 'reg') {
          const regIndex = operands[0].value as number;
          if (regIndex === -1) cpu.SP = value;
          else if (regIndex === -2) cpu.BP = value;
          else cpu.R[regIndex] = value;
        } else {
          throw new Error('POP destination must be register');
        }
        break;
      }
      
      case 'CALL': {
        const target = resolveOperand(operands[0], cpu, ram, program.labels);
        
        if (target < 0 || target >= program.ast.length) {
          throw new Error(`Call target out of bounds: ${target}`);
        }
        
        // Push return address
        cpu.SP -= 4;
        if (cpu.SP < 0) {
          throw new Error('Stack overflow on CALL');
        }
        ram.setInt32(cpu.SP, cpu.IP + 1, true);
        
        cpu.IP = target;
        return; // Don't increment IP
      }
      
      case 'RET': {
        if (cpu.SP >= RAM_SIZE - 4) {
          throw new Error('Stack underflow on RET');
        }
        const returnAddr = ram.getInt32(cpu.SP, true);
        cpu.SP += 4;
        
        if (returnAddr < 0 || returnAddr >= program.ast.length) {
          throw new Error(`Invalid return address: ${returnAddr}`);
        }
        
        cpu.IP = returnAddr;
        return; // Don't increment IP
      }
      
      case 'SYS': {
        const syscall = resolveOperand(operands[0], cpu, ram, program.labels);
        
        if (hooks?.onSys) {
          hooks.onSys(syscall, cpu, ram);
        }
        
        switch (syscall) {
          case 1: // PRINT_INT R0
            break; // Handled by hook
          case 2: // PRINT_STR [R1]
            break; // Handled by hook
          case 3: // EXIT with code in R0
            cpu.halted = true;
            break;
          default:
            throw new Error(`Unknown syscall: ${syscall}`);
        }
        break;
      }
      
      default:
        throw new Error(`Unimplemented instruction: ${op}`);
    }
    
    cpu.IP++;
    
  } catch (error) {
    throw new AsmError(instruction.line, error instanceof Error ? error.message : String(error));
  }
}

/**
 * Run program with breakpoints and step limits
 */
export function run(
  cpu: CPU, 
  program: Program, 
  ram: DataView, 
  opts: {
    maxSteps?: number;
    breakpoints?: Set<number>;
    onSys?: (syscall: number, cpu: CPU, ram: DataView) => string;
  } = {}
): { steps: number; halted: boolean; hitBreakpoint: boolean } {
  const { maxSteps = 10000, breakpoints = new Set(), onSys } = opts;
  let steps = 0;
  let hitBreakpoint = false;
  
  while (!cpu.halted && steps < maxSteps) {
    // Check breakpoint before executing
    if (breakpoints.has(cpu.IP)) {
      hitBreakpoint = true;
      break;
    }
    
    step(cpu, program, ram, { onSys });
    steps++;
  }
  
  return { steps, halted: cpu.halted, hitBreakpoint };
}