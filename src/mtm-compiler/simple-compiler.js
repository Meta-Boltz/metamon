// Simple MTM Compiler - Working version
const fs = require('fs');
const path = require('path');

class SimpleMTMCompiler {
  compile(inputFile) {
    const source = fs.readFileSync(inputFile, 'utf8');
    const filename = path.basename(inputFile);

    // Detect framework
    const framework = this.detectFramework(filename);

    // Extract component name
    const componentName = this.extractComponentName(source) || 'Component';

    // Generate HTML
    const html = this.generateHTML(source, componentName);

    return html;
  }

  detectFramework(filename) {
    if (filename.includes('.react.mtm')) return 'react';
    if (filename.includes('.vue.mtm')) return 'vue';
    if (filename.includes('.svelte.mtm')) return 'svelte';
    if (filename.includes('.solid.mtm')) return 'solid';
    return 'html';
  }

  extractComponentName(source) {
    const match = source.match(/export default function (\w+)/);
    return match ? match[1] : 'Component';
  }

  generateHTML(source, componentName) {
    // Extract template content
    const templateMatch = source.match(/<template>([\s\S]*?)<\/template>/);
    const templateContent = templateMatch ? templateMatch[1].trim() : '<div>No template found</div>';

    // Extract reactive variables
    const reactiveVars = this.extractReactiveVariables(source);

    // Extract functions
    const functions = this.extractFunctions(source);

    // Generate complete HTML
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${componentName}</title>
    <style>
        ${this.getCSS()}
    </style>
</head>
<body>
    <div id="app">
        ${this.processTemplate(templateContent)}
    </div>
    
    <script>
        ${this.getSignalSystem()}
        
        // Component: ${componentName}
        function ${componentName}() {
            ${this.generateVariables(reactiveVars)}
            
            ${this.generateFunctions(functions)}
            
            ${this.generateBindings(templateContent, reactiveVars, functions)}
        }
        
        // Initialize component
        document.addEventListener('DOMContentLoaded', () => {
            ${componentName}();
        });
    </script>
</body>
</html>`;
  }

  extractReactiveVariables(source) {
    const vars = [];
    const lines = source.split('\n');

    for (const line of lines) {
      // Reactive variables: $var! = value
      const reactiveMatch = line.match(/\s*\$(\w+)!\s*=\s*(.+)/);
      if (reactiveMatch) {
        vars.push({
          name: reactiveMatch[1],
          value: reactiveMatch[2].trim(),
          type: 'reactive'
        });
        continue;
      }

      // Computed variables: $var = expression
      const computedMatch = line.match(/\s*\$(\w+)\s*=\s*(.+)/);
      if (computedMatch && !reactiveMatch) {
        vars.push({
          name: computedMatch[1],
          value: computedMatch[2].trim(),
          type: 'computed'
        });
      }
    }

    return vars;
  }

  extractFunctions(source) {
    const functions = [];
    const lines = source.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const functionMatch = line.match(/\s*\$(\w+)\s*=\s*\([^)]*\)\s*=>\s*\{?/);

      if (functionMatch) {
        const functionName = functionMatch[1];
        let functionBody = '';

        // Simple function body extraction
        if (line.includes('=>') && !line.includes('{')) {
          // Single line arrow function
          const arrowIndex = line.indexOf('=>');
          functionBody = line.substring(arrowIndex + 2).trim();
        } else {
          // Multi-line function - find the body
          let j = i;
          let braceCount = 0;
          let foundStart = false;

          while (j < lines.length) {
            const currentLine = lines[j];

            for (const char of currentLine) {
              if (char === '{') {
                braceCount++;
                foundStart = true;
              } else if (char === '}') {
                braceCount--;
              }
            }

            if (foundStart) {
              functionBody += currentLine + '\n';
            }

            if (foundStart && braceCount === 0) {
              break;
            }

            j++;
          }

          // Clean up function body
          functionBody = functionBody.trim();
          if (functionBody.startsWith('{') && functionBody.endsWith('}')) {
            functionBody = functionBody.slice(1, -1).trim();
          }

          i = j; // Skip processed lines
        }

        functions.push({
          name: functionName,
          body: functionBody
        });
      }
    }

    return functions;
  }

  processTemplate(template) {
    // Replace MTM interpolations with spans
    let processed = template.replace(/\{(\$\w+)\}/g, '<span data-bind="$1"></span>');

    // Handle event bindings
    processed = processed.replace(/(\w+)=\{(\$\w+)\}/g, 'data-event-$1="$2"');

    // Handle class bindings
    processed = processed.replace(/class:(\w+)=\{(\$\w+)\}/g, 'data-class="$1:$2"');

    // Handle conditionals
    processed = processed.replace(/\{#if\s+(\$\w+)\}([\s\S]*?)\{\/if\}/g,
      '<div data-if="$1" style="display: none;">$2</div>');

    return processed;
  }

  generateVariables(vars) {
    let code = '';

    for (const variable of vars) {
      if (variable.type === 'reactive') {
        // Handle signal calls
        if (variable.value.includes('signal(')) {
          code += `    const $${variable.name} = ${variable.value};\n`;
        } else {
          code += `    const $${variable.name} = signal('${variable.name}', ${variable.value});\n`;
        }
      } else {
        code += `    let $${variable.name};\n`;
        code += `    const update${variable.name} = () => { $${variable.name} = ${variable.value}; };\n`;
      }
    }

    return code;
  }

  generateFunctions(functions) {
    let code = '';

    for (const func of functions) {
      code += `    const $${func.name} = () => {\n`;
      code += `        ${func.body.replace(/\$(\w+)/g, '$$$$1.value')}\n`;
      code += `    };\n\n`;
    }

    return code;
  }

  generateBindings(template, vars, functions) {
    let code = `    // Set up DOM bindings\n`;
    code += `    const container = document.getElementById('app');\n\n`;

    // Bind reactive variables
    for (const variable of vars) {
      if (variable.type === 'reactive') {
        code += `    // Bind $${variable.name}\n`;
        code += `    container.querySelectorAll('[data-bind="$${variable.name}"]').forEach(el => {\n`;
        code += `        const updateEl = () => el.textContent = $${variable.name}.value;\n`;
        code += `        updateEl();\n`;
        code += `        $${variable.name}.subscribe = $${variable.name}.subscribe || [];\n`;
        code += `        $${variable.name}.subscribe.push(updateEl);\n`;
        code += `    });\n\n`;
      }
    }

    // Bind event handlers
    for (const func of functions) {
      code += `    // Bind $${func.name} events\n`;
      code += `    container.querySelectorAll('[data-event-click="$${func.name}"]').forEach(el => {\n`;
      code += `        el.addEventListener('click', $${func.name});\n`;
      code += `    });\n\n`;
    }

    // Handle conditionals
    code += `    // Handle conditional rendering\n`;
    code += `    const updateConditionals = () => {\n`;
    for (const variable of vars) {
      if (variable.type === 'reactive') {
        code += `        container.querySelectorAll('[data-if="$${variable.name}"]').forEach(el => {\n`;
        code += `            el.style.display = $${variable.name}.value ? 'block' : 'none';\n`;
        code += `        });\n`;
      }
    }
    code += `    };\n`;
    code += `    updateConditionals();\n\n`;

    // Set up reactive updates
    for (const variable of vars) {
      if (variable.type === 'reactive') {
        code += `    // Subscribe to $${variable.name} changes\n`;
        code += `    const original${variable.name}Value = $${variable.name}.value;\n`;
        code += `    Object.defineProperty($${variable.name}, 'value', {\n`;
        code += `        get() { return this._value; },\n`;
        code += `        set(newValue) {\n`;
        code += `            this._value = newValue;\n`;
        code += `            if (this.subscribe) this.subscribe.forEach(fn => fn());\n`;
        code += `            updateConditionals();\n`;
        code += `        }\n`;
        code += `    });\n`;
        code += `    $${variable.name}.value = original${variable.name}Value;\n\n`;
      }
    }

    return code;
  }

