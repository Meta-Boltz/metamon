/**
 * Tests for I18n Router
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { I18nRouter } from '../shared/i18n-router.js';

// Mock window and history
global.window = {
  location: {
    href: 'https://example.com/',
    pathname: '/',
    search: '',
    hash: '',
    origin: 'https://example.com'
  },
  history: {
    pushState: vi.fn(),
    replaceState: vi.fn()
  },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

global.document = {
  cookie: ''
};

describe('I18nRouter', () => {
  let router;
  let mockRouteManifest;

  beforeEach(() => {
    vi.clearAllMocks();

    router = new I18nRouter({
      defaultLocale: 'en',
      supportedLocales: ['en', 'fr', 'es'],
      strategy: 'prefix',
      autoRedirect: false // Disable for testing
    });

    mockRouteManifest = {
      i18nRoutes: {
        en: {
          locale: 'en',
          routes: [
            { route: '/', component: 'home.mtm', title: 'Home' },
            { route: '/about', component: 'about.mtm', title: 'About' },
            { route: '/blog/[slug]', component: 'blog.mtm', title: 'Blog', isDynamic: true, pattern: '^/blog/([^/]+)$' }
          ],
          defaultRoute: { route: '/', component: 'home.mtm', title: 'Home' },
          staticRoutes: [
            { route: '/', component: 'home.mtm', title: 'Home' },
            { route: '/about', component: 'about.mtm', title: 'About' }
          ],
          dynamicRoutes: [
            { route: '/blog/[slug]', component: 'blog.mtm', title: 'Blog', isDynamic: true, pattern: '^/blog/([^/]+)$' }
          ]
        },
        fr: {
          locale: 'fr',
          routes: [
            { route: '/fr/', component: 'home.mtm', title: 'Accueil', originalRoute: '/' },
            { route: '/fr/a-propos', component: 'about.mtm', title: 'À Propos', originalRoute: '/about' },
            { route: '/fr/blog/[slug]', component: 'blog.mtm', title: 'Blog', isDynamic: true, pattern: '^/fr/blog/([^/]+)$', originalRoute: '/blog/[slug]' }
          ],
          defaultRoute: { route: '/fr/', component: 'home.mtm', title: 'Accueil' },
          staticRoutes: [
            { route: '/fr/', component: 'home.mtm', title: 'Accueil' },
            { route: '/fr/a-propos', component: 'about.mtm', title: 'À Propos' }
          ],
          dynamicRoutes: [
            { route: '/fr/blog/[slug]', component: 'blog.mtm', title: 'Blog', isDynamic: true, pattern: '^/fr/blog/([^/]+)$' }
          ]
        },
        es: {
          locale: 'es',
          routes: [
            { route: '/es/', component: 'home.mtm', title: 'Inicio', originalRoute: '/' },
            { route: '/es/acerca', component: 'about.mtm', title: 'Acerca', originalRoute: '/about' }
          ],
          defaultRoute: { route: '/es/', component: 'home.mtm', title: 'Inicio' },
          staticRoutes: [
            { route: '/es/', component: 'home.mtm', title: 'Inicio' },
            { route: '/es/acerca', component: 'about.mtm', title: 'Acerca' }
          ],
          dynamicRoutes: []
        }
      }
    };
  });

  describe('Initialization', () => {
    it('should initialize with default locale', () => {
      // Reset to default state
      window.location.pathname = '/';
      router.init(mockRouteManifest);

      expect(router.getCurrentLocale()).toBe('en');
      expect(router.routeManifest).toBe(mockRouteManifest);
    });

    it('should detect locale from URL on init', () => {
      window.location.href = 'https://example.com/fr/page';
      window.location.pathname = '/fr/page';

      router.init(mockRouteManifest);

      expect(router.getCurrentLocale()).toBe('fr');
    });
  });

  describe('Route Resolution', () => {
    beforeEach(() => {
      window.location.pathname = '/';
      router.init(mockRouteManifest);
    });

    it('should resolve static route for locale', async () => {
      const route = await router.resolveLocalizedRoute('/about', 'en');

      expect(route).toBeDefined();
      expect(route.route).toBe('/about');
      expect(route.component).toBe('about.mtm');
    });

    it('should resolve localized route', async () => {
      const route = await router.resolveLocalizedRoute('/fr/a-propos', 'fr');

      expect(route).toBeDefined();
      expect(route.route).toBe('/fr/a-propos');
      expect(route.title).toBe('À Propos');
    });

    it('should resolve dynamic route', async () => {
      const route = await router.resolveLocalizedRoute('/blog/my-post', 'en');

      expect(route).toBeDefined();
      expect(route.isDynamic).toBe(true);
      expect(route.component).toBe('blog.mtm');
    });

    it('should return null for non-existent route', async () => {
      const route = await router.resolveLocalizedRoute('/non-existent', 'en');

      expect(route).toBeNull();
    });

    it('should fallback to default locale', async () => {
      const route = await router.resolveLocalizedRoute('/about', 'de'); // unsupported locale

      expect(route).toBeDefined();
      expect(route.route).toBe('/about');
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      // Reset window location to English
      window.location.pathname = '/';
      router.init(mockRouteManifest);
      router.currentLocale = 'en'; // Force English locale for navigation tests
    });

    it('should navigate to route', async () => {
      const route = await router.navigate('/about');

      expect(route).toBeDefined();
      expect(route.route).toBe('/about');
      expect(window.history.pushState).toHaveBeenCalledWith(
        { locale: 'en', route },
        '',
        '/about'
      );
    });

    it('should navigate with specific locale', async () => {
      const route = await router.navigate('/fr/a-propos', { locale: 'fr' });

      expect(route).toBeDefined();
      expect(route.route).toBe('/fr/a-propos');
      expect(router.getCurrentLocale()).toBe('fr');
    });

    it('should replace history when specified', async () => {
      await router.navigate('/about', { replace: true });

      expect(window.history.replaceState).toHaveBeenCalled();
      expect(window.history.pushState).not.toHaveBeenCalled();
    });

    it('should throw error for invalid route', async () => {
      await expect(router.navigate('/invalid-route')).rejects.toThrow();
    });
  });

  describe('Locale Switching', () => {
    beforeEach(() => {
      window.location.pathname = '/';
      router.init(mockRouteManifest);
      router.currentLocale = 'en'; // Force English locale
    });

    it('should switch locale and find equivalent route', async () => {
      // Start on English about page
      await router.navigate('/about');

      // Switch to French
      const equivalentRoute = await router.switchLocale('fr');

      expect(equivalentRoute).toBeDefined();
      expect(equivalentRoute.route).toBe('/fr/a-propos');
      expect(router.getCurrentLocale()).toBe('fr');
    });

    it('should handle locale switch with no equivalent route', async () => {
      // Navigate to a route that doesn't exist in Spanish
      await router.navigate('/blog/test-post');

      // Switch to Spanish (no blog routes)
      const equivalentRoute = await router.switchLocale('es');

      expect(equivalentRoute).toBeDefined();
      expect(equivalentRoute.route).toBe('/es/'); // default route
    });

    it('should throw error for unsupported locale', async () => {
      await expect(router.switchLocale('de')).rejects.toThrow('Locale not supported: de');
    });
  });

  describe('Equivalent Route Finding', () => {
    beforeEach(() => {
      router.init(mockRouteManifest);
    });

    it('should find equivalent route by originalRoute', async () => {
      const equivalent = await router.findEquivalentRoute('/about', 'en', 'fr');

      expect(equivalent).toBeDefined();
      expect(equivalent.route).toBe('/fr/a-propos');
      expect(equivalent.originalRoute).toBe('/about');
    });

    it('should find equivalent route by component', async () => {
      const equivalent = await router.findEquivalentRoute('/', 'en', 'fr');

      expect(equivalent).toBeDefined();
      expect(equivalent.component).toBe('home.mtm');
    });

    it('should return default route when no equivalent found', async () => {
      const equivalent = await router.findEquivalentRoute('/non-existent', 'en', 'fr');

      expect(equivalent).toBeDefined();
      expect(equivalent.route).toBe('/fr/');
    });
  });

  describe('Available Locales', () => {
    beforeEach(() => {
      router.init(mockRouteManifest);
    });

    it('should get available locales for route', () => {
      const locales = router.getAvailableLocales('/about');

      expect(locales).toContain('en');
      expect(locales).toContain('fr');
      expect(locales).toContain('es');
    });

    it('should get limited locales for route not in all languages', () => {
      const locales = router.getAvailableLocales('/blog/test');

      expect(locales).toContain('en');
      expect(locales).toContain('fr');
      expect(locales).not.toContain('es'); // No blog routes in Spanish
    });
  });

  describe('Localized URLs', () => {
    beforeEach(() => {
      router.init(mockRouteManifest);
    });

    it('should get localized URLs for current route', () => {
      const urls = router.getLocalizedUrls('/about');

      expect(urls.en).toBe('https://example.com/about');
      expect(urls.fr).toBe('https://example.com/fr/a-propos');
      expect(urls.es).toBe('https://example.com/es/acerca');
    });

    it('should get localized path for specific locale', () => {
      const path = router.getLocalizedPath('/about', 'fr');

      expect(path).toBe('/fr/a-propos');
    });
  });

  describe('Event Handling', () => {
    beforeEach(() => {
      router.init(mockRouteManifest);
    });

    it('should add and notify event listeners', () => {
      const listener = vi.fn();
      router.addEventListener(listener);

      router.notifyListeners({ type: 'test', data: 'test' });

      expect(listener).toHaveBeenCalledWith({ type: 'test', data: 'test' });
    });

    it('should remove event listeners', () => {
      const listener = vi.fn();
      router.addEventListener(listener);
      router.removeEventListener(listener);

      router.notifyListeners({ type: 'test' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle popstate events', () => {
      const listener = vi.fn();
      router.addEventListener(listener);

      // Simulate popstate event
      router.handlePopState({
        state: { locale: 'fr', route: { route: '/fr/a-propos' } }
      });

      expect(router.getCurrentLocale()).toBe('fr');
      expect(listener).toHaveBeenCalledWith({
        type: 'popstate',
        locale: 'fr',
        route: { route: '/fr/a-propos' }
      });
    });
  });

  describe('Utility Methods', () => {
    beforeEach(() => {
      router.init(mockRouteManifest);
    });

    it('should get current path without locale prefix', () => {
      window.location.pathname = '/fr/about';

      const path = router.getCurrentPath();

      expect(path).toBe('/about');
    });

    it('should build navigation URL with query and hash', () => {
      window.location.search = '?param=value';
      window.location.hash = '#section';

      const url = router.buildNavigationUrl('/about');

      expect(url).toBe('/about?param=value#section');
    });

    it('should parse cookies', () => {
      document.cookie = 'locale=fr; theme=dark';

      const cookies = router.parseCookies();

      expect(cookies.locale).toBe('fr');
      expect(cookies.theme).toBe('dark');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources on destroy', () => {
      router.init(mockRouteManifest);
      const listener = vi.fn();
      router.addEventListener(listener);

      router.destroy();

      expect(window.removeEventListener).toHaveBeenCalledWith('popstate', router.handlePopState);
      expect(router.listeners.size).toBe(0);
    });
  });
});