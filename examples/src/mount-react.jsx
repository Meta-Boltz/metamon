import React from 'react';
import { createRoot } from 'react-dom/client';
import ReactCounter from './components/ReactCounter.jsx';
import SharedStateDisplay from './components/SharedStateDisplay.jsx';

// Mount React components
const reactCounterElement = document.getElementById('react-counter');
if (reactCounterElement) {
  const reactCounterRoot = createRoot(reactCounterElement);
  reactCounterRoot.render(<ReactCounter />);
}

const sharedStateElement = document.getElementById('shared-state-display');
if (sharedStateElement) {
  const sharedStateRoot = createRoot(sharedStateElement);
  sharedStateRoot.render(<SharedStateDisplay />);
}