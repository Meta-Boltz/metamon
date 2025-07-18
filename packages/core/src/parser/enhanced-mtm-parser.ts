import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import type { MTMFile, ValidationResult, FileParser } from '../types/mtm-file.js';
import type { 
  UnifiedAST, 
  VariableDeclarationNode, 
  ExpressionNode, 
  LiteralNode, 
  IdentifierNode,
  TypeAnnotationNode,
  TypeInfo,
  SourceLocation,
  ModernAST
} from '../types/unified-ast.js';

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
  WHITESPACE = 'WHITESPACE'
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
 * Enhanced parser for .mtm files that can detect and handle both legacy and modern syntax
 */
export class EnhancedMTMParser implements FileParser {
  private static readonly FRONTMATTER_DELIMITER = '---';
  private static readonly SUPPORTED_TARGETS = ['reactjs', 'vue', 'solid', 'svelte'] as const;

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
   * Parse statements from token stream
   */
  private parseStatements(context: ParseContext): any[] {
    const statements: any[] = [];

    while (!this.isAtEnd(context)) {
      // Skip newlines
      if (this.match(context, TokenType.NEWLINE)) {
        continue;
      }

      const statement = this.parseStatement(context);
      if (statement) {
        statements.push(statement);
      }
    }

    return statements;
  }

  /**
   * Parse a single statement
   */
  private parseStatement(context: ParseContext): any {
    // Check for variable declaration with $ prefix
    if (this.check(context, TokenType.DOLLAR)) {
      return this.parseVariableDeclaration(context);
    }

    // Skip other statements for now
    this.advance(context);
    return null;
  }

  /**
   * Parse variable declaration with $ prefix
   */
  private parseVariableDeclaration(context: ParseContext): VariableDeclarationNode {
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

    // Infer type from initializer if no explicit type
    const inferredType = this.inferType(initializer);

    return {
      type: 'VariableDeclaration',
      name,
      hasDollarPrefix: true,
      hasReactiveSuffix,
      typeAnnotation,
      initializer,
      inferredType,
      scope: 'local',
      isReactive: hasReactiveSuffix,
      location: startLocation
    };
  }

  /**
   * Parse type annotation
   */
  private parseTypeAnnotation(context: ParseContext): TypeAnnotationNode {
    const location = this.peek(context).location;
    const typeToken = this.consume(context, TokenType.IDENTIFIER, "Expected type name");
    
    return {
      type: 'TypeAnnotation',
      typeKind: 'primitive',
      baseType: typeToken.value,
      location
    };
  }

  /**
   * Parse expression
   */
  private parseExpression(context: ParseContext): ExpressionNode {
    return this.parsePrimary(context);
  }

  /**
   * Parse primary expression (literals, identifiers)
   */
  private parsePrimary(context: ParseContext): ExpressionNode {
    const token = this.peek(context);

    if (token.type === TokenType.LITERAL) {
      this.advance(context);
      return this.createLiteralNode(token);
    }

    if (token.type === TokenType.IDENTIFIER) {
      this.advance(context);
      return {
        type: 'Identifier',
        name: token.value,
        location: token.location
      } as IdentifierNode;
    }

    throw new Error(`Unexpected token: ${token.value} at line ${token.location.line}`);
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
    } else if (/^\d+(\.\d+)?$/.test(token.value)) {
      value = parseFloat(token.value);
    } else if (token.value.startsWith('"') || token.value.startsWith("'") || token.value.startsWith('`')) {
      value = token.value.slice(1, -1); // Remove quotes
    } else {
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
   * Infer type from expression
   */
  private inferType(expression: ExpressionNode): TypeInfo {
    if (expression.type === 'Literal') {
      const literal = expression as LiteralNode;
      if (typeof literal.value === 'string') {
        return { baseType: 'string', nullable: false };
      } else if (typeof literal.value === 'number') {
        // Check if it's a float
        const isFloat = literal.raw.includes('.');
        return { baseType: isFloat ? 'float' : 'number', nullable: false };
      } else if (typeof literal.value === 'boolean') {
        return { baseType: 'boolean', nullable: false };
      } else if (literal.value === null) {
        return { baseType: 'any', nullable: true };
      }
    }

    return { baseType: 'any', nullable: false };
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
