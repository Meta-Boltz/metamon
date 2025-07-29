// Component Adapter System - Framework-agnostic component handling
const path = require('path');
const fs = require('fs');
const { CompilationError, RuntimeError, ComponentErrorBoundary } = require('./error-handling.js');

/**
 * Base ComponentAdapter interface for framework-agnostic component handling
 */
class ComponentAdapter {
  constructor(framework) {
    this.framework = framework;
  }

  /**
   * Check if this adapter can handle the given import path
   * @param {string} importPath - The import path to check
   * @returns {boolean} - True if this adapter can handle the path
   */
  canHandle(importPath) {
    throw new Error('canHandle method must be implemented by subclasses');
  }

  /**
   * Transform a component import into a component definition
   * @param {Object} componentImport - The component import object
   * @returns {Object} - The component definition
   */
  transform(componentImport) {
    throw new Error('transform method must be implemented by subclasses');
  }

  /**
   * Generate wrapper code for the component
   * @param {Object} componentDefinition - The component definition
   * @returns {string} - The wrapper code
   */
  generateWrapper(componentDefinition) {
    throw new Error('generateWrapper method must be implemented by subclasses');
  }

  /**
   * Extract props from component source (common functionality)
   * @param {string} source - The component source code
   * @returns {Array} - Array of prop definitions
   */
  extractProps(source) {
    const props = [];

    // Basic prop extraction patterns (can be overridden by specific adapters)
    const propPatterns = [
      /props:\s*\{([^}]+)\}/g,  // Vue-style props
      /interface\s+\w*Props\s*\{([^}]+)\}/g,  // TypeScript interface props
      /type\s+\w*Props\s*=\s*\{([^}]+)\}/g,   // TypeScript type props
    ];

    for (const pattern of propPatterns) {
      let match;
      while ((match = pattern.exec(source)) !== null) {
        const propsContent = match[1];
        // Split by semicolon or newline, then filter out empty lines
        const propLines = propsContent.split(/[;\n]/).filter(line => line.trim());

        for (const line of propLines) {
          const trimmed = line.trim();
          if (trimmed) {
            const propMatch = trimmed.match(/(\w+)(\?)?:\s*(\w+)/);
            if (propMatch) {
              props.push({
                name: propMatch[1],
                type: propMatch[3],
                required: !propMatch[2], // No ? means required
                default: null
              });
            }
          }
        }
      }
    }

    return props;
  }

  /**
   * Extract dependencies from component source (common functionality)
   * @param {string} source - The component source code
   * @returns {Array} - Array of dependency paths
   */
  extractDependencies(source) {
    const dependencies = [];
    const importPattern = /import\s+(?:\{[^}]+\}|\w+)\s+from\s+['"]([^'"]+)['"]/g;

    let match;
    while ((match = importPattern.exec(source)) !== null) {
      dependencies.push(match[1]);
    }

    return dependencies;
  }
}

/**
 * Base adapter with common functionality for all frameworks
 */
class BaseComponentAdapter extends ComponentAdapter {
  constructor(framework) {
    super(framework);
  }

  /**
   * Common transform logic that can be extended by specific adapters
   * @param {Object} componentImport - The component import object
   * @returns {Object} - The component definition
   * @throws {CompilationError} If component cannot be processed
   */
  transform(componentImport) {
    const resolvedPath = this.resolvePath(componentImport.path);
    let source = '';

    try {
      if (fs.existsSync(resolvedPath)) {
        source = fs.readFileSync(resolvedPath, 'utf8');
      } else {
        throw CompilationError.importResolution(
          componentImport.path,
          componentImport.file || 'unknown.mtm',
          componentImport.line || 0,
          [resolvedPath]
        );
      }
    } catch (error) {
      if (error instanceof CompilationError) {
        throw error;
      }
      throw CompilationError.importResolution(
        componentImport.path,
        componentImport.file || 'unknown.mtm',
        componentImport.line || 0,
        [resolvedPath]
      );
    }

    // Validate framework compatibility
    const detectedFramework = this.detectFrameworkFromSource(source);
    if (detectedFramework && detectedFramework !== this.framework) {
      throw CompilationError.frameworkMismatch(
        componentImport.name,
        this.framework,
        detectedFramework,
        componentImport.file || 'unknown.mtm'
      );
    }

    return {
      name: componentImport.name,
      framework: this.framework,
      source: source,
      path: resolvedPath,
      originalPath: componentImport.path,
      props: this.extractProps(source),
      dependencies: this.extractDependencies(source),
      errorBoundary: new ComponentErrorBoundary(componentImport.name)
    };
  }

  /**
   * Detect framework from component source code
   * @param {string} source - Component source code
   * @returns {string|null} Detected framework or null
   */
  detectFrameworkFromSource(source) {
    // React indicators
    if (source.includes('React.') || source.includes('useState') || source.includes('useEffect') ||
      source.includes('jsx') || source.includes('tsx')) {
      return 'react';
    }

    // Vue indicators
    if (source.includes('<template>') || source.includes('defineComponent') ||
      source.includes('setup()') || source.includes('.vue')) {
      return 'vue';
    }

    // Svelte indicators
    if (source.includes('<script>') && source.includes('<style>') &&
      (source.includes('export let') || source.includes('$:'))) {
      return 'svelte';
    }

    // Solid indicators
    if (source.includes('createSignal') || source.includes('createEffect') ||
      source.includes('solid-js')) {
      return 'solid';
    }

    return null;
  }

  /**
   * Resolve component path with @components/ prefix support
   * @param {string} importPath - The import path to resolve
   * @param {string} basePath - The base path for resolution
   * @returns {string} - The resolved path
   */
  resolvePath(importPath, basePath = process.cwd()) {
    if (importPath.startsWith('@components/')) {
      // Replace @components/ with actual components directory
      const componentsPath = path.join(basePath, 'src', 'components');
      return path.resolve(componentsPath, importPath.replace('@components/', ''));
    }

    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      // Handle relative imports
      return path.resolve(basePath, importPath);
    }

    // Handle absolute imports from project root
    return path.resolve(basePath, importPath);
  }

  /**
   * Generate basic wrapper code (can be overridden by specific adapters)
   * @param {Object} componentDefinition - The component definition
   * @returns {string} - The wrapper code
   */
  generateWrapper(componentDefinition) {
    return `
// Wrapper for ${componentDefinition.name} (${componentDefinition.framework})
function ${componentDefinition.name}Wrapper(props) {
  // Basic wrapper implementation
  return ${componentDefinition.name}(props);
}
`;
  }
}

/**
 * React Component Adapter - Enhanced for full React integration
 */
class ReactComponentAdapter extends BaseComponentAdapter {
  constructor() {
    super('react');
  }

  canHandle(importPath) {
    return importPath.endsWith('.tsx') ||
      importPath.endsWith('.jsx') ||
      importPath.includes('react') ||
      (!importPath.includes('vue') && !importPath.includes('svelte') && !importPath.includes('solid'));
  }

