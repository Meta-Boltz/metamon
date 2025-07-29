/**
 * MTM Build Tools - Main Export
 * Provides migration utilities and build tools for Ultra-Modern MTM
 */

export { MTMMigrator, MigrationCLI } from './migration/mtm-migrator.js';
export { default as BackwardCompatibilityLayer } from './migration/backward-compatibility.js';
export { default as MigrationReportGenerator } from './migration/report-generator.js';
export { default as MTMMigrationCLI } from './migration/cli.js';

// Re-export commonly used utilities
export {
  FrontmatterParser,
  FrontmatterParseError,
  FrontmatterResult,
  parseFrontmatter
} from '../../examples/src/build-tools/frontmatter-parser.js';

export {
  TemplateTransformer
} from '../../examples/src/build-tools/template-transformer.js';

// Migration utilities
export const createMigrator = (options = {}) => {
  return new MTMMigrator(options);
};

export const createCompatibilityLayer = (options = {}) => {
  return new BackwardCompatibilityLayer(options);
};

export const createReportGenerator = (options = {}) => {
  return new MigrationReportGenerator(options);
};

// Convenience functions
export const migrateFile = async (filePath, options = {}) => {
  const migrator = new MTMMigrator(options);
  return await migrator.migrateFile(filePath);
};

export const migratePath = async (path, options = {}) => {
  const migrator = new MTMMigrator(options);
  return await migrator.migrate([path]);
};

export const checkCompatibility = async (filePath, options = {}) => {
  const compatibility = new BackwardCompatibilityLayer(options);
  const fs = await import('fs/promises');
  const content = await fs.readFile(filePath, 'utf-8');
  return compatibility.process(content, filePath);
};

export const generateMigrationReport = async (migrationData, outputPath, options = {}) => {
  const generator = new MigrationReportGenerator(options);
  return await generator.generateReport(migrationData, outputPath);
};

// Version info
export const version = '1.0.0';
export const name = '@mtm/build-tools';