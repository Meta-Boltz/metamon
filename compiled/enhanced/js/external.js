
// Enhanced MTM Router System
const MTMRouter = {
  _signals: new Map(),
  _subscribers: new Map(),
  _routes: new Map(),
  _currentRoute: null,
  
  // Signal system
  create(key, initialValue) {
    if (!this._signals.has(key)) {
      this._signals.set(key, initialValue);
      this._subscribers.set(key, new Set());
    }
    
    return {
      get value() { return MTMRouter._signals.get(key); },
      set value(newValue) {
        MTMRouter._signals.set(key, newValue);
        MTMRouter._notifySubscribers(key, newValue);
      },
      subscribe(callback) { MTMRouter._subscribers.get(key).add(callback); }
    };
  },
  
  _notifySubscribers(key, value) {
    if (this._subscribers.has(key)) {
      this._subscribers.get(key).forEach(callback => callback(value));
    }
  },
  
  // Router system
  navigate(path) {
    if (this._currentRoute !== path) {
      this._currentRoute = path;
      window.history.pushState({ path }, '', path);
      this.updatePage(path);
    }
  },
  
  updatePage(path) {
    // Update document title based on route
    const route = this._routes.get(path);
    if (route && route.title) {
      document.title = route.title;
    }
    
    // Emit route change event
    this.emit('route-changed', { path, route });
  },
  
  setupLinkInterception() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[data-link="true"], a:not([external]):not([href^="http"]):not([href^="mailto"]):not([href^="tel"])');
      if (link && link.href && !link.hasAttribute('external')) {
        const url = new URL(link.href);
        if (url.origin === window.location.origin) {
          e.preventDefault();
          this.navigate(url.pathname);
        }
      }
    });
  },
  
  setupPopState() {
    window.addEventListener('popstate', (e) => {
      const path = e.state?.path || window.location.pathname;
      this._currentRoute = path;
      this.updatePage(path);
    });
  },
  
  init() {
    this.setupLinkInterception();
    this.setupPopState();
    this._currentRoute = window.location.pathname;
  },
  
  emit(event, data) {
    console.log('MTM Router Event:', event, data);
    window.dispatchEvent(new CustomEvent('mtm-' + event, { detail: data }));
  }
};

// Component system
const MTMComponents = {
  _registry: new Map(),
  
  register(name, type, factory) {
    this._registry.set(name, { type, factory });
  },
  
  mount(element, name, props = {}) {
    const component = this._registry.get(name);
    if (component) {
      const instance = component.factory(props);
      if (typeof instance.mount === 'function') {
        instance.mount(element);
      } else {
        element.innerHTML = instance;
      }
    }
  },
  
  mountAll() {
    document.querySelectorAll('[data-component]').forEach(el => {
      const componentName = el.getAttribute('data-component');
      const componentType = el.getAttribute('data-type');
      
      // Extract props from data attributes
      const props = {};
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('data-prop-')) {
          const propName = attr.name.replace('data-prop-', '');
          props[propName] = attr.value;
        }
      });
      
      this.mount(el, componentName, props);
    });
  }
};

// Global signal function
window.signal = MTMRouter;

// Page metadata
const pageMetadata = {
  "route": "/",
  "title": "Home - Enhanced MTM Framework",
  "description": "Welcome to the enhanced MTM framework with link-based routing and component imports",
  "compileJs": "external.js"
};

// Register route
MTMRouter._routes.set('/', pageMetadata);

// Page Component
function IndexmtmPage() {
  // Variables
  const $welcomeMessage = MTMRouter.create('welcomeMessage', 'Welcome to Enhanced MTM!');
  const $clickCount = MTMRouter.create('clickCount', 0);

  // Functions  
  const $handleClick = () => {
    $clickCount.value++
$welcomeMessage.value = `You've clicked ${$clickCount.value} times!`
  };

  // Component imports
  // react component: Counter
  MTMComponents.register('Counter', 'react', (props) => {
    // Component factory for Counter
    return `<div class="react-component">${component.name} Component (react)</div>`;
  });
  // vue component: Button
  MTMComponents.register('Button', 'vue', (props) => {
    // Component factory for Button
    return `<div class="vue-component">${component.name} Component (vue)</div>`;
  });

  // DOM Management
  const container = document.getElementById('app');
  
  const updateAll = () => {
    // Update data-bind elements
    container.querySelectorAll('[data-bind="$welcomeMessage"]').forEach(el => {
      el.textContent = $welcomeMessage.value;
    });
    container.querySelectorAll('[data-bind="$clickCount"]').forEach(el => {
      el.textContent = $clickCount.value;
    });
    
    // Update conditional rendering
    container.querySelectorAll('[data-if]').forEach(el => {
      const condition = el.getAttribute('data-if');
      let shouldShow = false;
      
      try {
        let evalStr = condition;
        evalStr = evalStr.replace(/\$welcomeMessage/g, '$welcomeMessage.value');
        evalStr = evalStr.replace(/\$clickCount/g, '$clickCount.value');
        shouldShow = eval(evalStr);
      } catch (e) {
        console.warn('Condition failed:', condition, e);
      }
      
      el.style.display = shouldShow ? 'block' : 'none';
    });
  };
  
  // Initial setup
  updateAll();
  MTMComponents.mountAll();
  
  // Subscribe to changes
  $welcomeMessage.subscribe(() => updateAll());
  $clickCount.subscribe(() => updateAll());
  
  // Bind events
  container.querySelectorAll('[data-event-click="$handleClick"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      $handleClick();
    });
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  MTMRouter.init();
  IndexmtmPage();
  console.log('🔮 Enhanced MTM Page loaded:', pageMetadata);
});