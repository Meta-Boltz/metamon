// Enhanced MTM Compiler with Compilation Mode Support
const fs = require('fs');
const path = require('path');
const { EnhancedMTMParser } = require('./enhanced-parser.js');
const { CompilationModeHandler } = require('./compilation-mode-handler.js');
const { EnhancedHTMLGenerator } = require('./enhanced-html-generator.js');

class EnhancedMTMCompilerWithModes {
  constructor() {
    this.parser = new EnhancedMTMParser();
    this.compilationHandler = new CompilationModeHandler();
    this.htmlGenerator = new EnhancedHTMLGenerator();
    this.routes = new Map();
    this.components = new Map();
  }

  /**
   * Compiles an MTM file with compilation mode support
   * @param {string} inputFile - Path to the input MTM file
   * @param {Object} options - Compilation options
   * @returns {Object} Compilation result
   */
  compile(inputFile, options = {}) {
    const source = fs.readFileSync(inputFile, 'utf8');
    const filename = path.basename(inputFile);

    // Parse the source
    const ast = this.parser.parse(source, filename);

    // Validate frontmatter
    const validationErrors = this.parser.validateFrontmatter(ast.frontmatter);
    if (validationErrors.length > 0) {
      throw new Error(`Frontmatter validation failed: ${validationErrors.map(e => e.message).join(', ')}`);
    }

    // Determine compilation mode
    const compilationMode = this.compilationHandler.resolveCompilationMode(ast.frontmatter, options);

    // Generate JavaScript
    const jsResult = this.compilationHandler.generateJavaScript(ast, compilationMode, options);

    // Generate HTML using the enhanced HTML generator
    const html = this.htmlGenerator.generateHTML(ast, jsResult, options);

    // Register route if specified
    if (ast.frontmatter.route) {
      this.routes.set(ast.frontmatter.route, {
        file: filename,
        metadata: ast.frontmatter,
        compilationMode
      });
    }

    return {
      html,
      javascript: jsResult,
      route: ast.frontmatter.route,
      metadata: ast.frontmatter,
      compilationMode,
      ast
    };
  }

  /**
   * Compiles multiple MTM files
   * @param {Array<string>} inputFiles - Array of input file paths
   * @param {Object} options - Compilation options
   * @returns {Array<Object>} Array of compilation results
   */
  compileMultiple(inputFiles, options = {}) {
    const results = [];

    for (const inputFile of inputFiles) {
      try {
        const result = this.compile(inputFile, options);
        results.push(result);
      } catch (error) {
        results.push({
          file: inputFile,
          error: error.message,
          success: false
        });
      }
    }

    return results;
  }

