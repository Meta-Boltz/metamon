/**
 * Production Optimizer
 * 
 * This module provides optimization utilities for Ultra-Modern MTM applications
 * to ensure optimal performance in production environments.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface OptimizationOptions {
  // Build optimization options
  minify?: boolean;
  manualChunks?: Record<string, string[]>;
  cssCodeSplit?: boolean;
  assetsInlineLimit?: number;
  
  // Performance optimization options
  preloadChunks?: boolean;
  prefetchRoutes?: boolean;
  criticalCSS?: boolean;
  
  // SEO optimization options
  generateSitemap?: boolean;
  generateRobotsTxt?: boolean;
  
  // Cache optimization options
  cacheControl?: Record<string, string>;
  
  // Output options
  outputDir?: string;
  reportFile?: string;
}

interface OptimizationResult {
  success: boolean;
  optimizations: string[];
  warnings: string[];
  errors: string[];
  metrics?: {
    originalSize?: number;
    optimizedSize?: number;
    reduction?: number;
    reductionPercent?: string;
  };
}

/**
 * Optimize Vite configuration for production
 */
export function optimizeViteConfig(configPath: string, options: OptimizationOptions): OptimizationResult {
  const result: OptimizationResult = {
    success: false,
    optimizations: [],
    warnings: [],
    errors: []
  };
  
  try {
    if (!existsSync(configPath)) {
      result.errors.push(`Vite configuration file not found: ${configPath}`);
      return result;
    }
    
    // Read the existing configuration
    let configContent = readFileSync(configPath, 'utf-8');
    
    // Parse the configuration (this is a simplified approach)
    // In a real implementation, we would use a proper parser
    let config: any = {};
    try {
      // Extract the configuration object
      const configMatch = configContent.match(/export\s+default\s+(?:defineConfig\s*\()?\s*({[\s\S]*})\s*(?:\))?\s*;?/);
      if (configMatch && configMatch[1]) {
        // This is a simplified approach - in a real implementation we would use a proper parser
        // or require the config file directly
        config = eval(`(${configMatch[1]})`);
      } else {
        result.warnings.push('Could not parse Vite configuration. Using default optimization settings.');
      }
    } catch (error) {
      result.warnings.push(`Error parsing Vite configuration: ${error.message}`);
    }
    
    // Create optimized configuration
    const optimizedConfig: any = {
      ...config,
      build: {
        ...(config.build || {}),
        minify: options.minify !== undefined ? options.minify : 'terser',
        cssCodeSplit: options.cssCodeSplit !== undefined ? options.cssCodeSplit : true,
        assetsInlineLimit: options.assetsInlineLimit || 4096,
        rollupOptions: {
          ...(config.build?.rollupOptions || {}),
          output: {
            ...(config.build?.rollupOptions?.output || {}),
            manualChunks: options.manualChunks || {
              vendor: ['react', 'react-dom', 'react-router-dom'],
              utils: ['lodash', 'date-fns']
            }
          }
        },
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true
          }
        }
      }
    };
    
    // Generate the new configuration content
    const newConfigContent = `import { defineConfig } from 'vite';

// Production-optimized configuration
export default defineConfig(${JSON.stringify(optimizedConfig, null, 2)});
`;
    
    // Write the optimized configuration
    writeFileSync(`${configPath}.prod.js`, newConfigContent);
    
    result.success = true;
    result.optimizations.push('Created production-optimized Vite configuration');
    
    return result;
  } catch (error) {
    result.errors.push(`Failed to optimize Vite configuration: ${error.message}`);
    return result;
  }
}

/**
 * Generate cache control configuration for different hosting providers
 */
