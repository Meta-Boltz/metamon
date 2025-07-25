// HTML Generator - Compiles MTM to Pure HTML/JS (PHP/Next.js style)
class HTMLGenerator {
  constructor() {
    this.signalSystem = `
// MTM Signal System for Pure HTML/JS
class MTMSignal {
  constructor() {
    this.signals = new Map();
    this.subscribers = new Map();
  }
  
  signal(key, initialValue) {
    if (!this.signals.has(key)) {
      this.signals.set(key, initialValue);
      this.subscribers.set(key, new Set());
    }
    
    return {
      get value() {
        return window.mtm.signals.get(key);
      },
      set value(newValue) {
        window.mtm.signals.set(key, newValue);
        window.mtm.notifySubscribers(key, newValue);
      }
    };
  }
  
  emit(event, data) {
    const eventKey = \`event:\${event}\`;
    this.notifySubscribers(eventKey, data);
  }
  
  on(event, callback) {
    const eventKey = \`event:\${event}\`;
    if (!this.subscribers.has(eventKey)) {
      this.subscribers.set(eventKey, new Set());
    }
    this.subscribers.get(eventKey).add(callback);
  }
  
  notifySubscribers(key, value) {
    if (this.subscribers.has(key)) {
      this.subscribers.get(key).forEach(callback => callback(value));
    }
  }
  
  subscribe(key, element, property) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    
    const updateElement = (value) => {
      if (property === 'textContent') {
        element.textContent = value;
      } else if (property === 'innerHTML') {
        element.innerHTML = value;
      } else if (property.startsWith('class:')) {
        const className = property.split(':')[1];
        element.classList.toggle(className, value);
      } else {
        element.setAttribute(property, value);
      }
    };
    
    this.subscribers.get(key).add(updateElement);
    updateElement(this.signals.get(key)); // Initial update
  }
}

// Initialize global MTM instance
window.mtm = new MTMSignal();
window.signal = (key, initialValue) => window.mtm.signal(key, initialValue);
window.emit = (event, data) => window.mtm.emit(event, data);
`;
  }