  /**
   * Enhanced prop extraction for React components
   * @param {string} source - The component source code
   * @returns {Array} - Array of prop definitions
   */
  extractProps(source) {
    const props = [];

    // React-specific prop patterns
    const patterns = [
      // TypeScript interface props: interface Props { name: string; }
      /interface\s+(\w*Props?)\s*\{([^}]+)\}/g,
      // TypeScript type props: type Props = { name: string; }
      /type\s+(\w*Props?)\s*=\s*\{([^}]+)\}/g,
      // Function component props: function Component({ name, age }: Props)
      /function\s+\w+\s*\(\s*\{\s*([^}]+)\s*\}\s*:\s*\w*Props?\s*\)/g,
      // Arrow function props: const Component = ({ name, age }: Props) =>
      /const\s+\w+\s*=\s*\(\s*\{\s*([^}]+)\s*\}\s*:\s*\w*Props?\s*\)\s*=>/g,
      // PropTypes: Component.propTypes = { name: PropTypes.string }
      /\.propTypes\s*=\s*\{([^}]+)\}/g
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(source)) !== null) {
        let propsContent = match[2] || match[1]; // Different capture groups for different patterns

        if (pattern.source.includes('propTypes')) {
          // Handle PropTypes format
          this.parsePropTypes(propsContent, props);
        } else {
          // Handle TypeScript interface/type format
          this.parseTypeScriptProps(propsContent, props);
        }
      }
    }

    return props;
  }

  /**
   * Parse TypeScript prop definitions
   * @param {string} propsContent - The props content to parse
   * @param {Array} props - The props array to populate
   */
  parseTypeScriptProps(propsContent, props) {
    const propLines = propsContent.split(/[;\n]/).filter(line => line.trim());

    for (const line of propLines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//')) {
        // Match: name?: (param: type) => returnType = defaultValue
        // or: name?: string | number = defaultValue
        const propMatch = trimmed.match(/(\w+)(\?)?:\s*(.+?)(?:\s*=\s*(.+))?$/);
        if (propMatch) {
          const [, name, optional, type, defaultValue] = propMatch;
          props.push({
            name: name,
            type: type.trim(),
            required: !optional,
            default: defaultValue ? defaultValue.trim() : null
          });
        }
      }
    }
  }

  /**
   * Parse PropTypes definitions
   * @param {string} propsContent - The PropTypes content to parse
   * @param {Array} props - The props array to populate
   */
  parsePropTypes(propsContent, props) {
    const propLines = propsContent.split(/[,\n]/).filter(line => line.trim());

    for (const line of propLines) {
      const trimmed = line.trim();
      if (trimmed) {
        // Match: name: PropTypes.string.isRequired
        const propMatch = trimmed.match(/(\w+):\s*PropTypes\.(\w+)(\.isRequired)?/);
        if (propMatch) {
          const [, name, type, required] = propMatch;
          props.push({
            name: name,
            type: this.mapPropTypeToTypeScript(type),
            required: !!required,
            default: null
          });
        }
      }
    }
  }

  /**
   * Map PropTypes to TypeScript types
   * @param {string} propType - The PropTypes type
   * @returns {string} - The TypeScript type
   */
  mapPropTypeToTypeScript(propType) {
    const typeMap = {
      'string': 'string',
      'number': 'number',
      'bool': 'boolean',
      'boolean': 'boolean',
      'array': 'any[]',
      'object': 'object',
      'func': 'Function',
      'function': 'Function',
      'node': 'React.ReactNode',
      'element': 'React.ReactElement',
      'any': 'any'
    };

    return typeMap[propType.toLowerCase()] || 'any';
  }

  /**
   * Transform React component import with enhanced processing
   * @param {Object} componentImport - The component import object
   * @returns {Object} - The enhanced component definition
   */
  transform(componentImport) {
    const baseDefinition = super.transform(componentImport);

    // Add React-specific metadata
    return {
      ...baseDefinition,
      framework: 'react',
      isReactComponent: true,
      hasHooks: this.detectHooks(baseDefinition.source),
      hasContext: this.detectContext(baseDefinition.source),
      exportType: this.detectExportType(baseDefinition.source)
    };
  }

  /**
   * Detect if component uses React hooks
   * @param {string} source - The component source code
   * @returns {boolean} - True if hooks are detected
   */
  detectHooks(source) {
    const hookPatterns = [
      /use[A-Z]\w*/g, // useState, useEffect, etc.
      /React\.use[A-Z]\w*/g // React.useState, React.useEffect, etc.
    ];

    return hookPatterns.some(pattern => pattern.test(source));
  }

  /**
   * Detect if component uses React context
   * @param {string} source - The component source code
   * @returns {boolean} - True if context is detected
   */
  detectContext(source) {
    const contextPatterns = [
      /useContext/g,
      /React\.useContext/g,
      /createContext/g,
      /React\.createContext/g,
      /\.Provider/g,
      /\.Consumer/g
    ];

    return contextPatterns.some(pattern => pattern.test(source));
  }

  /**
   * Detect component export type
   * @param {string} source - The component source code
   * @returns {string} - The export type ('default', 'named', 'both')
   */
  detectExportType(source) {
    const hasDefault = /export\s+default/g.test(source);
    const hasNamed = /export\s+(?:const|function|class)/g.test(source);

    if (hasDefault && hasNamed) return 'both';
    if (hasDefault) return 'default';
    if (hasNamed) return 'named';
    return 'default'; // assume default if unclear
  }

  /**
   * Generate enhanced React wrapper with lifecycle management
   * @param {Object} componentDefinition - The component definition
   * @returns {string} - The enhanced wrapper code
   */
  generateWrapper(componentDefinition) {
    const props = componentDefinition.props || [];
    const componentName = componentDefinition.name;

    // Generate TypeScript interface for props
    const propsInterface = this.generatePropsInterface(componentName, props);

    // Generate the wrapper component
    const wrapperComponent = this.generateWrapperComponent(componentDefinition);

    // Generate mounting utilities
    const mountingUtils = this.generateMountingUtils(componentName);

    return `
${propsInterface}

${wrapperComponent}

${mountingUtils}
`;
  }

  /**
   * Generate TypeScript props interface
   * @param {string} componentName - The component name
   * @param {Array} props - The props array
   * @returns {string} - The props interface
   */
  generatePropsInterface(componentName, props) {
    if (props.length === 0) {
      return `interface ${componentName}Props {}`;
    }

    const propLines = props.map(prop => {
      const optional = prop.required ? '' : '?';
      const defaultComment = prop.default ? ` // default: ${prop.default}` : '';
      return `  ${prop.name}${optional}: ${prop.type};${defaultComment}`;
    });

    return `interface ${componentName}Props {
${propLines.join('\n')}
}`;
  }

  /**
   * Generate the wrapper component
   * @param {Object} componentDefinition - The component definition
   * @returns {string} - The wrapper component code
   */
  generateWrapperComponent(componentDefinition) {
    const componentName = componentDefinition.name;
    const hasHooks = componentDefinition.hasHooks;
    const hasContext = componentDefinition.hasContext;

    return `
// React wrapper for ${componentName}
function ${componentName}Wrapper(props: ${componentName}Props) {
  // Ensure React is available
  if (typeof React === 'undefined') {
    throw new Error('React is not available. Make sure React is loaded before using ${componentName}.');
  }

  ${hasContext ? '// Component uses React Context - ensure providers are available' : ''}
  ${hasHooks ? '// Component uses React Hooks - wrapper maintains React context' : ''}
  
  try {
    return React.createElement(${componentName}, props);
  } catch (error) {
    console.error('Error rendering ${componentName}:', error);
    return React.createElement('div', { 
      className: 'component-error',
      style: { color: 'red', padding: '10px', border: '1px solid red' }
    }, 'Error loading ${componentName}');
  }
}`;
  }

  /**
   * Generate mounting and unmounting utilities with error handling
   * @param {string} componentName - The component name
   * @returns {string} - The mounting utilities code
   */
  generateMountingUtils(componentName) {
    return `
// Mounting utilities for ${componentName} with error handling
const ${componentName}Utils = {
  mount: function(container: HTMLElement, props: ${componentName}Props = {}) {
    try {
      if (typeof ReactDOM === 'undefined') {
        throw new Error('ReactDOM is not available. Make sure ReactDOM is loaded.');
      }

      if (!container || !(container instanceof HTMLElement)) {
        throw new Error('Invalid container element provided for mounting ${componentName}');
      }

      const element = React.createElement(${componentName}Wrapper, props);
      
      // Use React 18 createRoot if available, fallback to ReactDOM.render
      if (ReactDOM.createRoot) {
        const root = ReactDOM.createRoot(container);
        root.render(element);
        return {
          unmount: () => {
            try {
              root.unmount();
            } catch (error) {
              console.error('Error unmounting ${componentName}:', error);
            }
          },
          update: (newProps: ${componentName}Props) => {
            try {
              root.render(React.createElement(${componentName}Wrapper, newProps));
            } catch (error) {
              console.error('Error updating ${componentName}:', error);
              // Render error fallback
              root.render(React.createElement('div', { 
                className: 'component-error',
                style: { color: 'red', padding: '10px', border: '1px solid red' }
              }, 'Error updating ${componentName}: ' + error.message));
            }
          }
        };
      } else {
        ReactDOM.render(element, container);
        return {
          unmount: () => {
            try {
              ReactDOM.unmountComponentAtNode(container);
            } catch (error) {
              console.error('Error unmounting ${componentName}:', error);
            }
          },
          update: (newProps: ${componentName}Props) => {
            try {
              ReactDOM.render(React.createElement(${componentName}Wrapper, newProps), container);
            } catch (error) {
              console.error('Error updating ${componentName}:', error);
              // Render error fallback
              ReactDOM.render(React.createElement('div', { 
                className: 'component-error',
                style: { color: 'red', padding: '10px', border: '1px solid red' }
              }, 'Error updating ${componentName}: ' + error.message), container);
            }
          }
        };
      }
    } catch (error) {
      console.error('Error mounting ${componentName}:', error);
      
      // Render error fallback directly to container
      if (container) {
        container.innerHTML = \`
          <div class="component-error" style="
            border: 2px solid #ff6b6b;
            border-radius: 4px;
            padding: 12px;
            margin: 8px 0;
            background-color: #ffe0e0;
            color: #d63031;
            font-family: monospace;
            font-size: 14px;
          ">
            <div style="font-weight: bold; margin-bottom: 8px;">
              ⚠️ Component Mount Error: ${componentName}
            </div>
            <div>\${error.message}</div>
          </div>
        \`;
      }
      
      return {
        unmount: () => {},
        update: () => {}
      };
    }
  },

  createComponent: function(props: ${componentName}Props = {}) {
    try {
      return React.createElement(${componentName}Wrapper, props);
    } catch (error) {
      console.error('Error creating ${componentName}:', error);
      return React.createElement('div', { 
        className: 'component-error',
        style: { color: 'red', padding: '10px', border: '1px solid red' }
      }, 'Error creating ${componentName}: ' + error.message);
    }
  }
};

// Export for use in MTM templates
window.${componentName}Utils = ${componentName}Utils;`;
  }
}

