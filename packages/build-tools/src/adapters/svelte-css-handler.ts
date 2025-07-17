/**
 * Svelte CSS Handler
 * 
 * Handles CSS and styling updates for Svelte components during hot reload.
 * Provides Svelte-specific styling update mechanisms without component remount.
 */

import { FrameworkStyleHandler, ThemeChange } from '../css-hot-reload-manager.js';

interface SvelteStyleState {
  componentId: string;
  styles: string;
  scopedStyles: string;
  themeVariables: Map<string, string>;
  lastUpdated: number;
}

/**
 * Svelte-specific CSS handler
 */
export class SvelteCSSHandler implements FrameworkStyleHandler {
  readonly frameworkName = 'svelte';
  
  private componentStyles = new Map<string, SvelteStyleState>();
  private styleElements = new Map<string, HTMLStyleElement>();
  private debugLogging = false;

  constructor(options: { debugLogging?: boolean } = {}) {
    this.debugLogging = options.debugLogging || false;
  }

  /**
   * Update styles for a Svelte component
   */
  async updateStyles(componentId: string, styles: string): Promise<void> {
    try {
      const scopedStyles = this.addSvelteStyleScoping(componentId, styles);
      
      const styleState: SvelteStyleState = {
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

      // Trigger Svelte component style update without remount
      await this.triggerSvelteStyleUpdate(componentId);

      if (this.debugLogging) {
        console.log(`[SvelteCSS] Updated styles for component ${componentId}`);
      }

    } catch (error) {
      console.error(`[SvelteCSS] Failed to update styles for component ${componentId}:`, error);
      throw error;
    }
  }

  /**
   * Update theme variables for Svelte components
   */
  async updateTheme(themeChanges: ThemeChange[]): Promise<void> {
    try {
      // Update theme variables for all Svelte components
      for (const [componentId, styleState] of this.componentStyles.entries()) {
        for (const change of themeChanges) {
          styleState.themeVariables.set(change.variableName, change.newValue);
        }
        styleState.lastUpdated = Date.now();
      }

      // Apply theme changes to Svelte components
      await this.applyThemeChangesToSvelteComponents(themeChanges);

      if (this.debugLogging) {
        console.log(`[SvelteCSS] Applied ${themeChanges.length} theme changes to Svelte components`);
      }

    } catch (error) {
      console.error('[SvelteCSS] Failed to update theme for Svelte components:', error);
      throw error;
    }
  }

  /**
   * Extract current styles from a Svelte component
   */
  extractComponentStyles(componentId: string): string | null {
    const styleState = this.componentStyles.get(componentId);
    return styleState ? styleState.styles : null;
  }

  /**
   * Validate style integrity for a Svelte component
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
      console.error(`[SvelteCSS] Error validating style integrity for ${componentId}:`, error);
      return false;
    }
  }

  /**
   * Update component styles in the DOM
   */
  private async updateComponentStylesInDOM(componentId: string, scopedStyles: string): Promise<void> {
    const styleId = `svelte-component-${componentId}`;
    let styleElement = this.styleElements.get(componentId);

    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.type = 'text/css';
      styleElement.setAttribute('data-framework', 'svelte');
      styleElement.setAttribute('data-component', componentId);
      document.head.appendChild(styleElement);
      this.styleElements.set(componentId, styleElement);
    }

    // Update style content with scoped styles
    styleElement.textContent = scopedStyles;
  }

  /**
   * Add Svelte-specific style scoping (similar to Svelte's component scoping)
   */
  private addSvelteStyleScoping(componentId: string, styles: string): string {
    // Generate a unique scope identifier for this component (similar to Svelte's approach)
    const scopeId = `svelte-${this.generateScopeId(componentId)}`;
    
    // Add Svelte-style scoping to all selectors
    return styles.replace(/([^{}]+){/g, (match, selector) => {
      const trimmedSelector = selector.trim();
      
      // Skip @-rules and already scoped selectors
      if (trimmedSelector.startsWith('@') || trimmedSelector.includes(scopeId)) {
        return match;
      }
      
      // Add Svelte scoping class
      return `${trimmedSelector}.${scopeId} {`;
    });
  }

  /**
   * Generate a scope ID similar to Svelte's component scoping
   */
  private generateScopeId(componentId: string): string {
    // Create a hash-like identifier from the component ID (similar to Svelte's approach)
    let hash = 0;
    for (let i = 0; i < componentId.length; i++) {
      const char = componentId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 8);
  }

  /**
   * Trigger Svelte component style update without remount
   */
  private async triggerSvelteStyleUpdate(componentId: string): Promise<void> {
    // In a real implementation, this would trigger Svelte's reactivity system
    // to update component styles without remounting
    
    // Dispatch custom event for Svelte components to listen to
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('svelte-style-update', {
        detail: {
          componentId,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(event);
    }

    // Update Svelte stores that might contain style information
    await this.updateSvelteStyleStores(componentId);
  }

  /**
   * Apply theme changes to Svelte components
   */
  private async applyThemeChangesToSvelteComponents(themeChanges: ThemeChange[]): Promise<void> {
    // Update CSS custom properties in the document root
    for (const change of themeChanges) {
      document.documentElement.style.setProperty(change.variableName, change.newValue);
    }

    // Notify Svelte components about theme changes
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('svelte-theme-update', {
        detail: {
          themeChanges,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(event);
    }

    // Update Svelte stores with theme information
    await this.updateSvelteThemeStores(themeChanges);
  }

  /**
   * Update Svelte stores that contain style information
   */
  private async updateSvelteStyleStores(componentId: string): Promise<void> {
    // In a real implementation, this would update Svelte stores that contain
    // style information, triggering reactive updates in components
    
    if (this.debugLogging) {
      console.log(`[SvelteCSS] Updating Svelte style stores for component ${componentId}`);
    }
  }

  /**
   * Update Svelte stores with theme information
   */
  private async updateSvelteThemeStores(themeChanges: ThemeChange[]): Promise<void> {
    // In a real implementation, this would update Svelte stores that contain
    // theme information, triggering reactive updates across all components
    
    if (this.debugLogging) {
      console.log(`[SvelteCSS] Updating Svelte theme stores with ${themeChanges.length} changes`);
    }

    // Example of how this might work with Svelte stores:
    // if (typeof window !== 'undefined' && (window as any).svelteThemeStore) {
    //   const themeStore = (window as any).svelteThemeStore;
    //   themeStore.update(currentTheme => {
    //     const newTheme = { ...currentTheme };
    //     for (const change of themeChanges) {
    //       newTheme[change.variableName] = change.newValue;
    //     }
    //     return newTheme;
    //   });
    // }
  }

  /**
   * Add scoped classes to DOM elements for a component
   */
  addScopedClassesToComponent(componentId: string, element: Element): void {
    const scopeId = `svelte-${this.generateScopeId(componentId)}`;
    element.classList.add(scopeId);
    
    // Also add to all child elements
    const children = element.querySelectorAll('*');
    children.forEach(child => {
      child.classList.add(scopeId);
    });
  }

  /**
   * Get Svelte component style state
   */
  getComponentStyleState(componentId: string): SvelteStyleState | undefined {
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
      console.log(`[SvelteCSS] Removed styles for component ${componentId}`);
    }
  }

  /**
   * Get all registered Svelte components
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