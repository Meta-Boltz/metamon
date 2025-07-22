/**
 * Tests for i18n frontmatter parsing and route registration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FrontmatterParser } from '../build-tools/frontmatter-parser.js';

describe('I18n Frontmatter Parser', () => {
  let parser;

  beforeEach(() => {
    parser = new FrontmatterParser();
  });

  describe('Multiple Route Definitions', () => {
    it('should parse single route definition', () => {
      const content = `---
route: /about
title: About Us
description: Learn about our company
---
<h1>About Us</h1>`;

      const result = parser.parse(content);

      expect(result.isValid).toBe(true);
      expect(result.frontmatter.route).toBe('/about');
      expect(result.frontmatter.title).toBe('About Us');
    });

    it('should parse multiple route definitions for i18n', () => {
      const content = `---
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
locales:
  - en
  - fr
  - es
---
<h1>About Us</h1>`;

      const result = parser.parse(content);

      expect(result.isValid).toBe(true);
      expect(Array.isArray(result.frontmatter.route)).toBe(true);
      expect(result.frontmatter.route).toEqual(['/about', '/en/about', '/fr/a-propos', '/es/acerca-de']);
      expect(result.frontmatter.locales).toEqual(['en', 'fr', 'es']);
      expect(typeof result.frontmatter.title).toBe('object');
      expect(result.frontmatter.title.en).toBe('About Us');
      expect(result.frontmatter.title.fr).toBe('À Propos');
    });

    it('should parse locale-specific metadata', () => {
      const content = `---
route:
  en: /products
  fr: /produits
  de: /produkte
title:
  en: Our Products
  fr: Nos Produits
  de: Unsere Produkte
description:
  en: Explore our product catalog
  fr: Explorez notre catalogue de produits
  de: Entdecken Sie unseren Produktkatalog
keywords:
  en: [products, catalog, shop]
  fr: [produits, catalogue, boutique]
  de: [produkte, katalog, shop]
locales: [en, fr, de]
defaultLocale: en
---
<h1>Products</h1>`;

      const result = parser.parse(content);

      expect(result.isValid).toBe(true);
      expect(typeof result.frontmatter.route).toBe('object');
      expect(result.frontmatter.route.en).toBe('/products');
      expect(result.frontmatter.route.fr).toBe('/produits');
      expect(result.frontmatter.route.de).toBe('/produkte');
      expect(result.frontmatter.defaultLocale).toBe('en');
    });

    it('should handle mixed route definition formats', () => {
      const content = `---
route:
  - /home
  - /en/home
  - path: /fr/accueil
    locale: fr
  - path: /es/inicio
    locale: es
title:
  en: Home
  fr: Accueil
  es: Inicio
locales: [en, fr, es]
---
<h1>Welcome</h1>`;

      const result = parser.parse(content);

      expect(result.isValid).toBe(true);
      expect(Array.isArray(result.frontmatter.route)).toBe(true);
      expect(result.frontmatter.route.length).toBe(4);
    });

    it('should validate i18n route patterns', () => {
      const content = `---
route:
  - /blog
  - /en/blog
  - /fr/blog
  - /invalid route with spaces
title: Blog
locales: [en, fr]
---
<h1>Blog</h1>`;

      const result = parser.parse(content);

      // Should still parse but may have validation warnings
      expect(result.frontmatter.route).toBeDefined();
      expect(Array.isArray(result.frontmatter.route)).toBe(true);
    });
  });

  describe('Locale Detection', () => {
    it('should detect locales from route patterns', () => {
      const content = `---
route:
  - /
  - /en/
  - /fr/
  - /de/
title: Home
---
<h1>Home</h1>`;

      const result = parser.parse(content);

      expect(result.isValid).toBe(true);
      // Parser should be able to infer locales from route patterns
      expect(result.frontmatter.route).toEqual(['/', '/en/', '/fr/', '/de/']);
    });

    it('should handle explicit locale configuration', () => {
      const content = `---
route: /contact
locales: [en, fr, es, de]
i18n:
  strategy: prefix
  defaultLocale: en
  fallback: true
title:
  en: Contact Us
  fr: Nous Contacter
  es: Contáctanos
  de: Kontakt
---
<h1>Contact</h1>`;

      const result = parser.parse(content);

      expect(result.isValid).toBe(true);
      expect(result.frontmatter.locales).toEqual(['en', 'fr', 'es', 'de']);
      expect(result.frontmatter.i18n.strategy).toBe('prefix');
      expect(result.frontmatter.i18n.defaultLocale).toBe('en');
    });
  });

  describe('Route Generation Patterns', () => {
    it('should support route generation patterns', () => {
      const content = `---
route:
  pattern: "/{locale}/blog/{slug}"
  locales: [en, fr, es]
  generate:
    - { locale: en, slug: "getting-started" }
    - { locale: fr, slug: "commencer" }
    - { locale: es, slug: "empezar" }
title:
  en: Getting Started
  fr: Commencer
  es: Empezar
---
<h1>Getting Started</h1>`;

      const result = parser.parse(content);

      expect(result.isValid).toBe(true);
      expect(result.frontmatter.route.pattern).toBe('/{locale}/blog/{slug}');
      expect(Array.isArray(result.frontmatter.route.generate)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid i18n configuration', () => {
      const content = `---
route:
  - /valid
  - invalid-route-without-slash
locales: "not-an-array"
title: Test
---
<h1>Test</h1>`;

      const result = parser.parse(content);

      // Should parse but may have validation issues
      expect(result.frontmatter.route).toBeDefined();
      expect(result.frontmatter.locales).toBe('not-an-array');
    });

    it('should provide helpful error messages for i18n issues', () => {
      const content = `---
route:
  en: /english
  fr: /french
  # Missing closing bracket
title: [Test
locales: [en, fr]
---
<h1>Test</h1>`;

      const result = parser.parse(content);

      // Should handle parsing errors gracefully
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});