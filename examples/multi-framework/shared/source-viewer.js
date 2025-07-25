/**
 * Source Code Viewer
 * 
 * Displays source code for framework examples with syntax highlighting
 */

class SourceViewer {
  constructor() {
    this.currentFramework = null;
    this.sourceCache = new Map();
    this.init();
  }

  init() {
    // Initialize syntax highlighting if Prism.js is available
    this.loadSyntaxHighlighter();
  }

  async loadSyntaxHighlighter() {
    if (window.Prism) return;

    try {
      // Load Prism.js for syntax highlighting
      const prismCSS = document.createElement('link');
      prismCSS.rel = 'stylesheet';
      prismCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css';
      document.head.appendChild(prismCSS);

      const prismJS = document.createElement('script');
      prismJS.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js';
      document.head.appendChild(prismJS);

      // Load additional language support
      const languages = ['javascript', 'jsx', 'typescript', 'css', 'html'];
      for (const lang of languages) {
        const langScript = document.createElement('script');
        langScript.src = `https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-${lang}.min.js`;
        document.head.appendChild(langScript);
      }
    } catch (error) {
      console.warn('Failed to load syntax highlighter:', error);
    }
  }

  showSourceModal(framework) {
    this.currentFramework = framework;
    const modal = this.createSourceModal();
    document.body.appendChild(modal);

    // Show modal with animation
    requestAnimationFrame(() => {
      modal.classList.add('show');
    });

    // Load source files
    this.loadSourceFiles(framework);
  }

