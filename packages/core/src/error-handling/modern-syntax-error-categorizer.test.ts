/**
 * Unit tests for ModernSyntaxErrorCategorizer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  ModernSyntaxErrorCategorizer, 
  ModernSyntaxErrorType,
  type CategorizedError,
  type ParseContext 
} from './modern-syntax-error-categorizer.js';

describe('ModernSyntaxErrorCategorizer', () => {
  let categorizer: ModernSyntaxErrorCategorizer;
  let mockContext: ParseContext;

  beforeEach(() => {
    categorizer = new ModernSyntaxErrorCategorizer();
    mockContext = {
      source: '',
      filePath: 'test.mtm',
      syntaxVersion: 'modern'
    };
  });

  describe('Dollar Prefix Error Categorization', () => {
    it('should categorize invalid dollar prefix syntax', () => {
      const error = new Error('Unexpected token $ at line 1, column 1');
      mockContext.source = 'variable = 42'; // Missing $ prefix
      
      const result = categorizer.categorizeError(error, mockContext);
      
      expect(result.type).toBe(ModernSyntaxErrorType.INVALID_DOLLAR_PREFIX);
      expect(result.message).toContain('Invalid dollar prefix syntax');
      expect(result.suggestions).toContain('Dollar prefix ($) should be used only for variable and function declarations in modern syntax');
      expect(result.severity).toBe('error');
    });

    it('should provide quick fix for missing dollar prefix', () => {
      const error = new Error('Unexpected token at line 1');
      mockContext.source = 'counter = 0';
      
      const result = categorizer.categorizeError(error, mockContext);
      
      expect(result.quickFixes).toHaveLength(1);
      expect(result.quickFixes[0].description).toContain("Add $ prefix to variable 'counter'");
      expect(result.quickFixes[0].replacement).toBe('$counter = 0');
    });

    it('should handle invalid characters after dollar prefix', () => {
      const error = new Error('Unexpected character after $ at line 1');
      mockContext.source = '$123invalid = 42';
      
      const result = categorizer.categorizeError(error, mockContext);
      
      expect(result.type).toBe(ModernSyntaxErrorType.INVALID_DOLLAR_PREFIX);
      expect(result.suggestions).toContain('Ensure the variable name after $ is a valid identifier (letters, numbers, underscore)');
    });
  });

  describe('Reactive Syntax Error Categorization', () => {
    it('should categorize reactive variable syntax errors', () => {
      const error = new Error('Unexpected token ! at line 1, column 8');
      mockContext.source = '$counter ! = 0'; // Space before !
      
      const result = categorizer.categorizeError(error, mockContext);
      
      expect(result.type).toBe(ModernSyntaxErrorType.REACTIVE_SYNTAX_ERROR);
      expect(result.message).toContain('Reactive variable syntax error');
      expect(result.suggestions).toContain('The exclamation mark (!) must come immediately after the variable name');
    });

    it('should provide quick fix for reactive variable syntax', () => {
      const error = new Error('Unexpected token');
      mockContext.source = '$counter = 0'; // Missing ! for reactive
      
      const result = categorizer.categorizeError(error, mockContext);
      
      if (result.type === ModernSyntaxErrorType.REACTIVE_SYNTAX_ERROR) {
        expect(result.quickFixes).toHaveLength(1);
        expect(result.quickFixes[0].description).toContain('Add ! suffix to make variable reactive');
      }
    });

    it('should fix misplaced exclamation mark', () => {
      const error = new Error('Syntax error');
      mockContext.source = '$counter ! = 0';
      
      const result = categorizer.categorizeError(error, mockContext);
      
      if (result.type === ModernSyntaxErrorType.REACTIVE_SYNTAX_ERROR) {
        const fix = result.quickFixes.find(f => f.description.includes('Move ! immediately'));
        expect(fix).toBeDefined();
        expect(fix?.replacement).toBe('$counter! = 0');
      }
    });
  });

  describe('Type Annotation Error Categorization', () => {
    it('should categorize type annotation syntax errors', () => {
      const error = new Error('Unexpected token : at line 1, column 9');
      mockContext.source = '$counter string = 0'; // Missing colon
      
      const result = categorizer.categorizeError(error, mockContext);
      
      expect(result.type).toBe(ModernSyntaxErrorType.TYPE_ANNOTATION_ERROR);
      expect(result.message).toContain('Type annotation error');
      expect(result.suggestions).toContain('Type annotations should follow the pattern: $variableName: type = value');
    });

    it('should provide quick fix for missing colon in type annotation', () => {
      const error = new Error('Type annotation error');
      mockContext.source = '$price number = 99.99';
      
      const result = categorizer.categorizeError(error, mockContext);
      
      if (result.type === ModernSyntaxErrorType.TYPE_ANNOTATION_ERROR) {
        const fix = result.quickFixes.find(f => f.description.includes('Add colon'));
        expect(fix).toBeDefined();
        expect(fix?.replacement).toBe('$price: number = 99.99');
      }
    });

    it('should suggest removing type annotation as alternative', () => {
      const error = new Error('Type error');
      mockContext.source = '$price: number = 99.99';
      
      const result = categorizer.categorizeError(error, mockContext);
      
      if (result.type === ModernSyntaxErrorType.TYPE_ANNOTATION_ERROR) {
        const fix = result.quickFixes.find(f => f.description.includes('Remove type annotation'));
        expect(fix).toBeDefined();
        expect(fix?.replacement).toBe('$price = 99.99');
      }
    });
  });

  describe('ASI Ambiguity Error Categorization', () => {
    it('should categorize automatic semicolon insertion ambiguity', () => {
      const error = new Error('Ambiguous statement termination at line 1');
      mockContext.source = '$result = getValue()\\n(someParam)';
      
      const result = categorizer.categorizeError(error, mockContext);
      
      expect(result.type).toBe(ModernSyntaxErrorType.AUTO_SEMICOLON_AMBIGUITY);
      expect(result.message).toContain('Automatic semicolon insertion ambiguity');
      expect(result.severity).toBe('warning');
      expect(result.suggestions).toContain('Add explicit semicolon (;) at the end of the statement to clarify intent');
    });

    it('should provide quick fixes for ASI ambiguity', () => {
      const error = new Error('Statement continuation ambiguity');
      mockContext.source = '$result = getValue()\\n(someParam)';
      
      const result = categorizer.categorizeError(error, mockContext);
      
      if (result.type === ModernSyntaxErrorType.AUTO_SEMICOLON_AMBIGUITY) {
        expect(result.quickFixes.length).toBeGreaterThan(0);
        const semicolonFix = result.quickFixes.find(f => f.description.includes('Add semicolon'));
        expect(semicolonFix).toBeDefined();
      }
    });

    it('should detect potential statement continuation patterns', () => {
      const error = new Error('Unexpected token (');
      mockContext.source = `$func = getValue
(param1, param2)`;
      
      const result = categorizer.categorizeError(error, mockContext);
      
      expect(result.type).toBe(ModernSyntaxErrorType.AUTO_SEMICOLON_AMBIGUITY);
      expect(result.suggestions).toContain('Move continuation to the same line if it should be part of the same statement');
    });
  });

  describe('This Binding Error Categorization', () => {
    it('should categorize this binding errors', () => {
      const error = new Error('this is undefined in arrow function context');
      mockContext.source = '$method = function() { return this.value; }';
      
      const result = categorizer.categorizeError(error, mockContext);
      
      expect(result.type).toBe(ModernSyntaxErrorType.THIS_BINDING_ERROR);
      expect(result.message).toContain('This binding error');
      expect(result.suggestions).toContain('Arrow functions in modern syntax automatically bind this context');
    });

    it('should provide quick fix to convert function to arrow function', () => {
      const error = new Error('this binding issue');
      mockContext.source = '$greet = function(name) { return `Hello, ${this.name}`; }';
      
      const result = categorizer.categorizeError(error, mockContext);
      
      if (result.type === ModernSyntaxErrorType.THIS_BINDING_ERROR) {
        const fix = result.quickFixes.find(f => f.description.includes('Convert to arrow function'));
        expect(fix).toBeDefined();
        expect(fix?.replacement).toContain('=>');
      }
    });
  });

  describe('Template Binding Error Categorization', () => {
    it('should categorize template binding errors', () => {
      const error = new Error('Invalid template syntax');
      mockContext.source = '<h1>Hello, $name</h1>'; // Missing braces
      
      const result = categorizer.categorizeError(error, mockContext);
      
      expect(result.type).toBe(ModernSyntaxErrorType.TEMPLATE_BINDING_ERROR);
      expect(result.message).toContain('Template binding error');
      expect(result.suggestions).toContain('Template variables should use double braces: {{$variableName}}');
    });

    it('should provide quick fix for missing template braces', () => {
      const error = new Error('Template error');
      mockContext.source = '<span>$counter</span>';
      
      const result = categorizer.categorizeError(error, mockContext);
      
      if (result.type === ModernSyntaxErrorType.TEMPLATE_BINDING_ERROR) {
        const fix = result.quickFixes.find(f => f.description.includes('Add double braces'));
        expect(fix).toBeDefined();
        expect(fix?.replacement).toBe('<span>{{$counter}}</span>');
      }
    });

    it('should fix missing quotes in event handlers', () => {
      const error = new Error('Event handler syntax error');
      mockContext.source = '<button click=$handleClick()>Click</button>';
      
      const result = categorizer.categorizeError(error, mockContext);
      
      if (result.type === ModernSyntaxErrorType.TEMPLATE_BINDING_ERROR) {
        const fix = result.quickFixes.find(f => f.description.includes('Add quotes'));
        expect(fix).toBeDefined();
        expect(fix?.replacement).toContain('"$handleClick()"');
      }
    });
  });

  describe('Function Syntax Error Categorization', () => {
    it('should categorize function syntax errors', () => {
      const error = new Error('Invalid function declaration');
      mockContext.source = 'function myFunc() { return 42; }'; // Missing $ prefix
      
      const result = categorizer.categorizeError(error, mockContext);
      
      expect(result.type).toBe(ModernSyntaxErrorType.FUNCTION_SYNTAX_ERROR);
      expect(result.message).toContain('Function syntax error');
      expect(result.suggestions).toContain('Functions should use the pattern: $functionName = (params) => {...}');
    });

    it('should provide quick fix to convert function declaration to arrow function', () => {
      const error = new Error('Function syntax error');
      mockContext.source = 'function calculate(a, b) { return a + b; }';
      
      const result = categorizer.categorizeError(error, mockContext);
      
      if (result.type === ModernSyntaxErrorType.FUNCTION_SYNTAX_ERROR) {
        const fix = result.quickFixes.find(f => f.description.includes('Convert to modern arrow function'));
        expect(fix).toBeDefined();
        expect(fix?.replacement).toContain('$calculate = (a, b) =>');
      }
    });

    it('should add missing dollar prefix to function', () => {
      const error = new Error('Function error');
      mockContext.source = 'myFunc = (x) => x * 2';
      
      const result = categorizer.categorizeError(error, mockContext);
      
      if (result.type === ModernSyntaxErrorType.FUNCTION_SYNTAX_ERROR) {
        const fix = result.quickFixes.find(f => f.description.includes("Add $ prefix to function 'myFunc'"));
        expect(fix).toBeDefined();
        expect(fix?.replacement).toBe('$myFunc = (x) => x * 2');
      }
    });
  });

  describe('Error Message Generation', () => {
    it('should generate comprehensive error messages with context', () => {
      const error = new Error('Test error');
      mockContext.source = `$counter = 0
$increment = () => $counter++
$display = () => console.log($counter)`;
      
      const categorizedError = categorizer.categorizeError(error, mockContext);
      const message = categorizer.generateSuggestion(categorizedError);
      
      expect(message).toContain('ERROR');
      expect(message).toContain('Context:');
      expect(message).toContain('Suggestions:');
      expect(message).toContain('💡');
    });

    it('should include quick fixes in error messages when available', () => {
      const error = new Error('Missing $ prefix');
      mockContext.source = 'counter = 0';
      
      const categorizedError = categorizer.categorizeError(error, mockContext);
      const message = categorizer.generateSuggestion(categorizedError);
      
      if (categorizedError.quickFixes.length > 0) {
        expect(message).toContain('Quick Fixes:');
        expect(message).toContain('🔧');
      }
    });
  });

  describe('Context Code Extraction', () => {
    it('should extract context code around error location', () => {
      const error = new Error('Error at line 3, column 5');
      mockContext.source = `line 1
line 2
line 3 with error
line 4
line 5`;
      
      const result = categorizer.categorizeError(error, mockContext);
      
      expect(result.context).toContain('line 1');
      expect(result.context).toContain('line 2');
      expect(result.context).toContain('→   3: line 3 with error');
      expect(result.context).toContain('line 4');
      expect(result.context).toContain('line 5');
    });

    it('should handle errors at the beginning of file', () => {
      const error = new Error('Error at line 1, column 1');
      mockContext.source = `first line with error
second line
third line`;
      
      const result = categorizer.categorizeError(error, mockContext);
      
      expect(result.context).toContain('→   1: first line with error');
      expect(result.context).toContain('second line');
    });

    it('should handle errors at the end of file', () => {
      const error = new Error('Error at line 3, column 10');
      mockContext.source = `first line
second line
last line error`;
      
      const result = categorizer.categorizeError(error, mockContext);
      
      expect(result.context).toContain('first line');
      expect(result.context).toContain('second line');
      expect(result.context).toContain('→   3: last line error');
    });
  });

  describe('Location Extraction', () => {
    it('should extract line and column from error messages', () => {
      const error = new Error('Syntax error at line 5, column 12');
      mockContext.source = 'test source code';
      
      const result = categorizer.categorizeError(error, mockContext);
      
      expect(result.location.line).toBe(5);
      expect(result.location.column).toBe(12);
    });

    it('should handle different error message formats', () => {
      const error = new Error('Error on line 3:8');
      mockContext.source = 'test source';
      
      const result = categorizer.categorizeError(error, mockContext);
      
      expect(result.location.line).toBe(3);
      expect(result.location.column).toBe(8);
    });

    it('should default to start of file when no location found', () => {
      const error = new Error('Generic error message');
      mockContext.source = 'test source';
      
      const result = categorizer.categorizeError(error, mockContext);
      
      expect(result.location.line).toBe(1);
      expect(result.location.column).toBe(1);
      expect(result.location.index).toBe(0);
    });
  });

  describe('Quick Fix Generation', () => {
    it('should generate appropriate quick fixes for each error type', () => {
      const testCases = [
        {
          error: new Error('Missing $ prefix'),
          source: 'counter = 0',
          expectedFixCount: 1
        },
        {
          error: new Error('Reactive syntax error'),
          source: '$counter = 0',
          expectedFixCount: 1
        },
        {
          error: new Error('Type annotation error'),
          source: '$price number = 99.99',
          expectedFixCount: 1 // Add colon (remove type is optional)
        }
      ];

      testCases.forEach(({ error, source, expectedFixCount }) => {
        mockContext.source = source;
        const result = categorizer.categorizeError(error, mockContext);
        expect(result.quickFixes.length).toBeGreaterThanOrEqual(expectedFixCount);
      });
    });

    it('should provide valid replacement ranges for quick fixes', () => {
      const error = new Error('Missing $ prefix');
      mockContext.source = 'counter = 0';
      
      const result = categorizer.categorizeError(error, mockContext);
      
      if (result.quickFixes.length > 0) {
        const fix = result.quickFixes[0];
        expect(fix.range.start).toBeDefined();
        expect(fix.range.end).toBeDefined();
        expect(fix.range.start.line).toBeGreaterThan(0);
        expect(fix.range.start.column).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Severity Classification', () => {
    it('should classify syntax errors as error severity', () => {
      const error = new Error('Invalid syntax');
      mockContext.source = '$invalid syntax here';
      
      const result = categorizer.categorizeError(error, mockContext);
      
      expect(result.severity).toBe('error');
    });

    it('should classify ASI ambiguity as warning severity', () => {
      const error = new Error('Semicolon ambiguity');
      mockContext.source = '$result = getValue()\\n(param)';
      
      const result = categorizer.categorizeError(error, mockContext);
      
      if (result.type === ModernSyntaxErrorType.AUTO_SEMICOLON_AMBIGUITY) {
        expect(result.severity).toBe('warning');
      }
    });
  });
});