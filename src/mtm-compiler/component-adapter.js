// Component Adapter System - Framework-agnostic component handling
const path = require('path');
const fs = require('fs');

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
   */
  transform(componentImport) {
    const resolvedPath = this.resolvePath(componentImport.path);
    let source = '';

    try {
      if (fs.existsSync(resolvedPath)) {
        source = fs.readFileSync(resolvedPath, 'utf8');
      }
    } catch (error) {
      console.warn(`Could not read component source: ${resolvedPath}`);
    }

    return {
      name: componentImport.name,
      framework: this.framework,
      source: source,
      path: resolvedPath,
      originalPath: componentImport.path,
      props: this.extractProps(source),
      dependencies: this.extractDependencies(source)
    };
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
   * Generate mounting and unmounting utilities
   * @param {string} componentName - The component name
   * @returns {string} - The mounting utilities code
   */
  generateMountingUtils(componentName) {
    return `
// Mounting utilities for ${componentName}
const ${componentName}Utils = {
  mount: function(container: HTMLElement, props: ${componentName}Props = {}) {
    if (typeof ReactDOM === 'undefined') {
      throw new Error('ReactDOM is not available. Make sure ReactDOM is loaded.');
    }

    const element = React.createElement(${componentName}Wrapper, props);
    
    // Use React 18 createRoot if available, fallback to ReactDOM.render
    if (ReactDOM.createRoot) {
      const root = ReactDOM.createRoot(container);
      root.render(element);
      return {
        unmount: () => root.unmount(),
        update: (newProps: ${componentName}Props) => {
          root.render(React.createElement(${componentName}Wrapper, newProps));
        }
      };
    } else {
      ReactDOM.render(element, container);
      return {
        unmount: () => ReactDOM.unmountComponentAtNode(container),
        update: (newProps: ${componentName}Props) => {
          ReactDOM.render(React.createElement(${componentName}Wrapper, newProps), container);
        }
      };
    }
  },

  createComponent: function(props: ${componentName}Props = {}) {
    return React.createElement(${componentName}Wrapper, props);
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
 * Solid Component Adapter
 */
class SolidComponentAdapter extends BaseComponentAdapter {
  constructor() {
    super('solid');
  }

  canHandle(importPath) {
    return importPath.endsWith('.solid.tsx') ||
      importPath.includes('solid') ||
      (importPath.endsWith('.tsx') && importPath.includes('solid'));
  }

  generateWrapper(componentDefinition) {
    return `
// Solid wrapper for ${componentDefinition.name}
function ${componentDefinition.name}Wrapper(props) {
  return Solid.render(() => ${componentDefinition.name}(props));
}
`;
  }
}

/**
 * Svelte Component Adapter
 */
class SvelteComponentAdapter extends BaseComponentAdapter {
  constructor() {
    super('svelte');
  }

  canHandle(importPath) {
    return importPath.endsWith('.svelte') || importPath.includes('svelte');
  }

  generateWrapper(componentDefinition) {
    return `
// Svelte wrapper for ${componentDefinition.name}
function ${componentDefinition.name}Wrapper(props) {
  return new ${componentDefinition.name}({ 
    target: document.body, 
    props: props 
  });
}
`;
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