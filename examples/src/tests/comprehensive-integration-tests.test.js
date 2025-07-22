/**
 * Comprehensive Integration Tests for Ultra-Modern MTM System
 * Tests complete build pipeline, navigation flows, SSR rendering, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

// Import integration components
import { UltraModernRouter } from '../shared/ultra-modern-router.js';
import { PageScanner } from '../build-tools/page-scanner.js';
import { RouteManifestGenerator } from '../build-tools/route-manifest-generator.js';
import { createSSRRenderer } from '../build-tools/ssr-renderer.js';

describe('Comprehensive Integration Tests', () => {
  let testDir;
  let cleanupTasks;

  beforeEach(async () => {
    testDir = path.join(process.cwd(), 'test-integration-' + Date.now());
    cleanupTasks = [];

    // Create test directory structure
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(path.join(testDir, 'src', 'pages'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'dist'), { recursive: true });
  });

  afterEach(async () => {
    // Cleanup test files and resources
    for (const cleanup of cleanupTasks) {
      try {
        await cleanup();
      } catch (error) {
        console.warn('Cleanup error:', error.message);
      }
    }

    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Directory cleanup error:', error.message);
    }
  });

  describe('Complete Build Pipeline Integration', () => {
    it('should process MTM files through complete build pipeline', async () => {
      // Create test MTM files
      const indexMTM = `---
route: /
title: Home Page
description: Welcome to our MTM application
keywords: [home, mtm, ssr]
layout: default
---

$welcomeMessage! = "Welcome to Ultra-Modern MTM!"
$userCount! = 0

$incrementUsers = () => {
  $userCount++
}

<template>
  <div class="home-page">
    <h1>{$welcomeMessage}</h1>
    <p>Current users: {$userCount}</p>
    <button click={$incrementUsers}>Add User</button>
  </div>
</template>`;

      const aboutMTM = `---
route: /about
title: About Us
description: Learn more about our company
keywords: [about, company, team]
layout: default
---

$teamMembers! = [
  { name: "Alice", role: "Developer" },
  { name: "Bob", role: "Designer" }
]

<template>
  <div class="about-page">
    <h1>About Our Team</h1>
    {#each $teamMembers as member}
      <div class="team-card">
        <h3>{member.name}</h3>
        <p>{member.role}</p>
      </div>
    {/each}
  </div>
</template>`;

      // Write test files
      await fs.writeFile(path.join(testDir, 'src', 'pages', 'index.mtm'), indexMTM);
      await fs.writeFile(path.join(testDir, 'src', 'pages', 'about.mtm'), aboutMTM);

      // Create page scanner and process files
      const scanner = new PageScanner();
      const pages = await scanner.scanPages(path.join(testDir, 'src', 'pages'));

      expect(pages).toHaveLength(2);
      expect(pages.some(p => p.route === '/')).toBe(true);
      expect(pages.some(p => p.route === '/about')).toBe(true);

      // Generate route manifest
      const generator = new RouteManifestGenerator();
      const manifest = generator.generateManifest(pages);

      expect(Object.keys(manifest.staticRoutes)).toHaveLength(2);

      // Test SSR rendering
      const renderer = createSSRRenderer({
        pagesDir: path.join(testDir, 'src', 'pages'),
        outputDir: path.join(testDir, 'dist'),
        baseUrl: 'http://localhost:3000'
      });

      cleanupTasks.push(() => renderer.close());

      const renderResults = await renderer.renderAllPages();

      expect(renderResults.success).toBe(true);
      expect(renderResults.pages.length).toBeGreaterThan(0);
    });
  });

  describe('Navigation Flow Integration', () => {
    let router;
    let mockWindow;

    beforeEach(() => {
      mockWindow = {
        location: { pathname: '/', search: '', origin: 'http://localhost:3000' },
        history: { pushState: vi.fn(), replaceState: vi.fn(), back: vi.fn(), forward: vi.fn() },
        addEventListener: vi.fn(),
        URL: class MockURL {
          constructor(url, base) {
            const fullUrl = url.startsWith('http') ? url : base + url;
            const [pathname, search] = fullUrl.replace('http://localhost:3000', '').split('?');
            this.pathname = pathname || '/';
            this.search = search ? '?' + search : '';
            this.searchParams = new URLSearchParams(search || '');
          }
        }
      };

      global.window = mockWindow;
      global.document = {
        querySelector: vi.fn(() => ({ innerHTML: '', appendChild: vi.fn() })),
        addEventListener: vi.fn()
      };
      global.URL = mockWindow.URL;

      router = new UltraModernRouter();
    });

    it('should handle complete navigation flows', async () => {
      const homeLoader = vi.fn(() => Promise.resolve({ default: () => 'Home' }));
      const aboutLoader = vi.fn(() => Promise.resolve({ default: () => 'About' }));
      const notFoundLoader = vi.fn(() => Promise.resolve({ default: () => '404' }));

      router.registerRoute('/', homeLoader);
      router.registerRoute('/about', aboutLoader);
      router.registerRoute('/404', notFoundLoader);

      await router.push('/');
      expect(homeLoader).toHaveBeenCalled();

      await router.push('/about');
      expect(aboutLoader).toHaveBeenCalled();

      await router.push('/non-existent');
      expect(notFoundLoader).toHaveBeenCalled();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle build pipeline errors gracefully', async () => {
      const invalidMTM = `---
route: /invalid
title: "Unclosed quote
---
Invalid content`;

      await fs.writeFile(path.join(testDir, 'src', 'pages', 'invalid.mtm'), invalidMTM);

      const scanner = new PageScanner();
      const pages = await scanner.scanPages(path.join(testDir, 'src', 'pages'));

      expect(pages).toBeDefined();
    });
  });
});