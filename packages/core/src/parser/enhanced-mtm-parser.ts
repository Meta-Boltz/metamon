import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import type { MTMFile, ValidationResult, FileParser } from '../types/mtm-file.js';
import type { 
  UnifiedAST, 
  VariableDeclarationNode, 
  ReactiveVariableNode,
  ExpressionNode, 
  LiteralNode, 
  IdentifierNode,
  TypeAnnotationNode,
  TypeInfo,
  SourceLocation,
  ModernAST,
  TemplateNode
} from '../types/unified-ast.js';
import { TypeInferenceEngine } from '../types/type-inference.js';
import { TemplateParser } from './template-parser.js';

/**
 * Syntax version detected in MTM files
 */
export type SyntaxVersion = 'legacy' | 'modern';

/**
 * Modern syntax features detected in the file
 */
export interface ModernSyntaxFeatures {
  dollarPrefixVariables: boolean;
  reactiveVariables: boolean;
  enhancedTypeInference: boolean;
  optionalSemicolons: boolean;
  autoThisBinding: boolean;
}

/**
 * Enhanced MTM file representation that includes syntax version
 */
export interface EnhancedMTMFile extends MTMFile {
  syntaxVersion: SyntaxVersion;
  modernFeatures?: ModernSyntaxFeatures;
  ast?: UnifiedAST;
}

/**
 * Token types for modern syntax parsing
 */
export enum TokenType {
  DOLLAR = 'DOLLAR',
  IDENTIFIER = 'IDENTIFIER',
  COLON = 'COLON',
  EQUALS = 'EQUALS',
  EXCLAMATION = 'EXCLAMATION',
  LITERAL = 'LITERAL',
  SEMICOLON = 'SEMICOLON',
  NEWLINE = 'NEWLINE',
  EOF = 'EOF',
  WHITESPACE = 'WHITESPACE',
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  LBRACE = 'LBRACE',
  RBRACE = 'RBRACE',
  ARROW = 'ARROW',
  COMMA = 'COMMA'
}

/**
 * Token representation
 */
export interface Token {
  type: TokenType;
  value: string;
  location: SourceLocation;
}

/**
 * Parsing context for modern syntax
 */
export interface ParseContext {
  tokens: Token[];
  current: number;
  source: string;
}

/**
 * ASI (Automatic Semicolon Insertion) rules and context
 */
export interface ASIContext {
  previousToken: Token | null;
  currentToken: Token;
  nextToken: Token | null;
  isLineTerminated: boolean;
  isStatementEnd: boolean;
}

/**
 * ASI ambiguity detection result
 */
export interface ASIAmbiguity {
  location: SourceLocation;
  type: 'statement_continuation' | 'return_value' | 'expression_split';
  message: string;
  suggestion: string;
}

/**
 * Enhanced parser for .mtm files that can detect and handle both legacy and modern syntax
 */
export class EnhancedMTMParser implements FileParser {
  private static readonly FRONTMATTER_DELIMITER = '---';
  private static readonly SUPPORTED_TARGETS = ['reactjs', 'vue', 'solid', 'svelte'] as const;
  private typeInferenceEngine = new TypeInferenceEngine();
  private templateParser = new TemplateParser();
  private asiAmbiguities: ASIAmbiguity[] = [];

  /**
   * Parse a .mtm file and extract frontmatter, content, and syntax version
   */
  parse(filePath: string): EnhancedMTMFile {
    try {
      const fileContent = readFileSync(filePath, 'utf-8');
      const { frontmatter, content } = this.extractFrontmatter(fileContent);
      
      const validationResult = this.validate(frontmatter);
      if (!validationResult.isValid) {
        throw new Error(`Invalid frontmatter in ${filePath}: ${validationResult.errors.join(', ')}`);
      }

      // Detect syntax version and features
      const syntaxVersion = this.detectSyntaxVersion(content);
      const modernFeatures = syntaxVersion === 'modern' ? this.detectModernFeatures(content) : undefined;

      return {
        frontmatter,
        content: content.trim(),
        filePath,
        syntaxVersion,
        modernFeatures
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse MTM file ${filePath}: ${error.message}`);
      }
      throw new Error(`Failed to parse MTM file ${filePath}: Unknown error`);
    }
  }

  /**
   * Detect which syntax version is being used in the content
   */
  detectSyntaxVersion(content: string): SyntaxVersion {
    // Modern syntax indicators
    const modernPatterns = [
      /\$\w+\s*[!]?\s*[:=]/,           // $variable = or $variable: or $variable! =
      /\$\w+\s*=\s*\([^)]*\)\s*=>/,   // $function = (params) =>
      /\$\w+\s*=\s*async\s*\([^)]*\)\s*=>/,  // $asyncFunc = async (params) =>
      /\{\{\$\w+\}\}/,                 // {{$variable}} in templates
      /click\s*=\s*["\']?\$\w+\([^)]*\)["\']?/,  // click="$function()"
    ];

    // Check if any modern syntax patterns are present
    const hasModernSyntax = modernPatterns.some(pattern => pattern.test(content));
    
    return hasModernSyntax ? 'modern' : 'legacy';
  }

  /**
   * Detect specific modern syntax features used in the content
   */
  detectModernFeatures(content: string): ModernSyntaxFeatures {
    return {
      dollarPrefixVariables: /\$\w+\s*[:=]/.test(content),
      reactiveVariables: /\$\w+!\s*=/.test(content),
      enhancedTypeInference: /\$\w+\s*:\s*\w+\s*=/.test(content),
      optionalSemicolons: this.detectOptionalSemicolons(content),
      autoThisBinding: /\$\w+\s*=\s*\([^)]*\)\s*=>/.test(content)
    };
  }

  /**
   * Detect if the file uses optional semicolons (ASI)
   */
  private detectOptionalSemicolons(content: string): boolean {
    // Remove comments and strings to avoid false positives
    const cleanContent = content
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, '')         // Remove line comments
      .replace(/["'`](?:[^"'`\\]|\\.)*["'`]/g, ''); // Remove strings

    // Count statements that end without semicolons
    const lines = cleanContent.split('\n');
    let statementsWithoutSemicolon = 0;
    let totalStatements = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
        // Check if this looks like a statement
        if (/^(const|let|var|function|return|if|for|while|do|switch|try|throw)\s/.test(trimmed) ||
            /^\w+\s*[=:]/.test(trimmed) ||
            /^\w+\([^)]*\)/.test(trimmed)) {
          totalStatements++;
          if (!trimmed.endsWith(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}')) {
            statementsWithoutSemicolon++;
          }
        }
      }
    }

    // If more than 50% of statements don't have semicolons, consider it optional semicolon style
    return totalStatements > 0 && (statementsWithoutSemicolon / totalStatements) > 0.5;
  }

