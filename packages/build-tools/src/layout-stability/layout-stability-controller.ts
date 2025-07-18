/**
 * Layout Stability Controller
 * Main controller for preventing layout shifts during component loading
 */

import { CLSMonitor } from './cls-monitor.js';
import { PlaceholderManager } from './placeholder-manager.js';
import {
  LayoutReservation,
  ComponentDefinition,
  LayoutStabilityConfig,
  LayoutStabilityMetrics,
  LayoutStabilityEvent,
  LayoutStabilityEventType,
  CLSMetrics,
  TransitionConfig
} from './types.js';

export class LayoutStabilityController {
  private clsMonitor: CLSMonitor;
  private placeholderManager: PlaceholderManager;
  private reservations = new Map<string, LayoutReservation>();
  private config: LayoutStabilityConfig;
  private metrics: LayoutStabilityMetrics;
  private eventListeners = new Map<LayoutStabilityEventType, Array<(event: LayoutStabilityEvent) => void>>();
  private reservationCleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<LayoutStabilityConfig> = {}) {
    this.config = this.mergeConfig(config);
    this.clsMonitor = new CLSMonitor(this.config.clsThreshold);
    this.placeholderManager = new PlaceholderManager(
      this.config.placeholderConfig,
      this.config.transitionConfig
    );

    this.metrics = {
      totalReservations: 0,
      activeReservations: 0,
      expiredReservations: 0,
      averageReservationDuration: 0,
      clsScore: 0,
      layoutShiftsCount: 0,
      transitionsCount: 0,
      averageTransitionDuration: 0
    };

    this.initialize();
  }

  /**
   * Initialize the controller
   */
  private initialize(): void {
    // Start CLS monitoring
    this.clsMonitor.startMonitoring();

    // Listen to CLS metrics updates
    this.clsMonitor.addListener((metrics: CLSMetrics) => {
      this.metrics.clsScore = metrics.score;
      this.metrics.layoutShiftsCount = metrics.shifts.length;

      if (metrics.score > this.config.clsThreshold) {
        this.emitEvent('cls-threshold-exceeded', { metrics });
      }
    });

    // Start cleanup interval for expired reservations
    this.startReservationCleanup();

    if (this.config.enableLogging) {
      console.log('Layout Stability Controller initialized');
    }
  }

  /**
   * Preserve layout for an element by creating a reservation
   */
  preserveLayout(element: HTMLElement, componentId?: string): LayoutReservation {
    const id = this.generateReservationId();
    const dimensions = element.getBoundingClientRect();
    const expiresAt = Date.now() + this.config.reservationTimeout;

    // Create placeholder if enabled
    let placeholder: HTMLElement;
    if (this.config.enablePlaceholders && componentId) {
      const componentDef: ComponentDefinition = {
        id: componentId,
        framework: element.getAttribute('data-framework') || 'unknown',
        tagName: element.tagName.toLowerCase(),
        isInteractive: this.isInteractiveElement(element),
        estimatedSize: {
          width: dimensions.width,
          height: dimensions.height
        }
      };

      placeholder = this.placeholderManager.createPlaceholder(componentDef, element);
    } else {
      // Create simple placeholder
      placeholder = this.createSimplePlaceholder(dimensions);
    }

    const reservation: LayoutReservation = {
      id,
      element,
      dimensions,
      placeholder,
      expiresAt,
      componentId,
      framework: element.getAttribute('data-framework') || undefined
    };

    // Store reservation
    this.reservations.set(id, reservation);
    this.metrics.totalReservations++;
    this.metrics.activeReservations++;

    // Insert placeholder
    if (element.parentNode) {
      element.parentNode.insertBefore(placeholder, element);
    }

    this.emitEvent('reservation-created', { reservation });

    if (this.config.enableLogging) {
      console.log(`Layout reservation created: ${id}`);
    }

    return reservation;
  }

  /**
   * Release a layout reservation
   */
  releaseLayout(reservation: LayoutReservation): void {
    const storedReservation = this.reservations.get(reservation.id);
    if (!storedReservation) {
      return;
    }

    // Remove placeholder
    if (storedReservation.placeholder.parentNode) {
      storedReservation.placeholder.parentNode.removeChild(storedReservation.placeholder);
    }

    // Update metrics
    const duration = Date.now() - (storedReservation.expiresAt - this.config.reservationTimeout);
    this.updateAverageReservationDuration(duration);
    this.metrics.activeReservations--;

    // Remove reservation
    this.reservations.delete(reservation.id);

    this.emitEvent('reservation-released', { reservation: storedReservation });

    if (this.config.enableLogging) {
      console.log(`Layout reservation released: ${reservation.id}`);
    }
  }

  /**
   * Create placeholder for a component
   */
  createPlaceholder(component: ComponentDefinition): HTMLElement {
    const placeholder = this.placeholderManager.createPlaceholder(component);
    this.emitEvent('placeholder-created', { component, placeholder });
    return placeholder;
  }

  /**
   * Replace placeholder with actual component
   */
  async replacePlaceholder(componentId: string, actualElement: HTMLElement): Promise<void> {
    const startTime = performance.now();

    try {
      await this.placeholderManager.replacePlaceholder(componentId, actualElement);
      
      const duration = performance.now() - startTime;
      this.metrics.transitionsCount++;
      this.updateAverageTransitionDuration(duration);

      this.emitEvent('placeholder-replaced', { componentId, actualElement, duration });

      if (this.config.enableLogging) {
        console.log(`Placeholder replaced for component: ${componentId} (${duration.toFixed(2)}ms)`);
      }
    } catch (error) {
      console.error('Error replacing placeholder:', error);
      throw error;
    }
  }

  /**
   * Create seamless transition between elements
   */
  async createSeamlessTransition(from: HTMLElement, to: HTMLElement): Promise<void> {
    const startTime = performance.now();

    try {
      // Ensure 'to' element matches 'from' element dimensions initially
      const fromRect = from.getBoundingClientRect();
      to.style.width = `${fromRect.width}px`;
      to.style.height = `${fromRect.height}px`;

      // Position 'to' element at same location
      to.style.position = 'absolute';
      to.style.top = `${fromRect.top}px`;
      to.style.left = `${fromRect.left}px`;
      to.style.opacity = '0';

      // Insert 'to' element
      if (from.parentNode) {
        from.parentNode.insertBefore(to, from);
      }

      // Perform transition
      await this.performElementTransition(from, to);

      const duration = performance.now() - startTime;
      this.metrics.transitionsCount++;
      this.updateAverageTransitionDuration(duration);

      this.emitEvent('transition-completed', { from, to, duration });

      if (this.config.enableLogging) {
        console.log(`Seamless transition completed (${duration.toFixed(2)}ms)`);
      }
    } catch (error) {
      console.error('Error creating seamless transition:', error);
      throw error;
    }
  }

  /**
   * Measure current CLS score
   */
  measureLayoutShift(): CLSMetrics {
    return this.clsMonitor.getMetrics();
  }

  /**
   * Optimize for CLS with given threshold
   */
  optimizeForCLS(threshold: number): void {
    this.config.clsThreshold = threshold;
    this.clsMonitor = new CLSMonitor(threshold);
    this.clsMonitor.startMonitoring();

    if (this.config.enableLogging) {
      console.log(`CLS optimization enabled with threshold: ${threshold}`);
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): LayoutStabilityMetrics {
    const clsMetrics = this.clsMonitor.getMetrics();
    return {
      ...this.metrics,
      clsScore: clsMetrics.score,
      layoutShiftsCount: clsMetrics.shifts.length
    };
  }

  /**
   * Add event listener
   */
  addEventListener(
    type: LayoutStabilityEventType,
    listener: (event: LayoutStabilityEvent) => void
  ): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type)!.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(
    type: LayoutStabilityEventType,
    listener: (event: LayoutStabilityEvent) => void
  ): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Destroy the controller
   */
  destroy(): void {
    // Stop CLS monitoring
    this.clsMonitor.stopMonitoring();

    // Clear all reservations
    this.reservations.forEach(reservation => {
      this.releaseLayout(reservation);
    });

    // Clear all placeholders
    this.placeholderManager.clearAll();

    // Stop cleanup interval
    if (this.reservationCleanupInterval) {
      clearInterval(this.reservationCleanupInterval);
    }

    // Clear event listeners
    this.eventListeners.clear();

    if (this.config.enableLogging) {
      console.log('Layout Stability Controller destroyed');
    }
  }

  /**
   * Merge configuration with defaults
   */
  private mergeConfig(config: Partial<LayoutStabilityConfig>): LayoutStabilityConfig {
    const defaultConfig: LayoutStabilityConfig = {
      clsThreshold: 0.1,
      measurementDuration: 5000,
      reservationTimeout: 10000,
      enablePlaceholders: true,
      placeholderConfig: {
        showLoadingIndicator: true,
        loadingIndicatorType: 'skeleton',
        maintainAspectRatio: true,
        backgroundColor: '#f0f0f0',
        borderRadius: '4px',
        animation: {
          type: 'pulse',
          duration: 1500,
          easing: 'ease-in-out'
        }
      },
      transitionConfig: {
        duration: 300,
        easing: 'ease-out',
        fadeOut: true,
        fadeIn: true,
        crossFade: false,
        maintainPosition: true
      },
      enableMetrics: true,
      enableLogging: false
    };

    return {
      ...defaultConfig,
      ...config,
      placeholderConfig: {
        ...defaultConfig.placeholderConfig,
        ...config.placeholderConfig
      },
      transitionConfig: {
        ...defaultConfig.transitionConfig,
        ...config.transitionConfig
      }
    };
  }

  /**
   * Generate unique reservation ID
   */
  private generateReservationId(): string {
    return `reservation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if element is interactive
   */
  private isInteractiveElement(element: HTMLElement): boolean {
    const interactiveTags = ['button', 'input', 'select', 'textarea', 'a'];
    const tagName = element.tagName.toLowerCase();
    
    return interactiveTags.includes(tagName) ||
           element.hasAttribute('onclick') ||
           element.hasAttribute('data-interactive') ||
           element.getAttribute('role') === 'button';
  }

  /**
   * Create simple placeholder element
   */
  private createSimplePlaceholder(dimensions: DOMRect): HTMLElement {
    const placeholder = document.createElement('div');
    placeholder.className = 'metamon-simple-placeholder';
    placeholder.style.cssText = `
      width: ${dimensions.width}px;
      height: ${dimensions.height}px;
      background-color: #f0f0f0;
      border-radius: 4px;
      display: block;
      box-sizing: border-box;
    `;
    return placeholder;
  }

  /**
   * Perform transition between two elements
   */
  private async performElementTransition(from: HTMLElement, to: HTMLElement): Promise<void> {
    const { duration, easing, fadeOut, fadeIn, crossFade } = this.config.transitionConfig;

    return new Promise((resolve) => {
      if (crossFade) {
        // Cross-fade transition
        from.style.transition = `opacity ${duration}ms ${easing}`;
        to.style.transition = `opacity ${duration}ms ${easing}`;
        
        from.style.opacity = '0';
        to.style.opacity = '1';
      } else {
        // Sequential transition
        if (fadeOut) {
          from.style.transition = `opacity ${duration / 2}ms ${easing}`;
          from.style.opacity = '0';
          
          setTimeout(() => {
            if (fadeIn) {
              to.style.transition = `opacity ${duration / 2}ms ${easing}`;
              to.style.opacity = '1';
            } else {
              to.style.opacity = '1';
            }
          }, duration / 2);
        } else {
          to.style.opacity = '1';
        }
      }

      setTimeout(() => {
        // Clean up
        to.style.position = '';
        to.style.top = '';
        to.style.left = '';
        to.style.transition = '';
        
        if (from.parentNode) {
          from.parentNode.removeChild(from);
        }
        
        resolve();
      }, duration);
    });
  }

  /**
   * Start cleanup interval for expired reservations
   */
  private startReservationCleanup(): void {
    this.reservationCleanupInterval = setInterval(() => {
      const now = Date.now();
      const expiredReservations: LayoutReservation[] = [];

      this.reservations.forEach(reservation => {
        if (reservation.expiresAt < now) {
          expiredReservations.push(reservation);
        }
      });

      expiredReservations.forEach(reservation => {
        this.releaseLayout(reservation);
        this.metrics.expiredReservations++;
        this.emitEvent('reservation-expired', { reservation });
      });
    }, 1000);
  }

  /**
   * Update average reservation duration
   */
  private updateAverageReservationDuration(duration: number): void {
    if (this.metrics.totalReservations === 1) {
      this.metrics.averageReservationDuration = duration;
    } else {
      const totalDuration = this.metrics.averageReservationDuration * (this.metrics.totalReservations - 1);
      this.metrics.averageReservationDuration = (totalDuration + duration) / this.metrics.totalReservations;
    }
  }

  /**
   * Update average transition duration
   */
  private updateAverageTransitionDuration(duration: number): void {
    if (this.metrics.transitionsCount === 1) {
      this.metrics.averageTransitionDuration = duration;
    } else {
      const totalDuration = this.metrics.averageTransitionDuration * (this.metrics.transitionsCount - 1);
      this.metrics.averageTransitionDuration = (totalDuration + duration) / this.metrics.transitionsCount;
    }
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(type: LayoutStabilityEventType, data: any): void {
    const event: LayoutStabilityEvent = {
      type,
      timestamp: Date.now(),
      data,
      reservationId: data.reservation?.id,
      componentId: data.componentId || data.component?.id
    };

    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.warn(`Error in layout stability event listener for ${type}:`, error);
        }
      });
    }

    // Also emit as DOM event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(`metamon-layout-${type}`, { detail: event }));
    }
  }
}