/**
 * SSR Optimization Example
 * 
 * Demonstrates how to use the SSR optimization system for server-side rendering
 * with selective hydration, framework requirement analysis, and progressive enhancement.
 */

import {
  SSROptimizationManager,
  SelectiveHydrationService,
  FrameworkRequirementAnalyzer,
  ProgressiveEnhancementFallback,
  ComponentDefinition,
  LoadPriority,
  FallbackStrategy
} from '../ssr-optimization/index.js';

/**
 * Example: Complete SSR optimization workflow
 */
export async function demonstrateSSROptimization() {
  console.log('🚀 Starting SSR Optimization Example');

  // 1. Define components for a typical web page
  const components: ComponentDefinition[] = [
    {
      id: 'header-nav',
      framework: 'react',
      component: 'HeaderNavigation',
      props: { 
        logo: '/logo.png',
        menuItems: ['Home', 'About', 'Contact']
      },
      isInteractive: true,
      priority: LoadPriority.CRITICAL
    },
    {
      id: 'hero-section',
      framework: 'vue',
      component: 'HeroSection',
      props: {
        title: 'Welcome to Our Site',
        subtitle: 'Building amazing experiences',
        backgroundImage: '/hero-bg.jpg'
      },
      isInteractive: false,
      priority: LoadPriority.CRITICAL
    },
    {
      id: 'product-carousel',
      framework: 'svelte',
      component: 'ProductCarousel',
      props: {
        products: [
          { id: 1, name: 'Product 1', price: 99.99 },
          { id: 2, name: 'Product 2', price: 149.99 }
        ]
      },
      isInteractive: true,
      priority: LoadPriority.HIGH
    },
    {
      id: 'testimonials',
      framework: 'solid',
      component: 'TestimonialSlider',
      props: {
        testimonials: [
          { author: 'John Doe', text: 'Great service!' },
          { author: 'Jane Smith', text: 'Highly recommended!' }
        ]
      },
      isInteractive: true,
      priority: LoadPriority.NORMAL
    },
    {
      id: 'newsletter-signup',
      framework: 'react',
      component: 'NewsletterForm',
      props: {
        placeholder: 'Enter your email',
        buttonText: 'Subscribe'
      },
      isInteractive: true,
      priority: LoadPriority.NORMAL
    },
    {
      id: 'footer-links',
      framework: 'vue',
      component: 'FooterLinks',
      props: {
        links: [
          { text: 'Privacy Policy', url: '/privacy' },
          { text: 'Terms of Service', url: '/terms' }
        ]
      },
      isInteractive: false,
      priority: LoadPriority.LOW
    }
  ];

  // 2. Initialize SSR optimization components
  const ssrManager = new SSROptimizationManager({
    enableSelectiveHydration: true,
    hydrateOnlyInteractive: true,
    enableProgressiveEnhancement: true,
    fallbackStrategy: FallbackStrategy.GRACEFUL_DEGRADATION,
    performanceThresholds: {
      maxHydrationTime: 100,
      maxFrameworkLoadTime: 200,
      maxLayoutShift: 0.1
    }
  });

  const hydrationService = new SelectiveHydrationService();
  const requirementAnalyzer = new FrameworkRequirementAnalyzer();
  const fallbackSystem = new ProgressiveEnhancementFallback({
    strategy: FallbackStrategy.GRACEFUL_DEGRADATION,
    enableOfflineMode: true,
    maxRetryAttempts: 3
  });

  try {
    // 3. Analyze framework requirements
    console.log('📊 Analyzing framework requirements...');
    const analysisResult = requirementAnalyzer.analyzeRequirements(components);
    
    console.log(`Total frameworks needed: ${analysisResult.requirements.length}`);
    console.log(`Critical frameworks: ${analysisResult.criticalFrameworks.join(', ')}`);
    console.log(`Deferred frameworks: ${analysisResult.deferredFrameworks.join(', ')}`);
    console.log(`Total estimated size: ${Math.round(analysisResult.totalEstimatedSize / 1024)}KB`);
    
    // 4. Optimize loading order
    const optimizedOrder = requirementAnalyzer.optimizeLoadingOrder(analysisResult.requirements);
    console.log('🎯 Optimized loading order:', optimizedOrder.map(r => r.framework));

    // 5. Calculate bundle splitting strategy
    const bundleStrategy = requirementAnalyzer.calculateBundleSplitting(analysisResult.requirements);
    console.log('📦 Bundle splitting strategy:');
    for (const [bundleName, contents] of bundleStrategy) {
      console.log(`  ${bundleName}: ${contents.length} items`);
    }

    // 6. Estimate performance impact
    const performanceImpact = requirementAnalyzer.estimatePerformanceImpact(analysisResult.requirements);
    console.log('⚡ Performance impact:');
    console.log(`  Initial load time: ${performanceImpact.initialLoadTime}ms`);
    console.log(`  Time to interactive: ${performanceImpact.interactiveTime}ms`);
    console.log(`  Total transfer size: ${Math.round(performanceImpact.totalTransferSize / 1024)}KB`);
    console.log(`  Cache efficiency: ${Math.round(performanceImpact.cacheEfficiency * 100)}%`);

    // 7. Render server content
    console.log('🏗️ Rendering server content...');
    const ssrResult = await ssrManager.renderServerContent(components);
    
    console.log(`Generated HTML length: ${ssrResult.html.length} characters`);
    console.log(`Critical CSS length: ${ssrResult.criticalCSS.length} characters`);
    console.log(`Hydration targets: ${ssrResult.hydrationData.components.length}`);

    // 8. Set up selective hydration
    console.log('💧 Setting up selective hydration...');
    const hydrationTargets = ssrManager.identifyHydrationTargets(ssrResult.html);
    
    // Register custom hydration strategy for demo
    hydrationService.registerStrategy({
      name: 'demo-viewport-strategy',
      shouldHydrate: (target) => target.priority === LoadPriority.HIGH,
      priority: LoadPriority.HIGH
    });

    // Process hydration targets
    hydrationService.processHydrationTargets(hydrationTargets);
    
    const queueStatus = hydrationService.getQueueStatus();
    console.log(`Hydration queue: ${queueStatus.pending} pending, ${queueStatus.hydrated} completed`);

    // 9. Enable progressive enhancement
    console.log('🛡️ Enabling progressive enhancement...');
    fallbackSystem.enableOfflineMode();
    
    // Simulate some failures for demonstration
    await demonstrateFailureHandling(ssrManager, fallbackSystem, components);

    // 10. Display final metrics
    console.log('📈 Final metrics:');
    const ssrMetrics = ssrManager.getMetrics();
    const fallbackMetrics = fallbackSystem.getMetrics();
    
    console.log('SSR Metrics:', {
      renderTime: `${ssrMetrics.renderTime}ms`,
      totalComponents: ssrMetrics.totalComponents,
      interactiveComponents: ssrMetrics.interactiveComponents
    });
    
    console.log('Fallback Metrics:', {
      ssrFailures: fallbackMetrics.ssrFailures,
      hydrationFailures: fallbackMetrics.hydrationFailures,
      fallbackActivations: fallbackMetrics.fallbackActivations
    });

    console.log('✅ SSR Optimization Example completed successfully!');
    
    return {
      ssrResult,
      analysisResult,
      performanceImpact,
      hydrationTargets,
      metrics: { ssr: ssrMetrics, fallback: fallbackMetrics }
    };

  } catch (error) {
    console.error('❌ SSR Optimization Example failed:', error);
    throw error;
  }
}