  createSourceModal() {
    const modal = document.createElement('div');
    modal.className = 'source-modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>📝 Source Code - ${this.getFrameworkDisplayName(this.currentFramework)}</h2>
          <button class="modal-close">&times;</button>
        </div>
        
        <div class="modal-body">
          <div class="source-navigation">
            <div class="source-tabs" id="sourceTabs">
              <button class="source-tab active" data-file="main">Main Example</button>
              <button class="source-tab" data-file="components">Components</button>
              <button class="source-tab" data-file="chunks">Chunk Loading</button>
              <button class="source-tab" data-file="utils">Utilities</button>
            </div>
            
            <div class="source-actions">
              <button class="source-action" id="copyCode">
                <span>📋</span> Copy
              </button>
              <button class="source-action" id="downloadCode">
                <span>💾</span> Download
              </button>
              <button class="source-action" id="runCode">
                <span>▶️</span> Run
              </button>
            </div>
          </div>
          
          <div class="source-content">
            <div class="source-file-info">
              <span class="file-path" id="filePath">Loading...</span>
              <span class="file-size" id="fileSize"></span>
            </div>
            
            <div class="source-code-container">
              <pre class="source-code" id="sourceCode"><code>Loading source code...</code></pre>
            </div>
          </div>
          
          <div class="source-description">
            <h4>📖 Code Explanation</h4>
            <div id="codeExplanation">
              <p>This example demonstrates safe chunk loading without errors.</p>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn-secondary" id="viewOnGithub">View on GitHub</button>
          <button class="btn-primary" id="closeModal">Close</button>
        </div>
      </div>
    `;

    // Add event listeners
    this.attachSourceModalListeners(modal);

    return modal;
  }

  attachSourceModalListeners(modal) {
    // Close modal
    modal.querySelector('.modal-close').addEventListener('click', () => {
      this.closeModal(modal);
    });

    modal.querySelector('.modal-overlay').addEventListener('click', () => {
      this.closeModal(modal);
    });

    modal.querySelector('#closeModal').addEventListener('click', () => {
      this.closeModal(modal);
    });

    // Tab navigation
    modal.querySelectorAll('.source-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.switchSourceTab(e.target.dataset.file, modal);
      });
    });

    // Actions
    modal.querySelector('#copyCode').addEventListener('click', () => {
      this.copySourceCode(modal);
    });

    modal.querySelector('#downloadCode').addEventListener('click', () => {
      this.downloadSourceCode(modal);
    });

    modal.querySelector('#runCode').addEventListener('click', () => {
      this.runSourceCode(modal);
    });

    modal.querySelector('#viewOnGithub').addEventListener('click', () => {
      this.openGithubRepo();
    });
  }

  async loadSourceFiles(framework) {
    const sourceFiles = this.getSourceFiles(framework);

    for (const [fileType, filePath] of Object.entries(sourceFiles)) {
      try {
        const response = await fetch(filePath);
        if (response.ok) {
          const content = await response.text();
          this.sourceCache.set(`${framework}-${fileType}`, {
            content,
            path: filePath,
            size: content.length,
            language: this.detectLanguage(filePath)
          });
        }
      } catch (error) {
        console.warn(`Failed to load source file ${filePath}:`, error);
        // Create fallback content
        this.sourceCache.set(`${framework}-${fileType}`, {
          content: this.getFallbackContent(framework, fileType),
          path: filePath,
          size: 0,
          language: 'javascript'
        });
      }
    }

    // Display the first file
    this.switchSourceTab('main');
  }

  getSourceFiles(framework) {
    const basePath = `../${framework}`;

    const commonFiles = {
      main: `${basePath}/index.html`,
      components: `${basePath}/components/example-component.js`,
      chunks: `${basePath}/chunks/dynamic-chunk.js`,
      utils: `../shared/safe-chunk-loader.js`
    };

    // Framework-specific files
    const frameworkFiles = {
      react: {
        ...commonFiles,
        components: `${basePath}/components/react-components.jsx`,
        chunks: `${basePath}/chunks/react-chunks.jsx`
      },
      vue: {
        ...commonFiles,
        components: `${basePath}/components/vue-components.js`,
        chunks: `${basePath}/chunks/vue-chunks.js`
      },
      svelte: {
        ...commonFiles,
        components: `${basePath}/components/svelte-components.js`,
        chunks: `${basePath}/chunks/svelte-chunks.js`
      },
      angular: {
        ...commonFiles,
        components: `${basePath}/components/angular-components.ts`,
        chunks: `${basePath}/chunks/angular-chunks.ts`
      },
      vanilla: {
        ...commonFiles,
        components: `${basePath}/modules/vanilla-modules.js`,
        chunks: `${basePath}/chunks/vanilla-chunks.js`
      },
      mtm: {
        ...commonFiles,
        components: `${basePath}/components/mtm-components.js`,
        chunks: `${basePath}/chunks/mtm-chunks.js`
      }
    };

    return frameworkFiles[framework] || commonFiles;
  }

  switchSourceTab(fileType, modal = null) {
    if (!modal) {
      modal = document.querySelector('.source-modal');
    }

    // Update active tab
    modal.querySelectorAll('.source-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.file === fileType);
    });

    // Load and display source
    const cacheKey = `${this.currentFramework}-${fileType}`;
    const sourceData = this.sourceCache.get(cacheKey);

    if (sourceData) {
      this.displaySourceCode(sourceData, modal);
    } else {
      this.displayLoadingState(modal);
    }
  }

  displaySourceCode(sourceData, modal) {
    const codeElement = modal.querySelector('#sourceCode code');
    const filePathElement = modal.querySelector('#filePath');
    const fileSizeElement = modal.querySelector('#fileSize');
    const explanationElement = modal.querySelector('#codeExplanation');

    // Update file info
    filePathElement.textContent = sourceData.path;
    fileSizeElement.textContent = `${(sourceData.size / 1024).toFixed(1)} KB`;

    // Update code content
    codeElement.textContent = sourceData.content;
    codeElement.className = `language-${sourceData.language}`;

    // Apply syntax highlighting
    if (window.Prism) {
      Prism.highlightElement(codeElement);
    }

    // Update explanation
    explanationElement.innerHTML = this.getCodeExplanation(this.currentFramework, sourceData);
  }

  displayLoadingState(modal) {
    const codeElement = modal.querySelector('#sourceCode code');
    const filePathElement = modal.querySelector('#filePath');
    const fileSizeElement = modal.querySelector('#fileSize');

    filePathElement.textContent = 'Loading...';
    fileSizeElement.textContent = '';
    codeElement.textContent = 'Loading source code...';
  }

  detectLanguage(filePath) {
    const extension = filePath.split('.').pop().toLowerCase();
    const languageMap = {
      'js': 'javascript',
      'jsx': 'jsx',
      'ts': 'typescript',
      'tsx': 'tsx',
      'html': 'html',
      'css': 'css',
      'json': 'json'
    };
    return languageMap[extension] || 'javascript';
  }

  getFallbackContent(framework, fileType) {
    const fallbackContent = {
      main: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${this.getFrameworkDisplayName(framework)} Chunk Loading Example</title>
</head>
<body>
    <div id="app">
        <h1>✅ ${this.getFrameworkDisplayName(framework)} Success Example</h1>
        <p>This example demonstrates error-free chunk loading.</p>
    </div>
    
    <script type="module">
        import chunkLoader from '../shared/safe-chunk-loader.js';
        
        // Safe chunk loading example
        async function loadExample() {
            try {
                const chunk = await chunkLoader.loadChunk(
                    'example-chunk',
                    () => import('./chunks/example-chunk.js'),
                    '${framework}'
                );
                console.log('✅ Chunk loaded successfully:', chunk);
            } catch (error) {
                console.error('❌ Chunk loading failed:', error);
            }
        }
        
        loadExample();
    </script>
</body>
</html>`,

      components: `// ${this.getFrameworkDisplayName(framework)} Component Example
export default function ExampleComponent() {
    return {
        render() {
            return \`
                <div class="success-component">
                    <h3>✅ ${this.getFrameworkDisplayName(framework)} Component</h3>
                    <p>This component was loaded safely without errors.</p>
                </div>
            \`;
        }
    };
}`,

      chunks: `// Dynamic Chunk for ${this.getFrameworkDisplayName(framework)}
export default {
    name: 'ExampleChunk',
    data: {
        message: 'Hello from ${framework} chunk!',
        loaded: true,
        timestamp: Date.now()
    },
    
    render() {
        return \`
            <div class="chunk-content">
                <h4>📦 Dynamic Chunk Loaded</h4>
                <p>\${this.data.message}</p>
                <small>Loaded at: \${new Date(this.data.timestamp).toLocaleTimeString()}</small>
            </div>
        \`;
    }
};`,

      utils: `// Safe Chunk Loader Utility
export function safeAssign(obj, prop, value) {
    // Implementation of safe property assignment
    // Handles getter-only properties gracefully
    return obj;
}`
    };

