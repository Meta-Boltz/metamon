/**
 * Server-Side Rendering (SSR) Renderer for Ultra-Modern MTM
 * Pre-renders pages at build time with full HTML content
 */

import { createPageScanner } from './page-scanner.js';
import { createRouteManifestGenerator } from './route-manifest-generator.js';
import TemplateTransformer from './template-transformer.js';
import { createFrontmatterProcessor } from './frontmatter-processor.js';
import { JSDOM } from 'jsdom';
import fs from 'fs/promises';
import path from 'path';

export class SSRRenderer {
  constructor(options = {}) {
    this.options = {
      pagesDir: 'src/pages',
      outputDir: 'dist',
      baseUrl: 'http://localhost:3000',
      generateStaticHTML: true,
      extractCriticalCSS: true,
      enableDataFetching: true,
      framework: 'vanilla',
      minifyHTML: true,
      generateSitemap: true,
      ...options
    };

    this.pageScanner = createPageScanner({
      pagesDir: this.options.pagesDir,
      watchMode: false
    });

    this.routeGenerator = createRouteManifestGenerator({
      pagesDir: this.options.pagesDir,
      optimizeForProduction: true
    });

    this.transformer = new TemplateTransformer();
    this.frontmatterProcessor = createFrontmatterProcessor();

    // SSR context for data fetching
    this.ssrContext = {
      isSSR: true,
      baseUrl: this.options.baseUrl,
      buildTime: new Date().toISOString()
    };

    // Critical CSS extraction
    this.criticalCSS = new Set();
    this.pageStyles = new Map();

    // Data fetching cache
    this.dataCache = new Map();
  }

  /**
   * Render all pages to static HTML
   */
  async renderAllPages() {
    console.log('🚀 Starting SSR rendering process...');

    try {
      // Scan all pages
      const pages = await this.pageScanner.scanPages(this.options.pagesDir);
      console.log(`📄 Found ${pages.length} pages to render`);

      // Generate route manifest
      const routeManifest = await this.routeGenerator.generateRouteManifest();

      // Create output directory
      await this.ensureOutputDirectory();

      // Render each page
      const renderResults = [];
      for (const page of pages) {
        try {
          const result = await this.renderPage(page, routeManifest);
          renderResults.push(result);
          console.log(`✅ Rendered: ${page.route}`);
        } catch (error) {
          console.error(`❌ Failed to render ${page.route}:`, error);
          renderResults.push({
            route: page.route,
            success: false,
            error: error.message
          });
        }
      }

      // Generate additional assets
      await this.generateAdditionalAssets(renderResults, routeManifest);

      console.log(`🎉 SSR rendering complete! Generated ${renderResults.filter(r => r.success).length}/${renderResults.length} pages`);

      return {
        success: true,
        pages: renderResults,
        manifest: routeManifest,
        outputDir: this.options.outputDir
      };

    } catch (error) {
      console.error('❌ SSR rendering failed:', error);
      throw error;
    }
  }

