# Manual Test: Debugger Bridge Implementation

## Test Cases

### 1. Basic Bridge Functionality
1. Start the development server: `npm run dev`
2. Navigate to the Learn tab (should be default)
3. Wait for lessons to load
4. Click on the first lesson
5. Click the "Debug" button on a code snippet
6. **Expected**: Should navigate to Debugger tab with code loaded

### 2. Challenge Bridge
1. In Learn tab, click "Challenges" subtab
2. Click on a challenge
3. Click the "Debug" button
4. **Expected**: Should navigate to Debugger tab with challenge code and breakpoints

### 3. Persistence Test
1. Load code in debugger using steps above
2. Reload the page (F5)
3. Navigate to Debugger tab
4. **Expected**: Code should still be loaded from sessionStorage

### 4. Toast Notification
1. Load code in debugger using steps above
2. **Expected**: Should see toast notification "Loaded in Debugger"

### 5. Breakpoints and Watches
1. Load lesson code in debugger
2. **Expected**: Should see at least one breakpoint indicator
3. Click on "Watches" tab in debugger
4. **Expected**: Should see watch expressions if any were set

### 6. No Blank Screen
1. Load code in debugger
2. Click in the code editor
3. Type some text
4. **Expected**: Editor should remain functional, no blank screen

## Implementation Status

✅ **Completed Components:**
- `src/state/debuggerBus.ts` - State management for debugger loads
- Updated `src/App.tsx` - Added DebuggerBusProvider
- Updated `src/tabs/Learn.tsx` - Uses debugger bus for loading code
- Updated `src/components/AsmDebugger.tsx` - Consumes pending loads
- Updated `src/grader/asmGrader.ts` - Added breakpoints to Challenge interface
- Added test IDs for E2E testing
- Created unit tests and E2E tests

✅ **Key Features:**
- Robust state management with sessionStorage persistence
- Race condition handling with editor ready state
- Automatic breakpoint and watch setup
- Toast notifications
- Cursor positioning
- Graceful error handling

✅ **Performance:**
- Debounced model updates
- Efficient state management
- No unnecessary re-renders
- Fast navigation (< 150ms target)

## Testing

Run unit tests:
```bash
npm test src/state/__tests__/debuggerBus.test.tsx
npm test src/__tests__/debugger-integration.test.tsx
```

Run E2E tests:
```bash
npm run test:e2e -- debugger-bridge.spec.ts
```

## Architecture

The implementation uses a clean architecture:

1. **State Layer**: `debuggerBus.ts` manages the bridge state
2. **UI Layer**: Components consume and update the bridge state
3. **Persistence**: sessionStorage for reload survival
4. **Error Handling**: Graceful fallbacks for all operations

The bridge ensures that clicking "Open in Debugger" always works reliably, with proper setup of breakpoints, watches, and cursor position.