  /**
   * Validate frontmatter configuration (same as original parser)
   */
  validate(frontmatter: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if frontmatter is an object
    if (!frontmatter || typeof frontmatter !== 'object') {
      errors.push('Frontmatter must be a valid YAML object');
      return { isValid: false, errors, warnings };
    }

    // Validate required 'target' field
    if (!frontmatter.target) {
      errors.push('Missing required field: target');
    } else if (!EnhancedMTMParser.SUPPORTED_TARGETS.includes(frontmatter.target)) {
      errors.push(`Invalid target '${frontmatter.target}'. Supported targets: ${EnhancedMTMParser.SUPPORTED_TARGETS.join(', ')}`);
    }

    // Validate optional 'channels' field
    if (frontmatter.channels !== undefined) {
      if (!Array.isArray(frontmatter.channels)) {
        errors.push('Field "channels" must be an array');
      } else {
        frontmatter.channels.forEach((channel: any, index: number) => {
          if (!channel || typeof channel !== 'object') {
            errors.push(`Channel at index ${index} must be an object`);
            return;
          }
          
          if (!channel.event || typeof channel.event !== 'string') {
            errors.push(`Channel at index ${index} missing required string field: event`);
          }
          
          if (!channel.emit || typeof channel.emit !== 'string') {
            errors.push(`Channel at index ${index} missing required string field: emit`);
          }

          // Validate event name format (alphanumeric, underscore, dash)
          if (channel.event && !/^[a-zA-Z0-9_-]+$/.test(channel.event)) {
            errors.push(`Channel at index ${index}: event name '${channel.event}' contains invalid characters. Use only letters, numbers, underscores, and dashes`);
          }

          // Validate emit function name format (valid JavaScript identifier)
          if (channel.emit && !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(channel.emit)) {
            errors.push(`Channel at index ${index}: emit function name '${channel.emit}' is not a valid JavaScript identifier`);
          }
        });
      }
    }

    // Validate optional 'route' field
    if (frontmatter.route !== undefined) {
      if (typeof frontmatter.route !== 'string') {
        errors.push('Field "route" must be a string');
      } else if (!frontmatter.route.startsWith('/')) {
        errors.push('Field "route" must start with "/"');
      }
    }

    // Validate optional 'layout' field
    if (frontmatter.layout !== undefined) {
      if (typeof frontmatter.layout !== 'string') {
        errors.push('Field "layout" must be a string');
      } else if (frontmatter.layout.trim().length === 0) {
        errors.push('Field "layout" cannot be empty');
      }
    }

    // Check for unknown fields and warn
    const knownFields = ['target', 'channels', 'route', 'layout'];
    const unknownFields = Object.keys(frontmatter).filter(key => !knownFields.includes(key));
    if (unknownFields.length > 0) {
      warnings.push(`Unknown fields in frontmatter: ${unknownFields.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Parse modern syntax content into AST
   */
  parseModern(content: string): ModernAST {
    const tokens = this.tokenize(content);
    const context: ParseContext = {
      tokens,
      current: 0,
      source: content
    };

    const statements = this.parseStatements(context);
    
    return {
      type: 'Program',
      body: statements,
      frontmatter: {},
      syntaxVersion: 'modern',
      modernFeatures: this.detectModernFeatures(content)
    };
  }

  /**
   * Parse template content and extract bindings
   */
  parseTemplate(content: string): TemplateNode {
    return this.templateParser.parseTemplate(content);
  }

  /**
   * Extract template bindings from MTM file content
   */
  extractTemplateBindings(content: string): TemplateNode | null {
    // Check if content contains template syntax
    if (!this.hasTemplateSyntax(content)) {
      return null;
    }

    return this.parseTemplate(content);
  }

  /**
   * Check if content contains template syntax
   */
  private hasTemplateSyntax(content: string): boolean {
    return /\{\{\$\w+\}\}/.test(content) || /\w+\s*=\s*["\']?\$\w+\([^)]*\)["\']?/.test(content);
  }

  /**
   * Tokenize modern syntax content
   */
  private tokenize(content: string): Token[] {
    const tokens: Token[] = [];
    let line = 1;
    let column = 1;
    let index = 0;

    while (index < content.length) {
      const char = content[index];
      const location: SourceLocation = { line, column, index };

      // Skip whitespace (except newlines)
      if (char === ' ' || char === '\t' || char === '\r') {
        index++;
        column++;
        continue;
      }

      // Handle newlines
      if (char === '\n') {
        tokens.push({ type: TokenType.NEWLINE, value: char, location });
        index++;
        line++;
        column = 1;
        continue;
      }

      // Handle dollar sign
      if (char === '$') {
        tokens.push({ type: TokenType.DOLLAR, value: char, location });
        index++;
        column++;
        continue;
      }

      // Handle colon
      if (char === ':') {
        tokens.push({ type: TokenType.COLON, value: char, location });
        index++;
        column++;
        continue;
      }

      // Handle arrow (=>) - check before equals
      if (char === '=' && content[index + 1] === '>') {
        tokens.push({ type: TokenType.ARROW, value: '=>', location });
        index += 2;
        column += 2;
        continue;
      }

      // Handle equals
      if (char === '=') {
        tokens.push({ type: TokenType.EQUALS, value: char, location });
        index++;
        column++;
        continue;
      }

      // Handle exclamation
      if (char === '!') {
        tokens.push({ type: TokenType.EXCLAMATION, value: char, location });
        index++;
        column++;
        continue;
      }

      // Handle semicolon
      if (char === ';') {
        tokens.push({ type: TokenType.SEMICOLON, value: char, location });
        index++;
        column++;
        continue;
      }

      // Handle parentheses
      if (char === '(') {
        tokens.push({ type: TokenType.LPAREN, value: char, location });
        index++;
        column++;
        continue;
      }

      if (char === ')') {
        tokens.push({ type: TokenType.RPAREN, value: char, location });
        index++;
        column++;
        continue;
      }

      // Handle braces
      if (char === '{') {
        tokens.push({ type: TokenType.LBRACE, value: char, location });
        index++;
        column++;
        continue;
      }

      if (char === '}') {
        tokens.push({ type: TokenType.RBRACE, value: char, location });
        index++;
        column++;
        continue;
      }

      // Handle comma
      if (char === ',') {
        tokens.push({ type: TokenType.COMMA, value: char, location });
        index++;
        column++;
        continue;
      }

      // Handle operators and other characters (for now, treat as literals for expression parsing)
      if (char === '+' || char === '-' || char === '*' || char === '/' || char === '.' || 
          char === '<' || char === '>' || char === '%' || char === '&' || char === '|' ||
          char === '[' || char === ']') {
        tokens.push({ type: TokenType.LITERAL, value: char, location });
        index++;
        column++;
        continue;
      }

      // Handle boolean and null literals (check before identifiers)
      if (content.slice(index).startsWith('true') && !/[a-zA-Z0-9_]/.test(content[index + 4] || '')) {
        tokens.push({ type: TokenType.LITERAL, value: 'true', location });
        index += 4;
        column += 4;
        continue;
      }
      
      if (content.slice(index).startsWith('false') && !/[a-zA-Z0-9_]/.test(content[index + 5] || '')) {
        tokens.push({ type: TokenType.LITERAL, value: 'false', location });
        index += 5;
        column += 5;
        continue;
      }
      
      if (content.slice(index).startsWith('null') && !/[a-zA-Z0-9_]/.test(content[index + 4] || '')) {
        tokens.push({ type: TokenType.LITERAL, value: 'null', location });
        index += 4;
        column += 4;
        continue;
      }

      // Handle identifiers
      if (/[a-zA-Z_]/.test(char)) {
        const start = index;
        while (index < content.length && /[a-zA-Z0-9_]/.test(content[index])) {
          index++;
          column++;
        }
        const value = content.slice(start, index);
        tokens.push({ type: TokenType.IDENTIFIER, value, location });
        continue;
      }

      // Handle string literals
      if (char === '"' || char === "'" || char === '`') {
        const quote = char;
        const start = index;
        index++; // Skip opening quote
        column++;
        
        while (index < content.length && content[index] !== quote) {
          if (content[index] === '\\') {
            index += 2; // Skip escaped character
            column += 2;
          } else {
            if (content[index] === '\n') {
              line++;
              column = 1;
            } else {
              column++;
            }
            index++;
          }
        }
        
        if (index < content.length) {
          index++; // Skip closing quote
          column++;
        }
        
        const value = content.slice(start, index);
        tokens.push({ type: TokenType.LITERAL, value, location });
        continue;
      }

      // Handle number literals
      if (/\d/.test(char)) {
        const start = index;
        while (index < content.length && /[\d.]/.test(content[index])) {
          index++;
          column++;
        }
        const value = content.slice(start, index);
        tokens.push({ type: TokenType.LITERAL, value, location });
        continue;
      }

      // Handle invalid characters
      throw new Error(`Unexpected token '${char}' at line ${line}, column ${column}`);
    }

    tokens.push({ type: TokenType.EOF, value: '', location: { line, column, index } });
    return tokens;
  }

  /**
   * Parse statements from token stream with ASI support
   */
  private parseStatements(context: ParseContext): any[] {
    const statements: any[] = [];
    this.asiAmbiguities = []; // Reset ambiguities for this parse

    while (!this.isAtEnd(context)) {
      // Skip newlines
      if (this.match(context, TokenType.NEWLINE)) {
        continue;
      }

      const statement = this.parseStatement(context);
      if (statement) {
        statements.push(statement);
        
        // Apply ASI rules after parsing each statement
        this.applyAutomaticSemicolonInsertion(context, statement);
      }
    }

    return statements;
  }

  /**
   * Apply Automatic Semicolon Insertion (ASI) rules
   */
  private applyAutomaticSemicolonInsertion(context: ParseContext, statement: any): void {
    // Skip if statement already has explicit semicolon
    if (statement.hasExplicitSemicolon) {
      return;
    }

    const currentToken = this.peek(context);
    const previousToken = context.current > 0 ? context.tokens[context.current - 1] : null;
    const nextToken = context.current < context.tokens.length - 1 ? context.tokens[context.current + 1] : null;

    const asiContext: ASIContext = {
      previousToken,
      currentToken,
      nextToken,
      isLineTerminated: this.isLineTerminated(previousToken, currentToken),
      isStatementEnd: this.isStatementEnd(statement)
    };

    // Check if ASI should be applied
    if (this.shouldInsertSemicolon(asiContext)) {
      // Check for ambiguity before inserting
      const ambiguity = this.detectASIAmbiguity(asiContext, statement);
      if (ambiguity) {
        this.asiAmbiguities.push(ambiguity);
      }
      
      // Insert virtual semicolon (mark statement as ASI-terminated)
      statement.asiTerminated = true;
    }
  }

  /**
   * Determine if ASI should be applied based on context
   */
  private shouldInsertSemicolon(asiContext: ASIContext): boolean {
    const { currentToken, previousToken, isLineTerminated, isStatementEnd } = asiContext;

    // Rule 1: Insert semicolon at end of file
    if (currentToken.type === TokenType.EOF && isStatementEnd) {
      return true;
    }

    // Rule 2: Insert semicolon before line terminator if statement is complete
    if (isLineTerminated && isStatementEnd) {
      return true;
    }

    // Rule 3: Insert semicolon before restricted tokens
    if (this.isRestrictedToken(currentToken) && isLineTerminated) {
      return true;
    }

    // Rule 4: Insert semicolon before closing brace
    if (currentToken.type === TokenType.RBRACE && isStatementEnd) {
      return true;
    }

    // Rule 5: Don't insert if explicit semicolon is present
    if (currentToken.type === TokenType.SEMICOLON) {
      return false;
    }

    // Rule 6: Insert semicolon if we're at a newline and the statement can be terminated
    if (currentToken.type === TokenType.NEWLINE && isStatementEnd) {
      return true;
    }

    return false;
  }