  /**
   * Render a single page to HTML
   */
  async renderPage(pageInfo, routeManifest = null) {
    console.log(`🔄 Rendering page: ${pageInfo.route}`);

    try {
      // Read and process the .mtm file
      const mtmContent = await fs.readFile(pageInfo.filePath, 'utf-8');
      const processed = this.frontmatterProcessor.process(mtmContent);

      if (processed.errors.length > 0) {
        throw new Error(`Frontmatter errors: ${processed.errors.map(e => e.message).join(', ')}`);
      }

      // Transform MTM content to target framework
      const transformed = this.transformer.transform(
        processed.content,
        this.options.framework,
        {
          generateSourceMap: false,
          optimizeOutput: true,
          includeTypeAnnotations: false
        }
      );

      if (transformed.errors.length > 0) {
        throw new Error(`Transform errors: ${transformed.errors.map(e => e.message).join(', ')}`);
      }

      // Create SSR context for this page
      const pageContext = {
        ...this.ssrContext,
        route: pageInfo.route,
        params: this.extractRouteParams(pageInfo.route),
        metadata: processed.frontmatter,
        buildTime: new Date().toISOString()
      };

      // Fetch data if needed
      let pageData = {};
      if (this.options.enableDataFetching && processed.frontmatter.dataFetch) {
        pageData = await this.fetchPageData(processed.frontmatter.dataFetch, pageContext);
      }

      // Render component to HTML
      const renderResult = await this.renderComponentToHTML(
        transformed.code,
        pageContext,
        pageData
      );

      // Extract critical CSS
      let criticalCSS = '';
      if (this.options.extractCriticalCSS) {
        criticalCSS = await this.extractCriticalCSS(renderResult.html, pageInfo.route);
      }

      // Generate complete HTML document
      const fullHTML = this.generateHTMLDocument({
        title: processed.frontmatter.title || 'Page',
        description: processed.frontmatter.description || '',
        keywords: processed.frontmatter.keywords || [],
        content: renderResult.html,
        criticalCSS,
        metadata: processed.frontmatter,
        preloadData: pageData,
        route: pageInfo.route
      });

      // Write HTML file
      const outputPath = this.getOutputPath(pageInfo.route);
      await this.writeHTMLFile(outputPath, fullHTML);

      return {
        route: pageInfo.route,
        success: true,
        outputPath,
        html: fullHTML,
        criticalCSS,
        metadata: processed.frontmatter,
        data: pageData,
        size: Buffer.byteLength(fullHTML, 'utf8')
      };

    } catch (error) {
      console.error(`❌ Error rendering ${pageInfo.route}:`, error);
      throw error;
    }
  }

