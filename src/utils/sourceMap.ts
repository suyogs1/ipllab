/**
 * Source map utilities for mapping between editor and runtime positions
 */

import { SourceMapConsumer } from 'source-map';
import type { Position } from './positions';

export interface SourceMapAdapter {
  mapEditorToRuntime(pos: Position): Position | null;
  mapRuntimeToEditor(pos: Position): Position | null;
}

/**
 * Create source map adapter from raw source map
 */
export async function createSourceMapAdapter(
  sourceMapData: any
): Promise<SourceMapAdapter> {
  const consumer = await new SourceMapConsumer(sourceMapData);
  
  return {
    mapEditorToRuntime(pos: Position): Position | null {
      const mapped = consumer.generatedPositionFor({
        source: 'source.asm',
        line: pos.line + 1, // SourceMapConsumer uses 1-based
        column: pos.column
      });
      
      if (mapped.line === null || mapped.column === null) {
        return null;
      }
      
      return {
        line: mapped.line - 1, // Convert back to 0-based
        column: mapped.column
      };
    },
    
    mapRuntimeToEditor(pos: Position): Position | null {
      const mapped = consumer.originalPositionFor({
        line: pos.line + 1, // SourceMapConsumer uses 1-based
        column: pos.column
      });
      
      if (mapped.line === null || mapped.column === null) {
        return null;
      }
      
      return {
        line: mapped.line - 1, // Convert back to 0-based
        column: mapped.column
      };
    }
  };
}

/**
 * Identity source map adapter (no transformation)
 */
export function createIdentityAdapter(): SourceMapAdapter {
  return {
    mapEditorToRuntime(pos: Position): Position {
      return pos;
    },
    
    mapRuntimeToEditor(pos: Position): Position {
      return pos;
    }
  };
}