// Routing MTM Compiler - Supports real client-side routing with URL updates
const fs = require('fs');
const path = require('path');

class RoutingMTMCompiler {
  compile(inputFile) {
    const source = fs.readFileSync(inputFile, 'utf8');
    const filename = path.basename(inputFile);

    const componentName = this.extractComponentName(filename);
    const parsed = this.parseSource(source);
    const html = this.generateHTML(componentName, parsed);

    return html;
  }

  extractComponentName(filename) {
    const baseName = path.basename(filename, '.mtm');
    return baseName.split('.')[0].replace(/[-_]/g, '').replace(/^\w/, c => c.toUpperCase()) + 'App';
  }

  parseSource(source) {
    const lines = source.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('//'));

    const result = {
      metadata: {},
      variables: [],
      functions: [],
      template: ''
    };

    let inTemplate = false;
    let templateContent = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Parse metadata
      const metadataMatch = line.match(/^(\w+):\s*"([^"]+)"$/);
      if (metadataMatch) {
        result.metadata[metadataMatch[1]] = metadataMatch[2];
        continue;
      }

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

      // Parse reactive variables
      const reactiveMatch = line.match(/^\$(\w+)!\s*=\s*(.+)$/);
      if (reactiveMatch) {
        result.variables.push({
          name: reactiveMatch[1],
          value: reactiveMatch[2],
          type: 'reactive'
        });
        continue;
      }

      // Parse functions
      const functionMatch = line.match(/^\$(\w+)\s*=\s*\(([^)]*)\)\s*=>\s*\{$/);
      if (functionMatch) {
        const functionName = functionMatch[1];
        const functionParams = functionMatch[2].trim();
        let functionBody = '';

        i++;
        while (i < lines.length && lines[i] !== '}') {
          functionBody += lines[i] + '\n';
          i++;
        }

        result.functions.push({
          name: functionName,
          params: functionParams,
          body: functionBody.trim()
        });
        continue;
      }
    }

    return result;
  }

  generateHTML(componentName, parsed) {
    const template = this.processTemplate(parsed.template, parsed.metadata);
    const script = this.generateScript(componentName, parsed);

    const title = parsed.metadata.title || componentName;
    const description = parsed.metadata.description || 'MTM Framework Component';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${description}">
    <style>${this.getCSS()}</style>
</head>
<body>
    <div id="app">${template}</div>
    <script>${script}</script>
</body>
</html>`;
  }

  processTemplate(template, metadata) {
    let processed = template;

    // Replace metadata placeholders
    Object.keys(metadata).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      processed = processed.replace(regex, metadata[key]);
    });

    // Handle event handlers first
    processed = processed.replace(/click=\{(\$\w+)\}/g, 'data-click="$1"');

    // Handle conditional rendering
    processed = processed.replace(/\{#if\s+([^}]+)\}([\s\S]*?)\{\/if\}/g, (match, condition, content) => {
      return `<div data-if="${condition}" style="display: none;">${content}</div>`;
    });

    // Handle variable interpolation last
    processed = processed.replace(/\{(\$\w+)\}/g, '<span data-bind="$1">Loading...</span>');

    return processed;
  }

  generateScript(componentName, parsed) {
    return `
// MTM Client-Side Routing System
const MTMRouter = {
  _signals: new Map(),
  _subscribers: new Map(),
  
  create(key, initialValue) {
    if (!this._signals.has(key)) {
      this._signals.set(key, initialValue);
      this._subscribers.set(key, new Set());
    }
    
    return {
      get value() { return MTMRouter._signals.get(key); },
      set value(newValue) {
        MTMRouter._signals.set(key, newValue);
        MTMRouter._notifySubscribers(key, newValue);
      },
      subscribe(callback) { MTMRouter._subscribers.get(key).add(callback); }
    };
  },
  
  _notifySubscribers(key, value) {
    if (this._subscribers.has(key)) {
      this._subscribers.get(key).forEach(callback => callback(value));
    }
  },
  
  emit(event, data) {
    console.log('MTM Router Event:', event, data);
    window.dispatchEvent(new CustomEvent('mtm-' + event, { detail: data }));
  },
  
  // URL update utilities
  updateURL() {
    const urlElements = document.querySelectorAll('#current-url, #contact-url');
    urlElements.forEach(el => {
      if (el) el.textContent = window.location.pathname;
    });
  }
};

window.signal = MTMRouter;

// Page metadata
const pageMetadata = ${JSON.stringify(parsed.metadata, null, 2)};

// Router App: ${componentName}
function ${componentName}() {
  // Variables
${parsed.variables.map(v => this.generateVariable(v)).join('\n')}

  // Functions  
${parsed.functions.map(f => this.generateFunction(f, parsed.variables)).join('\n\n')}

  // DOM Management
  const container = document.getElementById('app');
  
  const updateAll = () => {
    // Update data-bind elements
${parsed.variables.map(v => this.generateBindingUpdate(v)).join('\n')}
    
    // Update URL displays
    MTMRouter.updateURL();
    
    // Update conditional rendering
    container.querySelectorAll('[data-if]').forEach(el => {
      const condition = el.getAttribute('data-if');
      let shouldShow = false;
      
      try {
        let evalStr = condition;
${parsed.variables.map(v => `        evalStr = evalStr.replace(/\\$${v.name}/g, '$${v.name}.value');`).join('\n')}
        shouldShow = eval(evalStr);
      } catch (e) {
        console.warn('Condition failed:', condition, e);
      }
      
      el.style.display = shouldShow ? 'block' : 'none';
    });
  };
  
  // Initialize routing
  const initializeRouting = () => {
    // Set up popstate handler for browser back/forward
    window.addEventListener('popstate', (event) => {
      const path = window.location.pathname;
      let page = 'home';
      
      if (path === '/about') page = 'about';
      else if (path === '/contact') page = 'contact';
      
      $currentPage.value = page;
      $message.value = \`Browser navigation to \${page} page\`;
      updateAll();
    });
    
    // Initialize based on current URL
    const path = window.location.pathname;
    let page = 'home';
    
    if (path === '/about') page = 'about';
    else if (path === '/contact') page = 'contact';
    
    $currentPage.value = page;
    $message.value = \`Initialized on \${page} page from URL\`;
  };
  
  // Initial update
  updateAll();
  initializeRouting();
  
  // Subscribe to changes
${parsed.variables.map(v => `  $${v.name}.subscribe(() => updateAll());`).join('\n')}
  
  // Bind events
${parsed.functions.map(f => this.generateEventBinding(f)).join('\n\n')}
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  ${componentName}();
  console.log('🔮 MTM Router App loaded with real client-side routing!');
  console.log('📍 Current URL:', window.location.pathname);
  console.log('📄 Page metadata:', pageMetadata);
});`;
  }

  generateVariable(variable) {
    if (variable.value.includes('signal(')) {
      const signalMatch = variable.value.match(/signal\s*\(\s*['"]([^'"]+)['"]\s*,\s*(.+)\s*\)/);
      if (signalMatch) {
        const key = signalMatch[1];
        const initialValue = signalMatch[2];
        return `  const $${variable.name} = MTMRouter.create('${key}', ${initialValue});`;
      }
    }
    return `  const $${variable.name} = MTMRouter.create('${variable.name}', ${variable.value});`;
  }

  generateFunction(func, variables) {
    let body = func.body;
    // Replace $variable with $variable.value
    variables.forEach(variable => {
      const regex = new RegExp(`\\$${variable.name}(?!\\.)\\b`, 'g');
      body = body.replace(regex, `$${variable.name}.value`);
    });

    return `  const $${func.name} = ${func.name.includes('handlePopState') ? '(event)' : '()'} => {
    ${body}
  };`;
  }

  generateBindingUpdate(variable) {
    return `    container.querySelectorAll('[data-bind="$${variable.name}"]').forEach(el => {
      el.textContent = $${variable.name}.value;
    });`;
  }

  generateEventBinding(func) {
    return `  container.querySelectorAll('[data-click="$${func.name}"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      $${func.name}();
    });
  });`;
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
        
        .routing-app { max-width: 100%; }
        
        .header {
            text-align: center;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 2px solid #667eea;
        }
        
        .header h1 { color: #2c3e50; margin-bottom: 0.5rem; }
        
        .page-info {
            color: #666;
            font-size: 0.9rem;
            background: #e8f4fd;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            border: 1px solid #bee5eb;
            margin-bottom: 0.5rem;
        }
        
        .url-info {
            color: #666;
            font-size: 0.9rem;
            background: #fff3cd;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            border: 1px solid #ffeaa7;
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
        
        .nav-btn:hover { background: #5a6fd8; }
        
        .current-page {
            margin-left: auto;
            font-weight: bold;
            color: #2c3e50;
        }
        
        .content { min-height: 300px; }
        
        .content h2 {
            color: #2c3e50;
            border-bottom: 1px solid #eee;
            padding-bottom: 0.5rem;
        }
        
        .description {
            color: #666;
            font-style: italic;
            background: #f9f9f9;
            padding: 1rem;
            border-radius: 6px;
            border-left: 4px solid #667eea;
            margin-bottom: 1rem;
        }
        
        .routing-info, .routing-details, .url-test {
            background: #f0f8ff;
            padding: 1rem;
            border-radius: 6px;
            border: 1px solid #b3d9ff;
            margin: 1rem 0;
        }
        
        .routing-info h4, .routing-details h4, .url-test h4 {
            color: #2c3e50;
            margin-top: 0;
        }
        
        .routing-info ul, .routing-details ul, .url-test ul {
            list-style: none;
            padding: 0;
        }
        
        .routing-info li, .routing-details li, .url-test li {
            padding: 0.25rem 0;
            border-bottom: 1px solid #e6f3ff;
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
        
        .counter-display button:hover { background: #5a6fd8; }
        
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
        
        .reset-btn { background: #e74c3c !important; }
        .reset-btn:hover { background: #c0392b !important; }
        
        .home-content, .about-content, .contact-content {
            padding: 1.5rem;
            background: #f9f9f9;
            border-radius: 8px;
            margin: 1rem 0;
        }
        
        .contact-info {
            background: white;
            padding: 1rem;
            border-radius: 6px;
            border: 1px solid #ddd;
            margin: 1rem 0;
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

module.exports = { RoutingMTMCompiler };