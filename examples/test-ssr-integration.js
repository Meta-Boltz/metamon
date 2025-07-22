/**
 * Integration test for SSR Renderer
 * Tests the complete SSR rendering pipeline with real files
 */

import { createSSRRenderer } from './src/build-tools/ssr-renderer.js';
import fs from 'fs/promises';
import path from 'path';

async function testSSRIntegration() {
  console.log('🧪 Testing SSR Renderer Integration...\n');

  try {
    // Create test pages directory
    const testPagesDir = 'test-ssr-pages';
    const testOutputDir = 'test-ssr-output';

    await fs.mkdir(testPagesDir, { recursive: true });
    await fs.mkdir(testOutputDir, { recursive: true });

    // Create test .mtm files
    const testPages = [
      {
        path: path.join(testPagesDir, 'index.mtm'),
        content: `---
title: "SSR Test Home"
description: "Home page for SSR testing"
keywords: ["ssr", "test", "home"]
route: "/"
layout: "default"
dataFetch: "/api/posts"
---

<div class="container">
  <header class="header">
    <h1>Welcome to SSR Test</h1>
    <nav class="nav">
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/blog">Blog</a>
    </nav>
  </header>
  
  <main class="main">
    <div class="hero">
      <h2>Server-Side Rendered Page</h2>
      <p>This page was pre-rendered at build time with full HTML content.</p>
      <button class="btn" onclick="alert('Interactive!')">Click Me</button>
    </div>
    
    <section class="posts">
      <h3>Latest Posts</h3>
      <div class="grid">
        <div class="card">
          <h4>Post 1</h4>
          <p>This is the first post content.</p>
        </div>
        <div class="card">
          <h4>Post 2</h4>
          <p>This is the second post content.</p>
        </div>
      </div>
    </section>
  </main>
  
  <footer class="footer">
    <p>&copy; 2024 SSR Test Site</p>
  </footer>
</div>`
      },
      {
        path: path.join(testPagesDir, 'about.mtm'),
        content: `---
title: "About - SSR Test"
description: "About page for SSR testing"
keywords: ["about", "ssr", "test"]
route: "/about"
layout: "default"
---

<div class="container">
  <header class="header">
    <h1>About Us</h1>
    <nav class="nav">
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/blog">Blog</a>
    </nav>
  </header>
  
  <main class="main">
    <div class="content">
      <h2>About This SSR Test</h2>
      <p>This page demonstrates server-side rendering capabilities of the Ultra-Modern MTM system.</p>
      
      <div class="features">
        <h3>Features Tested:</h3>
        <ul>
          <li>Frontmatter parsing and processing</li>
          <li>HTML generation with proper metadata</li>
          <li>Critical CSS extraction</li>
          <li>SEO optimization</li>
          <li>Static asset generation</li>
        </ul>
      </div>
    </div>
  </main>
  
  <footer class="footer">
    <p>&copy; 2024 SSR Test Site</p>
  </footer>
</div>`
      },
      {
        path: path.join(testPagesDir, 'blog', '[slug].mtm'),
        content: `---
title: "Blog Post - SSR Test"
description: "Dynamic blog post page"
keywords: ["blog", "post", "dynamic"]
route: "/blog/[slug]"
layout: "blog"
dataFetch: 
  api: "/api/posts"
  static: "blog-data.json"
---

<div class="container">
  <header class="header">
    <h1>Blog Post</h1>
    <nav class="nav">
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/blog">Blog</a>
    </nav>
  </header>
  
  <main class="main">
    <article class="post">
      <h2>Dynamic Blog Post: [slug]</h2>
      <p>This is a dynamic route that handles blog posts with different slugs.</p>
      
      <div class="post-content">
        <p>The slug parameter would be: <strong>[slug]</strong></p>
        <p>This demonstrates dynamic route handling in SSR.</p>
      </div>
      
      <div class="post-meta">
        <p>Published: <time>2024-01-01</time></p>
        <p>Author: SSR Test</p>
      </div>
    </article>
  </main>
  
  <footer class="footer">
    <p>&copy; 2024 SSR Test Site</p>
  </footer>
</div>`
      },
      {
        path: path.join(testPagesDir, '404.mtm'),
        content: `---
title: "Page Not Found - SSR Test"
description: "404 error page"
keywords: ["404", "error", "not found"]
route: "/404"
layout: "error"
status: 404
---

<div class="container">
  <header class="header">
    <h1>SSR Test Site</h1>
    <nav class="nav">
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/blog">Blog</a>
    </nav>
  </header>
  
  <main class="main">
    <div class="error-page">
      <h2>404 - Page Not Found</h2>
      <p>The page you're looking for doesn't exist.</p>
      
      <div class="error-actions">
        <a href="/" class="btn">Go Home</a>
        <button class="btn" onclick="history.back()">Go Back</button>
      </div>
      
      <div class="search">
        <h3>Search our site:</h3>
        <input type="text" placeholder="Search..." class="search-input">
        <button class="btn">Search</button>
      </div>
    </div>
  </main>
  
  <footer class="footer">
    <p>&copy; 2024 SSR Test Site</p>
  </footer>
</div>`
      }
    ];

    // Write test pages
    for (const page of testPages) {
      await fs.mkdir(path.dirname(page.path), { recursive: true });
      await fs.writeFile(page.path, page.content);
    }

    console.log(`✅ Created ${testPages.length} test pages`);

    // Create SSR renderer
    const renderer = createSSRRenderer({
      pagesDir: testPagesDir,
      outputDir: testOutputDir,
      baseUrl: 'http://localhost:3000',
      generateStaticHTML: true,
      extractCriticalCSS: true,
      enableDataFetching: true,
      framework: 'vanilla',
      minifyHTML: false, // Keep readable for testing
      generateSitemap: true
    });

    console.log('📦 Created SSR renderer with test configuration');

    // Render all pages
    const renderResult = await renderer.renderAllPages();

    console.log('\n📊 Render Results:');
    console.log(`- Success: ${renderResult.success}`);
    console.log(`- Total pages: ${renderResult.pages.length}`);
    console.log(`- Successful renders: ${renderResult.pages.filter(p => p.success).length}`);
    console.log(`- Failed renders: ${renderResult.pages.filter(p => !p.success).length}`);

    // Verify generated files
    console.log('\n🔍 Verifying generated files...');

    const expectedFiles = [
      'index.html',
      'about.html',
      'blog/[slug].html',
      '404.html',
      'sitemap.xml',
      'robots.txt',
      'route-manifest.json'
    ];

    for (const file of expectedFiles) {
      const filePath = path.join(testOutputDir, file);
      try {
        const stats = await fs.stat(filePath);
        console.log(`✅ ${file} (${stats.size} bytes)`);
      } catch (error) {
        console.log(`❌ ${file} - Not found`);
      }
    }

    // Verify HTML content
    console.log('\n📄 Verifying HTML content...');

    const indexHTML = await fs.readFile(path.join(testOutputDir, 'index.html'), 'utf-8');

    // Check basic HTML structure
    const htmlChecks = [
      { name: 'DOCTYPE', test: indexHTML.includes('<!DOCTYPE html>') },
      { name: 'Title', test: indexHTML.includes('<title>SSR Test Home</title>') },
      { name: 'Meta description', test: indexHTML.includes('Home page for SSR testing') },
      { name: 'Meta keywords', test: indexHTML.includes('ssr, test, home') },
      { name: 'Open Graph', test: indexHTML.includes('property="og:title"') },
      { name: 'Twitter meta', test: indexHTML.includes('property="twitter:title"') },
      { name: 'SSR marker', test: indexHTML.includes('name="ssr-rendered"') },
      { name: 'Content', test: indexHTML.includes('Welcome to SSR Test') },
      { name: 'Navigation', test: indexHTML.includes('class="nav"') },
      { name: 'Critical CSS', test: indexHTML.includes('<style>') },
      { name: 'SSR data', test: indexHTML.includes('window.__SSR_DATA__') }
    ];

    htmlChecks.forEach(check => {
      console.log(`${check.test ? '✅' : '❌'} ${check.name}`);
    });

    // Verify sitemap
    console.log('\n🗺️ Verifying sitemap...');

    const sitemap = await fs.readFile(path.join(testOutputDir, 'sitemap.xml'), 'utf-8');
    const sitemapChecks = [
      { name: 'XML declaration', test: sitemap.includes('<?xml version="1.0"') },
      { name: 'Sitemap namespace', test: sitemap.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"') },
      { name: 'Home URL', test: sitemap.includes('<loc>http://localhost:3000/</loc>') },
      { name: 'About URL', test: sitemap.includes('<loc>http://localhost:3000/about</loc>') },
      { name: 'Last modified', test: sitemap.includes('<lastmod>') },
      { name: 'Priority', test: sitemap.includes('<priority>') }
    ];

    sitemapChecks.forEach(check => {
      console.log(`${check.test ? '✅' : '❌'} ${check.name}`);
    });

    // Verify robots.txt
    console.log('\n🤖 Verifying robots.txt...');

    const robots = await fs.readFile(path.join(testOutputDir, 'robots.txt'), 'utf-8');
    const robotsChecks = [
      { name: 'User-agent', test: robots.includes('User-agent: *') },
      { name: 'Allow directive', test: robots.includes('Allow: /') },
      { name: 'Sitemap reference', test: robots.includes('Sitemap: http://localhost:3000/sitemap.xml') }
    ];

    robotsChecks.forEach(check => {
      console.log(`${check.test ? '✅' : '❌'} ${check.name}`);
    });

    // Verify route manifest
    console.log('\n📋 Verifying route manifest...');

    const manifest = JSON.parse(await fs.readFile(path.join(testOutputDir, 'route-manifest.json'), 'utf-8'));
    const manifestChecks = [
      { name: 'SSR generated flag', test: manifest.ssrGenerated === true },
      { name: 'Build time', test: typeof manifest.buildTime === 'string' },
      { name: 'Static routes', test: Object.keys(manifest.staticRoutes).length > 0 },
      { name: 'Home route', test: manifest.staticRoutes['/'] !== undefined },
      { name: 'About route', test: manifest.staticRoutes['/about'] !== undefined },
      { name: 'Dynamic routes', test: Array.isArray(manifest.dynamicRoutes) }
    ];

    manifestChecks.forEach(check => {
      console.log(`${check.test ? '✅' : '❌'} ${check.name}`);
    });

    // Performance metrics
    console.log('\n⚡ Performance metrics...');

    const totalSize = renderResult.pages.reduce((sum, page) => sum + (page.size || 0), 0);
    const avgSize = totalSize / renderResult.pages.filter(p => p.success).length;

    console.log(`- Total HTML size: ${(totalSize / 1024).toFixed(2)} KB`);
    console.log(`- Average page size: ${(avgSize / 1024).toFixed(2)} KB`);
    console.log(`- Pages with critical CSS: ${renderResult.pages.filter(p => p.criticalCSS).length}`);

    // Clean up
    renderer.close();

    console.log('\n🧹 Cleaning up test files...');
    await fs.rm(testPagesDir, { recursive: true, force: true });
    await fs.rm(testOutputDir, { recursive: true, force: true });

    console.log('\n🎉 SSR Integration Test Complete!');

    const allChecks = [...htmlChecks, ...sitemapChecks, ...robotsChecks, ...manifestChecks];
    const passedChecks = allChecks.filter(check => check.test).length;
    const totalChecks = allChecks.length;

    console.log(`\n📈 Overall Results: ${passedChecks}/${totalChecks} checks passed (${((passedChecks / totalChecks) * 100).toFixed(1)}%)`);

    if (passedChecks === totalChecks) {
      console.log('✅ All tests passed! SSR renderer is working correctly.');
      return true;
    } else {
      console.log('⚠️ Some tests failed. Check the output above for details.');
      return false;
    }

  } catch (error) {
    console.error('❌ SSR Integration Test Failed:', error);
    return false;
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testSSRIntegration()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { testSSRIntegration };