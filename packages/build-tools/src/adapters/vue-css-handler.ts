/**
 * Vue CSS Handler
 * 
 * Handles CSS and styling updates for Vue components during hot reload.
 * Provides Vue-specific styling update mechanisms without component remount.
 */

import { FrameworkStyleHandler, ThemeChange } from '../css-hot-reload-manager.js';

interface VueStyleState {
  componentId: string;
  styles: string;
  scopedStyles: string;
  themeVariables: Map<string, string>;
  lastUpdated: number;
}

/**
 * Vue-specific CSS handler
 */
export class VueCSSHandler implements FrameworkStyleHandler {
  readonly frameworkName = 'vue';
  
  private componentStyles = new Map<string, VueStyleState>();
  private styleElements = new Map<string, HTMLStyleElement>();
  private debugLogging = false;

  constructor(options: { debugLogging?: boolean } = {}) {
    this.debugLogging = options.debugLogging || false;
  }

  /**
   * Update styles for a Vue component
   */
  async updateStyles(componentId: string, styles: string): Promise<void> {
    try {
      const scopedStyles = this.addVueStyleScoping(componentId, styles);
      
      const styleState: VueStyleState = {
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

      // Trigger Vue component style update without remount
      await this.triggerVueStyleUpdate(componentId);

      if (this.debugLogging) {
        console.log(`[VueCSS] Updated styles for component ${componentId}`);
      }

    } catch (error) {
      console.error(`[VueCSS] Failed to update styles for component ${componentId}:`, error);
      throw error;
    }
  }

  /**
   * Update theme variables for Vue components
   */
  async updateTheme(themeChanges: ThemeChange[]): Promise<void> {
    try {
      // Update theme variables for all Vue components
      for (const [componentId, styleState] of this.componentStyles.entries()) {
        for (const change of themeChanges) {
          styleState.themeVariables.set(change.variableName, change.newValue);
        }
        styleState.lastUpdated = Date.now();
      }

      // Apply theme changes to Vue components
      await this.applyThemeChangesToVueComponents(themeChanges);

      if (this.debugLogging) {
        console.log(`[VueCSS] Applied ${themeChanges.length} theme changes to Vue components`);
      }

    } catch (error) {
      console.error('[VueCSS] Failed to update theme for Vue components:', error);
      throw error;
    }
  }

  /**
   * Extract current styles from a Vue component
   */
  extractComponentStyles(componentId: string): string | null {
    const styleState = this.componentStyles.get(componentId);
    return styleState ? styleState.styles : null;
  }

  /**
   * Validate style integrity for a Vue component
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
      console.error(`[VueCSS] Error validating style integrity for ${componentId}:`, error);
      return false;
    }
  }

  /**
   * Update component styles in the DOM
   */
  private async updateComponentStylesInDOM(componentId: string, scopedStyles: string): Promise<void> {
    const styleId = `vue-component-${componentId}`;
    let styleElement = this.styleElements.get(componentId);

    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.type = 'text/css';
      styleElement.setAttribute('data-framework', 'vue');
      styleElement.setAttribute('data-component', componentId);
      document.head.appendChild(styleElement);
      this.styleElements.set(componentId, styleElement);
    }

    // Update style content with scoped styles
    styleElement.textContent = scopedStyles;
  }

  /**
   * Add Vue-specific style scoping (similar to Vue's scoped CSS)
   */
  private addVueStyleScoping(componentId: string, styles: string): string {
    // Generate a unique scope identifier for this component
    const scopeId = `data-v-${this.generateScopeId(componentId)}`;
    
    // Add Vue-style scoping to all selectors
    return styles.replace(/([^{}]+){/g, (match, selector) => {
      const trimmedSelector = selector.trim();
      
      // Skip @-rules and already scoped selectors
      if (trimmedSelector.startsWith('@') || trimmedSelector.includes(scopeId)) {
        return match;
      }
      
      // Add Vue scoping attribute
      return `${trimmedSelector}[${scopeId}] {`;
    });
  }

  /**
   * Generate a scope ID similar to Vue's scoped CSS
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
   * Trigger Vue component style update without remount
   */
  private async triggerVueStyleUpdate(componentId: string): Promise<void> {
    // In a real implementation, this would trigger Vue's reactivity system
    // to update component styles without remounting
    
    // Dispatch custom event for Vue components to listen to
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('vue-style-update', {
        detail: {
          componentId,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(event);
    }

    // Update Vue components that might be using CSS modules or CSS-in-JS
    await this.updateVueCSSModules(componentId);
  }

  /**
   * Apply theme changes to Vue components
   */
  private async applyThemeChangesToVueComponents(themeChanges: ThemeChange[]): Promise<void> {
    // Update CSS custom properties in the document root
    for (const change of themeChanges) {
      document.documentElement.style.setProperty(change.variableName, change.newValue);
    }

    // Notify Vue components about theme changes
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('vue-theme-update', {
        detail: {
          themeChanges,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(event);
    }

    // Update Vue components with reactive theme variables
    await this.updateVueReactiveTheme(themeChanges);
  }

  /**
   * Update Vue CSS modules
   */
  private async updateVueCSSModules(componentId: string): Promise<void> {
    // In a real implementation, this would interact with Vue's CSS modules system
    // to update component styles without remounting
    
    if (this.debugLogging) {
      console.log(`[VueCSS] Updating CSS modules for Vue component ${componentId}`);
    }
  }

  /**
   * Update Vue reactive theme variables
   */
  private async updateVueReactiveTheme(themeChanges: ThemeChange[]): Promise<void> {
    // In a real implementation, this would update Vue's reactive theme system
    // This could involve updating a global reactive theme object that components watch
    
    if (this.debugLogging) {
      console.log(`[VueCSS] Updating Vue reactive theme with ${themeChanges.length} changes`);
    }

    // If Vue 3 composition API is available, update reactive theme
    if (typeof window !== 'undefined' && (window as any).Vue) {
      await this.updateVue3ReactiveTheme(themeChanges);
    }
  }

  /**
   * Update Vue 3 reactive theme using composition API
   */
  private async updateVue3ReactiveTheme(themeChanges: ThemeChange[]): Promise<void> {
    // In a real implementation, this would update a reactive theme object
    // that Vue components can watch for changes
    
    if (this.debugLogging) {
      console.log(`[VueCSS] Updating Vue 3 reactive theme`);
    }
  }

  /**
   * Add scoped attributes to DOM elements for a component
   */
  addScopedAttributesToComponent(componentId: string, element: Element): void {
    const scopeId = `data-v-${this.generateScopeId(componentId)}`;
    element.setAttribute(scopeId, '');
    
    // Also add to all child elements
    const children = element.querySelectorAll('*');
    children.forEach(child => {
      child.setAttribute(scopeId, '');
    });
  }

  /**
   * Get Vue component style state
   */
  getComponentStyleState(componentId: string): VueStyleState | undefined {
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
      console.log(`[VueCSS] Removed styles for component ${componentId}`);
    }
  }

  /**
   * Get all registered Vue components
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