    return fallbackContent[fileType] || '// Source code not available';
  }

  getCodeExplanation(framework, sourceData) {
    const explanations = {
      main: `
        <p><strong>Main Example File:</strong> This HTML file demonstrates the complete ${this.getFrameworkDisplayName(framework)} chunk loading setup.</p>
        <ul>
          <li>🔧 Uses safe chunk loader to prevent TypeError exceptions</li>
          <li>⚡ Implements efficient loading strategies</li>
          <li>✅ Shows error-free chunk loading in action</li>
          <li>📊 Includes performance monitoring</li>
        </ul>
      `,
      components: `
        <p><strong>Component Implementation:</strong> Framework-specific components that demonstrate safe loading.</p>
        <ul>
          <li>🎯 Uses ${framework}-specific patterns and best practices</li>
          <li>🔒 Implements safe property assignment</li>
          <li>🎨 Provides clean, reusable component structure</li>
          <li>📱 Responsive and accessible design</li>
        </ul>
      `,
      chunks: `
        <p><strong>Dynamic Chunks:</strong> Loadable modules that can be imported on-demand.</p>
        <ul>
          <li>📦 Demonstrates code splitting and lazy loading</li>
          <li>🚀 Optimized for performance and caching</li>
          <li>🛡️ Protected against getter-only property errors</li>
          <li>📈 Includes metadata for tracking and debugging</li>
        </ul>
      `,
      utils: `
        <p><strong>Utility Functions:</strong> Core utilities that enable safe chunk loading.</p>
        <ul>
          <li>🔧 Safe property assignment that handles edge cases</li>
          <li>📊 Performance monitoring and metrics collection</li>
          <li>🔄 Retry logic for failed loads</li>
          <li>💾 Caching system for improved performance</li>
        </ul>
      `
    };

    return explanations[Object.keys(explanations).find(key => sourceData.path.includes(key))] ||
      '<p>This code demonstrates safe chunk loading techniques.</p>';
  }

  copySourceCode(modal) {
    const codeElement = modal.querySelector('#sourceCode code');
    const text = codeElement.textContent;

    navigator.clipboard.writeText(text).then(() => {
      this.showNotification('✅ Code copied to clipboard!');
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      this.showNotification('✅ Code copied to clipboard!');
    });
  }

  downloadSourceCode(modal) {
    const codeElement = modal.querySelector('#sourceCode code');
    const filePathElement = modal.querySelector('#filePath');

    const content = codeElement.textContent;
    const fileName = filePathElement.textContent.split('/').pop() || 'source-code.js';

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showNotification('💾 Source code downloaded!');
  }

  runSourceCode(modal) {
    // This would implement code execution in a sandboxed environment
    this.showNotification('▶️ Code execution feature coming soon!');
  }

  openGithubRepo() {
    const repoUrl = 'https://github.com/your-org/multi-framework-examples';
    window.open(repoUrl, '_blank');
  }

  showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'source-notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    requestAnimationFrame(() => {
      notification.classList.add('show');
    });

    setTimeout(() => {
      notification.classList.add('hide');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  closeModal(modal) {
    modal.classList.add('closing');
    setTimeout(() => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    }, 300);
  }

  getFrameworkDisplayName(framework) {
    const names = {
      react: 'React',
      vue: 'Vue.js',
      svelte: 'Svelte',
      angular: 'Angular',
      vanilla: 'Vanilla JS',
      mtm: 'MTM Framework'
    };
    return names[framework] || framework;
  }
}

