/**
 * I18n Router for Ultra-Modern MTM
 * Handles locale-aware routing and navigation
 */

import { createLocaleDetector } from './locale-detector.js';
import { createLocaleFallbackSystem } from './locale-fallback-system.js';

export class I18nRouter {
  constructor(options = {}) {
    this.options = {
      defaultLocale: 'en',
      supportedLocales: ['en'],
      strategy: 'prefix',
      fallbackEnabled: true,
      autoRedirect: true,
      preserveQuery: true,
      preserveHash: true,
      ...options
    };

    this.localeDetector = createLocaleDetector({
      defaultLocale: this.options.defaultLocale,
      supportedLocales: this.options.supportedLocales,
      strategy: this.options.strategy,
      fallbackEnabled: this.options.fallbackEnabled
    });

    this.fallbackSystem = createLocaleFallbackSystem({
      defaultLocale: this.options.defaultLocale,
      supportedLocales: this.options.supportedLocales
    });

    this.currentLocale = this.options.defaultLocale;
    this.routeManifest = null;
    this.listeners = new Set();

    // Bind methods
    this.handlePopState = this.handlePopState.bind(this);
  }

  /**
   * Initialize the i18n router
   */
  init(routeManifest) {
    this.routeManifest = routeManifest;

    // Detect initial locale
    const detection = this.localeDetector.detectLocale({
      url: window.location.href,
      headers: this.getRequestHeaders(),
      cookies: this.parseCookies()
    });

    this.currentLocale = detection.detected;

    // Set up browser history handling
    window.addEventListener('popstate', this.handlePopState);

    // Auto-redirect if needed
    if (this.options.autoRedirect) {
      this.handleInitialRedirect(detection);
    }

    console.log(`🌍 I18n Router initialized with locale: ${this.currentLocale}`);
  }

  /**
   * Handle initial redirect based on locale detection
   */
  handleInitialRedirect(detection) {
    const currentUrl = window.location.href;
    const urlLocale = this.localeDetector.extractLocaleFromUrl(currentUrl);

    // If URL locale doesn't match detected locale, redirect
    if (urlLocale !== detection.detected && detection.confidence > 0.5) {
      const newUrl = this.localeDetector.generateLocalizedUrl(currentUrl, detection.detected);
      if (newUrl !== currentUrl) {
        console.log(`🔄 Redirecting to localized URL: ${newUrl}`);
        window.location.replace(newUrl);
        return;
      }
    }

    // Store the detected locale preference
    this.localeDetector.storeLocalePreference(detection.detected);
  }

  /**
   * Navigate to a route with locale handling
   */
  async navigate(path, options = {}) {
    const {
      locale = this.currentLocale,
      replace = false,
      preserveQuery = this.options.preserveQuery,
      preserveHash = this.options.preserveHash
    } = options;

    try {
      // Resolve the localized route
      const resolvedRoute = await this.resolveLocalizedRoute(path, locale);

      if (!resolvedRoute) {
        throw new Error(`Route not found: ${path} for locale: ${locale}`);
      }

      // Build the full URL
      const url = this.buildNavigationUrl(resolvedRoute.route, {
        preserveQuery,
        preserveHash
      });

      // Update browser history
      if (replace) {
        window.history.replaceState({ locale, route: resolvedRoute }, '', url);
      } else {
        window.history.pushState({ locale, route: resolvedRoute }, '', url);
      }

      // Update current locale
      this.currentLocale = locale;

      // Notify listeners
      this.notifyListeners({
        type: 'navigate',
        locale,
        route: resolvedRoute,
        url
      });

      return resolvedRoute;

    } catch (error) {
      console.error('Navigation failed:', error);
      throw error;
    }
  }

  /**
   * Switch to a different locale
   */
  async switchLocale(newLocale, options = {}) {
    if (!this.localeDetector.isLocaleSupported(newLocale)) {
      throw new Error(`Locale not supported: ${newLocale}`);
    }

    const currentPath = this.getCurrentPath();
    const {
      redirect = true,
      storePreference = true
    } = options;

    try {
      // Find equivalent route in new locale
      const equivalentRoute = await this.findEquivalentRoute(currentPath, this.currentLocale, newLocale);

      if (storePreference) {
        this.localeDetector.storeLocalePreference(newLocale);
      }

      if (redirect && equivalentRoute) {
        await this.navigate(equivalentRoute.route, {
          locale: newLocale,
          replace: true
        });
      } else {
        this.currentLocale = newLocale;
        this.notifyListeners({
          type: 'locale-change',
          locale: newLocale,
          previousLocale: this.currentLocale
        });
      }

      return equivalentRoute;

    } catch (error) {
      console.error('Locale switch failed:', error);
      throw error;
    }
  }

