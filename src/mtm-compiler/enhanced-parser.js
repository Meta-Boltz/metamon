// Enhanced MTM Parser - Extends MTM parser with frontmatter and import support
const { MTMParser } = require('./parser.js');

class EnhancedMTMParser extends MTMParser {
  constructor() {
    super();
    this.frontmatter = {};
    this.imports = [];
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

  // Utility method to resolve component paths
  resolveComponentPath(importPath, basePath = '') {
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
  validateFrontmatter(frontmatter) {
    const errors = [];

    // Validate route format
    if (frontmatter.route && !frontmatter.route.startsWith('/')) {
      errors.push({
        type: 'frontmatter-validation',
        message: 'Route must start with "/"',
        field: 'route',
        value: frontmatter.route
      });
    }

    // Validate compileJsMode
    if (frontmatter.compileJsMode) {
      const validModes = ['inline', 'external.js'];
      const isValidCustomMode = frontmatter.compileJsMode.endsWith('.js');

      if (!validModes.includes(frontmatter.compileJsMode) && !isValidCustomMode) {
        errors.push({
          type: 'frontmatter-validation',
          message: 'compileJsMode must be "inline", "external.js", or end with ".js"',
          field: 'compileJsMode',
          value: frontmatter.compileJsMode
        });
      }
    }

    return errors;
  }
}

module.exports = { EnhancedMTMParser };