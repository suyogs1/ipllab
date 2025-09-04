import { describe, it, expect, beforeEach } from 'vitest';
import { assemble, reset, step, run, AsmError } from '../runners/asmEngine';
import { createRAM } from '../utils/memory';

describe('Assembly Engine', () => {
  let cpu: any;
  let ram: DataView;

  beforeEach(() => {
    cpu = reset();
    ram = createRAM();
  });

  describe('CPU Reset', () => {
    it('should initialize CPU with correct default values', () => {
      expect(cpu.R).toHaveLength(8);
      expect(cpu.R.every((r: number) => r === 0)).toBe(true);
      expect(cpu.SP).toBe(4092); // RAM_SIZE - 4
      expect(cpu.BP).toBe(4092);
      expect(cpu.IP).toBe(0);
      expect(cpu.halted).toBe(false);
      expect(cpu.F).toEqual({ ZF: false, NF: false, CF: false, OF: false });
    });
  });

  describe('Assembler', () => {
    it('should assemble simple MOV instruction', () => {
      const source = `
.TEXT
    MOV R0, #42
    HALT
      `;
      
      const program = assemble(source);
      expect(program.ast).toHaveLength(2);
      expect(program.ast[0].op).toBe('MOV');
      expect(program.ast[0].operands).toHaveLength(2);
      expect(program.ast[1].op).toBe('HALT');
    });

    it('should handle labels correctly', () => {
      const source = `
.TEXT
start:
    MOV R0, #10
    JMP start
      `;
      
      const program = assemble(source);
      expect(program.labels.start).toBe(0);
      expect(program.ast[1].operands[0].type).toBe('label');
    });

    it('should handle data section', () => {
      const source = `
.DATA
numbers: .WORD 1, 2, 3
.TEXT
    LEA R0, numbers
    HALT
      `;
      
      const program = assemble(source);
      expect(program.labels.numbers).toBe(0);
      expect(program.dataSection[0]).toBe(1); // Little endian
      expect(program.dataSection[4]).toBe(2);
      expect(program.dataSection[8]).toBe(3);
    });

    it('should throw error for invalid syntax', () => {
      const source = `
.TEXT
    INVALID_OP R0, #42
      `;
      
      expect(() => assemble(source)).toThrow(AsmError);
    });

    it('should throw error for undefined label', () => {
      const source = `
.TEXT
    JMP undefined_label
      `;
      
      expect(() => assemble(source)).toThrow(AsmError);
    });
  });

  describe('Instruction Execution', () => {
    it('should execute MOV instruction correctly', () => {
      const program = assemble(`
.TEXT
    MOV R0, #42
    HALT
      `);
      
      step(cpu, program, ram);
      expect(cpu.R[0]).toBe(42);
      expect(cpu.IP).toBe(1);
    });

    it('should execute ADD instruction and set flags', () => {
      const program = assemble(`
.TEXT
    MOV R0, #10
    ADD R0, #5
    HALT
      `);
      
      step(cpu, program, ram); // MOV
      step(cpu, program, ram); // ADD
      
      expect(cpu.R[0]).toBe(15);
      expect(cpu.F.ZF).toBe(false);
      expect(cpu.F.NF).toBe(false);
    });

    it('should set zero flag correctly', () => {
      const program = assemble(`
.TEXT
    MOV R0, #5
    SUB R0, #5
    HALT
      `);
      
      step(cpu, program, ram); // MOV
      step(cpu, program, ram); // SUB
      
      expect(cpu.R[0]).toBe(0);
      expect(cpu.F.ZF).toBe(true);
    });

    it('should set negative flag correctly', () => {
      const program = assemble(`
.TEXT
    MOV R0, #5
    SUB R0, #10
    HALT
      `);
      
      step(cpu, program, ram); // MOV
      step(cpu, program, ram); // SUB
      
      expect(cpu.R[0]).toBe(-5);
      expect(cpu.F.NF).toBe(true);
    });

    it('should handle conditional jumps', () => {
      const program = assemble(`
.TEXT
    MOV R0, #0
    CMP R0, #0
    JZ target
    MOV R1, #999
target:
    MOV R1, #42
    HALT
      `);
      
      step(cpu, program, ram); // MOV R0, #0
      step(cpu, program, ram); // CMP R0, #0
      step(cpu, program, ram); // JZ target
      
      expect(cpu.IP).toBe(4); // Should jump to target
      
      step(cpu, program, ram); // MOV R1, #42
      expect(cpu.R[1]).toBe(42);
    });

    it('should handle stack operations', () => {
      const program = assemble(`
.TEXT
    MOV R0, #42
    PUSH R0
    MOV R0, #0
    POP R1
    HALT
      `);
      
      const initialSP = cpu.SP;
      
      step(cpu, program, ram); // MOV R0, #42
      step(cpu, program, ram); // PUSH R0
      
      expect(cpu.SP).toBe(initialSP - 4);
      
      step(cpu, program, ram); // MOV R0, #0
      step(cpu, program, ram); // POP R1
      
      expect(cpu.R[1]).toBe(42);
      expect(cpu.SP).toBe(initialSP);
    });

    it('should handle function calls', () => {
      const program = assemble(`
.TEXT
start:
    MOV R0, #5
    CALL func
    HALT
func:
    ADD R0, #10
    RET
      `);
      
      const initialSP = cpu.SP;
      
      step(cpu, program, ram); // MOV R0, #5
      step(cpu, program, ram); // CALL func
      
      expect(cpu.IP).toBe(3); // Should jump to func
      expect(cpu.SP).toBe(initialSP - 4); // Return address pushed
      
      step(cpu, program, ram); // ADD R0, #10
      expect(cpu.R[0]).toBe(15);
      
      step(cpu, program, ram); // RET
      expect(cpu.IP).toBe(2); // Should return to after CALL
      expect(cpu.SP).toBe(initialSP); // Stack restored
    });
  });

  describe('Memory Operations', () => {
    it('should handle LOAD and STORE', () => {
      const program = assemble(`
.DATA
value: .WORD 123
.TEXT
    LOAD R0, [value]
    ADD R0, #1
    STORE [value], R0
    HALT
      `);
      
      step(cpu, program, ram); // LOAD R0, [value]
      expect(cpu.R[0]).toBe(123);
      
      step(cpu, program, ram); // ADD R0, #1
      expect(cpu.R[0]).toBe(124);
      
      step(cpu, program, ram); // STORE [value], R0
      
      // Verify memory was updated
      const storedValue = ram.getInt32(0, true);
      expect(storedValue).toBe(124);
    });

    it('should handle register indirect addressing', () => {
      const program = assemble(`
.DATA
array: .WORD 10, 20, 30
.TEXT
    LEA R1, array
    LOAD R0, [R1]
    ADD R1, #4
    LOAD R2, [R1]
    HALT
      `);
      
      step(cpu, program, ram); // LEA R1, array
      expect(cpu.R[1]).toBe(0); // Address of array
      
      step(cpu, program, ram); // LOAD R0, [R1]
      expect(cpu.R[0]).toBe(10);
      
      step(cpu, program, ram); // ADD R1, #4
      expect(cpu.R[1]).toBe(4);
      
      step(cpu, program, ram); // LOAD R2, [R1]
      expect(cpu.R[2]).toBe(20);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for division by zero', () => {
      const program = assemble(`
.TEXT
    MOV R0, #10
    DIV R0, #0
    HALT
      `);
      
      step(cpu, program, ram); // MOV R0, #10
      
      expect(() => step(cpu, program, ram)).toThrow('Division by zero');
      expect(cpu.F.CF).toBe(true);
    });

    it('should throw error for stack overflow', () => {
      const program = assemble(`
.TEXT
    MOV R0, #42
overflow_loop:
    PUSH R0
    JMP overflow_loop
      `);
      
      step(cpu, program, ram); // MOV R0, #42
      
      // Push until stack overflow
      let steps = 0;
      try {
        while (steps < 2000) { // Prevent infinite loop in test
          step(cpu, program, ram);
          steps++;
        }
        expect.fail('Should have thrown stack overflow error');
      } catch (error) {
        expect(error).toBeInstanceOf(AsmError);
        expect((error as AsmError).message).toContain('Stack overflow');
      }
    });

    it('should throw error for out of bounds memory access', () => {
      const program = assemble(`
.TEXT
    LOAD R0, [9999]
    HALT
      `);
      
      expect(() => step(cpu, program, ram)).toThrow('Memory access out of bounds');
    });
  });

  describe('Run Function', () => {
    it('should run program to completion', () => {
      const program = assemble(`
.TEXT
    MOV R0, #0
    MOV R1, #5
loop:
    ADD R0, R1
    DEC R1
    JNZ loop
    HALT
      `);
      
      const result = run(cpu, program, ram, { maxSteps: 1000 });
      
      expect(cpu.halted).toBe(true);
      expect(cpu.R[0]).toBe(15); // 5+4+3+2+1
      expect(result.steps).toBeGreaterThan(0);
    });

    it('should respect breakpoints', () => {
      const program = assemble(`
.TEXT
    MOV R0, #1
    MOV R1, #2
    ADD R0, R1
    HALT
      `);
      
      const breakpoints = new Set([2]); // Break at ADD instruction
      const result = run(cpu, program, ram, { breakpoints });
      
      expect(cpu.IP).toBe(2);
      expect(result.hitBreakpoint).toBe(true);
      expect(cpu.halted).toBe(false);
    });

    it('should respect step limits', () => {
      const program = assemble(`
.TEXT
loop:
    JMP loop
      `);
      
      const result = run(cpu, program, ram, { maxSteps: 100 });
      
      expect(result.steps).toBe(100);
      expect(cpu.halted).toBe(false);
    });
  });
});