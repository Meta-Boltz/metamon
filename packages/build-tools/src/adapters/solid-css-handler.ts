/**
 * Solid CSS Handler
 * 
 * Handles CSS and styling updates for Solid components during hot reload.
 * Provides Solid-specific styling update mechanisms without component remount.
 */

import { FrameworkStyleHandler, ThemeChange } from '../css-hot-reload-manager.js';

interface SolidStyleState {
  componentId: string;
  styles: string;
  scopedStyles: string;
  themeVariables: Map<string, string>;
  lastUpdated: number;
}

/**
 * Solid-specific CSS handler
 */
export class SolidCSSHandler implements FrameworkStyleHandler {
  readonly frameworkName = 'solid';
  
  private componentStyles = new Map<string, SolidStyleState>();
  private styleElements = new Map<string, HTMLStyleElement>();
  private debugLogging = false;

  constructor(options: { debugLogging?: boolean } = {}) {
    this.debugLogging = options.debugLogging || false;
  }

  /**
   * Update styles for a Solid component
   */
  async updateStyles(componentId: string, styles: string): Promise<void> {
    try {
      const scopedStyles = this.addSolidStyleScoping(componentId, styles);
      
      const styleState: SolidStyleState = {
        componentId,
        styles,
        scopedStyles,
        themeVariables: new Map(),
        lastUpdated: Date.now()
      };

      // Store the style state
      this.componentStyles.set(componentId, styleState);

      // Update component styles in the DOM
      await this.updateComponentStylesInDOM(componentId, scopedStyles);

      // Trigger Solid component style update without remount
      await this.triggerSolidStyleUpdate(componentId);

      if (this.debugLogging) {
        console.log(`[SolidCSS] Updated styles for component ${componentId}`);
      }

    } catch (error) {
      console.error(`[SolidCSS] Failed to update styles for component ${componentId}:`, error);
      throw error;
    }
  }

  /**
   * Update theme variables for Solid components
   */
  async updateTheme(themeChanges: ThemeChange[]): Promise<void> {
    try {
      // Update theme variables for all Solid components
      for (const [componentId, styleState] of this.componentStyles.entries()) {
        for (const change of themeChanges) {
          styleState.themeVariables.set(change.variableName, change.newValue);
        }
        styleState.lastUpdated = Date.now();
      }

      // Apply theme changes to Solid components
      await this.applyThemeChangesToSolidComponents(themeChanges);

      if (this.debugLogging) {
        console.log(`[SolidCSS] Applied ${themeChanges.length} theme changes to Solid components`);
      }

    } catch (error) {
      console.error('[SolidCSS] Failed to update theme for Solid components:', error);
      throw error;
    }
  }

  /**
   * Extract current styles from a Solid component
   */
  extractComponentStyles(componentId: string): string | null {
    const styleState = this.componentStyles.get(componentId);
    return styleState ? styleState.styles : null;
  }

  /**
   * Validate style integrity for a Solid component
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
      return styleElement.textContent === styleState.scopedStyles;

    } catch (error) {
      console.error(`[SolidCSS] Error validating style integrity for ${componentId}:`, error);
      return false;
    }
  }

  /**
   * Update component styles in the DOM
   */
  private async updateComponentStylesInDOM(componentId: string, scopedStyles: string): Promise<void> {
    const styleId = `solid-component-${componentId}`;
    let styleElement = this.styleElements.get(componentId);

    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.type = 'text/css';
      styleElement.setAttribute('data-framework', 'solid');
      styleElement.setAttribute('data-component', componentId);
      document.head.appendChild(styleElement);
      this.styleElements.set(componentId, styleElement);
    }