  /**
   * Generates HTML with proper script tag integration
   * @param {Object} ast - The parsed AST
   * @param {Object} jsResult - The JavaScript generation result
   * @param {Object} options - Generation options
   * @returns {string} The generated HTML
   */
  generateHTML(ast, jsResult, options = {}) {
    const template = this.processTemplate(ast.template?.content || '', ast);
    const title = ast.frontmatter.title || 'MTM App';
    const description = ast.frontmatter.description || 'Enhanced MTM Application';
    const route = ast.frontmatter.route || '/';

    // Generate additional meta tags from frontmatter
    const metaTags = this.generateMetaTags(ast.frontmatter);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${description}">
    <meta name="route" content="${route}">
    ${metaTags}
    <style>${this.getCSS()}</style>
</head>
<body>
    <div id="app">${template}</div>
    ${jsResult.scriptTag}
</body>
</html>`;
  }

  /**
   * Processes the template content
   * @param {string} template - The template content
   * @param {Object} ast - The parsed AST
   * @returns {string} The processed template
   */
  processTemplate(template, ast) {
    let processed = template;

    // Replace metadata placeholders
    Object.keys(ast.frontmatter).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      processed = processed.replace(regex, ast.frontmatter[key]);
    });

    // Process Link components
    processed = processed.replace(/<Link\s+href="([^"]+)"([^>]*)>(.*?)<\/Link>/g,
      (match, href, attrs, content) => {
        return `<a href="${href}" data-link="true"${attrs}>${content}</a>`;
      }
    );

    // Process imported components
    if (ast.imports) {
      ast.imports.forEach(component => {
        const componentRegex = new RegExp(`<${component.name}([^>]*?)\\s*/>`, 'g');
        processed = processed.replace(componentRegex, (match, attrs) => {
          return `<div data-component="${component.name}" data-type="${component.framework}"${attrs}></div>`;
        });
      });
    }

    // Handle event handlers
    processed = processed.replace(/(\w+)=\{(\$\w+)\}/g, 'data-event-$1="$2"');

    // Handle conditional rendering
    processed = processed.replace(/\{#if\s+([^}]+)\}([\s\S]*?)\{\/if\}/g, (match, condition, content) => {
      return `<div data-if="${condition}" style="display: none;">${content}</div>`;
    });

    // Handle variable interpolation
    processed = processed.replace(/\{(\$\w+)\}/g, '<span data-bind="$1">Loading...</span>');

    return processed;
  }

  /**
   * Generates meta tags from frontmatter
   * @param {Object} frontmatter - The frontmatter object
   * @returns {string} The generated meta tags
   */
  generateMetaTags(frontmatter) {
    const metaTags = [];

    // Add keywords if present
    if (frontmatter.keywords) {
      metaTags.push(`<meta name="keywords" content="${frontmatter.keywords}">`);
    }

    // Add author if present
    if (frontmatter.author) {
      metaTags.push(`<meta name="author" content="${frontmatter.author}">`);
    }

    // Add Open Graph tags if present
    if (frontmatter.ogTitle) {
      metaTags.push(`<meta property="og:title" content="${frontmatter.ogTitle}">`);
    }

    if (frontmatter.ogDescription) {
      metaTags.push(`<meta property="og:description" content="${frontmatter.ogDescription}">`);
    }

    if (frontmatter.ogImage) {
      metaTags.push(`<meta property="og:image" content="${frontmatter.ogImage}">`);
    }

    return metaTags.join('\n    ');
  }

  /**
   * Writes compilation results to disk
   * @param {Object} result - The compilation result
   * @param {string} outputDir - The output directory
   * @param {Object} options - Write options
   */
  writeResult(result, outputDir = '.', options = {}) {
    // Write HTML file
    const htmlFilename = this.getOutputFilename(result.metadata, 'html');
    const htmlPath = path.join(outputDir, htmlFilename);
    fs.writeFileSync(htmlPath, result.html, 'utf8');

    // Write external JavaScript file if needed
    if (result.javascript.externalFile) {
      const jsPath = path.join(outputDir, result.javascript.externalFile.filename);
      const jsDir = path.dirname(jsPath);

      // Ensure directory exists
      if (!fs.existsSync(jsDir)) {
        fs.mkdirSync(jsDir, { recursive: true });
      }

      // Optimize JavaScript if requested
      let jsContent = result.javascript.externalFile.content;
      if (options.minify) {
        jsContent = this.compilationHandler.optimizeJavaScript(jsContent, { minify: true });
      }

      fs.writeFileSync(jsPath, jsContent, 'utf8');
    }
  }

  /**
   * Gets the output filename for a result
   * @param {Object} metadata - The metadata object
   * @param {string} extension - The file extension
   * @returns {string} The output filename
   */
  getOutputFilename(metadata, extension) {
    if (metadata.route && metadata.route !== '/') {
      const routeName = metadata.route.replace(/^\//, '').replace(/\//g, '-');
      return `${routeName}.${extension}`;
    }
    return `index.${extension}`;
  }

  /**
   * Gets the CSS for the generated HTML
   * @returns {string} The CSS content
   */
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
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        
        .navigation {
            display: flex;
            gap: 1rem;
            margin: 1rem 0;
            padding: 1rem;
            background: #f8f9ff;
            border-radius: 8px;
            border: 1px solid #667eea;
        }
        
        .navigation a {
            color: #667eea;
            text-decoration: none;
            font-weight: 600;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            transition: background 0.2s;
        }
        
        .navigation a:hover {
            background: #667eea;
            color: white;
        }
        
        .link-examples {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            margin: 1rem 0;
        }
        
        .link-examples a {
            color: #667eea;
            text-decoration: none;
            padding: 0.5rem;
            border: 1px solid #667eea;
            border-radius: 4px;
            transition: all 0.2s;
        }
        
        .link-examples a:hover {
            background: #667eea;
            color: white;
        }
        
        .counter-component, .vue-button, .react-component {
            margin: 1rem 0;
            padding: 1rem;
            border: 1px solid #ddd;
            border-radius: 8px;
            background: #f9f9f9;
        }
        
        .counter-display {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin: 1rem 0;
        }
        
        .counter-btn {
            background: #667eea;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 0.5rem 1rem;
            cursor: pointer;
            font-weight: 600;
        }
        
        .counter-value {
            font-size: 1.5rem;
            font-weight: bold;
            min-width: 3rem;
            text-align: center;
        }
        
        .features ul {
            list-style: none;
            padding: 0;
        }
        
        .features li {
            padding: 0.5rem 0;
            border-bottom: 1px solid #eee;
        }
    `;
  }

  /**
   * Gets all registered routes
   * @returns {Map} The routes map
   */
  getRoutes() {
    return this.routes;
  }

  /**
   * Gets compilation statistics
   * @returns {Object} Compilation statistics
   */
  getStats() {
    return {
      routesCount: this.routes.size,
      componentsCount: this.components.size,
      routes: Array.from(this.routes.keys())
    };
  }
}

module.exports = { EnhancedMTMCompilerWithModes };