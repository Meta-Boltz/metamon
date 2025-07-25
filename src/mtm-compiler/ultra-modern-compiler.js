// Ultra-Modern MTM Compiler - Following ULTRA_MODERN_MTM.md specification
const fs = require('fs');
const path = require('path');

class UltraModernMTMCompiler {
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

      // Skip export line and closing braces
      if (line.startsWith('export default function') || line === '}') continue;

      // Parse reactive variables: $var! = signal('key', value) or $var! = value
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
    // Replace {$var} with spans that have data-bind attributes
    let processed = template.replace(/\{(\$\w+)\}/g, '<span data-bind="$1">Loading...</span>');

    // Handle conditional rendering {#if condition}...{/if}
    processed = processed.replace(/\{#if\s+([^}]+)\}([\s\S]*?)\{\/if\}/g, (match, condition, content) => {
      const conditionVar = condition.replace(/\$/g, '').replace(/[^a-zA-Z0-9_]/g, '_');
      return `<div data-if="${condition}" data-condition-id="${conditionVar}" style="display: none;">${content}</div>`;
    });

    // Replace click={$func} with proper data attributes
    processed = processed.replace(/click=\{(\$\w+)\}/g, 'data-click="$1"');

    // Replace other event handlers
    processed = processed.replace(/(\w+)=\{(\$\w+)\}/g, 'data-event-$1="$2"');