export function generateCacheControlConfig(options: OptimizationOptions): OptimizationResult {
  const result: OptimizationResult = {
    success: false,
    optimizations: [],
    warnings: [],
    errors: []
  };
  
  try {
    const outputDir = options.outputDir || 'dist';
    const cacheControl = options.cacheControl || {
      '/assets/': 'public, max-age=31536000, immutable',
      '/': 'public, max-age=3600'
    };
    
    // Generate Netlify _headers file
    const netlifyHeaders = Object.entries(cacheControl)
      .map(([path, value]) => `${path}\n  Cache-Control: ${value}`)
      .join('\n\n');
    
    writeFileSync(join(outputDir, '_headers'), netlifyHeaders);
    result.optimizations.push('Generated Netlify cache control headers');
    
    // Generate Vercel headers configuration
    const vercelConfig = {
      headers: Object.entries(cacheControl).map(([path, value]) => ({
        source: path,
        headers: [
          {
            key: 'Cache-Control',
            value
          }
        ]
      }))
    };
    
    writeFileSync(join(outputDir, 'vercel-headers.json'), JSON.stringify(vercelConfig, null, 2));
    result.optimizations.push('Generated Vercel cache control configuration');
    
    // Generate Nginx configuration
    const nginxConfig = `# Cache control configuration
${Object.entries(cacheControl).map(([path, value]) => `
location ${path} {
    add_header Cache-Control "${value}";
}`).join('')}
`;
    
    writeFileSync(join(outputDir, 'nginx-cache.conf'), nginxConfig);
    result.optimizations.push('Generated Nginx cache control configuration');
    
    result.success = true;
    return result;
  } catch (error) {
    result.errors.push(`Failed to generate cache control configuration: ${error.message}`);
    return result;
  }
}

/**
 * Generate SEO assets (sitemap, robots.txt)
 */