  /**
   * Render component code to HTML string
   */
  async renderComponentToHTML(componentCode, context, data = {}) {
    try {
      // Create a virtual DOM environment
      const dom = new JSDOM('<!DOCTYPE html><html><head></head><body><div id="app"></div></body></html>', {
        url: context.baseUrl,
        pretendToBeVisual: true,
        resources: 'usable'
      });

      const { window } = dom;
      global.window = window;
      global.document = window.document;
      global.navigator = window.navigator;

      // Create a module context for the component
      const moduleContext = {
        exports: {},
        module: { exports: {} },
        require: (id) => {
          // Mock common dependencies for SSR
          if (id.includes('signal')) {
            return this.createSSRSignalMock();
          }
          return {};
        },
        console,
        setTimeout: global.setTimeout,
        clearTimeout: global.clearTimeout,
        setInterval: global.setInterval,
        clearInterval: global.clearInterval
      };

      // Convert ES module to CommonJS for SSR execution
      let executableCode = componentCode;

      // Simple ES module to CommonJS conversion for SSR
      executableCode = executableCode
        .replace(/export\s+default\s+/g, 'module.exports = ')
        .replace(/export\s+\{([^}]+)\}/g, (match, exports) => {
          const exportList = exports.split(',').map(e => e.trim());
          return exportList.map(exp => `module.exports.${exp} = ${exp};`).join('\n');
        })
        .replace(/import\s+.*?from\s+['"][^'"]+['"];?\s*/g, ''); // Remove imports for SSR

      // Execute component code in context
      const componentFunction = new Function(
        'exports', 'module', 'require', 'console', 'window', 'document',
        'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
        executableCode + '\nreturn module.exports;'
      );

      const Component = componentFunction(
        moduleContext.exports,
        moduleContext.module,
        moduleContext.require,
        moduleContext.console,
        window,
        window.document,
        moduleContext.setTimeout,
        moduleContext.clearTimeout,
        moduleContext.setInterval,
        moduleContext.clearInterval
      );

      // Render component
      let html = '';
      if (typeof Component === 'function') {
        // Call component function with SSR context
        const element = Component({
          ...context,
          data,
          isSSR: true
        });

        if (element instanceof window.HTMLElement) {
          html = element.outerHTML;
        } else if (typeof element === 'string') {
          html = element;
        } else if (element && typeof element.renderPage === 'function') {
          const pageResult = element.renderPage(context);
          html = pageResult.html || pageResult;
        }
      }

      // Clean up global references
      delete global.window;
      delete global.document;
      delete global.navigator;

      return {
        html: html || '<div>No content rendered</div>',
        data,
        context
      };

    } catch (error) {
      console.error('Component rendering error:', error);
      return {
        html: `<div class="ssr-error">
          <h2>Server Rendering Error</h2>
          <p>${error.message}</p>
        </div>`,
        data,
        context,
        error: error.message
      };
    }
  }

  /**
   * Create SSR-compatible signal mock
   */
  createSSRSignalMock() {
    return {
      signal: (key, initialValue) => ({
        value: initialValue,
        subscribe: () => () => { },
        set: () => { },
        update: () => { }
      }),
      use: (key, initialValue) => [
        initialValue,
        () => { } // setter function
      ],
      emit: () => { },
      on: () => () => { }
    };
  }

  /**
   * Extract critical CSS for a page
   */
  async extractCriticalCSS(html, route) {
    try {
      // Simple critical CSS extraction
      // In production, you'd use a proper CSS extraction tool
      const cssSelectors = new Set();

      // Extract class names from HTML
      const classMatches = html.match(/class="([^"]+)"/g) || [];
      classMatches.forEach(match => {
        const classes = match.replace('class="', '').replace('"', '').split(' ');
        classes.forEach(cls => {
          if (cls.trim()) {
            cssSelectors.add(`.${cls.trim()}`);
          }
        });
      });

      // Extract ID selectors
      const idMatches = html.match(/id="([^"]+)"/g) || [];
      idMatches.forEach(match => {
        const id = match.replace('id="', '').replace('"', '');
        if (id.trim()) {
          cssSelectors.add(`#${id.trim()}`);
        }
      });

      // Generate basic critical CSS
      const criticalCSS = Array.from(cssSelectors).map(selector => {
        return this.generateBasicCSS(selector);
      }).filter(Boolean).join('\n');

      // Cache for this page
      this.pageStyles.set(route, criticalCSS);

      return criticalCSS;

    } catch (error) {
      console.warn(`Failed to extract critical CSS for ${route}:`, error);
      return '';
    }
  }

  /**
   * Generate basic CSS for common selectors
   */
  generateBasicCSS(selector) {
    const basicStyles = {
      '.container': 'max-width: 1200px; margin: 0 auto; padding: 0 20px;',
      '.header': 'background: #fff; border-bottom: 1px solid #eee; padding: 1rem 0;',
      '.nav': 'display: flex; gap: 1rem; list-style: none; margin: 0; padding: 0;',
      '.nav a': 'text-decoration: none; color: #333; padding: 0.5rem 1rem;',
      '.nav a:hover': 'background: #f5f5f5; border-radius: 4px;',
      '.main': 'padding: 2rem 0;',
      '.footer': 'background: #f8f9fa; padding: 2rem 0; margin-top: 4rem;',
      '.btn': 'display: inline-block; padding: 0.5rem 1rem; background: #007bff; color: white; text-decoration: none; border-radius: 4px; border: none; cursor: pointer;',
      '.btn:hover': 'background: #0056b3;',
      '.error': 'color: #dc3545; background: #f8d7da; padding: 1rem; border-radius: 4px; border: 1px solid #f5c6cb;',
      '.loading': 'text-align: center; padding: 2rem;',
      '.card': 'background: white; border: 1px solid #dee2e6; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem;',
      '.grid': 'display: grid; gap: 1rem;',
      '.flex': 'display: flex;',
      '.text-center': 'text-align: center;',
      '.mt-4': 'margin-top: 1.5rem;',
      '.mb-4': 'margin-bottom: 1.5rem;',
      '.p-4': 'padding: 1.5rem;',
      '#main': 'min-height: 100vh; display: flex; flex-direction: column;',
      '#app': 'width: 100%; height: 100%;',
      '#content': 'flex: 1; padding: 2rem;'
    };

    return basicStyles[selector] ? `${selector} { ${basicStyles[selector]} }` : null;
  }

  /**
   * Fetch data for a page during SSR
   */
  async fetchPageData(dataFetchConfig, context) {
    try {
      // Check cache first
      const cacheKey = `${context.route}:${JSON.stringify(dataFetchConfig)}`;
      if (this.dataCache.has(cacheKey)) {
        return this.dataCache.get(cacheKey);
      }

      let data = {};

      if (typeof dataFetchConfig === 'string') {
        // Simple API endpoint
        data = await this.fetchFromAPI(dataFetchConfig, context);
      } else if (typeof dataFetchConfig === 'object') {
        // Complex data fetching configuration
        if (dataFetchConfig.api) {
          data.api = await this.fetchFromAPI(dataFetchConfig.api, context);
        }
        if (dataFetchConfig.static) {
          data.static = await this.fetchStaticData(dataFetchConfig.static, context);
        }
        if (dataFetchConfig.computed) {
          data.computed = await this.computeData(dataFetchConfig.computed, context, data);
        }
      }

      // Cache the result
      this.dataCache.set(cacheKey, data);

      return data;

    } catch (error) {
      console.warn(`Failed to fetch data for ${context.route}:`, error);
      return {};
    }
  }

  /**
   * Fetch data from API endpoint
   */
  async fetchFromAPI(endpoint, context) {
    try {
      // Mock API data for SSR
      // In production, you'd make actual HTTP requests
      const mockData = {
        '/api/posts': [
          { id: 1, title: 'First Post', content: 'This is the first post content.' },
          { id: 2, title: 'Second Post', content: 'This is the second post content.' }
        ],
        '/api/users': [
          { id: 1, name: 'John Doe', email: 'john@example.com' },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
        ]
      };

      return mockData[endpoint] || {};

    } catch (error) {
      console.warn(`API fetch failed for ${endpoint}:`, error);
      return {};
    }
  }

  /**
   * Fetch static data from files
   */
  async fetchStaticData(staticConfig, context) {
    try {
      if (typeof staticConfig === 'string') {
        // Read from file
        const filePath = path.resolve(staticConfig);
        const content = await fs.readFile(filePath, 'utf-8');

        if (filePath.endsWith('.json')) {
          return JSON.parse(content);
        } else if (filePath.endsWith('.md')) {
          return { markdown: content };
        } else {
          return { content };
        }
      }

      return {};

    } catch (error) {
      console.warn(`Static data fetch failed:`, error);
      return {};
    }
  }

  /**
   * Compute data based on other data
   */
  async computeData(computeConfig, context, existingData) {
    try {
      // Simple computed data example
      if (computeConfig.totalPosts && existingData.api) {
        return {
          totalPosts: Array.isArray(existingData.api) ? existingData.api.length : 0
        };
      }

      return {};

    } catch (error) {
      console.warn(`Data computation failed:`, error);
      return {};
    }
  }

  /**
   * Generate complete HTML document
   */
  generateHTMLDocument(options) {
    const {
      title,
      description,
      keywords,
      content,
      criticalCSS,
      metadata,
      preloadData,
      route
    } = options;

    const keywordsString = Array.isArray(keywords) ? keywords.join(', ') : keywords;

    return `<!DOCTYPE html>
<html lang="${metadata.lang || 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  ${keywordsString ? `<meta name="keywords" content="${keywordsString}">` : ''}
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${this.options.baseUrl}${route}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  
  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${this.options.baseUrl}${route}">
  <meta property="twitter:title" content="${title}">
  <meta property="twitter:description" content="${description}">
  
  <!-- Critical CSS -->
  ${criticalCSS ? `<style>${criticalCSS}</style>` : ''}
  
  <!-- Preload data -->
  ${Object.keys(preloadData).length > 0 ? `<script id="ssr-data" type="application/json">${JSON.stringify(preloadData)}</script>` : ''}
  
  <!-- SSR metadata -->
  <meta name="ssr-rendered" content="true">
  <meta name="ssr-build-time" content="${this.ssrContext.buildTime}">
</head>
<body>
  <div id="app">${content}</div>
  
  <!-- Hydration script will be injected here -->
  <script>
    // SSR hydration marker
    window.__SSR_DATA__ = ${JSON.stringify(preloadData)};
    window.__SSR_ROUTE__ = "${route}";
    window.__SSR_RENDERED__ = true;
  </script>
</body>
</html>`;
  }

  /**
   * Extract route parameters from dynamic routes
   */
  extractRouteParams(route) {
    const params = {};

    // Simple parameter extraction for SSR
    // In production, you'd use the actual route matching logic
    const paramMatches = route.match(/\[([^\]]+)\]/g) || [];
    paramMatches.forEach(match => {
      const paramName = match.replace('[', '').replace(']', '');
      params[paramName] = `mock-${paramName}`;
    });

    return params;
  }

  /**
   * Get output file path for a route
   */
  getOutputPath(route) {
    let filePath = route;

    if (filePath === '/') {
      filePath = '/index';
    }

    // Remove leading slash and add .html extension
    filePath = filePath.replace(/^\//, '') + '.html';

    return path.join(this.options.outputDir, filePath);
  }

  /**
   * Write HTML file to disk
   */
  async writeHTMLFile(outputPath, html) {
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });

    let finalHTML = html;

    if (this.options.minifyHTML) {
      // Simple HTML minification
      finalHTML = html
        .replace(/\s+/g, ' ')
        .replace(/>\s+</g, '><')
        .trim();
    }

    await fs.writeFile(outputPath, finalHTML, 'utf-8');
  }

  /**
   * Ensure output directory exists
   */
  async ensureOutputDirectory() {
    await fs.mkdir(this.options.outputDir, { recursive: true });
  }

  /**
   * Generate additional assets (sitemap, robots.txt, etc.)
   */
  async generateAdditionalAssets(renderResults, routeManifest) {
    console.log('📄 Generating additional assets...');

    // Generate sitemap
    if (this.options.generateSitemap) {
      await this.generateSitemap(renderResults);
    }

    // Generate robots.txt
    await this.generateRobotsTxt();

    // Generate route manifest for client-side hydration
    await this.generateClientRouteManifest(routeManifest);

    // Generate critical CSS bundle
    if (this.options.extractCriticalCSS) {
      await this.generateCriticalCSSBundle();
    }
  }

  /**
   * Generate sitemap.xml
   */
  async generateSitemap(renderResults) {
    const successfulPages = renderResults.filter(r => r.success);

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${successfulPages.map(page => `  <url>
    <loc>${this.options.baseUrl}${page.route}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${page.route === '/' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>`;

    await fs.writeFile(path.join(this.options.outputDir, 'sitemap.xml'), sitemap);
    console.log('✅ Generated sitemap.xml');
  }

  /**
   * Generate robots.txt
   */
  async generateRobotsTxt() {
    const robots = `User-agent: *
Allow: /

Sitemap: ${this.options.baseUrl}/sitemap.xml`;

    await fs.writeFile(path.join(this.options.outputDir, 'robots.txt'), robots);
    console.log('✅ Generated robots.txt');
  }

  /**
   * Generate client-side route manifest
   */
  async generateClientRouteManifest(routeManifest) {
    const clientManifest = {
      ...routeManifest,
      ssrGenerated: true,
      buildTime: this.ssrContext.buildTime
    };

    await fs.writeFile(
      path.join(this.options.outputDir, 'route-manifest.json'),
      JSON.stringify(clientManifest, null, 2)
    );
    console.log('✅ Generated client route manifest');
  }

  /**
   * Generate critical CSS bundle
   */
  async generateCriticalCSSBundle() {
    const allCriticalCSS = Array.from(this.pageStyles.values()).join('\n');

    if (allCriticalCSS) {
      await fs.writeFile(
        path.join(this.options.outputDir, 'critical.css'),
        allCriticalCSS
      );
      console.log('✅ Generated critical CSS bundle');
    }
  }

  /**
   * Clean up resources
   */
  close() {
    if (this.pageScanner) {
      this.pageScanner.close();
    }
    if (this.routeGenerator) {
      this.routeGenerator.close();
    }

    // Clear caches
    this.dataCache.clear();
    this.pageStyles.clear();
    this.criticalCSS.clear();

    console.log('🔒 SSR renderer closed');
  }
}

export function createSSRRenderer(options = {}) {
  return new SSRRenderer(options);
}

export default SSRRenderer;