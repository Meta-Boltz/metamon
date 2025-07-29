// TypeScript Integration - Type checking and IntelliSense support
const fs = require('fs');
const path = require('path');
const { TypeScriptPathResolver } = require('./typescript-path-resolver.js');
const { CompilationError } = require('./error-handling.js');

/**
 * TypeScript Integration - Provides type checking and IntelliSense support
 */
class TypeScriptIntegration {
  constructor(options = {}) {
    this.pathResolver = options.pathResolver || TypeScriptPathResolver.fromTypeScriptConfig();
    this.enableTypeChecking = options.enableTypeChecking !== false;
    this.generateDeclarations = options.generateDeclarations || false;
    this.strict = options.strict || false;

    // Cache for type information
    this.typeCache = new Map();
    this.componentTypeCache = new Map();
  }

  /**
   * Analyze component imports and extract type information
   * @param {Array} imports - Array of component imports
   * @param {string} fromFile - File making the imports
   * @returns {Array} Enhanced imports with type information
   */
  analyzeComponentImports(imports, fromFile = '') {
    const enhancedImports = [];

    for (const importInfo of imports) {
      try {
        const resolution = this.pathResolver.resolve(importInfo.path, fromFile);

        if (resolution.found) {
          const typeInfo = this.extractTypeInformation(resolution.resolvedPath);
          const componentMetadata = this.analyzeComponentTypes(resolution.resolvedPath, importInfo.framework);

          enhancedImports.push({
            ...importInfo,
            resolved: resolution,
            typeInfo,
            componentMetadata,
            hasTypeScript: resolution.isTypeScript,
            hasTypeDefinitions: resolution.hasTypeDefinitions
          });
        } else {
          // Import not found - create error but continue
          enhancedImports.push({
            ...importInfo,
            resolved: resolution,
            error: CompilationError.importResolution(
              importInfo.path,
              fromFile,
              importInfo.line || 0,
              resolution.searchPaths || []
            )
          });
        }
      } catch (error) {
        enhancedImports.push({
          ...importInfo,
          error: error instanceof CompilationError ? error : CompilationError.importResolution(
            importInfo.path,
            fromFile,
            importInfo.line || 0,
            []
          )
        });
      }
    }

    return enhancedImports;
  }

  /**
   * Extract type information from a TypeScript file
   * @param {string} filePath - Path to the TypeScript file
   * @returns {Object} Type information
   */
  extractTypeInformation(filePath) {
    // Check cache first
    if (this.typeCache.has(filePath)) {
      return this.typeCache.get(filePath);
    }

    let typeInfo = {
      interfaces: [],
      types: [],
      exports: [],
      imports: [],
      hasDefaultExport: false,
      hasNamedExports: false
    };

    try {
      if (!fs.existsSync(filePath)) {
        return typeInfo;
      }

      const content = fs.readFileSync(filePath, 'utf8');

      // Extract interfaces
      typeInfo.interfaces = this.extractInterfaces(content);

      // Extract type aliases
      typeInfo.types = this.extractTypeAliases(content);

      // Extract exports
      typeInfo.exports = this.extractExports(content);

      // Extract imports
      typeInfo.imports = this.extractImports(content);

      // Check export types
      typeInfo.hasDefaultExport = /export\s+default/.test(content);
      typeInfo.hasNamedExports = /export\s+(?:const|function|class|interface|type)/.test(content);

      // Cache the result
      this.typeCache.set(filePath, typeInfo);

    } catch (error) {
      console.warn(`Could not extract type information from ${filePath}:`, error.message);
    }

    return typeInfo;
  }

  /**
   * Extract interface definitions from TypeScript content
   * @param {string} content - TypeScript file content
   * @returns {Array} Array of interface definitions
   */
  extractInterfaces(content) {
    const interfaces = [];
    const interfaceRegex = /interface\s+(\w+)(?:\s+extends\s+[\w,\s]+)?\s*\{([\s\S]*?)\}/g;

    let match;
    while ((match = interfaceRegex.exec(content)) !== null) {
      const [, name, body] = match;
      const properties = this.parseInterfaceProperties(body);

      interfaces.push({
        name,
        properties,
        raw: match[0]
      });
    }

    return interfaces;
  }

  /**
   * Extract type alias definitions from TypeScript content
   * @param {string} content - TypeScript file content
   * @returns {Array} Array of type alias definitions
   */
  extractTypeAliases(content) {
    const types = [];
    const typeRegex = /type\s+(\w+)(?:<[^>]*>)?\s*=\s*([^;]+);?/g;

    let match;
    while ((match = typeRegex.exec(content)) !== null) {
      const [, name, definition] = match;

      types.push({
        name,
        definition: definition.trim(),
        raw: match[0]
      });
    }

    return types;
  }

