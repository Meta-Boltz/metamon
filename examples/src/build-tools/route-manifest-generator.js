/**
 * Route Manifest Generator for Ultra-Modern MTM
 * Creates optimized route manifests from scanned pages with i18n support
 */

import { createPageScanner } from './page-scanner.js';

export class RouteManifestGenerator {
  constructor(options = {}) {
    this.options = {
      pagesDir: 'src/pages',
      outputFormat: 'json',
      generateTypes: false,
      optimizeForProduction: false,
      i18nSupport: true,
      ...options
    };

    this.pageScanner = createPageScanner({
      pagesDir: this.options.pagesDir,
      watchMode: false
    });
  }

  /**
   * Generate route manifest from scanned pages
   */
  async generateRouteManifest(pagesDir = this.options.pagesDir) {
    console.log('🚀 Generating route manifest...');

    try {
      const pages = await this.pageScanner.scanPages(pagesDir);

      if (pages.length === 0) {
        console.warn('⚠️ No pages found to generate manifest');
        return this.createEmptyManifest();
      }

      const staticRoutes = pages.filter(page => !page.isDynamic && !page.isError);
      const dynamicRoutes = pages.filter(page => page.isDynamic && !page.isError);
      const errorPages = pages.filter(page => page.isError);
      const fallbackRoutes = pages.filter(page => page.status >= 400);

      console.log(`📊 Processing ${staticRoutes.length} static routes, ${dynamicRoutes.length} dynamic routes`);

      const manifest = {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        totalRoutes: pages.length,
        staticRoutes: this.buildStaticRoutes(staticRoutes),
        dynamicRoutes: this.buildDynamicRoutes(dynamicRoutes),
        fallbackRoutes: this.buildFallbackRoutes(fallbackRoutes),
        errorPages: this.buildErrorPages(errorPages),
        i18nRoutes: this.options.i18nSupport ? this.buildI18nRoutes(pages) : {},
        metadata: this.buildManifestMetadata(pages)
      };

      if (this.options.optimizeForProduction) {
        this.optimizeManifest(manifest);
      }

      console.log(`✅ Generated route manifest with ${manifest.totalRoutes} routes`);
      return manifest;

    } catch (error) {
      console.error('❌ Failed to generate route manifest:', error);
      throw error;
    }
  }

  buildStaticRoutes(staticPages) {
    const staticRoutes = {};

    staticPages.forEach(page => {
      const routeEntry = {
        path: page.route,
        component: page.filePath,
        title: page.title,
        description: page.description,
        keywords: page.keywords,
        layout: page.layout,
        status: page.status,
        metadata: page.metadata,
        preload: this.shouldPreload(page),
        lazy: this.shouldLazyLoad(page),
        priority: this.getRoutePriority(page),
        chunkName: this.generateChunkName(page.route),
        lastModified: page.lastModified,
        size: page.size
      };

      if (page.locales.length > 1) {
        routeEntry.locales = page.locales;
      }

      staticRoutes[page.route] = routeEntry;
    });

    return staticRoutes;
  }

  buildDynamicRoutes(dynamicPages) {
    return dynamicPages.map(page => {
      const pattern = this.routeToRegex(page.route);

      return {
        template: page.route,
        pattern: pattern.source,
        regex: pattern,
        component: page.filePath,
        title: page.title,
        description: page.description,
        keywords: page.keywords,
        layout: page.layout,
        status: page.status,
        parameters: page.parameters,
        paramNames: page.parameters,
        metadata: page.metadata,
        preload: this.shouldPreload(page),
        lazy: this.shouldLazyLoad(page),
        priority: this.getRoutePriority(page),
        chunkName: this.generateChunkName(page.route),
        lastModified: page.lastModified,
        size: page.size,
        locales: page.locales.length > 1 ? page.locales : undefined
      };
    });
  }

  buildFallbackRoutes(fallbackPages) {
    return fallbackPages.map(page => ({
      status: page.status,
      component: page.filePath,
      title: page.title,
      description: page.description,
      pattern: page.route === '/404' ? '.*' : this.routeToRegex(page.route).source,
      metadata: page.metadata
    }));
  }

  buildErrorPages(errorPages) {
    const errorRegistry = {};

    errorPages.forEach(page => {
      errorRegistry[page.route] = {
        component: page.filePath,
        title: page.title,
        description: page.description,
        errors: page.errors,
        metadata: page.metadata
      };
    });

    return errorRegistry;
  }