// Source viewer styles
const sourceViewerStyles = `
  .source-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 10000;
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s ease;
  }

  .source-modal.show {
    opacity: 1;
    visibility: visible;
  }

  .source-modal.closing {
    opacity: 0;
    transform: scale(0.95);
  }

  .source-modal .modal-content {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    max-width: 95vw;
    max-height: 95vh;
    width: 1000px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .source-navigation {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .source-tabs {
    display: flex;
    gap: 4px;
  }

  .source-tab {
    background: none;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    color: #4a5568;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .source-tab:hover {
    background: #e2e8f0;
  }

  .source-tab.active {
    background: #4299e1;
    color: white;
  }

  .source-actions {
    display: flex;
    gap: 8px;
  }

  .source-action {
    display: flex;
    align-items: center;
    gap: 4px;
    background: #e2e8f0;
    border: none;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s ease;
  }

  .source-action:hover {
    background: #cbd5e0;
  }

  .source-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .source-file-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 24px;
    background: #1a202c;
    color: #e2e8f0;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.9rem;
  }

  .file-path {
    color: #63b3ed;
  }

  .file-size {
    color: #9ca3af;
  }

  .source-code-container {
    flex: 1;
    overflow: auto;
    background: #1a202c;
  }

  .source-code {
    margin: 0;
    padding: 24px;
    background: #1a202c;
    color: #e2e8f0;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 14px;
    line-height: 1.5;
    overflow: auto;
  }

  .source-description {
    padding: 20px 24px;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .source-description h4 {
    margin: 0 0 12px 0;
    color: #2d3748;
  }

  .source-description ul {
    margin: 8px 0;
    padding-left: 20px;
  }

  .source-description li {
    margin: 4px 0;
    color: #4a5568;
  }

  .source-notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background: #48bb78;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 10001;
    transform: translateX(100%);
    transition: transform 0.3s ease;
  }

  .source-notification.show {
    transform: translateX(0);
  }

  .source-notification.hide {
    transform: translateX(100%);
  }

  @media (max-width: 768px) {
    .source-modal .modal-content {
      width: 100vw;
      height: 100vh;
      border-radius: 0;
    }

    .source-navigation {
      flex-direction: column;
      gap: 12px;
      align-items: stretch;
    }

    .source-tabs {
      justify-content: center;
    }

    .source-actions {
      justify-content: center;
    }
  }
`;

// Add styles to document
const styleSheet = document.createElement('style');
styleSheet.textContent = sourceViewerStyles;
document.head.appendChild(styleSheet);

// Create and export viewer instance
const sourceViewer = new SourceViewer();

export default sourceViewer;