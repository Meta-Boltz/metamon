// Enhanced MTM Compiler - Supports link routing, component imports, and external JS
const fs = require('fs');
const path = require('path');

class EnhancedMTMCompiler {
  constructor() {
    this.routes = new Map();
    this.components = new Map();
  }

  compile(inputFile, options = {}) {
    const source = fs.readFileSync(inputFile, 'utf8');
    const filename = path.basename(inputFile);

    const parsed = this.parseSource(source, filename);
    const html = this.generateHTML(parsed, options);
    const js = this.generateJavaScript(parsed, options);

    return {
      html,
      js: parsed.metadata.compileJs !== 'inline' ? js : null,
      route: parsed.metadata.route,
      metadata: parsed.metadata
    };
  }

  parseSource(source, filename) {
    const lines = source.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('//'));

    const result = {
      filename,
      metadata: {},
      imports: [],
      variables: [],
      functions: [],
      template: ''
    };

    let inTemplate = false;
    let templateContent = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Parse metadata
      const metadataMatch = line.match(/^(\w+):\s*"([^"]+)"$/);
      if (metadataMatch) {
        result.metadata[metadataMatch[1]] = metadataMatch[2];
        continue;
      }

      // Parse imports
      const importMatch = line.match(/^import\s+(\w+)\s+from\s+"([^"]+)"$/);
      if (importMatch) {
        const componentName = importMatch[1];
        const componentPath = importMatch[2];
        const componentType = this.detectComponentType(componentPath);

        result.imports.push({
          name: componentName,
          path: componentPath,
          type: componentType
        });
        continue;
      }

      // Template parsing
      if (line === '<template>') {
        inTemplate = true;
        continue;
      }
      if (line === '</template>') {
        inTemplate = false;
        result.template = templateContent.trim();
        continue;
      }
      if (inTemplate) {
        templateContent += line + '\n';
        continue;
      }

      // Parse reactive variables
      const reactiveMatch = line.match(/^\$(\w+)!\s*=\s*(.+)$/);
      if (reactiveMatch) {
        result.variables.push({
          name: reactiveMatch[1],
          value: reactiveMatch[2],
          type: 'reactive'
        });
        continue;
      }

      // Parse functions
      const functionMatch = line.match(/^\$(\w+)\s*=\s*\(([^)]*)\)\s*=>\s*\{$/);
      if (functionMatch) {
        const functionName = functionMatch[1];
        const functionParams = functionMatch[2].trim();
        let functionBody = '';

        i++;
        while (i < lines.length && lines[i] !== '}') {
          functionBody += lines[i] + '\n';
          i++;
        }

        result.functions.push({
          name: functionName,
          params: functionParams,
          body: functionBody.trim()
        });
        continue;
      }
    }

    // Register route
    if (result.metadata.route) {
      this.routes.set(result.metadata.route, {
        file: filename,
        metadata: result.metadata
      });
    }

    return result;
  }

  detectComponentType(componentPath) {
    if (componentPath.endsWith('.tsx') || componentPath.endsWith('.jsx')) return 'react';
    if (componentPath.endsWith('.vue')) return 'vue';
    if (componentPath.endsWith('.svelte')) return 'svelte';
    return 'unknown';
  }

  generateHTML(parsed, options) {
    const template = this.processTemplate(parsed.template, parsed);
    const title = parsed.metadata.title || 'MTM App';
    const description = parsed.metadata.description || 'Enhanced MTM Application';
    const route = parsed.metadata.route || '/';

    const scriptTags = this.generateScriptTags(parsed);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${description}">
    <meta name="route" content="${route}">
    <style>${this.getCSS()}</style>
</head>
<body>
    <div id="app">${template}</div>
    ${scriptTags}
</body>
</html>`;
  }

  processTemplate(template, parsed) {
    let processed = template;

    // Replace metadata placeholders
    Object.keys(parsed.metadata).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      processed = processed.replace(regex, parsed.metadata[key]);
    });

    // Process Link components
    processed = processed.replace(/<Link\s+href="([^"]+)"([^>]*)>(.*?)<\/Link>/g,
      (match, href, attrs, content) => {
        return `<a href="${href}" data-link="true"${attrs}>${content}</a>`;
      }
    );

    // Process imported components
    parsed.imports.forEach(component => {
      const componentRegex = new RegExp(`<${component.name}([^>]*?)\\s*/>`, 'g');
      processed = processed.replace(componentRegex, (match, attrs) => {
        return `<div data-component="${component.name}" data-type="${component.type}"${attrs}></div>`;
      });
    });

    // Handle event handlers
    processed = processed.replace(/(\w+)=\{(\$\w+)\}/g, 'data-event-$1="$2"');

    // Handle conditional rendering
    processed = processed.replace(/\{#if\s+([^}]+)\}([\s\S]*?)\{\/if\}/g, (match, condition, content) => {
      return `<div data-if="${condition}" style="display: none;">${content}</div>`;
    });

    // Handle variable interpolation
    processed = processed.replace(/\{(\$\w+)\}/g, '<span data-bind="$1">Loading...</span>');

    return processed;
  }

  generateScriptTags(parsed) {
    const compileJs = parsed.metadata.compileJs;

    if (compileJs === 'inline') {
      return `<script>${this.generateJavaScript(parsed)}</script>`;
    } else if (compileJs && compileJs !== 'inline') {
      return `
        <script src="./js/mtm-router.js"></script>
        <script src="./js/components.js"></script>
        <script src="./js/${compileJs}"></script>
      `;
    } else {
      // Default inline
      return `<script>${this.generateJavaScript(parsed)}</script>`;
    }
  }

  generateJavaScript(parsed, options = {}) {
    return `
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
const pageMetadata = ${JSON.stringify(parsed.metadata, null, 2)};

// Register route
MTMRouter._routes.set('${parsed.metadata.route || '/'}', pageMetadata);

// Page Component
function ${this.generateComponentName(parsed.filename)}() {
  // Variables
${parsed.variables.map(v => this.generateVariable(v)).join('\n')}

  // Functions  
${parsed.functions.map(f => this.generateFunction(f, parsed.variables)).join('\n\n')}

  // Component imports
${parsed.imports.map(imp => this.generateComponentImport(imp)).join('\n')}

  // DOM Management
  const container = document.getElementById('app');
  
  const updateAll = () => {
    // Update data-bind elements
${parsed.variables.map(v => this.generateBindingUpdate(v)).join('\n')}
    
    // Update conditional rendering
    container.querySelectorAll('[data-if]').forEach(el => {
      const condition = el.getAttribute('data-if');
      let shouldShow = false;
      
      try {
        let evalStr = condition;
${parsed.variables.map(v => `        evalStr = evalStr.replace(/\\$${v.name}/g, '$${v.name}.value');`).join('\n')}
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
${parsed.variables.map(v => `  $${v.name}.subscribe(() => updateAll());`).join('\n')}
  
  // Bind events
${parsed.functions.map(f => this.generateEventBinding(f)).join('\n\n')}
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  MTMRouter.init();
  ${this.generateComponentName(parsed.filename)}();
  console.log('🔮 Enhanced MTM Page loaded:', pageMetadata);
});`;
  }

  generateComponentName(filename) {
    return filename.replace(/[^a-zA-Z0-9]/g, '').replace(/^\w/, c => c.toUpperCase()) + 'Page';
  }

  generateVariable(variable) {
    if (variable.value.includes('signal(')) {
      const signalMatch = variable.value.match(/signal\s*\(\s*['"]([^'"]+)['"]\s*,\s*(.+)\s*\)/);
      if (signalMatch) {
        const key = signalMatch[1];
        const initialValue = signalMatch[2];
        return `  const $${variable.name} = MTMRouter.create('${key}', ${initialValue});`;
      }
    }
    return `  const $${variable.name} = MTMRouter.create('${variable.name}', ${variable.value});`;
  }

  generateFunction(func, variables) {
    let body = func.body;
    // Replace $variable with $variable.value
    variables.forEach(variable => {
      const regex = new RegExp(`\\$${variable.name}(?!\\.)\\b`, 'g');
      body = body.replace(regex, `$${variable.name}.value`);
    });

    const params = func.params || '';

    return `  const $${func.name} = (${params}) => {
    ${body}
  };`;
  }

  generateComponentImport(component) {
    return `  // ${component.type} component: ${component.name}
  MTMComponents.register('${component.name}', '${component.type}', (props) => {
    // Component factory for ${component.name}
    return \`<div class="${component.type}-component">\${component.name} Component (${component.type})</div>\`;
  });`;
  }

  generateBindingUpdate(variable) {
    return `    container.querySelectorAll('[data-bind="$${variable.name}"]').forEach(el => {
      el.textContent = $${variable.name}.value;
    });`;
  }

  generateEventBinding(func) {
    return `  container.querySelectorAll('[data-event-click="$${func.name}"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      $${func.name}();
    });
  });`;
  }

  getCSS() {
    return `
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        #app {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        
        .navigation {
            display: flex;
            gap: 1rem;
            margin: 1rem 0;
            padding: 1rem;
            background: #f8f9ff;
            border-radius: 8px;
            border: 1px solid #667eea;
        }
        
        .navigation a {
            color: #667eea;
            text-decoration: none;
            font-weight: 600;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            transition: background 0.2s;
        }
        
        .navigation a:hover {
            background: #667eea;
            color: white;
        }
        
        .link-examples {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            margin: 1rem 0;
        }
        
        .link-examples a {
            color: #667eea;
            text-decoration: none;
            padding: 0.5rem;
            border: 1px solid #667eea;
            border-radius: 4px;
            transition: all 0.2s;
        }
        
        .link-examples a:hover {
            background: #667eea;
            color: white;
        }
        
        .counter-component, .vue-button, .react-component {
            margin: 1rem 0;
            padding: 1rem;
            border: 1px solid #ddd;
            border-radius: 8px;
            background: #f9f9f9;
        }
        
        .counter-display {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin: 1rem 0;
        }
        
        .counter-btn {
            background: #667eea;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 0.5rem 1rem;
            cursor: pointer;
            font-weight: 600;
        }
        
        .counter-value {
            font-size: 1.5rem;
            font-weight: bold;
            min-width: 3rem;
            text-align: center;
        }
        
        .features ul {
            list-style: none;
            padding: 0;
        }
        
        .features li {
            padding: 0.5rem 0;
            border-bottom: 1px solid #eee;
        }
    `;
  }
}

module.exports = { EnhancedMTMCompiler };