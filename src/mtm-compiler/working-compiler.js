// Working MTM Compiler - Simplified and functional
const fs = require('fs');
const path = require('path');

class WorkingMTMCompiler {
  compile(inputFile) {
    const source = fs.readFileSync(inputFile, 'utf8');
    const filename = path.basename(inputFile);

    // Extract component name
    const componentName = this.extractComponentName(source) || 'Component';

    // Parse the MTM source
    const parsed = this.parseSource(source);

    // Generate HTML
    const html = this.generateHTML(componentName, parsed);

    return html;
  }

  extractComponentName(source) {
    const match = source.match(/export default function (\w+)/);
    return match ? match[1] : 'Component';
  }

  parseSource(source) {
    const lines = source.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('//'));

    const result = {
      variables: [],
      functions: [],
      template: ''
    };

    let inTemplate = false;
    let templateContent = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Template parsing
      if (line === '<template>') {
        inTemplate = true;
        continue;
      }
      if (line === '</template>') {
        inTemplate = false;
        result.template = templateContent.trim();
        continue;
      }
      if (inTemplate) {
        templateContent += line + '\n';
        continue;
      }

      // Skip export line
      if (line.startsWith('export default function')) continue;
      if (line === '}') continue;

      // Parse reactive variables: $var! = value
      const reactiveMatch = line.match(/^\$(\w+)!\s*=\s*(.+)$/);
      if (reactiveMatch) {
        result.variables.push({
          name: reactiveMatch[1],
          value: reactiveMatch[2],
          type: 'reactive'
        });
        continue;
      }

      // Parse functions: $func = () => { ... }
      const functionMatch = line.match(/^\$(\w+)\s*=\s*\(\)\s*=>\s*\{$/);
      if (functionMatch) {
        const functionName = functionMatch[1];
        let functionBody = '';

        // Get function body
        i++; // Move to next line
        while (i < lines.length && lines[i] !== '}') {
          functionBody += lines[i] + '\n';
          i++;
        }

        result.functions.push({
          name: functionName,
          body: functionBody.trim()
        });
        continue;
      }
    }

    return result;
  }

  generateHTML(componentName, parsed) {
    const template = this.processTemplate(parsed.template);
    const script = this.generateScript(componentName, parsed);

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
        ${template}
    </div>
    
    <script>
        ${script}
    </script>
</body>
</html>`;
  }

  processTemplate(template) {
    // Replace {$var} with data-bind attributes
    let processed = template.replace(/\{(\$\w+)\}/g, '<span data-bind="$1">0</span>');

    // Replace click={$func} with data-click attributes
    processed = processed.replace(/click=\{(\$\w+)\}/g, 'data-click="$1"');

    return processed;
  }

  generateScript(componentName, parsed) {
    let script = `
// Simple reactive system
const reactive = (initialValue) => {
  let value = initialValue;
  const subscribers = [];
  
  return {
    get value() { return value; },
    set value(newValue) {
      value = newValue;
      subscribers.forEach(fn => fn(newValue));
    },
    subscribe(fn) { subscribers.push(fn); }
  };
};

// Component: ${componentName}
function ${componentName}() {
  // Variables
`;

    // Generate variables
    for (const variable of parsed.variables) {
      script += `  const $${variable.name} = reactive(${variable.value});\n`;
    }

    script += '\n  // Functions\n';

    // Generate functions
    for (const func of parsed.functions) {
      script += `  const $${func.name} = () => {\n`;
      script += `    ${func.body.replace(/\$(\w+)/g, '$$$$1.value')}\n`;
      script += `  };\n\n`;
    }

    script += `
  // DOM bindings
  const container = document.getElementById('app');
  
  // Bind variables to DOM
`;

    for (const variable of parsed.variables) {
      script += `  container.querySelectorAll('[data-bind="$${variable.name}"]').forEach(el => {
    const update = () => el.textContent = $${variable.name}.value;
    update();
    $${variable.name}.subscribe(update);
  });
  
`;
    }

    script += '  // Bind event handlers\n';

    for (const func of parsed.functions) {
      script += `  container.querySelectorAll('[data-click="$${func.name}"]').forEach(el => {
    el.addEventListener('click', $${func.name});
  });
  
`;
    }

    script += `}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  ${componentName}();
});`;

    return script;
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
            text-align: center;
            padding: 2rem;
            border: 2px solid #667eea;
            border-radius: 12px;
            background: #f8f9ff;
            max-width: 400px;
            margin: 0 auto;
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
            padding: 0.75rem 1rem;
            cursor: pointer;
            font-weight: 600;
            font-size: 1.2rem;
            min-width: 50px;
        }
        
        .counter button:hover {
            background: #5a6fd8;
        }
        
        .count {
            font-size: 2rem;
            font-weight: bold;
            color: #2c3e50;
            min-width: 80px;
            padding: 0.5rem;
            background: white;
            border-radius: 6px;
            border: 2px solid #667eea;
        }
        
        .counter p {
            color: #666;
            font-style: italic;
            margin-top: 1.5rem;
        }
    `;
  }
}

module.exports = { WorkingMTMCompiler };