  /**
   * Resolve a route for a specific locale
   */
  async resolveLocalizedRoute(path, locale) {
    if (!this.routeManifest || !this.routeManifest.i18nRoutes) {
      return null;
    }

    const localeRoutes = this.routeManifest.i18nRoutes[locale];
    if (!localeRoutes) {
      // Try fallback locale
      const fallbackLocale = this.localeDetector.findBestFallback(locale);
      if (fallbackLocale && fallbackLocale !== locale) {
        return this.resolveLocalizedRoute(path, fallbackLocale);
      }
      return null;
    }

    // Look for exact match first
    const exactMatch = localeRoutes.routes.find(route => route.route === path);
    if (exactMatch) {
      return exactMatch;
    }

    // Look for dynamic route matches
    const dynamicMatches = localeRoutes.dynamicRoutes.filter(route => {
      const regex = new RegExp(route.pattern);
      return regex.test(path);
    });

    if (dynamicMatches.length > 0) {
      // Return the first match (could be improved with better matching logic)
      return dynamicMatches[0];
    }

    return null;
  }

  /**
   * Find equivalent route in different locale
   */
  async findEquivalentRoute(currentPath, fromLocale, toLocale) {
    if (!this.routeManifest || !this.routeManifest.i18nRoutes) {
      return null;
    }

    const fromRoutes = this.routeManifest.i18nRoutes[fromLocale];
    const toRoutes = this.routeManifest.i18nRoutes[toLocale];

    if (!fromRoutes || !toRoutes) {
      return toRoutes ? toRoutes.defaultRoute : null;
    }

    // Find current route in from locale
    const currentRoute = fromRoutes.routes.find(route => route.route === currentPath);
    if (!currentRoute) {
      return toRoutes.defaultRoute;
    }

    // Look for equivalent route by originalRoute or component
    let equivalentRoute = toRoutes.routes.find(route =>
      route.originalRoute === currentRoute.originalRoute ||
      route.originalRoute === currentPath ||
      route.component === currentRoute.component
    );

    // If no equivalent found, try to match by component for routes without originalRoute
    if (!equivalentRoute && currentRoute.component) {
      equivalentRoute = toRoutes.routes.find(route =>
        route.component === currentRoute.component
      );
    }

    return equivalentRoute || toRoutes.defaultRoute;
  }

  /**
   * Get current path without locale prefix
   */
  getCurrentPath() {
    const pathname = window.location.pathname;

    if (this.options.strategy === 'prefix') {
      const segments = pathname.split('/').filter(Boolean);
      if (segments.length > 0 && this.localeDetector.isLocaleSupported(segments[0])) {
        return '/' + segments.slice(1).join('/');
      }
    }

    return pathname;
  }

  /**
   * Build navigation URL with query and hash preservation
   */
  buildNavigationUrl(path, options = {}) {
    const {
      preserveQuery = true,
      preserveHash = true
    } = options;

    let url = path;

    if (preserveQuery && window.location.search) {
      url += window.location.search;
    }

    if (preserveHash && window.location.hash) {
      url += window.location.hash;
    }

    return url;
  }

  /**
   * Handle browser back/forward navigation
   */
  handlePopState(event) {
    const state = event.state;

    if (state && state.locale) {
      this.currentLocale = state.locale;

      this.notifyListeners({
        type: 'popstate',
        locale: state.locale,
        route: state.route
      });
    } else {
      // Detect locale from current URL
      const detection = this.localeDetector.detectLocale({
        url: window.location.href
      });

      this.currentLocale = detection.detected;

      this.notifyListeners({
        type: 'popstate',
        locale: detection.detected
      });
    }
  }

