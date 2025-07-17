import React, { useState, useEffect } from 'react';
import { signals, pubsub } from '../shared/state.js';

export default function ReactCounter() {
  const [globalCount, setGlobalCount] = useState(signals.userCount.value);
  const [localCount, setLocalCount] = useState(0);

  useEffect(() => {
    // Subscribe to global count changes
    const unsubscribe = signals.userCount.subscribe((newValue) => {
      setGlobalCount(newValue);
    });

    return unsubscribe;
  }, []);

  const incrementGlobal = () => {
    const newCount = globalCount + 1;
    signals.userCount.update(newCount);

    pubsub.emit('counter-updated', {
      framework: 'React',
      value: newCount,
      timestamp: Date.now()
    });

    pubsub.emit('user-action', {
      action: 'increment_global',
      framework: 'React',
      data: { newValue: newCount }
    });
  };

  const incrementLocal = () => {
    const newCount = localCount + 1;
    setLocalCount(newCount);

    pubsub.emit('user-action', {
      action: 'increment_local',
      framework: 'React',
      data: { newValue: newCount }
    });
  };

  const reset = () => {
    signals.userCount.update(0);
    setLocalCount(0);

    pubsub.emit('counter-updated', {
      framework: 'React',
      value: 0,
      timestamp: Date.now()
    });

    pubsub.emit('user-action', {
      action: 'reset_counters',
      framework: 'React'
    });
  };

  return (
    <div className="component-demo">
      <div className="counter">
        <span>Global Count:</span>
        <span className="counter-value">{globalCount}</span>
        <button className="button" onClick={incrementGlobal}>
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
    </div>
  );
}