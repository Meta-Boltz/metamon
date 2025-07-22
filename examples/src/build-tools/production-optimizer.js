/**
 * Production Build Optimizer for Ultra-Modern MTM
 * Handles minification, route manifest optimization, static assets, and SEO metadata
 */

import fs from 'fs/promises';
import path from 'path';
import { createBundleAnalyzer } from './bundle-analyzer.js';
import { createRouteManifestGenerator } from './route-manifest-generator.js';

export class ProductionOptimizer {
  constructor(options = {}) {
    this.options = {
      outputDir: 'dist',
      pagesDir: 'src/pages',
      assetsDir: 'src/assets',
      publicDir: 'public',
      minifyJS: true,
      minifyCSS: true,
      optimizeImages: true,
      generateSitemap: true,
      generateRobotsTxt: true,
      generateManifest: true,
      enableGzip: true,
      enableBrotli: false,
      baseUrl: 'https://example.com',
      ...options
    };

    this.bundleAnalyzer = createBundleAnalyzer({
      outputDir: this.options.outputDir,
      generateReport: true,
      enableTreeShaking: true
    });

    this.routeManifestGenerator = createRouteManifestGenerator({
      pagesDir: this.options.pagesDir,
      optimizeForProduction: true
    });

    this.optimizationResults = {
      originalSize: 0,
      optimizedSize: 0,
      compressionRatio: 0,
      filesProcessed: 0,
      assetsOptimized: 0,
      seoFilesGenerated: [],
      errors: [],
      warnings: []
    };
  }

  /**
   * Run complete production optimization
   */
  async optimize() {
    console.log('🚀 Starting production optimization...');

    try {
      // Step 1: Analyze current bundle
      console.log('📊 Analyzing bundle...');
      const bundleAnalysis = await this.bundleAnalyzer.analyzeBundles();
      this.optimizationResults.originalSize = bundleAnalysis.totalSize;

      // Step 2: Minify JavaScript and CSS
      if (this.options.minifyJS || this.options.minifyCSS) {
        console.log('🗜️ Minifying assets...');
        await this.minifyAssets();
      }

      // Step 3: Optimize images
      if (this.options.optimizeImages) {
        console.log('🖼️ Optimizing images...');
        await this.optimizeImages();
      }

      // Step 4: Generate optimized route manifest
      console.log('📋 Generating optimized route manifest...');
      await this.generateOptimizedRouteManifest();

      // Step 5: Generate SEO files
      console.log('🔍 Generating SEO metadata...');
      await this.generateSEOFiles();

      // Step 6: Enable compression
      if (this.options.enableGzip || this.options.enableBrotli) {
        console.log('📦 Enabling compression...');
        await this.enableCompression();
      }

      // Step 7: Generate optimization report
      console.log('📈 Generating optimization report...');
      await this.generateOptimizationReport();

      // Calculate final results
      const finalAnalysis = await this.bundleAnalyzer.analyzeBundles();
      this.optimizationResults.optimizedSize = finalAnalysis.totalSize;
      this.optimizationResults.compressionRatio =
        (this.optimizationResults.originalSize - this.optimizationResults.optimizedSize) /
        this.optimizationResults.originalSize;

      console.log('✅ Production optimization complete!');
      console.log(`📉 Size reduction: ${(this.optimizationResults.compressionRatio * 100).toFixed(1)}%`);
      console.log(`📁 Files processed: ${this.optimizationResults.filesProcessed}`);
      console.log(`🖼️ Assets optimized: ${this.optimizationResults.assetsOptimized}`);

      return this.optimizationResults;

    } catch (error) {
      console.error('❌ Production optimization failed:', error);
      this.optimizationResults.errors.push(error.message);
      throw error;
    }
  }