  /**
   * Get available locales for current route
   */
  getAvailableLocales(path = this.getCurrentPath()) {
    if (!this.routeManifest || !this.routeManifest.i18nRoutes) {
      return [this.options.defaultLocale];
    }

    const availableLocales = [];

    Object.entries(this.routeManifest.i18nRoutes).forEach(([locale, localeRoutes]) => {
      const hasRoute = localeRoutes.routes.some(route =>
        route.route === path ||
        route.originalRoute === path ||
        (route.isDynamic && new RegExp(route.pattern).test(path))
      );

      if (hasRoute) {
        availableLocales.push(locale);
      }
    });

    return availableLocales.length > 0 ? availableLocales : [this.options.defaultLocale];
  }

  /**
   * Get localized URLs for current route
   */
  getLocalizedUrls(path = this.getCurrentPath()) {
    const urls = {};
    const availableLocales = this.getAvailableLocales(path);

    availableLocales.forEach(locale => {
      const localizedPath = this.getLocalizedPath(path, locale);
      if (localizedPath) {
        urls[locale] = this.localeDetector.generateLocalizedUrl(
          window.location.origin + localizedPath,
          locale
        );
      }
    });

    return urls;
  }

  /**
   * Get localized path for a specific locale
   */
  getLocalizedPath(path, locale) {
    if (!this.routeManifest || !this.routeManifest.i18nRoutes) {
      return path;
    }

    const localeRoutes = this.routeManifest.i18nRoutes[locale];
    if (!localeRoutes) {
      return path;
    }

    // Find the route in the locale
    const route = localeRoutes.routes.find(r =>
      r.originalRoute === path ||
      r.route === path ||
      r.component === this.getCurrentRouteComponent(path)
    );

    return route ? route.route : path;
  }

  /**
   * Get current route component (helper method)
   */
  getCurrentRouteComponent(path) {
    // This would need to be implemented based on your routing system
    // For now, return null
    return null;
  }

