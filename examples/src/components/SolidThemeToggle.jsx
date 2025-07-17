import { createSignal, createEffect, onMount, onCleanup } from 'solid-js';
import { signals, pubsub } from '../shared/state.js';

export default function SolidThemeToggle() {
  const [theme, setTheme] = createSignal(signals.theme.value);
  const [isAnimating, setIsAnimating] = createSignal(false);

  let unsubscribeTheme;
  let unsubscribeThemeChanges;

  onMount(() => {
    // Subscribe to theme changes
    unsubscribeTheme = signals.theme.subscribe((newTheme) => {
      setTheme(newTheme);
    });

    // Listen for theme changes from other components
    unsubscribeThemeChanges = pubsub.subscribe('theme-changed', (data) => {
      if (data.framework !== 'Solid') {
        console.log(`Theme changed by ${data.framework} to ${data.theme}`);
      }
    });
  });

  onCleanup(() => {
    if (unsubscribeTheme) unsubscribeTheme();
    if (unsubscribeThemeChanges) unsubscribeThemeChanges();
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

  const applySystemTheme = () => {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    signals.theme.update(systemTheme);
    
    pubsub.emit('theme-changed', {
      framework: 'Solid',
      theme: systemTheme,
      timestamp: Date.now(),
      source: 'system'
    });
    
    pubsub.emit('user-action', {
      action: 'apply_system_theme',
      framework: 'Solid',
      data: { systemTheme }
    });
  };

  // Apply theme to document
  createEffect(() => {
    document.documentElement.setAttribute('data-theme', theme());
    document.body.style.filter = theme() === 'dark' ? 'invert(1) hue-rotate(180deg)' : 'none';
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

      <div style={{ display: 'flex', gap: '8px', 'flex-direction': 'column' }}>
        <button 
          class={`button ${isAnimating() ? 'animating' : ''}`}
          onClick={toggleTheme}
          style={{
            background: theme() === 'dark' ? '#fbbf24' : '#3b82f6',
            transform: isAnimating() ? 'scale(0.95)' : 'scale(1)',
            transition: 'all 0.3s ease'
          }}
        >
          {theme() === 'light' ? '🌙 Switch to Dark' : '☀️ Switch to Light'}
        </button>
        
        <button 
          class="button secondary"
          onClick={applySystemTheme}
        >
          🖥️ Use System Theme
        </button>
      </div>

      <div style={{ 
        'margin-top': '15px', 
        padding: '10px', 
        'border-radius': '6px',
        background: theme() === 'dark' ? '#374151' : '#f3f4f6',
        color: theme() === 'dark' ? '#f9fafb' : '#1f2937',
        'font-size': '12px'
      }}>
        <strong>Solid.js Native Integration:</strong><br/>
        This component uses Solid's native signals seamlessly integrated with the global state.
        Theme changes are instantly reflected across all framework components.
      </div>
    </div>
  );
}