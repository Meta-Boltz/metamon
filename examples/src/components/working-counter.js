/**
 * Working Counter Component - Compiled from ultra-modern MTM syntax
 * Original: counter.react.mtm
 */

import React, { useState, useCallback } from 'react';
import signal from '../shared/ultra-modern-signal.js';

export default function WorkingCounter() {
  // Ultra-modern MTM: $count! = signal('globalCount', 0)
  const globalCount = signal.signal('globalCount', 0);
  const [count, setCount] = useState(globalCount.value);
  
  // Ultra-modern MTM: $localCount! = 0
  const [localCount, setLocalCount] = useState(0);

  // Subscribe to global count changes
  React.useEffect(() => {
    const unsubscribe = globalCount.subscribe((newValue) => {
      setCount(newValue);
    });
    return unsubscribe;
  }, []);

  // Ultra-modern MTM: $increment = () => { $count++; signal.emit('counter-updated', { value: $count }) }
  const increment = useCallback(() => {
    globalCount.value++;
    signal.emit('counter-updated', { value: globalCount.value });
  }, []);

  // Ultra-modern MTM: $incrementLocal = () => { $localCount++ }
  const incrementLocal = useCallback(() => {
    setLocalCount(prev => prev + 1);
  }, []);

  // Ultra-modern MTM: $reset = () => { $count = 0; $localCount = 0; signal.emit('counter-updated', { value: 0 }) }
  const reset = useCallback(() => {
    globalCount.value = 0;
    setLocalCount(0);
    signal.emit('counter-updated', { value: 0 });
  }, []);

  return (
    <div className="component-demo">
      <h3>🚀 Ultra-Modern MTM Counter (React)</h3>
      
      <div className="counter">
        <span>Global Count:</span>
        <span className="counter-value">{count}</span>
        <button className="button" onClick={increment}>
          +1 Global
        </button>
      </div>
      
      <div className="counter">
        <span>Local Count:</span>
        <span className="counter-value">{localCount}</span>
        <button className="button secondary" onClick={incrementLocal}>
          +1 Local
        </button>
      </div>

      <button className="button" onClick={reset} style={{ marginTop: '10px' }}>
        Reset All
      </button>

      <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
        Global count is shared across all frameworks via signals.
        Local count demonstrates React-specific state.
      </div>
      
      <div style={{ marginTop: '15px', padding: '10px', background: '#f0f8ff', borderRadius: '6px', fontSize: '12px' }}>
        <strong>🎯 Ultra-Modern MTM Features:</strong><br/>
        ✅ No frontmatter - framework detected from filename<br/>
        ✅ Unified signal system - single system for everything<br/>
        ✅ Clean template syntax - JSX-like binding<br/>
        ✅ Reactive variables with $ prefix and ! suffix
      </div>
    </div>
  );
}