  /**
   * Add event listener
   */
  addEventListener(listener) {
    this.listeners.add(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener) {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  notifyListeners(event) {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('I18n router listener error:', error);
      }
    });
  }

  /**
   * Get request headers (for server-side detection)
   */
  getRequestHeaders() {
    // In browser environment, we can't access request headers
    // This would be populated on the server side
    return {};
  }

  /**
   * Parse cookies from document.cookie
   */
  parseCookies() {
    if (typeof document === 'undefined') {
      return {};
    }

    const cookies = {};
    document.cookie.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });

    return cookies;
  }

  /**
   * Get current locale
   */
  getCurrentLocale() {
    return this.currentLocale;
  }

  /**
   * Get supported locales
   */
  getSupportedLocales() {
    return this.localeDetector.getSupportedLocales();
  }

  /**
   * Check if locale is supported
   */
  isLocaleSupported(locale) {
    return this.localeDetector.isLocaleSupported(locale);
  }

  /**
   * Generate SEO-friendly URLs for search engines
   */
  generateSeoUrls(path = this.getCurrentPath()) {
    const seoUrls = {
      canonical: null,
      alternates: {},
      hreflang: {}
    };

    const availableLocales = this.getAvailableLocales(path);
    const baseUrl = window.location.origin;

    // Generate canonical URL (usually the default locale)
    const canonicalLocale = this.options.defaultLocale;
    const canonicalPath = this.getLocalizedPath(path, canonicalLocale);
    seoUrls.canonical = this.localeDetector.generateLocalizedUrl(
      baseUrl + canonicalPath,
      canonicalLocale
    );

    // Generate alternate URLs for each locale
    availableLocales.forEach(locale => {
      const localizedPath = this.getLocalizedPath(path, locale);
      const localizedUrl = this.localeDetector.generateLocalizedUrl(
        baseUrl + localizedPath,
        locale
      );

      seoUrls.alternates[locale] = localizedUrl;

      // Generate hreflang attributes for HTML head
      seoUrls.hreflang[locale] = {
        href: localizedUrl,
        hreflang: locale
      };
    });

    // Add x-default hreflang
    seoUrls.hreflang['x-default'] = {
      href: seoUrls.canonical,
      hreflang: 'x-default'
    };

    return seoUrls;
  }

  /**
   * Generate HTML meta tags for SEO
   */
  generateSeoMetaTags(path = this.getCurrentPath()) {
    const seoUrls = this.generateSeoUrls(path);
    const metaTags = [];

    // Canonical link
    metaTags.push(`<link rel="canonical" href="${seoUrls.canonical}" />`);

    // Alternate links
    Object.entries(seoUrls.hreflang).forEach(([hreflang, { href }]) => {
      metaTags.push(`<link rel="alternate" hreflang="${hreflang}" href="${href}" />`);
    });

    return metaTags;
  }

  /**
   * Enhanced locale resolution using fallback system
   */
  resolveLocaleWithFallback(context = {}) {
    const {
      requestedLocale = this.currentLocale,
      availableLocales = this.getSupportedLocales(),
      userPreferences = [],
      geolocation = null,
      acceptLanguage = navigator?.language || ''
    } = context;

    return this.fallbackSystem.resolveLocale({
      requestedLocale,
      availableLocales,
      userPreferences,
      geolocation,
      acceptLanguage,
      fallbackEnabled: this.options.fallbackEnabled
    });
  }

  /**
   * Get locale resolution quality score
   */
  getLocaleQuality(locale = this.currentLocale) {
    const resolution = this.resolveLocaleWithFallback({
      requestedLocale: locale
    });

    return this.fallbackSystem.validateResolution(resolution);
  }

  /**
   * Generate sitemap URLs for all locales
   */
  generateSitemapUrls() {
    if (!this.routeManifest || !this.routeManifest.i18nRoutes) {
      return [];
    }

    const sitemapUrls = [];
    const baseUrl = window.location.origin;

    Object.entries(this.routeManifest.i18nRoutes).forEach(([locale, localeRoutes]) => {
      localeRoutes.staticRoutes.forEach(route => {
        const url = this.localeDetector.generateLocalizedUrl(
          baseUrl + route.route,
          locale
        );

        const alternates = {};
        Object.entries(this.routeManifest.i18nRoutes).forEach(([altLocale, altRoutes]) => {
          const equivalentRoute = altRoutes.routes.find(r =>
            r.originalRoute === route.originalRoute ||
            r.component === route.component
          );

          if (equivalentRoute) {
            alternates[altLocale] = this.localeDetector.generateLocalizedUrl(
              baseUrl + equivalentRoute.route,
              altLocale
            );
          }
        });

        sitemapUrls.push({
          url,
          locale,
          alternates,
          lastmod: route.lastModified || new Date().toISOString(),
          priority: route.route === '/' ? 1.0 : 0.8,
          changefreq: 'weekly'
        });
      });
    });

    return sitemapUrls;
  }

  /**
   * Handle locale-specific redirects
   */
  handleLocaleRedirect(targetLocale, options = {}) {
    const {
      permanent = false,
      preservePath = true,
      fallbackToDefault = true
    } = options;

    const currentPath = preservePath ? this.getCurrentPath() : '/';

    try {
      // Check if target locale is supported
      if (!this.isLocaleSupported(targetLocale)) {
        if (fallbackToDefault) {
          targetLocale = this.options.defaultLocale;
        } else {
          throw new Error(`Locale not supported: ${targetLocale}`);
        }
      }

      // Find equivalent route in target locale
      const equivalentRoute = this.findEquivalentRoute(
        currentPath,
        this.currentLocale,
        targetLocale
      );

      const targetPath = equivalentRoute ? equivalentRoute.route : '/';
      const targetUrl = this.localeDetector.generateLocalizedUrl(
        window.location.origin + targetPath,
        targetLocale
      );

      // Perform redirect
      if (permanent) {
        window.location.replace(targetUrl);
      } else {
        window.location.href = targetUrl;
      }

      return targetUrl;

    } catch (error) {
      console.error('Locale redirect failed:', error);
      throw error;
    }
  }

  /**
   * Get fallback system statistics
   */
  getFallbackStats() {
    return this.fallbackSystem.getStats();
  }

  /**
   * Cleanup
   */
  destroy() {
    window.removeEventListener('popstate', this.handlePopState);
    this.listeners.clear();
    this.localeDetector.clearCache();
    this.fallbackSystem.reset();
  }
}

/**
 * Create an i18n router instance
 */
export function createI18nRouter(options = {}) {
  return new I18nRouter(options);
}

/**
 * Default i18n router instance
 */
export const defaultI18nRouter = new I18nRouter();