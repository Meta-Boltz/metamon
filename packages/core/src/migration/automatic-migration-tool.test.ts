import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AutomaticMigrationTool } from './automatic-migration-tool.js';
import { MigrationOpportunityType, MigrationComplexity } from './syntax-migration-analyzer.js';

describe('AutomaticMigrationTool', () => {
  let migrationTool: AutomaticMigrationTool;

  beforeEach(() => {
    migrationTool = new AutomaticMigrationTool();
  });

  describe('migration rules', () => {
    it('should return safe transformation rules', () => {
      const safeRules = migrationTool.getSafeTransformationRules();
      
      expect(safeRules.length).toBeGreaterThan(0);
      expect(safeRules.every(rule => 
        rule.type === MigrationOpportunityType.VARIABLE_DECLARATION ||
        rule.type === MigrationOpportunityType.SEMICOLON_OPTIONAL ||
        rule.type === MigrationOpportunityType.TYPE_ANNOTATION
      )).toBe(true);
    });

    it('should return all transformation rules', () => {
      const allRules = migrationTool.getAllTransformationRules();
      
      expect(allRules.length).toBeGreaterThan(0);
      expect(allRules.some(rule => rule.type === MigrationOpportunityType.VARIABLE_DECLARATION)).toBe(true);
      expect(allRules.some(rule => rule.type === MigrationOpportunityType.FUNCTION_DECLARATION)).toBe(true);
      expect(allRules.some(rule => rule.type === MigrationOpportunityType.REACTIVE_VARIABLE)).toBe(true);
    });

    it('should allow adding custom migration rules', () => {
      const customRule = {
        type: MigrationOpportunityType.VARIABLE_DECLARATION,
        pattern: /custom/,
        replacement: 'custom replacement'
      };

      const initialCount = migrationTool.getAllTransformationRules().length;
      migrationTool.addMigrationRule(customRule);
      
      expect(migrationTool.getAllTransformationRules().length).toBe(initialCount + 1);
    });

    it('should allow removing migration rules', () => {
      const initialCount = migrationTool.getAllTransformationRules().length;
      migrationTool.removeMigrationRule(MigrationOpportunityType.VARIABLE_DECLARATION);
      
      expect(migrationTool.getAllTransformationRules().length).toBeLessThan(initialCount);
    });
  });

  describe('rule patterns', () => {
    it('should have correct variable declaration pattern', () => {
      const rules = migrationTool.getAllTransformationRules();
      const varRule = rules.find(r => r.type === MigrationOpportunityType.VARIABLE_DECLARATION);
      
      expect(varRule).toBeDefined();
      expect(varRule!.pattern.test('let counter = 0;')).toBe(true);
      expect(varRule!.pattern.test('const name = "test";')).toBe(true);
      expect(varRule!.pattern.test('var value = 42;')).toBe(true);
    });

    it('should have correct function declaration pattern', () => {
      const rules = migrationTool.getAllTransformationRules();
      const funcRule = rules.find(r => r.type === MigrationOpportunityType.FUNCTION_DECLARATION);
      
      expect(funcRule).toBeDefined();
      expect(funcRule!.pattern.test('function test() {')).toBe(true);
      expect(funcRule!.pattern.test('function myFunc(a, b) {')).toBe(true);
    });

    it('should have correct semicolon optional pattern', () => {
      const rules = migrationTool.getAllTransformationRules();
      const semicolonRule = rules.find(r => r.type === MigrationOpportunityType.SEMICOLON_OPTIONAL);
      
      expect(semicolonRule).toBeDefined();
      expect(semicolonRule!.pattern.test('let counter = 0;')).toBe(true);
      expect(semicolonRule!.pattern.test('return value;')).toBe(true);
    });
  });

  describe('transformation logic', () => {
    it('should transform variable declarations correctly', () => {
      const rules = migrationTool.getAllTransformationRules();
      const varRule = rules.find(r => r.type === MigrationOpportunityType.VARIABLE_DECLARATION);
      
      const testLine = 'let counter = 0;';
      const match = testLine.match(varRule!.pattern);
      
      expect(match).toBeTruthy();
      
      if (typeof varRule!.replacement === 'function' && match) {
        const mockContext = {
          filePath: 'test.mtm',
          originalContent: testLine,
          currentContent: testLine,
          lineNumber: 1,
          opportunity: {
            type: MigrationOpportunityType.VARIABLE_DECLARATION,
            location: { line: 1, column: 1, index: 0 },
            legacyCode: testLine,
            modernEquivalent: '$counter = 0',
            complexity: MigrationComplexity.SIMPLE,
            description: 'Test',
            benefits: [],
            risks: [],
            dependencies: []
          },
          allOpportunities: []
        };
        
        const result = varRule!.replacement(match, mockContext);
        expect(result).toBe('counter = 0');
      }
    });

    it('should transform function declarations correctly', () => {
      const rules = migrationTool.getAllTransformationRules();
      const funcRule = rules.find(r => r.type === MigrationOpportunityType.FUNCTION_DECLARATION);
      
      const testLine = 'function test(a, b) {';
      const match = testLine.match(funcRule!.pattern);
      
      expect(match).toBeTruthy();
      
      if (typeof funcRule!.replacement === 'function' && match) {
        const mockContext = {
          filePath: 'test.mtm',
          originalContent: testLine,
          currentContent: testLine,
          lineNumber: 1,
          opportunity: {
            type: MigrationOpportunityType.FUNCTION_DECLARATION,
            location: { line: 1, column: 1, index: 0 },
            legacyCode: testLine,
            modernEquivalent: '$test = (a, b) => {',
            complexity: MigrationComplexity.MODERATE,
            description: 'Test',
            benefits: [],
            risks: [],
            dependencies: []
          },
          allOpportunities: []
        };
        
        const result = funcRule!.replacement(match, mockContext);
        expect(result).toBe('test = (a, b) => {');
      }
    });

    it('should handle type annotation transformations', () => {
      const rules = migrationTool.getAllTransformationRules();
      const typeRule = rules.find(r => r.type === MigrationOpportunityType.TYPE_ANNOTATION);
      
      const testLine = 'let name = "test";';
      const match = testLine.match(typeRule!.pattern);
      
      expect(match).toBeTruthy();
      
      if (typeof typeRule!.replacement === 'function' && match) {
        const mockContext = {
          filePath: 'test.mtm',
          originalContent: testLine,
          currentContent: testLine,
          lineNumber: 1,
          opportunity: {
            type: MigrationOpportunityType.TYPE_ANNOTATION,
            location: { line: 1, column: 1, index: 0 },
            legacyCode: testLine,
            modernEquivalent: '$name: string = "test"',
            complexity: MigrationComplexity.SIMPLE,
            description: 'Test',
            benefits: [],
            risks: [],
            dependencies: []
          },
          allOpportunities: []
        };
        
        const result = typeRule!.replacement(match, mockContext);
        expect(result).toContain('string');
        expect(result).toContain('name');
      }
    });
  });

  describe('rule conditions', () => {
    it('should respect function declaration conditions', () => {
      const rules = migrationTool.getAllTransformationRules();
      const funcRule = rules.find(r => r.type === MigrationOpportunityType.FUNCTION_DECLARATION);
      
      expect(funcRule?.conditions).toBeDefined();
      
      if (funcRule?.conditions) {
        // Should allow simple and moderate complexity
        const simpleContext = {
          filePath: 'test.mtm',
          originalContent: '',
          currentContent: '',
          lineNumber: 1,
          opportunity: {
            type: MigrationOpportunityType.FUNCTION_DECLARATION,
            location: { line: 1, column: 1, index: 0 },
            legacyCode: '',
            modernEquivalent: '',
            complexity: MigrationComplexity.SIMPLE,
            description: '',
            benefits: [],
            risks: [],
            dependencies: []
          },
          allOpportunities: []
        };
        
        const complexContext = {
          ...simpleContext,
          opportunity: {
            ...simpleContext.opportunity,
            complexity: MigrationComplexity.COMPLEX
          }
        };
        
        expect(funcRule.conditions(simpleContext)).toBe(true);
        expect(funcRule.conditions(complexContext)).toBe(false);
      }
    });

    it('should respect reactive variable conditions', () => {
      const rules = migrationTool.getAllTransformationRules();
      const reactiveRule = rules.find(r => r.type === MigrationOpportunityType.REACTIVE_VARIABLE);
      
      expect(reactiveRule?.conditions).toBeDefined();
      
      if (reactiveRule?.conditions) {
        const moderateContext = {
          filePath: 'test.mtm',
          originalContent: '',
          currentContent: '',
          lineNumber: 1,
          opportunity: {
            type: MigrationOpportunityType.REACTIVE_VARIABLE,
            location: { line: 1, column: 1, index: 0 },
            legacyCode: '',
            modernEquivalent: '',
            complexity: MigrationComplexity.MODERATE,
            description: '',
            benefits: [],
            risks: [],
            dependencies: []
          },
          allOpportunities: []
        };
        
        const manualContext = {
          ...moderateContext,
          opportunity: {
            ...moderateContext.opportunity,
            complexity: MigrationComplexity.MANUAL
          }
        };
        
        expect(reactiveRule.conditions(moderateContext)).toBe(true);
        expect(reactiveRule.conditions(manualContext)).toBe(false);
      }
    });
  });

  describe('integration', () => {
    it('should have all expected migration rule types', () => {
      const rules = migrationTool.getAllTransformationRules();
      const ruleTypes = rules.map(r => r.type);
      
      expect(ruleTypes).toContain(MigrationOpportunityType.VARIABLE_DECLARATION);
      expect(ruleTypes).toContain(MigrationOpportunityType.FUNCTION_DECLARATION);
      expect(ruleTypes).toContain(MigrationOpportunityType.TYPE_ANNOTATION);
      expect(ruleTypes).toContain(MigrationOpportunityType.REACTIVE_VARIABLE);
      expect(ruleTypes).toContain(MigrationOpportunityType.SEMICOLON_OPTIONAL);
      expect(ruleTypes).toContain(MigrationOpportunityType.TEMPLATE_BINDING);
      expect(ruleTypes).toContain(MigrationOpportunityType.EVENT_HANDLER);
      expect(ruleTypes).toContain(MigrationOpportunityType.CLASS_PROPERTY);
    });

    it('should maintain rule consistency', () => {
      const rules = migrationTool.getAllTransformationRules();
      
      rules.forEach(rule => {
        expect(rule.type).toBeDefined();
        expect(rule.pattern).toBeInstanceOf(RegExp);
        expect(rule.replacement).toBeDefined();
        expect(typeof rule.replacement === 'string' || typeof rule.replacement === 'function').toBe(true);
      });
    });
  });
});