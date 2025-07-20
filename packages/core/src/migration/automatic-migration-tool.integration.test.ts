import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { AutomaticMigrationTool } from './automatic-migration-tool.js';
import { MigrationOpportunityType, MigrationComplexity } from './syntax-migration-analyzer.js';

describe('AutomaticMigrationTool Integration Tests', () => {
  let migrationTool: AutomaticMigrationTool;
  let testDir: string;
  let testFiles: string[] = [];

  beforeEach(() => {
    migrationTool = new AutomaticMigrationTool();
    testDir = join(process.cwd(), 'test-migration-temp');
    
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }

    // Mock the analyzer to return predictable opportunities
    const mockAnalyzer = {
      analyzeFile: vi.fn().mockImplementation((filePath: string) => {
        const content = readFileSync(filePath, 'utf-8');
        const opportunities = [];
        
        // Simple pattern matching for test purposes
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          const lineNumber = index + 1;
          
          // Variable declarations
          if (line.match(/^\s*(let|const|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+);?\s*$/)) {
            opportunities.push({
              type: MigrationOpportunityType.VARIABLE_DECLARATION,
              location: { line: lineNumber, column: 1, index: 0 },
              legacyCode: line.trim(),
              modernEquivalent: line.replace(/^\s*(let|const|var)\s+/, '').replace(/;$/, ''),
              complexity: MigrationComplexity.SIMPLE,
              description: 'Convert to modern variable declaration',
              benefits: ['Cleaner syntax'],
              risks: [],
              dependencies: []
            });
          }
          
          // Function declarations
          if (line.match(/^\s*function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\{?\s*$/)) {
            const match = line.match(/^\s*function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\{?\s*$/);
            if (match) {
              const [, funcName, params] = match;
              opportunities.push({
                type: MigrationOpportunityType.FUNCTION_DECLARATION,
                location: { line: lineNumber, column: 1, index: 0 },
                legacyCode: line.trim(),
                modernEquivalent: `${funcName} = (${params}) => {`,
                complexity: MigrationComplexity.MODERATE,
                description: 'Convert to arrow function',
                benefits: ['Auto this binding'],
                risks: [],
                dependencies: []
              });
            }
          }
          
          // Reactive variables (state-like patterns) - check this BEFORE general variable declarations
          const reactiveMatch = line.match(/^\s*(let|const|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+);?\s*$/);
          if (reactiveMatch) {
            const [, , varName, value] = reactiveMatch;
            const statePatterns = [
              /count/i, /state/i, /show/i, /active/i, /data/i, /item/i, /list/i, /visible/i, /modal/i
            ];
            
            if (statePatterns.some(pattern => pattern.test(varName))) {
              opportunities.push({
                type: MigrationOpportunityType.REACTIVE_VARIABLE,
                location: { line: lineNumber, column: 1, index: 0 },
                legacyCode: line.trim(),
                modernEquivalent: `${varName}! = ${value.replace(/;$/, '')}`,
                complexity: MigrationComplexity.MODERATE,
                description: 'Convert to reactive variable',
                benefits: ['Auto UI updates'],
                risks: [],
                dependencies: []
              });
            }
          }
          
          // Template bindings
          if (line.includes('innerHTML') && line.includes('${')) {
            opportunities.push({
              type: MigrationOpportunityType.TEMPLATE_BINDING,
              location: { line: lineNumber, column: 1, index: 0 },
              legacyCode: line.trim(),
              modernEquivalent: line.replace(/\$\{([^}]+)\}/g, '{{$$1}}'),
              complexity: MigrationComplexity.MODERATE,
              description: 'Convert to template binding',
              benefits: ['Auto updates'],
              risks: [],
              dependencies: []
            });
          }
          
          // Event handlers
          if (line.includes('addEventListener')) {
            const match = line.match(/addEventListener\s*\(\s*['"]([^'"]+)['"]\s*,\s*([^)]+)\s*\)/);
            if (match) {
              const [, eventType, handler] = match;
              opportunities.push({
                type: MigrationOpportunityType.EVENT_HANDLER,
                location: { line: lineNumber, column: 1, index: 0 },
                legacyCode: line.trim(),
                modernEquivalent: `${eventType}="${handler.replace(/^\w+\./, '')}"`,
                complexity: MigrationComplexity.MODERATE,
                description: 'Convert to template event binding',
                benefits: ['Cleaner syntax'],
                risks: [],
                dependencies: []
              });
            }
          }
          
          // Type annotations
          if (line.match(/^\s*(let|const|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+);?\s*$/)) {
            const match = line.match(/^\s*(let|const|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+);?\s*$/);
            if (match) {
              const [, , varName, value] = match;
              const cleanValue = value.replace(/;$/, '').trim();
              let inferredType = null;
              
              if (/^["'`].*["'`]$/.test(cleanValue)) inferredType = 'string';
              else if (/^\d+$/.test(cleanValue)) inferredType = 'number';
              else if (/^\d+\.\d+$/.test(cleanValue)) inferredType = 'float';
              else if (/^(true|false)$/.test(cleanValue)) inferredType = 'boolean';
              
              if (inferredType) {
                opportunities.push({
                  type: MigrationOpportunityType.TYPE_ANNOTATION,
                  location: { line: lineNumber, column: 1, index: 0 },
                  legacyCode: line.trim(),
                  modernEquivalent: `${varName}: ${inferredType} = ${cleanValue}`,
                  complexity: MigrationComplexity.SIMPLE,
                  description: 'Add type annotation',
                  benefits: ['Type safety'],
                  risks: [],
                  dependencies: []
                });
              }
            }
          }
          
          // Semicolon optional
          if (line.trim().endsWith(';')) {
            const withoutSemicolon = line.replace(/;\s*$/, '');
            const safePatterns = [
              /^\s*(let|const|var|\$\w+)\s+\w+\s*=\s*.+$/,
              /^\s*\w+\s*=\s*.+$/,
              /^\s*return\s+.+$/,
              /^\s*\w+\([^)]*\)$/
            ];
            
            if (safePatterns.some(pattern => pattern.test(withoutSemicolon))) {
              opportunities.push({
                type: MigrationOpportunityType.SEMICOLON_OPTIONAL,
                location: { line: lineNumber, column: line.length, index: 0 },
                legacyCode: line.trim(),
                modernEquivalent: withoutSemicolon,
                complexity: MigrationComplexity.SIMPLE,
                description: 'Remove optional semicolon',
                benefits: ['Cleaner syntax'],
                risks: [],
                dependencies: []
              });
            }
          }
        });
        
        return {
          filePath,
          syntaxVersion: 'legacy' as const,
          opportunities,
          overallComplexity: MigrationComplexity.SIMPLE,
          migrationScore: 80,
          estimatedEffort: '1-2 hours',
          blockers: [],
          recommendations: []
        };
      })
    };
    
    // Replace the analyzer in the migration tool
    (migrationTool as any).analyzer = mockAnalyzer;
  });

  afterEach(() => {
    // Clean up test files
    testFiles.forEach(filePath => {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
      const backupPath = `${filePath}.backup`;
      if (existsSync(backupPath)) {
        unlinkSync(backupPath);
      }
    });
    
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    
    testFiles = [];
  });

  const createTestFile = (filename: string, content: string): string => {
    const filePath = join(testDir, filename);
    writeFileSync(filePath, content, 'utf-8');
    testFiles.push(filePath);
    return filePath;
  };

  describe('single file migration', () => {
    it('should migrate simple variable declarations', async () => {
      const content = `let counter = 0;
const name = "test";
var isActive = true;`;

      const filePath = createTestFile('simple-vars.mtm', content);
      
      const result = await migrationTool.migrateFile(filePath, { dryRun: true });
      
      expect(result.success).toBe(true);
      expect(result.appliedTransformations.length).toBeGreaterThan(0);
      expect(result.appliedTransformations.some(t => t.type === MigrationOpportunityType.VARIABLE_DECLARATION)).toBe(true);
      expect(result.migratedContent).toContain('counter');
      expect(result.migratedContent).toContain('name');
      expect(result.migratedContent).toContain('isActive');
    });

    it('should migrate function declarations', async () => {
      const content = `function greet(name) {
  return "Hello, " + name;
}

function calculate(a, b) {
  return a + b;
}`;

      const filePath = createTestFile('functions.mtm', content);
      
      const result = await migrationTool.migrateFile(filePath, { dryRun: true });
      
      expect(result.success).toBe(true);
      expect(result.appliedTransformations.some(t => t.type === MigrationOpportunityType.FUNCTION_DECLARATION)).toBe(true);
      expect(result.migratedContent).toContain('greet = (name) => {');
      expect(result.migratedContent).toContain('calculate = (a, b) => {');
    });

    it('should add type annotations for obvious types', async () => {
      const content = `let message = "hello";
let count = 42;
let price = 19.99;
let isEnabled = false;`;

      const filePath = createTestFile('types.mtm', content);
      
      const result = await migrationTool.migrateFile(filePath, { dryRun: true });
      
      expect(result.success).toBe(true);
      expect(result.appliedTransformations.some(t => t.type === MigrationOpportunityType.TYPE_ANNOTATION)).toBe(true);
      expect(result.migratedContent).toContain('message: string');
      expect(result.migratedContent).toContain('count: number');
      expect(result.migratedContent).toContain('price: float');
      expect(result.migratedContent).toContain('isEnabled: boolean');
    });

    it('should identify reactive variable opportunities', async () => {
      const content = `let counter = 0;
let showModal = false;
let activeItem = null;
let dataList = [];`;

      const filePath = createTestFile('reactive.mtm', content);
      
      const result = await migrationTool.migrateFile(filePath, { dryRun: true });
      
      expect(result.success).toBe(true);
      expect(result.appliedTransformations.some(t => t.type === MigrationOpportunityType.REACTIVE_VARIABLE)).toBe(true);
      expect(result.migratedContent).toContain('counter! = 0');
      expect(result.migratedContent).toContain('showModal! = false');
    });

    it('should handle template binding migration', async () => {
      const content = `element.innerHTML = \`Hello, \${name}!\`;
container.innerHTML = \`Count: \${counter}\`;`;

      const filePath = createTestFile('templates.mtm', content);
      
      const result = await migrationTool.migrateFile(filePath, { dryRun: true });
      
      expect(result.success).toBe(true);
      expect(result.appliedTransformations.some(t => t.type === MigrationOpportunityType.TEMPLATE_BINDING)).toBe(true);
      expect(result.migratedContent).toContain('{{name}}');
      expect(result.migratedContent).toContain('{{counter}}');
    });

    it('should migrate event handlers', async () => {
      const content = `button.addEventListener('click', handleClick);
form.addEventListener('submit', onSubmit);`;

      const filePath = createTestFile('events.mtm', content);
      
      const result = await migrationTool.migrateFile(filePath, { dryRun: true });
      
      expect(result.success).toBe(true);
      expect(result.appliedTransformations.some(t => t.type === MigrationOpportunityType.EVENT_HANDLER)).toBe(true);
      expect(result.migratedContent).toContain('click="$handleClick"');
      expect(result.migratedContent).toContain('submit="$onSubmit"');
    });

    it('should remove optional semicolons', async () => {
      const content = `let counter = 0;
const name = "test";
return value;
doSomething();`;

      const filePath = createTestFile('semicolons.mtm', content);
      
      const result = await migrationTool.migrateFile(filePath, { dryRun: true });
      
      expect(result.success).toBe(true);
      expect(result.appliedTransformations.some(t => t.type === MigrationOpportunityType.SEMICOLON_OPTIONAL)).toBe(true);
      // Check that semicolons were removed (content may have other transformations)
      expect(result.migratedContent.includes('counter') && !result.migratedContent.includes('counter = 0;')).toBe(true);
      expect(result.migratedContent.includes('name') && !result.migratedContent.includes('name = "test";')).toBe(true);
    });

    it('should create backup files when requested', async () => {
      const content = `let counter = 0;`;
      const filePath = createTestFile('backup-test.mtm', content);
      
      const result = await migrationTool.migrateFile(filePath, { 
        createBackups: true,
        dryRun: false 
      });
      
      expect(result.success).toBe(true);
      expect(result.backupPath).toBeDefined();
      expect(existsSync(result.backupPath!)).toBe(true);
      
      const backupContent = readFileSync(result.backupPath!, 'utf-8');
      expect(backupContent).toBe(content);
    });

    it('should validate migrated content', async () => {
      const content = `let counter = 0;
function test() {
  return counter;
}`;

      const filePath = createTestFile('validation.mtm', content);
      
      const result = await migrationTool.migrateFile(filePath, { 
        validateAfterMigration: true,
        dryRun: true 
      });
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle files with syntax errors gracefully', async () => {
      const content = `let counter = 0
function test( {
  return counter;
}`;

      const filePath = createTestFile('syntax-error.mtm', content);
      
      const result = await migrationTool.migrateFile(filePath, { 
        validateAfterMigration: true,
        dryRun: true 
      });
      
      // Should still attempt migration but report validation errors
      expect(result.warnings.length > 0 || result.errors.length > 0).toBe(true);
    });
  });

  describe('batch migration', () => {
    it('should migrate multiple files successfully', async () => {
      const files = [
        { name: 'file1.mtm', content: 'let counter = 0;' },
        { name: 'file2.mtm', content: 'const name = "test";' },
        { name: 'file3.mtm', content: 'function greet() { return "hello"; }' }
      ];

      const filePaths = files.map(f => createTestFile(f.name, f.content));
      
      const result = await migrationTool.migrateFiles(filePaths, { dryRun: true });
      
      expect(result.totalFiles).toBe(3);
      expect(result.successfulMigrations).toBe(3);
      expect(result.failedMigrations).toBe(0);
      expect(result.fileResults).toHaveLength(3);
      
      result.fileResults.forEach(fileResult => {
        expect(fileResult.success).toBe(true);
        expect(fileResult.appliedTransformations.length).toBeGreaterThan(0);
      });
    });

    it('should handle mixed success and failure scenarios', async () => {
      const files = [
        { name: 'good.mtm', content: 'let counter = 0;' },
        { name: 'nonexistent.mtm', content: '' } // This will fail
      ];

      const filePaths = [
        createTestFile(files[0].name, files[0].content),
        join(testDir, files[1].name) // Don't create this file
      ];
      
      const result = await migrationTool.migrateFiles(filePaths, { dryRun: true });
      
      expect(result.totalFiles).toBe(2);
      expect(result.successfulMigrations).toBe(1);
      expect(result.failedMigrations).toBe(1);
      expect(result.overallErrors.length).toBeGreaterThan(0);
    });

    it('should provide comprehensive summary statistics', async () => {
      const files = [
        { name: 'vars.mtm', content: 'let a = 1; const b = 2;' },
        { name: 'funcs.mtm', content: 'function test() { return true; }' },
        { name: 'mixed.mtm', content: 'let counter = 0; function increment() { counter++; }' }
      ];

      const filePaths = files.map(f => createTestFile(f.name, f.content));
      
      const result = await migrationTool.migrateFiles(filePaths, { dryRun: true });
      
      expect(result.summary.transformationCounts).toBeDefined();
      expect(result.summary.complexityDistribution).toBeDefined();
      expect(result.summary.timeElapsed).toBeGreaterThan(0);
      
      // Should have variable declaration transformations
      expect(result.summary.transformationCounts[MigrationOpportunityType.VARIABLE_DECLARATION]).toBeGreaterThan(0);
    });
  });

  describe('migration options and filtering', () => {
    it('should respect complexity filtering', async () => {
      const content = `let counter = 0;
function complexFunction(a, b, c) {
  // Complex logic here
  return a + b + c;
}`;

      const filePath = createTestFile('complexity.mtm', content);
      
      const result = await migrationTool.migrateFile(filePath, { 
        maxComplexity: MigrationComplexity.SIMPLE,
        dryRun: true 
      });
      
      expect(result.success).toBe(true);
      // Should only apply simple transformations
      const complexTransformations = result.appliedTransformations.filter(t => 
        t.type === MigrationOpportunityType.FUNCTION_DECLARATION
      );
      expect(complexTransformations).toHaveLength(0);
    });

    it('should respect include/exclude type filters', async () => {
      const content = `let counter = 0;
const name = "test";
function greet() { return "hello"; }`;

      const filePath = createTestFile('filtering.mtm', content);
      
      const result = await migrationTool.migrateFile(filePath, { 
        includeTypes: [MigrationOpportunityType.VARIABLE_DECLARATION],
        dryRun: true 
      });
      
      expect(result.success).toBe(true);
      // Should only apply variable declaration transformations
      expect(result.appliedTransformations.every(t => 
        t.type === MigrationOpportunityType.VARIABLE_DECLARATION
      )).toBe(true);
    });

    it('should skip complex transformations when requested', async () => {
      const content = `let counter = 0;
function complexFunction() {
  // This would be marked as complex
  return counter;
}`;

      const filePath = createTestFile('skip-complex.mtm', content);
      
      const result = await migrationTool.migrateFile(filePath, { 
        skipComplexTransformations: true,
        dryRun: true 
      });
      
      expect(result.success).toBe(true);
      // Should have fewer transformations due to skipping complex ones
      const functionTransformations = result.appliedTransformations.filter(t => 
        t.type === MigrationOpportunityType.FUNCTION_DECLARATION
      );
      expect(functionTransformations).toHaveLength(0);
    });
  });

  describe('rollback functionality', () => {
    it('should rollback single file migration', async () => {
      const originalContent = `let counter = 0;`;
      const filePath = createTestFile('rollback-test.mtm', originalContent);
      
      // Perform migration
      await migrationTool.migrateFile(filePath, { 
        createBackups: true,
        dryRun: false 
      });
      
      // Verify file was changed
      const migratedContent = readFileSync(filePath, 'utf-8');
      expect(migratedContent).not.toBe(originalContent);
      
      // Rollback
      const rollbackSuccess = await migrationTool.rollbackMigration(filePath);
      expect(rollbackSuccess).toBe(true);
      
      // Verify file was restored
      const restoredContent = readFileSync(filePath, 'utf-8');
      expect(restoredContent).toBe(originalContent);
    });

    it('should rollback multiple files', async () => {
      const files = [
        { name: 'rollback1.mtm', content: 'let a = 1;' },
        { name: 'rollback2.mtm', content: 'const b = 2;' }
      ];

      const filePaths = files.map(f => createTestFile(f.name, f.content));
      
      // Perform batch migration
      await migrationTool.migrateFiles(filePaths, { 
        createBackups: true,
        dryRun: false 
      });
      
      // Rollback all files
      const rollbackResult = await migrationTool.rollbackFiles(filePaths);
      
      expect(rollbackResult.success).toHaveLength(2);
      expect(rollbackResult.failed).toHaveLength(0);
      
      // Verify files were restored
      files.forEach((file, index) => {
        const restoredContent = readFileSync(filePaths[index], 'utf-8');
        expect(restoredContent).toBe(file.content);
      });
    });

    it('should handle rollback failures gracefully', async () => {
      const filePath = createTestFile('no-backup.mtm', 'let counter = 0;');
      
      // Try to rollback without backup
      await expect(migrationTool.rollbackMigration(filePath, '.nonexistent')).rejects.toThrow();
    });
  });

  describe('preview functionality', () => {
    it('should preview migrations without applying changes', async () => {
      const originalContent = `let counter = 0;
const name = "test";`;
      const filePath = createTestFile('preview.mtm', originalContent);
      
      const preview = await migrationTool.previewMigration(filePath);
      
      expect(preview.success).toBe(true);
      expect(preview.appliedTransformations.length).toBeGreaterThan(0);
      expect(preview.migratedContent).not.toBe(originalContent);
      
      // Verify original file wasn't changed
      const actualContent = readFileSync(filePath, 'utf-8');
      expect(actualContent).toBe(originalContent);
    });
  });

  describe('custom migration rules', () => {
    it('should allow adding custom migration rules', async () => {
      const customRule = {
        type: MigrationOpportunityType.VARIABLE_DECLARATION,
        pattern: /customPattern/,
        replacement: 'customReplacement'
      };

      migrationTool.addMigrationRule(customRule);
      
      const allRules = migrationTool.getAllTransformationRules();
      expect(allRules.some(rule => rule.replacement === 'customReplacement')).toBe(true);
    });

    it('should allow removing migration rules', async () => {
      const initialRules = migrationTool.getAllTransformationRules();
      const initialCount = initialRules.filter(r => r.type === MigrationOpportunityType.VARIABLE_DECLARATION).length;
      
      migrationTool.removeMigrationRule(MigrationOpportunityType.VARIABLE_DECLARATION);
      
      const updatedRules = migrationTool.getAllTransformationRules();
      const updatedCount = updatedRules.filter(r => r.type === MigrationOpportunityType.VARIABLE_DECLARATION).length;
      
      expect(updatedCount).toBeLessThan(initialCount);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle empty files gracefully', async () => {
      const filePath = createTestFile('empty.mtm', '');
      
      const result = await migrationTool.migrateFile(filePath, { dryRun: true });
      
      expect(result.success).toBe(true);
      expect(result.appliedTransformations).toHaveLength(0);
      expect(result.warnings.some(w => w.includes('No migration opportunities'))).toBe(true);
    });

    it('should handle files with only comments', async () => {
      const content = `// This is a comment
/* Multi-line
   comment */
// Another comment`;

      const filePath = createTestFile('comments-only.mtm', content);
      
      const result = await migrationTool.migrateFile(filePath, { dryRun: true });
      
      expect(result.success).toBe(true);
      expect(result.appliedTransformations).toHaveLength(0);
    });

    it('should handle mixed legacy and modern syntax', async () => {
      const content = `let legacyVar = 0;
$modernVar = 1;
function oldFunc() { return true; }
$newFunc = () => false;`;

      const filePath = createTestFile('mixed-syntax.mtm', content);
      
      const result = await migrationTool.migrateFile(filePath, { 
        validateAfterMigration: true,
        dryRun: true 
      });
      
      expect(result.success).toBe(true);
      expect(result.warnings.some(w => w.includes('Mixed syntax'))).toBe(true);
    });

    it('should detect and warn about potential ASI issues', async () => {
      const content = `let result = a + b
+c;`;

      const filePath = createTestFile('asi-issue.mtm', content);
      
      const result = await migrationTool.migrateFile(filePath, { 
        validateAfterMigration: true,
        dryRun: true 
      });
      
      expect(result.warnings.some(w => w.includes('ASI issue'))).toBe(true);
    });

    it('should handle transformation errors gracefully', async () => {
      // Create a scenario that might cause transformation errors
      const content = `let counter = 0;
// This line might cause issues in transformation
let problematic = function() { return this; };`;

      const filePath = createTestFile('transformation-error.mtm', content);
      
      const result = await migrationTool.migrateFile(filePath, { dryRun: true });
      
      // Should not crash, even if some transformations fail
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('performance and scalability', () => {
    it('should handle large files efficiently', async () => {
      // Create a large file with many migration opportunities
      const lines = [];
      for (let i = 0; i < 1000; i++) {
        lines.push(`let var${i} = ${i};`);
      }
      const content = lines.join('\n');

      const filePath = createTestFile('large-file.mtm', content);
      
      const startTime = Date.now();
      const result = await migrationTool.migrateFile(filePath, { dryRun: true });
      const endTime = Date.now();
      
      expect(result.success).toBe(true);
      expect(result.appliedTransformations.length).toBe(2000); // Each line generates both variable declaration and type annotation
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle batch processing efficiently', async () => {
      // Create multiple files for batch processing
      const files = [];
      for (let i = 0; i < 50; i++) {
        files.push({
          name: `batch-file-${i}.mtm`,
          content: `let counter${i} = ${i};\nconst name${i} = "test${i}";`
        });
      }

      const filePaths = files.map(f => createTestFile(f.name, f.content));
      
      const startTime = Date.now();
      const result = await migrationTool.migrateFiles(filePaths, { dryRun: true });
      const endTime = Date.now();
      
      expect(result.totalFiles).toBe(50);
      expect(result.successfulMigrations).toBe(50);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('real-world scenarios', () => {
    it('should handle a typical component file', async () => {
      const content = `// Component: Counter
let count = 0;
let isVisible = true;

function increment() {
  count++;
  updateDisplay();
}

function updateDisplay() {
  const element = document.getElementById('counter');
  element.innerHTML = \`Count: \${count}\`;
}

function toggle() {
  isVisible = !isVisible;
  const container = document.getElementById('container');
  container.style.display = isVisible ? 'block' : 'none';
}

// Event listeners
document.getElementById('increment-btn').addEventListener('click', increment);
document.getElementById('toggle-btn').addEventListener('click', toggle);`;

      const filePath = createTestFile('counter-component.mtm', content);
      
      const result = await migrationTool.migrateFile(filePath, { dryRun: true });
      
      expect(result.success).toBe(true);
      expect(result.appliedTransformations.length).toBeGreaterThan(5);
      
      // Should convert variables to reactive
      expect(result.migratedContent).toContain('count! = 0');
      expect(result.migratedContent).toContain('isVisible! = true');
      
      // Should convert functions to arrow syntax
      expect(result.migratedContent).toContain('increment = () => {');
      expect(result.migratedContent).toContain('updateDisplay = () => {');
      
      // Should convert template strings
      expect(result.migratedContent).toContain('{{$count}}');
      
      // Should convert event listeners
      expect(result.migratedContent).toContain('click="increment"');
      expect(result.migratedContent).toContain('click="toggle"');
    });

    it('should handle a form component with validation', async () => {
      const content = `// Form Component
let formData = {
  name: '',
  email: '',
  age: 0
};

let errors = {};
let isSubmitting = false;

function validateForm() {
  const newErrors = {};
  
  if (!formData.name) {
    newErrors.name = 'Name is required';
  }
  
  if (!formData.email) {
    newErrors.email = 'Email is required';
  }
  
  errors = newErrors;
  return Object.keys(newErrors).length === 0;
}

function handleSubmit() {
  if (validateForm()) {
    isSubmitting = true;
    // Submit logic here
  }
}`;

      const filePath = createTestFile('form-component.mtm', content);
      
      const result = await migrationTool.migrateFile(filePath, { dryRun: true });
      
      expect(result.success).toBe(true);
      
      // Should identify reactive state variables
      expect(result.migratedContent).toContain('formData! = {');
      expect(result.migratedContent).toContain('errors! = {}');
      expect(result.migratedContent).toContain('isSubmitting! = false');
      
      // Should convert functions
      expect(result.migratedContent).toContain('validateForm = () => {');
      expect(result.migratedContent).toContain('handleSubmit = () => {');
    });
  });
});