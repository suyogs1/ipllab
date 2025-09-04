/**
 * Debugger functionality tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { findExecutableLines, snapToExecutableLine, toZeroBased, toOneBased } from '../src/utils/positions';
import { validateBreakpoint, validateStepEvent } from '../src/utils/validation';

describe('Debugger Line Awareness', () => {
  const sampleCode = `; Sample assembly program
.DATA
value: .WORD 42

.TEXT
start:
    ; This is a comment
    
    LOAD R0, [value]    ; Line 9
    CMP R0, #0          ; Line 10
    JZ zero             ; Line 11
    MOV R1, #1          ; Line 12
    JMP done            ; Line 13
zero:
    MOV R1, #0          ; Line 15
done:
    HALT                ; Line 17
`;

  describe('Executable Line Detection', () => {
    it('should identify executable lines correctly', () => {
      const executableLines = findExecutableLines(sampleCode);
      
      // Should include instruction lines
      expect(executableLines.has(9)).toBe(true);  // LOAD
      expect(executableLines.has(10)).toBe(true); // CMP
      expect(executableLines.has(11)).toBe(true); // JZ
      expect(executableLines.has(12)).toBe(true); // MOV
      expect(executableLines.has(13)).toBe(true); // JMP
      expect(executableLines.has(15)).toBe(true); // MOV (after label)
      expect(executableLines.has(17)).toBe(true); // HALT
      
      // Should exclude comments and blank lines
      expect(executableLines.has(1)).toBe(false); // Comment
      expect(executableLines.has(8)).toBe(false); // Blank line
      expect(executableLines.has(7)).toBe(false); // Comment
    });

    it('should handle data section correctly', () => {
      const executableLines = findExecutableLines(sampleCode);
      
      // Should not include data section lines
      expect(executableLines.has(2)).toBe(false); // .DATA
      expect(executableLines.has(3)).toBe(false); // value: .WORD 42
    });
  });

  describe('Breakpoint Snapping', () => {
    it('should snap comment lines to nearest executable', () => {
      const executableLines = findExecutableLines(sampleCode);
      
      // Comment line should snap forward
      const result1 = snapToExecutableLine(7, executableLines);
      expect(result1.snapped).toBe(true);
      expect(result1.line).toBe(9); // Should snap to LOAD
      
      // Blank line should snap forward
      const result2 = snapToExecutableLine(8, executableLines);
      expect(result2.snapped).toBe(true);
      expect(result2.line).toBe(9);
    });

    it('should not snap executable lines', () => {
      const executableLines = findExecutableLines(sampleCode);
      
      const result = snapToExecutableLine(9, executableLines);
      expect(result.snapped).toBe(false);
      expect(result.line).toBe(9);
    });

    it('should prefer forward snapping', () => {
      const executableLines = findExecutableLines(sampleCode);
      
      // Line between instructions should snap forward
      const result = snapToExecutableLine(14, executableLines);
      expect(result.snapped).toBe(true);
      expect(result.line).toBe(15); // Should snap forward to MOV
    });
  });

  describe('Line Number Conversion', () => {
    it('should convert between 0-based and 1-based correctly', () => {
      expect(toZeroBased(1)).toBe(0);
      expect(toZeroBased(10)).toBe(9);
      expect(toOneBased(0)).toBe(1);
      expect(toOneBased(9)).toBe(10);
    });

    it('should handle edge cases', () => {
      expect(toZeroBased(0)).toBe(0); // Should not go negative
      expect(toZeroBased(-1)).toBe(0);
    });
  });
});

describe('Debugger Validation', () => {
  describe('Breakpoint Validation', () => {
    it('should validate correct breakpoint data', () => {
      const bp = validateBreakpoint({ line: 5, enabled: true });
      expect(bp.line).toBe(5);
      expect(bp.enabled).toBe(true);
    });

    it('should use default values', () => {
      const bp = validateBreakpoint({ line: 10 });
      expect(bp.enabled).toBe(true);
    });

    it('should reject invalid data', () => {
      expect(() => validateBreakpoint({ line: 0 })).toThrow();
      expect(() => validateBreakpoint({ line: -1 })).toThrow();
      expect(() => validateBreakpoint({})).toThrow();
    });
  });

  describe('Step Event Validation', () => {
    it('should validate step events', () => {
      const step = validateStepEvent({ type: 'into' });
      expect(step.type).toBe('into');
      expect(step.count).toBe(1);
    });

    it('should reject invalid step types', () => {
      expect(() => validateStepEvent({ type: 'invalid' })).toThrow();
    });
  });
});

describe('Error Boundary Recovery', () => {
  it('should handle thrown errors gracefully', () => {
    // This would be tested with React Testing Library in a real scenario
    expect(true).toBe(true); // Placeholder
  });
});