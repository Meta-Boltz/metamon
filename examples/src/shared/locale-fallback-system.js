/**
 * Comprehensive Locale Fallback System for Ultra-Modern MTM
 * Handles complex fallback scenarios and locale resolution
 */

export class LocaleFallbackSystem {
  constructor(options = {}) {
    this.options = {
      defaultLocale: 'en',
      supportedLocales: ['en'],
      fallbackChains: {
        // Language family fallbacks
        'en-GB': ['en-GB', 'en', 'en-US'],
        'en-AU': ['en-AU', 'en', 'en-US'],
        'en-CA': ['en-CA', 'en', 'en-US'],
        'fr-CA': ['fr-CA', 'fr', 'en'],
        'fr-BE': ['fr-BE', 'fr', 'en'],
        'de-AT': ['de-AT', 'de', 'en'],
        'de-CH': ['de-CH', 'de', 'en'],
        'es-MX': ['es-MX', 'es', 'en'],
        'es-AR': ['es-AR', 'es', 'en'],
        'pt-BR': ['pt-BR', 'pt', 'en'],
        'zh-TW': ['zh-TW', 'zh', 'en'],
        'zh-HK': ['zh-HK', 'zh', 'en']
      },
      regionFallbacks: {
        // Regional fallbacks
        'Americas': ['en', 'es', 'pt', 'fr'],
        'Europe': ['en', 'de', 'fr', 'es', 'it'],
        'Asia': ['en', 'zh', 'ja', 'ko'],
        'Africa': ['en', 'fr', 'ar'],
        'Oceania': ['en']
      },
      qualityThreshold: 0.1, // Minimum quality score for fallback
      maxFallbackDepth: 3,
      ...options
    };

    this.cache = new Map();
    this.stats = {
      detections: 0,
      fallbacks: 0,
      cacheHits: 0
    };
  }

  /**
   * Resolve the best locale with comprehensive fallback logic
   */
  resolveLocale(context = {}) {
    const {
      requestedLocale,
      availableLocales = this.options.supportedLocales,
      userPreferences = [],
      geolocation = null,
      acceptLanguage = '',
      fallbackEnabled = true
    } = context;

    const cacheKey = this.generateCacheKey(context);
    if (this.cache.has(cacheKey)) {
      this.stats.cacheHits++;
      return this.cache.get(cacheKey);
    }

    this.stats.detections++;

    const resolution = {
      resolved: this.options.defaultLocale,
      source: 'default',
      confidence: 0.1,
      fallbackChain: [],
      alternatives: [],
      quality: 0.1,
      isExact: false,
      isFallback: false
    };

    // Try exact match first
    if (requestedLocale && availableLocales.includes(requestedLocale)) {
      resolution.resolved = requestedLocale;
      resolution.source = 'exact';
      resolution.confidence = 1.0;
      resolution.quality = 1.0;
      resolution.isExact = true;
      resolution.fallbackChain = [requestedLocale];
    } else if (fallbackEnabled) {
      // Apply fallback logic
      const fallbackResult = this.findBestFallback({
        requestedLocale,
        availableLocales,
        userPreferences,
        geolocation,
        acceptLanguage
      });

      if (fallbackResult) {
        Object.assign(resolution, fallbackResult);
        resolution.isFallback = true;
        this.stats.fallbacks++;
      }
    }

    // Generate alternatives
    resolution.alternatives = this.generateAlternatives({
      requestedLocale,
      availableLocales,
      resolved: resolution.resolved
    });

    // Cache the result
    this.cache.set(cacheKey, resolution);

    return resolution;
  }

