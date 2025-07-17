/**
 * React CSS Handler
 * 
 * Handles CSS and styling updates for React components during hot reload.
 * Provides React-specific styling update mechanisms without component remount.
 */

import { FrameworkStyleHandler, ThemeChange } from '../css-hot-reload-manager.js';

interface ReactStyleState {
  componentId: string;
  styles: string;
  themeVariables: Map<string, string>;
  lastUpdated: number;
}

/**
 * React-specific CSS handler
 */
export class ReactCSSHandler implements FrameworkStyleHandler {
  readonly frameworkName = 'react';
  
  private componentStyles = new Map<string, ReactStyleState>();
  private styleElements = new Map<string, HTMLStyleElement>();
  private debugLogging = false;

  constructor(options: { debugLogging?: boolean } = {}) {
    this.debugLogging = options.debugLogging || false;
  }

  /**
   * Update styles for a React component
   */
  async updateStyles(componentId: string, styles: string): Promise<void> {
    try {
      const styleState: ReactStyleState = {
        componentId,
        styles,
        themeVariables: new Map(),
        lastUpdated: Date.now()
      };

      // Store the style state
      this.componentStyles.set(componentId, styleState);

      // Update component styles in the DOM
      await this.updateComponentStylesInDOM(componentId, styles);

      // Trigger React component style update without remount
      await this.triggerReactStyleUpdate(componentId);

      if (this.debugLogging) {
        console.log(`[ReactCSS] Updated styles for component ${componentId}`);
      }

    } catch (error) {
      console.error(`[ReactCSS] Failed to update styles for component ${componentId}:`, error);
      throw error;
    }
  }

  /**
   * Update theme variables for React components
   */
  async updateTheme(themeChanges: ThemeChange[]): Promise<void> {
    try {
      // Update theme variables for all React components
      for (const [componentId, styleState] of this.componentStyles.entries()) {
        for (const change of themeChanges) {
          styleState.themeVariables.set(change.variableName, change.newValue);
        }
        styleState.lastUpdated = Date.now();
      }

      // Apply theme changes to React components
      await this.applyThemeChangesToReactComponents(themeChanges);

      if (this.debugLogging) {
        console.log(`[ReactCSS] Applied ${themeChanges.length} theme changes to React components`);
      }

    } catch (error) {
      console.error('[ReactCSS] Failed to update theme for React components:', error);
      throw error;
    }
  }

  /**
   * Extract current styles from a React component
   */
  extractComponentStyles(componentId: string): string | null {
    const styleState = this.componentStyles.get(componentId);
    return styleState ? styleState.styles : null;
  }

  /**
   * Validate style integrity for a React component
   */
  validateStyleIntegrity(componentId: string): boolean {
    try {
      const styleState = this.componentStyles.get(componentId);
      if (!styleState) {
        return false;
      }

      // Check if style element exists in DOM
      const styleElement = this.styleElements.get(componentId);
      if (!styleElement || !document.head.contains(styleElement)) {
        return false;
      }

      // Validate that the style content matches
      return styleElement.textContent === styleState.styles;

    } catch (error) {
      console.error(`[ReactCSS] Error validating style integrity for ${componentId}:`, error);
      return false;
    }
  }

  /**
   * Update component styles in the DOM
   */
  private async updateComponentStylesInDOM(componentId: string, styles: string): Promise<void> {
    const styleId = `react-component-${componentId}`;
    let styleElement = this.styleElements.get(componentId);

    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.type = 'text/css';
      styleElement.setAttribute('data-framework', 'react');
      styleElement.setAttribute('data-component', componentId);
      document.head.appendChild(styleElement);
      this.styleElements.set(componentId, styleElement);
    }

    // Update style content
    styleElement.textContent = styles;