  buildI18nRoutes(pages) {
    const i18nRoutes = {};
    const localeRoutes = {};
    const localeMetadata = {};

    pages.forEach(page => {
      // Extract i18n information from the page
      const i18nInfo = this.pageScanner.extractI18nRoutes(page.metadata);

      page.locales.forEach(locale => {
        if (!localeRoutes[locale]) {
          localeRoutes[locale] = [];
          localeMetadata[locale] = {
            defaultLocale: i18nInfo.defaultLocale,
            strategy: i18nInfo.strategy,
            totalRoutes: 0
          };
        }

        // Handle multiple route definitions for i18n
        if (Array.isArray(page.metadata.route)) {
          page.metadata.route.forEach(route => {
            if (this.isLocaleRoute(route, locale)) {
              localeRoutes[locale].push({
                route,
                component: page.filePath,
                title: this.getLocalizedValue(page.metadata.title, locale) || page.title,
                description: this.getLocalizedValue(page.metadata.description, locale) || page.description,
                keywords: this.getLocalizedValue(page.metadata.keywords, locale) || page.keywords,
                layout: page.layout,
                status: page.status,
                isDynamic: page.isDynamic,
                parameters: page.parameters,
                originalRoute: page.route,
                locale: locale,
                metadata: page.metadata
              });
            }
          });
        } else if (typeof page.metadata.route === 'object') {
          // Handle locale-keyed routes
          if (page.metadata.route[locale]) {
            const routes = Array.isArray(page.metadata.route[locale])
              ? page.metadata.route[locale]
              : [page.metadata.route[locale]];

            routes.forEach(route => {
              localeRoutes[locale].push({
                route,
                component: page.filePath,
                title: this.getLocalizedValue(page.metadata.title, locale) || page.title,
                description: this.getLocalizedValue(page.metadata.description, locale) || page.description,
                keywords: this.getLocalizedValue(page.metadata.keywords, locale) || page.keywords,
                layout: page.layout,
                status: page.status,
                isDynamic: page.isDynamic,
                parameters: page.parameters,
                originalRoute: page.route,
                locale: locale,
                metadata: page.metadata
              });
            });
          }
        } else {
          // Single route - check if it matches this locale
          if (this.isLocaleRoute(page.route, locale) || locale === 'en') {
            localeRoutes[locale].push({
              route: page.route,
              component: page.filePath,
              title: this.getLocalizedValue(page.metadata.title, locale) || page.title,
              description: this.getLocalizedValue(page.metadata.description, locale) || page.description,
              keywords: this.getLocalizedValue(page.metadata.keywords, locale) || page.keywords,
              layout: page.layout,
              status: page.status,
              isDynamic: page.isDynamic,
              parameters: page.parameters,
              locale: locale,
              metadata: page.metadata
            });
          }
        }
      });
    });

    // Build final i18n routes structure
    Object.keys(localeRoutes).forEach(locale => {
      const routes = localeRoutes[locale];
      localeMetadata[locale].totalRoutes = routes.length;

      i18nRoutes[locale] = {
        locale: locale,
        routes: routes,
        defaultRoute: routes.find(r => r.route === '/' || r.route === `/${locale}` || r.route === `/${locale}/`) || routes[0],
        metadata: localeMetadata[locale],
        staticRoutes: routes.filter(r => !r.isDynamic),
        dynamicRoutes: routes.filter(r => r.isDynamic)
      };
    });

    return i18nRoutes;
  }

  /**
   * Get localized value from metadata
   * @param {any} value - Value that might be localized
   * @param {string} locale - Target locale
   * @returns {any} Localized value or original value
   */
  getLocalizedValue(value, locale) {
    if (!value) return value;

    if (typeof value === 'object' && !Array.isArray(value)) {
      return value[locale] || value.en || value;
    }

    return value;
  }