    return processed;
  }

  generateScript(componentName, parsed) {
    let script = `
// Ultra-Modern MTM Signal System
const signal = {
  _signals: new Map(),
  _subscribers: new Map(),
  
  create(key, initialValue) {
    if (!this._signals.has(key)) {
      this._signals.set(key, initialValue);
      this._subscribers.set(key, new Set());
    }
    
    return {
      get value() {
        return signal._signals.get(key);
      },
      set value(newValue) {
        signal._signals.set(key, newValue);
        signal._notifySubscribers(key, newValue);
      },
      subscribe(callback) {
        signal._subscribers.get(key).add(callback);
      }
    };
  },
  
  _notifySubscribers(key, value) {
    if (this._subscribers.has(key)) {
      this._subscribers.get(key).forEach(callback => callback(value));
    }
  },
  
  emit(event, data) {
    console.log('Signal emitted:', event, data);
    window.dispatchEvent(new CustomEvent(event, { detail: data }));
  },
  
  on(event, callback) {
    window.addEventListener(event, (e) => callback(e.detail));
  }
};

// Global signal function
window.signal = signal;

// Component: ${componentName}
function ${componentName}() {
  // Variables
`;

    // Generate variables with proper signal handling
    for (const variable of parsed.variables) {
      if (variable.value.includes('signal(')) {
        // Handle signal('key', value) syntax
        const signalMatch = variable.value.match(/signal\s*\(\s*['"]([^'"]+)['"]\s*,\s*(.+)\s*\)/);
        if (signalMatch) {
          const key = signalMatch[1];
          const initialValue = signalMatch[2];
          script += `  const $${variable.name} = signal.create('${key}', ${initialValue});\n`;
        }
      } else {
        // Handle simple values
        script += `  const $${variable.name} = signal.create('${variable.name}', ${variable.value});\n`;
      }
    }

    script += '\n  // Functions\n';

    // Generate functions with proper variable replacement
    for (const func of parsed.functions) {
      script += `  const $${func.name} = () => {\n`;

      // Replace $variableName with $variableName.value in function body
      let functionBody = func.body;
      for (const variable of parsed.variables) {
        // Replace standalone $variable with $variable.value
        const regex = new RegExp(`\\$${variable.name}(?!\\.)\\b`, 'g');
        functionBody = functionBody.replace(regex, `$${variable.name}.value`);
      }

      script += `    ${functionBody}\n`;
      script += `  };\n\n`;
    }

    script += `
  // DOM bindings and updates
  const container = document.getElementById('app');
  
  // Function to update all bindings
  const updateBindings = () => {
    // Update data-bind elements
`;

    for (const variable of parsed.variables) {
      script += `    container.querySelectorAll('[data-bind="$${variable.name}"]').forEach(el => {
      el.textContent = $${variable.name}.value;
    });
    
`;
    }

    script += `    // Update conditional rendering
    container.querySelectorAll('[data-if]').forEach(el => {
      const condition = el.getAttribute('data-if');
      let shouldShow = false;
      
      try {
        // Evaluate condition with current variable values
        const evalCondition = condition`;

    // Replace variables in conditions
    for (const variable of parsed.variables) {
      script += `.replace(/\\$${variable.name}/g, '$${variable.name}.value')`;
    }

    script += `;
        shouldShow = eval(evalCondition);
      } catch (e) {
        console.warn('Condition evaluation failed:', condition, e);
      }
      
      el.style.display = shouldShow ? 'block' : 'none';
    });
  };
  
  // Initial update
  updateBindings();
  
  // Subscribe to variable changes
`;

    for (const variable of parsed.variables) {
      script += `  $${variable.name}.subscribe(() => updateBindings());
`;
    }

    script += `
  // Bind event handlers
`;

    for (const func of parsed.functions) {
      script += `  container.querySelectorAll('[data-click="$${func.name}"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      $${func.name}();
    });
  });
  
`;
    }

    script += `}

// Initialize component
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
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        
        .primitive-app {
            max-width: 100%;
        }
        
        .header {
            text-align: center;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 2px solid #667eea;
        }
        
        .header h1 {
            color: #2c3e50;
            margin-bottom: 0.5rem;
        }
        
        .status {
            color: #666;
            font-style: italic;
            background: #f8f9ff;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            border: 1px solid #667eea;
        }
        
        .navigation {
            display: flex;
            gap: 1rem;
            align-items: center;
            margin-bottom: 2rem;
            padding: 1rem;
            background: #f8f9ff;
            border-radius: 8px;
            border: 1px solid #667eea;
        }
        
        .nav-btn {
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            padding: 0.5rem 1rem;
            cursor: pointer;
            font-weight: 600;
            transition: background 0.2s;
        }
        
        .nav-btn:hover {
            background: #5a6fd8;
        }
        
        .current-page {
            margin-left: auto;
            font-weight: bold;
            color: #2c3e50;
        }
        
        .content {
            min-height: 300px;
        }
        
        .content h2 {
            color: #2c3e50;
            border-bottom: 1px solid #eee;
            padding-bottom: 0.5rem;
        }
        
        .counter-section {
            background: #f8f9ff;
            padding: 1.5rem;
            border-radius: 8px;
            border: 1px solid #667eea;
            margin: 1rem 0;
        }
        
        .counter-display {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            margin: 1rem 0;
        }
        
        .counter-display button {
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            padding: 0.75rem 1rem;
            cursor: pointer;
            font-weight: 600;
            font-size: 1.2rem;
            min-width: 50px;
            transition: background 0.2s;
        }
        
        .counter-display button:hover {
            background: #5a6fd8;
        }
        
        .count {
            font-size: 2rem;
            font-weight: bold;
            color: #2c3e50;
            min-width: 80px;
            text-align: center;
            padding: 0.5rem;
            background: white;
            border-radius: 6px;
            border: 2px solid #667eea;
        }
        
        .reset-btn {
            background: #e74c3c !important;
        }
        
        .reset-btn:hover {
            background: #c0392b !important;
        }
        
        .home-content, .about-content, .contact-content {
            padding: 1.5rem;
            background: #f9f9f9;
            border-radius: 8px;
            margin: 1rem 0;
        }
        
        .about-content ul {
            list-style: none;
            padding: 0;
        }
        
        .about-content li {
            padding: 0.5rem 0;
            border-bottom: 1px solid #eee;
        }
        
        .contact-info {
            background: white;
            padding: 1rem;
            border-radius: 6px;
            border: 1px solid #ddd;
        }
        
        .footer {
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid #eee;
            text-align: center;
            color: #666;
            font-size: 0.9rem;
        }
    `;
  }
}

module.exports = { UltraModernMTMCompiler };