import { readFileSync, existsSync } from 'fs';
import { EnhancedMTMParser, type EnhancedMTMFile, type SyntaxVersion, type ModernSyntaxFeatures } from '../parser/enhanced-mtm-parser.js';
import type { SourceLocation } from '../types/unified-ast.js';

/**
 * Migration opportunity types
 */
export enum MigrationOpportunityType {
  VARIABLE_DECLARATION = 'variable_declaration',
  FUNCTION_DECLARATION = 'function_declaration',
  REACTIVE_VARIABLE = 'reactive_variable',
  TYPE_ANNOTATION = 'type_annotation',
  TEMPLATE_BINDING = 'template_binding',
  EVENT_HANDLER = 'event_handler',
  CLASS_PROPERTY = 'class_property',
  SEMICOLON_OPTIONAL = 'semicolon_optional'
}

/**
 * Migration complexity levels
 */
export enum MigrationComplexity {
  SIMPLE = 'simple',
  MODERATE = 'moderate',
  COMPLEX = 'complex',
  MANUAL = 'manual'
}

/**
 * Migration opportunity detected in legacy code
 */
export interface MigrationOpportunity {
  type: MigrationOpportunityType;
  location: SourceLocation;
  legacyCode: string;
  modernEquivalent: string;
  complexity: MigrationComplexity;
  description: string;
  benefits: string[];
  risks: string[];
  dependencies: string[];
}

/**
 * Migration analysis result for a single file
 */
export interface FileMigrationAnalysis {
  filePath: string;
  syntaxVersion: SyntaxVersion;
  modernFeatures?: ModernSyntaxFeatures;
  opportunities: MigrationOpportunity[];
  overallComplexity: MigrationComplexity;
  migrationScore: number; // 0-100, higher means easier to migrate
  estimatedEffort: string;
  blockers: string[];
  recommendations: string[];
}

/**
 * Project-wide migration analysis
 */
export interface ProjectMigrationAnalysis {
  totalFiles: number;
  legacyFiles: number;
  modernFiles: number;
  mixedFiles: number;
  fileAnalyses: FileMigrationAnalysis[];
  overallComplexity: MigrationComplexity;
  migrationScore: number;
  estimatedEffort: string;
  migrationPath: MigrationStep[];
  dependencies: ProjectDependency[];
  recommendations: string[];
}

/**
 * Migration step in the recommended path
 */
export interface MigrationStep {
  order: number;
  title: string;
  description: string;
  files: string[];
  complexity: MigrationComplexity;
  estimatedTime: string;
  prerequisites: string[];
}

/**
 * Project dependency that might affect migration
 */
export interface ProjectDependency {
  name: string;
  version: string;
  type: 'framework' | 'build-tool' | 'library';
  migrationImpact: 'none' | 'low' | 'medium' | 'high';
  notes: string;
}

/**
 * Migration report with detailed analysis and recommendations
 */
export interface MigrationReport {
  analysis: ProjectMigrationAnalysis;
  summary: {
    readyToMigrate: boolean;
    quickWins: MigrationOpportunity[];
    majorChallenges: string[];
    timeEstimate: string;
  };
  detailedRecommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  riskAssessment: {
    low: string[];
    medium: string[];
    high: string[];
  };
}

/**
 * Syntax migration analyzer that identifies opportunities to migrate from legacy to modern MTM syntax
 */
export class SyntaxMigrationAnalyzer {
  private parser = new EnhancedMTMParser();

