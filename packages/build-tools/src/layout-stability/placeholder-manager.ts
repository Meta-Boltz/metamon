/**
 * Placeholder Manager
 * Creates and manages placeholder elements to prevent layout shifts
 */

import { ComponentDefinition, PlaceholderConfig, TransitionConfig } from './types.js';

export class PlaceholderManager {
  private placeholders = new Map<string, HTMLElement>();
  private config: PlaceholderConfig;
  private transitionConfig: TransitionConfig;

  constructor(
    placeholderConfig: PlaceholderConfig,
    transitionConfig: TransitionConfig
  ) {
    this.config = placeholderConfig;
    this.transitionConfig = transitionConfig;
  }

  /**
   * Create a placeholder for a component
   */
  createPlaceholder(component: ComponentDefinition, targetElement?: HTMLElement): HTMLElement {
    const placeholder = document.createElement('div');
    placeholder.className = 'metamon-placeholder';
    placeholder.setAttribute('data-component-id', component.id);
    placeholder.setAttribute('data-framework', component.framework);

    // Set dimensions
    this.setPlaceholderDimensions(placeholder, component, targetElement);

    // Apply styling
    this.applyPlaceholderStyling(placeholder);

    // Add loading indicator if enabled
    if (this.config.showLoadingIndicator) {
      this.addLoadingIndicator(placeholder);
    }

    // Store reference
    this.placeholders.set(component.id, placeholder);

    return placeholder;
  }

  /**
   * Replace placeholder with actual component
   */
  async replacePlaceholder(
    componentId: string, 
    actualElement: HTMLElement
  ): Promise<void> {
    const placeholder = this.placeholders.get(componentId);
    if (!placeholder || !placeholder.parentNode) {
      return;
    }

    try {
      // Ensure actual element has same dimensions initially
      this.matchDimensions(actualElement, placeholder);

      // Perform transition
      await this.performTransition(placeholder, actualElement);

      // Clean up
      this.placeholders.delete(componentId);
    } catch (error) {
      console.warn('Error replacing placeholder:', error);
      // Fallback: direct replacement
      placeholder.parentNode.replaceChild(actualElement, placeholder);
      this.placeholders.delete(componentId);
    }
  }

