// Compilation Mode Handler - Manages different JavaScript compilation modes
const fs = require('fs');
const path = require('path');

class CompilationModeHandler {
  constructor() {
    this.supportedModes = ['inline', 'external.js'];
  }

  /**
   * Determines the compilation mode from frontmatter configuration
   * @param {Object} frontmatter - The frontmatter configuration
   * @param {Object} options - Additional options
   * @returns {string} The resolved compilation mode
   */
  resolveCompilationMode(frontmatter, options = {}) {
    const compileJsMode = frontmatter.compileJsMode;

    // If explicitly set, validate and return
    if (compileJsMode) {
      if (this.isValidMode(compileJsMode)) {
        return compileJsMode;
      } else {
        throw new Error(`Invalid compileJsMode: "${compileJsMode}". Must be "inline", "external.js", or end with ".js"`);
      }
    }

    // Default behavior based on content size or options
    return this.getDefaultMode(options);
  }

  /**
   * Validates if a compilation mode is supported
   * @param {string} mode - The compilation mode to validate
   * @returns {boolean} True if valid
   */
  isValidMode(mode) {
    return this.supportedModes.includes(mode) || mode.endsWith('.js');
  }

  /**
   * Gets the default compilation mode based on options
   * @param {Object} options - Options to determine default mode
   * @returns {string} The default compilation mode
   */
  getDefaultMode(options = {}) {
    // For development, prefer inline for faster builds
    if (options.development) {
      return 'inline';
    }

    // For production, prefer external for better caching
    if (options.production) {
      return 'external.js';
    }

    // Default to inline for simplicity
    return 'inline';
  }

  /**
   * Generates JavaScript content based on compilation mode
   * @param {Object} ast - The parsed AST
   * @param {string} mode - The compilation mode
   * @param {Object} options - Additional options
   * @returns {Object} Generated JavaScript content and metadata
   */
  generateJavaScript(ast, mode, options = {}) {
    const jsContent = this.buildJavaScriptContent(ast, options);

    if (mode === 'inline') {
      return {
        mode: 'inline',
        content: jsContent,
        scriptTag: `<script>${jsContent}</script>`,
        externalFile: null
      };
    } else if (mode === 'external.js' || mode.endsWith('.js')) {
      const filename = mode === 'external.js' ? this.generateExternalFilename(ast) : mode;

      return {
        mode: 'external',
        content: jsContent,
        scriptTag: `<script src="${filename}"></script>`,
        externalFile: {
          filename,
          content: jsContent
        }
      };
    }

    throw new Error(`Unsupported compilation mode: ${mode}`);
  }

  /**
   * Builds the JavaScript content from AST
   * @param {Object} ast - The parsed AST
   * @param {Object} options - Build options
   * @returns {string} The generated JavaScript content
   */
  buildJavaScriptContent(ast, options = {}) {
    const componentName = this.generateComponentName(ast.name || 'Component');
    const routePath = ast.frontmatter?.route || '/';

    let js = '';

    // Add MTM runtime if not already included
    if (!options.skipRuntime) {
      js += this.getMTMRuntime();
      js += '\n\n';
    }

    // Add page metadata
    js += `// Page metadata\n`;
    js += `const pageMetadata = ${JSON.stringify(ast.frontmatter || {}, null, 2)};\n\n`;

    // Register route
    js += `// Register route\n`;
    js += `MTMRouter._routes.set('${routePath}', pageMetadata);\n\n`;

    // Component function
    js += `// Page Component: ${componentName}\n`;
    js += `function ${componentName}() {\n`;

    // Generate variables
    if (ast.variables && ast.variables.length > 0) {
      js += `  // Variables\n`;
      for (const variable of ast.variables) {
        js += `  ${this.generateVariable(variable)}\n`;
      }
      js += '\n';
    }

    // Generate functions
    if (ast.functions && ast.functions.length > 0) {
      js += `  // Functions\n`;
      for (const func of ast.functions) {
        js += `  ${this.generateFunction(func, ast.variables || [])}\n\n`;
      }
    }

    // Generate component imports
    if (ast.imports && ast.imports.length > 0) {
      js += `  // Component imports\n`;
      for (const imp of ast.imports) {
        js += `  ${this.generateComponentImport(imp)}\n`;
      }
      js += '\n';
    }

    // DOM management
    js += `  // DOM Management\n`;
    js += `  const container = document.getElementById('app');\n\n`;

    // Update function
    js += `  const updateAll = () => {\n`;

    // Variable bindings
    if (ast.variables && ast.variables.length > 0) {
      js += `    // Update data-bind elements\n`;
      for (const variable of ast.variables) {
        js += `    ${this.generateBindingUpdate(variable)}\n`;
      }
    }

    // Conditional rendering
    js += `    \n    // Update conditional rendering\n`;
    js += `    container.querySelectorAll('[data-if]').forEach(el => {\n`;
    js += `      const condition = el.getAttribute('data-if');\n`;
    js += `      let shouldShow = false;\n`;
    js += `      \n`;
    js += `      try {\n`;
    js += `        let evalStr = condition;\n`;

    if (ast.variables && ast.variables.length > 0) {
      for (const variable of ast.variables) {
        js += `        evalStr = evalStr.replace(/\\${variable.name}/g, '${variable.name}.value');\n`;
      }
    }

    js += `        shouldShow = eval(evalStr);\n`;
    js += `      } catch (e) {\n`;
    js += `        console.warn('Condition failed:', condition, e);\n`;
    js += `      }\n`;
    js += `      \n`;
    js += `      el.style.display = shouldShow ? 'block' : 'none';\n`;
    js += `    });\n`;
    js += `  };\n\n`;

    // Initial setup
    js += `  // Initial setup\n`;
    js += `  updateAll();\n`;
    js += `  MTMComponents.mountAll();\n\n`;

    // Subscribe to changes
    if (ast.variables && ast.variables.length > 0) {
      js += `  // Subscribe to changes\n`;
      for (const variable of ast.variables) {
        if (variable.type === 'reactive') {
          js += `  ${variable.name}.subscribe(() => updateAll());\n`;
        }
      }
      js += '\n';
    }

    // Bind events
    if (ast.functions && ast.functions.length > 0) {
      js += `  // Bind events\n`;
      for (const func of ast.functions) {
        js += `  ${this.generateEventBinding(func)}\n\n`;
      }
    }

    js += `}\n\n`;

    // Initialize
    js += `// Initialize\n`;
    js += `document.addEventListener('DOMContentLoaded', () => {\n`;
    js += `  MTMRouter.init();\n`;
    js += `  ${componentName}();\n`;
    js += `  console.log('🔮 Enhanced MTM Page loaded:', pageMetadata);\n`;
    js += `});`;

    return js;
  }

