// Memory utilities for EduASM with 64KB address space

export const RAM_SIZE = 65536; // 64KB memory

/**
 * Create RAM with DataView for efficient access
 */
export function createRAM(size: number = RAM_SIZE): DataView {
  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);
  
  // Initialize with zeros
  for (let i = 0; i < size; i++) {
    view.setUint8(i, 0);
  }
  
  return view;
}

/**
 * Format number as hex with padding
 */
export function toHex(value: number, padding: number = 8): string {
  const hex = Math.abs(value).toString(16).toUpperCase().padStart(padding, '0');
  return (value < 0 ? '-0x' : '0x') + hex;
}

/**
 * Format byte as 2-digit hex
 */
export function toHex8(value: number): string {
  return (value & 0xFF).toString(16).toUpperCase().padStart(2, '0');
}

/**
 * Check if address is within bounds
 */
export function checkBounds(addr: number, size: number = 4, ramSize: number = RAM_SIZE): void {
  if (addr < 0 || addr + size > ramSize) {
    throw new Error(`Memory access out of bounds: ${toHex(addr)} (size ${size}, RAM size ${ramSize})`);
  }
}

/**
 * Get memory dump as formatted hex strings with ASCII
 */
export function getMemoryDump(ram: DataView, start: number = 0, length: number = 256): string[] {
  const lines: string[] = [];
  const bytesPerLine = 16;
  const endAddr = Math.min(start + length, ram.byteLength);
  
  for (let addr = start; addr < endAddr; addr += bytesPerLine) {
    let line = toHex(addr, 4) + ': ';
    let ascii = '';
    
    // Hex bytes
    for (let j = 0; j < bytesPerLine; j++) {
      if (addr + j < endAddr) {
        const byte = ram.getUint8(addr + j);
        line += toHex8(byte) + ' ';
        ascii += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
      } else {
        line += '   '; // Padding for incomplete lines
        ascii += ' ';
      }
    }
    
    line += ' |' + ascii + '|';
    lines.push(line);
  }
  
  return lines;
}

/**
 * Get stack view (top N words from SP)
 */
export function getStackView(ram: DataView, sp: number, count: number = 16): Array<{addr: number, value: number}> {
  const stack: Array<{addr: number, value: number}> = [];
  
  for (let i = 0; i < count; i++) {
    const addr = sp + (i * 4);
    if (addr >= ram.byteLength) break;
    
    try {
      const value = ram.getInt32(addr, true);
      stack.push({ addr, value });
    } catch {
      break; // Stop on invalid access
    }
  }
  
  return stack;
}

/**
 * Write string to memory with null termination
 */
export function writeString(ram: DataView, addr: number, str: string): void {
  checkBounds(addr, str.length + 1);
  
  for (let i = 0; i < str.length; i++) {
    ram.setUint8(addr + i, str.charCodeAt(i) & 0xFF);
  }
  ram.setUint8(addr + str.length, 0); // Null terminator
}

/**
 * Read null-terminated string from memory
 */
export function readString(ram: DataView, addr: number, maxLength: number = 256): string {
  checkBounds(addr, 1);
  
  let str = '';
  for (let i = 0; i < maxLength && addr + i < ram.byteLength; i++) {
    const byte = ram.getUint8(addr + i);
    if (byte === 0) break;
    str += String.fromCharCode(byte);
  }
  
  return str;
}

/**
 * Safe memory access with bounds checking
 */
export function safeMemoryAccess<T>(
  ram: DataView, 
  addr: number, 
  operation: 'read' | 'write',
  size: number,
  accessor: () => T
): T {
  checkBounds(addr, size);
  return accessor();
}