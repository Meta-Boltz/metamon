/**
 * Layout Stability Controller Example
 * Demonstrates how to use the layout stability controller to prevent CLS
 */

import { 
  LayoutStabilityController, 
  ComponentDefinition, 
  LayoutStabilityConfig 
} from '../layout-stability/index.js';

// Example configuration for layout stability
const layoutStabilityConfig: Partial<LayoutStabilityConfig> = {
  clsThreshold: 0.1, // Target CLS score below 0.1
  enablePlaceholders: true,
  placeholderConfig: {
    showLoadingIndicator: true,
    loadingIndicatorType: 'skeleton',
    maintainAspectRatio: true,
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
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
  enableLogging: true
};

// Initialize the layout stability controller
const layoutController = new LayoutStabilityController(layoutStabilityConfig);

/**
 * Example 1: Basic Layout Reservation
 * Use this when you know an element will be replaced asynchronously
 */
export function basicLayoutReservationExample() {
  console.log('=== Basic Layout Reservation Example ===');
  
  // Get the element that will be replaced
  const targetElement = document.getElementById('async-content');
  if (!targetElement) return;

  // Create a layout reservation to prevent shifts
  const reservation = layoutController.preserveLayout(targetElement, 'async-content');
  console.log('Layout reservation created:', reservation.id);

  // Simulate async content loading
  setTimeout(() => {
    // Release the reservation when content is ready
    layoutController.releaseLayout(reservation);
    console.log('Layout reservation released');
  }, 2000);
}

/**
 * Example 2: Component Placeholder Management
 * Use this for framework components that load asynchronously
 */
export function componentPlaceholderExample() {
  console.log('=== Component Placeholder Example ===');

  // Define the component that will be loaded
  const componentDef: ComponentDefinition = {
    id: 'user-profile-card',
    framework: 'react',
    tagName: 'div',
    isInteractive: true,
    estimatedSize: {
      width: 320,
      height: 240
    }
  };

  // Create placeholder
  const placeholder = layoutController.createPlaceholder(componentDef);
  
  // Insert placeholder into DOM
  const container = document.getElementById('component-container');
  if (container) {
    container.appendChild(placeholder);
    console.log('Placeholder created and inserted');

    // Simulate component loading
    setTimeout(async () => {
      // Create the actual component element
      const actualComponent = document.createElement('div');
      actualComponent.className = 'user-profile-card';
      actualComponent.innerHTML = `
        <div class="profile-header">
          <img src="/avatar.jpg" alt="User Avatar" />
          <h3>John Doe</h3>
        </div>
        <div class="profile-content">
          <p>Software Developer</p>
          <button>Follow</button>
        </div>
      `;

      // Replace placeholder with actual component
      await layoutController.replacePlaceholder('user-profile-card', actualComponent);
      console.log('Placeholder replaced with actual component');
    }, 3000);
  }
}

/**
 * Example 3: Seamless Element Transitions
 * Use this for smooth transitions between different content states
 */
export function seamlessTransitionExample() {
  console.log('=== Seamless Transition Example ===');

  const loadingElement = document.getElementById('loading-state');
  const contentElement = document.getElementById('loaded-content');

  if (loadingElement && contentElement) {
    // Initially hide the content element
    contentElement.style.display = 'none';

    // Simulate content loading
    setTimeout(async () => {
      // Show content element
      contentElement.style.display = 'block';

      // Create seamless transition
      await layoutController.createSeamlessTransition(loadingElement, contentElement);
      console.log('Seamless transition completed');
    }, 2500);
  }
}

/**
 * Example 4: CLS Monitoring and Optimization
 * Monitor layout shifts and optimize for Core Web Vitals
 */
export function clsMonitoringExample() {
  console.log('=== CLS Monitoring Example ===');

  // Add event listener for CLS threshold exceeded
  layoutController.addEventListener('cls-threshold-exceeded', (event) => {
    console.warn('CLS threshold exceeded!', event.data);
    
    // Take corrective action
    optimizeForCLS();
  });

  // Add event listener for layout shift detection
  layoutController.addEventListener('layout-shift-detected', (event) => {
    console.log('Layout shift detected:', event.data);
  });

  // Monitor CLS score periodically
  setInterval(() => {
    const clsMetrics = layoutController.measureLayoutShift();
    console.log('Current CLS score:', clsMetrics.score.toFixed(4));
    
    if (clsMetrics.score > 0.05) {
      console.warn('CLS score is getting high, consider optimization');
    }
  }, 5000);
}

/**
 * Example 5: Performance Metrics Collection
 * Collect and analyze layout stability metrics
 */
export function metricsCollectionExample() {
  console.log('=== Metrics Collection Example ===');

  // Collect metrics periodically
  setInterval(() => {
    const metrics = layoutController.getMetrics();
    
    console.log('Layout Stability Metrics:', {
      totalReservations: metrics.totalReservations,
      activeReservations: metrics.activeReservations,
      clsScore: metrics.clsScore.toFixed(4),
      layoutShiftsCount: metrics.layoutShiftsCount,
      transitionsCount: metrics.transitionsCount,
      averageTransitionDuration: metrics.averageTransitionDuration.toFixed(2) + 'ms'
    });

    // Send metrics to analytics service
    if (typeof window !== 'undefined' && (window as any).analytics) {
      (window as any).analytics.track('Layout Stability Metrics', metrics);
    }
  }, 10000);
}

/**
 * Helper function to optimize for CLS
 */
function optimizeForCLS() {
  console.log('Optimizing for CLS...');
  
  // Lower the CLS threshold for stricter monitoring
  layoutController.optimizeForCLS(0.05);
  
  // Enable more aggressive placeholder management
  const elements = document.querySelectorAll('[data-async-content]');
  elements.forEach((element, index) => {
    layoutController.preserveLayout(element as HTMLElement, `async-element-${index}`);
  });
}

/**
 * Example 6: Integration with Framework Loading
 * Combine with framework loader for optimal performance
 */
export function frameworkIntegrationExample() {
  console.log('=== Framework Integration Example ===');

  // Example of integrating with framework loading
  const frameworkComponents = [
    { id: 'react-component-1', framework: 'react', priority: 'high' },
    { id: 'vue-component-1', framework: 'vue', priority: 'normal' },
    { id: 'svelte-component-1', framework: 'svelte', priority: 'low' }
  ];

  frameworkComponents.forEach(async (comp) => {
    // Create placeholder while framework loads
    const componentDef: ComponentDefinition = {
      id: comp.id,
      framework: comp.framework,
      tagName: 'div',
      isInteractive: true,
      estimatedSize: { width: 300, height: 200 }
    };

    const placeholder = layoutController.createPlaceholder(componentDef);
    
    // Insert placeholder
    const container = document.getElementById(`${comp.framework}-container`);
    if (container) {
      container.appendChild(placeholder);

      // Simulate framework loading and component rendering
      setTimeout(async () => {
        const actualComponent = document.createElement('div');
        actualComponent.className = `${comp.framework}-component`;
        actualComponent.textContent = `${comp.framework.toUpperCase()} Component Loaded`;

        await layoutController.replacePlaceholder(comp.id, actualComponent);
        console.log(`${comp.framework} component loaded and placeholder replaced`);
      }, Math.random() * 3000 + 1000); // Random delay between 1-4 seconds
    }
  });
}

/**
 * Initialize all examples
 */
export function initializeLayoutStabilityExamples() {
  console.log('Initializing Layout Stability Examples...');

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runExamples);
  } else {
    runExamples();
  }
}

function runExamples() {
  // Run examples with delays to demonstrate different scenarios
  setTimeout(basicLayoutReservationExample, 1000);
  setTimeout(componentPlaceholderExample, 2000);
  setTimeout(seamlessTransitionExample, 3000);
  setTimeout(clsMonitoringExample, 4000);
  setTimeout(metricsCollectionExample, 5000);
  setTimeout(frameworkIntegrationExample, 6000);
}

// Cleanup function
export function cleanupLayoutStabilityController() {
  console.log('Cleaning up Layout Stability Controller...');
  layoutController.destroy();
}

// Export the controller instance for external use
export { layoutController };

// Auto-initialize if running in browser
if (typeof window !== 'undefined') {
  // Add to window for debugging
  (window as any).layoutStabilityController = layoutController;
  (window as any).layoutStabilityExamples = {
    basic: basicLayoutReservationExample,
    placeholder: componentPlaceholderExample,
    transition: seamlessTransitionExample,
    monitoring: clsMonitoringExample,
    metrics: metricsCollectionExample,
    framework: frameworkIntegrationExample,
    cleanup: cleanupLayoutStabilityController
  };
}