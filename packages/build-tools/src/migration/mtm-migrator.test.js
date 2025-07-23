/**
 * Tests for MTM Migrator
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { MTMMigrator } from './mtm-migrator.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('MTMMigrator', () => {
  let migrator;
  let tempDir;

  beforeEach(async () => {
    migrator = new MTMMigrator({
      backupOriginals: false,
      generateReport: false,
      dryRun: true
    });

    // Create temporary directory for tests
    tempDir = path.join(__dirname, 'temp-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('migrateFile', () => {
    it('should migrate legacy format to modern format', async () => {
      const legacyContent = `---
page_title: Legacy Page
page_description: Legacy description
meta_keywords: legacy, test
template: main
route: en:/test, fr:/teste
---

$count = createSignal(0)
$mount = () => console.log('mounted')

<div class="page">
  <h1>Test</h1>
  <button onClick={increment}>Click</button>
</div>`;

      const testFile = path.join(tempDir, 'legacy.mtm');
      await fs.writeFile(testFile, legacyContent);

      const result = await migrator.migrateFile(testFile);

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(6); // title, description, keywords, layout, route, signal syntax
      expect(result.changes.some(c => c.type === 'field_rename')).toBe(true);
      expect(result.changes.some(c => c.type === 'route_format')).toBe(true);
    });

    it('should skip files that are already in modern format', async () => {
      const modernContent = `---
route: /modern
title: Modern Page
description: Modern description
keywords: [modern, test]
layout: default
---

$count! = signal('counter', 0)

<template>
  <div>Modern content</div>
</template>`;

      const testFile = path.join(tempDir, 'modern.mtm');
      await fs.writeFile(testFile, modernContent);

      const result = await migrator.migrateFile(testFile);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('Already in modern format');
    });

    it('should handle malformed frontmatter gracefully', async () => {
      const malformedContent = `---
title: Test
invalid line without colon
: empty key
---

<div>Content</div>`;

      const testFile = path.join(tempDir, 'malformed.mtm');
      await fs.writeFile(testFile, malformedContent);

      const result = await migrator.migrateFile(testFile);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('YAML parsing error');
    });

    it('should add required fields if missing', async () => {
      const minimalContent = `---
route: /minimal
---

<div>Minimal content</div>`;

      const testFile = path.join(tempDir, 'minimal.mtm');
      await fs.writeFile(testFile, minimalContent);

      const result = await migrator.migrateFile(testFile);

      expect(result.success).toBe(true);
      expect(result.changes.some(c => c.type === 'required_field' && c.description.includes('title'))).toBe(true);
      expect(result.changes.some(c => c.type === 'required_field' && c.description.includes('description'))).toBe(true);
    });
  });

  describe('detectAndMigrate', () => {
    it('should detect legacy route format', () => {
      const frontmatter = { route: 'en:/home, fr:/accueil' };
      const content = '<div>Test</div>';

      const result = migrator.detectAndMigrate(frontmatter, content, 'test.mtm');

      expect(result.needsMigration).toBe(true);
      expect(result.frontmatter.route).toEqual({ en: '/home', fr: '/accueil' });
      expect(result.frontmatter.locales).toEqual(['en', 'fr']);
    });

    it('should migrate legacy signal syntax', () => {
      const frontmatter = { route: '/test' };
      const content = '$count = createSignal(0)\n$name = createSignal("test")';

      const result = migrator.detectAndMigrate(frontmatter, content, 'test.mtm');

      expect(result.needsMigration).toBe(true);
      expect(result.content).toContain('$count! = signal(\'count\', 0)');
      expect(result.content).toContain('$name! = signal(\'name\', "test")');
    });

    it('should migrate legacy event syntax', () => {
      const frontmatter = { route: '/test' };
      const content = '<button onClick={handleClick}>Click</button>';

      const result = migrator.detectAndMigrate(frontmatter, content, 'test.mtm');

      expect(result.needsMigration).toBe(true);
      expect(result.content).toContain('click={handleClick}');
    });

    it('should wrap content in template if needed', () => {
      const frontmatter = { route: '/test' };
      const content = '<div class="page">Content</div>';

      const result = migrator.detectAndMigrate(frontmatter, content, 'test.mtm');

      expect(result.needsMigration).toBe(true);
      expect(result.content).toContain('<template>');
      expect(result.content).toContain('</template>');
    });
  });

  describe('migrate', () => {
    it('should migrate multiple files', async () => {
      // Create test files
      const files = [
        {
          name: 'page1.mtm',
          content: `---
page_title: Page 1
route: /page1
---
<div>Page 1</div>`
        },
        {
          name: 'page2.mtm',
          content: `---
title: Page 2
route: /page2
---
<template><div>Page 2</div></template>`
        }
      ];

      for (const file of files) {
        await fs.writeFile(path.join(tempDir, file.name), file.content);
      }

      const report = await migrator.migrate([tempDir]);

      expect(report.totalFiles).toBe(2);
      expect(report.migratedFiles).toBe(1); // Only page1.mtm needs migration
      expect(report.skippedFiles).toBe(1); // page2.mtm is already modern
    });

    it('should handle directory scanning', async () => {
      // Create nested directory structure
      const pagesDir = path.join(tempDir, 'pages');
      const componentsDir = path.join(tempDir, 'components');

      await fs.mkdir(pagesDir, { recursive: true });
      await fs.mkdir(componentsDir, { recursive: true });

      await fs.writeFile(path.join(pagesDir, 'index.mtm'), `---
route: /
title: Home
---
<template><div>Home</div></template>`);

      await fs.writeFile(path.join(componentsDir, 'button.mtm'), `---
title: Button Component
---
<template><button>Click me</button></template>`);

      const report = await migrator.migrate([tempDir]);

      expect(report.totalFiles).toBe(2);
    });
  });

  describe('isOldRouteFormat', () => {
    it('should detect comma-separated route format', () => {
      expect(migrator.isOldRouteFormat('en:/home, fr:/accueil')).toBe(true);
      expect(migrator.isOldRouteFormat('/modern-route')).toBe(false);
    });

    it('should detect array with colon format', () => {
      expect(migrator.isOldRouteFormat(['en:/home', 'fr:/accueil'])).toBe(true);
      expect(migrator.isOldRouteFormat(['/route1', '/route2'])).toBe(false);
    });
  });

  describe('migrateRouteFormat', () => {
    it('should migrate comma-separated routes', () => {
      const result = migrator.migrateRouteFormat('en:/home, fr:/accueil, es:/inicio');

      expect(result.route).toEqual({
        en: '/home',
        fr: '/accueil',
        es: '/inicio'
      });
      expect(result.locales).toEqual(['en', 'fr', 'es']);
    });

    it('should migrate array routes with colons', () => {
      const result = migrator.migrateRouteFormat(['en:/about', 'fr:/a-propos']);

      expect(result.route).toEqual({
        en: '/about',
        fr: '/a-propos'
      });
      expect(result.locales).toEqual(['en', 'fr']);
    });

    it('should handle single route', () => {
      const result = migrator.migrateRouteFormat('/single-route');

      expect(result.route).toBe('/single-route');
      expect(result.locales).toBeUndefined();
    });
  });

  describe('addRequiredFields', () => {
    it('should add missing title', () => {
      const frontmatter = { route: '/test' };
      const result = migrator.addRequiredFields(frontmatter, 'test-page.mtm');

      expect(result.frontmatter.title).toBe('Test Page');
      expect(result.changed).toBe(true);
      expect(result.changes.some(c => c.type === 'required_field' && c.description.includes('title'))).toBe(true);
    });

    it('should add missing description', () => {
      const frontmatter = { route: '/test', title: 'Test' };
      const result = migrator.addRequiredFields(frontmatter, 'test.mtm');

      expect(result.frontmatter.description).toBe('Page description for test');
      expect(result.changed).toBe(true);
    });

    it('should add empty keywords array', () => {
      const frontmatter = { route: '/test', title: 'Test', description: 'Test page' };
      const result = migrator.addRequiredFields(frontmatter, 'test.mtm');

      expect(result.frontmatter.keywords).toEqual([]);
      expect(result.changed).toBe(true);
    });

    it('should not modify if all required fields exist', () => {
      const frontmatter = {
        route: '/test',
        title: 'Test',
        description: 'Test page',
        keywords: ['test']
      };
      const result = migrator.addRequiredFields(frontmatter, 'test.mtm');

      expect(result.changed).toBe(false);
      expect(result.changes).toHaveLength(0);
    });
  });
});