import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { dirname, join, basename } from 'path';
import { 
  SyntaxMigrationAnalyzer,
  type FileMigrationAnalysis,
  type MigrationOpportunity,
  MigrationOpportunityType,
  MigrationComplexity
} from './syntax-migration-analyzer.js';

/**
 * Migration transformation rule
 */
export interface MigrationRule {
  type: MigrationOpportunityType;
  pattern: RegExp;
  replacement: string | ((match: RegExpMatchArray, context: MigrationContext) => string);
  conditions?: (context: MigrationContext) => boolean;
  postProcess?: (result: string, context: MigrationContext) => string;
}

/**
 * Migration context for transformations
 */
export interface MigrationContext {
  filePath: string;
  originalContent: string;
  currentContent: string;
  lineNumber: number;
  opportunity: MigrationOpportunity;
  allOpportunities: MigrationOpportunity[];
}

/**
 * Migration result for a single file
 */
export interface FileMigrationResult {
  filePath: string;
  success: boolean;
  originalContent: string;
  migratedContent: string;
  appliedTransformations: MigrationTransformation[];
  errors: string[];
  warnings: string[];
  backupPath?: string;
}

/**
 * Applied transformation record
 */
export interface MigrationTransformation {
  type: MigrationOpportunityType;
  lineNumber: number;
  originalCode: string;
  transformedCode: string;
  description: string;
}

/**
 * Batch migration result
 */
export interface BatchMigrationResult {
  totalFiles: number;
  successfulMigrations: number;
  failedMigrations: number;
  fileResults: FileMigrationResult[];
  overallErrors: string[];
  summary: {
    transformationCounts: Record<MigrationOpportunityType, number>;
    complexityDistribution: Record<MigrationComplexity, number>;
    timeElapsed: number;
  };
}

/**
 * Migration options
 */
export interface MigrationOptions {
  createBackups: boolean;
  backupSuffix: string;
  dryRun: boolean;
  skipComplexTransformations: boolean;
  maxComplexity: MigrationComplexity;
  includeTypes: MigrationOpportunityType[];
  excludeTypes: MigrationOpportunityType[];
  validateAfterMigration: boolean;
  rollbackOnError: boolean;
}

/**
 * Migration validation result
 */
export interface MigrationValidationResult {
  isValid: boolean;
  syntaxErrors: string[];
  semanticWarnings: string[];
  suggestions: string[];
}

/**
 * Automatic migration tool that applies safe transformations to convert legacy MTM syntax to modern syntax
 */
export class AutomaticMigrationTool {
  private analyzer = new SyntaxMigrationAnalyzer();
  private migrationRules: MigrationRule[] = [];

  constructor() {
    this.initializeMigrationRules();
  }