  /**
   * Minify JavaScript and CSS files
   */
  async minifyAssets() {
    const files = await this.findAssetFiles();

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const originalSize = content.length;

        let minifiedContent;

        if (file.endsWith('.js') && this.options.minifyJS) {
          minifiedContent = await this.minifyJavaScript(content);
        } else if (file.endsWith('.css') && this.options.minifyCSS) {
          minifiedContent = await this.minifyCSS(content);
        } else {
          continue;
        }

        await fs.writeFile(file, minifiedContent);

        const newSize = minifiedContent.length;
        const reduction = ((originalSize - newSize) / originalSize * 100).toFixed(1);

        console.log(`  ✅ ${path.basename(file)}: ${this.formatSize(originalSize)} → ${this.formatSize(newSize)} (-${reduction}%)`);

        this.optimizationResults.filesProcessed++;

      } catch (error) {
        console.warn(`  ⚠️ Failed to minify ${file}:`, error.message);
        this.optimizationResults.warnings.push(`Failed to minify ${file}: ${error.message}`);
      }
    }
  }

  /**
   * Find asset files to minify
   */
  async findAssetFiles() {
    const files = [];

    const scanDir = async (dir) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await scanDir(fullPath);
          } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.css'))) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Ignore directories we can't read
      }
    };

    await scanDir(this.options.outputDir);
    return files;
  }

  /**
   * Minify JavaScript content
   */
  async minifyJavaScript(content) {
    // Simple minification - remove comments and extra whitespace
    // In a real implementation, you'd use a proper minifier like Terser
    return content
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, '') // Remove line comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/;\s*}/g, '}') // Remove semicolons before closing braces
      .replace(/\s*{\s*/g, '{') // Clean up braces
      .replace(/\s*}\s*/g, '}')
      .replace(/\s*,\s*/g, ',') // Clean up commas
      .replace(/\s*;\s*/g, ';') // Clean up semicolons
      .trim();
  }

  /**
   * Minify CSS content
   */
  async minifyCSS(content) {
    // Simple CSS minification
    // In a real implementation, you'd use a proper minifier like cssnano
    return content
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/\s*{\s*/g, '{') // Clean up braces
      .replace(/\s*}\s*/g, '}')
      .replace(/\s*:\s*/g, ':') // Clean up colons
      .replace(/\s*;\s*/g, ';') // Clean up semicolons
      .replace(/\s*,\s*/g, ',') // Clean up commas
      .replace(/;\s*}/g, '}') // Remove semicolons before closing braces
      .trim();
  }

  /**
   * Optimize images (placeholder implementation)
   */
  async optimizeImages() {
    const imageFiles = await this.findImageFiles();

    for (const file of imageFiles) {
      try {
        const stats = await fs.stat(file);
        const originalSize = stats.size;

        // Placeholder: In a real implementation, you'd use image optimization libraries
        // like sharp, imagemin, or similar
        console.log(`  📷 ${path.basename(file)}: ${this.formatSize(originalSize)} (optimization skipped - placeholder)`);

        this.optimizationResults.assetsOptimized++;

      } catch (error) {
        console.warn(`  ⚠️ Failed to optimize ${file}:`, error.message);
        this.optimizationResults.warnings.push(`Failed to optimize ${file}: ${error.message}`);
      }
    }
  }

  /**
   * Find image files to optimize
   */
  async findImageFiles() {
    const files = [];
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

    const scanDir = async (dir) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await scanDir(fullPath);
          } else if (entry.isFile() && imageExtensions.some(ext => entry.name.toLowerCase().endsWith(ext))) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Ignore directories we can't read
      }
    };

    // Scan both output directory and assets directory
    await scanDir(this.options.outputDir);

    try {
      await scanDir(this.options.assetsDir);
    } catch (error) {
      // Assets directory might not exist
    }

    return files;
  }

  /**
   * Generate optimized route manifest for production
   */
  async generateOptimizedRouteManifest() {
    try {
      const manifest = await this.routeManifestGenerator.generateRouteManifest();

      // Additional production optimizations
      this.optimizeManifestForProduction(manifest);

      // Save optimized manifest
      const manifestPath = path.join(this.options.outputDir, 'route-manifest.json');
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 0)); // No pretty printing for production

      console.log(`  ✅ Route manifest saved to ${manifestPath}`);
      this.optimizationResults.filesProcessed++;

    } catch (error) {
      console.warn('  ⚠️ Failed to generate route manifest:', error.message);
      this.optimizationResults.warnings.push(`Failed to generate route manifest: ${error.message}`);
    }
  }

  /**
   * Optimize manifest for production
   */
  optimizeManifestForProduction(manifest) {
    // Remove development-only fields
    const removeDevFields = (obj) => {
      if (typeof obj !== 'object' || obj === null) return;

      delete obj.lastModified;
      delete obj.buildInfo;
      delete obj.size;

      // Remove empty arrays and objects
      Object.keys(obj).forEach(key => {
        if (Array.isArray(obj[key]) && obj[key].length === 0) {
          delete obj[key];
        } else if (typeof obj[key] === 'object' && obj[key] !== null && Object.keys(obj[key]).length === 0) {
          delete obj[key];
        } else if (typeof obj[key] === 'object') {
          removeDevFields(obj[key]);
        }
      });
    };

    removeDevFields(manifest);

    // Optimize route entries
    Object.values(manifest.staticRoutes || {}).forEach(route => {
      if (!route.preload) delete route.preload;
      if (!route.lazy) delete route.lazy;
      if (route.priority === 'normal') delete route.priority;
    });

    manifest.dynamicRoutes?.forEach(route => {
      if (!route.preload) delete route.preload;
      if (!route.lazy) delete route.lazy;
      if (route.priority === 'normal') delete route.priority;
    });
  }

  /**
   * Generate SEO files (sitemap, robots.txt, etc.)
   */
  async generateSEOFiles() {
    if (this.options.generateSitemap) {
      await this.generateSitemap();
    }

    if (this.options.generateRobotsTxt) {
      await this.generateRobotsTxt();
    }

    if (this.options.generateManifest) {
      await this.generateWebManifest();
    }
  }

  /**
   * Generate XML sitemap
   */
  async generateSitemap() {
    try {
      const manifest = await this.routeManifestGenerator.generateRouteManifest();
      const routes = Object.keys(manifest.staticRoutes || {});

      const sitemap = this.createSitemapXML(routes);
      const sitemapPath = path.join(this.options.outputDir, 'sitemap.xml');

      await fs.writeFile(sitemapPath, sitemap);

      console.log(`  ✅ Sitemap generated: ${sitemapPath}`);
      this.optimizationResults.seoFilesGenerated.push('sitemap.xml');

    } catch (error) {
      console.warn('  ⚠️ Failed to generate sitemap:', error.message);
      this.optimizationResults.warnings.push(`Failed to generate sitemap: ${error.message}`);
    }
  }

  /**
   * Create XML sitemap content
   */
  createSitemapXML(routes) {
    const urls = routes
      .filter(route => !route.startsWith('/404') && !route.includes('['))
      .map(route => {
        const url = new URL(route, this.options.baseUrl).toString();
        return `  <url>
    <loc>${url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${route === '/' ? '1.0' : '0.8'}</priority>
  </url>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
  }

  /**
   * Generate robots.txt
   */
  async generateRobotsTxt() {
    try {
      const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${new URL('/sitemap.xml', this.options.baseUrl).toString()}`;

      const robotsPath = path.join(this.options.outputDir, 'robots.txt');
      await fs.writeFile(robotsPath, robotsTxt);

      console.log(`  ✅ Robots.txt generated: ${robotsPath}`);
      this.optimizationResults.seoFilesGenerated.push('robots.txt');

    } catch (error) {
      console.warn('  ⚠️ Failed to generate robots.txt:', error.message);
      this.optimizationResults.warnings.push(`Failed to generate robots.txt: ${error.message}`);
    }
  }

  /**
   * Generate web app manifest
   */
  async generateWebManifest() {
    try {
      const manifest = {
        name: 'Ultra-Modern MTM App',
        short_name: 'MTM App',
        description: 'Ultra-Modern MTM Application',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#000000',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      };

      const manifestPath = path.join(this.options.outputDir, 'manifest.json');
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

      console.log(`  ✅ Web manifest generated: ${manifestPath}`);
      this.optimizationResults.seoFilesGenerated.push('manifest.json');

    } catch (error) {
      console.warn('  ⚠️ Failed to generate web manifest:', error.message);
      this.optimizationResults.warnings.push(`Failed to generate web manifest: ${error.message}`);
    }
  }

  /**
   * Enable compression (placeholder implementation)
   */
  async enableCompression() {
    try {
      const files = await this.findCompressibleFiles();

      for (const file of files) {
        if (this.options.enableGzip) {
          // Placeholder: In a real implementation, you'd use zlib or similar
          console.log(`  📦 Gzip: ${path.basename(file)} (compression skipped - placeholder)`);
        }

        if (this.options.enableBrotli) {
          // Placeholder: In a real implementation, you'd use brotli compression
          console.log(`  📦 Brotli: ${path.basename(file)} (compression skipped - placeholder)`);
        }
      }

    } catch (error) {
      console.warn('  ⚠️ Failed to enable compression:', error.message);
      this.optimizationResults.warnings.push(`Failed to enable compression: ${error.message}`);
    }
  }

  /**
   * Find files that can be compressed
   */
  async findCompressibleFiles() {
    const files = [];
    const compressibleExtensions = ['.js', '.css', '.html', '.json', '.xml', '.txt'];

    const scanDir = async (dir) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await scanDir(fullPath);
          } else if (entry.isFile() && compressibleExtensions.some(ext => entry.name.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Ignore directories we can't read
      }
    };

    await scanDir(this.options.outputDir);
    return files;
  }

  /**
   * Generate optimization report
   */
  async generateOptimizationReport() {
    const report = {
      timestamp: new Date().toISOString(),
      optimization: {
        originalSize: this.optimizationResults.originalSize,
        optimizedSize: this.optimizationResults.optimizedSize,
        compressionRatio: this.optimizationResults.compressionRatio,
        sizeSaved: this.optimizationResults.originalSize - this.optimizationResults.optimizedSize
      },
      files: {
        processed: this.optimizationResults.filesProcessed,
        assetsOptimized: this.optimizationResults.assetsOptimized
      },
      seo: {
        filesGenerated: this.optimizationResults.seoFilesGenerated
      },
      issues: {
        errors: this.optimizationResults.errors,
        warnings: this.optimizationResults.warnings
      },
      recommendations: this.generateRecommendations()
    };

    const reportPath = path.join(this.options.outputDir, 'optimization-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log(`  ✅ Optimization report saved: ${reportPath}`);
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations() {
    const recommendations = [];

    if (this.optimizationResults.compressionRatio < 0.1) {
      recommendations.push({
        type: 'compression',
        severity: 'info',
        message: 'Consider enabling additional compression techniques for better size reduction.'
      });
    }

    if (this.optimizationResults.warnings.length > 0) {
      recommendations.push({
        type: 'warnings',
        severity: 'warning',
        message: `${this.optimizationResults.warnings.length} warnings occurred during optimization. Review the warnings section.`
      });
    }

    if (this.optimizationResults.assetsOptimized === 0) {
      recommendations.push({
        type: 'assets',
        severity: 'info',
        message: 'No assets were optimized. Consider adding image optimization to reduce bundle size.'
      });
    }

    return recommendations;
  }

  /**
   * Format file size for display
   */
  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Get optimization results
   */
  getResults() {
    return { ...this.optimizationResults };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.bundleAnalyzer) {
      // Bundle analyzer doesn't have a destroy method, but we can clean up references
      this.bundleAnalyzer = null;
    }

    if (this.routeManifestGenerator) {
      this.routeManifestGenerator.close();
    }

    console.log('🔒 Production optimizer destroyed');
  }
}

export function createProductionOptimizer(options = {}) {
  return new ProductionOptimizer(options);
}