/**
 * Demonstrates failure handling scenarios
 */
async function demonstrateFailureHandling(
  ssrManager: SSROptimizationManager,
  fallbackSystem: ProgressiveEnhancementFallback,
  components: ComponentDefinition[]
) {
  console.log('🧪 Demonstrating failure handling...');

  // Simulate SSR failure
  try {
    await fallbackSystem.handleSSRFailure(components);
    console.log('  ✓ SSR failure handled gracefully');
  } catch (error) {
    console.log('  ⚠️ SSR failure handling error:', error);
  }

  // Simulate framework load failure
  try {
    const mockHydrationTarget = {
      componentId: 'test-component',
      framework: 'react' as const,
      isInteractive: true,
      priority: LoadPriority.HIGH,
      selector: '[data-test="component"]',
      props: {}
    };
    
    await fallbackSystem.handleFrameworkLoadFailure('react', mockHydrationTarget);
    console.log('  ✓ Framework load failure handled gracefully');
  } catch (error) {
    console.log('  ⚠️ Framework load failure handling error:', error);
  }

  // Simulate service worker failure
  try {
    fallbackSystem.handleServiceWorkerFailure();
    console.log('  ✓ Service worker failure handled gracefully');
  } catch (error) {
    console.log('  ⚠️ Service worker failure handling error:', error);
  }
}

/**
 * Example: Client-side hydration workflow
 */