  /**
   * Migrate a single file from legacy to modern syntax
   */
  async migrateFile(filePath: string, options: Partial<MigrationOptions> = {}): Promise<FileMigrationResult> {
    const opts = this.mergeOptions(options);
    const startTime = Date.now();

    try {
      // Validate file exists
      if (!existsSync(filePath)) {
        return {
          filePath,
          success: false,
          originalContent: '',
          migratedContent: '',
          appliedTransformations: [],
          errors: [`File not found: ${filePath}`],
          warnings: []
        };
      }

      // Read original content
      const originalContent = readFileSync(filePath, 'utf-8');

      // Analyze file for migration opportunities
      const analysis = this.analyzer.analyzeFile(filePath);

      // Filter opportunities based on options
      const filteredOpportunities = this.filterOpportunities(analysis.opportunities, opts);

      // Check if any opportunities remain after filtering
      if (filteredOpportunities.length === 0) {
        return {
          filePath,
          success: true,
          originalContent,
          migratedContent: originalContent,
          appliedTransformations: [],
          errors: [],
          warnings: ['No migration opportunities found or all filtered out']
        };
      }

      // Create backup if requested
      let backupPath: string | undefined;
      if (opts.createBackups && !opts.dryRun) {
        backupPath = `${filePath}${opts.backupSuffix}`;
        copyFileSync(filePath, backupPath);
      }

      // Apply transformations
      const migrationResult = await this.applyTransformations(
        filePath,
        originalContent,
        filteredOpportunities,
        opts
      );

      // Validate migrated content if requested
      if (opts.validateAfterMigration && migrationResult.success) {
        const validationResult = await this.validateMigration(migrationResult.migratedContent, filePath);
        if (!validationResult.isValid) {
          migrationResult.errors.push(...validationResult.syntaxErrors);
          migrationResult.warnings.push(...validationResult.semanticWarnings);
          
          if (opts.rollbackOnError) {
            migrationResult.success = false;
            migrationResult.migratedContent = originalContent;
          }
        }
      }

      // Write migrated content if not dry run and successful
      if (!opts.dryRun && migrationResult.success) {
        writeFileSync(filePath, migrationResult.migratedContent, 'utf-8');
      }

      return {
        ...migrationResult,
        backupPath
      };

    } catch (error) {
      return {
        filePath,
        success: false,
        originalContent: '',
        migratedContent: '',
        appliedTransformations: [],
        errors: [`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: []
      };
    }
  }

  /**
   * Migrate multiple files in batch
   */
  async migrateFiles(filePaths: string[], options: Partial<MigrationOptions> = {}): Promise<BatchMigrationResult> {
    const startTime = Date.now();
    const fileResults: FileMigrationResult[] = [];
    const overallErrors: string[] = [];
    const transformationCounts: Record<MigrationOpportunityType, number> = {} as any;
    const complexityDistribution: Record<MigrationComplexity, number> = {} as any;

    // Initialize counters
    Object.values(MigrationOpportunityType).forEach(type => {
      transformationCounts[type] = 0;
    });
    Object.values(MigrationComplexity).forEach(complexity => {
      complexityDistribution[complexity] = 0;
    });

    // Process each file
    for (const filePath of filePaths) {
      try {
        const result = await this.migrateFile(filePath, options);
        fileResults.push(result);

        // Update counters
        result.appliedTransformations.forEach(transformation => {
          transformationCounts[transformation.type]++;
        });

        // Analyze complexity distribution
        if (result.success) {
          const analysis = this.analyzer.analyzeFile(filePath);
          complexityDistribution[analysis.overallComplexity]++;
        }

      } catch (error) {
        const errorMessage = `Failed to migrate ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        overallErrors.push(errorMessage);
        
        fileResults.push({
          filePath,
          success: false,
          originalContent: '',
          migratedContent: '',
          appliedTransformations: [],
          errors: [errorMessage],
          warnings: []
        });
      }
    }

    const successfulMigrations = fileResults.filter(r => r.success).length;
    const failedMigrations = fileResults.filter(r => !r.success).length;
    const timeElapsed = Date.now() - startTime;

    return {
      totalFiles: filePaths.length,
      successfulMigrations,
      failedMigrations,
      fileResults,
      overallErrors,
      summary: {
        transformationCounts,
        complexityDistribution,
        timeElapsed
      }
    };
  }

  /**
   * Rollback a migration using backup files
   */
  async rollbackMigration(filePath: string, backupSuffix: string = '.backup'): Promise<boolean> {
    const backupPath = `${filePath}${backupSuffix}`;
    
    if (!existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    try {
      copyFileSync(backupPath, filePath);
      return true;
    } catch (error) {
      throw new Error(`Failed to rollback ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Rollback multiple files
   */
  async rollbackFiles(filePaths: string[], backupSuffix: string = '.backup'): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    for (const filePath of filePaths) {
      try {
        await this.rollbackMigration(filePath, backupSuffix);
        success.push(filePath);
      } catch (error) {
        failed.push(filePath);
      }
    }

    return { success, failed };
  }

  /**
   * Preview migration changes without applying them
   */
  async previewMigration(filePath: string, options: Partial<MigrationOptions> = {}): Promise<FileMigrationResult> {
    const previewOptions = { ...options, dryRun: true, createBackups: false };
    return this.migrateFile(filePath, previewOptions);
  }

  /**
   * Get safe transformation rules that can be applied automatically
   */
  getSafeTransformationRules(): MigrationRule[] {
    return this.migrationRules.filter(rule => 
      rule.type === MigrationOpportunityType.VARIABLE_DECLARATION ||
      rule.type === MigrationOpportunityType.SEMICOLON_OPTIONAL ||
      rule.type === MigrationOpportunityType.TYPE_ANNOTATION
    );
  }

  /**
   * Get all available transformation rules
   */
  getAllTransformationRules(): MigrationRule[] {
    return [...this.migrationRules];
  }

  /**
   * Add custom migration rule
   */
  addMigrationRule(rule: MigrationRule): void {
    this.migrationRules.push(rule);
  }

  /**
   * Remove migration rule by type
   */
  removeMigrationRule(type: MigrationOpportunityType): void {
    this.migrationRules = this.migrationRules.filter(rule => rule.type !== type);
  }

  /**
   * Initialize built-in migration rules
   */
  private initializeMigrationRules(): void {
    // Variable declaration rules
    this.migrationRules.push({
      type: MigrationOpportunityType.VARIABLE_DECLARATION,
      pattern: /^\s*(let|const|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+);?\s*$/,
      replacement: (match, context) => {
        const [, keyword, varName, value] = match;
        const cleanValue = value.replace(/;$/, '');
        return `$${varName} = ${cleanValue}`;
      }
    });

    // Function declaration rules
    this.migrationRules.push({
      type: MigrationOpportunityType.FUNCTION_DECLARATION,
      pattern: /^\s*function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\{?\s*$/,
      replacement: (match, context) => {
        const [, funcName, params] = match;
        return `$${funcName} = (${params}) => {`;
      },
      conditions: (context) => {
        // Only apply if complexity is not too high
        return context.opportunity.complexity !== MigrationComplexity.COMPLEX &&
               context.opportunity.complexity !== MigrationComplexity.MANUAL;
      }
    });

    // Type annotation rules
    this.migrationRules.push({
      type: MigrationOpportunityType.TYPE_ANNOTATION,
      pattern: /^\s*(let|const|var|\$[a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+);?\s*$/,
      replacement: (match, context) => {
        const [, varDecl, value] = match;
        const cleanValue = value.replace(/;$/, '').trim();
        
        // Infer type from value
        let inferredType: string | null = null;
        if (/^["'`].*["'`]$/.test(cleanValue)) {
          inferredType = 'string';
        } else if (/^\d+$/.test(cleanValue)) {
          inferredType = 'number';
        } else if (/^\d+\.\d+$/.test(cleanValue)) {
          inferredType = 'float';
        } else if (/^(true|false)$/.test(cleanValue)) {
          inferredType = 'boolean';
        }
        
        if (inferredType && !varDecl.includes(':')) {
          const varName = varDecl.replace(/^\$/, '').replace(/^(let|const|var)\s+/, '');
          return `$${varName}: ${inferredType} = ${cleanValue}`;
        }
        
        return match[0]; // No change if type can't be inferred
      }
    });

    // Reactive variable rules
    this.migrationRules.push({
      type: MigrationOpportunityType.REACTIVE_VARIABLE,
      pattern: /^\s*(let|const|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+);?\s*$/,
      replacement: (match, context) => {
        const [, keyword, varName, value] = match;
        const cleanValue = value.replace(/;$/, '');
        
        // Check if this looks like a state variable
        const statePatterns = [
          /count/i, /state/i, /value/i, /data/i, /item/i, /list/i, /show/i, /visible/i, /active/i
        ];
        
        const isLikelyState = statePatterns.some(pattern => pattern.test(varName));
        
        if (isLikelyState) {
          return `$${varName}! = ${cleanValue}`;
        }
        
        return match[0]; // No change if not likely state
      },
      conditions: (context) => {
        // Only apply for moderate complexity or lower
        return context.opportunity.complexity === MigrationComplexity.SIMPLE ||
               context.opportunity.complexity === MigrationComplexity.MODERATE;
      }
    });

    // Semicolon optional rules
    this.migrationRules.push({
      type: MigrationOpportunityType.SEMICOLON_OPTIONAL,
      pattern: /^(.+);(\s*)$/,
      replacement: (match, context) => {
        const [, statement, whitespace] = match;
        
        // Check if it's safe to remove semicolon
        const safePatterns = [
          /^\s*(let|const|var|\$\w+)\s+\w+\s*=\s*.+$/,  // Variable declarations
          /^\s*\w+\s*=\s*.+$/,                          // Assignments
          /^\s*return\s+.+$/,                           // Return statements
          /^\s*\w+\([^)]*\)$/                           // Function calls
        ];
        
        const isSafeToOmit = safePatterns.some(pattern => pattern.test(statement));
        
        if (isSafeToOmit) {
          return statement + whitespace;
        }
        
        return match[0]; // Keep semicolon if not safe
      }
    });

    // Template binding rules
    this.migrationRules.push({
      type: MigrationOpportunityType.TEMPLATE_BINDING,
      pattern: /innerHTML\s*=\s*[`"'].*\$\{([^}]+)\}.*[`"']/g,
      replacement: (match, context) => {
        return match[0].replace(/\$\{([^}]+)\}/g, '{{$$$1}}');
      },
      conditions: (context) => {
        // Only apply for simple cases
        return context.opportunity.complexity === MigrationComplexity.SIMPLE;
      }
    });

    // Event handler rules
    this.migrationRules.push({
      type: MigrationOpportunityType.EVENT_HANDLER,
      pattern: /addEventListener\s*\(\s*['"]([^'"]+)['"]\s*,\s*([^)]+)\s*\)/,
      replacement: (match, context) => {
        const [, eventType, handler] = match;
        const cleanHandler = handler.replace(/^\w+\./, '');
        return `${eventType}="$${cleanHandler}"`;
      },
      conditions: (context) => {
        // Only apply for moderate complexity or lower
        return context.opportunity.complexity !== MigrationComplexity.COMPLEX &&
               context.opportunity.complexity !== MigrationComplexity.MANUAL;
      }
    });

