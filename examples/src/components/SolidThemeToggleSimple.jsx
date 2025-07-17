import { createSignal, createEffect } from 'solid-js';
import { signals, pubsub } from '../shared/state.js';

function SolidThemeToggleSimple() {
  const [theme, setTheme] = createSignal(signals.theme.value);
  const [isAnimating, setIsAnimating] = createSignal(false);

  // Subscribe to theme changes from global state
  const unsubscribe = signals.theme.subscribe((newTheme) => {
    setTheme(newTheme);
  });

  const toggleTheme = () => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);
    
    const newTheme = theme() === 'light' ? 'dark' : 'light';
    signals.theme.update(newTheme);
    
    pubsub.emit('theme-changed', {
      framework: 'Solid',
      theme: newTheme,
      timestamp: Date.now()
    });
    
    pubsub.emit('user-action', {
      action: 'toggle_theme',
      framework: 'Solid',
      data: { newTheme }
    });
  };

  // Apply theme to document
  createEffect(() => {
    document.documentElement.setAttribute('data-theme', theme());
    if (theme() === 'dark') {
      document.body.style.filter = 'invert(1) hue-rotate(180deg)';
    } else {
      document.body.style.filter = 'none';
    }
  });

  return (
    <div class="component-demo">
      <div style={{ 
        display: 'flex', 
        'align-items': 'center', 
        gap: '10px',
        'margin-bottom': '15px'
      }}>
        <span>Current Theme:</span>
        <span 
          class="counter-value"
          style={{ 
            color: theme() === 'dark' ? '#fbbf24' : '#3b82f6',
            'text-transform': 'capitalize'
          }}
        >
          {theme()}
        </span>
      </div>

      <button 
        class="button"
        onClick={toggleTheme}
        style={{
          background: theme() === 'dark' ? '#fbbf24' : '#3b82f6',
          transform: isAnimating() ? 'scale(0.95)' : 'scale(1)',
          transition: 'all 0.3s ease'
        }}
      >
        {theme() === 'light' ? '🌙 Switch to Dark' : '☀️ Switch to Light'}
      </button>

      <div style={{ 
        'margin-top': '15px', 
        padding: '10px', 
        'border-radius': '6px',
        background: theme() === 'dark' ? '#374151' : '#f3f4f6',
        color: theme() === 'dark' ? '#f9fafb' : '#1f2937',
        'font-size': '12px'
      }}>
        <strong>Solid.js Integration:</strong><br/>
        This component uses Solid's native signals with global state.
        Theme changes are reflected across all framework components.
      </div>
    </div>
  );
}

export default SolidThemeToggleSimple;