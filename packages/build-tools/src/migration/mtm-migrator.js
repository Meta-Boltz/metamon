/**
 * MTM Migration Utility
 * Converts existing .mtm files to new ultra-modern format
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { FrontmatterParser } from '../../../examples/src/build-tools/frontmatter-parser.js';

export class MTMMigrator {
  constructor(options = {}) {
    this.options = {
      backupOriginals: true,
      validateAfterMigration: true,
      generateReport: true,
      dryRun: false,
      ...options
    };

    this.parser = new FrontmatterParser();
    this.migrationReport = {
      totalFiles: 0,
      migratedFiles: 0,
      skippedFiles: 0,
      errors: [],
      warnings: [],
      changes: []
    };
  }

  /**
   * Migrate a single MTM file
   * @param {string} filePath - Path to the MTM file
   * @returns {Promise<MigrationResult>}
   */
  async migrateFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const originalContent = content;

      // Parse existing frontmatter
      const parseResult = this.parser.parse(content);

      if (!parseResult.isValid) {
        return {
          success: false,
          filePath,
          errors: parseResult.errors,
          warnings: [],
          changes: []
        };
      }

      // Detect current format and migrate
      const migrationResult = this.detectAndMigrate(parseResult.frontmatter, parseResult.content, filePath);

      if (!migrationResult.needsMigration) {
        return {
          success: true,
          filePath,
          skipped: true,
          reason: 'Already in modern format',
          errors: [],
          warnings: [],
          changes: []
        };
      }

      const newContent = this.reconstructFile(migrationResult.frontmatter, migrationResult.content);

      // Backup original if requested
      if (this.options.backupOriginals && !this.options.dryRun) {
        const backupPath = `${filePath}.backup`;
        await fs.writeFile(backupPath, originalContent);
      }

      // Write migrated content
      if (!this.options.dryRun) {
        await fs.writeFile(filePath, newContent);
      }

      // Validate migrated content
      if (this.options.validateAfterMigration) {
        const validationResult = this.parser.parse(newContent);
        if (!validationResult.isValid) {
          migrationResult.warnings.push({
            type: 'validation_warning',
            message: 'Migrated file has validation issues',
            details: validationResult.errors
          });
        }
      }

      return {
        success: true,
        filePath,
        errors: [],
        warnings: migrationResult.warnings,
        changes: migrationResult.changes,
        originalSize: originalContent.length,
        newSize: newContent.length
      };

    } catch (error) {
      return {
        success: false,
        filePath,
        errors: [{
          type: 'file_error',
          message: `Failed to migrate file: ${error.message}`,
          suggestion: 'Check file permissions and syntax'
        }],
        warnings: [],
        changes: []
      };
    }
  }

  /**
   * Migrate multiple files or directories
   * @param {string|string[]} paths - File paths or directory paths
   * @returns {Promise<MigrationReport>}
   */
  async migrate(paths) {
    const filePaths = Array.isArray(paths) ? paths : [paths];
    const mtmFiles = [];

    // Collect all MTM files
    for (const inputPath of filePaths) {
      const stat = await fs.stat(inputPath);
      if (stat.isDirectory()) {
        const dirFiles = await this.findMTMFiles(inputPath);
        mtmFiles.push(...dirFiles);
      } else if (inputPath.endsWith('.mtm')) {
        mtmFiles.push(inputPath);
      }
    }

    this.migrationReport.totalFiles = mtmFiles.length;

    // Migrate each file
    for (const filePath of mtmFiles) {
      const result = await this.migrateFile(filePath);

      if (result.success) {
        if (result.skipped) {
          this.migrationReport.skippedFiles++;
        } else {
          this.migrationReport.migratedFiles++;
          this.migrationReport.changes.push(...result.changes);
        }
        this.migrationReport.warnings.push(...result.warnings);
      } else {
        this.migrationReport.errors.push(...result.errors);
      }
    }

    // Generate report
    if (this.options.generateReport) {
      await this.generateMigrationReport();
    }

    return this.migrationReport;
  }

  /**
   * Detect current format and perform migration
   * @private
   */
  detectAndMigrate(frontmatter, content, filePath) {
    const changes = [];
    const warnings = [];
    let needsMigration = false;
    let migratedFrontmatter = { ...frontmatter };
    let migratedContent = content;

    // Check for old-style route definitions
    if (this.isOldRouteFormat(frontmatter.route)) {
      const newRoute = this.migrateRouteFormat(frontmatter.route);
      migratedFrontmatter.route = newRoute.route;
      if (newRoute.locales) {
        migratedFrontmatter.locales = newRoute.locales;
      }
      changes.push({
        type: 'route_format',
        description: 'Updated route format to new standard',
        before: frontmatter.route,
        after: migratedFrontmatter.route
      });
      needsMigration = true;
    }

    // Migrate frontmatter structure
    const structureMigration = this.migrateFrontmatterStructure(migratedFrontmatter);
    if (structureMigration.changed) {
      migratedFrontmatter = structureMigration.frontmatter;
      changes.push(...structureMigration.changes);
      needsMigration = true;
    }

    // Migrate template syntax
    const templateMigration = this.migrateTemplateSyntax(migratedContent, filePath);
    if (templateMigration.changed) {
      migratedContent = templateMigration.content;
      changes.push(...templateMigration.changes);
      warnings.push(...templateMigration.warnings);
      needsMigration = true;
    }

    // Add required fields if missing
    const requiredFields = this.addRequiredFields(migratedFrontmatter, filePath);
    if (requiredFields.changed) {
      migratedFrontmatter = requiredFields.frontmatter;
      changes.push(...requiredFields.changes);
      needsMigration = true;
    }

    return {
      needsMigration,
      frontmatter: migratedFrontmatter,
      content: migratedContent,
      changes,
      warnings
    };
  }

  /**
   * Check if route format is old style
   * @private
   */
  isOldRouteFormat(route) {
    if (!route) return false;

    // Old format indicators:
    // - String with locale prefixes like "en:/path, fr:/chemin"
    // - Object with non-standard structure
    // - Array with mixed formats

    if (typeof route === 'string' && route.includes(',')) {
      return true;
    }

    if (Array.isArray(route)) {
      return route.some(r => typeof r === 'string' && r.includes(':'));
    }

    return false;
  }

  /**
   * Migrate route format to new standard
   * @private
   */
  migrateRouteFormat(oldRoute) {
    if (typeof oldRoute === 'string' && oldRoute.includes(',')) {
      // Handle "en:/path, fr:/chemin" format
      const routes = {};
      const locales = [];

      oldRoute.split(',').forEach(routePart => {
        const [locale, path] = routePart.trim().split(':');
        if (locale && path) {
          routes[locale] = path;
          locales.push(locale);
        }
      });

      return { route: routes, locales };
    }

    if (Array.isArray(oldRoute)) {
      // Handle array with locale:path format
      const routes = {};
      const locales = [];

      oldRoute.forEach(routePart => {
        if (typeof routePart === 'string' && routePart.includes(':')) {
          const [locale, path] = routePart.split(':');
          routes[locale] = path;
          locales.push(locale);
        }
      });

      if (Object.keys(routes).length > 0) {
        return { route: routes, locales };
      }
    }

    return { route: oldRoute };
  }

  /**
   * Migrate frontmatter structure to new format
   * @private
   */
  migrateFrontmatterStructure(frontmatter) {
    const changes = [];
    let changed = false;
    const migrated = { ...frontmatter };

    // Migrate old field names
    const fieldMappings = {
      'page_title': 'title',
      'page_description': 'description',
      'meta_keywords': 'keywords',
      'template': 'layout',
      'http_status': 'status'
    };

    Object.entries(fieldMappings).forEach(([oldField, newField]) => {
      if (migrated[oldField] && !migrated[newField]) {
        migrated[newField] = migrated[oldField];
        delete migrated[oldField];
        changes.push({
          type: 'field_rename',
          description: `Renamed field '${oldField}' to '${newField}'`,
          before: oldField,
          after: newField
        });
        changed = true;
      }
    });

    // Normalize keywords format
    if (migrated.keywords && typeof migrated.keywords === 'string') {
      migrated.keywords = migrated.keywords.split(',').map(k => k.trim());
      changes.push({
        type: 'keywords_format',
        description: 'Converted keywords from string to array',
        before: frontmatter.keywords,
        after: migrated.keywords
      });
      changed = true;
    }

    // Add default layout if missing
    if (!migrated.layout) {
      migrated.layout = 'default';
      changes.push({
        type: 'default_layout',
        description: 'Added default layout',
        after: 'default'
      });
      changed = true;
    }

    return { frontmatter: migrated, changes, changed };
  }

  /**
   * Migrate template syntax to ultra-modern format
   * @private
   */
  migrateTemplateSyntax(content, filePath) {
    const changes = [];
    const warnings = [];
    let changed = false;
    let migrated = content;

    // Migrate old signal syntax
    const oldSignalPattern = /\$(\w+)\s*=\s*createSignal\(([^)]+)\)/g;
    migrated = migrated.replace(oldSignalPattern, (match, name, value) => {
      changes.push({
        type: 'signal_syntax',
        description: `Updated signal syntax for ${name}`,
        before: match,
        after: `$${name}! = signal('${name}', ${value})`
      });
      changed = true;
      return `$${name}! = signal('${name}', ${value})`;
    });

    // Migrate old event syntax
    const oldEventPattern = /on(\w+)=\{([^}]+)\}/g;
    migrated = migrated.replace(oldEventPattern, (match, event, handler) => {
      const newSyntax = `${event.toLowerCase()}={${handler}}`;
      changes.push({
        type: 'event_syntax',
        description: `Updated event syntax for ${event}`,
        before: match,
        after: newSyntax
      });
      changed = true;
      return newSyntax;
    });

    // Migrate old template blocks
    const oldTemplatePattern = /<template>([\s\S]*?)<\/template>/g;
    if (!oldTemplatePattern.test(migrated) && migrated.includes('<div')) {
      // Wrap content in template block if not already wrapped
      const templateMatch = migrated.match(/<div[\s\S]*$/);
      if (templateMatch) {
        const wrappedContent = `<template>\n${templateMatch[0]}\n</template>`;
        migrated = migrated.replace(templateMatch[0], wrappedContent);
        changes.push({
          type: 'template_wrapper',
          description: 'Wrapped content in template block',
          after: 'Added <template> wrapper'
        });
        changed = true;
      }
    }

    // Check for deprecated patterns
    const deprecatedPatterns = [
      { pattern: /\$mount\s*=/, message: 'Use $onMount instead of $mount' },
      { pattern: /\$destroy\s*=/, message: 'Use $onDestroy instead of $destroy' },
      { pattern: /createEffect\(/, message: 'Use signal watchers instead of createEffect' }
    ];

    deprecatedPatterns.forEach(({ pattern, message }) => {
      if (pattern.test(migrated)) {
        warnings.push({
          type: 'deprecated_syntax',
          message,
          file: filePath
        });
      }
    });

    return { content: migrated, changes, warnings, changed };
  }

  /**
   * Add required fields if missing
   * @private
   */
  addRequiredFields(frontmatter, filePath) {
    const changes = [];
    let changed = false;
    const migrated = { ...frontmatter };

    // Required fields with defaults
    const requiredFields = {
      title: path.basename(filePath, '.mtm').replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: `Page description for ${path.basename(filePath, '.mtm')}`,
      keywords: []
    };

    Object.entries(requiredFields).forEach(([field, defaultValue]) => {
      if (!migrated[field]) {
        migrated[field] = defaultValue;
        changes.push({
          type: 'required_field',
          description: `Added required field '${field}'`,
          after: defaultValue
        });
        changed = true;
      }
    });

    return { frontmatter: migrated, changes, changed };
  }

  /**
   * Reconstruct file with migrated frontmatter and content
   * @private
   */
  reconstructFile(frontmatter, content) {
    const yamlContent = yaml.dump(frontmatter, {
      indent: 2,
      lineWidth: 80,
      noRefs: true
    });

    return `---\n${yamlContent}---\n\n${content}`;
  }

  /**
   * Find all MTM files in directory recursively
   * @private
   */
  async findMTMFiles(dirPath) {
    const files = [];

    async function scanDirectory(currentPath) {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await scanDirectory(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.mtm')) {
          files.push(fullPath);
        }
      }
    }

    await scanDirectory(dirPath);
    return files;
  }

  /**
   * Generate migration report
   * @private
   */
  async generateMigrationReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFiles: this.migrationReport.totalFiles,
        migratedFiles: this.migrationReport.migratedFiles,
        skippedFiles: this.migrationReport.skippedFiles,
        errorCount: this.migrationReport.errors.length,
        warningCount: this.migrationReport.warnings.length
      },
      changes: this.migrationReport.changes,
      errors: this.migrationReport.errors,
      warnings: this.migrationReport.warnings,
      recommendations: this.generateRecommendations()
    };

    const reportPath = `mtm-migration-report-${Date.now()}.json`;

    if (!this.options.dryRun) {
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(`Migration report saved to: ${reportPath}`);
    }

    return report;
  }

  /**
   * Generate recommendations based on migration results
   * @private
   */
  generateRecommendations() {
    const recommendations = [];

    // Check for common patterns
    const changeTypes = this.migrationReport.changes.reduce((acc, change) => {
      acc[change.type] = (acc[change.type] || 0) + 1;
      return acc;
    }, {});

    if (changeTypes.signal_syntax > 0) {
      recommendations.push({
        type: 'signal_usage',
        message: 'Consider reviewing signal usage patterns for consistency',
        priority: 'medium'
      });
    }

    if (changeTypes.route_format > 0) {
      recommendations.push({
        type: 'routing',
        message: 'Review migrated routes for i18n compatibility',
        priority: 'high'
      });
    }

    if (this.migrationReport.warnings.length > 0) {
      recommendations.push({
        type: 'warnings',
        message: 'Address migration warnings to ensure full compatibility',
        priority: 'high'
      });
    }

    return recommendations;
  }
}