  getSignalSystem() {
    return `
        // Simple Signal System
        function signal(key, initialValue) {
            const signalObj = {
                _value: initialValue,
                subscribe: [],
                get value() { return this._value; },
                set value(newValue) {
                    this._value = newValue;
                    this.subscribe.forEach(fn => fn());
                }
            };
            
            // Global signal storage
            window.signals = window.signals || {};
            if (window.signals[key]) {
                return window.signals[key];
            }
            window.signals[key] = signalObj;
            return signalObj;
        }
        
        function emit(event, data) {
            console.log('Event:', event, data);
            // Simple event system
            window.dispatchEvent(new CustomEvent(event, { detail: data }));
        }
    `;
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
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        
        .counter {
            max-width: 400px;
            margin: 2rem auto;
            padding: 2rem;
            border: 2px solid #667eea;
            border-radius: 12px;
            background: #f8f9ff;
            text-align: center;
        }
        
        .counter h3 {
            color: #2c3e50;
            margin-bottom: 1.5rem;
        }
        
        .counter-display {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            margin: 1.5rem 0;
        }
        
        .counter button {
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            padding: 0.5rem 1rem;
            cursor: pointer;
            font-weight: 600;
            min-width: 40px;
        }
        
        .counter button:hover:not(:disabled) {
            background: #5a6fd8;
        }
        
        .counter button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        
        .count {
            font-size: 1.5rem;
            font-weight: bold;
            color: #2c3e50;
            min-width: 100px;
        }
        
        .count.high {
            color: #e74c3c;
        }
        
        .warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 0.5rem;
            border-radius: 4px;
            margin: 1rem 0;
        }
        
        .reset-btn {
            background: #e74c3c !important;
            margin-top: 1rem;
        }
        
        .reset-btn:hover {
            background: #c0392b !important;
        }
        
        .actions {
            margin-top: 1rem;
        }
        
        small {
            display: block;
            margin-top: 1rem;
            color: #666;
            font-style: italic;
        }
    `;
  }
}

module.exports = { SimpleMTMCompiler };