  /**
   * Extract export statements from TypeScript content
   * @param {string} content - TypeScript file content
   * @returns {Array} Array of export definitions
   */
  extractExports(content) {
    const exports = [];

    // Default exports
    const defaultExportRegex = /export\s+default\s+(?:function\s+(\w+)|class\s+(\w+)|(\w+))/g;
    let match;
    while ((match = defaultExportRegex.exec(content)) !== null) {
      const name = match[1] || match[2] || match[3];
      exports.push({
        type: 'default',
        name,
        raw: match[0]
      });
    }

    // Named exports
    const namedExportRegex = /export\s+(?:const|function|class|interface|type)\s+(\w+)/g;
    while ((match = namedExportRegex.exec(content)) !== null) {
      const [, name] = match;
      exports.push({
        type: 'named',
        name,
        raw: match[0]
      });
    }

    // Export lists: export { A, B, C }
    const exportListRegex = /export\s*\{\s*([^}]+)\s*\}/g;
    while ((match = exportListRegex.exec(content)) !== null) {
      const exportList = match[1];
      const names = exportList.split(',').map(name => name.trim());

      for (const name of names) {
        if (name) {
          exports.push({
            type: 'named',
            name,
            raw: match[0]
          });
        }
      }
    }

    return exports;
  }

  /**
   * Extract import statements from TypeScript content
   * @param {string} content - TypeScript file content
   * @returns {Array} Array of import definitions
   */
  extractImports(content) {
    const imports = [];
    const importRegex = /import\s+(?:(\w+)|(?:\{([^}]+)\})|(?:(\w+)\s*,\s*\{([^}]+)\}))\s+from\s+['"]([^'"]+)['"]/g;

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const [, defaultImport, namedImports, defaultWithNamed, namedWithDefault, source] = match;

      const importInfo = {
        source,
        raw: match[0]
      };

      if (defaultImport) {
        importInfo.default = defaultImport;
      }

      if (defaultWithNamed) {
        importInfo.default = defaultWithNamed;
      }

      if (namedImports || namedWithDefault) {
        const namedList = namedImports || namedWithDefault;
        importInfo.named = namedList.split(',').map(name => name.trim());
      }

      imports.push(importInfo);
    }

    return imports;
  }

  /**
   * Parse interface properties from interface body
   * @param {string} body - Interface body content
   * @returns {Array} Array of property definitions
   */
  parseInterfaceProperties(body) {
    const properties = [];
    const lines = body.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('//'));

    for (const line of lines) {
      // Match: propertyName?: type; or propertyName: type;
      const propMatch = line.match(/(\w+)(\?)?:\s*([^;]+);?/);
      if (propMatch) {
        const [, name, optional, type] = propMatch;
        properties.push({
          name,
          type: type.trim(),
          optional: !!optional,
          required: !optional,
          raw: line
        });
      }
    }

    return properties;
  }

  /**
   * Analyze component types for a specific framework
   * @param {string} filePath - Path to the component file
   * @param {string} framework - Target framework
   * @returns {Object} Component type metadata
   */
  analyzeComponentTypes(filePath, framework) {
    // Check cache first
    const cacheKey = `${filePath}:${framework}`;
    if (this.componentTypeCache.has(cacheKey)) {
      return this.componentTypeCache.get(cacheKey);
    }

    let metadata = {
      framework,
      props: [],
      events: [],
      slots: [],
      methods: [],
      hasTypeScript: false
    };

    try {
      if (!fs.existsSync(filePath)) {
        return metadata;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const ext = path.extname(filePath).toLowerCase();
      metadata.hasTypeScript = ext === '.ts' || ext === '.tsx' || content.includes('lang="ts"') || content.includes("lang='ts'");

      // Framework-specific analysis
      switch (framework) {
        case 'react':
          metadata = { ...metadata, ...this.analyzeReactComponent(content) };
          break;
        case 'vue':
          metadata = { ...metadata, ...this.analyzeVueComponent(content) };
          break;
        case 'solid':
          metadata = { ...metadata, ...this.analyzeSolidComponent(content) };
          break;
        case 'svelte':
          metadata = { ...metadata, ...this.analyzeSvelteComponent(content) };
          break;
      }

      // Cache the result
      this.componentTypeCache.set(cacheKey, metadata);

    } catch (error) {
      console.warn(`Could not analyze component types for ${filePath}:`, error.message);
    }

    return metadata;
  }

  /**
   * Analyze React component types
   * @param {string} content - Component content
   * @returns {Object} React-specific metadata
   */
  analyzeReactComponent(content) {
    const metadata = {
      props: [],
      hooks: [],
      context: []
    };

    // Extract props from interface/type definitions
    const propsInterfaceMatch = content.match(/interface\s+\w*Props\s*\{([\s\S]*?)\}/);
    const propsTypeMatch = content.match(/type\s+\w*Props\s*=\s*\{([\s\S]*?)\}/);

    if (propsInterfaceMatch) {
      metadata.props = this.parseInterfaceProperties(propsInterfaceMatch[1]);
    } else if (propsTypeMatch) {
      metadata.props = this.parseInterfaceProperties(propsTypeMatch[1]);
    }

    // Extract hooks usage
    const hookMatches = content.match(/use[A-Z]\w*/g) || [];
    metadata.hooks = [...new Set(hookMatches)];

    // Extract context usage
    const contextMatches = content.match(/(?:useContext|createContext)\s*\(\s*(\w+)/g) || [];
    metadata.context = contextMatches.map(match => {
      const contextMatch = match.match(/(\w+)$/);
      return contextMatch ? contextMatch[1] : null;
    }).filter(Boolean);

    return metadata;
  }

  /**
   * Analyze Vue component types
   * @param {string} content - Component content
   * @returns {Object} Vue-specific metadata
   */
  analyzeVueComponent(content) {
    const metadata = {
      props: [],
      emits: [],
      composables: []
    };

    // Extract props from defineProps
    const definePropsMatch = content.match(/defineProps<\{([\s\S]*?)\}>/);
    const definePropsInterfaceMatch = content.match(/defineProps<(\w+)>/);

    if (definePropsMatch) {
      metadata.props = this.parseInterfaceProperties(definePropsMatch[1]);
    } else if (definePropsInterfaceMatch) {
      // Look for the interface definition
      const interfaceName = definePropsInterfaceMatch[1];
      const interfaceRegex = new RegExp(`interface\\s+${interfaceName}\\s*\\{([\\s\\S]*?)\\}`, 'g');
      const interfaceMatch = interfaceRegex.exec(content);
      if (interfaceMatch) {
        metadata.props = this.parseInterfaceProperties(interfaceMatch[1]);
      }
    }

    // Extract emits from defineEmits
    const defineEmitsMatch = content.match(/defineEmits<\{([\s\S]*?)\}>/);
    if (defineEmitsMatch) {
      const emitLines = defineEmitsMatch[1].split('\n').map(line => line.trim()).filter(line => line);
      for (const line of emitLines) {
        const emitMatch = line.match(/(\w+):\s*\[([\s\S]*?)\]/);
        if (emitMatch) {
          metadata.emits.push({
            name: emitMatch[1],
            parameters: emitMatch[2].trim()
          });
        }
      }
    }

    // Extract composables usage
    const composableMatches = content.match(/use[A-Z]\w*/g) || [];
    metadata.composables = [...new Set(composableMatches)];

    return metadata;
  }

  /**
   * Analyze Solid component types
   * @param {string} content - Component content
   * @returns {Object} Solid-specific metadata
   */
  analyzeSolidComponent(content) {
    const metadata = {
      props: [],
      signals: [],
      effects: []
    };

    // Extract props from function parameters
    const componentMatch = content.match(/(?:function|const)\s+\w+\s*(?:=\s*)?\(\s*props:\s*\{([\s\S]*?)\}/);
    const componentInterfaceMatch = content.match(/(?:function|const)\s+\w+\s*(?:=\s*)?\([^)]*props:\s*(\w+)[^)]*\)/);

    if (componentMatch) {
      metadata.props = this.parseInterfaceProperties(componentMatch[1]);
    } else if (componentInterfaceMatch) {
      // Look for the interface definition
      const interfaceName = componentInterfaceMatch[1];
      const interfaceRegex = new RegExp(`interface\\s+${interfaceName}\\s*\\{([\\s\\S]*?)\\}`, 'g');
      const interfaceMatch = interfaceRegex.exec(content);
      if (interfaceMatch) {
        metadata.props = this.parseInterfaceProperties(interfaceMatch[1]);
      }
    }

    // Extract signals
    const signalMatches = content.match(/createSignal\s*\(/g) || [];
    metadata.signals = Array(signalMatches.length).fill(null).map((_, i) => `signal${i + 1}`);

    // Extract effects
    const effectMatches = content.match(/createEffect\s*\(/g) || [];
    metadata.effects = Array(effectMatches.length).fill(null).map((_, i) => `effect${i + 1}`);

    return metadata;
  }

  /**
   * Analyze Svelte component types
   * @param {string} content - Component content
   * @returns {Object} Svelte-specific metadata
   */
  analyzeSvelteComponent(content) {
    const metadata = {
      props: [],
      events: [],
      stores: []
    };

    // Extract props from export let statements
    const propMatches = content.match(/export\s+let\s+(\w+)(?::\s*([^=;]+))?(?:\s*=\s*([^;]+))?/g) || [];
    for (const match of propMatches) {
      const propMatch = match.match(/export\s+let\s+(\w+)(?::\s*([^=;]+))?(?:\s*=\s*([^;]+))?/);
      if (propMatch) {
        const [, name, type, defaultValue] = propMatch;
        metadata.props.push({
          name,
          type: type ? type.trim() : 'any',
          optional: !!defaultValue,
          default: defaultValue ? defaultValue.trim() : null
        });
      }
    }

    // Extract custom events
    const eventMatches = content.match(/createEventDispatcher\s*<\s*\{([\s\S]*?)\}\s*>/);
    if (eventMatches) {
      const eventContent = eventMatches[1];
      // Split by semicolon or newline, handling nested objects
      const eventLines = this.splitEventContent(eventContent);

      for (const line of eventLines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('//')) {
          const eventMatch = trimmed.match(/(\w+):\s*([^;,}]+)/);
          if (eventMatch) {
            metadata.events.push({
              name: eventMatch[1],
              type: eventMatch[2].trim().replace(/[;,]$/, '')
            });
          }
        }
      }
    }

    // Extract stores usage
    const storeMatches = content.match(/\$\w+/g) || [];
    metadata.stores = [...new Set(storeMatches.map(store => store.substring(1)))];

    return metadata;
  }

  /**
   * Split event content while respecting nested objects
   * @param {string} content - Event content to split
   * @returns {Array} Array of event lines
   */
  splitEventContent(content) {
    const lines = [];
    let current = '';
    let braceCount = 0;
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

        if ((char === ';' || char === '\n') && braceCount === 0) {
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

    return lines;
  }

  /**
   * Generate TypeScript declaration file for MTM component
   * @param {Object} componentInfo - Component information
   * @param {Array} enhancedImports - Enhanced import information
   * @returns {string} TypeScript declaration content
   */
  generateDeclarationFile(componentInfo, enhancedImports) {
    const lines = [];

    // Add imports for external types
    const typeImports = enhancedImports
      .filter(imp => imp.hasTypeDefinitions && !imp.error)
      .map(imp => `import type { ${imp.name}Props } from '${imp.resolved.resolvedPath}';`);

    if (typeImports.length > 0) {
      lines.push(...typeImports);
      lines.push('');
    }

    // Add component interface
    lines.push(`interface ${componentInfo.name}Props {`);

    // Add props from imported components
    for (const imp of enhancedImports) {
      if (imp.componentMetadata && imp.componentMetadata.props) {
        for (const prop of imp.componentMetadata.props) {
          const optional = prop.optional ? '?' : '';
          const comment = prop.default ? ` // default: ${prop.default}` : '';
          lines.push(`  ${prop.name}${optional}: ${prop.type};${comment}`);
        }
      }
    }

    lines.push('}');
    lines.push('');

    // Add component declaration
    lines.push(`declare const ${componentInfo.name}: React.FC<${componentInfo.name}Props>;`);
    lines.push(`export default ${componentInfo.name};`);

    return lines.join('\n');
  }

  /**
   * Validate component imports and types
   * @param {Array} enhancedImports - Enhanced import information
   * @param {string} fromFile - File making the imports
   * @returns {Array} Array of validation errors
   */
  validateImports(enhancedImports, fromFile = '') {
    const errors = [];

    for (const imp of enhancedImports) {
      // Check for import resolution errors
      if (imp.error) {
        errors.push(imp.error);
        continue;
      }

      // Check for type mismatches
      if (this.enableTypeChecking && imp.hasTypeScript) {
        const typeErrors = this.validateComponentTypes(imp);
        errors.push(...typeErrors);
      }

      // Check for framework compatibility
      if (imp.framework && imp.resolved.framework &&
        imp.framework !== imp.resolved.framework &&
        imp.resolved.framework !== 'unknown') {
        errors.push(CompilationError.frameworkMismatch(
          imp.name,
          imp.framework,
          imp.resolved.framework,
          fromFile
        ));
      }
    }

    return errors;
  }

  /**
   * Validate component types
   * @param {Object} importInfo - Import information
   * @returns {Array} Array of type validation errors
   */
  validateComponentTypes(importInfo) {
    const errors = [];

    // This is a placeholder for more sophisticated type checking
    // In a real implementation, you might use the TypeScript compiler API

    if (importInfo.componentMetadata && importInfo.componentMetadata.props) {
      for (const prop of importInfo.componentMetadata.props) {
        // Check for required props without defaults
        if (!prop.optional && !prop.default) {
          // This would be checked against usage in templates
        }
      }
    }

    return errors;
  }

  /**
   * Clear caches
   */
  clearCache() {
    this.typeCache.clear();
    this.componentTypeCache.clear();
  }
}

module.exports = { TypeScriptIntegration };