    // Add scoping to prevent style conflicts
    const scopedStyles = this.addReactStyleScoping(componentId, styles);
    styleElement.textContent = scopedStyles;
  }

  /**
   * Add React-specific style scoping
   */
  private addReactStyleScoping(componentId: string, styles: string): string {
    // Add component-specific scoping to prevent style conflicts
    const componentClass = `react-component-${componentId}`;
    
    // Simple scoping - prefix all selectors with component class
    return styles.replace(/([^{}]+){/g, (match, selector) => {
      const trimmedSelector = selector.trim();
      
      // Skip @-rules and already scoped selectors
      if (trimmedSelector.startsWith('@') || trimmedSelector.includes(componentClass)) {
        return match;
      }
      
      // Add component scoping
      return `.${componentClass} ${trimmedSelector} {`;
    });
  }

  /**
   * Trigger React component style update without remount
   */
  private async triggerReactStyleUpdate(componentId: string): Promise<void> {
    // In a real implementation, this would trigger React's style update mechanism
    // This could involve:
    // 1. Updating component props to trigger re-render
    // 2. Using React's context to notify components of style changes
    // 3. Triggering custom hooks that listen for style updates
    
    // For now, we'll dispatch a custom event that React components can listen to
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('react-style-update', {
        detail: {
          componentId,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(event);
    }

    // Also update any React components that might be using CSS-in-JS
    await this.updateCSSInJSComponents(componentId);
  }

  /**
   * Apply theme changes to React components
   */
  private async applyThemeChangesToReactComponents(themeChanges: ThemeChange[]): Promise<void> {
    // Update CSS custom properties in the document root
    for (const change of themeChanges) {
      document.documentElement.style.setProperty(change.variableName, change.newValue);
    }

    // Notify React components about theme changes
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('react-theme-update', {
        detail: {
          themeChanges,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(event);
    }

    // Update styled-components theme if available
    await this.updateStyledComponentsTheme(themeChanges);
  }

  /**
   * Update CSS-in-JS components (styled-components, emotion, etc.)
   */
  private async updateCSSInJSComponents(componentId: string): Promise<void> {
    // Check for styled-components
    if (typeof window !== 'undefined' && (window as any).SC_DISABLE_SPEEDY !== undefined) {
      // styled-components is present
      await this.updateStyledComponents(componentId);
    }

    // Check for emotion
    if (typeof window !== 'undefined' && (window as any).__EMOTION__ !== undefined) {
      // emotion is present
      await this.updateEmotionComponents(componentId);
    }
  }

  /**
   * Update styled-components
   */
  private async updateStyledComponents(componentId: string): Promise<void> {
    // In a real implementation, this would interact with styled-components' API
    // to update component styles without remounting
    
    if (this.debugLogging) {
      console.log(`[ReactCSS] Updating styled-components for ${componentId}`);
    }
  }

  /**
   * Update emotion components
   */
  private async updateEmotionComponents(componentId: string): Promise<void> {
    // In a real implementation, this would interact with emotion's API
    // to update component styles without remounting
    
    if (this.debugLogging) {
      console.log(`[ReactCSS] Updating emotion components for ${componentId}`);
    }
  }

  /**
   * Update styled-components theme
   */
  private async updateStyledComponentsTheme(themeChanges: ThemeChange[]): Promise<void> {
    // In a real implementation, this would update the styled-components ThemeProvider
    // to propagate theme changes to all styled components
    
    if (this.debugLogging) {
      console.log(`[ReactCSS] Updating styled-components theme with ${themeChanges.length} changes`);
    }
  }

  /**
   * Get React component style state
   */
  getComponentStyleState(componentId: string): ReactStyleState | undefined {
    return this.componentStyles.get(componentId);
  }

  /**
   * Remove component styles
   */
  removeComponentStyles(componentId: string): void {
    // Remove from internal state
    this.componentStyles.delete(componentId);

    // Remove style element from DOM
    const styleElement = this.styleElements.get(componentId);
    if (styleElement && styleElement.parentNode) {
      styleElement.parentNode.removeChild(styleElement);
    }
    this.styleElements.delete(componentId);

    if (this.debugLogging) {
      console.log(`[ReactCSS] Removed styles for component ${componentId}`);
    }
  }

  /**
   * Get all registered React components
   */
  getRegisteredComponents(): string[] {
    return Array.from(this.componentStyles.keys());
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Remove all style elements
    for (const [componentId, styleElement] of this.styleElements.entries()) {
      if (styleElement.parentNode) {
        styleElement.parentNode.removeChild(styleElement);
      }
    }

    // Clear internal state
    this.componentStyles.clear();
    this.styleElements.clear();
  }
}