  /**
   * Analyze a single MTM file for migration opportunities
   */
  analyzeFile(filePath: string): FileMigrationAnalysis {
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    try {
      const parsedFile = this.parser.parse(filePath);
      const opportunities = this.identifyMigrationOpportunities(parsedFile);
      const overallComplexity = this.calculateOverallComplexity(opportunities);
      const migrationScore = this.calculateMigrationScore(opportunities, parsedFile);
      const estimatedEffort = this.estimateEffort(opportunities, overallComplexity);
      const blockers = this.identifyBlockers(parsedFile, opportunities);
      const recommendations = this.generateFileRecommendations(parsedFile, opportunities);

      return {
        filePath,
        syntaxVersion: parsedFile.syntaxVersion,
        modernFeatures: parsedFile.modernFeatures,
        opportunities,
        overallComplexity,
        migrationScore,
        estimatedEffort,
        blockers,
        recommendations
      };
    } catch (error) {
      throw new Error(`Failed to analyze file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze multiple files or an entire project
   */
  analyzeProject(filePaths: string[]): ProjectMigrationAnalysis {
    const fileAnalyses = filePaths.map(filePath => this.analyzeFile(filePath));
    
    const totalFiles = fileAnalyses.length;
    const legacyFiles = fileAnalyses.filter(analysis => analysis.syntaxVersion === 'legacy').length;
    const modernFiles = fileAnalyses.filter(analysis => analysis.syntaxVersion === 'modern').length;
    const mixedFiles = fileAnalyses.filter(analysis => 
      analysis.syntaxVersion === 'legacy' && analysis.opportunities.length > 0
    ).length;

    const overallComplexity = this.calculateProjectComplexity(fileAnalyses);
    const migrationScore = this.calculateProjectMigrationScore(fileAnalyses);
    const estimatedEffort = this.estimateProjectEffort(fileAnalyses);
    const migrationPath = this.generateMigrationPath(fileAnalyses);
    const dependencies = this.analyzeDependencies(filePaths);
    const recommendations = this.generateProjectRecommendations(fileAnalyses);

    return {
      totalFiles,
      legacyFiles,
      modernFiles,
      mixedFiles,
      fileAnalyses,
      overallComplexity,
      migrationScore,
      estimatedEffort,
      migrationPath,
      dependencies,
      recommendations
    };
  }

  /**
   * Generate a comprehensive migration report
   */
  generateMigrationReport(projectAnalysis: ProjectMigrationAnalysis): MigrationReport {
    const quickWins = this.identifyQuickWins(projectAnalysis);
    const majorChallenges = this.identifyMajorChallenges(projectAnalysis);
    const readyToMigrate = this.assessMigrationReadiness(projectAnalysis);
    const timeEstimate = this.calculateTimeEstimate(projectAnalysis);
    
    const detailedRecommendations = this.generateDetailedRecommendations(projectAnalysis);
    const riskAssessment = this.assessRisks(projectAnalysis);

    return {
      analysis: projectAnalysis,
      summary: {
        readyToMigrate,
        quickWins,
        majorChallenges,
        timeEstimate
      },
      detailedRecommendations,
      riskAssessment
    };
  }

  /**
   * Identify migration opportunities in a parsed file
   */
  private identifyMigrationOpportunities(file: EnhancedMTMFile): MigrationOpportunity[] {
    if (file.syntaxVersion === 'modern') {
      return []; // Already using modern syntax
    }

    const opportunities: MigrationOpportunity[] = [];
    const content = file.content;
    const lines = content.split('\n');

    // Analyze each line for migration opportunities
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
        return;
      }

      // Check for variable declarations that could use $ prefix
      const variableOpportunity = this.checkVariableDeclaration(line, lineNumber);
      if (variableOpportunity) {
        opportunities.push(variableOpportunity);
      }

      // Check for function declarations that could use modern syntax
      const functionOpportunity = this.checkFunctionDeclaration(line, lineNumber);
      if (functionOpportunity) {
        opportunities.push(functionOpportunity);
      }

      // Check for reactive variable opportunities
      const reactiveOpportunity = this.checkReactiveVariable(line, lineNumber);
      if (reactiveOpportunity) {
        opportunities.push(reactiveOpportunity);
      }

      // Check for type annotation opportunities
      const typeOpportunity = this.checkTypeAnnotation(line, lineNumber);
      if (typeOpportunity) {
        opportunities.push(typeOpportunity);
      }

      // Check for template binding opportunities
      const templateOpportunity = this.checkTemplateBinding(line, lineNumber);
      if (templateOpportunity) {
        opportunities.push(templateOpportunity);
      }

      // Check for event handler opportunities
      const eventOpportunity = this.checkEventHandler(line, lineNumber);
      if (eventOpportunity) {
        opportunities.push(eventOpportunity);
      }

      // Check for class property opportunities
      const classOpportunity = this.checkClassProperty(line, lineNumber);
      if (classOpportunity) {
        opportunities.push(classOpportunity);
      }

      // Check for semicolon optimization opportunities
      const semicolonOpportunity = this.checkSemicolonOptimization(line, lineNumber);
      if (semicolonOpportunity) {
        opportunities.push(semicolonOpportunity);
      }
    });

    return opportunities;
  }

  /**
   * Check for variable declaration migration opportunities
   */
  private checkVariableDeclaration(line: string, lineNumber: number): MigrationOpportunity | null {
    // Match legacy variable declarations: let/const/var name = value
    const legacyVarMatch = line.match(/^\s*(let|const|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+);?\s*$/);
    
    if (legacyVarMatch) {
      const [, keyword, varName, value] = legacyVarMatch;
      const modernEquivalent = `$${varName} = ${value.replace(/;$/, '')}`;
      
      return {
        type: MigrationOpportunityType.VARIABLE_DECLARATION,
        location: { line: lineNumber, column: 1, index: 0 },
        legacyCode: line.trim(),
        modernEquivalent,
        complexity: MigrationComplexity.SIMPLE,
        description: `Convert ${keyword} declaration to modern $ prefix syntax`,
        benefits: [
          'Cleaner syntax',
          'Better type inference',
          'Consistent with modern MTM style'
        ],
        risks: [
          'Need to update all references to use $ prefix'
        ],
        dependencies: []
      };
    }

    return null;
  }

  /**
   * Check for function declaration migration opportunities
   */
  private checkFunctionDeclaration(line: string, lineNumber: number): MigrationOpportunity | null {
    // Match legacy function declarations: function name(params) { ... }
    const legacyFuncMatch = line.match(/^\s*function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\{?\s*$/);
    
    if (legacyFuncMatch) {
      const [, funcName, params] = legacyFuncMatch;
      const modernEquivalent = `$${funcName} = (${params}) => {`;
      
      return {
        type: MigrationOpportunityType.FUNCTION_DECLARATION,
        location: { line: lineNumber, column: 1, index: 0 },
        legacyCode: line.trim(),
        modernEquivalent,
        complexity: MigrationComplexity.MODERATE,
        description: `Convert function declaration to modern arrow function syntax`,
        benefits: [
          'Automatic this binding',
          'Cleaner syntax',
          'Better type inference for parameters'
        ],
        risks: [
          'this binding behavior changes',
          'Need to update function calls to use $ prefix'
        ],
        dependencies: []
      };
    }

    return null;
  }

  /**
   * Check for reactive variable opportunities
   */
  private checkReactiveVariable(line: string, lineNumber: number): MigrationOpportunity | null {
    // Look for variables that are used in UI updates or event handlers
    const stateVarMatch = line.match(/^\s*(let|const|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+);?\s*$/);
    
    if (stateVarMatch) {
      const [, keyword, varName, value] = stateVarMatch;
      
      // Check if this looks like a state variable (common patterns)
      const statePatterns = [
        /count/i, /state/i, /value/i, /data/i, /item/i, /list/i, /show/i, /visible/i, /active/i
      ];
      
      const isLikelyState = statePatterns.some(pattern => pattern.test(varName));
      
      if (isLikelyState) {
        const modernEquivalent = `$${varName}! = ${value.replace(/;$/, '')}`;
        
        return {
          type: MigrationOpportunityType.REACTIVE_VARIABLE,
          location: { line: lineNumber, column: 1, index: 0 },
          legacyCode: line.trim(),
          modernEquivalent,
          complexity: MigrationComplexity.MODERATE,
          description: `Convert to reactive variable for automatic UI updates`,
          benefits: [
            'Automatic UI updates when value changes',
            'No manual DOM manipulation needed',
            'Better performance with batched updates'
          ],
          risks: [
            'Need to verify all usage patterns support reactivity',
            'May require template updates'
          ],
          dependencies: ['template_binding']
        };
      }
    }

    return null;
  }

  /**
   * Check for type annotation opportunities
   */
  private checkTypeAnnotation(line: string, lineNumber: number): MigrationOpportunity | null {
    // Look for variables with obvious types that could benefit from explicit annotation
    const varMatch = line.match(/^\s*(let|const|var|\$[a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+);?\s*$/);
    
    if (varMatch) {
      const [, varDecl, value] = varMatch;
      const cleanValue = value.replace(/;$/, '').trim();
      
      let inferredType: string | null = null;
      
      // Infer type from value
      if (/^["'`].*["'`]$/.test(cleanValue)) {
        inferredType = 'string';
      } else if (/^\d+$/.test(cleanValue)) {
        inferredType = 'number';
      } else if (/^\d+\.\d+$/.test(cleanValue)) {
        inferredType = 'float';
      } else if (/^(true|false)$/.test(cleanValue)) {
        inferredType = 'boolean';
      } else if (/^\[.*\]$/.test(cleanValue)) {
        inferredType = 'array';
      } else if (/^\{.*\}$/.test(cleanValue)) {
        inferredType = 'object';
      }
      
      if (inferredType && !varDecl.includes(':')) {
        const varName = varDecl.replace(/^\$/, '').replace(/^(let|const|var)\s+/, '');
        const modernEquivalent = `$${varName}: ${inferredType} = ${cleanValue}`;
        
        return {
          type: MigrationOpportunityType.TYPE_ANNOTATION,
          location: { line: lineNumber, column: 1, index: 0 },
          legacyCode: line.trim(),
          modernEquivalent,
          complexity: MigrationComplexity.SIMPLE,
          description: `Add explicit type annotation for better type safety`,
          benefits: [
            'Better type checking',
            'Improved IDE support',
            'Self-documenting code'
          ],
          risks: [
            'May reveal existing type mismatches'
          ],
          dependencies: []
        };
      }
    }

    return null;
  }

  /**
   * Check for template binding opportunities
   */
  private checkTemplateBinding(line: string, lineNumber: number): MigrationOpportunity | null {
    // Look for template strings or DOM manipulation that could use modern binding
    const templateMatch = line.match(/innerHTML\s*=\s*[`"'].*\$\{([^}]+)\}.*[`"']/);
    
    if (templateMatch) {
      const [fullMatch, variable] = templateMatch;
      const modernEquivalent = line.replace(/\$\{([^}]+)\}/g, '{{$$$1}}');
      
      return {
        type: MigrationOpportunityType.TEMPLATE_BINDING,
        location: { line: lineNumber, column: 1, index: 0 },
        legacyCode: line.trim(),
        modernEquivalent,
        complexity: MigrationComplexity.MODERATE,
        description: `Convert template string to modern data binding syntax`,
        benefits: [
          'Automatic updates when data changes',
          'Better performance',
          'Cleaner template syntax'
        ],
        risks: [
          'Need to ensure variables are reactive',
          'Template structure may need adjustment'
        ],
        dependencies: ['reactive_variable']
      };
    }

    return null;
  }

  /**
   * Check for event handler opportunities
   */
  private checkEventHandler(line: string, lineNumber: number): MigrationOpportunity | null {
    // Look for addEventListener calls that could use modern syntax
    const eventMatch = line.match(/addEventListener\s*\(\s*['"]([^'"]+)['"]\s*,\s*([^)]+)\s*\)/);
    
    if (eventMatch) {
      const [, eventType, handler] = eventMatch;
      const modernEquivalent = `${eventType}="$${handler.replace(/^\w+\./, '')}"`;
      
      return {
        type: MigrationOpportunityType.EVENT_HANDLER,
        location: { line: lineNumber, column: 1, index: 0 },
        legacyCode: line.trim(),
        modernEquivalent,
        complexity: MigrationComplexity.MODERATE,
        description: `Convert event listener to modern template event binding`,
        benefits: [
          'Cleaner template syntax',
          'Automatic this binding',
          'Better integration with reactive system'
        ],
        risks: [
          'Need to move handler to template',
          'Handler function needs $ prefix'
        ],
        dependencies: ['function_declaration']
      };
    }

    return null;
  }

  /**
   * Check for class property opportunities
   */
  private checkClassProperty(line: string, lineNumber: number): MigrationOpportunity | null {
    // Look for class properties that could use modern syntax
    const classPropertyMatch = line.match(/^\s*(public|private|protected)?\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[:=]\s*(.+);?\s*$/);
    
    if (classPropertyMatch) {
      const [, visibility, propName, value] = classPropertyMatch;
      const modernEquivalent = `$${propName} = ${value.replace(/;$/, '')}`;
      
      return {
        type: MigrationOpportunityType.CLASS_PROPERTY,
        location: { line: lineNumber, column: 1, index: 0 },
        legacyCode: line.trim(),
        modernEquivalent,
        complexity: MigrationComplexity.SIMPLE,
        description: `Convert class property to modern $ prefix syntax`,
        benefits: [
          'Consistent syntax with other variables',
          'Better type inference',
          'Automatic this binding for methods'
        ],
        risks: [
          'Need to update all property references'
        ],
        dependencies: []
      };
    }

    return null;
  }

  /**
   * Check for semicolon optimization opportunities
   */
  private checkSemicolonOptimization(line: string, lineNumber: number): MigrationOpportunity | null {
    // Look for lines that end with semicolons that could be optional
    if (line.trim().endsWith(';')) {
      const withoutSemicolon = line.replace(/;\s*$/, '');
      
      // Check if this is a statement that can safely omit semicolon
      const safePatterns = [
        /^\s*(let|const|var|\$\w+)\s+\w+\s*=\s*.+$/,  // Variable declarations
        /^\s*\w+\s*=\s*.+$/,                          // Assignments
        /^\s*return\s+.+$/,                           // Return statements
        /^\s*\w+\([^)]*\)$/                           // Function calls
      ];
      
      const isSafeToOmit = safePatterns.some(pattern => pattern.test(withoutSemicolon));
      
      if (isSafeToOmit) {
        return {
          type: MigrationOpportunityType.SEMICOLON_OPTIONAL,
          location: { line: lineNumber, column: line.length, index: 0 },
          legacyCode: line.trim(),
          modernEquivalent: withoutSemicolon,
          complexity: MigrationComplexity.SIMPLE,
          description: `Remove optional semicolon for cleaner modern syntax`,
          benefits: [
            'Cleaner, more modern appearance',
            'Consistent with modern JavaScript style',
            'Less visual clutter'
          ],
          risks: [
            'Need to ensure no ASI ambiguities',
            'Team style preferences may vary'
          ],
          dependencies: []
        };
      }
    }

    return null;
  }

