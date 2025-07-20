import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { 
  SyntaxMigrationAnalyzer, 
  MigrationOpportunityType, 
  MigrationComplexity,
  type FileMigrationAnalysis,
  type ProjectMigrationAnalysis,
  type MigrationReport
} from './syntax-migration-analyzer.js';

// Mock fs module
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn()
}));

// Mock the enhanced parser
vi.mock('../parser/enhanced-mtm-parser.js', () => ({
  EnhancedMTMParser: vi.fn().mockImplementation(() => ({
    parse: vi.fn()
  }))
}));

// Mock the type inference engine
vi.mock('../types/type-inference.js', () => ({
  TypeInferenceEngine: vi.fn().mockImplementation(() => ({}))
}));

// Mock the template parser
vi.mock('../parser/template-parser.js', () => ({
  TemplateParser: vi.fn().mockImplementation(() => ({
    parseTemplate: vi.fn().mockReturnValue({
      type: 'Template',
      content: '',
      bindings: [],
      expressions: []
    })
  }))
}));

describe('SyntaxMigrationAnalyzer', () => {
  let analyzer: SyntaxMigrationAnalyzer;
  let mockReadFileSync: any;
  let mockExistsSync: any;
  let mockParser: any;

  beforeEach(() => {
    analyzer = new SyntaxMigrationAnalyzer();
    mockReadFileSync = vi.mocked(readFileSync);
    mockExistsSync = vi.mocked(existsSync);
    mockParser = (analyzer as any).parser;
  });

  describe('analyzeFile', () => {
    it('should throw error if file does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      
      expect(() => analyzer.analyzeFile('nonexistent.mtm')).toThrow('File not found: nonexistent.mtm');
    });

    it('should analyze legacy file with variable declaration opportunities', () => {
      mockExistsSync.mockReturnValue(true);
      mockParser.parse.mockReturnValue({
        syntaxVersion: 'legacy',
        content: 'let counter = 0;\nconst name = "test";',
        frontmatter: { target: 'reactjs' },
        filePath: 'test.mtm'
      });

      const result = analyzer.analyzeFile('test.mtm');

      expect(result.syntaxVersion).toBe('legacy');
      expect(result.opportunities).toHaveLength(2);
      expect(result.opportunities[0].type).toBe(MigrationOpportunityType.VARIABLE_DECLARATION);
      expect(result.opportunities[0].modernEquivalent).toBe('$counter = 0');
      expect(result.opportunities[1].modernEquivalent).toBe('$name = "test"');
    });

    it('should analyze legacy file with function declaration opportunities', () => {
      mockExistsSync.mockReturnValue(true);
      mockParser.parse.mockReturnValue({
        syntaxVersion: 'legacy',
        content: 'function handleClick(event) {\n  console.log(event);\n}',
        frontmatter: { target: 'reactjs' },
        filePath: 'test.mtm'
      });

      const result = analyzer.analyzeFile('test.mtm');

      expect(result.opportunities).toHaveLength(1);
      expect(result.opportunities[0].type).toBe(MigrationOpportunityType.FUNCTION_DECLARATION);
      expect(result.opportunities[0].modernEquivalent).toBe('$handleClick = (event) => {');
      expect(result.opportunities[0].complexity).toBe(MigrationComplexity.MODERATE);
    });

    it('should identify reactive variable opportunities', () => {
      mockExistsSync.mockReturnValue(true);
      mockParser.parse.mockReturnValue({
        syntaxVersion: 'legacy',
        content: 'let counter = 0;\nlet showModal = false;',
        frontmatter: { target: 'reactjs' },
        filePath: 'test.mtm'
      });

      const result = analyzer.analyzeFile('test.mtm');

      const reactiveOpportunities = result.opportunities.filter(
        opp => opp.type === MigrationOpportunityType.REACTIVE_VARIABLE
      );
      expect(reactiveOpportunities).toHaveLength(1);
      expect(reactiveOpportunities[0].modernEquivalent).toBe('$counter! = 0');
    });

    it('should identify type annotation opportunities', () => {
      mockExistsSync.mockReturnValue(true);
      mockParser.parse.mockReturnValue({
        syntaxVersion: 'legacy',
        content: 'let price = 19.99;\nlet isActive = true;',
        frontmatter: { target: 'reactjs' },
        filePath: 'test.mtm'
      });

      const result = analyzer.analyzeFile('test.mtm');

      const typeOpportunities = result.opportunities.filter(
        opp => opp.type === MigrationOpportunityType.TYPE_ANNOTATION
      );
      expect(typeOpportunities).toHaveLength(2);
      expect(typeOpportunities[0].modernEquivalent).toBe('$price: float = 19.99');
      expect(typeOpportunities[1].modernEquivalent).toBe('$isActive: boolean = true');
    });

    it('should identify template binding opportunities', () => {
      mockExistsSync.mockReturnValue(true);
      mockParser.parse.mockReturnValue({
        syntaxVersion: 'legacy',
        content: 'element.innerHTML = `Hello, ${name}!`;',
        frontmatter: { target: 'reactjs' },
        filePath: 'test.mtm'
      });

      const result = analyzer.analyzeFile('test.mtm');

      const templateOpportunities = result.opportunities.filter(
        opp => opp.type === MigrationOpportunityType.TEMPLATE_BINDING
      );
      expect(templateOpportunities).toHaveLength(1);
      expect(templateOpportunities[0].modernEquivalent).toContain('{{$name}}');
    });

    it('should identify event handler opportunities', () => {
      mockExistsSync.mockReturnValue(true);
      mockParser.parse.mockReturnValue({
        syntaxVersion: 'legacy',
        content: 'button.addEventListener("click", handleClick);',
        frontmatter: { target: 'reactjs' },
        filePath: 'test.mtm'
      });

      const result = analyzer.analyzeFile('test.mtm');

      const eventOpportunities = result.opportunities.filter(
        opp => opp.type === MigrationOpportunityType.EVENT_HANDLER
      );
      expect(eventOpportunities).toHaveLength(1);
      expect(eventOpportunities[0].modernEquivalent).toBe('click="$handleClick"');
    });

    it('should identify semicolon optimization opportunities', () => {
      mockExistsSync.mockReturnValue(true);
      mockParser.parse.mockReturnValue({
        syntaxVersion: 'legacy',
        content: 'let counter = 0;\nreturn value;',
        frontmatter: { target: 'reactjs' },
        filePath: 'test.mtm'
      });

      const result = analyzer.analyzeFile('test.mtm');

      const semicolonOpportunities = result.opportunities.filter(
        opp => opp.type === MigrationOpportunityType.SEMICOLON_OPTIONAL
      );
      expect(semicolonOpportunities).toHaveLength(1);
      expect(semicolonOpportunities[0].modernEquivalent).toBe('let counter = 0');
    });

    it('should return no opportunities for modern syntax files', () => {
      mockExistsSync.mockReturnValue(true);
      mockParser.parse.mockReturnValue({
        syntaxVersion: 'modern',
        content: '$counter = 0;\n$name = "test";',
        frontmatter: { target: 'reactjs' },
        filePath: 'test.mtm',
        modernFeatures: {
          dollarPrefixVariables: true,
          reactiveVariables: false,
          enhancedTypeInference: false,
          optionalSemicolons: true,
          autoThisBinding: false
        }
      });

      const result = analyzer.analyzeFile('test.mtm');

      expect(result.syntaxVersion).toBe('modern');
      expect(result.opportunities).toHaveLength(0);
      expect(result.migrationScore).toBe(100);
    });

    it('should calculate migration complexity correctly', () => {
      mockExistsSync.mockReturnValue(true);
      mockParser.parse.mockReturnValue({
        syntaxVersion: 'legacy',
        content: 'let counter = 0;\nfunction handleClick() {}',
        frontmatter: { target: 'reactjs' },
        filePath: 'test.mtm'
      });

      const result = analyzer.analyzeFile('test.mtm');

      // Should have simple (variable) and moderate (function) opportunities
      expect(result.overallComplexity).toBe(MigrationComplexity.SIMPLE);
      expect(result.migrationScore).toBeGreaterThan(70);
    });

    it('should identify blockers for unsupported frameworks', () => {
      mockExistsSync.mockReturnValue(true);
      mockParser.parse.mockReturnValue({
        syntaxVersion: 'legacy',
        content: 'let counter = 0;',
        frontmatter: { target: 'angular' },
        filePath: 'test.mtm'
      });

      const result = analyzer.analyzeFile('test.mtm');

      expect(result.blockers).toContain("Target framework 'angular' may not fully support modern syntax features");
    });

    it('should generate appropriate recommendations', () => {
      mockExistsSync.mockReturnValue(true);
      mockParser.parse.mockReturnValue({
        syntaxVersion: 'legacy',
        content: 'let counter = 0;\nlet showModal = false;',
        frontmatter: { target: 'reactjs' },
        filePath: 'test.mtm'
      });

      const result = analyzer.analyzeFile('test.mtm');

      expect(result.recommendations).toContain('Start with 2 simple migration(s) for quick wins');
      expect(result.recommendations).toContain('Reactive variables will provide the most benefit - prioritize these migrations');
    });
  });

  describe('analyzeProject', () => {
    it('should analyze multiple files and provide project summary', () => {
      mockExistsSync.mockReturnValue(true);
      
      // Mock different file types
      mockParser.parse
        .mockReturnValueOnce({
          syntaxVersion: 'legacy',
          content: 'let counter = 0;',
          frontmatter: { target: 'reactjs' },
          filePath: 'legacy1.mtm'
        })
        .mockReturnValueOnce({
          syntaxVersion: 'modern',
          content: '$counter = 0;',
          frontmatter: { target: 'reactjs' },
          filePath: 'modern1.mtm',
          modernFeatures: { dollarPrefixVariables: true, reactiveVariables: false, enhancedTypeInference: false, optionalSemicolons: false, autoThisBinding: false }
        })
        .mockReturnValueOnce({
          syntaxVersion: 'legacy',
          content: 'function test() {}',
          frontmatter: { target: 'vue' },
          filePath: 'legacy2.mtm'
        });

      const result = analyzer.analyzeProject(['legacy1.mtm', 'modern1.mtm', 'legacy2.mtm']);

      expect(result.totalFiles).toBe(3);
      expect(result.legacyFiles).toBe(2);
      expect(result.modernFiles).toBe(1);
      expect(result.fileAnalyses).toHaveLength(3);
      expect(result.migrationPath).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('should generate migration path with ordered steps', () => {
      mockExistsSync.mockReturnValue(true);
      
      // Mock files with different complexities
      mockParser.parse
        .mockReturnValueOnce({
          syntaxVersion: 'legacy',
          content: 'let simple = 0;',
          frontmatter: { target: 'reactjs' },
          filePath: 'simple.mtm'
        })
        .mockReturnValueOnce({
          syntaxVersion: 'legacy',
          content: 'function moderate() {}\nlet counter = 0;',
          frontmatter: { target: 'reactjs' },
          filePath: 'moderate.mtm'
        });

      const result = analyzer.analyzeProject(['simple.mtm', 'moderate.mtm']);

      expect(result.migrationPath).toHaveLength(2);
      expect(result.migrationPath[0].title).toBe('Quick Wins - Simple Migrations');
      expect(result.migrationPath[1].title).toBe('Core Migrations - Moderate Complexity');
      expect(result.migrationPath[0].files).toContain('simple.mtm');
      expect(result.migrationPath[1].files).toContain('moderate.mtm');
    });

    it('should calculate project-wide metrics correctly', () => {
      mockExistsSync.mockReturnValue(true);
      
      mockParser.parse
        .mockReturnValue({
          syntaxVersion: 'legacy',
          content: 'let counter = 0;',
          frontmatter: { target: 'reactjs' },
          filePath: 'test.mtm'
        });

      const result = analyzer.analyzeProject(['test1.mtm', 'test2.mtm']);

      expect(result.overallComplexity).toBe(MigrationComplexity.SIMPLE);
      expect(result.migrationScore).toBeGreaterThan(0);
      expect(result.estimatedEffort).toBeDefined();
    });
  });

  describe('generateMigrationReport', () => {
    it('should generate comprehensive migration report', () => {
      const mockProjectAnalysis: ProjectMigrationAnalysis = {
        totalFiles: 2,
        legacyFiles: 1,
        modernFiles: 1,
        mixedFiles: 1,
        fileAnalyses: [
          {
            filePath: 'legacy.mtm',
            syntaxVersion: 'legacy',
            opportunities: [
              {
                type: MigrationOpportunityType.VARIABLE_DECLARATION,
                location: { line: 1, column: 1, index: 0 },
                legacyCode: 'let counter = 0;',
                modernEquivalent: '$counter = 0',
                complexity: MigrationComplexity.SIMPLE,
                description: 'Convert let declaration to modern $ prefix syntax',
                benefits: ['Cleaner syntax'],
                risks: [],
                dependencies: []
              }
            ],
            overallComplexity: MigrationComplexity.SIMPLE,
            migrationScore: 85,
            estimatedEffort: '15-30 minutes',
            blockers: [],
            recommendations: ['Start with simple migrations']
          },
          {
            filePath: 'modern.mtm',
            syntaxVersion: 'modern',
            opportunities: [],
            overallComplexity: MigrationComplexity.SIMPLE,
            migrationScore: 100,
            estimatedEffort: 'No migration needed',
            blockers: [],
            recommendations: ['File already uses modern syntax']
          }
        ],
        overallComplexity: MigrationComplexity.SIMPLE,
        migrationScore: 92,
        estimatedEffort: 'Less than 1 day',
        migrationPath: [],
        dependencies: [],
        recommendations: ['50% of files already use modern syntax']
      };

      const report = analyzer.generateMigrationReport(mockProjectAnalysis);

      expect(report.analysis).toBe(mockProjectAnalysis);
      expect(report.summary.readyToMigrate).toBe(true);
      expect(report.summary.quickWins).toHaveLength(1);
      expect(report.summary.timeEstimate).toBe('Less than 1 day');
      expect(report.detailedRecommendations.immediate).toBeDefined();
      expect(report.detailedRecommendations.shortTerm).toBeDefined();
      expect(report.detailedRecommendations.longTerm).toBeDefined();
      expect(report.riskAssessment.low).toBeDefined();
      expect(report.riskAssessment.medium).toBeDefined();
      expect(report.riskAssessment.high).toBeDefined();
    });

    it('should identify project as not ready for migration when score is low', () => {
      const mockProjectAnalysis: ProjectMigrationAnalysis = {
        totalFiles: 1,
        legacyFiles: 1,
        modernFiles: 0,
        mixedFiles: 1,
        fileAnalyses: [
          {
            filePath: 'complex.mtm',
            syntaxVersion: 'legacy',
            opportunities: [],
            overallComplexity: MigrationComplexity.MANUAL,
            migrationScore: 20,
            estimatedEffort: '1-2 weeks',
            blockers: ['High complexity', 'Multiple dependencies'],
            recommendations: []
          }
        ],
        overallComplexity: MigrationComplexity.MANUAL,
        migrationScore: 20,
        estimatedEffort: '1-2 weeks',
        migrationPath: [],
        dependencies: [],
        recommendations: []
      };

      const report = analyzer.generateMigrationReport(mockProjectAnalysis);

      expect(report.summary.readyToMigrate).toBe(false);
      expect(report.riskAssessment.high).toContain('Low migration score indicates high complexity and potential for issues');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle parser errors gracefully', () => {
      mockExistsSync.mockReturnValue(true);
      mockParser.parse.mockImplementation(() => {
        throw new Error('Parser error');
      });

      expect(() => analyzer.analyzeFile('test.mtm')).toThrow('Failed to analyze file test.mtm: Parser error');
    });

    it('should handle empty files', () => {
      mockExistsSync.mockReturnValue(true);
      mockParser.parse.mockReturnValue({
        syntaxVersion: 'legacy',
        content: '',
        frontmatter: { target: 'reactjs' },
        filePath: 'empty.mtm'
      });

      const result = analyzer.analyzeFile('empty.mtm');

      expect(result.opportunities).toHaveLength(0);
      expect(result.migrationScore).toBe(90);
    });

    it('should handle files with only comments', () => {
      mockExistsSync.mockReturnValue(true);
      mockParser.parse.mockReturnValue({
        syntaxVersion: 'legacy',
        content: '// This is a comment\n/* Another comment */',
        frontmatter: { target: 'reactjs' },
        filePath: 'comments.mtm'
      });

      const result = analyzer.analyzeFile('comments.mtm');

      expect(result.opportunities).toHaveLength(0);
    });

    it('should handle project with no files', () => {
      const result = analyzer.analyzeProject([]);

      expect(result.totalFiles).toBe(0);
      expect(result.legacyFiles).toBe(0);
      expect(result.modernFiles).toBe(0);
      expect(result.overallComplexity).toBe(MigrationComplexity.SIMPLE);
      expect(result.migrationScore).toBe(100);
    });
  });

  describe('complexity calculation', () => {
    it('should calculate simple complexity for basic opportunities', () => {
      const opportunities = [
        {
          type: MigrationOpportunityType.VARIABLE_DECLARATION,
          complexity: MigrationComplexity.SIMPLE,
          location: { line: 1, column: 1, index: 0 },
          legacyCode: 'let x = 1;',
          modernEquivalent: '$x = 1',
          description: 'test',
          benefits: [],
          risks: [],
          dependencies: []
        }
      ];

      const complexity = (analyzer as any).calculateOverallComplexity(opportunities);
      expect(complexity).toBe(MigrationComplexity.SIMPLE);
    });

    it('should calculate moderate complexity for mixed opportunities', () => {
      const opportunities = [
        {
          type: MigrationOpportunityType.VARIABLE_DECLARATION,
          complexity: MigrationComplexity.SIMPLE,
          location: { line: 1, column: 1, index: 0 },
          legacyCode: 'let x = 1;',
          modernEquivalent: '$x = 1',
          description: 'test',
          benefits: [],
          risks: [],
          dependencies: []
        },
        {
          type: MigrationOpportunityType.FUNCTION_DECLARATION,
          complexity: MigrationComplexity.MODERATE,
          location: { line: 2, column: 1, index: 0 },
          legacyCode: 'function test() {}',
          modernEquivalent: '$test = () => {}',
          description: 'test',
          benefits: [],
          risks: [],
          dependencies: []
        }
      ];

      const complexity = (analyzer as any).calculateOverallComplexity(opportunities);
      expect(complexity).toBe(MigrationComplexity.SIMPLE);
    });
  });

  describe('migration score calculation', () => {
    it('should give high score for simple opportunities', () => {
      const opportunities = [
        {
          type: MigrationOpportunityType.VARIABLE_DECLARATION,
          complexity: MigrationComplexity.SIMPLE,
          location: { line: 1, column: 1, index: 0 },
          legacyCode: 'let x = 1;',
          modernEquivalent: '$x = 1',
          description: 'test',
          benefits: [],
          risks: [],
          dependencies: []
        }
      ];

      const file = {
        syntaxVersion: 'legacy' as const,
        content: 'let x = 1;',
        frontmatter: { target: 'reactjs' },
        filePath: 'test.mtm'
      };

      const score = (analyzer as any).calculateMigrationScore(opportunities, file);
      expect(score).toBeGreaterThan(80);
    });

    it('should give lower score for complex opportunities', () => {
      const opportunities = Array(10).fill(null).map((_, i) => ({
        type: MigrationOpportunityType.FUNCTION_DECLARATION,
        complexity: MigrationComplexity.COMPLEX,
        location: { line: i + 1, column: 1, index: 0 },
        legacyCode: `function test${i}() {}`,
        modernEquivalent: `$test${i} = () => {}`,
        description: 'test',
        benefits: [],
        risks: [],
        dependencies: []
      }));

      const file = {
        syntaxVersion: 'legacy' as const,
        content: 'complex content',
        frontmatter: { target: 'reactjs' },
        filePath: 'test.mtm'
      };

      const score = (analyzer as any).calculateMigrationScore(opportunities, file);
      expect(score).toBeLessThan(60);
    });
  });
});