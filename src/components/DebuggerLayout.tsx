/**
 * Resizable debugger layout with docking options
 */

import React, { useState, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { 
  Maximize2, 
  Minimize2, 
  PanelRight, 
  PanelBottom, 
  ExternalLink,
  Settings
} from 'lucide-react';
import { NeonButton } from './ui/NeonButton';
import { TagPill } from './ui/TagPill';

type LayoutMode = 'docked-right' | 'bottom-drawer' | 'fullscreen';

interface LayoutState {
  mode: LayoutMode;
  rightPanelSize: number;
  bottomPanelSize: number;
  collapsed: boolean;
}

interface DebuggerLayoutProps {
  children: React.ReactNode;
  debuggerPanel: React.ReactNode;
  onLayoutChange?: (layout: LayoutState) => void;
}

const STORAGE_KEY = 'ipl.debugger.layout';

const defaultLayout: LayoutState = {
  mode: 'docked-right',
  rightPanelSize: 40,
  bottomPanelSize: 30,
  collapsed: false
};

export const DebuggerLayout: React.FC<DebuggerLayoutProps> = ({
  children,
  debuggerPanel,
  onLayoutChange
}) => {
  const [layout, setLayout] = useState<LayoutState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...defaultLayout, ...JSON.parse(stored) } : defaultLayout;
    } catch {
      return defaultLayout;
    }
  });

  // Persist layout changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
      onLayoutChange?.(layout);
    } catch (error) {
      console.warn('Failed to save layout:', error);
    }
  }, [layout, onLayoutChange]);

  const updateLayout = (updates: Partial<LayoutState>) => {
    setLayout(prev => ({ ...prev, ...updates }));
  };

  const handleModeChange = (mode: LayoutMode) => {
    updateLayout({ mode, collapsed: false });
  };

  const toggleCollapsed = () => {
    updateLayout({ collapsed: !layout.collapsed });
  };

  const handleResize = (sizes: number[]) => {
    if (layout.mode === 'docked-right') {
      updateLayout({ rightPanelSize: sizes[1] });
    } else if (layout.mode === 'bottom-drawer') {
      updateLayout({ bottomPanelSize: sizes[1] });
    }
  };

  const renderControls = () => (
    <div className="flex items-center space-x-1 p-2 border-b border-edge/50">
      <div className="flex items-center space-x-1">
        <NeonButton
          variant={layout.mode === 'docked-right' ? 'accent' : 'ghost'}
          size="sm"
          onClick={() => handleModeChange('docked-right')}
          title="Dock Right"
        >
          <PanelRight className="w-3 h-3" />
        </NeonButton>
        <NeonButton
          variant={layout.mode === 'bottom-drawer' ? 'accent' : 'ghost'}
          size="sm"
          onClick={() => handleModeChange('bottom-drawer')}
          title="Bottom Drawer"
        >
          <PanelBottom className="w-3 h-3" />
        </NeonButton>
        <NeonButton
          variant={layout.mode === 'fullscreen' ? 'accent' : 'ghost'}
          size="sm"
          onClick={() => handleModeChange('fullscreen')}
          title="Fullscreen"
        >
          <Maximize2 className="w-3 h-3" />
        </NeonButton>
      </div>
      
      <div className="flex-1" />
      
      <div className="flex items-center space-x-1">
        <TagPill variant="secondary" size="sm">
          {layout.mode.replace('-', ' ')}
        </TagPill>
        <NeonButton
          variant="ghost"
          size="sm"
          onClick={toggleCollapsed}
          title={layout.collapsed ? 'Expand' : 'Collapse'}
        >
          {layout.collapsed ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
        </NeonButton>
      </div>
    </div>
  );

  if (layout.mode === 'fullscreen') {
    return (
      <div className="h-full flex flex-col">
        {renderControls()}
        <div className="flex-1 min-h-0">
          {layout.collapsed ? children : debuggerPanel}
        </div>
      </div>
    );
  }

  if (layout.mode === 'bottom-drawer') {
    return (
      <PanelGroup direction="vertical" onLayout={handleResize}>
        <Panel defaultSize={100 - layout.bottomPanelSize} minSize={30}>
          {children}
        </Panel>
        
        <PanelResizeHandle className="h-1 bg-edge hover:bg-accent transition-colors" />
        
        <Panel 
          defaultSize={layout.collapsed ? 5 : layout.bottomPanelSize} 
          minSize={5} 
          maxSize={70}
        >
          <div className="h-full flex flex-col bg-panel border-t border-edge">
            {renderControls()}
            {!layout.collapsed && (
              <div className="flex-1 min-h-0">
                {debuggerPanel}
              </div>
            )}
          </div>
        </Panel>
      </PanelGroup>
    );
  }

  // Default: docked-right
  return (
    <PanelGroup direction="horizontal" onLayout={handleResize}>
      <Panel defaultSize={100 - layout.rightPanelSize} minSize={30}>
        {children}
      </Panel>
      
      <PanelResizeHandle className="w-1 bg-edge hover:bg-accent transition-colors" />
      
      <Panel 
        defaultSize={layout.collapsed ? 5 : layout.rightPanelSize} 
        minSize={5} 
        maxSize={70}
      >
        <div className="h-full flex flex-col bg-panel border-l border-edge">
          {renderControls()}
          {!layout.collapsed && (
            <div className="flex-1 min-h-0">
              {debuggerPanel}
            </div>
          )}
        </div>
      </Panel>
    </PanelGroup>
  );
};