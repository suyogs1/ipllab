# IPL Lab — Assembler by MZAP

IPL Lab (Initial Program Loader for your brain) is an interactive web-based platform for learning assembly programming using EduASM, a simplified educational instruction set architecture.

## Features

### 🎓 Learn Tab
- Interactive lessons covering EduASM fundamentals
- Step-by-step tutorials with code examples
- Progress tracking and completion status
- "Open in Debugger" functionality for hands-on practice

### 🔧 Debug Tab
- Full-featured assembly debugger
- Monaco editor with EduASM syntax highlighting
- Real-time register and memory visualization
- Breakpoint support with visual indicators
- Console output for system calls
- Sample programs included

## EduASM Instruction Set

### Registers
- **R0-R7**: General purpose registers (32-bit)
- **SP**: Stack Pointer
- **BP**: Base Pointer  
- **IP**: Instruction Pointer

### Flags
- **ZF**: Zero Flag
- **NF**: Negative Flag
- **CF**: Carry Flag
- **OF**: Overflow Flag

### Memory
- 64KB address space (0x0000 to 0xFFFF)
- Little-endian byte order
- Stack grows downward from high addresses

### Instructions

#### Data Movement
- `MOV dst, src` - Move data
- `LOAD dst, [src]` - Load from memory
- `STORE [dst], src` - Store to memory
- `LEA dst, addr` - Load effective address

#### Arithmetic
- `ADD dst, src` - Addition
- `SUB dst, src` - Subtraction
- `MUL dst, src` - Multiplication
- `DIV dst, src` - Division
- `INC reg` - Increment
- `DEC reg` - Decrement

#### Bitwise/Logic
- `AND dst, src` - Bitwise AND
- `OR dst, src` - Bitwise OR
- `XOR dst, src` - Bitwise XOR
- `NOT reg` - Bitwise NOT
- `SHL dst, count` - Shift left
- `SHR dst, count` - Shift right

#### Control Flow
- `CMP op1, op2` - Compare
- `JMP addr` - Unconditional jump
- `JZ addr` - Jump if zero
- `JNZ addr` - Jump if not zero
- `JC addr` - Jump if carry
- `JNC addr` - Jump if no carry
- `JG addr` - Jump if greater
- `JGE addr` - Jump if greater or equal
- `JL addr` - Jump if less
- `JLE addr` - Jump if less or equal

#### Stack/Functions
- `PUSH src` - Push to stack
- `POP dst` - Pop from stack
- `CALL addr` - Function call
- `RET` - Return from function

#### System
- `NOP` - No operation
- `HALT` - Stop execution
- `SYS #n` - System call
  - `SYS #1` - Print integer in R0
  - `SYS #2` - Print string at address in R1
  - `SYS #3` - Exit with code in R0

### Addressing Modes
- **Immediate**: `#value` - Use value directly
- **Register**: `R0` - Use register contents
- **Direct**: `[address]` - Memory at address
- **Indirect**: `[R0]` - Memory at address in register
- **Indexed**: `[R0+offset]` - Memory at register + offset

### Directives
- `.ORG addr` - Set assembly address
- `.DATA` - Start data section
- `.TEXT` - Start code section
- `.BYTE value, ...` - Define bytes
- `.WORD value, ...` - Define 32-bit words
- `.STRING "text"` - Define null-terminated string

## Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup
```bash
npm install
npm run dev
```

### Standalone Debugger

The debugger can be used independently of the learning platform:

```bash
# Run standalone debugger
npm run dev:debugger

# Test debugger functionality  
npm run test:debugger

# Run smoke tests
npm run smoke:debugger
```

#### Embedding the Debugger

```tsx
import { DebuggerStandalone } from '@ipl/debugger';

<DebuggerStandalone 
  initialFile="examples/hello.asm"
  theme="system"
  readonly={false}
  initialBreakpoints={[{ path: 'main.asm', line: 5 }]}
/>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialFile` | `string` | - | Load example file on mount |
| `readonly` | `boolean` | `false` | Disable code editing |
| `theme` | `'light'\|'dark'\|'system'` | `'dark'` | Editor theme |
| `initialBreakpoints` | `Array<{path:string; line:number}>` | `[]` | Set breakpoints on load |

#### Features

- **Line Awareness**: Breakpoints snap to executable lines automatically
- **Resizable Layout**: Dock right, bottom, or fullscreen with persistent preferences
- **Keyboard Shortcuts**: F9 (breakpoint), F10 (step over), F11 (step into)
- **Error Recovery**: Robust error boundaries with reset functionality
- **Source Mapping**: Accurate line mapping between editor and runtime

### Build
```bash
npm run build
```

### Technologies
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Monaco Editor** - Code editor
- **Web Workers** - Off-main-thread execution

## Architecture

### Performance Optimizations
- Monaco editor lazy-loaded
- Code execution in Web Workers
- Component code-splitting
- Efficient memory visualization
- Debounced localStorage saves

### Accessibility
- Keyboard shortcuts (F9, F10, F11, Ctrl+Enter)
- High contrast mode support
- Screen reader friendly
- Large touch targets for mobile

### Mobile Support
- Responsive design
- Touch-friendly controls
- Collapsible panels
- Optimized for small screens

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Roadmap

- [ ] Complete Web Worker implementation
- [ ] Advanced debugging features
- [ ] More interactive lessons
- [ ] Challenge system with grading
- [ ] Export/import programs
- [ ] Collaborative features
- [ ] Performance profiling tools