  generate(ast) {
    const componentName = ast.name;
    const htmlContent = this.generateHTML(ast);
    const jsContent = this.generateJavaScript(ast);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${componentName}</title>
    <style>
        ${this.generateCSS()}
    </style>
</head>
<body>
    <div id="app">
        ${htmlContent}
    </div>
    
    <script>
        ${this.signalSystem}
        
        ${jsContent}
        
        // Initialize component
        document.addEventListener('DOMContentLoaded', () => {
            ${componentName}();
        });
    </script>
</body>
</html>`;
  }

  generateHTML(ast) {
    if (!ast.template) return '<div>No template found</div>';

    let html = ast.template.content;

    // Replace MTM template syntax with HTML + data attributes
    html = html.replace(/\{([^}]+)\}/g, (match, expression) => {
      if (expression.startsWith('$')) {
        const varName = expression.substring(1);
        return `<span data-mtm-bind="${varName}"></span>`;
      }
      return match;
    });

    // Handle conditionals {#if condition}
    html = html.replace(/\{#if\s+([^}]+)\}([\s\S]*?)\{\/if\}/g, (match, condition, content) => {
      const conditionVar = condition.replace('$', '');
      return `<div data-mtm-if="${conditionVar}" style="display: none;">${content}</div>`;
    });

    // Handle event bindings click={$handler}
    html = html.replace(/(\w+)=\{(\$\w+)\}/g, (match, event, handler) => {
      const handlerName = handler.substring(1);
      return `data-mtm-${event}="${handlerName}"`;
    });

    // Handle class bindings class:name={condition}
    html = html.replace(/class:(\w+)=\{([^}]+)\}/g, (match, className, condition) => {
      const conditionVar = condition.replace('$', '');
      return `data-mtm-class="${className}:${conditionVar}"`;
    });

    return html;
  }

  generateJavaScript(ast) {
    let js = `function ${ast.name}() {\n`;

    // Generate reactive variables
    for (const variable of ast.variables) {
      if (variable.type === 'reactive') {
        js += `  const $${variable.name} = signal('${variable.name}', ${variable.value});\n`;
      } else {
        js += `  let $${variable.name} = ${variable.value};\n`;
      }
    }

    js += '\n';

    // Generate functions
    for (const func of ast.functions) {
      js += `  const $${func.name} = ${func.params} => {\n`;
      js += `    ${func.body.replace(/\$(\w+)/g, '$$$$1.value')}\n`;
      js += `  };\n\n`;
    }

    // Generate DOM bindings
    js += `  // Set up DOM bindings\n`;
    js += `  const container = document.getElementById('app');\n\n`;

    // Bind reactive variables to DOM elements
    for (const variable of ast.variables) {
      if (variable.type === 'reactive') {
        js += `  container.querySelectorAll('[data-mtm-bind="${variable.name}"]').forEach(el => {\n`;
        js += `    mtm.subscribe('${variable.name}', el, 'textContent');\n`;
        js += `  });\n`;
      }
    }

    // Bind event handlers
    for (const func of ast.functions) {
      js += `  container.querySelectorAll('[data-mtm-click="${func.name}"]').forEach(el => {\n`;
      js += `    el.addEventListener('click', $${func.name});\n`;
      js += `  });\n`;
    }

    // Handle conditional rendering
    js += `\n  // Handle conditional rendering\n`;
    js += `  const updateConditionals = () => {\n`;
    for (const variable of ast.variables) {
      js += `    container.querySelectorAll('[data-mtm-if="${variable.name}"]').forEach(el => {\n`;
      js += `      el.style.display = $${variable.name}.value ? 'block' : 'none';\n`;
      js += `    });\n`;
    }
    js += `  };\n`;
    js += `  updateConditionals();\n`;

    // Subscribe to variable changes for conditional updates
    for (const variable of ast.variables) {
      if (variable.type === 'reactive') {
        js += `  mtm.subscribe('${variable.name}', null, updateConditionals);\n`;
      }
    }

    js += `}\n`;

    return js;
  }

  generateCSS() {
    return `
      .counter {
        max-width: 400px;
        margin: 2rem auto;
        padding: 2rem;
        border: 2px solid #667eea;
        border-radius: 12px;
        background: #f8f9ff;
        text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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
      }
      
      .reset-btn:hover {
        background: #c0392b !important;
      }
      
      .contact-form-container {
        max-width: 500px;
        margin: 2rem auto;
        padding: 2rem;
        border: 1px solid #ddd;
        border-radius: 8px;
        background: white;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      
      .form-group {
        margin-bottom: 1.5rem;
      }
      
      .form-group label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 600;
        color: #333;
      }
      
      .form-group input,
      .form-group textarea {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 1rem;
        box-sizing: border-box;
      }
      
      .form-group input.invalid,
      .form-group textarea.invalid {
        border-color: #e74c3c;
      }
      
      .error {
        color: #e74c3c;
        font-size: 0.875rem;
        margin-top: 0.25rem;
        display: block;
      }
      
      .submit-btn {
        background: #27ae60;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 0.75rem 1.5rem;
        font-size: 1rem;
        cursor: pointer;
        font-weight: 600;
      }
      
      .submit-btn:hover:not(:disabled) {
        background: #229954;
      }
      
      .submit-btn:disabled {
        background: #95a5a6;
        cursor: not-allowed;
      }
      
      .success-message {
        background: #d4edda;
        border: 1px solid #c3e6cb;
        color: #155724;
        padding: 1rem;
        border-radius: 4px;
        margin-bottom: 1rem;
      }
      
      .note {
        font-size: 0.875rem;
        color: #666;
        margin-top: 1rem;
        font-style: italic;
      }
    `;
  }
}

module.exports = { HTMLGenerator };