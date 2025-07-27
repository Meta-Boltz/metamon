// MTM Counter Component - Compiled from MTMCounter.mtm
// This simulates what the MTM compiler would generate

(function () {
  'use strict';

  console.log('[MTM] Loading Counter component script');

  // MTM Counter reactive logic
  let count = 0;
  let initialValue = 0;

  // Component methods
  function increment() {
    count++;
    updateDisplay();
    console.log('MTM Counter incremented to:', count);
  }

  function decrement() {
    count = Math.max(0, count - 1);
    updateDisplay();
  }

  function reset() {
    count = initialValue;
    updateDisplay();
  }

  function updateDisplay() {
    const elements = document.querySelectorAll('[data-mtm-component="/src/components/MTMCounter.mtm"] .counter-value');
    elements.forEach(el => {
      el.textContent = count;
    });
  }

  // Initialize component
  function init(props = {}) {
    initialValue = props.initialValue || 0;
    count = initialValue;

    // Attach event listeners
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-mtm-component="/src/components/MTMCounter.mtm"] .counter-btn')) {
        const action = e.target.textContent.trim();
        if (action === '+') increment();
        else if (action === '-') decrement();
      }
      if (e.target.matches('[data-mtm-component="/src/components/MTMCounter.mtm"] .counter-reset')) {
        reset();
      }
    });

    updateDisplay();
  }

  // Auto-initialize when script loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }

  console.log('[MTM] Counter component script loaded');
})();