  /**
   * Calculate overall complexity for a file
   */
  private calculateOverallComplexity(opportunities: MigrationOpportunity[]): MigrationComplexity {
    if (opportunities.length === 0) {
      return MigrationComplexity.SIMPLE;
    }

    const complexityScores = {
      [MigrationComplexity.SIMPLE]: 1,
      [MigrationComplexity.MODERATE]: 2,
      [MigrationComplexity.COMPLEX]: 3,
      [MigrationComplexity.MANUAL]: 4
    };

    const totalScore = opportunities.reduce((sum, opp) => sum + complexityScores[opp.complexity], 0);
    const averageScore = totalScore / opportunities.length;

    if (averageScore <= 1.5) return MigrationComplexity.SIMPLE;
    if (averageScore <= 2.5) return MigrationComplexity.MODERATE;
    if (averageScore <= 3.5) return MigrationComplexity.COMPLEX;
    return MigrationComplexity.MANUAL;
  }

  /**
   * Calculate migration score (0-100, higher is easier)
   */
  private calculateMigrationScore(opportunities: MigrationOpportunity[], file: EnhancedMTMFile): number {
    if (file.syntaxVersion === 'modern') {
      return 100; // Already migrated
    }

    if (opportunities.length === 0) {
      return 90; // No opportunities found, likely simple file
    }

    const complexityPenalty = {
      [MigrationComplexity.SIMPLE]: 0,
      [MigrationComplexity.MODERATE]: 10,
      [MigrationComplexity.COMPLEX]: 25,
      [MigrationComplexity.MANUAL]: 40
    };

    const totalPenalty = opportunities.reduce((sum, opp) => sum + complexityPenalty[opp.complexity], 0);
    const averagePenalty = totalPenalty / opportunities.length;
    
    // Base score starts at 100, subtract penalties
    let score = 100 - averagePenalty;
    
    // Additional penalties for high number of opportunities
    if (opportunities.length > 20) score -= 20;
    else if (opportunities.length > 10) score -= 10;
    else if (opportunities.length > 5) score -= 5;

    // Bonus for having many simple opportunities
    const simpleOpportunities = opportunities.filter(opp => opp.complexity === MigrationComplexity.SIMPLE).length;
    if (simpleOpportunities > opportunities.length * 0.7) {
      score += 10;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Estimate effort required for migration
   */
  private estimateEffort(opportunities: MigrationOpportunity[], complexity: MigrationComplexity): string {
    const opportunityCount = opportunities.length;
    
    if (opportunityCount === 0) {
      return 'No migration needed';
    }

    const effortMap = {
      [MigrationComplexity.SIMPLE]: {
        low: '15-30 minutes',
        medium: '30-60 minutes',
        high: '1-2 hours'
      },
      [MigrationComplexity.MODERATE]: {
        low: '1-2 hours',
        medium: '2-4 hours',
        high: '4-8 hours'
      },
      [MigrationComplexity.COMPLEX]: {
        low: '4-8 hours',
        medium: '1-2 days',
        high: '2-5 days'
      },
      [MigrationComplexity.MANUAL]: {
        low: '1-2 days',
        medium: '3-5 days',
        high: '1-2 weeks'
      }
    };

    let effortLevel: 'low' | 'medium' | 'high';
    if (opportunityCount <= 5) effortLevel = 'low';
    else if (opportunityCount <= 15) effortLevel = 'medium';
    else effortLevel = 'high';

    return effortMap[complexity][effortLevel];
  }

  /**
   * Identify blockers that prevent migration
   */
  private identifyBlockers(file: EnhancedMTMFile, opportunities: MigrationOpportunity[]): string[] {
    const blockers: string[] = [];

    // Check for complex dependencies
    const complexOpportunities = opportunities.filter(opp => opp.complexity === MigrationComplexity.COMPLEX || opp.complexity === MigrationComplexity.MANUAL);
    if (complexOpportunities.length > opportunities.length * 0.5) {
      blockers.push('High proportion of complex migration opportunities');
    }

    // Check for circular dependencies
    const dependencyTypes = opportunities.flatMap(opp => opp.dependencies);
    const uniqueDependencies = [...new Set(dependencyTypes)];
    if (uniqueDependencies.length > 3) {
      blockers.push('Complex dependency chain between migration opportunities');
    }

    // Check for framework-specific issues
    const target = file.frontmatter?.target;
    if (target && !['reactjs', 'vue', 'svelte'].includes(target)) {
      blockers.push(`Target framework '${target}' may not fully support modern syntax features`);
    }

    return blockers;
  }

  /**
   * Generate recommendations for a single file
   */
  private generateFileRecommendations(file: EnhancedMTMFile, opportunities: MigrationOpportunity[]): string[] {
    const recommendations: string[] = [];

    if (opportunities.length === 0) {
      if (file.syntaxVersion === 'modern') {
        recommendations.push('File already uses modern syntax - no migration needed');
      } else {
        recommendations.push('File uses legacy syntax but no obvious migration opportunities found');
        recommendations.push('Consider manual review for potential improvements');
      }
      return recommendations;
    }

    // Prioritize simple opportunities
    const simpleOpportunities = opportunities.filter(opp => opp.complexity === MigrationComplexity.SIMPLE);
    if (simpleOpportunities.length > 0) {
      recommendations.push(`Start with ${simpleOpportunities.length} simple migration(s) for quick wins`);
    }

    // Group by type for better organization
    const opportunityTypes = [...new Set(opportunities.map(opp => opp.type))];
    if (opportunityTypes.length > 3) {
      recommendations.push('Consider migrating one syntax feature at a time to reduce complexity');
    }

    // Check for reactive opportunities
    const reactiveOpportunities = opportunities.filter(opp => opp.type === MigrationOpportunityType.REACTIVE_VARIABLE);
    if (reactiveOpportunities.length > 0) {
      recommendations.push('Reactive variables will provide the most benefit - prioritize these migrations');
    }

    // Check for dependency order
    const dependentOpportunities = opportunities.filter(opp => opp.dependencies.length > 0);
    if (dependentOpportunities.length > 0) {
      recommendations.push('Some opportunities depend on others - follow suggested migration order');
    }

    return recommendations;
  }

  /**
   * Calculate project-wide complexity
   */
  private calculateProjectComplexity(fileAnalyses: FileMigrationAnalysis[]): MigrationComplexity {
    if (fileAnalyses.length === 0) {
      return MigrationComplexity.SIMPLE;
    }

    const complexityScores = {
      [MigrationComplexity.SIMPLE]: 1,
      [MigrationComplexity.MODERATE]: 2,
      [MigrationComplexity.COMPLEX]: 3,
      [MigrationComplexity.MANUAL]: 4
    };

    const totalScore = fileAnalyses.reduce((sum, analysis) => sum + complexityScores[analysis.overallComplexity], 0);
    const averageScore = totalScore / fileAnalyses.length;

    if (averageScore <= 1.5) return MigrationComplexity.SIMPLE;
    if (averageScore <= 2.5) return MigrationComplexity.MODERATE;
    if (averageScore <= 3.5) return MigrationComplexity.COMPLEX;
    return MigrationComplexity.MANUAL;
  }

  /**
   * Calculate project-wide migration score
   */
  private calculateProjectMigrationScore(fileAnalyses: FileMigrationAnalysis[]): number {
    if (fileAnalyses.length === 0) {
      return 100;
    }

    const totalScore = fileAnalyses.reduce((sum, analysis) => sum + analysis.migrationScore, 0);
    return Math.round(totalScore / fileAnalyses.length);
  }

  /**
   * Estimate project-wide effort
   */
  private estimateProjectEffort(fileAnalyses: FileMigrationAnalysis[]): string {
    const legacyFiles = fileAnalyses.filter(analysis => analysis.syntaxVersion === 'legacy');
    
    if (legacyFiles.length === 0) {
      return 'No migration needed - all files use modern syntax';
    }

    const complexityDistribution = {
      [MigrationComplexity.SIMPLE]: legacyFiles.filter(f => f.overallComplexity === MigrationComplexity.SIMPLE).length,
      [MigrationComplexity.MODERATE]: legacyFiles.filter(f => f.overallComplexity === MigrationComplexity.MODERATE).length,
      [MigrationComplexity.COMPLEX]: legacyFiles.filter(f => f.overallComplexity === MigrationComplexity.COMPLEX).length,
      [MigrationComplexity.MANUAL]: legacyFiles.filter(f => f.overallComplexity === MigrationComplexity.MANUAL).length
    };

    // Estimate based on file count and complexity
    let totalDays = 0;
    totalDays += complexityDistribution[MigrationComplexity.SIMPLE] * 0.25;      // 2 hours per simple file
    totalDays += complexityDistribution[MigrationComplexity.MODERATE] * 0.5;     // 4 hours per moderate file
    totalDays += complexityDistribution[MigrationComplexity.COMPLEX] * 1.5;      // 12 hours per complex file
    totalDays += complexityDistribution[MigrationComplexity.MANUAL] * 3;         // 3 days per manual file

    if (totalDays < 1) return 'Less than 1 day';
    if (totalDays < 5) return `${Math.ceil(totalDays)} days`;
    if (totalDays < 20) return `${Math.ceil(totalDays / 5)} weeks`;
    return `${Math.ceil(totalDays / 20)} months`;
  }

  /**
   * Generate migration path with ordered steps
   */
  private generateMigrationPath(fileAnalyses: FileMigrationAnalysis[]): MigrationStep[] {
    const steps: MigrationStep[] = [];
    const legacyFiles = fileAnalyses.filter(analysis => analysis.syntaxVersion === 'legacy');

    if (legacyFiles.length === 0) {
      return steps;
    }

    // Step 1: Simple migrations first
    const simpleFiles = legacyFiles.filter(f => f.overallComplexity === MigrationComplexity.SIMPLE);
    if (simpleFiles.length > 0) {
      steps.push({
        order: 1,
        title: 'Quick Wins - Simple Migrations',
        description: 'Start with files that have simple migration opportunities for immediate benefits',
        files: simpleFiles.map(f => f.filePath),
        complexity: MigrationComplexity.SIMPLE,
        estimatedTime: `${simpleFiles.length * 2} hours`,
        prerequisites: []
      });
    }

    // Step 2: Moderate complexity files
    const moderateFiles = legacyFiles.filter(f => f.overallComplexity === MigrationComplexity.MODERATE);
    if (moderateFiles.length > 0) {
      steps.push({
        order: 2,
        title: 'Core Migrations - Moderate Complexity',
        description: 'Migrate files with moderate complexity, including reactive variables and function syntax',
        files: moderateFiles.map(f => f.filePath),
        complexity: MigrationComplexity.MODERATE,
        estimatedTime: `${moderateFiles.length * 4} hours`,
        prerequisites: simpleFiles.length > 0 ? ['Quick Wins - Simple Migrations'] : []
      });
    }

    // Step 3: Complex files
    const complexFiles = legacyFiles.filter(f => f.overallComplexity === MigrationComplexity.COMPLEX);
    if (complexFiles.length > 0) {
      steps.push({
        order: 3,
        title: 'Advanced Migrations - Complex Files',
        description: 'Handle files with complex dependencies and advanced syntax features',
        files: complexFiles.map(f => f.filePath),
        complexity: MigrationComplexity.COMPLEX,
        estimatedTime: `${complexFiles.length * 12} hours`,
        prerequisites: ['Core Migrations - Moderate Complexity']
      });
    }

    // Step 4: Manual migration files
    const manualFiles = legacyFiles.filter(f => f.overallComplexity === MigrationComplexity.MANUAL);
    if (manualFiles.length > 0) {
      steps.push({
        order: 4,
        title: 'Manual Review - Complex Cases',
        description: 'Files requiring manual review and custom migration strategies',
        files: manualFiles.map(f => f.filePath),
        complexity: MigrationComplexity.MANUAL,
        estimatedTime: `${manualFiles.length * 3} days`,
        prerequisites: ['Advanced Migrations - Complex Files']
      });
    }

    return steps;
  }

  /**
   * Analyze project dependencies that might affect migration
   */
  private analyzeDependencies(filePaths: string[]): ProjectDependency[] {
    const dependencies: ProjectDependency[] = [];

    // This is a simplified analysis - in a real implementation,
    // you would parse package.json and analyze actual dependencies
    
    // For now, return common dependencies that might affect migration
    dependencies.push({
      name: '@metamon/core',
      version: '0.1.0',
      type: 'framework',
      migrationImpact: 'low',
      notes: 'Core framework supports both legacy and modern syntax'
    });

    return dependencies;
  }

  /**
   * Generate project-wide recommendations
   */
  private generateProjectRecommendations(fileAnalyses: FileMigrationAnalysis[]): string[] {
    const recommendations: string[] = [];
    const legacyFiles = fileAnalyses.filter(analysis => analysis.syntaxVersion === 'legacy');
    const modernFiles = fileAnalyses.filter(analysis => analysis.syntaxVersion === 'modern');

    if (legacyFiles.length === 0) {
      recommendations.push('All files already use modern syntax - no migration needed');
      return recommendations;
    }

    const migrationPercentage = Math.round((modernFiles.length / fileAnalyses.length) * 100);
    recommendations.push(`${migrationPercentage}% of files already use modern syntax`);

    if (migrationPercentage > 50) {
      recommendations.push('Good progress on modernization - focus on remaining legacy files');
    } else {
      recommendations.push('Consider gradual migration approach starting with simple files');
    }

    // Analyze opportunity distribution
    const allOpportunities = legacyFiles.flatMap(f => f.opportunities);
    const opportunityTypes = [...new Set(allOpportunities.map(opp => opp.type))];
    
    if (opportunityTypes.includes(MigrationOpportunityType.REACTIVE_VARIABLE)) {
      recommendations.push('Many files can benefit from reactive variables - prioritize these for maximum impact');
    }

    if (opportunityTypes.includes(MigrationOpportunityType.SEMICOLON_OPTIONAL)) {
      recommendations.push('Consider adopting optional semicolon style for cleaner code');
    }

    const averageScore = Math.round(legacyFiles.reduce((sum, f) => sum + f.migrationScore, 0) / legacyFiles.length);
    if (averageScore > 70) {
      recommendations.push('High migration scores indicate straightforward migration process');
    } else if (averageScore < 40) {
      recommendations.push('Low migration scores suggest careful planning and phased approach needed');
    }

    return recommendations;
  }

  /**
   * Identify quick wins for immediate benefits
   */
  private identifyQuickWins(projectAnalysis: ProjectMigrationAnalysis): MigrationOpportunity[] {
    const allOpportunities = projectAnalysis.fileAnalyses.flatMap(f => f.opportunities);
    
    return allOpportunities
      .filter(opp => opp.complexity === MigrationComplexity.SIMPLE)
      .filter(opp => opp.dependencies.length === 0)
      .slice(0, 10); // Top 10 quick wins
  }

  /**
   * Identify major challenges in the migration
   */
  private identifyMajorChallenges(projectAnalysis: ProjectMigrationAnalysis): string[] {
    const challenges: string[] = [];
    
    const complexFiles = projectAnalysis.fileAnalyses.filter(f => 
      f.overallComplexity === MigrationComplexity.COMPLEX || 
      f.overallComplexity === MigrationComplexity.MANUAL
    );

    if (complexFiles.length > projectAnalysis.legacyFiles * 0.3) {
      challenges.push('High proportion of complex files requiring careful migration planning');
    }

    const allBlockers = projectAnalysis.fileAnalyses.flatMap(f => f.blockers);
    if (allBlockers.length > 0) {
      challenges.push('Multiple files have migration blockers that need resolution');
    }

    if (projectAnalysis.migrationScore < 50) {
      challenges.push('Low overall migration score indicates significant complexity');
    }

    const dependentOpportunities = projectAnalysis.fileAnalyses
      .flatMap(f => f.opportunities)
      .filter(opp => opp.dependencies.length > 0);
    
    if (dependentOpportunities.length > 0) {
      challenges.push('Complex dependency chains between migration opportunities');
    }

    return challenges;
  }

  /**
   * Assess if project is ready for migration
   */
  private assessMigrationReadiness(projectAnalysis: ProjectMigrationAnalysis): boolean {
    // Project is ready if:
    // 1. Migration score is reasonable (>40)
    // 2. Not too many blockers
    // 3. Reasonable complexity distribution

    const hasReasonableScore = projectAnalysis.migrationScore >= 40;
    const hasManageableBlockers = projectAnalysis.fileAnalyses.every(f => f.blockers.length <= 2);
    const hasReasonableComplexity = projectAnalysis.overallComplexity !== MigrationComplexity.MANUAL;

    return hasReasonableScore && hasManageableBlockers && hasReasonableComplexity;
  }

  /**
   * Calculate time estimate for the entire project
   */
  private calculateTimeEstimate(projectAnalysis: ProjectMigrationAnalysis): string {
    return projectAnalysis.estimatedEffort;
  }

  /**
   * Generate detailed recommendations by timeframe
   */
  private generateDetailedRecommendations(projectAnalysis: ProjectMigrationAnalysis): {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  } {
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];

    // Immediate actions (this week)
    const quickWins = this.identifyQuickWins(projectAnalysis);
    if (quickWins.length > 0) {
      immediate.push(`Migrate ${quickWins.length} simple opportunities for immediate benefits`);
    }

    const simpleFiles = projectAnalysis.fileAnalyses.filter(f => f.overallComplexity === MigrationComplexity.SIMPLE);
    if (simpleFiles.length > 0) {
      immediate.push(`Start with ${simpleFiles.length} simple files to build momentum`);
    }

    // Short-term actions (next month)
    const moderateFiles = projectAnalysis.fileAnalyses.filter(f => f.overallComplexity === MigrationComplexity.MODERATE);
    if (moderateFiles.length > 0) {
      shortTerm.push(`Plan migration of ${moderateFiles.length} moderate complexity files`);
    }

    if (projectAnalysis.migrationScore < 60) {
      shortTerm.push('Address migration blockers to improve overall migration score');
    }

    shortTerm.push('Establish coding standards for modern MTM syntax');
    shortTerm.push('Set up automated testing for migrated files');

    // Long-term actions (next quarter)
    const complexFiles = projectAnalysis.fileAnalyses.filter(f => f.overallComplexity === MigrationComplexity.COMPLEX);
    if (complexFiles.length > 0) {
      longTerm.push(`Develop strategy for ${complexFiles.length} complex files`);
    }

    const manualFiles = projectAnalysis.fileAnalyses.filter(f => f.overallComplexity === MigrationComplexity.MANUAL);
    if (manualFiles.length > 0) {
      longTerm.push(`Plan manual review and migration of ${manualFiles.length} complex cases`);
    }

    longTerm.push('Complete migration of all legacy files');
    longTerm.push('Update documentation and team training materials');
    longTerm.push('Establish modern syntax as the standard for new development');

    return { immediate, shortTerm, longTerm };
  }

  /**
   * Assess risks associated with migration
   */
  private assessRisks(projectAnalysis: ProjectMigrationAnalysis): {
    low: string[];
    medium: string[];
    high: string[];
  } {
    const low: string[] = [];
    const medium: string[] = [];
    const high: string[] = [];

    // Low risks
    low.push('Syntax changes may require team adjustment period');
    low.push('Code review process may need updates');

    // Medium risks
    if (projectAnalysis.migrationScore < 60) {
      medium.push('Complex migration may introduce bugs if not carefully tested');
    }

    const allBlockers = projectAnalysis.fileAnalyses.flatMap(f => f.blockers);
    if (allBlockers.length > 0) {
      medium.push('Migration blockers may delay timeline');
    }

    medium.push('Mixing legacy and modern syntax during transition may cause confusion');

    // High risks
    if (projectAnalysis.overallComplexity === MigrationComplexity.MANUAL) {
      high.push('Manual migration required for complex cases increases risk of errors');
    }

    const manualFiles = projectAnalysis.fileAnalyses.filter(f => f.overallComplexity === MigrationComplexity.MANUAL);
    if (manualFiles.length > projectAnalysis.totalFiles * 0.2) {
      high.push('High proportion of manual migration files increases project risk');
    }

    if (projectAnalysis.migrationScore < 40) {
      high.push('Low migration score indicates high complexity and potential for issues');
    }

    return { low, medium, high };
  }
}