/**
 * Vue Component Adapter - Enhanced for full Vue integration
 */
class VueComponentAdapter extends BaseComponentAdapter {
  constructor() {
    super('vue');
  }

  canHandle(importPath) {
    return importPath.endsWith('.vue') ||
      importPath.includes('vue') ||
      (importPath.endsWith('.js') && importPath.includes('vue')) ||
      (importPath.endsWith('.ts') && importPath.includes('vue'));
  }

  /**
   * Enhanced prop extraction for Vue components
   * @param {string} source - The component source code
   * @returns {Array} - Array of prop definitions
   */
  extractProps(source) {
    const props = [];

    // Extract props from different Vue patterns
    this.extractVueOptionsProps(source, props);
    this.extractVueArrayProps(source, props);
    this.extractCompositionAPIProps(source, props);
    this.extractTypeScriptInterfaceProps(source, props);

    return props;
  }

  /**
   * Extract Vue Options API object props: props: { name: String }
   * @param {string} source - The component source code
   * @param {Array} props - The props array to populate
   */
  extractVueOptionsProps(source, props) {
    // Find props: { and then match braces properly
    const propsStart = source.indexOf('props:');
    if (propsStart === -1) return;

    const afterProps = source.substring(propsStart + 6).trim();
    if (!afterProps.startsWith('{')) return;

    // Find the matching closing brace
    let braceCount = 0;
    let endIndex = -1;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < afterProps.length; i++) {
      const char = afterProps[i];
      const prevChar = i > 0 ? afterProps[i - 1] : '';

      if (!inString && (char === '"' || char === "'" || char === '`')) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && prevChar !== '\\') {
        inString = false;
        stringChar = '';
      }