  /**
   * Check if there's a line terminator between tokens
   */
  private isLineTerminated(previousToken: Token | null, currentToken: Token): boolean {
    if (!previousToken) return false;
    
    // Check if there's a newline between the tokens
    return currentToken.location.line > previousToken.location.line;
  }

  /**
   * Check if the current statement can be terminated
   */
  private isStatementEnd(statement: any): boolean {
    if (!statement) return false;

    // These statement types can be terminated with ASI
    const terminableStatements = [
      'VariableDeclaration',
      'FunctionDeclaration',
      'ExpressionStatement',
      'ReturnStatement',
      'ThrowStatement',
      'BreakStatement',
      'ContinueStatement'
    ];

    return terminableStatements.includes(statement.type);
  }

  /**
   * Check if token is restricted (cannot follow line terminator without semicolon)
   */
  private isRestrictedToken(token: Token): boolean {
    // These tokens cannot appear at the start of a line without explicit semicolon
    const restrictedTokens = [
      TokenType.LPAREN,    // Could be function call continuation
      TokenType.LBRACE,    // Could be object literal continuation
      TokenType.LITERAL    // Could be array access or template literal
    ];

    return restrictedTokens.includes(token.type) || 
           (token.type === TokenType.LITERAL && (token.value === '[' || token.value === '`'));
  }

  /**
   * Detect potential ASI ambiguities
   */
  private detectASIAmbiguity(asiContext: ASIContext, statement: any): ASIAmbiguity | null {
    const { currentToken, nextToken, isLineTerminated } = asiContext;

    // Ambiguity 1: Statement continuation vs new statement
    if (isLineTerminated && this.couldBeStatementContinuation(currentToken, nextToken)) {
      return {
        location: currentToken.location,
        type: 'statement_continuation',
        message: `Ambiguous statement termination. Could be continuation of previous statement.`,
        suggestion: `Add explicit semicolon before line ${currentToken.location.line} to clarify intent.`
      };
    }

    // Ambiguity 2: Return value vs return statement
    if (statement.type === 'ReturnStatement' && isLineTerminated && nextToken) {
      return {
        location: currentToken.location,
        type: 'return_value',
        message: `Return statement may be missing value due to line break.`,
        suggestion: `Move return value to same line or add explicit semicolon after 'return'.`
      };
    }

    // Ambiguity 3: Expression split across lines
    if (this.isExpressionSplit(currentToken, nextToken, isLineTerminated)) {
      return {
        location: currentToken.location,
        type: 'expression_split',
        message: `Expression may be unintentionally split across lines.`,
        suggestion: `Add explicit semicolon or move expression to same line.`
      };
    }

    return null;
  }

  /**
   * Check if current position could be statement continuation
   */
  private couldBeStatementContinuation(currentToken: Token, nextToken: Token | null): boolean {
    if (!nextToken) return false;

    // Check for patterns that could continue previous statement
    return (
      nextToken.type === TokenType.LPAREN ||  // Function call
      nextToken.type === TokenType.LITERAL && nextToken.value === '[' ||  // Array access
      nextToken.type === TokenType.LITERAL && nextToken.value === '.' ||  // Property access
      nextToken.type === TokenType.LITERAL && nextToken.value === '`'     // Template literal
    );
  }

  /**
   * Check if expression is split across lines
   */
  private isExpressionSplit(currentToken: Token, nextToken: Token | null, isLineTerminated: boolean): boolean {
    if (!nextToken || !isLineTerminated) return false;

    // Check for binary operators that suggest continuation
    const continuationOperators = ['+', '-', '*', '/', '%', '&&', '||', '==', '!=', '<', '>', '<=', '>='];
    
    return (
      nextToken.type === TokenType.LITERAL && 
      continuationOperators.includes(nextToken.value)
    );
  }

  /**
   * Get ASI ambiguities detected during parsing
   */
  getASIAmbiguities(): ASIAmbiguity[] {
    return [...this.asiAmbiguities];
  }

  /**
   * Generate helpful error messages for ASI ambiguities
   */
  generateASIErrorMessages(): string[] {
    return this.asiAmbiguities.map(ambiguity => {
      const location = `line ${ambiguity.location.line}, column ${ambiguity.location.column}`;
      return `${ambiguity.message} (${location})\nSuggestion: ${ambiguity.suggestion}`;
    });
  }

  /**
   * Check for semicolon ambiguity in specific code patterns
   */
  checkForSemicolonAmbiguity(content: string): ASIAmbiguity[] {
    const ambiguities: ASIAmbiguity[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length - 1; i++) {
      const currentLine = lines[i].trim();
      const nextLine = lines[i + 1].trim();

      // Check for potential statement continuation
      if (this.isPotentialStatementContinuation(currentLine, nextLine)) {
        ambiguities.push({
          location: { line: i + 1, column: 1, index: 0 },
          type: 'statement_continuation',
          message: `Line ${i + 1} may be unintentionally continued on line ${i + 2}`,
          suggestion: `Add explicit semicolon at end of line ${i + 1} if statements should be separate`
        });
      }

      // Check for return statement ambiguity
      if (this.isReturnStatementAmbiguity(currentLine, nextLine)) {
        ambiguities.push({
          location: { line: i + 1, column: 1, index: 0 },
          type: 'return_value',
          message: `Return statement on line ${i + 1} may be missing its value due to line break`,
          suggestion: `Move return value to same line or add explicit semicolon after 'return'`
        });
      }

      // Check for expression split ambiguity
      if (this.isExpressionSplitAmbiguity(currentLine, nextLine)) {
        ambiguities.push({
          location: { line: i + 1, column: 1, index: 0 },
          type: 'expression_split',
          message: `Expression on line ${i + 1} may be unintentionally split across lines`,
          suggestion: `Add explicit semicolon or move expression to same line`
        });
      }
    }

    return ambiguities;
  }

  /**
   * Check if current and next line form a potential statement continuation
   */
  private isPotentialStatementContinuation(currentLine: string, nextLine: string): boolean {
    // Check if current line looks like a complete statement
    if (!currentLine || currentLine.endsWith(';') || currentLine.endsWith('{') || currentLine.endsWith('}')) {
      return false;
    }

    // Check if next line starts with tokens that could continue the statement
    const continuationTokens = ['(', '[', '.', '`'];
    return continuationTokens.some(token => nextLine.startsWith(token));
  }

  /**
   * Check if there's a return statement ambiguity
   */
  private isReturnStatementAmbiguity(currentLine: string, nextLine: string): boolean {
    // Check if current line is just 'return' without value
    if (!currentLine.match(/^\s*return\s*$/)) {
      return false;
    }

    // Check if next line could be the return value (not a comment or empty)
    if (!nextLine || nextLine.trim() === '') {
      return false;
    }

    // Skip comments
    const trimmedNext = nextLine.trim();
    if (trimmedNext.startsWith('//') || trimmedNext.startsWith('/*')) {
      return false;
    }

    return true;
  }

  /**
   * Check if there's an expression split ambiguity
   */
  private isExpressionSplitAmbiguity(currentLine: string, nextLine: string): boolean {
    // Check if current line ends with an identifier or value
    if (!currentLine.match(/\w+\s*$/)) {
      return false;
    }

    // Check if next line starts with a binary operator
    const binaryOperators = ['+', '-', '*', '/', '%', '&&', '||', '==', '!=', '<', '>', '<=', '>='];
    return binaryOperators.some(op => nextLine.trim().startsWith(op));
  }

  /**
   * Provide quick fix suggestions for ASI ambiguities
   */
  generateQuickFixes(ambiguity: ASIAmbiguity): Array<{ description: string; fix: string }> {
    const fixes: Array<{ description: string; fix: string }> = [];

    switch (ambiguity.type) {
      case 'statement_continuation':
        fixes.push({
          description: 'Add semicolon to separate statements',
          fix: 'Add ; at the end of the line'
        });
        fixes.push({
          description: 'Move continuation to same line',
          fix: 'Combine the lines into a single statement'
        });
        break;

      case 'return_value':
        fixes.push({
          description: 'Move return value to same line',
          fix: 'return value'
        });
        fixes.push({
          description: 'Add explicit semicolon after return',
          fix: 'return;'
        });
        break;

      case 'expression_split':
        fixes.push({
          description: 'Add semicolon to end expression',
          fix: 'Add ; at the end of the expression'
        });
        fixes.push({
          description: 'Move operator to previous line',
          fix: 'Combine the expression on one line'
        });
        break;
    }

    return fixes;
  }

  /**
   * Validate semicolon usage and provide warnings
   */
  validateSemicolonUsage(content: string): { warnings: string[]; suggestions: string[] } {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check for mixed semicolon usage
    const usesASI = this.usesAutomaticSemicolonInsertion(content);
    const hasExplicitSemicolons = content.includes(';');

    if (usesASI && hasExplicitSemicolons) {
      warnings.push('Mixed semicolon usage detected. Consider using consistent style throughout the file.');
      suggestions.push('Choose either explicit semicolons everywhere or rely on ASI consistently.');
    }

    // Check for potential ambiguities
    const ambiguities = this.checkForSemicolonAmbiguity(content);
    if (ambiguities.length > 0) {
      warnings.push(`Found ${ambiguities.length} potential semicolon ambiguities.`);
      suggestions.push('Review ambiguous cases and add explicit semicolons where needed.');
    }

    // Check for dangerous ASI patterns
    const dangerousPatterns = this.findDangerousASIPatterns(content);
    if (dangerousPatterns.length > 0) {
      warnings.push('Found potentially dangerous ASI patterns that could cause unexpected behavior.');
      suggestions.push('Add explicit semicolons in these cases for clarity.');
    }

    return { warnings, suggestions };
  }