  /**
   * Gets the MTM runtime JavaScript
   * @returns {string} The MTM runtime code
   */
  getMTMRuntime() {
    return `// Enhanced MTM Router System
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
window.signal = MTMRouter;`;
  }

  /**
   * Generates a component name from filename
   * @param {string} name - The component name
   * @returns {string} The generated component name
   */
  generateComponentName(name) {
    return name.replace(/[^a-zA-Z0-9]/g, '').replace(/^\w/, c => c.toUpperCase()) + 'Page';
  }

  /**
   * Generates an external filename for the JavaScript
   * @param {Object} ast - The parsed AST
   * @returns {string} The generated filename
   */
  generateExternalFilename(ast) {
    const baseName = ast.name || 'component';
    const safeName = baseName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `js/${safeName}.js`;
  }

  /**
   * Generates JavaScript for a variable
   * @param {Object} variable - The variable definition
   * @returns {string} The generated JavaScript
   */
  generateVariable(variable) {
    if (variable.type === 'reactive') {
      if (variable.value.includes('signal(')) {
        const signalMatch = variable.value.match(/signal\s*\(\s*['"]([^'"]+)['"]\s*,\s*(.+)\s*\)/);
        if (signalMatch) {
          const key = signalMatch[1];
          const initialValue = signalMatch[2];
          return `const ${variable.name} = MTMRouter.create('${key}', ${initialValue});`;
        }
      }
      return `const ${variable.name} = MTMRouter.create('${variable.name}', ${variable.value});`;
    } else {
      return `const ${variable.name} = MTMRouter.create('${variable.name}', ${variable.value});`;
    }
  }

  /**
   * Generates JavaScript for a function
   * @param {Object} func - The function definition
   * @param {Array} variables - The variables in scope
   * @returns {string} The generated JavaScript
   */
  generateFunction(func, variables) {
    let body = func.body;

    // Replace $variable with $variable.value
    variables.forEach(variable => {
      const regex = new RegExp(`\\$${variable.name}(?!\\.)\\b`, 'g');
      body = body.replace(regex, `${variable.name}.value`);
    });

    const params = func.params || '';

    return `const ${func.name} = (${params}) => {
    ${body}
  };`;
  }

  /**
   * Generates JavaScript for component import
   * @param {Object} component - The component import
   * @returns {string} The generated JavaScript
   */
  generateComponentImport(component) {
    return `// ${component.framework} component: ${component.name}
  MTMComponents.register('${component.name}', '${component.framework}', (props) => {
    // Component factory for ${component.name}
    return \`<div class="${component.framework}-component">\${component.name} Component (${component.framework})</div>\`;
  });`;
  }

  /**
   * Generates binding update JavaScript
   * @param {Object} variable - The variable definition
   * @returns {string} The generated JavaScript
   */
  generateBindingUpdate(variable) {
    return `container.querySelectorAll('[data-bind="${variable.name}"]').forEach(el => {
      el.textContent = ${variable.name}.value;
    });`;
  }

  /**
   * Generates event binding JavaScript
   * @param {Object} func - The function definition
   * @returns {string} The generated JavaScript
   */
  generateEventBinding(func) {
    return `container.querySelectorAll('[data-event-click="${func.name}"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      ${func.name}();
    });
  });`;
  }

  /**
   * Writes external JavaScript file to disk
   * @param {string} filename - The filename to write to
   * @param {string} content - The JavaScript content
   * @param {string} outputDir - The output directory
   */
  writeExternalFile(filename, content, outputDir = '.') {
    const fullPath = path.join(outputDir, filename);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write the file
    fs.writeFileSync(fullPath, content, 'utf8');
  }

  /**
   * Optimizes JavaScript content for production
   * @param {string} content - The JavaScript content
   * @param {Object} options - Optimization options
   * @returns {string} The optimized JavaScript
   */
  optimizeJavaScript(content, options = {}) {
    if (!options.minify) {
      return content;
    }

    // Basic minification - remove comments and extra whitespace
    let optimized = content
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, '') // Remove line comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/;\s*}/g, '}') // Remove semicolons before closing braces
      .trim();

    return optimized;
  }
}

module.exports = { CompilationModeHandler };