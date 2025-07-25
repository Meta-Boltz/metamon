const ClientRouter = require('../client-router');

// Mock DOM and window objects for testing
const mockWindow = {
  location: {
    pathname: '/',
    search: '',
    href: 'http://localhost/'
  },
  history: {
    pushState: jest.fn(),
    replaceState: jest.fn(),
    back: jest.fn(),
    forward: jest.fn()
  },
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

const mockDocument = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

// Mock route registry
const createMockRouteRegistry = () => ({
  resolve: jest.fn()
});

describe('ClientRouter', () => {
  let router;
  let mockRouteRegistry;
  let originalWindow;
  let originalDocument;

  beforeEach(() => {
    // Store original globals
    originalWindow = global.window;
    originalDocument = global.document;

    // Set up mocks
    global.window = mockWindow;
    global.document = mockDocument;

    // Reset mocks
    jest.clearAllMocks();

    // Create fresh instances
    mockRouteRegistry = createMockRouteRegistry();
    router = new ClientRouter(mockRouteRegistry);
  });

  afterEach(() => {
    // Clean up router first while mocks are still active
    if (router && router.isInitialized) {
      router.destroy();
    }

    // Restore original globals
    global.window = originalWindow;
    global.document = originalDocument;
  });

  describe('constructor', () => {
    test('should initialize with route registry', () => {
      expect(router.routeRegistry).toBe(mockRouteRegistry);
      expect(router.currentRoute).toBeNull();
      expect(router.routeChangeCallbacks).toEqual([]);
      expect(router.isInitialized).toBe(false);
    });
  });

  describe('initialize', () => {
    test('should set up event listeners and handle initial route', () => {
      const mockRouteMatch = { route: { path: '/' }, params: {}, query: {} };
      mockRouteRegistry.resolve.mockReturnValue(mockRouteMatch);

      router.initialize();

      expect(mockWindow.addEventListener).toHaveBeenCalledWith('popstate', router.handlePopState);
      expect(mockDocument.addEventListener).toHaveBeenCalledWith('click', router.handleLinkClick);
      expect(router.isInitialized).toBe(true);
      expect(router.currentRoute).toBe(mockRouteMatch);
    });

    test('should not initialize twice', () => {
      router.initialize();
      router.initialize();

      expect(mockWindow.addEventListener).toHaveBeenCalledTimes(1);
      expect(mockDocument.addEventListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('destroy', () => {
    test('should remove event listeners', () => {
      router.initialize();
      router.destroy();

      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('popstate', router.handlePopState);
      expect(mockDocument.removeEventListener).toHaveBeenCalledWith('click', router.handleLinkClick);
      expect(router.isInitialized).toBe(false);
    });

    test('should not destroy if not initialized', () => {
      router.destroy();

      expect(mockWindow.removeEventListener).not.toHaveBeenCalled();
      expect(mockDocument.removeEventListener).not.toHaveBeenCalled();
    });
  });

  describe('navigate', () => {
    test('should navigate to valid route', () => {
      const mockRouteMatch = { route: { path: '/about' }, params: {}, query: {} };
      mockRouteRegistry.resolve.mockReturnValue(mockRouteMatch);

      router.navigate('/about');

      expect(mockWindow.history.pushState).toHaveBeenCalledWith(null, '', '/about');
      expect(router.currentRoute).toBe(mockRouteMatch);
    });

    test('should throw error for invalid route', () => {
      mockRouteRegistry.resolve.mockReturnValue(null);

      expect(() => router.navigate('/invalid')).toThrow('Route not found: /invalid');
    });

    test('should replace history when replace option is true', () => {
      const mockRouteMatch = { route: { path: '/about' }, params: {}, query: {} };
      mockRouteRegistry.resolve.mockReturnValue(mockRouteMatch);

      router.navigate('/about', { replace: true });

      expect(mockWindow.history.replaceState).toHaveBeenCalledWith(null, '', '/about');
      expect(mockWindow.history.pushState).not.toHaveBeenCalled();
    });

    test('should pass state to history API', () => {
      const mockRouteMatch = { route: { path: '/about' }, params: {}, query: {} };
      const state = { custom: 'data' };
      mockRouteRegistry.resolve.mockReturnValue(mockRouteMatch);

      router.navigate('/about', { state });

      expect(mockWindow.history.pushState).toHaveBeenCalledWith(state, '', '/about');
    });
  });

  describe('back', () => {
    test('should call window.history.back', () => {
      router.back();
      expect(mockWindow.history.back).toHaveBeenCalled();
    });
  });

  describe('forward', () => {
    test('should call window.history.forward', () => {
      router.forward();
      expect(mockWindow.history.forward).toHaveBeenCalled();
    });
  });

  describe('replace', () => {
    test('should navigate with replace option', () => {
      const mockRouteMatch = { route: { path: '/about' }, params: {}, query: {} };
      mockRouteRegistry.resolve.mockReturnValue(mockRouteMatch);

      router.replace('/about');

      expect(mockWindow.history.replaceState).toHaveBeenCalledWith(null, '', '/about');
    });
  });

  describe('getCurrentRoute', () => {
    test('should return current route', () => {
      const mockRouteMatch = { route: { path: '/about' }, params: {}, query: {} };
      router.currentRoute = mockRouteMatch;

      expect(router.getCurrentRoute()).toBe(mockRouteMatch);
    });

    test('should return null when no current route', () => {
      expect(router.getCurrentRoute()).toBeNull();
    });
  });

  describe('onRouteChange', () => {
    test('should register route change callback', () => {
      const callback = jest.fn();
      const unsubscribe = router.onRouteChange(callback);

      expect(router.routeChangeCallbacks).toContain(callback);
      expect(typeof unsubscribe).toBe('function');
    });

    test('should call callbacks on route change', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const mockRouteMatch = { route: { path: '/about' }, params: {}, query: {} };

      router.onRouteChange(callback1);
      router.onRouteChange(callback2);
      mockRouteRegistry.resolve.mockReturnValue(mockRouteMatch);

      router.navigate('/about');

      expect(callback1).toHaveBeenCalledWith(mockRouteMatch, null, { preserveScroll: false });
      expect(callback2).toHaveBeenCalledWith(mockRouteMatch, null, { preserveScroll: false });
    });

    test('should unsubscribe callback', () => {
      const callback = jest.fn();
      const unsubscribe = router.onRouteChange(callback);

      unsubscribe();

      expect(router.routeChangeCallbacks).not.toContain(callback);
    });

    test('should throw error for non-function callback', () => {
      expect(() => router.onRouteChange('not a function')).toThrow('Route change callback must be a function');
    });
  });

  describe('handlePopState', () => {
    test('should handle valid route on popstate', () => {
      const mockRouteMatch = { route: { path: '/about' }, params: {}, query: {} };
      mockWindow.location.pathname = '/about';
      mockWindow.location.search = '';
      mockRouteRegistry.resolve.mockReturnValue(mockRouteMatch);

      const callback = jest.fn();
      router.onRouteChange(callback);

      router.handlePopState({});

      expect(router.currentRoute).toBe(mockRouteMatch);
      expect(callback).toHaveBeenCalledWith(mockRouteMatch, null, { fromPopState: true });
    });

    test('should warn for invalid route on popstate', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockWindow.location.pathname = '/invalid';
      mockWindow.location.search = '';
      mockRouteRegistry.resolve.mockReturnValue(null);

      router.handlePopState({});

      expect(consoleSpy).toHaveBeenCalledWith('Route not found during popstate: /invalid');
      consoleSpy.mockRestore();
    });
  });

  describe('handleLinkClick', () => {
    const createMockEvent = (overrides = {}) => ({
      button: 0,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: jest.fn(),
      target: {
        closest: jest.fn()
      },
      ...overrides
    });

    const createMockAnchor = (overrides = {}) => ({
      getAttribute: jest.fn(),
      hasAttribute: jest.fn(),
      ...overrides
    });

    test('should ignore non-left clicks', () => {
      const event = createMockEvent({ button: 1 });
      router.handleLinkClick(event);
      expect(event.target.closest).not.toHaveBeenCalled();
    });

    test('should ignore clicks with modifier keys', () => {
      const event = createMockEvent({ ctrlKey: true });
      router.handleLinkClick(event);
      expect(event.target.closest).not.toHaveBeenCalled();
    });

    test('should ignore clicks without anchor tag', () => {
      const event = createMockEvent();
      event.target.closest.mockReturnValue(null);

      router.handleLinkClick(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('should ignore external links', () => {
      const event = createMockEvent();
      const anchor = createMockAnchor();
      anchor.getAttribute.mockReturnValue('https://example.com');
      event.target.closest.mockReturnValue(anchor);

      router.handleLinkClick(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('should ignore links with data-external attribute', () => {
      const event = createMockEvent();
      const anchor = createMockAnchor();
      anchor.getAttribute.mockReturnValue('/internal');
      anchor.hasAttribute.mockImplementation(attr => attr === 'data-external');
      event.target.closest.mockReturnValue(anchor);

      router.handleLinkClick(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('should ignore links with target="_blank"', () => {
      const event = createMockEvent();
      const anchor = createMockAnchor();
      anchor.getAttribute.mockImplementation(attr => {
        if (attr === 'href') return '/internal';
        if (attr === 'target') return '_blank';
        return null;
      });
      anchor.hasAttribute.mockReturnValue(false);
      event.target.closest.mockReturnValue(anchor);

      router.handleLinkClick(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    test('should handle internal link navigation', () => {
      const event = createMockEvent();
      const anchor = createMockAnchor();
      const mockRouteMatch = { route: { path: '/about' }, params: {}, query: {} };

      anchor.getAttribute.mockReturnValue('/about');
      anchor.hasAttribute.mockReturnValue(false);
      event.target.closest.mockReturnValue(anchor);
      mockRouteRegistry.resolve.mockReturnValue(mockRouteMatch);

      router.handleLinkClick(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockWindow.history.pushState).toHaveBeenCalledWith(null, '', '/about');
    });

    test('should handle navigation errors gracefully', () => {
      const event = createMockEvent();
      const anchor = createMockAnchor();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      anchor.getAttribute.mockReturnValue('/about');
      anchor.hasAttribute.mockReturnValue(false);
      event.target.closest.mockReturnValue(anchor);
      mockRouteRegistry.resolve.mockReturnValue({ route: { path: '/about' }, params: {}, query: {} });

      // Mock navigate to throw an error
      const originalNavigate = router.navigate;
      router.navigate = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      // Should not throw
      expect(() => router.handleLinkClick(event)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Navigation error:', expect.any(Error));

      // Restore original method
      router.navigate = originalNavigate;
      consoleSpy.mockRestore();
    });
  });

  describe('isExternalLink', () => {
    test('should identify absolute URLs as external', () => {
      expect(router.isExternalLink('https://example.com')).toBe(true);
      expect(router.isExternalLink('http://example.com')).toBe(true);
    });

    test('should identify protocol-relative URLs as external', () => {
      expect(router.isExternalLink('//example.com')).toBe(true);
    });

    test('should identify protocol URLs as external', () => {
      expect(router.isExternalLink('mailto:test@example.com')).toBe(true);
      expect(router.isExternalLink('tel:+1234567890')).toBe(true);
    });

    test('should identify relative URLs as internal', () => {
      expect(router.isExternalLink('/about')).toBe(false);
      expect(router.isExternalLink('./about')).toBe(false);
      expect(router.isExternalLink('about')).toBe(false);
    });
  });

  describe('getCurrentPath', () => {
    test('should return current pathname and search', () => {
      mockWindow.location.pathname = '/about';
      mockWindow.location.search = '?tab=info';

      expect(router.getCurrentPath()).toBe('/about?tab=info');
    });
  });

  describe('isCurrentRoute', () => {
    test('should return true for matching path', () => {
      mockWindow.location.pathname = '/about';
      mockWindow.location.search = '';

      expect(router.isCurrentRoute('/about')).toBe(true);
    });

    test('should return false for non-matching path', () => {
      mockWindow.location.pathname = '/about';
      mockWindow.location.search = '';

      expect(router.isCurrentRoute('/contact')).toBe(false);
    });
  });
});