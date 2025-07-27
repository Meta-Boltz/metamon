// MTM ThemeToggle Component - Compiled from MTMThemeToggle.mtm
// This simulates what the MTM compiler would generate

(function () {
  'use strict';

  console.log('[MTM] Loading ThemeToggle component script');

  // MTM ThemeToggle reactive logic
  let currentTheme = 'light';
  const themes = {
    light: { name: 'Light', icon: '☀️', colors: { background: '#ffffff', text: '#333333', accent: '#9b59b6' } },
    dark: { name: 'Dark', icon: '🌙', colors: { background: '#2c3e50', text: '#ecf0f1', accent: '#3498db' } },
    auto: { name: 'Auto', icon: '🔄', colors: { background: '#f8f9fa', text: '#333333', accent: '#9b59b6' } }
  };

  // Component methods
  function toggleTheme() {
    const themeKeys = Object.keys(themes);
    const currentIndex = themeKeys.indexOf(currentTheme);
    currentTheme = themeKeys[(currentIndex + 1) % themeKeys.length];
    updateDisplay();
    applyTheme();
  }

  function setTheme(theme) {
    if (themes[theme]) {
      currentTheme = theme;
      updateDisplay();
      applyTheme();
    }
  }

  function applyTheme() {
    const theme = themes[currentTheme];
    const containers = document.querySelectorAll('[data-mtm-component="/src/components/MTMThemeToggle.mtm"] .mtm-theme-component');

    containers.forEach(container => {
      container.style.backgroundColor = theme.colors.background;
      container.style.color = theme.colors.text;
      container.style.borderColor = theme.colors.accent;
    });

    console.log('Theme changed to:', currentTheme, theme);
  }

  function updateDisplay() {
    const containers = document.querySelectorAll('[data-mtm-component="/src/components/MTMThemeToggle.mtm"]');

    containers.forEach(container => {
      const iconElement = container.querySelector('.theme-icon');
      const nameElement = container.querySelector('.theme-display strong');
      const previewBox = container.querySelector('.preview-box');

      const theme = themes[currentTheme];

      if (iconElement) iconElement.textContent = theme.icon;
      if (nameElement) nameElement.textContent = theme.name;

      if (previewBox) {
        previewBox.style.background = theme.colors.background;
        previewBox.style.color = theme.colors.text;
        previewBox.style.borderColor = theme.colors.accent;

        const bgElement = previewBox.querySelector('small:nth-child(2)');
        const textElement = previewBox.querySelector('small:nth-child(4)');
        const accentElement = previewBox.querySelector('small:nth-child(6)');

        if (bgElement) bgElement.textContent = `Background: ${theme.colors.background}`;
        if (textElement) textElement.textContent = `Text: ${theme.colors.text}`;
        if (accentElement) accentElement.textContent = `Accent: ${theme.colors.accent}`;
      }
    });
  }

  // Global functions for onclick handlers
  window.mtmThemeToggle = toggleTheme;
  window.mtmThemeSetLight = () => setTheme('light');
  window.mtmThemeSetDark = () => setTheme('dark');
  window.mtmThemeSetAuto = () => setTheme('auto');

  // Initialize component
  function init() {
    // Attach event listeners
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-mtm-component="/src/components/MTMThemeToggle.mtm"] .theme-toggle-btn')) {
        toggleTheme();
      }
      if (e.target.matches('[data-mtm-component="/src/components/MTMThemeToggle.mtm"] .theme-option-btn')) {
        const text = e.target.textContent.trim();
        if (text.includes('Light')) setTheme('light');
        else if (text.includes('Dark')) setTheme('dark');
        else if (text.includes('Auto')) setTheme('auto');
      }
    });

    // Listen for system theme changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (currentTheme === 'auto') {
          updateDisplay();
          applyTheme();
        }
      });
    }

    updateDisplay();
    applyTheme();
  }

  // Auto-initialize when script loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }

  console.log('[MTM] ThemeToggle component script loaded');
})();