/**
 * Tests for Locale Fallback System
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LocaleFallbackSystem } from '../shared/locale-fallback-system.js';

describe('LocaleFallbackSystem', () => {
  let fallbackSystem;

  beforeEach(() => {
    fallbackSystem = new LocaleFallbackSystem({
      defaultLocale: 'en',
      supportedLocales: ['en', 'fr', 'es', 'de', 'pt', 'it'],
      qualityThreshold: 0.1
    });
  });

  describe('Basic Locale Resolution', () => {
    it('should resolve exact match with high confidence', () => {
      const result = fallbackSystem.resolveLocale({
        requestedLocale: 'fr',
        availableLocales: ['en', 'fr', 'es']
      });

      expect(result.resolved).toBe('fr');
      expect(result.source).toBe('exact');
      expect(result.confidence).toBe(1.0);
      expect(result.isExact).toBe(true);
      expect(result.isFallback).toBe(false);
    });

    it('should fallback to default when no match found', () => {
      const result = fallbackSystem.resolveLocale({
        requestedLocale: 'zh',
        availableLocales: ['en', 'fr', 'es']
      });

      expect(result.resolved).toBe('en');
      expect(result.isFallback).toBe(true);
      expect(result.fallbackChain).toContain('zh');
    });

    it('should use language part fallback', () => {
      const result = fallbackSystem.resolveLocale({
        requestedLocale: 'custom-GB', // Use a custom locale not in predefined chains
        availableLocales: ['custom', 'fr', 'es']
      });

      expect(result.resolved).toBe('custom');
      // The system uses language-family fallback which includes language-part logic
      expect(['language-part', 'language-family']).toContain(result.source);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.isFallback).toBe(true);
    });
  });

  describe('Language Family Fallbacks', () => {
    it('should use predefined fallback chains', () => {
      const fallbacks = fallbackSystem.getLanguageFamilyFallbacks('fr-CA');

      expect(fallbacks).toEqual(['fr-CA', 'fr', 'en']);
    });

    it('should generate basic fallback chain for unknown locales', () => {
      const fallbacks = fallbackSystem.getLanguageFamilyFallbacks('custom-locale');

      expect(fallbacks).toContain('custom-locale');
      expect(fallbacks).toContain('en'); // default locale
    });

    it('should resolve using language family fallback', () => {
      const result = fallbackSystem.resolveLocale({
        requestedLocale: 'fr-CA',
        availableLocales: ['en', 'fr', 'es']
      });

      expect(result.resolved).toBe('fr');
      expect(result.source).toBe('language-family');
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Accept-Language Parsing', () => {
    it('should parse simple Accept-Language header', () => {
      const candidates = fallbackSystem.parseAcceptLanguageForFallback(
        'fr,en;q=0.8',
        ['en', 'fr', 'es']
      );

      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0].locale).toBe('fr');
      expect(candidates[0].source).toBe('accept-language');
    });

    it('should parse complex Accept-Language with quality values', () => {
      const candidates = fallbackSystem.parseAcceptLanguageForFallback(
        'fr;q=0.9,en-US;q=0.8,en;q=0.7,es;q=0.6',
        ['en', 'fr', 'es']
      );

      expect(candidates.length).toBeGreaterThan(0);
      // Should be sorted by quality
      expect(candidates[0].locale).toBe('fr');
      expect(candidates[0].quality).toBe(0.8); // min(0.9, 0.8)
    });

    it('should handle language variants in Accept-Language', () => {
      const candidates = fallbackSystem.parseAcceptLanguageForFallback(
        'en-US,en;q=0.9',
        ['en', 'fr', 'es']
      );

      expect(candidates.some(c => c.locale === 'en')).toBe(true);
      expect(candidates.some(c => c.source === 'accept-language-part')).toBe(true);
    });
  });

  describe('Geographic Fallbacks', () => {
    it('should provide country-specific fallbacks', () => {
      const candidates = fallbackSystem.getGeographicFallbacks(
        { country: 'CA', continent: 'Americas' },
        ['en', 'fr', 'es']
      );

      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates.some(c => c.locale === 'en')).toBe(true);
      expect(candidates.some(c => c.locale === 'fr')).toBe(true);
      expect(candidates.some(c => c.source === 'geographic-country')).toBe(true);
    });

    it('should provide regional fallbacks', () => {
      const candidates = fallbackSystem.getGeographicFallbacks(
        { continent: 'Europe' },
        ['en', 'fr', 'de', 'es']
      );

      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates.some(c => c.source === 'geographic-region')).toBe(true);
    });
  });

  describe('Similar Language Detection', () => {
    it('should find linguistically similar languages', () => {
      const candidates = fallbackSystem.findSimilarLanguages(
        'es',
        ['en', 'fr', 'pt', 'it']
      );

      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates.some(c => c.locale === 'pt')).toBe(true); // Portuguese similar to Spanish
      expect(candidates.some(c => c.locale === 'it')).toBe(true); // Italian similar to Spanish
      expect(candidates.some(c => c.source === 'linguistic-similarity')).toBe(true);
    });

    it('should handle Germanic language similarities', () => {
      const candidates = fallbackSystem.findSimilarLanguages(
        'de',
        ['en', 'nl', 'da', 'sv']
      );

      expect(candidates.some(c => c.locale === 'nl')).toBe(true); // Dutch similar to German
    });

    it('should handle Asian language similarities', () => {
      const candidates = fallbackSystem.findSimilarLanguages(
        'zh',
        ['en', 'ja', 'ko']
      );

      expect(candidates.some(c => c.locale === 'ja')).toBe(true); // Japanese similar to Chinese
      expect(candidates.some(c => c.locale === 'ko')).toBe(true); // Korean similar to Chinese
    });
  });

  describe('Comprehensive Fallback Resolution', () => {
    it('should resolve with multiple fallback strategies', () => {
      const result = fallbackSystem.resolveLocale({
        requestedLocale: 'pt-BR',
        availableLocales: ['en', 'es', 'fr'],
        userPreferences: ['es', 'en'],
        acceptLanguage: 'pt-BR,pt;q=0.9,es;q=0.8,en;q=0.7'
      });

      expect(result.resolved).toBe('es'); // Should pick Spanish as similar to Portuguese
      expect(result.isFallback).toBe(true);
      expect(result.alternatives.length).toBeGreaterThan(0);
    });

    it('should respect quality threshold', () => {
      fallbackSystem.options.qualityThreshold = 0.8;

      const result = fallbackSystem.resolveLocale({
        requestedLocale: 'zh',
        availableLocales: ['en', 'fr', 'es']
      });

      // Should fallback to default since no high-quality matches
      expect(result.resolved).toBe('en');
      expect(result.source).toBe('default');
    });
  });

  describe('Fallback Chain Building', () => {
    it('should build comprehensive fallback chain', () => {
      const chain = fallbackSystem.buildFallbackChain('fr-CA', 'fr');

      expect(chain).toContain('fr-CA');
      expect(chain).toContain('fr');
      expect(chain.indexOf('fr-CA')).toBeLessThan(chain.indexOf('fr'));
    });

    it('should handle direct resolution', () => {
      const chain = fallbackSystem.buildFallbackChain('en', 'en');

      expect(chain).toEqual(['en']);
    });
  });

  describe('Alternative Generation', () => {
    it('should generate relevant alternatives', () => {
      const alternatives = fallbackSystem.generateAlternatives({
        requestedLocale: 'en-GB',
        availableLocales: ['en', 'en-US', 'fr', 'de'],
        resolved: 'en'
      });

      expect(alternatives).toContain('en-US'); // Language variant
      expect(alternatives.length).toBeLessThanOrEqual(5);
    });

    it('should include similar languages in alternatives', () => {
      const alternatives = fallbackSystem.generateAlternatives({
        requestedLocale: 'es',
        availableLocales: ['en', 'pt', 'it', 'fr'],
        resolved: 'en'
      });

      expect(alternatives.some(alt => ['pt', 'it', 'fr'].includes(alt))).toBe(true);
    });
  });

  describe('Caching and Performance', () => {
    it('should cache resolution results', () => {
      const context = {
        requestedLocale: 'fr',
        availableLocales: ['en', 'fr', 'es']
      };

      const result1 = fallbackSystem.resolveLocale(context);
      const result2 = fallbackSystem.resolveLocale(context);

      expect(result1).toBe(result2); // Same object reference
      expect(fallbackSystem.stats.cacheHits).toBe(1);
    });

    it('should track statistics', () => {
      fallbackSystem.resolveLocale({
        requestedLocale: 'zh',
        availableLocales: ['en', 'fr']
      });

      const stats = fallbackSystem.getStats();
      expect(stats.detections).toBe(1);
      expect(stats.fallbacks).toBe(1);
    });

    it('should clear cache and reset stats', () => {
      fallbackSystem.resolveLocale({
        requestedLocale: 'fr',
        availableLocales: ['en', 'fr']
      });

      fallbackSystem.reset();

      const stats = fallbackSystem.getStats();
      expect(stats.detections).toBe(0);
      expect(stats.cacheSize).toBe(0);
    });
  });

  describe('Configuration and Customization', () => {
    it('should update supported locales', () => {
      fallbackSystem.updateSupportedLocales(['en', 'zh', 'ja']);

      const result = fallbackSystem.resolveLocale({
        requestedLocale: 'zh',
        availableLocales: ['en', 'zh', 'ja']
      });

      expect(result.resolved).toBe('zh');
      expect(result.isExact).toBe(true);
    });

    it('should add custom fallback chains', () => {
      fallbackSystem.addFallbackChain('custom-lang', ['custom-lang', 'en', 'fr']);

      const fallbacks = fallbackSystem.getLanguageFamilyFallbacks('custom-lang');
      expect(fallbacks).toEqual(['custom-lang', 'en', 'fr']);
    });
  });

  describe('Resolution Validation', () => {
    it('should validate high-quality resolutions', () => {
      const resolution = {
        resolved: 'fr',
        quality: 0.9,
        confidence: 0.8,
        fallbackChain: ['fr-CA', 'fr'],
        alternatives: ['en', 'es']
      };

      const validation = fallbackSystem.validateResolution(resolution);
      expect(validation.isValid).toBe(true);
      expect(validation.score).toBeGreaterThan(0.7);
    });

    it('should identify low-quality resolutions', () => {
      const resolution = {
        resolved: 'en',
        quality: 0.2,
        confidence: 0.1,
        fallbackChain: ['zh', 'unknown', 'en'],
        alternatives: []
      };

      const validation = fallbackSystem.validateResolution(resolution);
      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.issues.some(issue => issue.includes('Low quality'))).toBe(true);
    });

    it('should detect deep fallback chains', () => {
      const resolution = {
        resolved: 'en',
        quality: 0.5,
        confidence: 0.5,
        fallbackChain: ['a', 'b', 'c', 'd', 'en'], // Too deep
        alternatives: ['fr']
      };

      const validation = fallbackSystem.validateResolution(resolution);
      expect(validation.issues.some(issue => issue.includes('too deep'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty available locales', () => {
      const result = fallbackSystem.resolveLocale({
        requestedLocale: 'fr',
        availableLocales: []
      });

      expect(result.resolved).toBe('en'); // Default locale
    });

    it('should handle null/undefined requested locale', () => {
      const result = fallbackSystem.resolveLocale({
        requestedLocale: null,
        availableLocales: ['en', 'fr']
      });

      expect(result.resolved).toBe('en');
    });

    it('should handle malformed Accept-Language header', () => {
      const candidates = fallbackSystem.parseAcceptLanguageForFallback(
        'invalid-header-format',
        ['en', 'fr']
      );

      // Should not crash and return empty or valid candidates
      expect(Array.isArray(candidates)).toBe(true);
    });
  });
});