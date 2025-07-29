// Enhanced HTML Generator - Supports component processing and routing
class EnhancedHTMLGenerator {
  constructor() {
    this.componentAdapters = new Map();
    this.registeredComponents = new Map();
  }

  /**
   * Generates enhanced HTML with component and routing support
   * @param {Object} ast - The parsed AST
   * @param {Object} jsResult - The JavaScript generation result
   * @param {Object} options - Generation options
   * @returns {string} The generated HTML
   */
  generateHTML(ast, jsResult, options = {}) {
    const template = this.processTemplate(ast.template?.content || '', ast);
    const title = ast.frontmatter.title || 'MTM App';
    const description = ast.frontmatter.description || 'Enhanced MTM Application';
    const route = ast.frontmatter.route || '/';

    // Generate additional meta tags from frontmatter
    const metaTags = this.generateMetaTags(ast.frontmatter);

    // Generate script tags based on compilation mode
    const scriptTags = this.generateScriptTags(jsResult, options);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${description}">
    <meta name="route" content="${route}">
    ${metaTags}
    <style>${this.getCSS()}</style>
</head>
<body>
    <div id="app">${template}</div>
    ${scriptTags}
</body>
</html>`;
  }

  /**
   * Processes the template content with component and routing support
   * @param {string} template - The template content
   * @param {Object} ast - The parsed AST
   * @returns {string} The processed template
   */
  processTemplate(template, ast) {
    let processed = template;

    // Replace metadata placeholders
    Object.keys(ast.frontmatter).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      processed = processed.replace(regex, ast.frontmatter[key]);
    });

    // Process Link components - convert to anchor tags with data-link
    processed = this.processLinkComponents(processed);

    // Process imported framework components
    processed = this.processFrameworkComponents(processed, ast);

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

  /**
   * Processes Link components and converts them to anchor tags with data-link
   * @param {string} template - The template content
   * @returns {string} The processed template
   */
  processLinkComponents(template) {
    // Handle self-closing Link components: <Link href="/path" />
    let processed = template.replace(
      /<Link\s+href="([^"]+)"([^>]*?)\s*\/>/g,
      (match, href, attrs) => {
        // Extract additional attributes
        const cleanAttrs = attrs.trim();
        return `<a href="${href}" data-link="true"${cleanAttrs ? ' ' + cleanAttrs : ''}></a>`;
      }
    );

    // Handle Link components with content: <Link href="/path">Content</Link>
    processed = processed.replace(
      /<Link\s+href="([^"]+)"([^>]*?)>(.*?)<\/Link>/g,
      (match, href, attrs, content) => {
        // Extract additional attributes
        const cleanAttrs = attrs.trim();
        return `<a href="${href}" data-link="true"${cleanAttrs ? ' ' + cleanAttrs : ''}>${content}</a>`;
      }
    );

    return processed;
  }

  /**
   * Processes imported framework components
   * @param {string} template - The template content
   * @param {Object} ast - The parsed AST
   * @returns {string} The processed template
   */
  processFrameworkComponents(template, ast) {
    let processed = template;

    if (ast.imports && ast.imports.length > 0) {
      ast.imports.forEach(component => {
        // Handle self-closing component tags: <ComponentName prop="value" />
        const selfClosingRegex = new RegExp(
          `<${component.name}([^>]*?)\\s*/>`,
          'g'
        );
        processed = processed.replace(selfClosingRegex, (match, attrs) => {
          const processedAttrs = this.processComponentAttributes(attrs);
          return `<div data-component="${component.name}" data-framework="${component.framework}" data-type="component"${processedAttrs}></div>`;
        });

        // Handle component tags with content: <ComponentName>Content</ComponentName>
        const contentRegex = new RegExp(
          `<${component.name}([^>]*?)>(.*?)<\/${component.name}>`,
          'gs'
        );
        processed = processed.replace(contentRegex, (match, attrs, content) => {
          const processedAttrs = this.processComponentAttributes(attrs);
          return `<div data-component="${component.name}" data-framework="${component.framework}" data-type="component"${processedAttrs} data-content="${this.escapeAttribute(content)}"></div>`;
        });
      });
    }

    return processed;
  }

  /**
   * Processes component attributes and converts them to data attributes
   * @param {string} attrs - The component attributes string
   * @returns {string} The processed attributes
   */
  processComponentAttributes(attrs) {
    if (!attrs || !attrs.trim()) return '';

    const processedAttrs = [];
    const attrString = attrs.trim();

    // Parse attributes using a more robust approach
    const attrRegex = /(\w+)(?:=(?:\{([^}]+)\}|"([^"]*)"|'([^']*)'))?/g;
    let match;

    while ((match = attrRegex.exec(attrString)) !== null) {
      const propName = match[1];
      const bracketValue = match[2]; // {value}
      const doubleQuoteValue = match[3]; // "value"
      const singleQuoteValue = match[4]; // 'value'

      if (bracketValue !== undefined) {
        // Handle {value} syntax
        if (bracketValue.startsWith('$')) {
          processedAttrs.push(`data-prop-${propName}="${bracketValue}"`);
          processedAttrs.push(`data-prop-${propName}-type="variable"`);
        } else {
          processedAttrs.push(`data-prop-${propName}="${bracketValue}"`);
          processedAttrs.push(`data-prop-${propName}-type="literal"`);
        }
      } else if (doubleQuoteValue !== undefined || singleQuoteValue !== undefined) {
        // Handle "value" or 'value' syntax
        const value = doubleQuoteValue !== undefined ? doubleQuoteValue : singleQuoteValue;
        processedAttrs.push(`data-prop-${propName}="${value}"`);
        processedAttrs.push(`data-prop-${propName}-type="string"`);
      } else {
        // Handle boolean attributes (no value)
        processedAttrs.push(`data-prop-${propName}="true"`);
        processedAttrs.push(`data-prop-${propName}-type="boolean"`);
      }
    }

    return processedAttrs.length > 0 ? ' ' + processedAttrs.join(' ') : '';
  }

  /**
   * Escapes attribute values for HTML
   * @param {string} value - The value to escape
   * @returns {string} The escaped value
   */
  escapeAttribute(value) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }

  /**
   * Generates script tags based on compilation mode
   * @param {Object} jsResult - The JavaScript generation result
   * @param {Object} options - Generation options
   * @returns {string} The script tags
   */
  generateScriptTags(jsResult, options = {}) {
    let scriptTags = '';

    // Add router script if routing is enabled
    if (options.enableRouting !== false) {
      scriptTags += this.generateRouterScript();
    }

    // Add component system script if components are present
    if (options.enableComponents !== false) {
      scriptTags += this.generateComponentSystemScript();
    }

    // Add the main application script
    if (jsResult.scriptTag) {
      scriptTags += '\n    ' + jsResult.scriptTag;
    } else if (jsResult.inlineScript) {
      scriptTags += `\n    <script>\n${jsResult.inlineScript}\n    </script>`;
    }

    // Add external script references
    if (jsResult.externalFile) {
      scriptTags += `\n    <script src="${jsResult.externalFile.filename}"></script>`;
    }

    return scriptTags;
  }

  /**
   * Generates the client-side router script
   * @returns {string} The router script tag
   */
  generateRouterScript() {
    return `
    <script>
        // Enhanced MTM Client-Side Router
        class MTMRouter {
            constructor() {
                this.routes = new Map();
                this.currentRoute = null;
                this.init();
            }

            init() {
                // Intercept anchor tag clicks for internal navigation
                document.addEventListener('click', (e) => {
                    const link = e.target.closest('a[data-link="true"]');
                    if (link && link.href) {
                        e.preventDefault();
                        const url = new URL(link.href);
                        this.navigate(url.pathname);
                    }
                });

                // Handle browser back/forward buttons
                window.addEventListener('popstate', (e) => {
                    this.handlePopState(e);
                });

                // Set initial route
                this.currentRoute = window.location.pathname;
            }

            navigate(path) {
                if (path !== this.currentRoute) {
                    this.currentRoute = path;
                    history.pushState({ path }, '', path);
                    this.loadRoute(path);
                }
            }

            back() {
                history.back();
            }

            forward() {
                history.forward();
            }

            replace(path) {
                this.currentRoute = path;
                history.replaceState({ path }, '', path);
                this.loadRoute(path);
            }

            handlePopState(e) {
                const path = e.state?.path || window.location.pathname;
                this.currentRoute = path;
                this.loadRoute(path);
            }

            loadRoute(path) {
                // Emit route change event for components to handle
                const event = new CustomEvent('routechange', {
                    detail: { path, previousPath: this.currentRoute }
                });
                document.dispatchEvent(event);
            }

            getCurrentRoute() {
                return this.currentRoute;
            }
        }

        // Initialize router
        window.mtmRouter = new MTMRouter();
    </script>`;
  }

  /**
   * Generates the component system script
   * @returns {string} The component system script tag
   */
  generateComponentSystemScript() {
    return `
    <script>
        // Enhanced MTM Component System
        class MTMComponentSystem {
            constructor() {
                this.components = new Map();
                this.adapters = new Map();
                this.init();
            }

            init() {
                // Initialize component adapters
                this.initializeAdapters();
                
                // Mount all components on page load
                document.addEventListener('DOMContentLoaded', () => {
                    this.mountAllComponents();
                });

                // Re-mount components on route changes
                document.addEventListener('routechange', () => {
                    this.mountAllComponents();
                });
            }

            initializeAdapters() {
                // React adapter
                this.adapters.set('react', {
                    mount: (element, componentName, props) => {
                        // React mounting logic would go here
                        console.log('Mounting React component:', componentName, props);
                        element.innerHTML = \`<div class="react-component">[React: \${componentName}]</div>\`;
                    }
                });

                // Vue adapter
                this.adapters.set('vue', {
                    mount: (element, componentName, props) => {
                        // Vue mounting logic would go here
                        console.log('Mounting Vue component:', componentName, props);
                        element.innerHTML = \`<div class="vue-component">[Vue: \${componentName}]</div>\`;
                    }
                });

                // Solid adapter
                this.adapters.set('solid', {
                    mount: (element, componentName, props) => {
                        // Solid mounting logic would go here
                        console.log('Mounting Solid component:', componentName, props);
                        element.innerHTML = \`<div class="solid-component">[Solid: \${componentName}]</div>\`;
                    }
                });

                // Svelte adapter
                this.adapters.set('svelte', {
                    mount: (element, componentName, props) => {
                        // Svelte mounting logic would go here
                        console.log('Mounting Svelte component:', componentName, props);
                        element.innerHTML = \`<div class="svelte-component">[Svelte: \${componentName}]</div>\`;
                    }
                });
            }

            mountAllComponents() {
                const componentElements = document.querySelectorAll('[data-component]');
                
                componentElements.forEach(element => {
                    const componentName = element.getAttribute('data-component');
                    const framework = element.getAttribute('data-framework');
                    const props = this.extractProps(element);

                    const adapter = this.adapters.get(framework);
                    if (adapter) {
                        adapter.mount(element, componentName, props);
                    } else {
                        console.warn(\`No adapter found for framework: \${framework}\`);
                        element.innerHTML = \`<div class="unknown-component">[Unknown: \${componentName}]</div>\`;
                    }
                });
            }

            extractProps(element) {
                const props = {};
                const attributes = element.attributes;

                for (let i = 0; i < attributes.length; i++) {
                    const attr = attributes[i];
                    if (attr.name.startsWith('data-prop-') && !attr.name.endsWith('-type')) {
                        const propName = attr.name.replace('data-prop-', '');
                        const propType = element.getAttribute(\`data-prop-\${propName}-type\`);
                        
                        let propValue = attr.value;
                        
                        // Convert based on type
                        switch (propType) {
                            case 'boolean':
                                propValue = propValue === 'true';
                                break;
                            case 'variable':
                                // Handle variable references
                                propValue = this.resolveVariable(propValue);
                                break;
                            case 'literal':
                                // Try to parse as JSON for objects/arrays
                                try {
                                    propValue = JSON.parse(propValue);
                                } catch (e) {
                                    // Keep as string if not valid JSON
                                }
                                break;
                        }
                        
                        props[propName] = propValue;
                    }
                }

                return props;
            }

            resolveVariable(variableName) {
                // This would resolve variables from the MTM context
                // For now, return a placeholder
                return \`[Variable: \${variableName}]\`;
            }

            registerComponent(name, framework, component) {
                this.components.set(name, { framework, component });
            }

            getComponent(name) {
                return this.components.get(name);
            }
        }

        // Initialize component system
        window.mtmComponentSystem = new MTMComponentSystem();
    </script>`;
  }

  /**
   * Generates meta tags from frontmatter
   * @param {Object} frontmatter - The frontmatter object
   * @returns {string} The generated meta tags
   */
  generateMetaTags(frontmatter) {
    const metaTags = [];

    // Add keywords if present
    if (frontmatter.keywords) {
      metaTags.push(`<meta name="keywords" content="${frontmatter.keywords}">`);
    }

    // Add author if present
    if (frontmatter.author) {
      metaTags.push(`<meta name="author" content="${frontmatter.author}">`);
    }

    // Add Open Graph tags if present
    if (frontmatter.ogTitle) {
      metaTags.push(`<meta property="og:title" content="${frontmatter.ogTitle}">`);
    }

    if (frontmatter.ogDescription) {
      metaTags.push(`<meta property="og:description" content="${frontmatter.ogDescription}">`);
    }

    if (frontmatter.ogImage) {
      metaTags.push(`<meta property="og:image" content="${frontmatter.ogImage}">`);
    }

    return metaTags.join('\n    ');
  }

  /**
   * Gets the CSS for the generated HTML
   * @returns {string} The CSS content
   */
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
        
        /* Component styles */
        .react-component, .vue-component, .solid-component, .svelte-component, .unknown-component {
            margin: 1rem 0;
            padding: 1rem;
            border: 1px solid #ddd;
            border-radius: 8px;
            background: #f9f9f9;
            font-family: monospace;
            color: #666;
        }
        
        .react-component {
            border-color: #61dafb;
            background: #f0f8ff;
        }
        
        .vue-component {
            border-color: #4fc08d;
            background: #f0fff4;
        }
        
        .solid-component {
            border-color: #2c4f7c;
            background: #f8f9fa;
        }
        
        .svelte-component {
            border-color: #ff3e00;
            background: #fff5f5;
        }
        
        .unknown-component {
            border-color: #dc3545;
            background: #fff5f5;
            color: #dc3545;
        }
        
        .counter-component, .vue-button {
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

  /**
   * Registers a component adapter for a specific framework
   * @param {string} framework - The framework name
   * @param {Object} adapter - The adapter implementation
   */
  registerComponentAdapter(framework, adapter) {
    this.componentAdapters.set(framework, adapter);
  }

  /**
   * Gets a component adapter for a framework
   * @param {string} framework - The framework name
   * @returns {Object|null} The adapter or null if not found
   */
  getComponentAdapter(framework) {
    return this.componentAdapters.get(framework) || null;
  }

  /**
   * Registers a component
   * @param {string} name - The component name
   * @param {Object} definition - The component definition
   */
  registerComponent(name, definition) {
    this.registeredComponents.set(name, definition);
  }

  /**
   * Gets a registered component
   * @param {string} name - The component name
   * @returns {Object|null} The component definition or null if not found
   */
  getComponent(name) {
    return this.registeredComponents.get(name) || null;
  }
}

module.exports = { EnhancedHTMLGenerator };