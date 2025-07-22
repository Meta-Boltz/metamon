/**
 * Tests for Locale Detector
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocaleDetector } from '../shared/locale-detector.js';

describe('LocaleDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new LocaleDetector({
      defaultLocale: 'en',
      supportedLocales: ['en', 'fr', 'es', 'de'],
      strategy: 'prefix'
    });
  });

  describe('URL Detection', () => {
    it('should detect locale from URL prefix', () => {
      const result = detector.detectFromUrl('https://example.com/fr/about');

      expect(result.detected).toBe('fr');
      expect(result.source).toBe('url-prefix');
      expect(result.confidence).toBe(0.9);
    });

    it('should detect default locale for root URL', () => {
      const result = detector.detectFromUrl('https://example.com/');

      expect(result.detected).toBe('en');
      expect(result.source).toBe('url-root');
      expect(result.confidence).toBe(0.8);
    });

    it('should handle unsupported locale in URL', () => {
      const result = detector.detectFromUrl('https://example.com/zh/page');

      expect(result.detected).toBe('zh');
      expect(result.source).toBe('url-prefix-unsupported');
      expect(result.confidence).toBe(0.7);
    });

    it('should detect locale from domain TLD', () => {
      detector.options.strategy = 'domain';
      const result = detector.detectFromUrl('https://example.fr/page');

      expect(result.detected).toBe('fr');
      expect(result.source).toBe('domain-tld');
      expect(result.confidence).toBe(0.8);
    });

    it('should detect locale from subdomain', () => {
      detector.options.strategy = 'subdomain';
      const result = detector.detectFromUrl('https://fr.example.com/page');

      expect(result.detected).toBe('fr');
      expect(result.source).toBe('subdomain');
      expect(result.confidence).toBe(0.9);
    });
  });

  describe('Accept-Language Parsing', () => {
    it('should parse simple Accept-Language header', () => {
      const result = detector.parseAcceptLanguage('fr');

      expect(result.detected).toBe('fr');
      expect(result.source).toBe('accept-language');
    });

    it('should parse Accept-Language with quality values', () => {
      const result = detector.parseAcceptLanguage('fr;q=0.9,en;q=0.8,es;q=0.7');

      expect(result.detected).toBe('fr');
      expect(result.confidence).toBe(0.8); // min(0.8, 0.9)
    });

    it('should handle language variants', () => {
      const result = detector.parseAcceptLanguage('en-US,en;q=0.9');

      expect(result.detected).toBe('en');
      expect(result.source).toBe('accept-language-lang');
    });

    it('should prioritize by quality value', () => {
      const result = detector.parseAcceptLanguage('en;q=0.5,fr;q=0.9,es;q=0.7');

      expect(result.detected).toBe('fr');
    });
  });

  describe('Fallback System', () => {
    it('should find fallback for unsupported locale', () => {
      const fallback = detector.findBestFallback('en-GB');

      expect(fallback).toBe('en');
    });

    it('should use default locale as ultimate fallback', () => {
      const fallback = detector.findBestFallback('zh-CN');

      expect(fallback).toBe('en');
    });

    it('should handle language family fallbacks', () => {
      const fallback = detector.findBestFallback('fr-CA');

      expect(fallback).toBe('fr');
    });
  });

  describe('Locale Detection Priority', () => {
    it('should prioritize URL over other sources', () => {
      const result = detector.detectLocale({
        url: 'https://example.com/fr/page',
        headers: { 'accept-language': 'es' },
        cookies: { locale: 'de' }
      });

      expect(result.detected).toBe('fr');
      expect(result.source).toBe('url-prefix');
    });

    it('should fall back to cookie when URL has no locale', () => {
      const result = detector.detectLocale({
        url: 'https://example.com/page',
        cookies: { locale: 'es' }
      });

      expect(result.detected).toBe('es');
      expect(result.source).toBe('cookie');
    });

    it('should use default locale when no detection succeeds', () => {
      // Mock navigator to return unsupported language
      const originalNavigator = global.navigator;
      global.navigator = { language: 'zh-CN' };

      const result = detector.detectLocale({
        url: 'https://example.com/page',
        acceptLanguage: 'zh-CN'
      });

      expect(result.detected).toBe('en');
      expect(result.source).toBe('default');

      // Restore navigator
      global.navigator = originalNavigator;
    });
  });

  describe('URL Generation', () => {
    it('should generate localized URL with prefix strategy', () => {
      const url = detector.generateLocalizedUrl('https://example.com/about', 'fr');

      expect(url).toBe('https://example.com/fr/about');
    });

    it('should not modify URL for default locale', () => {
      const url = detector.generateLocalizedUrl('https://example.com/about', 'en');

      expect(url).toBe('https://example.com/about');
    });

    it('should replace existing locale prefix', () => {
      const url = detector.generateLocalizedUrl('https://example.com/es/about', 'fr');

      expect(url).toBe('https://example.com/fr/about');
    });

    it('should generate subdomain URL', () => {
      const url = detector.generateLocalizedUrl('https://example.com/about', 'fr', 'subdomain');

      expect(url).toBe('https://fr.example.com/about');
    });
  });

  describe('Locale Support', () => {
    it('should check if locale is supported', () => {
      expect(detector.isLocaleSupported('fr')).toBe(true);
      expect(detector.isLocaleSupported('zh')).toBe(false);
    });

    it('should update supported locales', () => {
      detector.updateSupportedLocales(['en', 'fr', 'zh']);

      expect(detector.isLocaleSupported('zh')).toBe(true);
      expect(detector.isLocaleSupported('es')).toBe(false);
    });
  });

  describe('Preference Storage', () => {
    beforeEach(() => {
      // Mock localStorage and document.cookie
      global.localStorage = {
        setItem: vi.fn(),
        getItem: vi.fn(),
        removeItem: vi.fn()
      };

      global.document = {
        cookie: ''
      };
    });

    it('should store locale preference', () => {
      const success = detector.storeLocalePreference('fr');

      expect(success).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalledWith('preferred-locale', 'fr');
    });

    it('should reject unsupported locale', () => {
      const success = detector.storeLocalePreference('zh');

      expect(success).toBe(false);
    });
  });

  describe('Cache Management', () => {
    it('should cache detection results', () => {
      const context = { url: 'https://example.com/fr/page' };

      const result1 = detector.detectLocale(context);
      const result2 = detector.detectLocale(context);

      expect(result1).toBe(result2); // Same object reference
    });

    it('should clear cache', () => {
      const context = { url: 'https://example.com/fr/page' };
      detector.detectLocale(context);

      detector.clearCache();

      expect(detector.cache.size).toBe(0);
    });
  });
});