    // Class property rules
    this.migrationRules.push({
      type: MigrationOpportunityType.CLASS_PROPERTY,
      pattern: /^\s*(public|private|protected)?\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[:=]\s*(.+);?\s*$/,
      replacement: (match, context) => {
        const [, visibility, propName, value] = match;
        const cleanValue = value.replace(/;$/, '');
        return `$${propName} = ${cleanValue}`;
      },
      conditions: (context) => {
        // Only apply for simple cases
        return context.opportunity.complexity === MigrationComplexity.SIMPLE;
      }
    });
  }

  /**
   * Apply transformations to file content
   */
  private async applyTransformations(
    filePath: string,
    originalContent: string,
    opportunities: MigrationOpportunity[],
    options: MigrationOptions
  ): Promise<FileMigrationResult> {
    let currentContent = originalContent;
    const appliedTransformations: MigrationTransformation[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Sort opportunities by line number (descending) to avoid offset issues
    const sortedOpportunities = opportunities.sort((a, b) => b.location.line - a.location.line);

    for (const opportunity of sortedOpportunities) {
      try {
        const rule = this.migrationRules.find(r => r.type === opportunity.type);
        if (!rule) {
          warnings.push(`No migration rule found for type: ${opportunity.type}`);
          continue;
        }

        // Check conditions if any
        const context: MigrationContext = {
          filePath,
          originalContent,
          currentContent,
          lineNumber: opportunity.location.line,
          opportunity,
          allOpportunities: opportunities
        };

        if (rule.conditions && !rule.conditions(context)) {
          warnings.push(`Conditions not met for transformation at line ${opportunity.location.line}`);
          continue;
        }

        // Apply transformation
        const lines = currentContent.split('\n');
        const lineIndex = opportunity.location.line - 1;
        
        if (lineIndex < 0 || lineIndex >= lines.length) {
          errors.push(`Invalid line number ${opportunity.location.line} for file ${filePath}`);
          continue;
        }

        const originalLine = lines[lineIndex];
        const match = originalLine.match(rule.pattern);
        
        if (!match) {
          warnings.push(`Pattern did not match at line ${opportunity.location.line}: ${originalLine}`);
          continue;
        }

        let transformedLine: string;
        if (typeof rule.replacement === 'string') {
          transformedLine = originalLine.replace(rule.pattern, rule.replacement);
        } else {
          transformedLine = rule.replacement(match, context);
        }

        // Apply post-processing if defined
        if (rule.postProcess) {
          transformedLine = rule.postProcess(transformedLine, context);
        }

        // Update content
        lines[lineIndex] = transformedLine;
        currentContent = lines.join('\n');

        // Record transformation
        appliedTransformations.push({
          type: opportunity.type,
          lineNumber: opportunity.location.line,
          originalCode: originalLine.trim(),
          transformedCode: transformedLine.trim(),
          description: opportunity.description
        });

      } catch (error) {
        errors.push(`Failed to apply transformation at line ${opportunity.location.line}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      filePath,
      success: errors.length === 0,
      originalContent,
      migratedContent: currentContent,
      appliedTransformations,
      errors,
      warnings
    };
  }

  /**
   * Filter opportunities based on options
   */
  private filterOpportunities(opportunities: MigrationOpportunity[], options: MigrationOptions): MigrationOpportunity[] {
    return opportunities.filter(opportunity => {
      // Filter by complexity
      const complexityOrder = {
        [MigrationComplexity.SIMPLE]: 1,
        [MigrationComplexity.MODERATE]: 2,
        [MigrationComplexity.COMPLEX]: 3,
        [MigrationComplexity.MANUAL]: 4
      };

      if (complexityOrder[opportunity.complexity] > complexityOrder[options.maxComplexity]) {
        return false;
      }

      // Skip complex transformations if requested
      if (options.skipComplexTransformations && 
          (opportunity.complexity === MigrationComplexity.COMPLEX || 
           opportunity.complexity === MigrationComplexity.MANUAL)) {
        return false;
      }

      // Filter by included types
      if (options.includeTypes.length > 0 && !options.includeTypes.includes(opportunity.type)) {
        return false;
      }

      // Filter by excluded types
      if (options.excludeTypes.length > 0 && options.excludeTypes.includes(opportunity.type)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Merge user options with defaults
   */
  private mergeOptions(options: Partial<MigrationOptions>): MigrationOptions {
    return {
      createBackups: options.createBackups ?? true,
      backupSuffix: options.backupSuffix ?? '.backup',
      dryRun: options.dryRun ?? false,
      skipComplexTransformations: options.skipComplexTransformations ?? true,
      maxComplexity: options.maxComplexity ?? MigrationComplexity.MODERATE,
      includeTypes: options.includeTypes ?? [],
      excludeTypes: options.excludeTypes ?? [],
      validateAfterMigration: options.validateAfterMigration ?? true,
      rollbackOnError: options.rollbackOnError ?? true
    };
  }

  /**
   * Validate migrated content
   */
  private async validateMigration(content: string, filePath: string): Promise<MigrationValidationResult> {
    const syntaxErrors: string[] = [];
    const semanticWarnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // Basic syntax validation
      // Check for unmatched braces, parentheses, etc.
      const braceCount = (content.match(/\{/g) || []).length - (content.match(/\}/g) || []).length;
      if (braceCount !== 0) {
        syntaxErrors.push(`Unmatched braces: ${braceCount > 0 ? 'missing closing' : 'extra closing'} braces`);
      }

      const parenCount = (content.match(/\(/g) || []).length - (content.match(/\)/g) || []).length;
      if (parenCount !== 0) {
        syntaxErrors.push(`Unmatched parentheses: ${parenCount > 0 ? 'missing closing' : 'extra closing'} parentheses`);
      }

      // Check for common migration issues
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        const lineNumber = index + 1;
        
        // Check for mixed syntax (legacy and modern)
        if (line.includes('let ') && line.includes('$')) {
          semanticWarnings.push(`Line ${lineNumber}: Mixed syntax detected - both 'let' and '$' prefix`);
        }

        // Check for potential ASI issues
        if (line.trim().endsWith('$') || line.trim().endsWith('+') || line.trim().endsWith('-')) {
          semanticWarnings.push(`Line ${lineNumber}: Potential ASI issue - line ends with operator`);
        }

        // Check for incomplete transformations
        if (line.includes('function ') && !line.includes('=>')) {
          suggestions.push(`Line ${lineNumber}: Consider converting function declaration to arrow function`);
        }
      });

      // Check for modern syntax consistency
      const dollarVars = content.match(/\$[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
      const legacyVars = content.match(/\b(let|const|var)\s+[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
      
      if (dollarVars.length > 0 && legacyVars.length > 0) {
        semanticWarnings.push('Mixed variable declaration styles detected - consider full migration to $ prefix');
      }

    } catch (error) {
      syntaxErrors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: syntaxErrors.length === 0,
      syntaxErrors,
      semanticWarnings,
      suggestions
    };
  }
}