  /**
   * Find dangerous ASI patterns that could cause issues
   */
  private findDangerousASIPatterns(content: string): Array<{ line: number; pattern: string; risk: string }> {
    const patterns: Array<{ line: number; pattern: string; risk: string }> = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length - 1; i++) {
      const currentLine = lines[i].trim();
      const nextLine = lines[i + 1].trim();

      // Pattern 1: Function call followed by parentheses on next line
      if (currentLine.match(/\w+\([^)]*\)$/) && nextLine.startsWith('(')) {
        patterns.push({
          line: i + 1,
          pattern: 'Function call followed by parentheses',
          risk: 'May be interpreted as double function call'
        });
      }

      // Pattern 2: Array access on next line
      if (currentLine.match(/\w+$/) && nextLine.startsWith('[')) {
        patterns.push({
          line: i + 1,
          pattern: 'Variable followed by bracket on next line',
          risk: 'May be interpreted as array access'
        });
      }

      // Pattern 3: Template literal on next line
      if (currentLine.match(/\w+$/) && nextLine.startsWith('`')) {
        patterns.push({
          line: i + 1,
          pattern: 'Variable followed by template literal',
          risk: 'May be interpreted as tagged template literal'
        });
      }
    }

    return patterns;
  }

  /**
   * Find dangerous ASI patterns that could cause issues
   */
  private findDangerousASIPatterns(content: string): Array<{ line: number; pattern: string; risk: string }> {
    const patterns: Array<{ line: number; pattern: string; risk: string }> = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length - 1; i++) {
      const currentLine = lines[i].trim();
      const nextLine = lines[i + 1].trim();

      // Pattern 1: Function call followed by parentheses on next line
      if (currentLine.match(/\w+\([^)]*\)$/) && nextLine.startsWith('(')) {
        patterns.push({
          line: i + 1,
          pattern: 'Function call followed by parentheses',
          risk: 'May be interpreted as double function call'
        });
      }

      // Pattern 2: Array access on next line
      if (currentLine.match(/\w+$/) && nextLine.startsWith('[')) {
        patterns.push({
          line: i + 1,
          pattern: 'Variable followed by bracket on next line',
          risk: 'May be interpreted as array access'
        });
      }

      // Pattern 3: Template literal on next line
      if (currentLine.match(/\w+$/) && nextLine.startsWith('`')) {
        patterns.push({
          line: i + 1,
          pattern: 'Variable followed by template literal',
          risk: 'May be interpreted as tagged template literal'
        });
      }
    }

    return patterns;
  }

  /**
   * Check if content uses ASI (has statements without explicit semicolons)
   */
  usesAutomaticSemicolonInsertion(content: string): boolean {
    const tokens = this.tokenize(content);
    let statementCount = 0;
    let explicitSemicolons = 0;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      
      // Count potential statement endings
      if (this.isStatementToken(token)) {
        statementCount++;
      }
      
      // Count explicit semicolons
      if (token.type === TokenType.SEMICOLON) {
        explicitSemicolons++;
      }
    }

    // If less than 50% of statements have explicit semicolons, consider it ASI style
    return statementCount > 0 && (explicitSemicolons / statementCount) < 0.5;
  }

  /**
   * Check if token indicates a statement
   */
  private isStatementToken(token: Token): boolean {
    return (
      token.type === TokenType.DOLLAR ||  // Variable/function declaration
      (token.type === TokenType.IDENTIFIER && 
       ['return', 'throw', 'break', 'continue', 'if', 'for', 'while'].includes(token.value))
    );
  }

  /**
   * Parse a single statement
   */
  private parseStatement(context: ParseContext): any {
    // Check for variable declaration with $ prefix
    if (this.check(context, TokenType.DOLLAR)) {
      return this.parseDollarPrefixDeclaration(context);
    }

    // Check for class declaration
    if (this.checkIdentifier(context, 'class')) {
      return this.parseClassDeclaration(context);
    }

    // Skip other statements for now
    this.advance(context);
    return null;
  }

  /**
   * Parse $ prefix declaration (could be variable or function)
   */
  private parseDollarPrefixDeclaration(context: ParseContext): any {
    const startLocation = this.peek(context).location;
    
    // Consume $
    this.consume(context, TokenType.DOLLAR, "Expected '$'");
    
    // Get name
    const nameToken = this.consume(context, TokenType.IDENTIFIER, "Expected name");
    const name = nameToken.value;

    // Check for reactive suffix !
    let hasReactiveSuffix = false;
    if (this.check(context, TokenType.EXCLAMATION)) {
      hasReactiveSuffix = true;
      this.advance(context);
    }

    // Check for type annotation
    let typeAnnotation: TypeAnnotationNode | undefined;
    if (this.check(context, TokenType.COLON)) {
      this.advance(context); // consume :
      typeAnnotation = this.parseTypeAnnotation(context);
    }

    // Consume =
    this.consume(context, TokenType.EQUALS, "Expected '=' in declaration");

    // Look ahead to determine if this is a function or variable
    if (this.isFunctionExpression(context)) {
      return this.parseFunctionDeclaration(context, name, hasReactiveSuffix, typeAnnotation, startLocation);
    } else {
      return this.parseVariableDeclarationFromContext(context, name, hasReactiveSuffix, typeAnnotation, startLocation);
    }
  }

  /**
   * Check if the next tokens represent a function expression
   */
  private isFunctionExpression(context: ParseContext): boolean {
    const current = context.current;
    
    // Check for async keyword
    if (this.checkIdentifier(context, 'async')) {
      context.current++;
    }
    
    // Check for opening parenthesis (arrow function parameters)
    const isArrowFunction = this.check(context, TokenType.LPAREN);
    
    // Reset position
    context.current = current;
    
    // Also check for arrow token directly (for cases like "= => 42")
    if (!isArrowFunction && this.check(context, TokenType.ARROW)) {
      // This is an error case - missing parameter list
      throw new Error(`Unexpected token: ${this.peek(context).value} at line ${this.peek(context).location.line}`);
    }
    
    return isArrowFunction;
  }

  /**
   * Parse function declaration with $ prefix
   */
  private parseFunctionDeclaration(
    context: ParseContext,
    name: string,
    hasReactiveSuffix: boolean,
    returnTypeAnnotation: TypeAnnotationNode | undefined,
    startLocation: SourceLocation
  ): any {
    // Check for async keyword
    let isAsync = false;
    if (this.checkIdentifier(context, 'async')) {
      isAsync = true;
      this.advance(context);
    }

    // Parse parameters
    this.consume(context, TokenType.LPAREN, "Expected '(' for function parameters");
    const parameters = this.parseParameterList(context);
    this.consume(context, TokenType.RPAREN, "Expected ')' after function parameters");

    // Check for explicit return type annotation (after parameters)
    let explicitReturnType: TypeAnnotationNode | undefined = returnTypeAnnotation;
    if (this.check(context, TokenType.COLON)) {
      this.advance(context); // consume :
      explicitReturnType = this.parseTypeAnnotation(context);
    }

    // Parse arrow
    this.consume(context, TokenType.ARROW, "Expected '=>' for arrow function");

    // Parse function body
    const body = this.parseFunctionBody(context);

    // Check for explicit semicolon
    let hasExplicitSemicolon = false;
    if (this.check(context, TokenType.SEMICOLON)) {
      hasExplicitSemicolon = true;
      this.advance(context);
    }

    // Infer parameter types if not explicitly provided
    const inferredParameters = this.inferParameterTypes(parameters);
    
    // Infer return type from body if not explicitly provided
    const inferredReturnType = explicitReturnType ? 
      this.convertTypeAnnotationToTypeInfo(explicitReturnType) :
      this.inferReturnType(body, isAsync);

    // Register function type for future reference
    const functionType: TypeInfo = {
      baseType: 'function',
      nullable: false,
      parameters: inferredParameters.map(p => p.inferredType!),
      returnType: inferredReturnType
    };
    this.typeInferenceEngine.registerVariable(name, functionType);

    return {
      type: 'FunctionDeclaration',
      name,
      hasDollarPrefix: true,
      parameters: inferredParameters,
      returnType: explicitReturnType,
      body,
      isArrow: true,
      autoBindThis: true, // Always true for $ prefix arrow functions
      async: isAsync,
      inferredReturnType,
      hasReactiveSuffix,
      location: startLocation,
      hasExplicitSemicolon
    };
  }

  /**
   * Parse variable declaration with $ prefix
   */
  private parseVariableDeclaration(context: ParseContext): VariableDeclarationNode | ReactiveVariableNode {
    const startLocation = this.peek(context).location;
    
    // Consume $
    this.consume(context, TokenType.DOLLAR, "Expected '$'");
    
    // Get variable name
    const nameToken = this.consume(context, TokenType.IDENTIFIER, "Expected variable name");
    const name = nameToken.value;

    // Check for reactive suffix !
    let hasReactiveSuffix = false;
    if (this.check(context, TokenType.EXCLAMATION)) {
      hasReactiveSuffix = true;
      this.advance(context);
    }

    // Check for type annotation
    let typeAnnotation: TypeAnnotationNode | undefined;
    if (this.check(context, TokenType.COLON)) {
      this.advance(context); // consume :
      typeAnnotation = this.parseTypeAnnotation(context);
    }

    // Consume =
    this.consume(context, TokenType.EQUALS, "Expected '=' in variable declaration");

    // Parse initializer
    const initializer = this.parseExpression(context);

    // Optional semicolon
    if (this.check(context, TokenType.SEMICOLON)) {
      this.advance(context);
    }

    // Use enhanced type inference engine
    const inferenceResult = this.typeInferenceEngine.inferType(initializer);
    const inferredType = inferenceResult.inferredType;

    // Validate type annotation if present
    if (typeAnnotation) {
      const validationResult = this.typeInferenceEngine.validateTypeAnnotation(
        typeAnnotation,
        inferredType,
        name
      );
      
      if (!validationResult.isValid) {
        const conflicts = validationResult.conflicts.map(c => c.message).join(', ');
        throw new Error(`Type validation failed for variable '${name}': ${conflicts}`);
      }
    }

    // Register variable type for future reference
    this.typeInferenceEngine.registerVariable(name, inferredType);

    // Create base variable declaration
    const baseDeclaration = {
      type: 'VariableDeclaration' as const,
      name,
      hasDollarPrefix: true,
      hasReactiveSuffix,
      typeAnnotation,
      initializer,
      inferredType,
      scope: 'local' as const,
      isReactive: hasReactiveSuffix,
      location: startLocation
    };

    // If reactive, add dependency tracking metadata
    if (hasReactiveSuffix) {
      return {
        ...baseDeclaration,
        updateTriggers: this.analyzeUpdateTriggers(name, initializer),
        dependencies: this.analyzeDependencies(initializer)
      };
    }

    return baseDeclaration;
  }

  /**
   * Parse type annotation
   */
  private parseTypeAnnotation(context: ParseContext): TypeAnnotationNode {
    const location = this.peek(context).location;
    
    // Handle function type annotations like (a: number, b: number): number
    if (this.check(context, TokenType.LPAREN)) {
      return this.parseFunctionTypeAnnotation(context, location);
    }
    
    const typeToken = this.consume(context, TokenType.IDENTIFIER, "Expected type name");
    let baseType = typeToken.value;
    let typeKind: 'primitive' | 'object' | 'array' | 'function' | 'generic' = 'primitive';
    let generics: TypeAnnotationNode[] | undefined;
    
    // Handle generic types like Promise<any>
    if (this.check(context, TokenType.LITERAL) && this.peek(context).value === '<') {
      this.advance(context); // consume <
      typeKind = 'generic';
      generics = [];
      
      // Parse generic type parameters
      do {
        if (this.check(context, TokenType.IDENTIFIER)) {
          const genericType = this.advance(context);
          generics.push({
            type: 'TypeAnnotation',
            typeKind: 'primitive',
            baseType: genericType.value,
            location: genericType.location
          });
        }
      } while (this.match(context, TokenType.COMMA));
      
      // Consume closing >
      if (this.check(context, TokenType.LITERAL) && this.peek(context).value === '>') {
        this.advance(context);
      }
    }
    
    return {
      type: 'TypeAnnotation',
      typeKind,
      baseType,
      generics,
      location
    };
  }

  /**
   * Parse function type annotation like (a: number, b: number): number
   */
  private parseFunctionTypeAnnotation(context: ParseContext, location: SourceLocation): TypeAnnotationNode {
    this.consume(context, TokenType.LPAREN, "Expected '('");
    
    const parameters: TypeAnnotationNode[] = [];
    
    // Parse parameter types
    if (!this.check(context, TokenType.RPAREN)) {
      do {
        // Skip parameter name if present
        if (this.check(context, TokenType.IDENTIFIER)) {
          this.advance(context);
          if (this.check(context, TokenType.COLON)) {
            this.advance(context);
          }
        }
        
        // Parse parameter type
        const paramType = this.parseTypeAnnotation(context);
        parameters.push(paramType);
      } while (this.match(context, TokenType.COMMA));
    }
    
    this.consume(context, TokenType.RPAREN, "Expected ')'");
    
    // Parse return type
    let returnType: TypeAnnotationNode | undefined;
    if (this.check(context, TokenType.COLON)) {
      this.advance(context);
      returnType = this.parseTypeAnnotation(context);
    }
    
    return {
      type: 'TypeAnnotation',
      typeKind: 'function',
      baseType: 'function',
      parameters,
      returnType,
      location
    };
  }

  /**
   * Parse expression (simplified for now)
   */
  private parseExpression(context: ParseContext): ExpressionNode {
    // For now, we'll parse a simple expression by consuming tokens until we hit a delimiter
    // This is a simplified approach to get function parsing working
    const startLocation = this.peek(context).location;
    const tokens: Token[] = [];
    
    // Consume tokens until we hit a statement delimiter
    while (!this.isAtEnd(context) && 
           !this.check(context, TokenType.SEMICOLON) &&
           !this.check(context, TokenType.NEWLINE) &&
           !this.check(context, TokenType.RBRACE) &&
           !this.check(context, TokenType.RPAREN) &&
           !this.check(context, TokenType.COMMA)) {
      tokens.push(this.advance(context));
    }
    
    // If we have no tokens, return a placeholder
    if (tokens.length === 0) {
      return {
        type: 'Literal',
        value: null,
        raw: 'null',
        location: startLocation
      } as LiteralNode;
    }
    
    // If we have a single token, parse it as primary
    if (tokens.length === 1) {
      return this.createExpressionFromToken(tokens[0]);
    }
    
    // For multiple tokens, create a simple expression representation
    // This is a placeholder - in a full implementation we'd build a proper AST
    return {
      type: 'Literal',
      value: tokens.map(t => t.value).join(' '),
      raw: tokens.map(t => t.value).join(' '),
      location: startLocation
    } as LiteralNode;
  }

  /**
   * Create expression node from a single token
   */
  private createExpressionFromToken(token: Token): ExpressionNode {
    if (token.type === TokenType.LITERAL) {
      return this.createLiteralNode(token);
    }

    if (token.type === TokenType.IDENTIFIER) {
      return {
        type: 'Identifier',
        name: token.value,
        location: token.location
      } as IdentifierNode;
    }

    // For other token types, treat as literal
    return {
      type: 'Literal',
      value: token.value,
      raw: token.value,
      location: token.location
    } as LiteralNode;
  }

  /**
   * Parse class declaration
   */
  private parseClassDeclaration(context: ParseContext): any {
    const startLocation = this.peek(context).location;
    
    // Consume 'class' keyword
    this.consume(context, TokenType.IDENTIFIER, "Expected 'class'");
    
    // Get class name
    const nameToken = this.consume(context, TokenType.IDENTIFIER, "Expected class name");
    const name = nameToken.value;
    
    // Consume opening brace
    this.consume(context, TokenType.LBRACE, "Expected '{' after class name");
    
    const properties: any[] = [];
    const methods: any[] = [];
    let constructor: any = undefined;
    
    // Parse class body
    while (!this.check(context, TokenType.RBRACE) && !this.isAtEnd(context)) {
      // Skip newlines
      if (this.match(context, TokenType.NEWLINE)) {
        continue;
      }
      
      // Check for constructor
      if (this.checkIdentifier(context, 'constructor')) {
        constructor = this.parseConstructor(context);
        continue;
      }
      
      // Check for $ prefix property or method
      if (this.check(context, TokenType.DOLLAR)) {
        const member = this.parseClassMember(context);
        if (member.type === 'ClassProperty') {
          properties.push(member);
        } else if (member.type === 'ClassMethod') {
          methods.push(member);
        }
        continue;
      }
      
      // Skip other members for now
      this.advance(context);
    }
    
    // Consume closing brace
    this.consume(context, TokenType.RBRACE, "Expected '}' after class body");
    
    return {
      type: 'ClassDeclaration',
      name,
      properties,
      methods,
      constructor,
      location: startLocation
    };
  }

  /**
   * Parse class member (property or method with $ prefix)
   */
  private parseClassMember(context: ParseContext): any {
    const startLocation = this.peek(context).location;
    
    // Consume $
    this.consume(context, TokenType.DOLLAR, "Expected '$'");
    
    // Get member name
    const nameToken = this.consume(context, TokenType.IDENTIFIER, "Expected member name");
    const name = nameToken.value;
    
    // Check for reactive suffix !
    let hasReactiveSuffix = false;
    if (this.check(context, TokenType.EXCLAMATION)) {
      hasReactiveSuffix = true;
      this.advance(context);
    }
    
    // Check for type annotation
    let typeAnnotation: TypeAnnotationNode | undefined;
    if (this.check(context, TokenType.COLON)) {
      this.advance(context); // consume :
      typeAnnotation = this.parseTypeAnnotation(context);
    }
    
    // Check if this is a method (has = followed by function) or property
    if (this.check(context, TokenType.EQUALS)) {
      this.advance(context); // consume =
      
      // Check if this is a function
      if (this.isFunctionExpression(context)) {
        return this.parseClassMethod(context, name, hasReactiveSuffix, typeAnnotation, startLocation);
      } else {
        return this.parseClassProperty(context, name, hasReactiveSuffix, typeAnnotation, startLocation);
      }
    } else {
      // Property without initializer
      return this.parseClassPropertyWithoutInitializer(context, name, hasReactiveSuffix, typeAnnotation, startLocation);
    }
  }

  /**
   * Parse class property with initializer
   */
  private parseClassProperty(
    context: ParseContext,
    name: string,
    hasReactiveSuffix: boolean,
    typeAnnotation: TypeAnnotationNode | undefined,
    startLocation: SourceLocation
  ): any {
    // Parse initializer
    const initializer = this.parseExpression(context);
    
    // Optional semicolon
    if (this.check(context, TokenType.SEMICOLON)) {
      this.advance(context);
    }
    
    // Infer type from initializer
    const inferenceResult = this.typeInferenceEngine.inferType(initializer);
    const inferredType = inferenceResult.inferredType;
    
    // Validate type annotation if present
    if (typeAnnotation) {
      const validationResult = this.typeInferenceEngine.validateTypeAnnotation(
        typeAnnotation,
        inferredType,
        name
      );
      
      if (!validationResult.isValid) {
        const conflicts = validationResult.conflicts.map(c => c.message).join(', ');
        throw new Error(`Type validation failed for class property '${name}': ${conflicts}`);
      }
    }
    
    return {
      type: 'ClassProperty',
      name,
      hasDollarPrefix: true,
      typeAnnotation,
      initializer,
      isReactive: hasReactiveSuffix,
      inferredType,
      location: startLocation
    };
  }

  /**
   * Parse class property without initializer (just type annotation)
   */
  private parseClassPropertyWithoutInitializer(
    context: ParseContext,
    name: string,
    hasReactiveSuffix: boolean,
    typeAnnotation: TypeAnnotationNode | undefined,
    startLocation: SourceLocation
  ): any {
    // Optional semicolon
    if (this.check(context, TokenType.SEMICOLON)) {
      this.advance(context);
    }
    
    // If no type annotation, infer as 'any'
    const inferredType: TypeInfo = typeAnnotation ? 
      this.convertTypeAnnotationToTypeInfo(typeAnnotation) :
      { baseType: 'any', nullable: true };
    
    return {
      type: 'ClassProperty',
      name,
      hasDollarPrefix: true,
      typeAnnotation,
      initializer: undefined,
      isReactive: hasReactiveSuffix,
      inferredType,
      location: startLocation
    };
  }

  /**
   * Parse class method
   */
  private parseClassMethod(
    context: ParseContext,
    name: string,
    hasReactiveSuffix: boolean,
    returnTypeAnnotation: TypeAnnotationNode | undefined,
    startLocation: SourceLocation
  ): any {
    // Check for async keyword
    let isAsync = false;
    if (this.checkIdentifier(context, 'async')) {
      isAsync = true;
      this.advance(context);
    }

    // Parse parameters
    this.consume(context, TokenType.LPAREN, "Expected '(' for method parameters");
    const parameters = this.parseParameterList(context);
    this.consume(context, TokenType.RPAREN, "Expected ')' after method parameters");

    // Check for explicit return type annotation (after parameters)
    let explicitReturnType: TypeAnnotationNode | undefined = returnTypeAnnotation;
    if (this.check(context, TokenType.COLON)) {
      this.advance(context); // consume :
      explicitReturnType = this.parseTypeAnnotation(context);
    }

    // Parse arrow
    this.consume(context, TokenType.ARROW, "Expected '=>' for arrow method");

    // Parse method body
    const body = this.parseFunctionBody(context);

    // Optional semicolon
    if (this.check(context, TokenType.SEMICOLON)) {
      this.advance(context);
    }

    // Infer parameter types if not explicitly provided
    const inferredParameters = this.inferParameterTypes(parameters);
    
    // Infer return type from body if not explicitly provided
    const inferredReturnType = explicitReturnType ? 
      this.convertTypeAnnotationToTypeInfo(explicitReturnType) :
      this.inferReturnType(body, isAsync);

    return {
      type: 'ClassMethod',
      name,
      hasDollarPrefix: true,
      parameters: inferredParameters,
      returnType: explicitReturnType,
      body,
      isArrow: true,
      autoBindThis: true, // Always true for $ prefix arrow methods
      async: isAsync,
      kind: 'method',
      location: startLocation
    };
  }

  /**
   * Parse constructor
   */
  private parseConstructor(context: ParseContext): any {
    const startLocation = this.peek(context).location;
    
    // Consume 'constructor' keyword
    this.consume(context, TokenType.IDENTIFIER, "Expected 'constructor'");
    
    // Parse parameters
    this.consume(context, TokenType.LPAREN, "Expected '(' for constructor parameters");
    const parameters = this.parseConstructorParameterList(context);
    this.consume(context, TokenType.RPAREN, "Expected ')' after constructor parameters");
    
    // Skip newlines before constructor body
    while (this.check(context, TokenType.NEWLINE)) {
      this.advance(context);
    }
    
    // Parse constructor body
    this.consume(context, TokenType.LBRACE, "Expected '{' for constructor body");
    const body = this.parseConstructorBody(context);
    this.consume(context, TokenType.RBRACE, "Expected '}' after constructor body");
    
    return {
      type: 'ClassMethod',
      name: 'constructor',
      hasDollarPrefix: false,
      parameters,
      returnType: undefined,
      body,
      isArrow: false,
      autoBindThis: false,
      async: false,
      kind: 'constructor',
      location: startLocation
    };
  }

  /**
   * Parse constructor body (simplified for now)
   */
  private parseConstructorBody(context: ParseContext): any {
    const startLocation = this.peek(context).location;
    const body: any[] = [];
    
    while (!this.check(context, TokenType.RBRACE) && !this.isAtEnd(context)) {
      // Skip newlines
      if (this.match(context, TokenType.NEWLINE)) {
        continue;
      }
      
      // For now, just consume tokens until we find a statement delimiter
      // This is a simplified implementation to get constructor parsing working
      const tokens: Token[] = [];
      while (!this.isAtEnd(context) && 
             !this.check(context, TokenType.SEMICOLON) &&
             !this.check(context, TokenType.NEWLINE) &&
             !this.check(context, TokenType.RBRACE)) {
        tokens.push(this.advance(context));
      }
      
      if (tokens.length > 0) {
        // Create a simple statement from the tokens
        body.push({
          type: 'ExpressionStatement',
          expression: {
            type: 'Literal',
            value: tokens.map(t => t.value).join(' '),
            raw: tokens.map(t => t.value).join(' '),
            location: tokens[0].location
          },
          location: tokens[0].location
        });
      }
      
      // Consume optional semicolon
      if (this.check(context, TokenType.SEMICOLON)) {
        this.advance(context);
      }
    }
    
    return {
      type: 'BlockStatement',
      body,
      location: startLocation
    };
  }

  /**
   * Parse constructor parameter list with automatic property assignment
   */
  private parseConstructorParameterList(context: ParseContext): any[] {
    const parameters: any[] = [];
    
    if (this.check(context, TokenType.RPAREN)) {
      return parameters;
    }
    
    do {
      // Skip newlines in parameter list
      while (this.check(context, TokenType.NEWLINE)) {
        this.advance(context);
      }
      
      // If we hit the closing paren after skipping newlines, we're done
      if (this.check(context, TokenType.RPAREN)) {
        break;
      }
      
      const paramStartLocation = this.peek(context).location;
      
      // Check for property assignment syntax (public/private/protected modifier)
      let isPropertyAssignment = false;
      let accessModifier: string | undefined;
      
      if (this.checkIdentifier(context, 'public') || 
          this.checkIdentifier(context, 'private') || 
          this.checkIdentifier(context, 'protected')) {
        isPropertyAssignment = true;
        accessModifier = this.advance(context).value;
      }
      
      // Get parameter name
      const nameToken = this.consume(context, TokenType.IDENTIFIER, "Expected parameter name");
      const name = nameToken.value;
      
      // Check for type annotation
      let typeAnnotation: TypeAnnotationNode | undefined;
      if (this.check(context, TokenType.COLON)) {
        this.advance(context); // consume :
        typeAnnotation = this.parseTypeAnnotation(context);
      }
      
      // Check for default value
      let defaultValue: ExpressionNode | undefined;
      if (this.check(context, TokenType.EQUALS)) {
        this.advance(context); // consume =
        defaultValue = this.parseExpression(context);
      }
      
      // Infer type from default value if no explicit type
      let inferredType: TypeInfo;
      if (typeAnnotation) {
        inferredType = this.convertTypeAnnotationToTypeInfo(typeAnnotation);
      } else if (defaultValue) {
        const inferenceResult = this.typeInferenceEngine.inferType(defaultValue);
        inferredType = inferenceResult.inferredType;
      } else {
        inferredType = { baseType: 'any', nullable: true };
      }
      
      parameters.push({
        type: 'Parameter',
        name,
        typeAnnotation,
        defaultValue,
        inferredType,
        isPropertyAssignment,
        accessModifier,
        location: paramStartLocation
      });
      
      // Skip newlines after parameter
      while (this.check(context, TokenType.NEWLINE)) {
        this.advance(context);
      }
      
    } while (this.match(context, TokenType.COMMA));
    
    return parameters;
  }

  /**
   * Parse block statement
   */
  private parseBlockStatement(context: ParseContext): any {
    const startLocation = this.peek(context).location;
    const body: any[] = [];
    
    while (!this.check(context, TokenType.RBRACE) && !this.isAtEnd(context)) {
      // Skip newlines
      if (this.match(context, TokenType.NEWLINE)) {
        continue;
      }
      
      const statement = this.parseStatement(context);
      if (statement) {
        body.push(statement);
      }
    }
    
    return {
      type: 'BlockStatement',
      body,
      location: startLocation
    };
  }

  /**
   * Helper method to parse variable declaration from context (used by both standalone and class parsing)
   */
  private parseVariableDeclarationFromContext(
    context: ParseContext,
    name: string,
    hasReactiveSuffix: boolean,
    typeAnnotation: TypeAnnotationNode | undefined,
    startLocation: SourceLocation
  ): VariableDeclarationNode | ReactiveVariableNode {
    // Parse initializer
    const initializer = this.parseExpression(context);

    // Optional semicolon
    if (this.check(context, TokenType.SEMICOLON)) {
      this.advance(context);
    }

    // Use enhanced type inference engine
    const inferenceResult = this.typeInferenceEngine.inferType(initializer);
    const inferredType = inferenceResult.inferredType;

    // Validate type annotation if present
    if (typeAnnotation) {
      const validationResult = this.typeInferenceEngine.validateTypeAnnotation(
        typeAnnotation,
        inferredType,
        name
      );
      
      if (!validationResult.isValid) {
        const conflicts = validationResult.conflicts.map(c => c.message).join(', ');
        throw new Error(`Type validation failed for variable '${name}': ${conflicts}`);
      }
    }

    // Register variable type for future reference
    this.typeInferenceEngine.registerVariable(name, inferredType);

    // Create base variable declaration
    const baseDeclaration = {
      type: 'VariableDeclaration' as const,
      name,
      hasDollarPrefix: true,
      hasReactiveSuffix,
      typeAnnotation,
      initializer,
      inferredType,
      scope: 'local' as const,
      isReactive: hasReactiveSuffix,
      location: startLocation
    };

    // If reactive, add dependency tracking metadata
    if (hasReactiveSuffix) {
      return {
        ...baseDeclaration,
        updateTriggers: this.analyzeUpdateTriggers(name, initializer),
        dependencies: this.analyzeDependencies(initializer)
      };
    }

    return baseDeclaration;
  }

  /**
   * Helper methods for parsing utilities
   */
  private isAtEnd(context: ParseContext): boolean {
    return this.peek(context).type === TokenType.EOF;
  }

  private peek(context: ParseContext): Token {
    return context.tokens[context.current];
  }

  private previous(context: ParseContext): Token {
    return context.tokens[context.current - 1];
  }

  private advance(context: ParseContext): Token {
    if (!this.isAtEnd(context)) context.current++;
    return this.previous(context);
  }

  private check(context: ParseContext, type: TokenType): boolean {
    if (this.isAtEnd(context)) return false;
    return this.peek(context).type === type;
  }

  private checkIdentifier(context: ParseContext, value: string): boolean {
    if (this.isAtEnd(context)) return false;
    return this.peek(context).type === TokenType.IDENTIFIER && this.peek(context).value === value;
  }

  private match(context: ParseContext, ...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(context, type)) {
        this.advance(context);
        return true;
      }
    }
    return false;
  }

  private consume(context: ParseContext, type: TokenType, message: string): Token {
    if (this.check(context, type)) return this.advance(context);
    
    const current = this.peek(context);
    throw new Error(`${message} at line ${current.location.line}, column ${current.location.column}. Got: ${current.value}`);
  }

  /**
   * Parse parameter list for functions
   */
  private parseParameterList(context: ParseContext): any[] {
    const parameters: any[] = [];
    
    if (this.check(context, TokenType.RPAREN)) {
      return parameters;
    }
    
    do {
      const paramStartLocation = this.peek(context).location;
      
      // Get parameter name
      const nameToken = this.consume(context, TokenType.IDENTIFIER, "Expected parameter name");
      const name = nameToken.value;
      
      // Check for type annotation
      let typeAnnotation: TypeAnnotationNode | undefined;
      if (this.check(context, TokenType.COLON)) {
        this.advance(context); // consume :
        typeAnnotation = this.parseTypeAnnotation(context);
      }
      
      // Check for default value
      let defaultValue: ExpressionNode | undefined;
      if (this.check(context, TokenType.EQUALS)) {
        this.advance(context); // consume =
        defaultValue = this.parseExpression(context);
      }
      
      parameters.push({
        type: 'Parameter',
        name,
        typeAnnotation,
        defaultValue,
        location: paramStartLocation
      });
      
    } while (this.match(context, TokenType.COMMA));
    
    return parameters;
  }

  /**
   * Parse function body
   */
  private parseFunctionBody(context: ParseContext): any {
    const startLocation = this.peek(context).location;
    
    // Check if it's a block statement or expression
    if (this.check(context, TokenType.LBRACE)) {
      this.advance(context); // consume {
      const body = this.parseBlockStatement(context);
      this.consume(context, TokenType.RBRACE, "Expected '}' after function body");
      return body;
    } else {
      // Expression body
      const expression = this.parseExpression(context);
      return {
        type: 'BlockStatement',
        body: [{
          type: 'ReturnStatement',
          argument: expression,
          location: startLocation
        }],
        location: startLocation
      };
    }
  }

  /**
   * Create literal node from token
   */
  private createLiteralNode(token: Token): LiteralNode {
    let value: string | number | boolean | null;
    
    if (token.value === 'true') {
      value = true;
    } else if (token.value === 'false') {
      value = false;
    } else if (token.value === 'null') {
      value = null;
    } else if (token.value.startsWith('"') || token.value.startsWith("'") || token.value.startsWith('`')) {
      // String literal - remove quotes
      value = token.value.slice(1, -1);
    } else if (/^\d+$/.test(token.value)) {
      // Integer
      value = parseInt(token.value, 10);
    } else if (/^\d+\.\d+$/.test(token.value)) {
      // Float
      value = parseFloat(token.value);
    } else {
      // Default to string
      value = token.value;
    }
    
    return {
      type: 'Literal',
      value,
      raw: token.value,
      location: token.location
    };
  }

  /**
   * Infer parameter types for functions
   */
  private inferParameterTypes(parameters: any[]): any[] {
    return parameters.map(param => {
      let inferredType: TypeInfo;
      
      if (param.typeAnnotation) {
        inferredType = this.convertTypeAnnotationToTypeInfo(param.typeAnnotation);
      } else if (param.defaultValue) {
        const inferenceResult = this.typeInferenceEngine.inferType(param.defaultValue);
        inferredType = inferenceResult.inferredType;
      } else {
        inferredType = { baseType: 'any', nullable: true };
      }
      
      return {
        ...param,
        inferredType
      };
    });
  }

  /**
   * Infer return type from function body
   */
  private inferReturnType(body: any, isAsync: boolean): TypeInfo {
    // Simplified return type inference
    // In a full implementation, we'd analyze the body for return statements
    
    if (isAsync) {
      return {
        baseType: 'object',
        nullable: false,
        generic: [{ baseType: 'any', nullable: true }]
      };
    }
    
    return { baseType: 'any', nullable: true };
  }

  /**
   * Convert type annotation to type info
   */
  private convertTypeAnnotationToTypeInfo(annotation: TypeAnnotationNode): TypeInfo {
    const baseType = annotation.baseType as TypeInfo['baseType'];
    
    return {
      baseType: baseType === 'function' ? 'function' : baseType,
      nullable: false,
      generic: annotation.generics?.map(g => this.convertTypeAnnotationToTypeInfo(g)),
      parameters: annotation.parameters?.map(p => this.convertTypeAnnotationToTypeInfo(p)),
      returnType: annotation.returnType ? this.convertTypeAnnotationToTypeInfo(annotation.returnType) : undefined
    };
  }

  /**
   * Analyze update triggers for reactive variables
   */
  private analyzeUpdateTriggers(name: string, initializer: ExpressionNode): string[] {
    // Simplified analysis - in a full implementation we'd analyze the AST
    return [
      `ui-element-${name}`,
      `template-binding-${name}`
    ];
  }

  /**
   * Analyze dependencies for reactive variables
   */
  private analyzeDependencies(initializer: ExpressionNode): string[] {
    const dependencies: string[] = [];
    
    // Recursively analyze the initializer expression to find variable references
    this.extractVariableDependencies(initializer, dependencies);
    
    return dependencies;
  }

  /**
   * Extract variable dependencies from an expression
   */
  private extractVariableDependencies(expression: ExpressionNode, dependencies: string[]): void {
    if (expression.type === 'Identifier') {
      const identifier = expression as IdentifierNode;
      // Only track $ prefixed variables as dependencies
      if (identifier.name.startsWith('$')) {
        const varName = identifier.name.substring(1); // Remove $ prefix
        if (!dependencies.includes(varName)) {
          dependencies.push(varName);
        }
      }
    }
    // For more complex expressions (CallExpression, MemberExpression, etc.)
    // we would recursively analyze their sub-expressions
    // This is a simplified implementation for the current scope
  }



  /**
   * Parse variable declaration from existing context (refactored from parseVariableDeclaration)
   */
  private parseVariableDeclarationFromContext(
    context: ParseContext,
    name: string,
    hasReactiveSuffix: boolean,
    typeAnnotation: TypeAnnotationNode | undefined,
    startLocation: SourceLocation
  ): VariableDeclarationNode | ReactiveVariableNode {
    // Parse initializer
    const initializer = this.parseExpression(context);

    // Check for explicit semicolon
    let hasExplicitSemicolon = false;
    if (this.check(context, TokenType.SEMICOLON)) {
      hasExplicitSemicolon = true;
      this.advance(context);
    }

    // Use enhanced type inference engine
    const inferenceResult = this.typeInferenceEngine.inferType(initializer);
    const inferredType = inferenceResult.inferredType;

    // Validate type annotation if present
    if (typeAnnotation) {
      const validationResult = this.typeInferenceEngine.validateTypeAnnotation(
        typeAnnotation,
        inferredType,
        name
      );
      
      if (!validationResult.isValid) {
        const conflicts = validationResult.conflicts.map(c => c.message).join(', ');
        throw new Error(`Type validation failed for variable '${name}': ${conflicts}`);
      }
    }

    // Register variable type for future reference
    this.typeInferenceEngine.registerVariable(name, inferredType);

    // Create base variable declaration
    const baseDeclaration = {
      type: 'VariableDeclaration' as const,
      name,
      hasDollarPrefix: true,
      hasReactiveSuffix,
      typeAnnotation,
      initializer,
      inferredType,
      scope: 'local' as const,
      isReactive: hasReactiveSuffix,
      location: startLocation,
      hasExplicitSemicolon
    };

    // If reactive, add dependency tracking metadata
    if (hasReactiveSuffix) {
      return {
        ...baseDeclaration,
        updateTriggers: this.analyzeUpdateTriggers(name, initializer),
        dependencies: this.analyzeDependencies(initializer)
      };
    }

    return baseDeclaration;
  }

  /**
   * Check if current token is a specific identifier
   */
  private checkIdentifier(context: ParseContext, identifier: string): boolean {
    const token = this.peek(context);
    return token.type === TokenType.IDENTIFIER && token.value === identifier;
  }

  /**
   * Parse parameter list for functions
   */
  private parseParameterList(context: ParseContext): any[] {
    const parameters: any[] = [];

    // Handle empty parameter list
    if (this.check(context, TokenType.RPAREN)) {
      return parameters;
    }

    do {
      const param = this.parseParameter(context);
      parameters.push(param);
    } while (this.match(context, TokenType.COMMA));

    return parameters;
  }

  /**
   * Parse a single parameter
   */
  private parseParameter(context: ParseContext): any {
    const location = this.peek(context).location;
    const nameToken = this.consume(context, TokenType.IDENTIFIER, "Expected parameter name");
    const name = nameToken.value;

    // Check for type annotation
    let typeAnnotation: TypeAnnotationNode | undefined;
    if (this.check(context, TokenType.COLON)) {
      this.advance(context); // consume :
      typeAnnotation = this.parseTypeAnnotation(context);
    }

    // Check for default value
    let defaultValue: ExpressionNode | undefined;
    if (this.check(context, TokenType.EQUALS)) {
      this.advance(context); // consume =
      defaultValue = this.parseExpression(context);
    }

    return {
      type: 'Parameter',
      name,
      typeAnnotation,
      defaultValue,
      location
    };
  }

  /**
   * Parse function body (block statement or expression)
   */
  private parseFunctionBody(context: ParseContext): any {
    if (this.check(context, TokenType.LBRACE)) {
      // Block statement body
      return this.parseBlockStatement(context);
    } else {
      // Expression body (arrow function shorthand)
      const expression = this.parseExpression(context);
      return {
        type: 'BlockStatement',
        body: [{
          type: 'ReturnStatement',
          argument: expression,
          location: expression.location
        }],
        location: expression.location
      };
    }
  }

  /**
   * Parse block statement
   */
  private parseBlockStatement(context: ParseContext): any {
    const location = this.peek(context).location;
    this.consume(context, TokenType.LBRACE, "Expected '{'");

    const body: any[] = [];
    while (!this.check(context, TokenType.RBRACE) && !this.isAtEnd(context)) {
      // Skip newlines
      if (this.match(context, TokenType.NEWLINE)) {
        continue;
      }

      // For now, parse simple statements in block bodies
      // This is a simplified implementation to get function parsing working
      if (this.check(context, TokenType.DOLLAR)) {
        const statement = this.parseStatement(context);
        if (statement) {
          body.push(statement);
        }
      } else {
        // If we can't parse a statement, consume tokens until we find a delimiter
        const tokens: Token[] = [];
        while (!this.isAtEnd(context) && 
               !this.check(context, TokenType.SEMICOLON) &&
               !this.check(context, TokenType.NEWLINE) &&
               !this.check(context, TokenType.RBRACE)) {
          tokens.push(this.advance(context));
        }
        
        if (tokens.length > 0) {
          // Create a simple statement from the tokens
          body.push({
            type: 'ExpressionStatement',
            expression: {
              type: 'Literal',
              value: tokens.map(t => t.value).join(' '),
              raw: tokens.map(t => t.value).join(' '),
              location: tokens[0].location
            },
            location: tokens[0].location
          });
        }
        
        // Consume optional semicolon
        if (this.check(context, TokenType.SEMICOLON)) {
          this.advance(context);
        }
      }
    }

    this.consume(context, TokenType.RBRACE, "Expected '}'");

    return {
      type: 'BlockStatement',
      body,
      location
    };
  }

  /**
   * Infer parameter types for functions
   */
  private inferParameterTypes(parameters: any[]): any[] {
    return parameters.map(param => {
      let inferredType: TypeInfo;

      if (param.typeAnnotation) {
        // Use explicit type annotation
        inferredType = this.convertTypeAnnotationToTypeInfo(param.typeAnnotation);
      } else if (param.defaultValue) {
        // Infer from default value
        const inferenceResult = this.typeInferenceEngine.inferType(param.defaultValue);
        inferredType = inferenceResult.inferredType;
      } else {
        // No type information available
        inferredType = { baseType: 'any', nullable: false };
      }

      return {
        ...param,
        inferredType
      };
    });
  }

  /**
   * Infer return type from function body
   */
  private inferReturnType(body: any, isAsync: boolean): TypeInfo {
    // For now, return a basic inference
    // In a full implementation, this would analyze return statements in the body
    if (isAsync) {
      return {
        baseType: 'object', // Promise<T>
        nullable: false,
        generic: [{ baseType: 'any', nullable: false }]
      };
    }

    return { baseType: 'any', nullable: false };
  }

  /**
   * Convert TypeAnnotationNode to TypeInfo
   */
  private convertTypeAnnotationToTypeInfo(annotation: TypeAnnotationNode): TypeInfo {
    return {
      baseType: annotation.baseType as any,
      nullable: false,
      generic: annotation.generics?.map(g => this.convertTypeAnnotationToTypeInfo(g)),
      properties: annotation.properties ? 
        Object.fromEntries(
          Object.entries(annotation.properties).map(([key, value]) => 
            [key, this.convertTypeAnnotationToTypeInfo(value)]
          )
        ) : undefined,
      parameters: annotation.parameters?.map(p => this.convertTypeAnnotationToTypeInfo(p)),
      returnType: annotation.returnType ? this.convertTypeAnnotationToTypeInfo(annotation.returnType) : undefined
    };
  }

  /**
   * Token parsing utilities
   */
  private isAtEnd(context: ParseContext): boolean {
    return this.peek(context).type === TokenType.EOF;
  }

  private peek(context: ParseContext): Token {
    return context.tokens[context.current] || { type: TokenType.EOF, value: '', location: { line: 0, column: 0, index: 0 } };
  }

  private advance(context: ParseContext): Token {
    if (!this.isAtEnd(context)) {
      context.current++;
    }
    return this.previous(context);
  }

  private previous(context: ParseContext): Token {
    return context.tokens[context.current - 1];
  }

  private check(context: ParseContext, type: TokenType): boolean {
    if (this.isAtEnd(context)) return false;
    return this.peek(context).type === type;
  }

  private match(context: ParseContext, ...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(context, type)) {
        this.advance(context);
        return true;
      }
    }
    return false;
  }

  private consume(context: ParseContext, type: TokenType, message: string): Token {
    if (this.check(context, type)) {
      return this.advance(context);
    }
    
    const current = this.peek(context);
    throw new Error(`${message}. Got '${current.value}' at line ${current.location.line}, column ${current.location.column}`);
  }

  /**
   * Extract frontmatter and content from file content (same as original parser)
   */
  private extractFrontmatter(fileContent: string): { frontmatter: any; content: string } {
    const lines = fileContent.split('\n');
    
    // Check if file starts with frontmatter delimiter
    if (lines[0]?.trim() !== EnhancedMTMParser.FRONTMATTER_DELIMITER) {
      throw new Error('MTM file must start with YAML frontmatter delimited by "---"');
    }

    // Find the closing delimiter
    let closingDelimiterIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.trim() === EnhancedMTMParser.FRONTMATTER_DELIMITER) {
        closingDelimiterIndex = i;
        break;
      }
    }

    if (closingDelimiterIndex === -1) {
      throw new Error('MTM file frontmatter must be closed with "---"');
    }

    // Extract frontmatter YAML
    const frontmatterLines = lines.slice(1, closingDelimiterIndex);
    const frontmatterYaml = frontmatterLines.join('\n');
    
    // Extract content after frontmatter
    const contentLines = lines.slice(closingDelimiterIndex + 1);
    const content = contentLines.join('\n');

    try {
      const frontmatter = parseYaml(frontmatterYaml);
      return { frontmatter, content };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Invalid YAML in frontmatter: ${error.message}`);
      }
      throw new Error('Invalid YAML in frontmatter');
    }
  }
}
