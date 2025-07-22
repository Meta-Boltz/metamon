/**
 * Integration test for i18n routing system
 * Tests the complete flow from frontmatter parsing to route generation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FrontmatterParser } from './src/build-tools/frontmatter-parser.js';
import { createPageScanner } from './src/build-tools/page-scanner.js';
import { createRouteManifestGenerator } from './src/build-tools/route-manifest-generator.js';
import { createLocaleDetector } from './src/shared/locale-detector.js';
import { createI18nRouter } from './src/shared/i18n-router.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

describe('I18n Integration Tests', () => {
  const testPagesDir = './test-pages-i18n';
  let parser;
  let scanner;
  let generator;
  let detector;
  let router;

  beforeEach(async () => {
    // Clean up and create test directory
    try {
      rmSync(testPagesDir, { recursive: true, force: true });
    } catch (e) {
      // Directory might not exist
    }
    mkdirSync(testPagesDir, { recursive: true });

    // Initialize components
    parser = new FrontmatterParser();
    scanner = createPageScanner({ pagesDir: testPagesDir });
    generator = createRouteManifestGenerator({ pagesDir: testPagesDir });
    detector = createLocaleDetector({
      defaultLocale: 'en',
      supportedLocales: ['en', 'fr', 'es', 'de']
    });
    router = createI18nRouter({
      defaultLocale: 'en',
      supportedLocales: ['en', 'fr', 'es', 'de']
    });
  });

  afterEach(() => {
    // Clean up test directory
    try {
      rmSync(testPagesDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('Multi-language Route Registration', () => {
    it('should handle multiple route definitions in frontmatter', async () => {
      // Create test page with multiple routes
      const pageContent = `---
route:
  - /about
  - /en/about
  - /fr/a-propos
  - /es/acerca-de
title:
  en: About Us
  fr: À Propos
  es: Acerca de Nosotros
description:
  en: Learn about our company
  fr: Découvrez notre entreprise
  es: Conoce nuestra empresa
locales: [en, fr, es]
defaultLocale: en
---
<h1>About Us</h1>
<p>Company information</p>`;

      writeFileSync(join(testPagesDir, 'about.mtm'), pageContent);

      // Scan pages
      const pages = await scanner.scanPages();
      expect(pages).toHaveLength(1);

      const page = pages[0];
      expect(page.locales).toEqual(['en', 'fr', 'es']);
      expect(Array.isArray(page.metadata.route)).toBe(true);
      expect(page.metadata.route).toHaveLength(4);

      // Generate route manifest
      const manifest = await generator.generateRouteManifest();
      expect(manifest.i18nRoutes).toBeDefined();
      expect(Object.keys(manifest.i18nRoutes)).toEqual(['en', 'fr', 'es']);

      // Check English routes
      const enRoutes = manifest.i18nRoutes.en;
      expect(enRoutes.routes).toHaveLength(2); // /about and /en/about
      expect(enRoutes.routes.some(r => r.route === '/about')).toBe(true);
      expect(enRoutes.routes.some(r => r.route === '/en/about')).toBe(true);

      // Check French routes
      const frRoutes = manifest.i18nRoutes.fr;
      expect(frRoutes.routes).toHaveLength(1);
      expect(frRoutes.routes[0].route).toBe('/fr/a-propos');
      expect(frRoutes.routes[0].title).toBe('À Propos');

      // Check Spanish routes
      const esRoutes = manifest.i18nRoutes.es;
      expect(esRoutes.routes).toHaveLength(1);
      expect(esRoutes.routes[0].route).toBe('/es/acerca-de');
      expect(esRoutes.routes[0].title).toBe('Acerca de Nosotros');
    });

    it('should handle locale-keyed route definitions', async () => {
      const pageContent = `---
route:
  en: /products
  fr: /produits
  es: /productos
  de: /produkte
title:
  en: Our Products
  fr: Nos Produits
  es: Nuestros Productos
  de: Unsere Produkte
locales: [en, fr, es, de]
---
<h1>Products</h1>`;

      writeFileSync(join(testPagesDir, 'products.mtm'), pageContent);

      const pages = await scanner.scanPages();
      const manifest = await generator.generateRouteManifest();

      expect(Object.keys(manifest.i18nRoutes)).toEqual(['en', 'fr', 'es', 'de']);

      // Check each locale has its specific route
      expect(manifest.i18nRoutes.en.routes[0].route).toBe('/products');
      expect(manifest.i18nRoutes.fr.routes[0].route).toBe('/produits');
      expect(manifest.i18nRoutes.es.routes[0].route).toBe('/productos');
      expect(manifest.i18nRoutes.de.routes[0].route).toBe('/produkte');

      // Check localized titles
      expect(manifest.i18nRoutes.en.routes[0].title).toBe('Our Products');
      expect(manifest.i18nRoutes.fr.routes[0].title).toBe('Nos Produits');
      expect(manifest.i18nRoutes.es.routes[0].title).toBe('Nuestros Productos');
      expect(manifest.i18nRoutes.de.routes[0].title).toBe('Unsere Produkte');
    });

    it('should handle mixed route definition formats', async () => {
      const pageContent = `---
route:
  - /blog
  - /en/blog
  - path: /fr/blog
    locale: fr
  - path: /es/blog
    locale: es
title:
  en: Blog
  fr: Blog
  es: Blog
locales: [en, fr, es]
---
<h1>Blog</h1>`;

      writeFileSync(join(testPagesDir, 'blog.mtm'), pageContent);

      const pages = await scanner.scanPages();
      const manifest = await generator.generateRouteManifest();

      expect(manifest.i18nRoutes.en.routes.length).toBeGreaterThan(0);
      expect(manifest.i18nRoutes.fr.routes.length).toBeGreaterThan(0);
      expect(manifest.i18nRoutes.es.routes.length).toBeGreaterThan(0);
    });
  });

  describe('Locale Detection from URL and Browser', () => {
    it('should detect locale from URL patterns', () => {
      const testCases = [
        { url: 'https://example.com/', expected: 'en' },
        { url: 'https://example.com/fr/page', expected: 'fr' },
        { url: 'https://example.com/es/acerca', expected: 'es' },
        { url: 'https://example.com/de/uber-uns', expected: 'de' }
      ];

      testCases.forEach(({ url, expected }) => {
        const result = detector.detectLocale({ url });
        expect(result.detected).toBe(expected);
      });
    });

    it('should detect locale from browser settings', () => {
      const result = detector.detectLocale({
        acceptLanguage: 'fr-FR,fr;q=0.9,en;q=0.8'
      });

      expect(result.detected).toBe('fr');
      expect(result.source).toBe('accept-language');
    });

    it('should provide fallback for unsupported locales', () => {
      const result = detector.detectLocale({
        url: 'https://example.com/zh/page'
      });

      expect(result.detected).toBe('zh');
      expect(result.isSupported).toBe(false);
      expect(result.fallback).toBe('en');
    });
  });

  describe('Locale-specific Route Manifests', () => {
    it('should generate separate manifests for each locale', async () => {
      // Create multiple pages with different locale support
      const homeContent = `---
route:
  en: /
  fr: /fr/
  es: /es/
title:
  en: Home
  fr: Accueil
  es: Inicio
locales: [en, fr, es]
---
<h1>Welcome</h1>`;

      const aboutContent = `---
route:
  en: /about
  fr: /fr/a-propos
title:
  en: About
  fr: À Propos
locales: [en, fr]
---
<h1>About</h1>`;

      const contactContent = `---
route: /contact
title: Contact
locales: [en]
---
<h1>Contact</h1>`;

      writeFileSync(join(testPagesDir, 'index.mtm'), homeContent);
      writeFileSync(join(testPagesDir, 'about.mtm'), aboutContent);
      writeFileSync(join(testPagesDir, 'contact.mtm'), contactContent);

      const manifest = await generator.generateRouteManifest();

      // English should have all routes
      expect(manifest.i18nRoutes.en.routes).toHaveLength(3);
      expect(manifest.i18nRoutes.en.routes.some(r => r.route === '/')).toBe(true);
      expect(manifest.i18nRoutes.en.routes.some(r => r.route === '/about')).toBe(true);
      expect(manifest.i18nRoutes.en.routes.some(r => r.route === '/contact')).toBe(true);

      // French should have home and about
      expect(manifest.i18nRoutes.fr.routes).toHaveLength(2);
      expect(manifest.i18nRoutes.fr.routes.some(r => r.route === '/fr/')).toBe(true);
      expect(manifest.i18nRoutes.fr.routes.some(r => r.route === '/fr/a-propos')).toBe(true);

      // Spanish should have only home
      expect(manifest.i18nRoutes.es.routes).toHaveLength(1);
      expect(manifest.i18nRoutes.es.routes[0].route).toBe('/es/');
    });
  });

  describe('Locale Switching and Navigation', () => {
    it('should handle locale switching with route equivalents', async () => {
      // Create test pages
      const aboutContent = `---
route:
  en: /about
  fr: /fr/a-propos
  es: /es/acerca
title:
  en: About Us
  fr: À Propos
  es: Acerca
locales: [en, fr, es]
---
<h1>About</h1>`;

      writeFileSync(join(testPagesDir, 'about.mtm'), aboutContent);

      const manifest = await generator.generateRouteManifest();

      // Mock window for router
      global.window = {
        location: { href: 'https://example.com/about', pathname: '/about', search: '', hash: '', origin: 'https://example.com' },
        history: { pushState: vi.fn(), replaceState: vi.fn() },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      };

      router.init(manifest);

      // Navigate to English about page
      await router.navigate('/about', { locale: 'en' });
      expect(router.getCurrentLocale()).toBe('en');

      // Switch to French - should find equivalent route
      const equivalentRoute = await router.switchLocale('fr', { redirect: false });
      expect(equivalentRoute.route).toBe('/fr/a-propos');
      expect(router.getCurrentLocale()).toBe('fr');

      // Switch to Spanish
      const spanishRoute = await router.switchLocale('es', { redirect: false });
      expect(spanishRoute.route).toBe('/es/acerca');
    });

    it('should generate proper URLs for search engines', () => {
      const testCases = [
        { path: '/about', locale: 'en', expected: 'https://example.com/about' },
        { path: '/about', locale: 'fr', expected: 'https://example.com/fr/about' },
        { path: '/about', locale: 'es', expected: 'https://example.com/es/about' }
      ];

      testCases.forEach(({ path, locale, expected }) => {
        const url = detector.generateLocalizedUrl(`https://example.com${path}`, locale);
        expect(url).toBe(expected);
      });
    });
  });

  describe('Error Handling and Validation', () => {
    it('should validate i18n route configurations', () => {
      const invalidContent = `---
route:
  - /valid
  - invalid-route-without-slash
  - ""
locales: "not-an-array"
title: Test
---
<h1>Test</h1>`;

      const result = parser.parse(invalidContent);
      const errors = parser.validateI18nRoutes(result.frontmatter);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.message.includes('must start with /'))).toBe(true);
    });

    it('should handle missing translations gracefully', async () => {
      const pageContent = `---
route:
  en: /incomplete
  fr: /fr/incomplet
title:
  en: Incomplete Page
  # Missing French title
locales: [en, fr, es]
---
<h1>Page</h1>`;

      writeFileSync(join(testPagesDir, 'incomplete.mtm'), pageContent);

      const manifest = await generator.generateRouteManifest();

      // Should still generate routes but with fallback values
      expect(manifest.i18nRoutes.fr.routes[0].title).toBe('Incomplete Page'); // Falls back to English
      expect(manifest.i18nRoutes.es.routes).toHaveLength(0); // No Spanish route defined
    });
  });

  describe('Performance and Caching', () => {
    it('should cache locale detection results', () => {
      const context = { url: 'https://example.com/fr/page' };

      const result1 = detector.detectLocale(context);
      const result2 = detector.detectLocale(context);

      // Should return the same cached object
      expect(result1).toBe(result2);
      expect(detector.cache.size).toBe(1);
    });

    it('should handle large numbers of localized routes efficiently', async () => {
      // Create many pages with multiple locales
      const locales = ['en', 'fr', 'es', 'de', 'it', 'pt', 'nl', 'ru'];

      for (let i = 0; i < 10; i++) {
        const routes = {};
        const titles = {};

        locales.forEach(locale => {
          routes[locale] = `/${locale}/page-${i}`;
          titles[locale] = `Page ${i} (${locale})`;
        });

        const content = `---
route: ${JSON.stringify(routes, null, 2)}
title: ${JSON.stringify(titles, null, 2)}
locales: ${JSON.stringify(locales)}
---
<h1>Page ${i}</h1>`;

        writeFileSync(join(testPagesDir, `page-${i}.mtm`), content);
      }

      const startTime = Date.now();
      const manifest = await generator.generateRouteManifest();
      const endTime = Date.now();

      // Should complete in reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);

      // Should generate all locale routes
      expect(Object.keys(manifest.i18nRoutes)).toEqual(locales);
      locales.forEach(locale => {
        expect(manifest.i18nRoutes[locale].routes).toHaveLength(10);
      });
    });
  });
});

// Run the tests
if (import.meta.vitest) {
  // Tests will run automatically with vitest
}