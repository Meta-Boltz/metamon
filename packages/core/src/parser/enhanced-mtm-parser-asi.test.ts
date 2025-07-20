import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedMTMParser, ASIAmbiguity } from './enhanced-mtm-parser.js';

describe('EnhancedMTMParser - ASI (Automatic Semicolon Insertion)', () => {
  let parser: EnhancedMTMParser;

  beforeEach(() => {
    parser = new EnhancedMTMParser();
  });

  describe('ASI Detection', () => {
    it('should detect optional semicolon usage', () => {
      const content = `
$counter = 0
$name = "test"
$increment = () => $counter++
      `.trim();

      const usesASI = parser.usesAutomaticSemicolonInsertion(content);
      expect(usesASI).toBe(true);
    });

    it('should detect explicit semicolon usage', () => {
      const content = `
$counter = 0;
$name = "test";
$increment = () => $counter++;
      `.trim();

      const usesASI = parser.usesAutomaticSemicolonInsertion(content);
      expect(usesASI).toBe(false);
    });

    it('should handle mixed semicolon usage', () => {
      const content = `
$counter = 0;
$name = "test"
$increment = () => $counter++
      `.trim();

      const usesASI = parser.usesAutomaticSemicolonInsertion(content);
      expect(usesASI).toBe(true); // More than 50% without semicolons
    });
  });

  describe('ASI Rules Application', () => {
    it('should insert semicolon at end of file', () => {
      const content = `$counter = 42`;
      const ast = parser.parseModern(content);
      
      expect(ast.body).toHaveLength(1);
      expect(ast.body[0].asiTerminated).toBe(true);
    });

    it('should insert semicolon before line terminator', () => {
      const content = `
$counter = 42
$name = "test"
      `.trim();
      
      const ast = parser.parseModern(content);
      
      expect(ast.body).toHaveLength(2);
      expect(ast.body[0].asiTerminated).toBe(true);
      expect(ast.body[1].asiTerminated).toBe(true);
    });

    it('should not insert semicolon when explicit semicolon present', () => {
      const content = `$counter = 42;`;
      const ast = parser.parseModern(content);
      
      expect(ast.body).toHaveLength(1);
      expect(ast.body[0].asiTerminated).toBeUndefined();
    });

    it('should handle function declarations with ASI', () => {
      const content = `
$add = (a, b) => a + b
$multiply = (x, y) => x * y
      `.trim();
      
      const ast = parser.parseModern(content);
      
      expect(ast.body).toHaveLength(2);
      expect(ast.body[0].type).toBe('FunctionDeclaration');
      expect(ast.body[0].asiTerminated).toBe(true);
      expect(ast.body[1].type).toBe('FunctionDeclaration');
      expect(ast.body[1].asiTerminated).toBe(true);
    });

    it('should handle reactive variables with ASI', () => {
      const content = `
$counter! = 0
$name! = "reactive"
      `.trim();
      
      const ast = parser.parseModern(content);
      
      expect(ast.body).toHaveLength(2);
      expect(ast.body[0].hasReactiveSuffix).toBe(true);
      expect(ast.body[0].asiTerminated).toBe(true);
      expect(ast.body[1].hasReactiveSuffix).toBe(true);
      expect(ast.body[1].asiTerminated).toBe(true);
    });
  });

  describe('ASI Ambiguity Detection', () => {
    it('should detect statement continuation ambiguity', () => {
      const content = `
$result = calculate()
(someValue).process()
      `.trim();
      
      parser.parseModern(content);
      const ambiguities = parser.getASIAmbiguities();
      
      expect(ambiguities).toHaveLength(1);
      expect(ambiguities[0].type).toBe('statement_continuation');
      expect(ambiguities[0].message).toContain('Could be continuation of previous statement');
    });

    it('should detect return value ambiguity', () => {
      const content = `
$getValue = () => {
  return
  42
}
      `.trim();
      
      parser.parseModern(content);
      const ambiguities = parser.getASIAmbiguities();
      
      expect(ambiguities.length).toBeGreaterThan(0);
      const returnAmbiguity = ambiguities.find(a => a.type === 'return_value');
      expect(returnAmbiguity).toBeDefined();
      expect(returnAmbiguity?.message).toContain('Return statement may be missing value');
    });

    it('should detect expression split ambiguity', () => {
      const content = `
$result = a + b
* c + d
      `.trim();
      
      parser.parseModern(content);
      const ambiguities = parser.getASIAmbiguities();
      
      expect(ambiguities.length).toBeGreaterThan(0);
      const expressionAmbiguity = ambiguities.find(a => a.type === 'expression_split');
      expect(expressionAmbiguity).toBeDefined();
      expect(expressionAmbiguity?.message).toContain('Expression may be unintentionally split');
    });

    it('should provide helpful suggestions for ambiguities', () => {
      const content = `
$func = () => doSomething()
(parameter).method()
      `.trim();
      
      parser.parseModern(content);
      const ambiguities = parser.getASIAmbiguities();
      
      expect(ambiguities).toHaveLength(1);
      expect(ambiguities[0].suggestion).toContain('Add explicit semicolon');
      expect(ambiguities[0].suggestion).toContain('line');
    });
  });

  describe('ASI with Type Annotations', () => {
    it('should handle ASI with explicit type annotations', () => {
      const content = `
$counter: number = 42
$name: string = "test"
      `.trim();
      
      const ast = parser.parseModern(content);
      
      expect(ast.body).toHaveLength(2);
      expect(ast.body[0].typeAnnotation).toBeDefined();
      expect(ast.body[0].asiTerminated).toBe(true);
      expect(ast.body[1].typeAnnotation).toBeDefined();
      expect(ast.body[1].asiTerminated).toBe(true);
    });

    it('should handle ASI with function type annotations', () => {
      const content = `
$add: (a: number, b: number): number = (a, b) => a + b
$greet: (name: string): string = (name) => \`Hello, \${name}\`
      `.trim();
      
      const ast = parser.parseModern(content);
      
      expect(ast.body).toHaveLength(2);
      expect(ast.body[0].type).toBe('FunctionDeclaration');
      expect(ast.body[0].asiTerminated).toBe(true);
      expect(ast.body[1].type).toBe('FunctionDeclaration');
      expect(ast.body[1].asiTerminated).toBe(true);
    });
  });

  describe('ASI Edge Cases', () => {
    it('should handle empty lines and comments', () => {
      const content = `
$counter = 0

// This is a comment
$name = "test"

/* Block comment */
$increment = () => $counter++
      `.trim();
      
      const ast = parser.parseModern(content);
      
      expect(ast.body).toHaveLength(3);
      ast.body.forEach(statement => {
        expect(statement.asiTerminated).toBe(true);
      });
    });

    it('should handle nested expressions', () => {
      const content = `
$complex = {
  nested: {
    value: 42
  }
}
$array = [1, 2, 3]
      `.trim();
      
      const ast = parser.parseModern(content);
      
      expect(ast.body).toHaveLength(2);
      expect(ast.body[0].asiTerminated).toBe(true);
      expect(ast.body[1].asiTerminated).toBe(true);
    });

    it('should handle async functions with ASI', () => {
      const content = `
$fetchData = async (url) => {
  const response = await fetch(url)
  return response.json()
}
$processData = async (data) => data.map(item => item.id)
      `.trim();
      
      const ast = parser.parseModern(content);
      
      expect(ast.body).toHaveLength(2);
      expect(ast.body[0].async).toBe(true);
      expect(ast.body[0].asiTerminated).toBe(true);
      expect(ast.body[1].async).toBe(true);
      expect(ast.body[1].asiTerminated).toBe(true);
    });
  });

  describe('ASI Error Handling', () => {
    it('should provide clear error messages for invalid syntax', () => {
      const content = `
$invalid = 
      `.trim();
      
      expect(() => {
        parser.parseModern(content);
      }).toThrow();
    });

    it('should handle malformed expressions gracefully', () => {
      const content = `
$valid = 42
$incomplete = 
$another = "test"
      `.trim();
      
      expect(() => {
        parser.parseModern(content);
      }).toThrow();
    });
  });

  describe('ASI Integration with Modern Features', () => {
    it('should work with reactive variables and template bindings', () => {
      const content = `
$counter! = 0
$name! = "reactive"
$template = \`Count: \${$counter}, Name: \${$name}\`
      `.trim();
      
      const ast = parser.parseModern(content);
      
      expect(ast.body).toHaveLength(3);
      expect(ast.body[0].hasReactiveSuffix).toBe(true);
      expect(ast.body[0].asiTerminated).toBe(true);
      expect(ast.body[1].hasReactiveSuffix).toBe(true);
      expect(ast.body[1].asiTerminated).toBe(true);
      expect(ast.body[2].asiTerminated).toBe(true);
    });

    it('should work with class declarations', () => {
      const content = `
class MyClass {
  $property: string = "value"
  $method = () => this.$property
}
      `.trim();
      
      const ast = parser.parseModern(content);
      
      expect(ast.body).toHaveLength(1);
      expect(ast.body[0].type).toBe('ClassDeclaration');
      expect(ast.body[0].asiTerminated).toBe(true);
    });
  });

  describe('ASI Performance', () => {
    it('should handle large files efficiently', () => {
      const lines = [];
      for (let i = 0; i < 1000; i++) {
        lines.push(`$var${i} = ${i}`);
      }
      const content = lines.join('\n');
      
      const startTime = Date.now();
      const ast = parser.parseModern(content);
      const endTime = Date.now();
      
      expect(ast.body).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should parse in less than 1 second
      
      // All statements should be ASI-terminated
      ast.body.forEach(statement => {
        expect(statement.asiTerminated).toBe(true);
      });
    });
  });
});