  /**
   * Find the best fallback locale using multiple strategies
   */
  findBestFallback(context) {
    const {
      requestedLocale,
      availableLocales,
      userPreferences,
      geolocation,
      acceptLanguage
    } = context;

    const candidates = [];

    // Strategy 1: Language family fallback
    if (requestedLocale) {
      const familyFallbacks = this.getLanguageFamilyFallbacks(requestedLocale);
      familyFallbacks.forEach((locale, index) => {
        if (availableLocales.includes(locale)) {
          candidates.push({
            locale,
            source: 'language-family',
            confidence: Math.max(0.8 - (index * 0.1), 0.3),
            quality: Math.max(0.8 - (index * 0.1), 0.3)
          });
        }
      });
    }

    // Strategy 2: Language part fallback (e.g., 'en' from 'en-GB')
    if (requestedLocale && requestedLocale.includes('-')) {
      const langPart = requestedLocale.split('-')[0];
      if (availableLocales.includes(langPart)) {
        candidates.push({
          locale: langPart,
          source: 'language-part',
          confidence: 0.7,
          quality: 0.7
        });
      }
    }

    // Strategy 3: User preferences
    userPreferences.forEach((pref, index) => {
      if (availableLocales.includes(pref)) {
        candidates.push({
          locale: pref,
          source: 'user-preference',
          confidence: Math.max(0.6 - (index * 0.1), 0.2),
          quality: Math.max(0.6 - (index * 0.1), 0.2)
        });
      }
    });

    // Strategy 4: Accept-Language header parsing
    if (acceptLanguage) {
      const acceptCandidates = this.parseAcceptLanguageForFallback(acceptLanguage, availableLocales);
      candidates.push(...acceptCandidates);
    }

    // Strategy 5: Geographic fallback
    if (geolocation) {
      const geoCandidates = this.getGeographicFallbacks(geolocation, availableLocales);
      candidates.push(...geoCandidates);
    }

    // Strategy 6: Similar language fallback
    const similarCandidates = this.findSimilarLanguages(requestedLocale, availableLocales);
    candidates.push(...similarCandidates);

    // Sort candidates by confidence and quality
    candidates.sort((a, b) => {
      const scoreA = (a.confidence * 0.7) + (a.quality * 0.3);
      const scoreB = (b.confidence * 0.7) + (b.quality * 0.3);
      return scoreB - scoreA;
    });

    // Filter by quality threshold
    const qualifiedCandidates = candidates.filter(c =>
      c.quality >= this.options.qualityThreshold
    );

    if (qualifiedCandidates.length === 0) {
      return null;
    }

    const best = qualifiedCandidates[0];

    return {
      resolved: best.locale,
      source: best.source,
      confidence: best.confidence,
      quality: best.quality,
      fallbackChain: this.buildFallbackChain(requestedLocale, best.locale),
      alternatives: qualifiedCandidates.slice(1, 5).map(c => c.locale)
    };
  }

  /**
   * Get language family fallbacks
   */
  getLanguageFamilyFallbacks(locale) {
    if (this.options.fallbackChains[locale]) {
      return this.options.fallbackChains[locale];
    }

    // Generate basic fallback chain
    const parts = locale.split('-');
    const fallbacks = [locale];

    if (parts.length > 1) {
      fallbacks.push(parts[0]); // Language part
    }

    fallbacks.push(this.options.defaultLocale);

    return [...new Set(fallbacks)];
  }

  /**
   * Parse Accept-Language header for fallback candidates
   */
  parseAcceptLanguageForFallback(acceptLanguage, availableLocales) {
    const candidates = [];

    try {
      const languages = acceptLanguage
        .split(',')
        .map(lang => {
          const [locale, q = '1'] = lang.trim().split(';q=');
          return {
            locale: locale.toLowerCase().replace('_', '-'),
            quality: parseFloat(q)
          };
        })
        .sort((a, b) => b.quality - a.quality);

      languages.forEach(({ locale, quality }) => {
        if (availableLocales.includes(locale)) {
          candidates.push({
            locale,
            source: 'accept-language',
            confidence: Math.min(quality, 0.8),
            quality: Math.min(quality, 0.8)
          });
        } else {
          // Try language part
          const langPart = locale.split('-')[0];
          if (availableLocales.includes(langPart)) {
            candidates.push({
              locale: langPart,
              source: 'accept-language-part',
              confidence: Math.min(quality * 0.8, 0.6),
              quality: Math.min(quality * 0.8, 0.6)
            });
          }
        }
      });
    } catch (error) {
      console.warn('Failed to parse Accept-Language header:', error);
    }

    return candidates;
  }

