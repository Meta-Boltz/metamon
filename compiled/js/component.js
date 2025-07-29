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
  "route": "/compilation-modes-demo",
  "title": "Compilation Modes Demo",
  "description": "Demonstrating different JavaScript compilation modes",
  "compileJsMode": "external.js",
  "keywords": "mtm, compilation, javascript, modes",
  "author": "MTM Framework"
};

// Register route
MTMRouter._routes.set('/compilation-modes-demo', pageMetadata);

// Page Component: ComponentPage
function ComponentPage() {
  // Variables
  const mode = MTMRouter.create('mode', "external.js");
  const count = MTMRouter.create('count', 0);
  const message = MTMRouter.create('message', "This page uses " + $mode + " compilation mode");

  // Functions
  const increment = (()) => {
    $increment = () => {
  count.value = count.value + 1
  console.log('Count incremented to:', count.value)
}
  };

  const decrement = (()) => {
    $decrement = () => {
  count.value = Math.max(0, count.value - 1)
  console.log('Count decremented to:', count.value)
}
  };

  const reset = (()) => {
    $reset = () => {
  count.value = 0
  console.log('Count reset')
}
  };

  // Component imports
  // react component: Counter
  MTMComponents.register('Counter', 'react', (props) => {
    // Component factory for Counter
    return `<div class="react-component">${component.name} Component (react)</div>`;
  });
  // vue component: VueButton
  MTMComponents.register('VueButton', 'vue', (props) => {
    // Component factory for VueButton
    return `<div class="vue-component">${component.name} Component (vue)</div>`;
  });

  // DOM Management
  const container = document.getElementById('app');

  const updateAll = () => {
    // Update data-bind elements
    container.querySelectorAll('[data-bind="mode"]').forEach(el => {
      el.textContent = mode.value;
    });
    container.querySelectorAll('[data-bind="count"]').forEach(el => {
      el.textContent = count.value;
    });
    container.querySelectorAll('[data-bind="message"]').forEach(el => {
      el.textContent = message.value;
    });
    
    // Update conditional rendering
    container.querySelectorAll('[data-if]').forEach(el => {
      const condition = el.getAttribute('data-if');
      let shouldShow = false;
      
      try {
        let evalStr = condition;
        evalStr = evalStr.replace(/\mode/g, 'mode.value');
        evalStr = evalStr.replace(/\count/g, 'count.value');
        evalStr = evalStr.replace(/\message/g, 'message.value');
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
  count.subscribe(() => updateAll());

  // Bind events
  container.querySelectorAll('[data-event-click="increment"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      increment();
    });
  });

  container.querySelectorAll('[data-event-click="decrement"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      decrement();
    });
  });

  container.querySelectorAll('[data-event-click="reset"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      reset();
    });
  });

}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  MTMRouter.init();
  ComponentPage();
  console.log('🔮 Enhanced MTM Page loaded:', pageMetadata);
});