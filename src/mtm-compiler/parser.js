// MTM Parser - Converts MTM syntax to AST
class MTMParser {
  constructor() {
    this.tokens = [];
    this.current = 0;
  }

  parse(source, filename = 'unknown.mtm') {
    this.tokens = this.tokenize(source);
    this.current = 0;

    const framework = this.detectFramework(filename);
    const ast = this.parseComponent(framework);

    return ast;
  }

  detectFramework(filename) {
    if (filename.includes('.react.mtm')) return 'react';
    if (filename.includes('.vue.mtm')) return 'vue';
    if (filename.includes('.svelte.mtm')) return 'svelte';
    if (filename.includes('.solid.mtm')) return 'solid';
    if (filename.endsWith('.mtm')) return 'html';
    return 'html'; // Default to pure HTML/JS
  }

  tokenize(source) {
    const tokens = [];
    const lines = source.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip comments and empty lines
      if (line.trim().startsWith('//') || line.trim() === '') continue;

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

      // Parse computed variables: $variable = expression
      const computedMatch = line.match(/\s*\$(\w+)\s*=\s*(.+)/);
      if (computedMatch && !reactiveMatch) {
        tokens.push({
          type: 'COMPUTED_VARIABLE',
          name: computedMatch[1],
          value: computedMatch[2].trim(),
          line: i + 1
        });
        continue;
      }

      // Parse functions: $function = () => { ... }
      const functionMatch = line.match(/\s*\$(\w+)\s*=\s*(\([^)]*\))\s*=>\s*\{?/);
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

  extractFunctionBody(lines, startLine) {
    let braceCount = 0;
    let body = '';
    let i = startLine;
    let foundOpenBrace = false;

    while (i < lines.length) {
      const line = lines[i];

      for (const char of line) {
        if (char === '{') {
          braceCount++;
          foundOpenBrace = true;
        } else if (char === '}') {
          braceCount--;
        }
      }

      if (foundOpenBrace) {
        body += line + '\n';
      }

      if (foundOpenBrace && braceCount === 0) {
        break;
      }

      i++;
    }

    return {
      body: body.trim(),
      endLine: i
    };
  }

  extractTemplate(lines, startLine) {
    let content = '';
    let i = startLine + 1;

    while (i < lines.length && lines[i].trim() !== '</template>') {
      content += lines[i] + '\n';
      i++;
    }

    return {
      content: content.trim(),
      endLine: i
    };
  }

  parseComponent(framework) {
    const ast = {
      type: 'COMPONENT',
      framework,
      name: 'Component',
      variables: [],
      functions: [],
      template: null
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
      }
    }

    return ast;
  }
}

module.exports = { MTMParser };