  /**
   * Get geographic fallbacks based on location
   */
  getGeographicFallbacks(geolocation, availableLocales) {
    const candidates = [];
    const { country, region, continent } = geolocation;

    // Country-specific fallbacks
    const countryFallbacks = {
      'US': ['en', 'es'],
      'CA': ['en', 'fr'],
      'GB': ['en'],
      'AU': ['en'],
      'FR': ['fr', 'en'],
      'DE': ['de', 'en'],
      'ES': ['es', 'en'],
      'IT': ['it', 'en'],
      'BR': ['pt', 'es', 'en'],
      'MX': ['es', 'en'],
      'CN': ['zh', 'en'],
      'JP': ['ja', 'en'],
      'KR': ['ko', 'en'],
      'RU': ['ru', 'en']
    };

    if (country && countryFallbacks[country]) {
      countryFallbacks[country].forEach((locale, index) => {
        if (availableLocales.includes(locale)) {
          candidates.push({
            locale,
            source: 'geographic-country',
            confidence: Math.max(0.5 - (index * 0.1), 0.2),
            quality: Math.max(0.5 - (index * 0.1), 0.2)
          });
        }
      });
    }

    // Regional fallbacks
    if (continent && this.options.regionFallbacks[continent]) {
      this.options.regionFallbacks[continent].forEach((locale, index) => {
        if (availableLocales.includes(locale)) {
          candidates.push({
            locale,
            source: 'geographic-region',
            confidence: Math.max(0.3 - (index * 0.05), 0.1),
            quality: Math.max(0.3 - (index * 0.05), 0.1)
          });
        }
      });
    }

    return candidates;
  }

  /**
   * Find similar languages based on linguistic similarity
   */
  findSimilarLanguages(requestedLocale, availableLocales) {
    const candidates = [];

    if (!requestedLocale) return candidates;

    const similarityMap = {
      'es': ['pt', 'it', 'fr', 'ca'],
      'pt': ['es', 'it', 'fr', 'gl'],
      'it': ['es', 'pt', 'fr', 'ro'],
      'fr': ['es', 'pt', 'it', 'ro'],
      'de': ['nl', 'da', 'sv', 'no'],
      'nl': ['de', 'da', 'sv', 'no'],
      'da': ['sv', 'no', 'de', 'nl'],
      'sv': ['da', 'no', 'de', 'nl'],
      'no': ['da', 'sv', 'de', 'nl'],
      'ru': ['uk', 'be', 'bg', 'sr'],
      'uk': ['ru', 'be', 'bg', 'sr'],
      'zh': ['ja', 'ko'],
      'ja': ['zh', 'ko'],
      'ko': ['zh', 'ja'],
      'ar': ['he', 'fa'],
      'he': ['ar', 'fa'],
      'hi': ['ur', 'bn', 'pa'],
      'ur': ['hi', 'bn', 'pa']
    };

    const baseLang = requestedLocale.split('-')[0];
    const similarLangs = similarityMap[baseLang] || [];

    similarLangs.forEach((lang, index) => {
      if (availableLocales.includes(lang)) {
        candidates.push({
          locale: lang,
          source: 'linguistic-similarity',
          confidence: Math.max(0.4 - (index * 0.1), 0.1),
          quality: Math.max(0.4 - (index * 0.1), 0.1)
        });
      }
    });

    return candidates;
  }