  buildManifestMetadata(pages) {
    const allKeywords = new Set();
    const layouts = new Set();
    const locales = new Set();
    let totalSize = 0;
    let lastModified = new Date(0);

    pages.forEach(page => {
      page.keywords.forEach(keyword => allKeywords.add(keyword));
      layouts.add(page.layout);
      page.locales.forEach(locale => locales.add(locale));
      totalSize += page.size || 0;

      if (page.lastModified > lastModified) {
        lastModified = page.lastModified;
      }
    });

    return {
      keywords: Array.from(allKeywords),
      layouts: Array.from(layouts),
      locales: Array.from(locales),
      totalSize,
      lastModified,
      buildInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Simple route to regex conversion
   */
  routeToRegex(route) {
    // For now, just create a simple regex that matches the route exactly
    // This can be enhanced later with proper parameter matching
    let pattern = route
      .replace(/\[\.\.\.(\w+)\]/g, '(.*)')
      .replace(/\[(\w+)\]/g, '([^/]+)');

    // Escape special regex characters except our capture groups
    const parts = pattern.split(/(\([^)]+\))/);
    pattern = parts.map((part, index) => {
      if (index % 2 === 0) {
        // Not a capture group, escape special chars
        return part.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
      } else {
        // Is a capture group, keep as is
        return part;
      }
    }).join('');

    return new RegExp('^' + pattern + '$');
  }

  isLocaleRoute(route, locale) {
    return route === `/${locale}` || route.startsWith(`/${locale}/`);
  }

  shouldPreload(page) {
    if (page.status >= 400) {
      return false;
    }

    if (page.route === '/' || page.route === '/docs') {
      return true;
    }

    if (page.size && page.size < 10000) {
      return true;
    }

    return false;
  }

  /**
   * Determine if a page should be lazy loaded
   */
  shouldLazyLoad(page) {
    // Don't lazy load error pages or critical routes
    if (page.status >= 400 || page.route === '/' || page.route === '/404') {
      return false;
    }

    // Lazy load large pages
    if (page.size && page.size > 50000) {
      return true;
    }

    // Lazy load by default for better performance
    return true;
  }

  /**
   * Get route priority for loading
   */
  getRoutePriority(page) {
    // Critical routes get high priority
    if (page.route === '/' || page.route === '/docs') {
      return 'high';
    }

    // Error pages get high priority (when needed)
    if (page.status >= 400) {
      return 'high';
    }

    // Large pages get low priority
    if (page.size && page.size > 100000) {
      return 'low';
    }

    return 'normal';
  }

  /**
   * Generate chunk name for a route
   */
  generateChunkName(route) {
    // Convert route to valid chunk name
    return route
      .replace(/^\//, '') // Remove leading slash
      .replace(/\//g, '-') // Replace slashes with dashes
      .replace(/[^a-zA-Z0-9-]/g, '_') // Replace special chars with underscores
      .replace(/^$/, 'index') // Handle root route
      .toLowerCase();
  }

  optimizeManifest(manifest) {
    console.log('⚡ Optimizing manifest for production...');

    Object.values(manifest.staticRoutes).forEach(route => {
      delete route.lastModified;
      delete route.size;
      if (!route.preload) {
        delete route.preload;
      }
    });

    manifest.dynamicRoutes.forEach(route => {
      delete route.lastModified;
      delete route.size;
      if (!route.preload) {
        delete route.preload;
      }
    });

    delete manifest.metadata.buildInfo;
    delete manifest.metadata.totalSize;
    delete manifest.metadata.lastModified;

    console.log('✅ Manifest optimized for production');
  }

  createEmptyManifest() {
    return {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      totalRoutes: 0,
      staticRoutes: {},
      dynamicRoutes: [],
      fallbackRoutes: [],
      errorPages: {},
      i18nRoutes: {},
      metadata: {
        keywords: [],
        layouts: [],
        locales: ['en'],
        totalSize: 0,
        lastModified: new Date(),
        buildInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          timestamp: new Date().toISOString()
        }
      }
    };
  }

  exportManifest(manifest, format = this.options.outputFormat) {
    switch (format) {
      case 'json':
        return JSON.stringify(manifest, null, 2);

      case 'js':
        return `// Auto-generated route manifest
export const routeManifest = ${JSON.stringify(manifest, null, 2)};

export default routeManifest;
`;

      case 'ts':
        return `// Auto-generated route manifest
import type { RouteManifest } from './types';

export const routeManifest: RouteManifest = ${JSON.stringify(manifest, null, 2)};

export default routeManifest;
`;

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  close() {
    if (this.pageScanner) {
      this.pageScanner.close();
    }
    console.log('🔒 Route manifest generator closed');
  }
}

export function createRouteManifestGenerator(options = {}) {
  return new RouteManifestGenerator(options);
}