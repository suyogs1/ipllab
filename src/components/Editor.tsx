import React, { useEffect, useRef, useState, useCallback } from 'react';

interface EditorProps {
  code: string;
  language: 'asm';
  onChange: (value: string) => void;
  onRun: () => void;
  running: boolean;
  error?: string;
}

const Editor: React.FC<EditorProps> = ({ code, language, onChange, onRun, running, error }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const modelRef = useRef<any>(null);
  const internalValueRef = useRef<string>(code);
  const [monaco, setMonaco] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>('');

  // Debounced onChange handler
  const debouncedOnChange = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (value: string) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          try {
            onChange(value);
          } catch (error) {
            console.error('Editor onChange error:', error);
          }
        }, 100);
      };
    })(),
    [onChange]
  );

  // Load Monaco once
  useEffect(() => {
    let isMounted = true;

    const loadMonaco = async () => {
      try {
        const monacoModule = await import('monaco-editor');
        
        if (!isMounted) return;

        // Configure Monaco theme
        monacoModule.editor.defineTheme('playground-theme', {
          base: 'vs',
          inherit: true,
          rules: [
            { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
            { token: 'keyword', foreground: 'd73a49', fontStyle: 'bold' },
            { token: 'string', foreground: '032f62' },
            { token: 'number', foreground: '005cc5' }
          ],
          colors: {
            'editor.background': '#fafafa',
            'editor.lineHighlightBackground': '#f0f9ff',
            'editorError.foreground': '#d73a49',
            'editorWarning.foreground': '#f66a0a'
          }
        });

        setMonaco(monacoModule);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load Monaco:', error);
        setLoadError(error instanceof Error ? error.message : 'Failed to load editor');
        setLoading(false);
      }
    };

    loadMonaco();

    return () => {
      isMounted = false;
    };
  }, []);

  // Create Monaco editor once per mount
  useEffect(() => {
    if (!monaco || !containerRef.current || editorRef.current) return;

    try {
      // Create model first
      const monacoLanguage = 'plaintext'; // Assembly language
      const model = monaco.editor.createModel(code, monacoLanguage);
      modelRef.current = model;
      internalValueRef.current = code;

      // Create editor
      const editor = monaco.editor.create(containerRef.current, {
        model,
        theme: 'playground-theme',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 14,
        lineNumbers: 'on',
        roundedSelection: false,
        automaticLayout: true,
        wordWrap: 'on',
        tabSize: 8, // Assembly language tab size
        insertSpaces: true,
        contextmenu: false,
        quickSuggestions: false,
        suggestOnTriggerCharacters: false,
        acceptSuggestionOnEnter: 'off',
        hover: { enabled: false },
        parameterHints: { enabled: false }
      });

      editorRef.current = editor;

      // Handle content changes with debouncing
      const disposable = model.onDidChangeContent(() => {
        try {
          const value = model.getValue();
          internalValueRef.current = value;
          debouncedOnChange(value);
        } catch (error) {
          console.error('Editor content change error:', error);
        }
      });

      // Add keyboard shortcuts
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        if (!running) {
          try {
            onRun();
          } catch (error) {
            console.error('Editor run command error:', error);
          }
        }
      });

      return () => {
        disposable.dispose();
        editor.dispose();
        model.dispose();
        editorRef.current = null;
        modelRef.current = null;
      };
    } catch (error) {
      console.error('Failed to create Monaco editor:', error);
      setLoadError(error instanceof Error ? error.message : 'Failed to create editor');
    }
  }, [monaco, language, debouncedOnChange, onRun, running]);

  // Update code when external prop changes (avoid feedback loops)
  useEffect(() => {
    if (modelRef.current && code !== internalValueRef.current) {
      try {
        modelRef.current.setValue(code);
        internalValueRef.current = code;
      } catch (error) {
        console.error('Failed to update editor value:', error);
      }
    }
  }, [code]);

  // Update language when it changes
  useEffect(() => {
    if (monaco && modelRef.current) {
      try {
        const monacoLanguage = 'plaintext'; // Assembly language
        monaco.editor.setModelLanguage(modelRef.current, monacoLanguage);
      } catch (error) {
        console.error('Failed to update editor language:', error);
      }
    }
  }, [monaco, language]);

  // Show error markers
  useEffect(() => {
    if (monaco && modelRef.current) {
      try {
        if (error) {
          monaco.editor.setModelMarkers(modelRef.current, 'owner', [{
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 1,
            message: error,
            severity: monaco.MarkerSeverity.Error
          }]);
        } else {
          monaco.editor.setModelMarkers(modelRef.current, 'owner', []);
        }
      } catch (err) {
        console.error('Failed to set error markers:', err);
      }
    }
  }, [monaco, error]);

  // Fallback textarea component
  const FallbackEditor = () => (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-2 bg-yellow-100 border-b border-yellow-300 rounded-t-md">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-yellow-800">⚠️ Fallback Editor</span>
          <span className="text-xs text-yellow-700">Monaco failed to load</span>
        </div>
        <button
          onClick={onRun}
          disabled={running}
          className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
            running
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {running ? 'Running...' : 'Run'}
        </button>
      </div>
      <textarea
        value={code}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            if (!running) onRun();
          }
        }}
        className="flex-1 p-4 font-mono text-sm resize-none border border-gray-300 rounded-b-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="Enter your code here..."
        spellCheck={false}
        style={{ tabSize: 8 }}
      />
      {error && (
        <div className="bg-red-100 border-t border-red-300 p-2">
          <div className="text-red-700 text-sm font-medium">{error}</div>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="h-[60vh] bg-gray-50 border border-gray-300 rounded-md flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <div className="text-gray-600">Loading editor...</div>
        </div>
      </div>
    );
  }

  if (loadError || !monaco) {
    return <FallbackEditor />;
  }

  return (
    <div className="h-[60vh] flex flex-col">
      <div className="flex items-center justify-between p-2 bg-gray-100 border-b border-gray-300 rounded-t-md">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">
            Assembly
          </span>
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
        </div>
        <button
          onClick={onRun}
          disabled={running}
          className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
            running
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {running ? 'Running...' : 'Run'}
        </button>
      </div>
      
      <div ref={containerRef} className="flex-1 border border-gray-300 rounded-b-md" />
      
      {/* Error display */}
      {error && (
        <div className="bg-red-100 border-t border-red-300 p-2">
          <div className="text-red-700 text-sm font-medium">{error}</div>
        </div>
      )}
    </div>
  );
};

export default Editor;