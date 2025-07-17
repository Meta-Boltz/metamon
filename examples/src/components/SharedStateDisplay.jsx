import React, { useState, useEffect } from 'react';
import { signals } from '../shared/state.js';

export default function SharedStateDisplay() {
  const [userCount, setUserCount] = useState(signals.userCount.value);
  const [messages, setMessages] = useState(signals.messages.value);
  const [theme, setTheme] = useState(signals.theme.value);

  useEffect(() => {
    const unsubscribeUserCount = signals.userCount.subscribe(setUserCount);
    const unsubscribeMessages = signals.messages.subscribe(setMessages);
    const unsubscribeTheme = signals.theme.subscribe(setTheme);

    return () => {
      unsubscribeUserCount();
      unsubscribeMessages();
      unsubscribeTheme();
    };
  }, []);

  return (
    <div className="shared-state-display">
      <h3>🔄 Shared State (Live Updates)</h3>
      <div className="state-item">
        <span>Active Users:</span>
        <span className="metric-value">{userCount}</span>
      </div>
      <div className="state-item">
        <span>Messages:</span>
        <span className="metric-value">{messages.length}</span>
      </div>
      <div className="state-item">
        <span>Theme:</span>
        <span className="metric-value">{theme}</span>
      </div>
    </div>
  );
}