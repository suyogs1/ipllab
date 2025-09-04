import { useState } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { AppShell } from './components/AppShell';
import AsmDebugger from './components/AsmDebugger';
import Learn from './tabs/Learn';
import { Docs } from './tabs/Docs';
import { ToastContainer } from './components/ui/Toast';
import { DebuggerBusProvider } from './state/debuggerBus.tsx';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
}

type TabType = 'learn' | 'debug' | 'docs';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('learn');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Handle opening code in debugger from Learn tab
  const handleOpenInDebugger = (_code: string) => {
    setActiveTab('debug');
    addToast({
      type: 'success',
      title: 'Loaded in Debugger',
      message: 'Assembly code loaded with breakpoints and watches',
    });
  };

  // Handle command palette actions
  const handleCommandAction = (action: string) => {
    switch (action) {
      case 'docs':
        setActiveTab('docs');
        break;
      case 'run':
      case 'step':
      case 'continue':
      case 'breakpoint':
      case 'goto':
      case 'follow-sp':
        // These would be handled by the debugger component
        addToast({
          type: 'info',
          title: 'Debug Action',
          message: `${action} command executed`,
        });
        break;
      default:
        console.log('Unknown command:', action);
    }
  };

  // Toast management
  const addToast = (toast: Omit<Toast, 'id'>) => {
    const newToast: Toast = {
      ...toast,
      id: Date.now().toString(),
    };
    setToasts(prev => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'learn':
        return <Learn onOpenInDebugger={handleOpenInDebugger} />;
      case 'debug':
        return (
          <ErrorBoundary fallback={
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="text-6xl">⚠️</div>
                <h3 className="text-lg font-medium text-slate-200">Debugger Error</h3>
                <p className="text-slate-400">The debugger encountered an error. Try refreshing the page.</p>
              </div>
            </div>
          }>
            <AsmDebugger />
          </ErrorBoundary>
        );
      case 'docs':
        return <Docs />;
      default:
        return null;
    }
  };

  return (
    <ErrorBoundary>
      <DebuggerBusProvider>
        <AppShell
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onCommandAction={handleCommandAction}
        >
          {renderTabContent()}
        </AppShell>
        
        <ToastContainer toasts={toasts} onClose={removeToast} />
      </DebuggerBusProvider>
    </ErrorBoundary>
  );
}

export default App;