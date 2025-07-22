/**
 * Ultra-Modern MTM Processor
 * Simple processor for demonstrating the new ultra-modern MTM syntax
 */

import signal from './ultra-modern-signal.js';

class UltraModernMTMProcessor {
  constructor() {
    this.components = new Map();
    this.compiledComponents = new Map();
  }

  /**
   * Process MTM component with ultra-modern syntax
   */
  processComponent(name, mtmCode, framework = 'vanilla') {
    try {
      // Parse the ultra-modern MTM syntax
      const parsed = this.parseUltraModernSyntax(mtmCode);
      
      // Compile to target framework
      const compiled = this.compileToFramework(parsed, framework);
      
      // Store compiled component
      this.compiledComponents.set(name, {
        original: mtmCode,
        parsed,
        compiled,
        framework
      });
      
      return compiled;
    } catch (error) {
      console.error(`Error processing MTM component ${name}:`, error);
      return this.generateErrorComponent(name, error.message, framework);
    }
  }

  /**
   * Parse ultra-modern MTM syntax
   */
  parseUltraModernSyntax(code) {
    const parsed = {
      variables: [],
      functions: [],
      template: '',
      framework: 'vanilla'
    };

    // Extract framework from filename pattern in comments
    const frameworkMatch = code.match(/\/\/\s*(\w+)\.(\w+)\.mtm/);
    if (frameworkMatch) {
      parsed.framework = frameworkMatch[2];
    }

    // Extract reactive variables ($variable! = value)
    const reactiveVarRegex = /\$(\w+)!\s*=\s*([^;\n]+)/g;
    let match;
    while ((match = reactiveVarRegex.exec(code)) !== null) {
      parsed.variables.push({
        name: match[1],
        value: match[2].trim(),
        reactive: true
      });
    }

    // Extract non-reactive variables ($variable = value)
    const varRegex = /\$(\w+)\s*=\s*([^;\n]+)/g;
    while ((match = varRegex.exec(code)) !== null) {
      // Skip if already found as reactive
      if (!parsed.variables.find(v => v.name === match[1])) {
        parsed.variables.push({
          name: match[1],
          value: match[2].trim(),
          reactive: false
        });
      }
    }

    // Extract functions ($functionName = () => {...})
    const functionRegex = /\$(\w+)\s*=\s*(\([^)]*\)\s*=>\s*\{[^}]*\}|\([^)]*\)\s*=>\s*[^;\n]+)/g;
    while ((match = functionRegex.exec(code)) !== null) {
      parsed.functions.push({
        name: match[1],
        body: match[2].trim()
      });
    }

    // Extract template
    const templateMatch = code.match(/<template>([\s\S]*?)<\/template>/);
    if (templateMatch) {
      parsed.template = templateMatch[1].trim();
    }

    return parsed;
  }

  /**
   * Compile to target framework
   */
  compileToFramework(parsed, framework) {
    switch (framework) {
      case 'react':
        return this.compileToReact(parsed);
      case 'vue':
        return this.compileToVue(parsed);
      case 'svelte':
        return this.compileToSvelte(parsed);
      default:
        return this.compileToVanilla(parsed);
    }
  }

  /**
   * Compile to React
   */
  compileToReact(parsed) {
    let code = `import React, { useState, useCallback } from 'react';\n`;
    code += `import signal from '../shared/ultra-modern-signal.js';\n\n`;
    code += `export default function Component() {\n`;

    // Variables
    parsed.variables.forEach(variable => {
      if (variable.reactive) {
        if (variable.value.startsWith('signal(')) {
          code += `  const [${variable.name}, set${variable.name.charAt(0).toUpperCase() + variable.name.slice(1)}] = signal.use(${variable.value.match(/signal\('([^']+)'/)?.[1] || 'key'}, ${variable.value.match(/,\s*(.+)\)/)?.[1] || '0'});\n`;
        } else {
          code += `  const [${variable.name}, set${variable.name.charAt(0).toUpperCase() + variable.name.slice(1)}] = useState(${variable.value});\n`;
        }
      } else {
        code += `  const ${variable.name} = ${variable.value};\n`;
      }
    });

    // Functions
    parsed.functions.forEach(func => {
      let funcBody = func.body;
      // Replace $variable++ with setter calls
      parsed.variables.forEach(variable => {
        if (variable.reactive) {
          const setterName = `set${variable.name.charAt(0).toUpperCase() + variable.name.slice(1)}`;
          funcBody = funcBody.replace(new RegExp(`\\$${variable.name}\\+\\+`, 'g'), `${setterName}(prev => prev + 1)`);
          funcBody = funcBody.replace(new RegExp(`\\$${variable.name}\\s*=\\s*`, 'g'), `${setterName}(`);
          funcBody = funcBody.replace(new RegExp(`\\$${variable.name}(?!\\w)`, 'g'), variable.name);
        }
      });
      code += `  const ${func.name} = useCallback(${funcBody}, []);\n`;
    });

    // Template
    let template = parsed.template;
    // Replace {$variable} with {variable}
    parsed.variables.forEach(variable => {
      template = template.replace(new RegExp(`\\{\\$${variable.name}\\}`, 'g'), `{${variable.name}}`);
    });
    // Replace click={$function} with onClick={function}
    parsed.functions.forEach(func => {
      template = template.replace(new RegExp(`click=\\{\\$${func.name}\\}`, 'g'), `onClick={${func.name}}`);
    });
    // Replace class with className
    template = template.replace(/class=/g, 'className=');

    code += `\n  return (\n    ${template}\n  );\n`;
    code += `}\n`;

    return code;
  }

  /**
   * Compile to Vue
   */
  compileToVue(parsed) {
    let template = `<template>\n  ${parsed.template}\n</template>\n\n`;
    
    let script = `<script setup>\n`;
    script += `import { ref } from 'vue';\n`;
    script += `import signal from '../shared/ultra-modern-signal.js';\n\n`;

    // Variables
    parsed.variables.forEach(variable => {
      if (variable.reactive) {
        if (variable.value.startsWith('signal(')) {
          script += `const [${variable.name}, set${variable.name.charAt(0).toUpperCase() + variable.name.slice(1)}] = signal.use(${variable.value.match(/signal\('([^']+)'/)?.[1] || 'key'}, ${variable.value.match(/,\s*(.+)\)/)?.[1] || '0'});\n`;
        } else {
          script += `const ${variable.name} = ref(${variable.value});\n`;
        }
      } else {
        script += `const ${variable.name} = ${variable.value};\n`;
      }
    });

    // Functions
    parsed.functions.forEach(func => {
      let funcBody = func.body;
      // Replace $variable with variable.value for Vue refs
      parsed.variables.forEach(variable => {
        if (variable.reactive && !variable.value.startsWith('signal(')) {
          funcBody = funcBody.replace(new RegExp(`\\$${variable.name}\\+\\+`, 'g'), `${variable.name}.value++`);
          funcBody = funcBody.replace(new RegExp(`\\$${variable.name}(?!\\w)`, 'g'), `${variable.name}.value`);
        } else {
          funcBody = funcBody.replace(new RegExp(`\\$${variable.name}(?!\\w)`, 'g'), variable.name);
        }
      });
      script += `const ${func.name} = ${funcBody};\n`;
    });

    script += `</script>\n`;

    // Process template for Vue
    template = template.replace(/click=\{([^}]+)\}/g, '@click="$1"');
    parsed.variables.forEach(variable => {
      if (variable.reactive && !variable.value.startsWith('signal(')) {
        template = template.replace(new RegExp(`\\{\\$${variable.name}\\}`, 'g'), `{{ ${variable.name} }}`);
      } else {
        template = template.replace(new RegExp(`\\{\\$${variable.name}\\}`, 'g'), `{{ ${variable.name} }}`);
      }
    });

    return template + script;
  }

  /**
   * Compile to Svelte
   */
  compileToSvelte(parsed) {
    let script = `<script>\n`;
    script += `import signal from '../shared/ultra-modern-signal.js';\n\n`;

    // Variables
    parsed.variables.forEach(variable => {
      if (variable.reactive) {
        if (variable.value.startsWith('signal(')) {
          script += `const [${variable.name}, set${variable.name.charAt(0).toUpperCase() + variable.name.slice(1)}] = signal.use(${variable.value.match(/signal\('([^']+)'/)?.[1] || 'key'}, ${variable.value.match(/,\s*(.+)\)/)?.[1] || '0'});\n`;
        } else {
          script += `let ${variable.name} = ${variable.value};\n`;
        }
      } else {
        script += `const ${variable.name} = ${variable.value};\n`;
      }
    });

    // Functions
    parsed.functions.forEach(func => {
      let funcBody = func.body;
      // Replace $variable with variable for Svelte
      parsed.variables.forEach(variable => {
        funcBody = funcBody.replace(new RegExp(`\\$${variable.name}(?!\\w)`, 'g'), variable.name);
      });
      script += `const ${func.name} = ${funcBody};\n`;
    });

    script += `</script>\n\n`;

    // Template
    let template = parsed.template;
    // Replace {$variable} with {variable}
    parsed.variables.forEach(variable => {
      template = template.replace(new RegExp(`\\{\\$${variable.name}\\}`, 'g'), `{${variable.name}}`);
    });
    // Replace click={$function} with on:click={function}
    parsed.functions.forEach(func => {
      template = template.replace(new RegExp(`click=\\{\\$${func.name}\\}`, 'g'), `on:click={${func.name}}`);
    });

    return script + template;
  }

  /**
   * Compile to Vanilla JavaScript
   */
  compileToVanilla(parsed) {
    let code = `import signal from '../shared/ultra-modern-signal.js';\n\n`;
    code += `export default function Component() {\n`;

    // Variables
    parsed.variables.forEach(variable => {
      if (variable.reactive) {
        if (variable.value.startsWith('signal(')) {
          code += `  const [${variable.name}, set${variable.name.charAt(0).toUpperCase() + variable.name.slice(1)}] = signal.use(${variable.value.match(/signal\('([^']+)'/)?.[1] || 'key'}, ${variable.value.match(/,\s*(.+)\)/)?.[1] || '0'});\n`;
        } else {
          code += `  let ${variable.name} = ${variable.value};\n`;
        }
      } else {
        code += `  const ${variable.name} = ${variable.value};\n`;
      }
    });

    // Functions
    parsed.functions.forEach(func => {
      let funcBody = func.body;
      parsed.variables.forEach(variable => {
        funcBody = funcBody.replace(new RegExp(`\\$${variable.name}(?!\\w)`, 'g'), variable.name);
      });
      code += `  const ${func.name} = ${funcBody};\n`;
    });

    // Create DOM element
    code += `\n  const element = document.createElement('div');\n`;
    
    // Simple template processing
    let template = parsed.template;
    parsed.variables.forEach(variable => {
      template = template.replace(new RegExp(`\\{\\$${variable.name}\\}`, 'g'), `\${${variable.name}}`);
    });
    
    code += `  element.innerHTML = \`${template}\`;\n`;

    // Add event listeners
    parsed.functions.forEach(func => {
      code += `  element.addEventListener('click', ${func.name});\n`;
    });

    code += `\n  return element;\n`;
    code += `}\n`;

    return code;
  }

  /**
   * Generate error component
   */
  generateErrorComponent(name, error, framework) {
    const errorMessage = `Error in ${name}: ${error}`;
    
    switch (framework) {
      case 'react':
        return `
import React from 'react';
export default function ErrorComponent() {
  return React.createElement('div', { style: { color: 'red', padding: '20px' } }, '${errorMessage}');
}`;
      case 'vue':
        return `
<template>
  <div style="color: red; padding: 20px;">${errorMessage}</div>
</template>`;
      case 'svelte':
        return `<div style="color: red; padding: 20px;">${errorMessage}</div>`;
      default:
        return `
export default function ErrorComponent() {
  const element = document.createElement('div');
  element.style.color = 'red';
  element.style.padding = '20px';
  element.textContent = '${errorMessage}';
  return element;
}`;
    }
  }

  /**
   * Get compiled component
   */
  getCompiledComponent(name) {
    return this.compiledComponents.get(name);
  }

  /**
   * List all components
   */
  listComponents() {
    return Array.from(this.compiledComponents.keys());
  }
}

// Create global processor instance
const processor = new UltraModernMTMProcessor();

export { processor, UltraModernMTMProcessor };
export default processor;