// Enhanced MTM Parser - Extends MTM parser with frontmatter and import support
const { MTMParser } = require('./parser.js');
const { CompilationError } = require('./error-handling.js');
const { TypeScriptPathResolver } = require('./typescript-path-resolver.js');
const { TypeScriptIntegration } = require('./typescript-integration.js');
const fs = require('fs');
const path = require('path');

class EnhancedMTMParser extends MTMParser {
  constructor(options = {}) {
    super();
    this.frontmatter = {};
    this.imports = [];

    // TypeScript integration
    this.typeScriptResolver = options.typeScriptResolver || TypeScriptPathResolver.fromTypeScriptConfig();
    this.typeScriptIntegration = options.typeScriptIntegration || new TypeScriptIntegration({
      pathResolver: this.typeScriptResolver,
      enableTypeChecking: options.enableTypeChecking !== false,
      generateDeclarations: options.generateDeclarations || false
    });

    this.enableTypeScript = options.enableTypeScript !== false;
  }

  parse(source, filename = 'unknown.mtm') {
    // First extract frontmatter
    const { frontmatter, content } = this.extractFrontmatter(source);
    this.frontmatter = frontmatter;

    // Then parse the rest using the base parser
    this.tokens = this.tokenize(content);
    this.current = 0;

    const framework = this.detectFramework(filename);
    const ast = this.parseComponent(framework);

    // Add frontmatter and imports to AST
    ast.frontmatter = this.frontmatter;
    ast.imports = this.imports;

    // Enhanced TypeScript processing
    if (this.enableTypeScript && this.imports.length > 0) {
      try {
        ast.enhancedImports = this.typeScriptIntegration.analyzeComponentImports(this.imports, filename);
        ast.typeValidationErrors = this.typeScriptIntegration.validateImports(ast.enhancedImports, filename);

        // Generate TypeScript declarations if requested
        if (this.typeScriptIntegration.generateDeclarations) {
          ast.typeDeclaration = this.typeScriptIntegration.generateDeclarationFile(ast, ast.enhancedImports);
        }
      } catch (error) {
        console.warn('TypeScript integration error:', error.message);
        ast.enhancedImports = this.imports.map(imp => ({ ...imp, error: error }));
        ast.typeValidationErrors = [error];
      }
    } else {
      ast.enhancedImports = this.imports;
      ast.typeValidationErrors = [];
    }

    return ast;
  }