export function generateSEOAssets(routes: string[], options: OptimizationOptions): OptimizationResult {
  const result: OptimizationResult = {
    success: false,
    optimizations: [],
    warnings: [],
    errors: []
  };
  
  try {
    const outputDir = options.outputDir || 'dist';
    const baseUrl = 'https://example.com'; // This should be configurable
    
    // Generate sitemap.xml
    if (options.generateSitemap !== false) {
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map(route => `  <url>
    <loc>${baseUrl}${route}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${route === '/' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>`;
      
      writeFileSync(join(outputDir, 'sitemap.xml'), sitemap);
      result.optimizations.push('Generated sitemap.xml');
    }
    
    // Generate robots.txt
    if (options.generateRobotsTxt !== false) {
      const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml`;
      
      writeFileSync(join(outputDir, 'robots.txt'), robotsTxt);
      result.optimizations.push('Generated robots.txt');
    }
    
    result.success = true;
    return result;
  } catch (error) {
    result.errors.push(`Failed to generate SEO assets: ${error.message}`);
    return result;
  }
}

/**
 * Generate preload and prefetch hints
 */
export function generatePreloadHints(routes: string[], options: OptimizationOptions): OptimizationResult {
  const result: OptimizationResult = {
    success: false,
    optimizations: [],
    warnings: [],
    errors: []
  };
  
  try {
    const outputDir = options.outputDir || 'dist';
    const indexHtmlPath = join(outputDir, 'index.html');
    
    if (!existsSync(indexHtmlPath)) {
      result.errors.push(`Index HTML file not found: ${indexHtmlPath}`);
      return result;
    }
    
    // Read the index.html file
    let indexHtml = readFileSync(indexHtmlPath, 'utf-8');
    
    // Generate preload hints for main chunks
    if (options.preloadChunks !== false) {
      const preloadHints = `
    <!-- Preload main chunks -->
    <link rel="preload" href="/assets/vendor.js" as="script">
    <link rel="preload" href="/assets/main.js" as="script">
    <link rel="preload" href="/assets/main.css" as="style">`;
      
      indexHtml = indexHtml.replace('</head>', `${preloadHints}\n  </head>`);
      result.optimizations.push('Added preload hints for main chunks');
    }
    
    // Generate prefetch hints for routes
    if (options.prefetchRoutes !== false) {
      const routesToPrefetch = routes.slice(0, 5); // Limit to first 5 routes
      const prefetchHints = routesToPrefetch.map(route => 
        `<link rel="prefetch" href="${route === '/' ? '/index.html' : route}">`
      ).join('\n    ');
      
      if (prefetchHints) {
        indexHtml = indexHtml.replace('</head>', `    <!-- Prefetch common routes -->\n    ${prefetchHints}\n  </head>`);
        result.optimizations.push('Added prefetch hints for common routes');
      }
    }
    
    // Write the updated index.html
    writeFileSync(indexHtmlPath, indexHtml);
    
    result.success = true;
    return result;
  } catch (error) {
    result.errors.push(`Failed to generate preload hints: ${error.message}`);
    return result;
  }
}

/**
 * Run all production optimizations
 */
export function optimizeForProduction(options: OptimizationOptions): OptimizationResult {
  const result: OptimizationResult = {
    success: false,
    optimizations: [],
    warnings: [],
    errors: []
  };
  
  try {
    // Optimize Vite configuration
    const viteConfigPath = join(process.cwd(), 'vite.config.js');
    if (existsSync(viteConfigPath)) {
      const viteResult = optimizeViteConfig(viteConfigPath, options);
      result.optimizations.push(...viteResult.optimizations);
      result.warnings.push(...viteResult.warnings);
      result.errors.push(...viteResult.errors);
    } else {
      result.warnings.push('Vite configuration file not found. Skipping Vite optimization.');
    }
    
    // Generate cache control configuration
    const cacheResult = generateCacheControlConfig(options);
    result.optimizations.push(...cacheResult.optimizations);
    result.warnings.push(...cacheResult.warnings);
    result.errors.push(...cacheResult.errors);
    
    // Generate SEO assets
    // In a real implementation, we would extract routes from the application
    const routes = ['/', '/about', '/contact', '/products', '/blog'];
    const seoResult = generateSEOAssets(routes, options);
    result.optimizations.push(...seoResult.optimizations);
    result.warnings.push(...seoResult.warnings);
    result.errors.push(...seoResult.errors);
    
    // Generate preload hints
    const preloadResult = generatePreloadHints(routes, options);
    result.optimizations.push(...preloadResult.optimizations);
    result.warnings.push(...preloadResult.warnings);
    result.errors.push(...preloadResult.errors);
    
    // Generate optimization report
    if (options.reportFile) {
      const report = {
        timestamp: new Date().toISOString(),
        optimizations: result.optimizations,
        warnings: result.warnings,
        errors: result.errors
      };
      
      writeFileSync(options.reportFile, JSON.stringify(report, null, 2));
      result.optimizations.push(`Generated optimization report: ${options.reportFile}`);
    }
    
    result.success = result.errors.length === 0;
    return result;
  } catch (error) {
    result.errors.push(`Production optimization failed: ${error.message}`);
    return result;
  }
}

/**
 * CLI for production optimization
 */
export function runOptimizationCLI(): void {
  const args = process.argv.slice(2);
  const options: OptimizationOptions = {
    outputDir: 'dist',
    reportFile: 'optimization-report.json'
  };
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--output-dir' || arg === '-o') {
      options.outputDir = args[++i];
    } else if (arg === '--report-file' || arg === '-r') {
      options.reportFile = args[++i];
    } else if (arg === '--no-minify') {
      options.minify = false;
    } else if (arg === '--no-sitemap') {
      options.generateSitemap = false;
    } else if (arg === '--no-robots') {
      options.generateRobotsTxt = false;
    } else if (arg === '--no-preload') {
      options.preloadChunks = false;
    } else if (arg === '--no-prefetch') {
      options.prefetchRoutes = false;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Production Optimizer for Ultra-Modern MTM

Usage: mtm-optimize [options]

Options:
  --output-dir, -o <dir>    Output directory (default: "dist")
  --report-file, -r <file>  Report file (default: "optimization-report.json")
  --no-minify               Disable minification
  --no-sitemap              Disable sitemap generation
  --no-robots               Disable robots.txt generation
  --no-preload              Disable preload hints
  --no-prefetch             Disable prefetch hints
  --help, -h                Show this help message
`);
      return;
    }
  }
  
  console.log('Running production optimization...');
  const result = optimizeForProduction(options);
  
  if (result.success) {
    console.log('\n✅ Production optimization completed successfully!');
  } else {
    console.log('\n⚠️ Production optimization completed with warnings/errors.');
  }
  
  if (result.optimizations.length > 0) {
    console.log('\nOptimizations:');
    result.optimizations.forEach(opt => console.log(`- ${opt}`));
  }
  
  if (result.warnings.length > 0) {
    console.log('\nWarnings:');
    result.warnings.forEach(warning => console.log(`- ${warning}`));
  }
  
  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach(error => console.log(`- ${error}`));
  }
  
  console.log(`\nOptimization report saved to: ${options.reportFile}`);
}

// Run CLI if executed directly
if (require.main === module) {
  runOptimizationCLI();
}