  /**
   * Build fallback chain showing the resolution path
   */
  buildFallbackChain(requested, resolved) {
    const chain = [];

    if (requested) {
      chain.push(requested);
    }

    if (requested !== resolved) {
      // Add intermediate steps if they exist
      const familyFallbacks = this.getLanguageFamilyFallbacks(requested || '');
      const resolvedIndex = familyFallbacks.indexOf(resolved);

      if (resolvedIndex > 0) {
        chain.push(...familyFallbacks.slice(1, resolvedIndex + 1));
      } else if (!chain.includes(resolved)) {
        chain.push(resolved);
      }
    }

    return [...new Set(chain)];
  }

  /**
   * Generate alternative locale suggestions
   */
  generateAlternatives(context) {
    const { requestedLocale, availableLocales, resolved } = context;
    const alternatives = [];

    // Add language variants
    if (requestedLocale) {
      const baseLang = requestedLocale.split('-')[0];
      availableLocales.forEach(locale => {
        if (locale.startsWith(baseLang + '-') && locale !== resolved) {
          alternatives.push(locale);
        }
      });
    }

    // Add similar languages
    const similarCandidates = this.findSimilarLanguages(requestedLocale, availableLocales);
    similarCandidates.forEach(candidate => {
      if (candidate.locale !== resolved && !alternatives.includes(candidate.locale)) {
        alternatives.push(candidate.locale);
      }
    });

    // Add common fallbacks
    const commonLocales = ['en', 'es', 'fr', 'de', 'zh', 'ja'];
    commonLocales.forEach(locale => {
      if (availableLocales.includes(locale) &&
        locale !== resolved &&
        !alternatives.includes(locale)) {
        alternatives.push(locale);
      }
    });

    return alternatives.slice(0, 5); // Limit to 5 alternatives
  }

  /**
   * Generate cache key for resolution context
   */
  generateCacheKey(context) {
    const {
      requestedLocale = '',
      availableLocales = [],
      userPreferences = [],
      geolocation = null,
      acceptLanguage = ''
    } = context;

    return [
      requestedLocale,
      availableLocales.sort().join(','),
      userPreferences.join(','),
      geolocation ? JSON.stringify(geolocation) : '',
      acceptLanguage
    ].join('|');
  }

  /**
   * Get fallback statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      hitRate: this.stats.detections > 0 ? this.stats.cacheHits / this.stats.detections : 0,
      fallbackRate: this.stats.detections > 0 ? this.stats.fallbacks / this.stats.detections : 0
    };
  }

  /**
   * Clear cache and reset stats
   */
  reset() {
    this.cache.clear();
    this.stats = {
      detections: 0,
      fallbacks: 0,
      cacheHits: 0
    };
  }

  /**
   * Update supported locales and clear cache
   */
  updateSupportedLocales(locales) {
    this.options.supportedLocales = [...locales];
    this.cache.clear();
  }

  /**
   * Add custom fallback chain
   */
  addFallbackChain(locale, chain) {
    this.options.fallbackChains[locale] = [...chain];
    this.cache.clear();
  }

  /**
   * Validate locale resolution quality
   */
  validateResolution(resolution) {
    const issues = [];

    if (resolution.quality < 0.3) {
      issues.push('Low quality resolution - consider adding more fallback options');
    }

    if (resolution.fallbackChain.length > this.options.maxFallbackDepth) {
      issues.push('Fallback chain too deep - may indicate configuration issues');
    }

    if (resolution.alternatives.length === 0) {
      issues.push('No alternatives available - limited locale support');
    }

    return {
      isValid: issues.length === 0,
      issues,
      score: resolution.quality * resolution.confidence
    };
  }
}

/**
 * Create a locale fallback system instance
 */
export function createLocaleFallbackSystem(options = {}) {
  return new LocaleFallbackSystem(options);
}

/**
 * Default locale fallback system instance
 */
export const defaultLocaleFallbackSystem = new LocaleFallbackSystem();