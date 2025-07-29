#!/usr/bin/env node

/**
 * MTM Migration CLI Tool
 * Command-line interface for migrating MTM files
 */

import { MTMMigrator, MigrationCLI } from './mtm-migrator.js';
import BackwardCompatibilityLayer from './backward-compatibility.js';
import fs from 'fs/promises';
import path from 'path';

class MTMMigrationCLI {
  constructor() {
    this.migrator = new MTMMigrator();
    this.compatibility = new BackwardCompatibilityLayer();
  }

  async run() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
      this.showHelp();
      return;
    }

    const command = args[0];
    const commandArgs = args.slice(1);

    try {
      switch (command) {
        case 'migrate':
          await this.runMigration(commandArgs);
          break;
        case 'check':
          await this.runCompatibilityCheck(commandArgs);
          break;
        case 'analyze':
          await this.runAnalysis(commandArgs);
          break;
        case 'validate':
          await this.runValidation(commandArgs);
          break;
        default:
          console.error(`Unknown command: ${command}`);
          this.showHelp();
          process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  }

  async runMigration(args) {
    const options = this.parseMigrationArgs(args);

    if (options.paths.length === 0) {
      console.error('Error: No paths specified for migration');
      return;
    }

    // Configure migrator
    this.migrator.options = { ...this.migrator.options, ...options };

    console.log('🚀 Starting MTM migration...');
    console.log(`📁 Paths: ${options.paths.join(', ')}`);
    console.log(`🔍 Dry run: ${options.dryRun ? 'Yes' : 'No'}`);
    console.log(`💾 Backup originals: ${options.backupOriginals ? 'Yes' : 'No'}`);
    console.log('');

    const startTime = Date.now();
    const report = await this.migrator.migrate(options.paths);
    const duration = Date.now() - startTime;

    console.log('✅ Migration completed!');
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`📊 Results:`);
    console.log(`   Total files: ${report.totalFiles}`);
    console.log(`   Migrated: ${report.migratedFiles}`);
    console.log(`   Skipped: ${report.skippedFiles}`);
    console.log(`   Errors: ${report.errors.length}`);
    console.log(`   Warnings: ${report.warnings.length}`);

    if (report.errors.length > 0) {
      console.log('\n❌ Errors:');
      report.errors.forEach(error => {
        console.log(`   • ${error.message}`);
      });
    }

    if (report.warnings.length > 0 && options.verbose) {
      console.log('\n⚠️  Warnings:');
      report.warnings.forEach(warning => {
        console.log(`   • ${warning.message}`);
      });
    }

    // Show change summary
    if (report.changes.length > 0) {
      const changeTypes = report.changes.reduce((acc, change) => {
        acc[change.type] = (acc[change.type] || 0) + 1;
        return acc;
      }, {});

      console.log('\n📝 Changes made:');
      Object.entries(changeTypes).forEach(([type, count]) => {
        console.log(`   • ${type.replace(/_/g, ' ')}: ${count}`);
      });
    }
  }

  async runCompatibilityCheck(args) {
    const options = this.parseCheckArgs(args);

    if (options.paths.length === 0) {
      console.error('Error: No paths specified for compatibility check');
      return;
    }

    console.log('🔍 Checking MTM file compatibility...');
    console.log(`📁 Paths: ${options.paths.join(', ')}`);
    console.log('');

    const files = await this.collectMTMFiles(options.paths);
    const summary = await this.compatibility.getCompatibilitySummary(files);

    console.log('📊 Compatibility Summary:');
    console.log(`   Total files: ${summary.totalFiles}`);
    console.log(`   Modern format: ${summary.modernFiles} (${Math.round(summary.modernFiles / summary.totalFiles * 100)}%)`);
    console.log(`   Transitional: ${summary.transitionalFiles} (${Math.round(summary.transitionalFiles / summary.totalFiles * 100)}%)`);
    console.log(`   Legacy format: ${summary.legacyFiles} (${Math.round(summary.legacyFiles / summary.totalFiles * 100)}%)`);
    console.log(`   Need migration: ${summary.needsMigration}`);

    if (Object.keys(summary.commonIssues).length > 0) {
      console.log('\n⚠️  Common Issues:');
      Object.entries(summary.commonIssues)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .forEach(([issue, count]) => {
          console.log(`   • ${issue.replace(/_/g, ' ')}: ${count} files`);
        });
    }

    if (summary.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      summary.recommendations.forEach(rec => {
        const priority = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        console.log(`   ${priority} ${rec.message}`);
        console.log(`      Action: ${rec.action}`);
      });
    }

    // Detailed file analysis if requested
    if (options.detailed) {
      console.log('\n📋 Detailed File Analysis:');

      for (const filePath of files.slice(0, 10)) { // Limit to first 10 files
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const result = this.compatibility.process(content, filePath);

          const status = result.compatibilityLevel === 'modern' ? '✅' :
            result.compatibilityLevel === 'transitional' ? '⚠️' : '❌';

          console.log(`   ${status} ${path.relative(process.cwd(), filePath)} (${result.compatibilityLevel})`);

          if (result.warnings.length > 0 && options.verbose) {
            result.warnings.forEach(warning => {
              console.log(`      • ${warning.message}`);
            });
          }
        } catch (error) {
          console.log(`   ❌ ${path.relative(process.cwd(), filePath)} (error: ${error.message})`);
        }
      }

      if (files.length > 10) {
        console.log(`   ... and ${files.length - 10} more files`);
      }
    }
  }

  async runAnalysis(args) {
    const options = this.parseAnalysisArgs(args);

    if (options.paths.length === 0) {
      console.error('Error: No paths specified for analysis');
      return;
    }

    console.log('📊 Analyzing MTM project structure...');
    console.log(`📁 Paths: ${options.paths.join(', ')}`);
    console.log('');

    const files = await this.collectMTMFiles(options.paths);
    const analysis = await this.analyzeProject(files, options);

    // File distribution
    console.log('📁 File Distribution:');
    console.log(`   Pages: ${analysis.pages.length}`);
    console.log(`   Components: ${analysis.components.length}`);
    console.log(`   Other: ${analysis.other.length}`);

    // Route analysis
    if (analysis.routes.length > 0) {
      console.log('\n🛣️  Route Analysis:');
      console.log(`   Total routes: ${analysis.routes.length}`);
      console.log(`   Static routes: ${analysis.routes.filter(r => !r.isDynamic).length}`);
      console.log(`   Dynamic routes: ${analysis.routes.filter(r => r.isDynamic).length}`);
      console.log(`   I18n routes: ${analysis.routes.filter(r => r.hasI18n).length}`);
    }

    // Framework usage
    if (Object.keys(analysis.frameworks).length > 0) {
      console.log('\n⚛️  Framework Usage:');
      Object.entries(analysis.frameworks)
        .sort(([, a], [, b]) => b - a)
        .forEach(([framework, count]) => {
          console.log(`   ${framework}: ${count} files`);
        });
    }

    // Signal usage
    if (analysis.signals.length > 0) {
      console.log('\n🔄 Signal Usage:');
      console.log(`   Total signals: ${analysis.signals.length}`);
      console.log(`   Global signals: ${analysis.signals.filter(s => s.isGlobal).length}`);
      console.log(`   Local signals: ${analysis.signals.filter(s => !s.isGlobal).length}`);

      if (options.verbose) {
        const topSignals = analysis.signals
          .sort((a, b) => b.usage - a.usage)
          .slice(0, 5);

        console.log('\n   Most used signals:');
        topSignals.forEach(signal => {
          console.log(`     • ${signal.name}: ${signal.usage} usages`);
        });
      }
    }

    // Issues and recommendations
    if (analysis.issues.length > 0) {
      console.log('\n⚠️  Issues Found:');
      analysis.issues.forEach(issue => {
        console.log(`   • ${issue.message} (${issue.files.length} files)`);
      });
    }

    if (analysis.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      analysis.recommendations.forEach(rec => {
        const priority = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        console.log(`   ${priority} ${rec.message}`);
      });
    }

    // Export analysis if requested
    if (options.export) {
      const exportPath = `mtm-analysis-${Date.now()}.json`;
      await fs.writeFile(exportPath, JSON.stringify(analysis, null, 2));
      console.log(`\n💾 Analysis exported to: ${exportPath}`);
    }
  }

  async runValidation(args) {
    const options = this.parseValidationArgs(args);

    if (options.paths.length === 0) {
      console.error('Error: No paths specified for validation');
      return;
    }

    console.log('✅ Validating MTM files...');
    console.log(`📁 Paths: ${options.paths.join(', ')}`);
    console.log('');

    const files = await this.collectMTMFiles(options.paths);
    const results = await this.validateFiles(files, options);

    const validFiles = results.filter(r => r.isValid).length;
    const invalidFiles = results.filter(r => !r.isValid).length;

    console.log('📊 Validation Results:');
    console.log(`   Total files: ${files.length}`);
    console.log(`   Valid: ${validFiles} (${Math.round(validFiles / files.length * 100)}%)`);
    console.log(`   Invalid: ${invalidFiles} (${Math.round(invalidFiles / files.length * 100)}%)`);

    if (invalidFiles > 0) {
      console.log('\n❌ Invalid Files:');
      results
        .filter(r => !r.isValid)
        .forEach(result => {
          console.log(`   • ${path.relative(process.cwd(), result.filePath)}`);
          result.errors.forEach(error => {
            console.log(`     - ${error.message}`);
          });
        });
    }

    if (options.warnings) {
      const filesWithWarnings = results.filter(r => r.warnings.length > 0);
      if (filesWithWarnings.length > 0) {
        console.log('\n⚠️  Files with Warnings:');
        filesWithWarnings.forEach(result => {
          console.log(`   • ${path.relative(process.cwd(), result.filePath)}`);
          result.warnings.forEach(warning => {
            console.log(`     - ${warning.message}`);
          });
        });
      }
    }
  }

  // Helper methods
  parseMigrationArgs(args) {
    const options = {
      paths: [],
      dryRun: false,
      backupOriginals: true,
      validateAfterMigration: true,
      generateReport: true,
      verbose: false
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
        case '--verbose':
        case '-v':
          options.verbose = true;
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

  parseCheckArgs(args) {
    const options = {
      paths: [],
      detailed: false,
      verbose: false
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case '--detailed':
        case '-d':
          options.detailed = true;
          break;
        case '--verbose':
        case '-v':
          options.verbose = true;
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

  parseAnalysisArgs(args) {
    const options = {
      paths: [],
      verbose: false,
      export: false
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case '--verbose':
        case '-v':
          options.verbose = true;
          break;
        case '--export':
        case '-e':
          options.export = true;
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

  parseValidationArgs(args) {
    const options = {
      paths: [],
      warnings: false,
      strict: false
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case '--warnings':
        case '-w':
          options.warnings = true;
          break;
        case '--strict':
        case '-s':
          options.strict = true;
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

  async collectMTMFiles(paths) {
    const files = [];

    for (const inputPath of paths) {
      try {
        const stat = await fs.stat(inputPath);
        if (stat.isDirectory()) {
          const dirFiles = await this.findMTMFiles(inputPath);
          files.push(...dirFiles);
        } else if (inputPath.endsWith('.mtm')) {
          files.push(inputPath);
        }
      } catch (error) {
        console.warn(`Warning: Cannot access ${inputPath}: ${error.message}`);
      }
    }

    return files;
  }

  async findMTMFiles(dirPath) {
    const files = [];

    async function scanDirectory(currentPath) {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);

          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await scanDirectory(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.mtm')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        console.warn(`Warning: Cannot scan directory ${currentPath}: ${error.message}`);
      }
    }

    await scanDirectory(dirPath);
    return files;
  }

  async analyzeProject(files, options) {
    const analysis = {
      pages: [],
      components: [],
      other: [],
      routes: [],
      frameworks: {},
      signals: [],
      issues: [],
      recommendations: []
    };

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const result = this.compatibility.process(content, filePath);

        // Categorize file
        if (filePath.includes('/pages/') || filePath.includes('\\pages\\')) {
          analysis.pages.push(filePath);
        } else if (filePath.includes('/components/') || filePath.includes('\\components\\')) {
          analysis.components.push(filePath);
        } else {
          analysis.other.push(filePath);
        }

        // Analyze routes
        if (result.frontmatter.route) {
          const route = {
            path: filePath,
            route: result.frontmatter.route,
            isDynamic: this.isDynamicRoute(result.frontmatter.route),
            hasI18n: this.hasI18nRoute(result.frontmatter.route)
          };
          analysis.routes.push(route);
        }

        // Detect framework usage
        const framework = this.detectFramework(filePath, content);
        if (framework) {
          analysis.frameworks[framework] = (analysis.frameworks[framework] || 0) + 1;
        }

        // Analyze signals
        const signals = this.extractSignals(content);
        analysis.signals.push(...signals);

        // Collect issues
        if (result.warnings.length > 0) {
          result.warnings.forEach(warning => {
            const existingIssue = analysis.issues.find(i => i.type === warning.type);
            if (existingIssue) {
              existingIssue.files.push(filePath);
            } else {
              analysis.issues.push({
                type: warning.type,
                message: warning.message,
                files: [filePath]
              });
            }
          });
        }

      } catch (error) {
        console.warn(`Warning: Cannot analyze ${filePath}: ${error.message}`);
      }
    }

    // Generate recommendations
    analysis.recommendations = this.generateAnalysisRecommendations(analysis);

    return analysis;
  }

  async validateFiles(files, options) {
    const results = [];

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parseResult = this.migrator.parser.parse(content);

        const result = {
          filePath,
          isValid: parseResult.isValid,
          errors: parseResult.errors,
          warnings: []
        };

        // Additional validation
        if (parseResult.isValid) {
          const validationErrors = this.migrator.parser.validateDataTypes(parseResult.frontmatter);
          const i18nErrors = this.migrator.parser.validateI18nRoutes(parseResult.frontmatter);

          result.errors.push(...validationErrors, ...i18nErrors);
          result.isValid = result.errors.length === 0;
        }

        // Compatibility warnings
        if (options.warnings) {
          const compatResult = this.compatibility.process(content, filePath);
          result.warnings = compatResult.warnings;
        }

        results.push(result);

      } catch (error) {
        results.push({
          filePath,
          isValid: false,
          errors: [{
            type: 'file_error',
            message: `Cannot read file: ${error.message}`
          }],
          warnings: []
        });
      }
    }

    return results;
  }

  // Analysis helper methods
  isDynamicRoute(route) {
    if (typeof route === 'string') {
      return route.includes('[') && route.includes(']');
    }
    if (typeof route === 'object') {
      return Object.values(route).some(r => r.includes('[') && r.includes(']'));
    }
    return false;
  }

  hasI18nRoute(route) {
    return typeof route === 'object' || (Array.isArray(route) && route.length > 1);
  }

  detectFramework(filePath, content) {
    const fileName = path.basename(filePath);

    if (fileName.includes('.react.')) return 'React';
    if (fileName.includes('.vue.')) return 'Vue';
    if (fileName.includes('.svelte.')) return 'Svelte';
    if (fileName.includes('.solid.')) return 'Solid';

    // Analyze content
    if (content.includes('useState') || content.includes('useEffect')) return 'React';
    if (content.includes('ref(') || content.includes('computed(')) return 'Vue';
    if (content.includes('createSignal') || content.includes('createEffect')) return 'Solid';

    return 'Vanilla';
  }

  extractSignals(content) {
    const signals = [];
    const signalPattern = /\$(\w+)!\s*=\s*signal\(['"]([^'"]+)['"],?\s*([^)]*)\)/g;

    let match;
    while ((match = signalPattern.exec(content)) !== null) {
      signals.push({
        name: match[1],
        key: match[2],
        isGlobal: match[2] === match[1],
        usage: (content.match(new RegExp(`\\$${match[1]}(?!\\w)`, 'g')) || []).length
      });
    }

    return signals;
  }

  generateAnalysisRecommendations(analysis) {
    const recommendations = [];

    if (analysis.issues.length > 0) {
      recommendations.push({
        priority: 'high',
        message: `${analysis.issues.length} types of issues found across files`,
        action: 'Run migration tool to fix compatibility issues'
      });
    }

    const frameworkCount = Object.keys(analysis.frameworks).length;
    if (frameworkCount > 2) {
      recommendations.push({
        priority: 'medium',
        message: `Using ${frameworkCount} different frameworks`,
        action: 'Consider standardizing on fewer frameworks for consistency'
      });
    }

    if (analysis.signals.length > 50) {
      recommendations.push({
        priority: 'medium',
        message: `${analysis.signals.length} signals detected`,
        action: 'Review signal usage for potential optimization'
      });
    }

    return recommendations;
  }

  showHelp() {
    console.log(`
🚀 MTM Migration Tool

Usage: mtm-migrate <command> [options] <paths...>

Commands:
  migrate     Migrate MTM files to new format
  check       Check compatibility of existing files
  analyze     Analyze project structure and usage
  validate    Validate MTM file syntax and structure

Migration Options:
  --dry-run           Preview changes without modifying files
  --no-backup         Don't create backup files
  --no-validation     Skip validation after migration
  --no-report         Don't generate migration report
  --verbose, -v       Show detailed output

Check Options:
  --detailed, -d      Show detailed file analysis
  --verbose, -v       Show warnings for each file

Analysis Options:
  --verbose, -v       Show detailed analysis
  --export, -e        Export analysis to JSON file

Validation Options:
  --warnings, -w      Show compatibility warnings
  --strict, -s        Use strict validation mode

Examples:
  mtm-migrate migrate src/pages/
  mtm-migrate check --detailed src/
  mtm-migrate analyze --verbose --export src/
  mtm-migrate validate --warnings src/pages/

For more information, visit: https://github.com/metamon/mtm
`);
  }
}

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new MTMMigrationCLI();
  cli.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default MTMMigrationCLI;