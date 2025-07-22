/**
 * Locale Detection and Fallback System for Ultra-Modern MTM
 * Detects user locale from URL, headers, and preferences
 */

export class LocaleDetector {
  constructor(options = {}) {
    this.options = {
      defaultLocale: 'en',
      supportedLocales: ['en'],
      strategy: 'prefix', // 'prefix', 'domain', 'subdomain'
      fallbackEnabled: true,
      cookieName: 'locale',
      storageKey: 'preferred-locale',
      ...options
    };

    this.cache = new Map();
  }

  /**
   * Detect locale from various sources
   * @param {Object} context - Detection context
   * @returns {Object} Locale detection result
   */
  detectLocale(context = {}) {
    const {
      url = window?.location?.href || '',
      headers = {},
      cookies = {},
      userAgent = navigator?.userAgent || '',
      acceptLanguage = navigator?.language || 'en'
    } = context;

    const cacheKey = this.generateCacheKey(context);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const detectionResult = {
      detected: this.options.defaultLocale,
      source: 'default',
      confidence: 0.1,
      alternatives: [],
      fallback: null,
      isSupported: true
    };

    // Detection priority order
    const detectionMethods = [
      () => this.detectFromUrl(url),
      () => this.detectFromCookie(cookies),
      () => this.detectFromStorage(),
      () => this.detectFromHeaders(headers),
      () => this.detectFromBrowser(acceptLanguage),
      () => this.detectFromUserAgent(userAgent)
    ];

    for (const method of detectionMethods) {
      try {
        const result = method();
        if (result && result.confidence > detectionResult.confidence) {
          Object.assign(detectionResult, result);
        }
      } catch (error) {
        console.warn('Locale detection method failed:', error);
      }
    }

    // Apply fallback if needed
    if (!this.isLocaleSupported(detectionResult.detected)) {
      detectionResult.fallback = this.findBestFallback(detectionResult.detected);
      detectionResult.isSupported = false;

      if (this.options.fallbackEnabled && detectionResult.fallback) {
        detectionResult.detected = detectionResult.fallback;
        detectionResult.source += ' (fallback)';
      }
    }

    // Cache the result
    this.cache.set(cacheKey, detectionResult);

    return detectionResult;
  }

