/**
 * Position utilities for debugger line awareness
 * Centralizes 0/1-based conversions and source mapping
 */

export interface Position {
  line: number;
  column: number;
}

export interface Range {
  start: Position;
  end: Position;
}

/**
 * Convert between 0-based and 1-based line numbers
 */
export function toZeroBased(line: number): number {
  return Math.max(0, line - 1);
}

export function toOneBased(line: number): number {
  return line + 1;
}

/**
 * Normalize line endings (CRLF -> LF)
 */
export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Convert offset to line/column position
 */
export function offsetToPosition(text: string, offset: number): Position {
  const normalized = normalizeLineEndings(text);
  const lines = normalized.slice(0, offset).split('\n');
  
  return {
    line: lines.length - 1,
    column: lines[lines.length - 1].length
  };
}

/**
 * Convert line/column position to offset
 */
export function positionToOffset(text: string, position: Position): number {
  const normalized = normalizeLineEndings(text);
  const lines = normalized.split('\n');
  
  let offset = 0;
  for (let i = 0; i < position.line && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 for newline
  }
  
  return offset + Math.min(position.column, lines[position.line]?.length || 0);
}

/**
 * Find executable lines in assembly source
 */
export function findExecutableLines(source: string): Set<number> {
  const executableLines = new Set<number>();
  const lines = normalizeLineEndings(source).split('\n');
  
  let inTextSection = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNumber = i + 1; // 1-based
    
    // Skip empty lines and comments
    if (!line || line.startsWith(';') || line.startsWith('//')) {
      continue;
    }
    
    // Check for section directives
    if (line.startsWith('.TEXT')) {
      inTextSection = true;
      continue;
    }
    
    if (line.startsWith('.DATA')) {
      inTextSection = false;
      continue;
    }
    
    // Skip other directives
    if (line.startsWith('.')) {
      continue;
    }
    
    // Only instructions in .TEXT section are executable
    if (inTextSection) {
      // Handle labels with instructions on same line
      if (line.includes(':')) {
        const afterColon = line.split(':')[1]?.trim();
        if (afterColon && !afterColon.startsWith(';') && !afterColon.startsWith('//')) {
          executableLines.add(lineNumber);
        }
      } else {
        // Regular instruction
        executableLines.add(lineNumber);
      }
    }
  }
  
  return executableLines;
}

/**
 * Snap breakpoint to nearest executable line
 */
export function snapToExecutableLine(
  targetLine: number, 
  executableLines: Set<number>
): { line: number; snapped: boolean } {
  if (executableLines.has(targetLine)) {
    return { line: targetLine, snapped: false };
  }
  
  // Find nearest executable line (prefer forward)
  for (let offset = 1; offset <= 10; offset++) {
    const forward = targetLine + offset;
    const backward = targetLine - offset;
    
    if (executableLines.has(forward)) {
      return { line: forward, snapped: true };
    }
    
    if (backward > 0 && executableLines.has(backward)) {
      return { line: backward, snapped: true };
    }
  }
  
  // Fallback to first executable line
  const firstExecutable = Math.min(...Array.from(executableLines));
  return { line: firstExecutable, snapped: true };
}