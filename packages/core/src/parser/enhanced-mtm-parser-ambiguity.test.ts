import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedMTMParser, ASIAmbiguity } from './enhanced-mtm-parser.js';

describe('EnhancedMTMParser - ASI Ambiguity Detection', () => {
  let parser: EnhancedMTMParser;

  beforeEach(() => {
    parser = new EnhancedMTMParser();
  });

  describe('Statement Continuation Ambiguity', () => {
    it('should detect function call continuation ambiguity', () => {
      const content = `
$result = calculate()
(someValue).process()
      `.trim();

      const ambiguities = parser.checkForSemicolonAmbiguity(content);
      
      expect(ambiguities).toHaveLength(1);
      expect(ambiguities[0].type).toBe('statement_continuation');
      expect(ambiguities[0].message).toContain('may be unintentionally continued');
      expect(ambiguities[0].suggestion).toContain('Add explicit semicolon');
    });

    it('should detect array access continuation ambiguity', () => {
      const content = `
$data = getData()
[0].value
      `.trim();

      const ambiguities = parser.checkForSemicolonAmbiguity(content);
      
      expect(ambiguities).toHaveLength(1);
      expect(ambiguities[0].type).toBe('statement_continuation');
    });

    it('should detect property access continuation ambiguity', () => {
      const content = `
$obj = getObject()
.property.method()
      `.trim();

      const ambiguities = parser.checkForSemicolonAmbiguity(content);
      
      expect(ambiguities).toHaveLength(1);
      expect(ambiguities[0].type).toBe('statement_continuation');
    });

    it('should detect template literal continuation ambiguity', () => {
      const content = `
$func = getFunction()
\`template literal\`
      `.trim();

      const ambiguities = parser.checkForSemicolonAmbiguity(content);
      
      expect(ambiguities).toHaveLength(1);
      expect(ambiguities[0].type).toBe('statement_continuation');
    });

    it('should not detect ambiguity when semicolon is present', () => {
      const content = `
$result = calculate();
(someValue).process()
      `.trim();

      const ambiguities = parser.checkForSemicolonAmbiguity(content);
      
      expect(ambiguities).toHaveLength(0);
    });

    it('should not detect ambiguity when line ends with brace', () => {
      const content = `
$obj = {
  prop: value
}
(someValue).process()
      `.trim();

      const ambiguities = parser.checkForSemicolonAmbiguity(content);
      
      expect(ambiguities).toHaveLength(0);
    });
  });

  describe('Return Statement Ambiguity', () => {
    it('should detect return value ambiguity', () => {
      const content = `
return
42
      `.trim();

      const ambiguities = parser.checkForSemicolonAmbiguity(content);
      
      expect(ambiguities).toHaveLength(1);
      expect(ambiguities[0].type).toBe('return_value');
      expect(ambiguities[0].message).toContain('may be missing its value');
      expect(ambiguities[0].suggestion).toContain('Move return value to same line');
    });

    it('should detect return object ambiguity', () => {
      const content = `
return
{ value: 42 }
      `.trim();

      const ambiguities = parser.checkForSemicolonAmbiguity(content);
      
      expect(ambiguities).toHaveLength(1);
      expect(ambiguities[0].type).toBe('return_value');
    });

    it('should not detect ambiguity for return with value on same line', () => {
      const content = `
return 42
      `.trim();

      const ambiguities = parser.checkForSemicolonAmbiguity(content);
      
      expect(ambiguities).toHaveLength(0);
    });

    it('should not detect ambiguity when next line is comment', () => {
      const content = `
return
// This is a comment
      `.trim();

      const ambiguities = parser.checkForSemicolonAmbiguity(content);
      
      expect(ambiguities).toHaveLength(0);
    });

    it('should not detect ambiguity when next line is empty', () => {
      const content = `
return

      `.trim();

      const ambiguities = parser.checkForSemicolonAmbiguity(content);
      
      expect(ambiguities).toHaveLength(0);
    });
  });

  describe('Expression Split Ambiguity', () => {
    it('should detect addition operator split', () => {
      const content = `
$result = a + b
+ c + d
      `.trim();

      const ambiguities = parser.checkForSemicolonAmbiguity(content);
      
      expect(ambiguities).toHaveLength(1);
      expect(ambiguities[0].type).toBe('expression_split');
      expect(ambiguities[0].message).toContain('may be unintentionally split');
    });

    it('should detect multiplication operator split', () => {
      const content = `
$result = x * y
* z
      `.trim();

      const ambiguities = parser.checkForSemicolonAmbiguity(content);
      
      expect(ambiguities).toHaveLength(1);
      expect(ambiguities[0].type).toBe('expression_split');
    });

    it('should detect logical operator split', () => {
      const content = `
$condition = a && b
&& c
      `.trim();

      const ambiguities = parser.checkForSemicolonAmbiguity(content);
      
      expect(ambiguities).toHaveLength(1);
      expect(ambiguities[0].type).toBe('expression_split');
    });

    it('should detect comparison operator split', () => {
      const content = `
$isEqual = value1
== value2
      `.trim();

      const ambiguities = parser.checkForSemicolonAmbiguity(content);
      
      expect(ambiguities).toHaveLength(1);
      expect(ambiguities[0].type).toBe('expression_split');
    });

    it('should not detect ambiguity when line does not end with identifier', () => {
      const content = `
$result = (a + b)
+ c
      `.trim();

      const ambiguities = parser.checkForSemicolonAmbiguity(content);
      
      expect(ambiguities).toHaveLength(0);
    });
  });

  describe('Multiple Ambiguities', () => {
    it('should detect multiple different ambiguity types', () => {
      const content = `
$func = getFunction()
(param)

return
value

$result = a + b
+ c
      `.trim();

      const ambiguities = parser.checkForSemicolonAmbiguity(content);
      
      expect(ambiguities).toHaveLength(3);
      
      const types = ambiguities.map(a => a.type);
      expect(types).toContain('statement_continuation');
      expect(types).toContain('return_value');
      expect(types).toContain('expression_split');
    });

    it('should provide correct line numbers for multiple ambiguities', () => {
      const content = `
$func = getFunction()
(param)

return
value
      `.trim();

      const ambiguities = parser.checkForSemicolonAmbiguity(content);
      
      expect(ambiguities).toHaveLength(2);
      expect(ambiguities[0].location.line).toBe(1);
      expect(ambiguities[1].location.line).toBe(4);
    });
  });

  describe('Quick Fix Suggestions', () => {
    it('should provide quick fixes for statement continuation', () => {
      const ambiguity: ASIAmbiguity = {
        location: { line: 1, column: 1, index: 0 },
        type: 'statement_continuation',
        message: 'Test message',
        suggestion: 'Test suggestion'
      };

      const fixes = parser.generateQuickFixes(ambiguity);
      
      expect(fixes).toHaveLength(2);
      expect(fixes[0].description).toContain('Add semicolon');
      expect(fixes[1].description).toContain('Move continuation');
    });

    it('should provide quick fixes for return value ambiguity', () => {
      const ambiguity: ASIAmbiguity = {
        location: { line: 1, column: 1, index: 0 },
        type: 'return_value',
        message: 'Test message',
        suggestion: 'Test suggestion'
      };

      const fixes = parser.generateQuickFixes(ambiguity);
      
      expect(fixes).toHaveLength(2);
      expect(fixes[0].description).toContain('Move return value');
      expect(fixes[1].description).toContain('Add explicit semicolon');
    });

    it('should provide quick fixes for expression split ambiguity', () => {
      const ambiguity: ASIAmbiguity = {
        location: { line: 1, column: 1, index: 0 },
        type: 'expression_split',
        message: 'Test message',
        suggestion: 'Test suggestion'
      };

      const fixes = parser.generateQuickFixes(ambiguity);
      
      expect(fixes).toHaveLength(2);
      expect(fixes[0].description).toContain('Add semicolon');
      expect(fixes[1].description).toContain('Move operator');
    });
  });

  describe('Error Message Generation', () => {
    it('should generate helpful error messages', () => {
      const content = `
$func = getFunction()
(param)
      `.trim();

      parser.checkForSemicolonAmbiguity(content);
      const messages = parser.generateASIErrorMessages();
      
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain('line 1');
      expect(messages[0]).toContain('Suggestion:');
    });

    it('should include location information in error messages', () => {
      const content = `
line1
$func = getFunction()
(param)
      `.trim();

      parser.checkForSemicolonAmbiguity(content);
      const messages = parser.generateASIErrorMessages();
      
      expect(messages[0]).toContain('line 2');
    });
  });

  describe('Semicolon Usage Validation', () => {
    it('should warn about mixed semicolon usage', () => {
      const content = `
$a = 1;
$b = 2
$c = 3;
      `.trim();

      const validation = parser.validateSemicolonUsage(content);
      
      expect(validation.warnings).toContain(
        expect.stringContaining('Mixed semicolon usage detected')
      );
      expect(validation.suggestions).toContain(
        expect.stringContaining('Choose either explicit semicolons')
      );
    });

    it('should warn about potential ambiguities', () => {
      const content = `
$func = getFunction()
(param)
      `.trim();

      const validation = parser.validateSemicolonUsage(content);
      
      expect(validation.warnings).toContain(
        expect.stringContaining('potential semicolon ambiguities')
      );
    });

    it('should warn about dangerous ASI patterns', () => {
      const content = `
$func()
(param)
      `.trim();

      const validation = parser.validateSemicolonUsage(content);
      
      expect(validation.warnings).toContain(
        expect.stringContaining('dangerous ASI patterns')
      );
    });

    it('should not warn when semicolon usage is consistent', () => {
      const content = `
$a = 1;
$b = 2;
$c = 3;
      `.trim();

      const validation = parser.validateSemicolonUsage(content);
      
      expect(validation.warnings).toHaveLength(0);
    });
  });

  describe('Dangerous ASI Pattern Detection', () => {
    it('should detect function call followed by parentheses', () => {
      const content = `
$result = func()
(param)
      `.trim();

      const validation = parser.validateSemicolonUsage(content);
      
      expect(validation.warnings).toContain(
        expect.stringContaining('dangerous ASI patterns')
      );
    });

    it('should detect variable followed by bracket', () => {
      const content = `
$arr = getArray()
[0]
      `.trim();

      const validation = parser.validateSemicolonUsage(content);
      
      expect(validation.warnings).toContain(
        expect.stringContaining('dangerous ASI patterns')
      );
    });

    it('should detect variable followed by template literal', () => {
      const content = `
$tag = getTag()
\`template\`
      `.trim();

      const validation = parser.validateSemicolonUsage(content);
      
      expect(validation.warnings).toContain(
        expect.stringContaining('dangerous ASI patterns')
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      const content = '';
      
      const ambiguities = parser.checkForSemicolonAmbiguity(content);
      
      expect(ambiguities).toHaveLength(0);
    });

    it('should handle single line content', () => {
      const content = '$a = 1';
      
      const ambiguities = parser.checkForSemicolonAmbiguity(content);
      
      expect(ambiguities).toHaveLength(0);
    });

    it('should handle content with only comments', () => {
      const content = `
// Comment 1
/* Comment 2 */
      `.trim();
      
      const ambiguities = parser.checkForSemicolonAmbiguity(content);
      
      expect(ambiguities).toHaveLength(0);
    });

    it('should handle content with mixed whitespace', () => {
      const content = `
$func = getFunction()   
   (param)
      `.trim();
      
      const ambiguities = parser.checkForSemicolonAmbiguity(content);
      
      expect(ambiguities).toHaveLength(1);
      expect(ambiguities[0].type).toBe('statement_continuation');
    });
  });
});