  /**
   * Detect locale from URL path
   */
  detectFromUrl(url) {
    if (!url) return null;

    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      switch (this.options.strategy) {
        case 'prefix':
          return this.detectFromUrlPrefix(pathname);
        case 'domain':
          return this.detectFromDomain(urlObj.hostname);
        case 'subdomain':
          return this.detectFromSubdomain(urlObj.hostname);
        default:
          return this.detectFromUrlPrefix(pathname);
      }
    } catch (error) {
      console.warn('Failed to parse URL for locale detection:', error);
      return null;
    }
  }

  /**
   * Detect locale from URL prefix (e.g., /fr/page)
   */
  detectFromUrlPrefix(pathname) {
    const segments = pathname.split('/').filter(Boolean);

    if (segments.length === 0) {
      return {
        detected: this.options.defaultLocale,
        source: 'url-root',
        confidence: 0.8
      };
    }

    const firstSegment = segments[0].toLowerCase();

    // Check if first segment is a supported locale
    if (this.isLocaleSupported(firstSegment)) {
      return {
        detected: firstSegment,
        source: 'url-prefix',
        confidence: 0.9
      };
    }

    // Check for locale-like patterns
    if (firstSegment.length === 2 && /^[a-z]{2}$/.test(firstSegment)) {
      const fallback = this.findBestFallback(firstSegment);
      return {
        detected: firstSegment,
        source: 'url-prefix-unsupported',
        confidence: 0.7,
        alternatives: fallback ? [fallback] : []
      };
    }

    return null;
  }

  /**
   * Detect locale from domain (e.g., example.fr)
   */
  detectFromDomain(hostname) {
    if (!hostname) return null;

    const tld = hostname.split('.').pop().toLowerCase();
    const localeMap = {
      'fr': 'fr',
      'de': 'de',
      'es': 'es',
      'it': 'it',
      'pt': 'pt',
      'nl': 'nl',
      'ru': 'ru',
      'jp': 'ja',
      'cn': 'zh',
      'kr': 'ko'
    };

    const detectedLocale = localeMap[tld];
    if (detectedLocale && this.isLocaleSupported(detectedLocale)) {
      return {
        detected: detectedLocale,
        source: 'domain-tld',
        confidence: 0.8
      };
    }

    return null;
  }

  /**
   * Detect locale from subdomain (e.g., fr.example.com)
   */
  detectFromSubdomain(hostname) {
    if (!hostname) return null;

    const parts = hostname.split('.');
    if (parts.length < 3) return null;

    const subdomain = parts[0].toLowerCase();

    if (this.isLocaleSupported(subdomain)) {
      return {
        detected: subdomain,
        source: 'subdomain',
        confidence: 0.9
      };
    }

    return null;
  }

  /**
   * Detect locale from cookie
   */
  detectFromCookie(cookies) {
    const cookieValue = cookies[this.options.cookieName];

    if (cookieValue && this.isLocaleSupported(cookieValue)) {
      return {
        detected: cookieValue,
        source: 'cookie',
        confidence: 0.7
      };
    }

    return null;
  }

  /**
   * Detect locale from localStorage
   */
  detectFromStorage() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    try {
      const storedLocale = localStorage.getItem(this.options.storageKey);

      if (storedLocale && this.isLocaleSupported(storedLocale)) {
        return {
          detected: storedLocale,
          source: 'localStorage',
          confidence: 0.6
        };
      }
    } catch (error) {
      console.warn('Failed to read from localStorage:', error);
    }

    return null;
  }

  /**
   * Detect locale from HTTP headers
   */
  detectFromHeaders(headers) {
    const acceptLanguage = headers['accept-language'] || headers['Accept-Language'];

    if (!acceptLanguage) return null;

    return this.parseAcceptLanguage(acceptLanguage);
  }

  /**
   * Detect locale from browser language
   */
  detectFromBrowser(language) {
    if (!language) return null;

    const locale = this.normalizeLocale(language);

    if (this.isLocaleSupported(locale)) {
      return {
        detected: locale,
        source: 'browser',
        confidence: 0.5
      };
    }

    // Try language part only (e.g., 'en' from 'en-US')
    const langPart = locale.split('-')[0];
    if (this.isLocaleSupported(langPart)) {
      return {
        detected: langPart,
        source: 'browser-lang',
        confidence: 0.4
      };
    }

    return null;
  }

  /**
   * Detect locale from user agent
   */
  detectFromUserAgent(userAgent) {
    if (!userAgent) return null;

    // Simple user agent locale detection
    const patterns = {
      'zh': /zh-CN|zh-TW|Chinese/i,
      'ja': /ja|Japanese/i,
      'ko': /ko|Korean/i,
      'ru': /ru|Russian/i,
      'ar': /ar|Arabic/i
    };

    for (const [locale, pattern] of Object.entries(patterns)) {
      if (pattern.test(userAgent) && this.isLocaleSupported(locale)) {
        return {
          detected: locale,
          source: 'user-agent',
          confidence: 0.3
        };
      }
    }

    return null;
  }

  /**
   * Parse Accept-Language header
   */
  parseAcceptLanguage(acceptLanguage) {
    const languages = acceptLanguage
      .split(',')
      .map(lang => {
        const [locale, q = '1'] = lang.trim().split(';q=');
        return {
          locale: this.normalizeLocale(locale),
          quality: parseFloat(q)
        };
      })
      .sort((a, b) => b.quality - a.quality);

    for (const { locale, quality } of languages) {
      if (this.isLocaleSupported(locale)) {
        return {
          detected: locale,
          source: 'accept-language',
          confidence: Math.min(0.8, quality)
        };
      }

      // Try language part only
      const langPart = locale.split('-')[0];
      if (this.isLocaleSupported(langPart)) {
        return {
          detected: langPart,
          source: 'accept-language-lang',
          confidence: Math.min(0.6, quality)
        };
      }
    }

    return null;
  }

  /**
   * Check if locale is supported
   */
  isLocaleSupported(locale) {
    return this.options.supportedLocales.includes(locale);
  }

  /**
   * Find best fallback for unsupported locale
   */
  findBestFallback(locale) {
    if (!locale) return this.options.defaultLocale;

    // Try language part (e.g., 'en' from 'en-GB')
    const langPart = locale.split('-')[0];
    if (this.isLocaleSupported(langPart)) {
      return langPart;
    }

    // Language family fallbacks
    const fallbackMap = {
      'en-GB': 'en',
      'en-AU': 'en',
      'en-CA': 'en',
      'fr-CA': 'fr',
      'fr-BE': 'fr',
      'de-AT': 'de',
      'de-CH': 'de',
      'es-MX': 'es',
      'es-AR': 'es',
      'pt-BR': 'pt',
      'zh-TW': 'zh',
      'zh-HK': 'zh'
    };

    const fallback = fallbackMap[locale];
    if (fallback && this.isLocaleSupported(fallback)) {
      return fallback;
    }

    return this.options.defaultLocale;
  }

  /**
   * Normalize locale code
   */
  normalizeLocale(locale) {
    if (!locale) return '';

    return locale.toLowerCase().replace('_', '-');
  }

  /**
   * Generate cache key for detection context
   */
  generateCacheKey(context) {
    const { url, headers, cookies } = context;
    return `${url || ''}:${JSON.stringify(headers || {})}:${JSON.stringify(cookies || {})}`;
  }

  /**
   * Clear detection cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get supported locales
   */
  getSupportedLocales() {
    return [...this.options.supportedLocales];
  }

  /**
   * Update supported locales
   */
  updateSupportedLocales(locales) {
    this.options.supportedLocales = [...locales];
    this.clearCache();
  }

  /**
   * Generate locale-specific URL
   */
  generateLocalizedUrl(baseUrl, locale, strategy = this.options.strategy) {
    if (!baseUrl || locale === this.options.defaultLocale) {
      return baseUrl;
    }

    try {
      const url = new URL(baseUrl);

      switch (strategy) {
        case 'prefix':
          // Add locale prefix to path
          const pathSegments = url.pathname.split('/').filter(Boolean);

          // Remove existing locale prefix if present
          if (pathSegments.length > 0 && this.isLocaleSupported(pathSegments[0])) {
            pathSegments.shift();
          }

          url.pathname = `/${locale}/${pathSegments.join('/')}`;
          break;

        case 'subdomain':
          // Add locale subdomain
          const hostParts = url.hostname.split('.');
          if (hostParts.length >= 2) {
            // Remove existing locale subdomain if present
            if (this.isLocaleSupported(hostParts[0])) {
              hostParts.shift();
            }
            url.hostname = `${locale}.${hostParts.join('.')}`;
          }
          break;

        case 'domain':
          // This would require a mapping of locales to domains
          // For now, fall back to prefix strategy
          return this.generateLocalizedUrl(baseUrl, locale, 'prefix');
      }

      return url.toString();
    } catch (error) {
      console.warn('Failed to generate localized URL:', error);
      return baseUrl;
    }
  }

  /**
   * Extract locale from URL
   */
  extractLocaleFromUrl(url) {
    const detection = this.detectFromUrl(url);
    return detection ? detection.detected : this.options.defaultLocale;
  }

  /**
   * Store user's locale preference
   */
  storeLocalePreference(locale) {
    if (!this.isLocaleSupported(locale)) {
      console.warn(`Locale ${locale} is not supported`);
      return false;
    }

    try {
      // Store in cookie
      if (typeof document !== 'undefined') {
        document.cookie = `${this.options.cookieName}=${locale}; path=/; max-age=31536000`; // 1 year
      }

      // Store in localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.options.storageKey, locale);
      }

      return true;
    } catch (error) {
      console.warn('Failed to store locale preference:', error);
      return false;
    }
  }
}

/**
 * Create a locale detector instance
 */
export function createLocaleDetector(options = {}) {
  return new LocaleDetector(options);
}

/**
 * Default locale detector instance
 */
export const defaultLocaleDetector = new LocaleDetector();