  extractFrontmatter(source) {
    const lines = source.split('\n');
    let frontmatterContent = '';
    let contentStart = 0;
    let inFrontmatter = false;
    let frontmatterEnd = -1;

    // Check if file starts with frontmatter delimiter
    if (lines[0] && lines[0].trim() === '---') {
      inFrontmatter = true;
      contentStart = 1;

      // Find the closing delimiter
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
          frontmatterEnd = i;
          contentStart = i + 1;
          break;
        }
        frontmatterContent += lines[i] + '\n';
      }
    }

    const frontmatter = inFrontmatter && frontmatterEnd > 0
      ? this.parseFrontmatter(frontmatterContent.trim())
      : {};

    const content = lines.slice(contentStart).join('\n');

    return { frontmatter, content };
  }

  parseFrontmatter(content) {
    const frontmatter = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Parse key: value pairs
      const match = trimmed.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const key = match[1];
        let value = match[2].trim();

        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        frontmatter[key] = value;
      }
    }

    return frontmatter;
  }

  tokenize(source) {
    const tokens = [];
    const lines = source.split('\n');

    // Reset imports for each tokenization
    this.imports = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip comments and empty lines
      if (line.trim().startsWith('//') || line.trim() === '') continue;

      // Parse import statements
      const importMatch = line.match(/^\s*import\s+(\w+)\s+from\s+["']([^"']+)["']\s*$/);
      if (importMatch) {
        const componentName = importMatch[1];
        const componentPath = importMatch[2];
        const componentType = this.detectComponentType(componentPath);

        const importInfo = {
          type: 'IMPORT',
          name: componentName,
          path: componentPath,
          framework: componentType,
          line: i + 1
        };

        tokens.push(importInfo);
        this.imports.push(importInfo);
        continue;
      }

      // Parse reactive variables: $variable! = value
      const reactiveMatch = line.match(/\s*\$(\w+)!\s*=\s*(.+)/);
      if (reactiveMatch) {
        tokens.push({
          type: 'REACTIVE_VARIABLE',
          name: reactiveMatch[1],
          value: reactiveMatch[2].trim(),
          line: i + 1
        });
        continue;
      }

      // Parse computed variables: $variable = expression (but not functions)
      const computedMatch = line.match(/^\s*\$(\w+)\s*=\s*(.+)/);
      if (computedMatch && !reactiveMatch && !computedMatch[2].trim().includes('=>')) {
        tokens.push({
          type: 'COMPUTED_VARIABLE',
          name: computedMatch[1],
          value: computedMatch[2].trim(),
          line: i + 1
        });
        continue;
      }

      // Parse functions: $function = () => { ... }
      const functionMatch = line.match(/^\s*\$(\w+)\s*=\s*(\([^)]*\))\s*=>\s*\{/);
      if (functionMatch) {
        const functionBody = this.extractFunctionBody(lines, i);
        tokens.push({
          type: 'FUNCTION',
          name: functionMatch[1],
          params: functionMatch[2],
          body: functionBody.body,
          line: i + 1
        });
        i = functionBody.endLine;
        continue;
      }

      // Parse template start
      if (line.trim() === '<template>') {
        const template = this.extractTemplate(lines, i);
        tokens.push({
          type: 'TEMPLATE',
          content: template.content,
          line: i + 1
        });
        i = template.endLine;
        continue;
      }

      // Parse export default
      if (line.includes('export default function')) {
        const nameMatch = line.match(/export default function (\w+)/);
        tokens.push({
          type: 'COMPONENT_NAME',
          name: nameMatch ? nameMatch[1] : 'Component',
          line: i + 1
        });
        continue;
      }
    }

    return tokens;
  }

  detectComponentType(componentPath) {
    if (this.enableTypeScript) {
      // Use TypeScript resolver for more accurate detection
      const framework = this.typeScriptResolver.detectFrameworkFromPath(componentPath);
      if (framework !== 'unknown') {
        return framework;
      }
    }

    // Fallback to basic detection
    if (componentPath.endsWith('.vue')) {
      return 'vue';
    }
    if (componentPath.endsWith('.svelte')) {
      return 'svelte';
    }
    if (componentPath.endsWith('.solid.tsx') || componentPath.includes('solid')) {
      return 'solid';
    }
    if (componentPath.endsWith('.tsx') || componentPath.endsWith('.jsx')) {
      return 'react';
    }
    return 'unknown';
  }

  parseComponent(framework) {
    const ast = {
      type: 'COMPONENT',
      framework,
      name: 'Component',
      variables: [],
      functions: [],
      template: null,
      frontmatter: this.frontmatter,
      imports: this.imports
    };

    for (const token of this.tokens) {
      switch (token.type) {
        case 'COMPONENT_NAME':
          ast.name = token.name;
          break;
        case 'REACTIVE_VARIABLE':
          ast.variables.push({
            type: 'reactive',
            name: token.name,
            value: token.value,
            line: token.line
          });
          break;
        case 'COMPUTED_VARIABLE':
          ast.variables.push({
            type: 'computed',
            name: token.name,
            value: token.value,
            line: token.line
          });
          break;
        case 'FUNCTION':
          ast.functions.push({
            name: token.name,
            params: token.params,
            body: token.body,
            line: token.line
          });
          break;
        case 'TEMPLATE':
          ast.template = {
            content: token.content,
            line: token.line
          };
          break;
        case 'IMPORT':
          // Imports are already handled in the imports array
          break;
      }
    }

    return ast;
  }

  // Enhanced utility method to resolve component paths with TypeScript support
  resolveComponentPath(importPath, basePath = '') {
    if (this.enableTypeScript) {
      try {
        const resolution = this.typeScriptResolver.resolve(importPath, basePath);
        return resolution.found ? resolution.resolvedPath : importPath;
      } catch (error) {
        console.warn(`Path resolution failed for ${importPath}:`, error.message);
      }
    }

    // Fallback to basic resolution
    if (importPath.startsWith('@components/')) {
      // Replace @components/ with actual components directory
      return importPath.replace('@components/', 'src/components/');
    }
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      // Handle relative imports
      return importPath;
    }
    // Handle absolute imports
    return importPath;
  }

  // Validation method for frontmatter
  validateFrontmatter(frontmatter, filename = 'unknown.mtm') {
    const errors = [];

    // Validate route format
    if (frontmatter.route && !frontmatter.route.startsWith('/')) {
      errors.push(CompilationError.frontmatterValidation(
        'route',
        frontmatter.route,
        filename,
        ['Must start with "/" (e.g., "/home", "/user/[id]")']
      ));
    }

    // Validate compileJsMode
    if (frontmatter.compileJsMode) {
      const validModes = ['inline', 'external.js'];
      const isValidCustomMode = frontmatter.compileJsMode.endsWith('.js');

      if (!validModes.includes(frontmatter.compileJsMode) && !isValidCustomMode) {
        errors.push(CompilationError.frontmatterValidation(
          'compileJsMode',
          frontmatter.compileJsMode,
          filename,
          ['inline', 'external.js', 'custom.js']
        ));
      }
    }

    return errors;
  }

  // Get compilation mode from frontmatter with defaults
  getCompilationMode(frontmatter, options = {}, filename = 'unknown.mtm') {
    const compileJsMode = frontmatter.compileJsMode;

    // If explicitly set, validate and return
    if (compileJsMode) {
      const errors = this.validateFrontmatter({ compileJsMode }, filename);
      if (errors.length > 0) {
        throw errors[0];
      }
      return compileJsMode;
    }

    // Default behavior based on options
    if (options.development) {
      return 'inline';
    }

    if (options.production) {
      return 'external.js';
    }

    // Default to inline for simplicity
    return 'inline';
  }

  /**
   * Resolve and validate component import paths
   * @param {string} importPath - The import path to resolve
   * @param {string} basePath - Base path for resolution
   * @param {string} filename - Current file name for error reporting
   * @param {number} line - Line number for error reporting
   * @returns {string} Resolved path
   * @throws {CompilationError} If path cannot be resolved
   */
  resolveAndValidateComponentPath(importPath, basePath = process.cwd(), filename = 'unknown.mtm', line = 0) {
    const resolvedPath = this.resolveComponentPath(importPath, basePath);
    const searchPaths = [];

    // Try different possible paths
    const possiblePaths = [
      resolvedPath,
      resolvedPath + '.tsx',
      resolvedPath + '.jsx',
      resolvedPath + '.vue',
      resolvedPath + '.svelte',
      resolvedPath + '/index.tsx',
      resolvedPath + '/index.jsx',
      resolvedPath + '/index.vue',
      resolvedPath + '/index.svelte'
    ];

    for (const possiblePath of possiblePaths) {
      searchPaths.push(possiblePath);
      try {
        if (fs.existsSync(possiblePath)) {
          return possiblePath;
        }
      } catch (error) {
        // Continue searching
      }
    }

    // If we get here, the import couldn't be resolved
    throw CompilationError.importResolution(
      importPath,
      filename,
      line,
      searchPaths
    );
  }

  /**
   * Generate IntelliSense information for IDE support
   * @param {Object} ast - The parsed AST
   * @param {string} filename - The source filename
   * @returns {Object} IntelliSense information
   */
  generateIntelliSenseInfo(ast, filename = 'unknown.mtm') {
    const intelliSense = {
      filename,
      components: [],
      variables: [],
      functions: [],
      imports: [],
      typeDefinitions: [],
      completions: [],
      diagnostics: []
    };

    try {
      // Process enhanced imports for component information
      if (ast.enhancedImports) {
        for (const imp of ast.enhancedImports) {
          if (!imp.error && imp.componentMetadata) {
            intelliSense.components.push({
              name: imp.name,
              framework: imp.framework,
              path: imp.resolved?.resolvedPath || imp.path,
              props: imp.componentMetadata.props || [],
              hasTypeScript: imp.hasTypeScript,
              documentation: this.generateComponentDocumentation(imp)
            });

            // Add completions for component props
            if (imp.componentMetadata.props) {
              for (const prop of imp.componentMetadata.props) {
                intelliSense.completions.push({
                  label: prop.name,
                  kind: 'Property',
                  detail: `${prop.name}: ${prop.type}`,
                  documentation: prop.default ? `Default: ${prop.default}` : '',
                  insertText: `${prop.name}={$1}`,
                  component: imp.name
                });
              }
            }
          }

          // Add import diagnostics
          if (imp.error) {
            intelliSense.diagnostics.push({
              severity: 'error',
              message: imp.error.message,
              line: imp.line || 0,
              column: 0,
              source: 'mtm-typescript'
            });
          }
        }
      }

      // Process variables
      if (ast.variables) {
        for (const variable of ast.variables) {
          intelliSense.variables.push({
            name: variable.name,
            type: variable.type,
            value: variable.value,
            line: variable.line,
            reactive: variable.type === 'reactive'
          });

          // Add variable completions
          intelliSense.completions.push({
            label: `$${variable.name}`,
            kind: 'Variable',
            detail: `${variable.type} variable`,
            documentation: `Value: ${variable.value}`,
            insertText: `$${variable.name}`
          });
        }
      }

      // Process functions
      if (ast.functions) {
        for (const func of ast.functions) {
          intelliSense.functions.push({
            name: func.name,
            params: func.params,
            body: func.body,
            line: func.line
          });

          // Add function completions
          intelliSense.completions.push({
            label: `$${func.name}`,
            kind: 'Function',
            detail: `${func.name}${func.params}`,
            documentation: 'MTM function',
            insertText: `$${func.name}($1)`
          });
        }
      }

      // Add type validation diagnostics
      if (ast.typeValidationErrors) {
        for (const error of ast.typeValidationErrors) {
          intelliSense.diagnostics.push({
            severity: 'error',
            message: error.message,
            line: error.line || 0,
            column: error.column || 0,
            source: 'mtm-typescript'
          });
        }
      }

      // Add framework-specific completions
      intelliSense.completions.push(
        ...this.generateFrameworkCompletions(ast.framework)
      );

      // Add path alias completions
      intelliSense.completions.push(
        ...this.generatePathAliasCompletions()
      );

    } catch (error) {
      console.warn('Error generating IntelliSense info:', error.message);
      intelliSense.diagnostics.push({
        severity: 'warning',
        message: `IntelliSense generation error: ${error.message}`,
        line: 0,
        column: 0,
        source: 'mtm-typescript'
      });
    }

    return intelliSense;
  }

  /**
   * Generate component documentation
   * @param {Object} importInfo - Import information
   * @returns {string} Component documentation
   */
  generateComponentDocumentation(importInfo) {
    const lines = [];

    lines.push(`**${importInfo.name}** (${importInfo.framework})`);
    lines.push('');

    if (importInfo.componentMetadata.props && importInfo.componentMetadata.props.length > 0) {
      lines.push('**Props:**');
      for (const prop of importInfo.componentMetadata.props) {
        const optional = prop.optional ? '?' : '';
        const defaultValue = prop.default ? ` = ${prop.default}` : '';
        lines.push(`- \`${prop.name}${optional}: ${prop.type}${defaultValue}\``);
      }
      lines.push('');
    }

    if (importInfo.resolved?.resolvedPath) {
      lines.push(`**Source:** \`${importInfo.resolved.resolvedPath}\``);
    }

    return lines.join('\n');
  }

  /**
   * Generate framework-specific completions
   * @param {string} framework - Target framework
   * @returns {Array} Array of completions
   */
  generateFrameworkCompletions(framework) {
    const completions = [];

    // Common MTM completions
    completions.push(
      {
        label: 'signal',
        kind: 'Function',
        detail: 'signal(key, initialValue)',
        documentation: 'Create a reactive signal',
        insertText: 'signal(\'$1\', $2)'
      },
      {
        label: 'template',
        kind: 'Snippet',
        detail: '<template>...</template>',
        documentation: 'MTM template block',
        insertText: '<template>\n  $1\n</template>'
      }
    );

    // Framework-specific completions
    switch (framework) {
      case 'react':
        completions.push(
          {
            label: 'useState',
            kind: 'Function',
            detail: 'useState(initialValue)',
            documentation: 'React state hook',
            insertText: 'useState($1)'
          },
          {
            label: 'useEffect',
            kind: 'Function',
            detail: 'useEffect(effect, deps)',
            documentation: 'React effect hook',
            insertText: 'useEffect(() => {\n  $1\n}, [$2])'
          }
        );
        break;

      case 'vue':
        completions.push(
          {
            label: 'ref',
            kind: 'Function',
            detail: 'ref(value)',
            documentation: 'Vue reactive reference',
            insertText: 'ref($1)'
          },
          {
            label: 'computed',
            kind: 'Function',
            detail: 'computed(getter)',
            documentation: 'Vue computed property',
            insertText: 'computed(() => $1)'
          }
        );
        break;

      case 'solid':
        completions.push(
          {
            label: 'createSignal',
            kind: 'Function',
            detail: 'createSignal(initialValue)',
            documentation: 'Solid reactive signal',
            insertText: 'createSignal($1)'
          },
          {
            label: 'createEffect',
            kind: 'Function',
            detail: 'createEffect(fn)',
            documentation: 'Solid reactive effect',
            insertText: 'createEffect(() => $1)'
          }
        );
        break;

      case 'svelte':
        completions.push(
          {
            label: 'writable',
            kind: 'Function',
            detail: 'writable(value)',
            documentation: 'Svelte writable store',
            insertText: 'writable($1)'
          },
          {
            label: 'derived',
            kind: 'Function',
            detail: 'derived(stores, fn)',
            documentation: 'Svelte derived store',
            insertText: 'derived($1, $2 => $3)'
          }
        );
        break;
    }

    return completions;
  }

  /**
   * Generate path alias completions
   * @returns {Array} Array of path completions
   */
  generatePathAliasCompletions() {
    const completions = [];

    if (this.enableTypeScript && this.typeScriptResolver) {
      for (const [alias] of Object.entries(this.typeScriptResolver.resolvedPaths)) {
        const cleanAlias = alias.replace('/*', '/');
        completions.push({
          label: cleanAlias,
          kind: 'Folder',
          detail: `Path alias: ${alias}`,
          documentation: 'TypeScript path mapping',
          insertText: cleanAlias
        });
      }
    }

    return completions;
  }

  /**
   * Get type information for a specific position in the file
   * @param {string} source - Source code
   * @param {number} line - Line number (0-based)
   * @param {number} column - Column number (0-based)
   * @returns {Object} Type information at position
   */
  getTypeAtPosition(source, line, column) {
    // This is a simplified implementation
    // A full implementation would use the TypeScript language service

    const lines = source.split('\n');
    if (line >= lines.length) {
      return null;
    }

    const currentLine = lines[line];
    const wordMatch = currentLine.substring(0, column).match(/(\w+)$/);

    if (!wordMatch) {
      return null;
    }

    const word = wordMatch[1];

    // Check if it's a variable
    if (word.startsWith('$')) {
      return {
        kind: 'variable',
        name: word,
        type: 'unknown',
        documentation: 'MTM reactive variable'
      };
    }

    // Check if it's a component
    // This would need to be enhanced with actual AST analysis
    return {
      kind: 'unknown',
      name: word,
      type: 'unknown',
      documentation: 'Unknown identifier'
    };
  }
}

module.exports = { EnhancedMTMParser };