/**
 * CLI interface for migration
 */
export class MigrationCLI {
  constructor() {
    this.migrator = new MTMMigrator();
  }

  async run(args) {
    const options = this.parseArgs(args);

    if (options.help) {
      this.showHelp();
      return;
    }

    if (!options.paths || options.paths.length === 0) {
      console.error('Error: No paths specified for migration');
      this.showHelp();
      return;
    }

    // Configure migrator
    this.migrator.options = { ...this.migrator.options, ...options };

    console.log('Starting MTM migration...');
    console.log(`Paths: ${options.paths.join(', ')}`);
    console.log(`Dry run: ${options.dryRun ? 'Yes' : 'No'}`);
    console.log(`Backup originals: ${options.backupOriginals ? 'Yes' : 'No'}`);

    try {
      const report = await this.migrator.migrate(options.paths);

      console.log('\nMigration completed!');
      console.log(`Total files: ${report.totalFiles}`);
      console.log(`Migrated: ${report.migratedFiles}`);
      console.log(`Skipped: ${report.skippedFiles}`);
      console.log(`Errors: ${report.errors.length}`);
      console.log(`Warnings: ${report.warnings.length}`);

      if (report.errors.length > 0) {
        console.log('\nErrors:');
        report.errors.forEach(error => {
          console.log(`  - ${error.message}`);
        });
      }

      if (report.warnings.length > 0) {
        console.log('\nWarnings:');
        report.warnings.forEach(warning => {
          console.log(`  - ${warning.message}`);
        });
      }

    } catch (error) {
      console.error('Migration failed:', error.message);
      process.exit(1);
    }
  }

  parseArgs(args) {
    const options = {
      paths: [],
      dryRun: false,
      backupOriginals: true,
      validateAfterMigration: true,
      generateReport: true,
      help: false
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case '--dry-run':
          options.dryRun = true;
          break;
        case '--no-backup':
          options.backupOriginals = false;
          break;
        case '--no-validation':
          options.validateAfterMigration = false;
          break;
        case '--no-report':
          options.generateReport = false;
          break;
        case '--help':
        case '-h':
          options.help = true;
          break;
        default:
          if (!arg.startsWith('--')) {
            options.paths.push(arg);
          }
          break;
      }
    }

    return options;
  }

  showHelp() {
    console.log(`
MTM Migration Tool

Usage: node mtm-migrator.js [options] <paths...>

Options:
  --dry-run           Preview changes without modifying files
  --no-backup         Don't create backup files
  --no-validation     Skip validation after migration
  --no-report         Don't generate migration report
  --help, -h          Show this help message

Examples:
  node mtm-migrator.js src/pages/
  node mtm-migrator.js --dry-run src/pages/ src/components/
  node mtm-migrator.js --no-backup src/pages/index.mtm
`);
  }
}

export default MTMMigrator;