  /**
   * Remove placeholder without replacement
   */
  removePlaceholder(componentId: string): void {
    const placeholder = this.placeholders.get(componentId);
    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.removeChild(placeholder);
      this.placeholders.delete(componentId);
    }
  }

  /**
   * Get placeholder element
   */
  getPlaceholder(componentId: string): HTMLElement | undefined {
    return this.placeholders.get(componentId);
  }

  /**
   * Check if placeholder exists
   */
  hasPlaceholder(componentId: string): boolean {
    return this.placeholders.has(componentId);
  }

  /**
   * Get all active placeholders
   */
  getActivePlaceholders(): Map<string, HTMLElement> {
    return new Map(this.placeholders);
  }

  /**
   * Clear all placeholders
   */
  clearAll(): void {
    this.placeholders.forEach((placeholder, componentId) => {
      this.removePlaceholder(componentId);
    });
  }

  /**
   * Set placeholder dimensions based on component definition or target element
   */
  private setPlaceholderDimensions(
    placeholder: HTMLElement,
    component: ComponentDefinition,
    targetElement?: HTMLElement
  ): void {
    let width: number;
    let height: number;

    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
    } else if (component.estimatedSize) {
      width = component.estimatedSize.width;
      height = component.estimatedSize.height;
    } else {
      // Default dimensions
      width = 200;
      height = 100;
    }

    placeholder.style.width = `${width}px`;
    placeholder.style.height = `${height}px`;
    placeholder.style.minWidth = `${width}px`;
    placeholder.style.minHeight = `${height}px`;

    if (this.config.maintainAspectRatio && width && height) {
      placeholder.style.aspectRatio = `${width} / ${height}`;
    }
  }

  /**
   * Apply styling to placeholder
   */
  private applyPlaceholderStyling(placeholder: HTMLElement): void {
    // Base styles
    placeholder.style.display = 'block';
    placeholder.style.position = 'relative';
    placeholder.style.overflow = 'hidden';
    placeholder.style.boxSizing = 'border-box';

    // Background
    if (this.config.backgroundColor) {
      placeholder.style.backgroundColor = this.config.backgroundColor;
    } else {
      placeholder.style.backgroundColor = '#f0f0f0';
    }

    // Border radius
    if (this.config.borderRadius) {
      placeholder.style.borderRadius = this.config.borderRadius;
    }

    // Animation
    if (this.config.animation && this.config.animation.type !== 'none') {
      this.applyPlaceholderAnimation(placeholder);
    }
  }

  /**
   * Apply animation to placeholder
   */
  private applyPlaceholderAnimation(placeholder: HTMLElement): void {
    const { animation } = this.config;
    if (!animation) return;

    const animationName = `metamon-placeholder-${animation.type}`;
    placeholder.style.animation = `${animationName} ${animation.duration}ms ${animation.easing} infinite`;

    // Inject CSS if not already present
    this.injectAnimationCSS(animation.type, animation.duration, animation.easing);
  }

  /**
   * Add loading indicator to placeholder
   */
  private addLoadingIndicator(placeholder: HTMLElement): void {
    const indicator = document.createElement('div');
    indicator.className = 'metamon-loading-indicator';

    switch (this.config.loadingIndicatorType) {
      case 'spinner':
        this.createSpinnerIndicator(indicator);
        break;
      case 'skeleton':
        this.createSkeletonIndicator(indicator);
        break;
      case 'pulse':
        this.createPulseIndicator(indicator);
        break;
      case 'custom':
        if (this.config.customLoadingContent) {
          indicator.innerHTML = this.config.customLoadingContent;
        }
        break;
    }

    placeholder.appendChild(indicator);
  }

  /**
   * Create spinner loading indicator
   */
  private createSpinnerIndicator(indicator: HTMLElement): void {
    indicator.innerHTML = `
      <div class="metamon-spinner">
        <div></div><div></div><div></div><div></div>
      </div>
    `;
    
    indicator.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    `;

    this.injectSpinnerCSS();
  }

  /**
   * Create skeleton loading indicator
   */
  private createSkeletonIndicator(indicator: HTMLElement): void {
    indicator.innerHTML = `
      <div class="metamon-skeleton-line" style="width: 80%; height: 16px; margin-bottom: 8px;"></div>
      <div class="metamon-skeleton-line" style="width: 60%; height: 16px; margin-bottom: 8px;"></div>
      <div class="metamon-skeleton-line" style="width: 70%; height: 16px;"></div>
    `;

    indicator.style.cssText = `
      position: absolute;
      top: 20px;
      left: 20px;
      right: 20px;
    `;

    this.injectSkeletonCSS();
  }

  /**
   * Create pulse loading indicator
   */
  private createPulseIndicator(indicator: HTMLElement): void {
    indicator.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
      animation: metamon-pulse 1.5s ease-in-out infinite;
    `;

    this.injectPulseCSS();
  }

  /**
   * Match dimensions between elements
   */
  private matchDimensions(target: HTMLElement, source: HTMLElement): void {
    const sourceRect = source.getBoundingClientRect();
    target.style.width = `${sourceRect.width}px`;
    target.style.height = `${sourceRect.height}px`;
  }

  /**
   * Perform transition between placeholder and actual element
   */
  private async performTransition(
    placeholder: HTMLElement,
    actualElement: HTMLElement
  ): Promise<void> {
    const parent = placeholder.parentNode as HTMLElement;
    if (!parent) return;

    // Position actual element
    actualElement.style.position = 'absolute';
    actualElement.style.top = placeholder.offsetTop + 'px';
    actualElement.style.left = placeholder.offsetLeft + 'px';
    actualElement.style.opacity = '0';

    // Insert actual element
    parent.insertBefore(actualElement, placeholder);

    return new Promise((resolve) => {
      const { duration, easing, fadeOut, fadeIn, crossFade } = this.transitionConfig;

      if (crossFade) {
        // Cross-fade transition
        placeholder.style.transition = `opacity ${duration}ms ${easing}`;
        actualElement.style.transition = `opacity ${duration}ms ${easing}`;
        
        placeholder.style.opacity = '0';
        actualElement.style.opacity = '1';
      } else {
        // Sequential fade
        if (fadeOut) {
          placeholder.style.transition = `opacity ${duration / 2}ms ${easing}`;
          placeholder.style.opacity = '0';
          
          setTimeout(() => {
            if (fadeIn) {
              actualElement.style.transition = `opacity ${duration / 2}ms ${easing}`;
              actualElement.style.opacity = '1';
            } else {
              actualElement.style.opacity = '1';
            }
          }, duration / 2);
        } else {
          actualElement.style.opacity = '1';
        }
      }

      setTimeout(() => {
        // Clean up
        actualElement.style.position = '';
        actualElement.style.top = '';
        actualElement.style.left = '';
        actualElement.style.transition = '';
        
        if (placeholder.parentNode) {
          placeholder.parentNode.removeChild(placeholder);
        }
        
        resolve();
      }, duration);
    });
  }

  /**
   * Inject animation CSS
   */
  private injectAnimationCSS(type: string, duration: number, easing: string): void {
    const styleId = `metamon-placeholder-${type}-animation`;
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;

    let keyframes = '';
    switch (type) {
      case 'fade':
        keyframes = `
          @keyframes metamon-placeholder-fade {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
        `;
        break;
      case 'slide':
        keyframes = `
          @keyframes metamon-placeholder-slide {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `;
        break;
      case 'scale':
        keyframes = `
          @keyframes metamon-placeholder-scale {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
        `;
        break;
    }

    style.textContent = keyframes;
    document.head.appendChild(style);
  }

  /**
   * Inject spinner CSS
   */
  private injectSpinnerCSS(): void {
    const styleId = 'metamon-spinner-css';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .metamon-spinner {
        display: inline-block;
        position: relative;
        width: 40px;
        height: 40px;
      }
      .metamon-spinner div {
        box-sizing: border-box;
        display: block;
        position: absolute;
        width: 32px;
        height: 32px;
        margin: 4px;
        border: 4px solid #ccc;
        border-radius: 50%;
        animation: metamon-spinner-rotate 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
        border-color: #ccc transparent transparent transparent;
      }
      .metamon-spinner div:nth-child(1) { animation-delay: -0.45s; }
      .metamon-spinner div:nth-child(2) { animation-delay: -0.3s; }
      .metamon-spinner div:nth-child(3) { animation-delay: -0.15s; }
      @keyframes metamon-spinner-rotate {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Inject skeleton CSS
   */
  private injectSkeletonCSS(): void {
    const styleId = 'metamon-skeleton-css';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .metamon-skeleton-line {
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: metamon-skeleton-loading 1.5s infinite;
        border-radius: 4px;
      }
      @keyframes metamon-skeleton-loading {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Inject pulse CSS
   */
  private injectPulseCSS(): void {
    const styleId = 'metamon-pulse-css';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes metamon-pulse {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
    `;
    document.head.appendChild(style);
  }
}