    // Update style content with scoped styles
    styleElement.textContent = scopedStyles;
  }

  /**
   * Add Solid-specific style scoping
   */
  private addSolidStyleScoping(componentId: string, styles: string): string {
    // Generate a unique scope identifier for this component
    const scopeId = `solid-${this.generateScopeId(componentId)}`;
    
    // Add Solid-style scoping to all selectors
    return styles.replace(/([^{}]+){/g, (match, selector) => {
      const trimmedSelector = selector.trim();
      
      // Skip @-rules and already scoped selectors
      if (trimmedSelector.startsWith('@') || trimmedSelector.includes(scopeId)) {
        return match;
      }
      
      // Add Solid scoping class
      return `${trimmedSelector}.${scopeId} {`;
    });
  }

  /**
   * Generate a scope ID for Solid components
   */
  private generateScopeId(componentId: string): string {
    // Create a hash-like identifier from the component ID
    let hash = 0;
    for (let i = 0; i < componentId.length; i++) {
      const char = componentId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 8);
  }

  /**
   * Trigger Solid component style update without remount
   */
  private async triggerSolidStyleUpdate(componentId: string): Promise<void> {
    // In a real implementation, this would trigger Solid's reactivity system
    // to update component styles without remounting
    
    // Dispatch custom event for Solid components to listen to
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('solid-style-update', {
        detail: {
          componentId,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(event);
    }

    // Update Solid signals that might contain style information
    await this.updateSolidStyleSignals(componentId);
  }

  /**
   * Apply theme changes to Solid components
   */
  private async applyThemeChangesToSolidComponents(themeChanges: ThemeChange[]): Promise<void> {
    // Update CSS custom properties in the document root
    for (const change of themeChanges) {
      document.documentElement.style.setProperty(change.variableName, change.newValue);
    }

    // Notify Solid components about theme changes
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('solid-theme-update', {
        detail: {
          themeChanges,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(event);
    }

    // Update Solid signals with theme information
    await this.updateSolidThemeSignals(themeChanges);
  }

  /**
   * Update Solid signals that contain style information
   */
  private async updateSolidStyleSignals(componentId: string): Promise<void> {
    // In a real implementation, this would update Solid signals that contain
    // style information, triggering reactive updates in components
    
    if (this.debugLogging) {
      console.log(`[SolidCSS] Updating Solid style signals for component ${componentId}`);
    }

    // Example of how this might work with Solid signals:
    // if (typeof window !== 'undefined' && (window as any).solidStyleSignals) {
    //   const styleSignals = (window as any).solidStyleSignals;
    //   const componentStyleSignal = styleSignals[componentId];
    //   if (componentStyleSignal && typeof componentStyleSignal[1] === 'function') {
    //     const styleState = this.componentStyles.get(componentId);
    //     componentStyleSignal[1](styleState?.styles || '');
    //   }
    // }
  }

  /**
   * Update Solid signals with theme information
   */
  private async updateSolidThemeSignals(themeChanges: ThemeChange[]): Promise<void> {
    // In a real implementation, this would update Solid signals that contain
    // theme information, triggering reactive updates across all components
    
    if (this.debugLogging) {
      console.log(`[SolidCSS] Updating Solid theme signals with ${themeChanges.length} changes`);
    }

    // Example of how this might work with Solid signals:
    // if (typeof window !== 'undefined' && (window as any).solidThemeSignal) {
    //   const [themeSignal, setThemeSignal] = (window as any).solidThemeSignal;
    //   const currentTheme = themeSignal();
    //   const newTheme = { ...currentTheme };
    //   
    //   for (const change of themeChanges) {
    //     newTheme[change.variableName] = change.newValue;
    //   }
    //   
    //   setThemeSignal(newTheme);
    // }
  }

  /**
   * Add scoped classes to DOM elements for a component
   */
  addScopedClassesToComponent(componentId: string, element: Element): void {
    const scopeId = `solid-${this.generateScopeId(componentId)}`;
    element.classList.add(scopeId);
    
    // Also add to all child elements
    const children = element.querySelectorAll('*');
    children.forEach(child => {
      child.classList.add(scopeId);
    });
  }

  /**
   * Get Solid component style state
   */
  getComponentStyleState(componentId: string): SolidStyleState | undefined {
    return this.componentStyles.get(componentId);
  }

  /**
   * Get scoped styles for a component
   */
  getScopedStyles(componentId: string): string | null {
    const styleState = this.componentStyles.get(componentId);
    return styleState ? styleState.scopedStyles : null;
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
      console.log(`[SolidCSS] Removed styles for component ${componentId}`);
    }
  }

  /**
   * Get all registered Solid components
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