      if (!inString) {
        if (char === '{') braceCount++;
        if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            endIndex = i;
            break;
          }
        }
      }
    }

    if (endIndex > 0) {
      const propsContent = afterProps.substring(1, endIndex); // Skip opening brace
      this.parseObjectProps(propsContent, props);
    }
  }

  /**
   * Extract Vue Options API array props: props: ['name', 'age']
   * @param {string} source - The component source code
   * @param {Array} props - The props array to populate
   */
  extractVueArrayProps(source, props) {
    const arrayMatch = source.match(/props:\s*\[([^\]]+)\]/);
    if (arrayMatch) {
      const propsContent = arrayMatch[1];
      this.parseArrayProps(propsContent, props);
    }
  }

  /**
   * Extract Composition API props: defineProps({ ... }) or defineProps<{ ... }>()
   * @param {string} source - The component source code
   * @param {Array} props - The props array to populate
   */
  extractCompositionAPIProps(source, props) {
    // Match defineProps<{ ... }>()
    const genericMatch = source.match(/defineProps<\{([\s\S]*?)\}>\(\)/);
    if (genericMatch) {
      const propsContent = genericMatch[1];
      this.parseTypeScriptProps(propsContent, props);
      return;
    }

    // Match defineProps({ ... })
    const objectMatch = source.match(/defineProps\(\s*\{([\s\S]*?)\}\s*\)/);
    if (objectMatch) {
      const propsContent = objectMatch[1];
      this.parseObjectProps(propsContent, props);
    }
  }

  /**
   * Extract TypeScript interface props: interface Props { ... }
   * @param {string} source - The component source code
   * @param {Array} props - The props array to populate
   */
  extractTypeScriptInterfaceProps(source, props) {
    const interfaceMatch = source.match(/interface\s+\w*Props?\s*\{([\s\S]*?)\}/);
    if (interfaceMatch) {
      const propsContent = interfaceMatch[1];
      this.parseTypeScriptProps(propsContent, props);
    }
  }

  /**
   * Parse Vue array-style props: props: ['name', 'age']
   * @param {string} propsContent - The props content to parse
   * @param {Array} props - The props array to populate
   */
  parseArrayProps(propsContent, props) {
    const propNames = propsContent.split(',').map(p => p.trim().replace(/['"]/g, ''));

    for (const name of propNames) {
      if (name) {
        props.push({
          name: name,
          type: 'any',
          required: false,
          default: null
        });
      }
    }
  }

  /**
   * Parse Vue object-style props: props: { name: String, age: { type: Number, default: 0 } }
   * @param {string} propsContent - The props content to parse
   * @param {Array} props - The props array to populate
   */
  parseObjectProps(propsContent, props) {
    // Split by commas, but be careful of nested objects
    const propLines = this.splitPropsContent(propsContent);

    for (const line of propLines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//')) {
        // Match: name: String or name: { type: String, required: true }
        const simpleMatch = trimmed.match(/(\w+):\s*(String|Number|Boolean|Array|Object|Function|Date|Symbol)(?:\s*,|$)/);
        const complexMatch = trimmed.match(/(\w+):\s*\{([^}]+)\}/);

        if (complexMatch) {
          const [, name, config] = complexMatch;
          const propConfig = this.parseVuePropConfig(config);
          props.push({
            name: name,
            type: propConfig.type,
            required: propConfig.required,
            default: propConfig.default
          });
        } else if (simpleMatch) {
          const [, name, type] = simpleMatch;
          props.push({
            name: name,
            type: this.mapVueTypeToTypeScript(type),
            required: false,
            default: null
          });
        }
      }
    }
  }

  /**
   * Parse TypeScript prop definitions for Vue
   * @param {string} propsContent - The props content to parse
   * @param {Array} props - The props array to populate
   */
  parseTypeScriptProps(propsContent, props) {
    // Split by semicolon or newline, but be careful with function types
    const lines = [];
    let current = '';
    let parenCount = 0;
    let angleCount = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < propsContent.length; i++) {
      const char = propsContent[i];
      const prevChar = i > 0 ? propsContent[i - 1] : '';

      if (!inString && (char === '"' || char === "'" || char === '`')) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && prevChar !== '\\') {
        inString = false;
        stringChar = '';
      }

      if (!inString) {
        if (char === '(') parenCount++;
        if (char === ')') parenCount--;
        if (char === '<') angleCount++;
        if (char === '>') angleCount--;

        if ((char === ';' || char === '\n') && parenCount === 0 && angleCount === 0) {
          if (current.trim()) {
            lines.push(current.trim());
          }
          current = '';
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) {
      lines.push(current.trim());
    }

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//')) {
        // Match: name?: (param: type) => returnType = defaultValue
        // or: name?: string | number = defaultValue
        const propMatch = trimmed.match(/(\w+)(\?)?:\s*(.+?)(?:\s*=\s*(.+))?$/);
        if (propMatch) {
          let [, name, optional, type, defaultValue] = propMatch;

          // Clean up type - remove trailing semicolon if present
          type = type.replace(/;$/, '').trim();

          props.push({
            name: name,
            type: type,
            required: !optional,
            default: defaultValue ? defaultValue.trim() : null
          });
        }
      }
    }
  }

  /**
   * Split props content while respecting nested objects
   * @param {string} content - The content to split
   * @returns {Array} - Array of prop lines
   */
  splitPropsContent(content) {
    const lines = [];
    let current = '';
    let braceCount = 0;
    let parenCount = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const prevChar = i > 0 ? content[i - 1] : '';

      if (!inString && (char === '"' || char === "'" || char === '`')) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && prevChar !== '\\') {
        inString = false;
        stringChar = '';
      }

      if (!inString) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
        if (char === '(') parenCount++;
        if (char === ')') parenCount--;

        if (char === ',' && braceCount === 0 && parenCount === 0) {
          if (current.trim()) {
            lines.push(current.trim());
          }
          current = '';
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) {
      lines.push(current.trim());
    }

    return lines.filter(line => line.length > 0);
  }

  /**
   * Parse Vue prop configuration object
   * @param {string} config - The prop config string
   * @returns {Object} - The parsed prop configuration
   */
  parseVuePropConfig(config) {
    const result = {
      type: 'any',
      required: false,
      default: null
    };

    // Extract type
    const typeMatch = config.match(/type:\s*(String|Number|Boolean|Array|Object|Function|Date|Symbol)/i);
    if (typeMatch) {
      result.type = this.mapVueTypeToTypeScript(typeMatch[1]);
    }

    // Extract required
    const requiredMatch = config.match(/required:\s*(true|false)/i);
    if (requiredMatch) {
      result.required = requiredMatch[1].toLowerCase() === 'true';
    }

    // Extract default - handle various formats
    const defaultMatch = config.match(/default:\s*([^,}]+?)(?:\s*,|\s*$)/);
    if (defaultMatch) {
      let defaultValue = defaultMatch[1].trim();
      // Remove trailing comma if present
      if (defaultValue.endsWith(',')) {
        defaultValue = defaultValue.slice(0, -1).trim();
      }
      result.default = defaultValue;
    }

    return result;
  }

  /**
   * Map Vue prop types to TypeScript types
   * @param {string} vueType - The Vue prop type
   * @returns {string} - The TypeScript type
   */
  mapVueTypeToTypeScript(vueType) {
    const typeMap = {
      'String': 'string',
      'Number': 'number',
      'Boolean': 'boolean',
      'Array': 'any[]',
      'Object': 'object',
      'Function': 'Function',
      'Date': 'Date',
      'Symbol': 'symbol'
    };

    return typeMap[vueType] || 'any';
  }

  /**
   * Transform Vue component import with enhanced processing
   * @param {Object} componentImport - The component import object
   * @returns {Object} - The enhanced component definition
   */
  transform(componentImport) {
    const baseDefinition = super.transform(componentImport);

    // Add Vue-specific metadata
    return {
      ...baseDefinition,
      framework: 'vue',
      isVueComponent: true,
      usesCompositionAPI: this.detectCompositionAPI(baseDefinition.source),
      usesOptionsAPI: this.detectOptionsAPI(baseDefinition.source),
      hasSlots: this.detectSlots(baseDefinition.source),
      hasEmits: this.detectEmits(baseDefinition.source),
      exportType: this.detectExportType(baseDefinition.source)
    };
  }

  /**
   * Detect if component uses Vue Composition API
   * @param {string} source - The component source code
   * @returns {boolean} - True if Composition API is detected
   */
  detectCompositionAPI(source) {
    const compositionPatterns = [
      /setup\s*\(/g,
      /defineComponent/g,
      /defineProps/g,
      /defineEmits/g,
      /ref\s*\(/g,
      /reactive\s*\(/g,
      /computed\s*\(/g,
      /watch\s*\(/g,
      /watchEffect\s*\(/g,
      /onMounted/g,
      /onUnmounted/g,
      /onUpdated/g
    ];

    return compositionPatterns.some(pattern => pattern.test(source));
  }

  /**
   * Detect if component uses Vue Options API
   * @param {string} source - The component source code
   * @returns {boolean} - True if Options API is detected
   */
  detectOptionsAPI(source) {
    const optionsPatterns = [
      /data\s*\(\s*\)\s*\{/g,
      /methods\s*:\s*\{/g,
      /computed\s*:\s*\{/g,
      /watch\s*:\s*\{/g,
      /mounted\s*\(\s*\)\s*\{/g,
      /created\s*\(\s*\)\s*\{/g,
      /beforeDestroy\s*\(\s*\)\s*\{/g,
      /destroyed\s*\(\s*\)\s*\{/g
    ];

    return optionsPatterns.some(pattern => pattern.test(source));
  }

  /**
   * Detect if component uses slots
   * @param {string} source - The component source code
   * @returns {boolean} - True if slots are detected
   */
  detectSlots(source) {
    const slotPatterns = [
      /<slot/g,
      /\$slots/g,
      /useSlots/g,
      /slots\./g
    ];

    return slotPatterns.some(pattern => pattern.test(source));
  }

  /**
   * Detect if component defines emits
   * @param {string} source - The component source code
   * @returns {boolean} - True if emits are detected
   */
  detectEmits(source) {
    const emitPatterns = [
      /defineEmits/g,
      /emits\s*:\s*\[/g,
      /emits\s*:\s*\{/g,
      /\$emit/g,
      /emit\s*\(/g
    ];

    return emitPatterns.some(pattern => pattern.test(source));
  }

  /**
   * Detect component export type
   * @param {string} source - The component source code
   * @returns {string} - The export type ('default', 'named', 'both')
   */
  detectExportType(source) {
    const hasDefault = /export\s+default/g.test(source);
    const hasNamed = /export\s+(?:const|function|class)/g.test(source);

    if (hasDefault && hasNamed) return 'both';
    if (hasDefault) return 'default';
    if (hasNamed) return 'named';
    return 'default'; // assume default if unclear
  }

  /**
   * Generate enhanced Vue wrapper with lifecycle management
   * @param {Object} componentDefinition - The component definition
   * @returns {string} - The enhanced wrapper code
   */
  generateWrapper(componentDefinition) {
    const props = componentDefinition.props || [];
    const componentName = componentDefinition.name;

    // Generate TypeScript interface for props
    const propsInterface = this.generatePropsInterface(componentName, props);

    // Generate the wrapper component
    const wrapperComponent = this.generateWrapperComponent(componentDefinition);

    // Generate mounting utilities
    const mountingUtils = this.generateMountingUtils(componentName);

    return `
${propsInterface}

${wrapperComponent}

${mountingUtils}
`;
  }

  /**
   * Generate TypeScript props interface
   * @param {string} componentName - The component name
   * @param {Array} props - The props array
   * @returns {string} - The props interface
   */
  generatePropsInterface(componentName, props) {
    if (props.length === 0) {
      return `interface ${componentName}Props {}`;
    }

    const propLines = props.map(prop => {
      const optional = prop.required ? '' : '?';
      const defaultComment = prop.default ? ` // default: ${prop.default}` : '';
      return `  ${prop.name}${optional}: ${prop.type};${defaultComment}`;
    });

    return `interface ${componentName}Props {
${propLines.join('\n')}
}`;
  }

  /**
   * Generate the wrapper component
   * @param {Object} componentDefinition - The component definition
   * @returns {string} - The wrapper component code
   */
  generateWrapperComponent(componentDefinition) {
    const componentName = componentDefinition.name;
    const usesCompositionAPI = componentDefinition.usesCompositionAPI;
    const usesOptionsAPI = componentDefinition.usesOptionsAPI;
    const hasSlots = componentDefinition.hasSlots;
    const hasEmits = componentDefinition.hasEmits;

    return `
// Vue wrapper for ${componentName}
function ${componentName}Wrapper(props: ${componentName}Props, context?: any) {
  // Ensure Vue is available
  if (typeof Vue === 'undefined') {
    throw new Error('Vue is not available. Make sure Vue is loaded before using ${componentName}.');
  }

  ${usesCompositionAPI ? '// Component uses Vue Composition API' : ''}
  ${usesOptionsAPI ? '// Component uses Vue Options API' : ''}
  ${hasSlots ? '// Component supports slots' : ''}
  ${hasEmits ? '// Component defines custom events' : ''}
  
  try {
    // Use Vue.h (hyperscript) to create the component
    return Vue.h(${componentName}, props, context?.slots || {});
  } catch (error) {
    console.error('Error rendering ${componentName}:', error);
    return Vue.h('div', { 
      class: 'component-error',
      style: { color: 'red', padding: '10px', border: '1px solid red' }
    }, 'Error loading ${componentName}');
  }
}`;
  }

  /**
   * Generate mounting and unmounting utilities
   * @param {string} componentName - The component name
   * @returns {string} - The mounting utilities code
   */
  generateMountingUtils(componentName) {
    return `
// Mounting utilities for ${componentName}
const ${componentName}Utils = {
  mount: function(container: HTMLElement, props: ${componentName}Props = {}, options: any = {}) {
    if (typeof Vue === 'undefined') {
      throw new Error('Vue is not available. Make sure Vue is loaded.');
    }

    // Create Vue app instance
    const app = Vue.createApp({
      render() {
        return Vue.h(${componentName}Wrapper, props);
      }
    });

    // Apply any global configurations
    if (options.plugins) {
      options.plugins.forEach((plugin: any) => app.use(plugin));
    }

    if (options.globalProperties) {
      Object.assign(app.config.globalProperties, options.globalProperties);
    }

    // Mount the app
    const instance = app.mount(container);

    return {
      app: app,
      instance: instance,
      unmount: () => {
        app.unmount();
      },
      update: (newProps: ${componentName}Props) => {
        // For updates, we need to recreate the app with new props
        app.unmount();
        const newApp = Vue.createApp({
          render() {
            return Vue.h(${componentName}Wrapper, newProps);
          }
        });
        
        if (options.plugins) {
          options.plugins.forEach((plugin: any) => newApp.use(plugin));
        }
        
        if (options.globalProperties) {
          Object.assign(newApp.config.globalProperties, options.globalProperties);
        }
        
        return newApp.mount(container);
      }
    };
  },

  createComponent: function(props: ${componentName}Props = {}, context?: any) {
    return Vue.h(${componentName}Wrapper, props, context);
  },

  // Helper for creating reactive props
  createReactiveProps: function(initialProps: ${componentName}Props = {}) {
    if (typeof Vue === 'undefined' || !Vue.reactive) {
      console.warn('Vue.reactive not available, returning plain object');
      return initialProps;
    }
    return Vue.reactive(initialProps);
  },

  // Helper for creating refs
  createRef: function(initialValue: any) {
    if (typeof Vue === 'undefined' || !Vue.ref) {
      console.warn('Vue.ref not available, returning plain value');
      return { value: initialValue };
    }
    return Vue.ref(initialValue);
  }
};

// Export for use in MTM templates
window.${componentName}Utils = ${componentName}Utils;`;
  }
}

/**
 * Solid Component Adapter - Enhanced for full Solid integration
 */
class SolidComponentAdapter extends BaseComponentAdapter {
  constructor() {
    super('solid');
  }

  canHandle(importPath) {
    return importPath.endsWith('.solid.tsx') ||
      importPath.endsWith('.solid.jsx') ||
      importPath.includes('solid') ||
      (importPath.endsWith('.tsx') && !importPath.includes('react') && !importPath.includes('vue'));
  }

  /**
   * Enhanced prop extraction for Solid components
   * @param {string} source - The component source code
   * @returns {Array} - Array of prop definitions
   */
  extractProps(source) {
    const props = [];

    // Extract props from different Solid patterns
    this.extractSolidInterfaceProps(source, props);
    this.extractSolidTypeProps(source, props);
    this.extractSolidFunctionProps(source, props);

    return props;
  }

  /**
   * Extract Solid TypeScript interface props: interface Props { name: string; }
   * @param {string} source - The component source code
   * @param {Array} props - The props array to populate
   */
  extractSolidInterfaceProps(source, props) {
    const interfacePattern = /interface\s+(\w*Props?)\s*\{([^}]+)\}/g;
    let match;

    while ((match = interfacePattern.exec(source)) !== null) {
      const propsContent = match[2];
      this.parseTypeScriptProps(propsContent, props);
    }
  }

  /**
   * Extract Solid TypeScript type props: type Props = { name: string; }
   * @param {string} source - The component source code
   * @param {Array} props - The props array to populate
   */
  extractSolidTypeProps(source, props) {
    const typePattern = /type\s+(\w*Props?)\s*=\s*\{([^}]+)\}/g;
    let match;

    while ((match = typePattern.exec(source)) !== null) {
      const propsContent = match[2];
      this.parseTypeScriptProps(propsContent, props);
    }
  }

  /**
   * Extract Solid function component props: function Component(props: Props)
   * @param {string} source - The component source code
   * @param {Array} props - The props array to populate
   */
  extractSolidFunctionProps(source, props) {
    // Match function component with destructured props
    const functionPattern = /function\s+\w+\s*\(\s*\{\s*([^}]+)\s*\}\s*:\s*\w*Props?\s*\)/g;
    const arrowPattern = /const\s+\w+\s*=\s*\(\s*\{\s*([^}]+)\s*\}\s*:\s*\w*Props?\s*\)\s*=>/g;

    const patterns = [functionPattern, arrowPattern];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(source)) !== null) {
        const propsContent = match[1];
        this.parseDestructuredProps(propsContent, props);
      }
    }
  }

  /**
   * Parse TypeScript prop definitions for Solid
   * @param {string} propsContent - The props content to parse
   * @param {Array} props - The props array to populate
   */
  parseTypeScriptProps(propsContent, props) {
    // Split by semicolon or newline, but be careful with function types and complex types
    const lines = [];
    let current = '';
    let parenCount = 0;
    let angleCount = 0;
    let braceCount = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < propsContent.length; i++) {
      const char = propsContent[i];
      const prevChar = i > 0 ? propsContent[i - 1] : '';

      if (!inString && (char === '"' || char === "'" || char === '`')) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && prevChar !== '\\') {
        inString = false;
        stringChar = '';
      }

      if (!inString) {
        if (char === '(') parenCount++;
        if (char === ')') parenCount--;
        if (char === '<') angleCount++;
        if (char === '>' && prevChar !== '=') angleCount--;
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;

        if ((char === ';' || char === '\n') && parenCount === 0 && angleCount === 0 && braceCount === 0) {
          if (current.trim()) {
            lines.push(current.trim());
          }
          current = '';
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) {
      lines.push(current.trim());
    }

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//')) {
        // Match: name?: type = defaultValue
        // Handle function types, complex types, etc.
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex > -1) {
          const nameAndOptional = trimmed.substring(0, colonIndex).trim();
          const typeAndDefault = trimmed.substring(colonIndex + 1).trim();

          // Extract name and optional marker
          const optionalMatch = nameAndOptional.match(/(\w+)(\?)?/);
          if (optionalMatch) {
            const name = optionalMatch[1];
            const optional = !!optionalMatch[2];

            // Find default value (look for = that's not inside parentheses or braces)
            let type = typeAndDefault;
            let defaultValue = null;

            let parenCount = 0;
            let braceCount = 0;
            let angleCount = 0;
            let inString = false;
            let stringChar = '';
            let equalIndex = -1;

            for (let i = 0; i < typeAndDefault.length; i++) {
              const char = typeAndDefault[i];
              const prevChar = i > 0 ? typeAndDefault[i - 1] : '';

              if (!inString && (char === '"' || char === "'" || char === '`')) {
                inString = true;
                stringChar = char;
              } else if (inString && char === stringChar && prevChar !== '\\') {
                inString = false;
                stringChar = '';
              }

              if (!inString) {
                if (char === '(') parenCount++;
                if (char === ')') parenCount--;
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;
                // Handle angle brackets, but ignore => arrow functions
                if (char === '<') angleCount++;
                if (char === '>' && prevChar !== '=') angleCount--;

                if (char === '=' && (i >= typeAndDefault.length - 1 || typeAndDefault[i + 1] !== '>') && parenCount === 0 && braceCount === 0 && angleCount === 0) {
                  equalIndex = i;
                  break;
                }
              }
            }

            if (equalIndex > -1) {
              type = typeAndDefault.substring(0, equalIndex).trim();
              defaultValue = typeAndDefault.substring(equalIndex + 1).trim();
            }

            // Clean up type - remove trailing semicolon if present
            type = type.replace(/;$/, '').trim();

            props.push({
              name: name,
              type: type,
              required: !optional,
              default: defaultValue
            });
          }
        }
      }
    }
  }

  /**
   * Parse destructured props from function parameters
   * @param {string} propsContent - The destructured props content
   * @param {Array} props - The props array to populate
   */
  parseDestructuredProps(propsContent, props) {
    // Split by commas, but be careful with function defaults and complex expressions
    const propNames = [];
    let current = '';
    let parenCount = 0;
    let braceCount = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < propsContent.length; i++) {
      const char = propsContent[i];
      const prevChar = i > 0 ? propsContent[i - 1] : '';

      if (!inString && (char === '"' || char === "'" || char === '`')) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && prevChar !== '\\') {
        inString = false;
        stringChar = '';
      }

      if (!inString) {
        if (char === '(') parenCount++;
        if (char === ')') parenCount--;
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;

        if (char === ',' && parenCount === 0 && braceCount === 0) {
          if (current.trim()) {
            propNames.push(current.trim());
          }
          current = '';
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) {
      propNames.push(current.trim());
    }

    for (const propName of propNames) {
      if (propName) {
        // Handle default values: name = 'default' or name = () => {}
        const equalIndex = propName.indexOf('=');
        let name, defaultValue;

        if (equalIndex > -1) {
          name = propName.substring(0, equalIndex).trim();
          defaultValue = propName.substring(equalIndex + 1).trim();
        } else {
          name = propName.trim();
          defaultValue = null;
        }

        props.push({
          name: name,
          type: 'any', // Type inference would require more complex parsing
          required: !defaultValue,
          default: defaultValue
        });
      }
    }
  }

  /**
   * Transform Solid component import with enhanced processing
   * @param {Object} componentImport - The component import object
   * @returns {Object} - The enhanced component definition
   */
  transform(componentImport) {
    const baseDefinition = super.transform(componentImport);

    // Add Solid-specific metadata
    return {
      ...baseDefinition,
      framework: 'solid',
      isSolidComponent: true,
      usesSignals: this.detectSignals(baseDefinition.source),
      usesStores: this.detectStores(baseDefinition.source),
      usesEffects: this.detectEffects(baseDefinition.source),
      usesResources: this.detectResources(baseDefinition.source),
      exportType: this.detectExportType(baseDefinition.source)
    };
  }

  /**
   * Detect if component uses Solid signals
   * @param {string} source - The component source code
   * @returns {boolean} - True if signals are detected
   */
  detectSignals(source) {
    const signalPatterns = [
      /createSignal\s*\(/g,
      /\[\w+,\s*set\w+\]\s*=\s*createSignal/g,
      /signal\s*\(/g,
      /\.value/g // Signal access pattern
    ];

    return signalPatterns.some(pattern => pattern.test(source));
  }

  /**
   * Detect if component uses Solid stores
   * @param {string} source - The component source code
   * @returns {boolean} - True if stores are detected
   */
  detectStores(source) {
    const storePatterns = [
      /createStore\s*\(/g,
      /createMutable\s*\(/g,
      /produce\s*\(/g,
      /reconcile\s*\(/g
    ];

    return storePatterns.some(pattern => pattern.test(source));
  }

  /**
   * Detect if component uses Solid effects
   * @param {string} source - The component source code
   * @returns {boolean} - True if effects are detected
   */
  detectEffects(source) {
    const effectPatterns = [
      /createEffect\s*\(/g,
      /createMemo\s*\(/g,
      /createComputed\s*\(/g,
      /onMount\s*\(/g,
      /onCleanup\s*\(/g,
      /createRenderEffect\s*\(/g
    ];

    return effectPatterns.some(pattern => pattern.test(source));
  }

  /**
   * Detect if component uses Solid resources
   * @param {string} source - The component source code
   * @returns {boolean} - True if resources are detected
   */
  detectResources(source) {
    const resourcePatterns = [
      /createResource\s*\(/g,
      /createAsync\s*\(/g,
      /lazy\s*\(/g,
      /Suspense/g,
      /ErrorBoundary/g
    ];

    return resourcePatterns.some(pattern => pattern.test(source));
  }

  /**
   * Detect component export type
   * @param {string} source - The component source code
   * @returns {string} - The export type ('default', 'named', 'both')
   */
  detectExportType(source) {
    const hasDefault = /export\s+default/g.test(source);
    const hasNamed = /export\s+(?:const|function|class)/g.test(source);

    if (hasDefault && hasNamed) return 'both';
    if (hasDefault) return 'default';
    if (hasNamed) return 'named';
    return 'default'; // assume default if unclear
  }

  /**
   * Generate enhanced Solid wrapper with signal integration and lifecycle management
   * @param {Object} componentDefinition - The component definition
   * @returns {string} - The enhanced wrapper code
   */
  generateWrapper(componentDefinition) {
    const props = componentDefinition.props || [];
    const componentName = componentDefinition.name;

    // Generate TypeScript interface for props
    const propsInterface = this.generatePropsInterface(componentName, props);

    // Generate the wrapper component
    const wrapperComponent = this.generateWrapperComponent(componentDefinition);

    // Generate mounting utilities
    const mountingUtils = this.generateMountingUtils(componentName);

    return `
${propsInterface}

${wrapperComponent}

${mountingUtils}
`;
  }

  /**
   * Generate TypeScript props interface
   * @param {string} componentName - The component name
   * @param {Array} props - The props array
   * @returns {string} - The props interface
   */
  generatePropsInterface(componentName, props) {
    if (props.length === 0) {
      return `interface ${componentName}Props {}`;
    }

    const propLines = props.map(prop => {
      const optional = prop.required ? '' : '?';
      const defaultComment = prop.default ? ` // default: ${prop.default}` : '';
      return `  ${prop.name}${optional}: ${prop.type};${defaultComment}`;
    });

    return `interface ${componentName}Props {
${propLines.join('\n')}
}`;
  }

  /**
   * Generate the wrapper component with signal integration
   * @param {Object} componentDefinition - The component definition
   * @returns {string} - The wrapper component code
   */
  generateWrapperComponent(componentDefinition) {
    const componentName = componentDefinition.name;
    const usesSignals = componentDefinition.usesSignals;
    const usesStores = componentDefinition.usesStores;
    const usesEffects = componentDefinition.usesEffects;
    const usesResources = componentDefinition.usesResources;

    return `
// Solid wrapper for ${componentName}
function ${componentName}Wrapper(props: ${componentName}Props) {
  // Ensure Solid is available
  if (typeof Solid === 'undefined') {
    throw new Error('Solid is not available. Make sure Solid-js is loaded before using ${componentName}.');
  }

  ${usesSignals ? '// Component uses Solid signals - wrapper maintains reactivity' : ''}
  ${usesStores ? '// Component uses Solid stores - wrapper handles store integration' : ''}
  ${usesEffects ? '// Component uses Solid effects - wrapper manages effect lifecycle' : ''}
  ${usesResources ? '// Component uses Solid resources - wrapper handles async data' : ''}
  
  try {
    // Create reactive props for Solid component
    const reactiveProps = Solid.createMemo(() => props);
    
    return () => ${componentName}(reactiveProps());
  } catch (error) {
    console.error('Error rendering ${componentName}:', error);
    return () => Solid.createComponent('div', {
      class: 'component-error',
      style: { color: 'red', padding: '10px', border: '1px solid red' },
      children: 'Error loading ${componentName}'
    });
  }
}`;
  }

  /**
   * Generate mounting and unmounting utilities with Solid render integration
   * @param {string} componentName - The component name
   * @returns {string} - The mounting utilities code
   */
  generateMountingUtils(componentName) {
    return `
// Mounting utilities for ${componentName}
const ${componentName}Utils = {
  mount: function(container: HTMLElement, props: ${componentName}Props = {}) {
    if (typeof Solid === 'undefined') {
      throw new Error('Solid is not available. Make sure Solid-js is loaded.');
    }

    // Create signal for props to enable reactivity
    const [getProps, setProps] = Solid.createSignal(props);
    
    // Create the component with reactive props
    const component = () => ${componentName}Wrapper(getProps());
    
    // Render the component
    const dispose = Solid.render(component, container);
    
    return {
      unmount: () => {
        if (dispose) {
          dispose();
        }
      },
      update: (newProps: ${componentName}Props) => {
        setProps(newProps);
      },
      getProps: () => getProps(),
      setProps: setProps
    };
  },

  createComponent: function(props: ${componentName}Props = {}) {
    return () => ${componentName}Wrapper(props);
  },

  createSignal: function(initialValue: any) {
    if (typeof Solid === 'undefined') {
      throw new Error('Solid is not available for signal creation.');
    }
    return Solid.createSignal(initialValue);
  },

  createStore: function(initialValue: any) {
    if (typeof Solid === 'undefined') {
      throw new Error('Solid is not available for store creation.');
    }
    return Solid.createStore ? Solid.createStore(initialValue) : [initialValue, () => {}];
  },

  createMemo: function(fn: () => any) {
    if (typeof Solid === 'undefined') {
      throw new Error('Solid is not available for memo creation.');
    }
    return Solid.createMemo(fn);
  },

  createEffect: function(fn: () => void) {
    if (typeof Solid === 'undefined') {
      throw new Error('Solid is not available for effect creation.');
    }
    return Solid.createEffect(fn);
  }
};

// Export for use in MTM templates
window.${componentName}Utils = ${componentName}Utils;`;
  }
}

/**
 * Svelte Component Adapter - Enhanced for full Svelte integration
 */
class SvelteComponentAdapter extends BaseComponentAdapter {
  constructor() {
    super('svelte');
  }

  canHandle(importPath) {
    return importPath.endsWith('.svelte') ||
      importPath.includes('svelte') ||
      (importPath.endsWith('.js') && importPath.includes('svelte')) ||
      (importPath.endsWith('.ts') && importPath.includes('svelte'));
  }

  /**
   * Enhanced prop extraction for Svelte components
   * @param {string} source - The component source code
   * @returns {Array} - Array of prop definitions
   */
  extractProps(source) {
    const props = [];
    const seenProps = new Set(); // Track seen props to avoid duplicates

    // Extract props from different Svelte patterns
    this.extractSvelteScriptProps(source, props, seenProps);
    this.extractSvelteTypeScriptProps(source, props, seenProps);

    return props;
  }

  /**
   * Extract Svelte script tag props: export let name;
   * @param {string} source - The component source code
   * @param {Array} props - The props array to populate
   * @param {Set} seenProps - Set to track seen props and avoid duplicates
   */
  extractSvelteScriptProps(source, props, seenProps) {
    // Find script tags and extract export let statements
    const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let scriptMatch;

    while ((scriptMatch = scriptPattern.exec(source)) !== null) {
      const scriptContent = scriptMatch[1];
      this.parseExportLetStatements(scriptContent, props, seenProps);
    }
  }



  /**
   * Extract TypeScript interface props from Svelte components
   * @param {string} source - The component source code
   * @param {Array} props - The props array to populate
   */
  extractSvelteTypeScriptProps(source, props, seenProps) {
    // Look for TypeScript interfaces in script lang="ts" tags
    const tsScriptPattern = /<script[^>]*lang=["']ts["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;

    while ((match = tsScriptPattern.exec(source)) !== null) {
      const scriptContent = match[1];

      // Extract interface definitions
      const interfacePattern = /interface\s+(\w*Props?)\s*\{([^}]+)\}/g;
      let interfaceMatch;

      while ((interfaceMatch = interfacePattern.exec(scriptContent)) !== null) {
        const propsContent = interfaceMatch[2];
        this.parseTypeScriptProps(propsContent, props, seenProps);
      }
    }
  }

  /**
   * Parse export let statements from Svelte components
   * @param {string} scriptContent - The script content to parse
   * @param {Array} props - The props array to populate
   */
  parseExportLetStatements(scriptContent, props, seenProps = new Set()) {
    // Find all export let statements manually to handle complex types
    const lines = scriptContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      // Check if this line starts with export let
      if (line.startsWith('export let ')) {
        // Collect the full statement (might span multiple lines)
        let statement = line;

        // If the line doesn't end with semicolon, collect more lines
        while (!statement.endsWith(';') && i + 1 < lines.length) {
          i++;
          statement += ' ' + lines[i].trim();
        }

        // Parse the complete statement
        this.parseExportLetStatement(statement, props, seenProps);
      }
    }
  }

  /**
   * Parse a single export let statement
   * @param {string} statement - The complete export let statement
   * @param {Array} props - The props array to populate
   * @param {Set} seenProps - Set to track seen props and avoid duplicates
   */
  parseExportLetStatement(statement, props, seenProps) {
    // Remove 'export let ' and trailing semicolon
    const content = statement.replace(/^export\s+let\s+/, '').replace(/;$/, '').trim();

    // Find the variable name (everything before : or =)
    let name = '';
    let type = 'any';
    let defaultValue = null;

    // Find the first : or = that's not inside parentheses, braces, or angle brackets
    let colonIndex = -1;
    let equalIndex = -1;
    let parenCount = 0;
    let braceCount = 0;
    let angleCount = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const prevChar = i > 0 ? content[i - 1] : '';

      if (!inString && (char === '"' || char === "'" || char === '`')) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && prevChar !== '\\') {
        inString = false;
        stringChar = '';
      }

      if (!inString) {
        if (char === '(') parenCount++;
        if (char === ')') parenCount--;
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
        if (char === '<') angleCount++;
        if (char === '>' && prevChar !== '=') angleCount--;

        if (char === ':' && colonIndex === -1 && parenCount === 0 && braceCount === 0 && angleCount === 0) {
          colonIndex = i;
        }
        if (char === '=' && (i >= content.length - 1 || content[i + 1] !== '>') &&
          parenCount === 0 && braceCount === 0 && angleCount === 0) {
          equalIndex = i;
          break;
        }
      }
    }

    if (colonIndex > -1) {
      name = content.substring(0, colonIndex).trim();
      if (equalIndex > -1) {
        type = content.substring(colonIndex + 1, equalIndex).trim();
        defaultValue = content.substring(equalIndex + 1).trim();
      } else {
        type = content.substring(colonIndex + 1).trim();
      }
    } else if (equalIndex > -1) {
      name = content.substring(0, equalIndex).trim();
      defaultValue = content.substring(equalIndex + 1).trim();
    } else {
      name = content.trim();
    }

    // Handle optional props (name with ?)
    let isOptional = false;
    if (name.endsWith('?')) {
      name = name.slice(0, -1);
      isOptional = true;
    }

    // Skip if we've already seen this prop
    if (seenProps.has(name)) {
      return;
    }
    seenProps.add(name);

    props.push({
      name: name,
      type: type,
      required: !defaultValue && !isOptional,
      default: defaultValue
    });
  }

  /**
   * Parse TypeScript prop definitions for Svelte
   * @param {string} propsContent - The props content to parse
   * @param {Array} props - The props array to populate
   * @param {Set} seenProps - Set to track seen props and avoid duplicates
   */
  parseTypeScriptProps(propsContent, props, seenProps = new Set()) {
    // Split by semicolon or newline, handling complex types
    const lines = [];
    let current = '';
    let parenCount = 0;
    let angleCount = 0;
    let braceCount = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < propsContent.length; i++) {
      const char = propsContent[i];
      const prevChar = i > 0 ? propsContent[i - 1] : '';

      if (!inString && (char === '"' || char === "'" || char === '`')) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && prevChar !== '\\') {
        inString = false;
        stringChar = '';
      }

      if (!inString) {
        if (char === '(') parenCount++;
        if (char === ')') parenCount--;
        if (char === '<') angleCount++;
        if (char === '>' && prevChar !== '=') angleCount--;
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;

        if ((char === ';' || char === '\n') && parenCount === 0 && angleCount === 0 && braceCount === 0) {
          if (current.trim()) {
            lines.push(current.trim());
          }
          current = '';
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) {
      lines.push(current.trim());
    }

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//')) {
        // Match: name?: type = defaultValue
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex > -1) {
          const nameAndOptional = trimmed.substring(0, colonIndex).trim();
          const typeAndDefault = trimmed.substring(colonIndex + 1).trim();

          // Extract name and optional marker
          const optionalMatch = nameAndOptional.match(/(\w+)(\?)?/);
          if (optionalMatch) {
            const name = optionalMatch[1];
            const optional = !!optionalMatch[2];

            // Skip if we've already seen this prop
            if (seenProps.has(name)) {
              continue;
            }
            seenProps.add(name);

            // Find default value - handle complex types properly
            let type = typeAndDefault;
            let defaultValue = null;

            // Find the equals sign that's not inside parentheses, braces, or angle brackets
            let parenCount = 0;
            let braceCount = 0;
            let angleCount = 0;
            let inString = false;
            let stringChar = '';
            let equalIndex = -1;

            for (let i = 0; i < typeAndDefault.length; i++) {
              const char = typeAndDefault[i];
              const prevChar = i > 0 ? typeAndDefault[i - 1] : '';

              if (!inString && (char === '"' || char === "'" || char === '`')) {
                inString = true;
                stringChar = char;
              } else if (inString && char === stringChar && prevChar !== '\\') {
                inString = false;
                stringChar = '';
              }

              if (!inString) {
                if (char === '(') parenCount++;
                if (char === ')') parenCount--;
                if (char === '{') braceCount++;
                if (char === '}') braceCount--;
                if (char === '<') angleCount++;
                if (char === '>' && prevChar !== '=') angleCount--;

                if (char === '=' && (i >= typeAndDefault.length - 1 || typeAndDefault[i + 1] !== '>') &&
                  parenCount === 0 && braceCount === 0 && angleCount === 0) {
                  equalIndex = i;
                  break;
                }
              }
            }

            if (equalIndex > -1) {
              type = typeAndDefault.substring(0, equalIndex).trim();
              defaultValue = typeAndDefault.substring(equalIndex + 1).trim();
            }

            // Clean up type
            type = type.replace(/;$/, '').trim();

            props.push({
              name: name,
              type: type,
              required: !optional,
              default: defaultValue
            });
          }
        }
      }
    }
  }

  /**
   * Transform Svelte component import with enhanced processing
   * @param {Object} componentImport - The component import object
   * @returns {Object} - The enhanced component definition
   */
  transform(componentImport) {
    const baseDefinition = super.transform(componentImport);

    // Add Svelte-specific metadata
    return {
      ...baseDefinition,
      framework: 'svelte',
      isSvelteComponent: true,
      hasReactiveStatements: this.detectReactiveStatements(baseDefinition.source),
      hasStores: this.detectStores(baseDefinition.source),
      hasSlots: this.detectSlots(baseDefinition.source),
      hasEvents: this.detectEvents(baseDefinition.source),
      hasTransitions: this.detectTransitions(baseDefinition.source),
      hasActions: this.detectActions(baseDefinition.source),
      exportType: this.detectExportType(baseDefinition.source)
    };
  }

  /**
   * Detect if component uses Svelte reactive statements
   * @param {string} source - The component source code
   * @returns {boolean} - True if reactive statements are detected
   */
  detectReactiveStatements(source) {
    const reactivePatterns = [
      /\$:\s*\w+/g, // $: reactiveVar = ...
      /\$:\s*\{/g,  // $: { ... }
      /\$:\s*if/g,  // $: if (condition) ...
      /\$:\s*console/g // $: console.log(...)
    ];

    return reactivePatterns.some(pattern => pattern.test(source));
  }

  /**
   * Detect if component uses Svelte stores
   * @param {string} source - The component source code
   * @returns {boolean} - True if stores are detected
   */
  detectStores(source) {
    const storePatterns = [
      /writable\s*\(/g,
      /readable\s*\(/g,
      /derived\s*\(/g,
      /get\s*\(/g,
      /\$\w+/g, // Store subscriptions like $count
      /\.subscribe\s*\(/g,
      /\.set\s*\(/g,
      /\.update\s*\(/g
    ];

    return storePatterns.some(pattern => pattern.test(source));
  }

  /**
   * Detect if component uses slots
   * @param {string} source - The component source code
   * @returns {boolean} - True if slots are detected
   */
  detectSlots(source) {
    const slotPatterns = [
      /<slot/g,
      /<slot\s+name=/g,
      /slot="/g,
      /$$slots/g,
      /$$props\.$$slots/g
    ];

    return slotPatterns.some(pattern => pattern.test(source));
  }

  /**
   * Detect if component defines or dispatches events
   * @param {string} source - The component source code
   * @returns {boolean} - True if events are detected
   */
  detectEvents(source) {
    const eventPatterns = [
      /createEventDispatcher\s*\(/g,
      /dispatch\s*\(/g,
      /on:\w+/g, // Event handlers like on:click
      /\$\$props\.on\w+/g
    ];

    return eventPatterns.some(pattern => pattern.test(source));
  }

  /**
   * Detect if component uses transitions or animations
   * @param {string} source - The component source code
   * @returns {boolean} - True if transitions are detected
   */
  detectTransitions(source) {
    const transitionPatterns = [
      /transition:/g,
      /in:/g,
      /out:/g,
      /animate:/g,
      /fade/g,
      /slide/g,
      /scale/g,
      /fly/g,
      /blur/g,
      /draw/g
    ];

    return transitionPatterns.some(pattern => pattern.test(source));
  }

  /**
   * Detect if component uses actions
   * @param {string} source - The component source code
   * @returns {boolean} - True if actions are detected
   */
  detectActions(source) {
    const actionPatterns = [
      /use:/g,
      /action\s*\(/g,
      /\.action\s*=/g
    ];

    return actionPatterns.some(pattern => pattern.test(source));
  }

  /**
   * Detect component export type
   * @param {string} source - The component source code
   * @returns {string} - The export type ('default', 'named', 'both')
   */
  detectExportType(source) {
    const hasDefault = /export\s+default/g.test(source);
    const hasNamed = /export\s+(?:const|function|class|let)/g.test(source);

    if (hasDefault && hasNamed) return 'both';
    if (hasDefault) return 'default';
    if (hasNamed) return 'named';
    return 'default'; // Svelte components are typically default exports
  }

  /**
   * Generate enhanced Svelte wrapper with reactive statements and lifecycle management
   * @param {Object} componentDefinition - The component definition
   * @returns {string} - The enhanced wrapper code
   */
  generateWrapper(componentDefinition) {
    const props = componentDefinition.props || [];
    const componentName = componentDefinition.name;

    // Generate TypeScript interface for props
    const propsInterface = this.generatePropsInterface(componentName, props);

    // Generate the wrapper component
    const wrapperComponent = this.generateWrapperComponent(componentDefinition);

    // Generate mounting utilities
    const mountingUtils = this.generateMountingUtils(componentName);

    return `
${propsInterface}

${wrapperComponent}

${mountingUtils}
`;
  }

  /**
   * Generate TypeScript props interface
   * @param {string} componentName - The component name
   * @param {Array} props - The props array
   * @returns {string} - The props interface
   */
  generatePropsInterface(componentName, props) {
    if (props.length === 0) {
      return `interface ${componentName}Props {}`;
    }

    const propLines = props.map(prop => {
      const optional = prop.required ? '' : '?';
      const defaultComment = prop.default ? ` // default: ${prop.default}` : '';
      return `  ${prop.name}${optional}: ${prop.type};${defaultComment}`;
    });

    return `interface ${componentName}Props {
${propLines.join('\n')}
}`;
  }

  /**
   * Generate the wrapper component with reactive statement integration
   * @param {Object} componentDefinition - The component definition
   * @returns {string} - The wrapper component code
   */
  generateWrapperComponent(componentDefinition) {
    const componentName = componentDefinition.name;
    const hasReactiveStatements = componentDefinition.hasReactiveStatements;
    const hasStores = componentDefinition.hasStores;
    const hasSlots = componentDefinition.hasSlots;
    const hasEvents = componentDefinition.hasEvents;
    const hasTransitions = componentDefinition.hasTransitions;
    const hasActions = componentDefinition.hasActions;

    return `
// Svelte wrapper for ${componentName}
function ${componentName}Wrapper(props: ${componentName}Props) {
  // Ensure Svelte is available
  if (typeof ${componentName} === 'undefined') {
    throw new Error('${componentName} is not available. Make sure the Svelte component is compiled and loaded.');
  }

  ${hasReactiveStatements ? '// Component uses reactive statements - wrapper maintains reactivity' : ''}
  ${hasStores ? '// Component uses Svelte stores - wrapper handles store subscriptions' : ''}
  ${hasSlots ? '// Component uses slots - wrapper supports slot content' : ''}
  ${hasEvents ? '// Component dispatches events - wrapper handles event forwarding' : ''}
  ${hasTransitions ? '// Component uses transitions - wrapper supports animations' : ''}
  ${hasActions ? '// Component uses actions - wrapper supports action directives' : ''}
  
  try {
    // Create a wrapper that can be instantiated
    return {
      component: ${componentName},
      props: props,
      create: function(target: HTMLElement, options: any = {}) {
        return new ${componentName}({
          target: target,
          props: { ...props, ...options.props },
          hydrate: options.hydrate || false,
          intro: options.intro !== false
        });
      }
    };
  } catch (error) {
    console.error('Error creating ${componentName} wrapper:', error);
    return {
      component: null,
      props: props,
      create: function(target: HTMLElement) {
        target.innerHTML = \`
          <div class="component-error" style="color: red; padding: 10px; border: 1px solid red;">
            Error loading ${componentName}: \${error.message}
          </div>
        \`;
        return {
          $destroy: () => {},
          $set: () => {},
          $on: () => {}
        };
      }
    };
  }
}`;
  }

  /**
   * Generate mounting and unmounting utilities with Svelte lifecycle management
   * @param {string} componentName - The component name
   * @returns {string} - The mounting utilities code
   */
  generateMountingUtils(componentName) {
    return `
// Mounting utilities for ${componentName}
const ${componentName}Utils = {
  mount: function(container: HTMLElement, props: ${componentName}Props = {}, options: any = {}) {
    if (typeof ${componentName} === 'undefined') {
      throw new Error('${componentName} is not available. Make sure the Svelte component is compiled and loaded.');
    }

    try {
      // Create the Svelte component instance
      const instance = new ${componentName}({
        target: container,
        props: props,
        hydrate: options.hydrate || false,
        intro: options.intro !== false
      });

      // Set up event listeners if provided
      if (options.events) {
        Object.keys(options.events).forEach(eventName => {
          instance.$on(eventName, options.events[eventName]);
        });
      }

      return {
        instance: instance,
        unmount: () => {
          if (instance && instance.$destroy) {
            instance.$destroy();
          }
        },
        update: (newProps: ${componentName}Props) => {
          if (instance && instance.$set) {
            instance.$set(newProps);
          }
        },
        on: (eventName: string, handler: Function) => {
          if (instance && instance.$on) {
            return instance.$on(eventName, handler);
          }
        },
        getProps: () => props,
        getInstance: () => instance
      };
    } catch (error) {
      console.error('Error mounting ${componentName}:', error);
      
      // Return a fallback object
      return {
        instance: null,
        unmount: () => {},
        update: () => {},
        on: () => {},
        getProps: () => props,
        getInstance: () => null
      };
    }
  },

  createComponent: function(props: ${componentName}Props = {}) {
    const wrapper = ${componentName}Wrapper(props);
    return wrapper;
  },

  // Utility for creating Svelte stores (if needed)
  createWritable: function(initialValue: any) {
    if (typeof writable !== 'undefined') {
      return writable(initialValue);
    }
    console.warn('Svelte stores not available. Make sure svelte/store is imported.');
    return {
      subscribe: () => () => {},
      set: () => {},
      update: () => {}
    };
  },

  createReadable: function(initialValue: any, start?: Function) {
    if (typeof readable !== 'undefined') {
      return readable(initialValue, start);
    }
    console.warn('Svelte stores not available. Make sure svelte/store is imported.');
    return {
      subscribe: () => () => {}
    };
  },

  createDerived: function(stores: any, fn: Function) {
    if (typeof derived !== 'undefined') {
      return derived(stores, fn);
    }
    console.warn('Svelte stores not available. Make sure svelte/store is imported.');
    return {
      subscribe: () => () => {}
    };
  },

  // Event dispatcher utility
  createEventDispatcher: function() {
    if (typeof createEventDispatcher !== 'undefined') {
      return createEventDispatcher();
    }
    console.warn('createEventDispatcher not available. Make sure svelte is imported.');
    return () => {};
  }
};

// Export for use in MTM templates
window.${componentName}Utils = ${componentName}Utils;`;
  }
}

module.exports = {
  ComponentAdapter,
  BaseComponentAdapter,
  ReactComponentAdapter,
  VueComponentAdapter,
  SolidComponentAdapter,
  SvelteComponentAdapter
};