export async function demonstrateClientSideHydration() {
  console.log('🌊 Starting Client-side Hydration Example');

  // Simulate SSR content in the DOM
  document.body.innerHTML = `
    <div data-hydration-id="header-nav" data-hydration-marker='{"id":"header-nav","framework":"react","isInteractive":true,"props":{"logo":"/logo.png"}}'>
      <nav>
        <img src="/logo.png" alt="Logo" />
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/about">About</a></li>
          <li><a href="/contact">Contact</a></li>
        </ul>
      </nav>
    </div>
    <div data-hydration-id="hero-section" data-hydration-marker='{"id":"hero-section","framework":"vue","isInteractive":false,"props":{"title":"Welcome"}}'>
      <section class="hero">
        <h1>Welcome to Our Site</h1>
        <p>Building amazing experiences</p>
      </section>
    </div>
    <div data-hydration-id="product-carousel" data-hydration-marker='{"id":"product-carousel","framework":"svelte","isInteractive":true,"props":{"products":[]}}'>
      <div class="carousel">
        <div class="product">Product 1 - $99.99</div>
        <div class="product">Product 2 - $149.99</div>
      </div>
    </div>
  `;

  const ssrManager = new SSROptimizationManager();
  const hydrationService = new SelectiveHydrationService();

  // Identify hydration targets from DOM
  const ssrContent = document.body.innerHTML;
  const hydrationTargets = ssrManager.identifyHydrationTargets(ssrContent);
  
  console.log(`Found ${hydrationTargets.length} hydration targets`);

  // Process targets with selective hydration
  hydrationService.processHydrationTargets(hydrationTargets);

  // Simulate user interactions that trigger hydration
  setTimeout(async () => {
    console.log('🖱️ Simulating user interaction...');
    
    // Hydrate critical interactive component immediately
    const criticalTarget = hydrationTargets.find(t => t.componentId === 'header-nav');
    if (criticalTarget) {
      await hydrationService.hydrateImmediately(criticalTarget.componentId);
      console.log('  ✓ Critical component hydrated');
    }

    // Simulate viewport intersection for carousel
    const carouselTarget = hydrationTargets.find(t => t.componentId === 'product-carousel');
    if (carouselTarget) {
      await hydrationService.hydrateImmediately(carouselTarget.componentId);
      console.log('  ✓ Carousel component hydrated on viewport intersection');
    }

    const finalStatus = hydrationService.getQueueStatus();
    console.log(`Final hydration status: ${finalStatus.hydrated} hydrated, ${finalStatus.pending} pending`);
    
  }, 1000);

  console.log('✅ Client-side Hydration Example setup completed!');
}

/**
 * Example: Performance monitoring and optimization
 */
export function demonstratePerformanceMonitoring() {
  console.log('📊 Starting Performance Monitoring Example');

  const components: ComponentDefinition[] = [
    {
      id: 'perf-test-1',
      framework: 'react',
      component: 'PerfTestComponent',
      props: {},
      isInteractive: true,
      priority: LoadPriority.CRITICAL
    }
  ];

  const analyzer = new FrameworkRequirementAnalyzer();
  const ssrManager = new SSROptimizationManager();

  // Analyze performance impact
  const requirements = analyzer.analyzeRequirements(components);
  const impact = analyzer.estimatePerformanceImpact(requirements);

  console.log('Performance Analysis:');
  console.log(`  Bundle size optimization: ${Math.round((1 - impact.cacheEfficiency) * 100)}% reduction potential`);
  console.log(`  Loading time: ${impact.initialLoadTime}ms initial, ${impact.interactiveTime}ms interactive`);

  // Monitor real performance
  const startTime = performance.now();
  
  ssrManager.renderServerContent(components).then(() => {
    const endTime = performance.now();
    const actualRenderTime = endTime - startTime;
    
    console.log(`Actual render time: ${actualRenderTime}ms`);
    console.log(`Estimated vs Actual: ${impact.initialLoadTime}ms vs ${actualRenderTime}ms`);
    
    const metrics = ssrManager.getMetrics();
    console.log('Real-time metrics:', metrics);
  });

  console.log('✅ Performance Monitoring Example completed!');
}

// Export for use in other examples or tests
export {
  SSROptimizationManager,
  SelectiveHydrationService,
  FrameworkRequirementAnalyzer,
  ProgressiveEnhancementFallback
};

// Run examples if this file is executed directly
if (typeof window !== 'undefined') {
  // Browser environment - set up examples
  console.log('🌐 SSR Optimization Examples ready to run');
  
  // Make examples available globally for testing
  (window as any).ssrExamples = {
    demonstrateSSROptimization,
    demonstrateClientSideHydration,
    demonstratePerformanceMonitoring
  };
}