
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
  "route": "/about",
  "title": "About Us - Enhanced MTM",
  "description": "Learn more about the Enhanced MTM Framework and its capabilities",
  "compileJs": "about.js"
};

// Register route
MTMRouter._routes.set('/about', pageMetadata);

// Page Component
function AboutmtmPage() {
  // Variables
  const $showModal = MTMRouter.create('showModal', false);
  const $pageViews = MTMRouter.create('aboutPageViews', 0);

  // Functions  
  const $openModal = () => {
    $showModal.value = true
  };

  const $closeModal = () => {
    $showModal.value = false
  };

  const $incrementViews = () => {
    $pageViews.value++
  };

  // Component imports
  // svelte component: Card
  MTMComponents.register('Card', 'svelte', (props) => {
    // Component factory for Card
    return `<div class="svelte-component">${component.name} Component (svelte)</div>`;
  });
  // react component: Modal
  MTMComponents.register('Modal', 'react', (props) => {
    // Component factory for Modal
    return `<div class="react-component">${component.name} Component (react)</div>`;
  });

  // DOM Management
  const container = document.getElementById('app');
  
  const updateAll = () => {
    // Update data-bind elements
    container.querySelectorAll('[data-bind="$showModal"]').forEach(el => {
      el.textContent = $showModal.value;
    });
    container.querySelectorAll('[data-bind="$pageViews"]').forEach(el => {
      el.textContent = $pageViews.value;
    });
    
    // Update conditional rendering
    container.querySelectorAll('[data-if]').forEach(el => {
      const condition = el.getAttribute('data-if');
      let shouldShow = false;
      
      try {
        let evalStr = condition;
        evalStr = evalStr.replace(/\$showModal/g, '$showModal.value');
        evalStr = evalStr.replace(/\$pageViews/g, '$pageViews.value');
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
  $showModal.subscribe(() => updateAll());
  $pageViews.subscribe(() => updateAll());
  
  // Bind events
  container.querySelectorAll('[data-event-click="$openModal"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      $openModal();
    });
  });

  container.querySelectorAll('[data-event-click="$closeModal"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      $closeModal();
    });
  });

  container.querySelectorAll('[data-event-click="$incrementViews"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      $incrementViews();
    });
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  MTMRouter.init();
  AboutmtmPage();
  console.log('🔮 Enhanced MTM Page loaded:', pageMetadata);
});