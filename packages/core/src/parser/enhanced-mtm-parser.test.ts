import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { EnhancedMTMParser, type SyntaxVersion, type ModernSyntaxFeatures } from './enhanced-mtm-parser.js';

describe('EnhancedMTMParser', () => {
  let parser: EnhancedMTMParser;
  const testDir = join(process.cwd(), 'test-files-enhanced');
  
  beforeEach(() => {
    parser = new EnhancedMTMParser();
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('syntax version detection', () => {
    it('should detect legacy syntax for traditional MTM files', () => {
      const legacyContent = `
export default function Counter() {
  const count = useSignal('globalCount', 0);
  const { emit } = usePubSub();
  
  const increment = () => {
    count.update(count.value + 1);
    emit('counter-updated', { value: count.value });
  };
  
  return template(\`
    <div class="counter">
      <span>Count: {{count.value}}</span>
      <button onclick="{{increment}}">+1</button>
    </div>
  \`);
}`;

      const syntaxVersion = parser.detectSyntaxVersion(legacyContent);
      expect(syntaxVersion).toBe('legacy');
    });

    it('should detect modern syntax for $ prefix variables', () => {
      const modernContent = `
export default function Counter() {
  $count = 0;
  $name: string = "test";
  
  return template(\`
    <div>{{$count}}</div>
  \`);
}`;

      const syntaxVersion = parser.detectSyntaxVersion(modernContent);
      expect(syntaxVersion).toBe('modern');
    });

    it('should detect modern syntax for reactive variables', () => {
      const modernContent = `
export default function Counter() {
  $counter! = 0;
  
  return template(\`
    <div>{{$counter}}</div>
  \`);
}`;

      const syntaxVersion = parser.detectSyntaxVersion(modernContent);
      expect(syntaxVersion).toBe('modern');
    });

    it('should detect modern syntax for arrow functions with $ prefix', () => {
      const modernContent = `
export default function Component() {
  $increment = () => {
    console.log('increment');
  };
  
  return template(\`<div></div>\`);
}`;

      const syntaxVersion = parser.detectSyntaxVersion(modernContent);
      expect(syntaxVersion).toBe('modern');
    });

    it('should detect modern syntax for async functions with $ prefix', () => {
      const modernContent = `
export default function Component() {
  $fetchData = async (url) => {
    const response = await fetch(url);
    return response.json();
  };
  
  return template(\`<div></div>\`);
}`;

      const syntaxVersion = parser.detectSyntaxVersion(modernContent);
      expect(syntaxVersion).toBe('modern');
    });

    it('should detect modern syntax for template variable bindings', () => {
      const modernContent = `
export default function Component() {
  const name = "test";
  
  return template(\`
    <div>{{$name}}</div>
  \`);
}`;

      const syntaxVersion = parser.detectSyntaxVersion(modernContent);
      expect(syntaxVersion).toBe('modern');
    });

    it('should detect modern syntax for event handlers', () => {
      const modernContent = `
export default function Component() {
  const handleClick = () => {};
  
  return template(\`
    <button click="$handleClick()">Click</button>
  \`);
}`;

      const syntaxVersion = parser.detectSyntaxVersion(modernContent);
      expect(syntaxVersion).toBe('modern');
    });
  });

  describe('modern syntax features detection', () => {
    it('should detect dollar prefix variables', () => {
      const content = `
$count = 0;
$name: string = "test";
let regular = 1;
`;

      const features = parser.detectModernFeatures(content);
      expect(features.dollarPrefixVariables).toBe(true);
    });

    it('should detect reactive variables', () => {
      const content = `
$counter! = 0;
$state! = { value: 1 };
$regular = 2;
`;

      const features = parser.detectModernFeatures(content);
      expect(features.reactiveVariables).toBe(true);
    });

    it('should detect enhanced type inference', () => {
      const content = `
$count: number = 0;
$name: string = "test";
$flag: boolean = true;
`;

      const features = parser.detectModernFeatures(content);
      expect(features.enhancedTypeInference).toBe(true);
    });

    it('should detect auto this binding for arrow functions', () => {
      const content = `
$method = () => {
  console.log(this);
};
$asyncMethod = async () => {
  return this.value;
};
`;

      const features = parser.detectModernFeatures(content);
      expect(features.autoThisBinding).toBe(true);
    });

    it('should detect optional semicolons', () => {
      const contentWithSemicolons = `
const a = 1;
const b = 2;
function test() {
  return a + b;
}
`;

      const contentWithoutSemicolons = `
const a = 1
const b = 2
function test() {
  return a + b
}
`;

      const featuresWithSemicolons = parser.detectModernFeatures(contentWithSemicolons);
      const featuresWithoutSemicolons = parser.detectModernFeatures(contentWithoutSemicolons);
      
      expect(featuresWithSemicolons.optionalSemicolons).toBe(false);
      expect(featuresWithoutSemicolons.optionalSemicolons).toBe(true);
    });

    it('should handle mixed syntax correctly', () => {
      const content = `
$count! = 0;
$name: string = "test";
$increment = () => count++;
const regular = useSignal('test', 0);
`;

      const features = parser.detectModernFeatures(content);
      expect(features.dollarPrefixVariables).toBe(true);
      expect(features.reactiveVariables).toBe(true);
      expect(features.enhancedTypeInference).toBe(true);
      expect(features.autoThisBinding).toBe(true);
    });
  });

  describe('parse method with syntax detection', () => {
    it('should parse legacy MTM file and detect legacy syntax', () => {
      const filePath = join(testDir, 'legacy.mtm');
      const content = `---
target: reactjs
channels:
  - event: counter-updated
    emit: onCounterUpdate
---

export default function Counter() {
  const count = useSignal('globalCount', 0);
  const { emit } = usePubSub();
  
  const increment = () => {
    count.update(count.value + 1);
    emit('counter-updated', { value: count.value });
  };
  
  return template(\`
    <div class="counter">
      <span>Count: {{count.value}}</span>
      <button onclick="{{increment}}">+1</button>
    </div>
  \`);
}`;
      
      writeFileSync(filePath, content);
      
      const result = parser.parse(filePath);
      
      expect(result.syntaxVersion).toBe('legacy');
      expect(result.modernFeatures).toBeUndefined();
      expect(result.frontmatter.target).toBe('reactjs');
    });

    it('should parse modern MTM file and detect modern syntax with features', () => {
      const filePath = join(testDir, 'modern.mtm');
      const content = `---
target: vue
---

export default function ModernCounter() {
  $count! = 0;
  $name: string = "Counter";
  
  $increment = () => {
    $count++;
  };
  
  $fetchData = async (url: string) => {
    const response = await fetch(url);
    return response.json();
  };
  
  return template(\`
    <div class="modern-counter">
      <h3>{{$name}}</h3>
      <span>Count: {{$count}}</span>
      <button click="$increment()">+1</button>
    </div>
  \`);
}`;
      
      writeFileSync(filePath, content);
      
      const result = parser.parse(filePath);
      
      expect(result.syntaxVersion).toBe('modern');
      expect(result.modernFeatures).toBeDefined();
      expect(result.modernFeatures!.dollarPrefixVariables).toBe(true);
      expect(result.modernFeatures!.reactiveVariables).toBe(true);
      expect(result.modernFeatures!.enhancedTypeInference).toBe(true);
      expect(result.modernFeatures!.autoThisBinding).toBe(true);
      expect(result.frontmatter.target).toBe('vue');
    });

    it('should handle mixed modern features correctly', () => {
      const filePath = join(testDir, 'mixed-modern.mtm');
      const content = `---
target: solid
---

export default function MixedComponent() {
  $simpleVar = 42;
  $typedVar: number = 100;
  $reactiveVar! = "hello";
  
  $regularFunction = function() {
    return "regular";
  };
  
  $arrowFunction = () => {
    return "arrow";
  };
  
  return template(\`
    <div>
      <span>{{$simpleVar}}</span>
      <span>{{$typedVar}}</span>
      <span>{{$reactiveVar}}</span>
    </div>
  \`);
}`;
      
      writeFileSync(filePath, content);
      
      const result = parser.parse(filePath);
      
      expect(result.syntaxVersion).toBe('modern');
      expect(result.modernFeatures!.dollarPrefixVariables).toBe(true);
      expect(result.modernFeatures!.reactiveVariables).toBe(true);
      expect(result.modernFeatures!.enhancedTypeInference).toBe(true);
      expect(result.modernFeatures!.autoThisBinding).toBe(true);
    });

    it('should handle files with only some modern features', () => {
      const filePath = join(testDir, 'partial-modern.mtm');
      const content = `---
target: svelte
---

export default function PartialModern() {
  $count = 0; // Only dollar prefix, no reactive or types
  
  const regularVar = "test";
  
  return template(\`
    <div>{{$count}}</div>
  \`);
}`;
      
      writeFileSync(filePath, content);
      
      const result = parser.parse(filePath);
      
      expect(result.syntaxVersion).toBe('modern');
      expect(result.modernFeatures!.dollarPrefixVariables).toBe(true);
      expect(result.modernFeatures!.reactiveVariables).toBe(false);
      expect(result.modernFeatures!.enhancedTypeInference).toBe(false);
      expect(result.modernFeatures!.autoThisBinding).toBe(false);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty content correctly', () => {
      const syntaxVersion = parser.detectSyntaxVersion('');
      expect(syntaxVersion).toBe('legacy');
    });

    it('should handle content with only comments', () => {
      const content = `
// This is a comment
/* This is a block comment */
`;
      const syntaxVersion = parser.detectSyntaxVersion(content);
      expect(syntaxVersion).toBe('legacy');
    });

    it('should not be confused by dollar signs in strings', () => {
      const content = `
const message = "This has a $dollar sign";
const template = \`Price: $\{price}\`;
`;
      const syntaxVersion = parser.detectSyntaxVersion(content);
      expect(syntaxVersion).toBe('legacy');
    });

    it('should not be confused by dollar signs in comments', () => {
      const content = `
// This comment has $dollar signs
/* Another $comment with $dollars */
const regular = 1;
`;
      const syntaxVersion = parser.detectSyntaxVersion(content);
      expect(syntaxVersion).toBe('legacy');
    });

    it('should handle complex modern syntax patterns', () => {
      const content = `
class ModernClass {
  $property: string = "test";
  $reactiveProperty! = 0;
  
  $method = (param: number) => {
    return param * 2;
  };
  
  $asyncMethod = async (url: string): Promise<any> => {
    const response = await fetch(url);
    return response.json();
  };
}
`;
      
      const syntaxVersion = parser.detectSyntaxVersion(content);
      const features = parser.detectModernFeatures(content);
      
      expect(syntaxVersion).toBe('modern');
      expect(features.dollarPrefixVariables).toBe(true);
      expect(features.reactiveVariables).toBe(true);
      expect(features.enhancedTypeInference).toBe(true);
      expect(features.autoThisBinding).toBe(true);
    });
  });

  describe('modern syntax parsing - $ prefix variable declarations', () => {
    describe('basic $ prefix variable parsing', () => {
      it('should parse simple $ prefix variable with number literal', () => {
        const content = '$count = 42';
        const ast = parser.parseModern(content);
        
        expect(ast.type).toBe('Program');
        expect(ast.syntaxVersion).toBe('modern');
        expect(ast.body).toHaveLength(1);
        
        const varDecl = ast.body[0] as any;
        expect(varDecl.type).toBe('VariableDeclaration');
        expect(varDecl.name).toBe('count');
        expect(varDecl.hasDollarPrefix).toBe(true);
        expect(varDecl.hasReactiveSuffix).toBe(false);
        expect(varDecl.isReactive).toBe(false);
        expect(varDecl.initializer.type).toBe('Literal');
        expect(varDecl.initializer.value).toBe(42);
        expect(varDecl.inferredType.baseType).toBe('number');
        expect(varDecl.inferredType.nullable).toBe(false);
      });

      it('should parse $ prefix variable with string literal', () => {
        const content = '$name = "John"';
        const ast = parser.parseModern(content);
        
        const varDecl = ast.body[0] as any;
        expect(varDecl.name).toBe('name');
        expect(varDecl.initializer.value).toBe('John');
        expect(varDecl.inferredType.baseType).toBe('string');
      });

      it('should parse $ prefix variable with boolean literal', () => {
        const content = '$isActive = true';
        const ast = parser.parseModern(content);
        
        const varDecl = ast.body[0] as any;
        expect(varDecl.name).toBe('isActive');
        expect(varDecl.initializer.value).toBe(true);
        expect(varDecl.inferredType.baseType).toBe('boolean');
      });

      it('should parse $ prefix variable with float literal', () => {
        const content = '$price = 19.99';
        const ast = parser.parseModern(content);
        
        const varDecl = ast.body[0] as any;
        expect(varDecl.name).toBe('price');
        expect(varDecl.initializer.value).toBe(19.99);
        expect(varDecl.inferredType.baseType).toBe('float');
      });

      it('should parse multiple $ prefix variables', () => {
        const content = `
$count = 0
$name = "test"
$active = true
`;
        const ast = parser.parseModern(content);
        
        expect(ast.body).toHaveLength(3);
        
        const countVar = ast.body[0] as any;
        expect(countVar.name).toBe('count');
        expect(countVar.inferredType.baseType).toBe('number');
        
        const nameVar = ast.body[1] as any;
        expect(nameVar.name).toBe('name');
        expect(nameVar.inferredType.baseType).toBe('string');
        
        const activeVar = ast.body[2] as any;
        expect(activeVar.name).toBe('active');
        expect(activeVar.inferredType.baseType).toBe('boolean');
      });
    });

    describe('explicit type annotations', () => {
      it('should parse $ prefix variable with explicit type annotation', () => {
        const content = '$count: number = 42';
        const ast = parser.parseModern(content);
        
        const varDecl = ast.body[0] as any;
        expect(varDecl.name).toBe('count');
        expect(varDecl.typeAnnotation).toBeDefined();
        expect(varDecl.typeAnnotation.type).toBe('TypeAnnotation');
        expect(varDecl.typeAnnotation.baseType).toBe('number');
        expect(varDecl.typeAnnotation.typeKind).toBe('primitive');
        expect(varDecl.inferredType.baseType).toBe('number');
      });

      it('should parse string type annotation', () => {
        const content = '$name: string = "John"';
        const ast = parser.parseModern(content);
        
        const varDecl = ast.body[0] as any;
        expect(varDecl.typeAnnotation.baseType).toBe('string');
        expect(varDecl.inferredType.baseType).toBe('string');
      });

      it('should parse boolean type annotation', () => {
        const content = '$isActive: boolean = true';
        const ast = parser.parseModern(content);
        
        const varDecl = ast.body[0] as any;
        expect(varDecl.typeAnnotation.baseType).toBe('boolean');
        expect(varDecl.inferredType.baseType).toBe('boolean');
      });

      it('should parse float type annotation', () => {
        const content = '$price: float = 19.99';
        const ast = parser.parseModern(content);
        
        const varDecl = ast.body[0] as any;
        expect(varDecl.typeAnnotation.baseType).toBe('float');
        expect(varDecl.inferredType.baseType).toBe('float');
      });

      it('should parse multiple variables with type annotations', () => {
        const content = `
$count: number = 0
$name: string = "test"
$active: boolean = true
$price: float = 99.99
`;
        const ast = parser.parseModern(content);
        
        expect(ast.body).toHaveLength(4);
        
        const types = ['number', 'string', 'boolean', 'float'];
        ast.body.forEach((stmt: any, index: number) => {
          expect(stmt.typeAnnotation.baseType).toBe(types[index]);
        });
      });
    });

    describe('reactive variables with ! suffix', () => {
      it('should parse reactive variable with ! suffix', () => {
        const content = '$counter! = 0';
        const ast = parser.parseModern(content);
        
        const varDecl = ast.body[0] as any;
        expect(varDecl.name).toBe('counter');
        expect(varDecl.hasReactiveSuffix).toBe(true);
        expect(varDecl.isReactive).toBe(true);
        expect(varDecl.initializer.value).toBe(0);
        expect(varDecl.inferredType.baseType).toBe('number');
      });

      it('should parse reactive variable with type annotation', () => {
        const content = '$state!: number = 42';
        const ast = parser.parseModern(content);
        
        const varDecl = ast.body[0] as any;
        expect(varDecl.name).toBe('state');
        expect(varDecl.hasReactiveSuffix).toBe(true);
        expect(varDecl.isReactive).toBe(true);
        expect(varDecl.typeAnnotation.baseType).toBe('number');
        expect(varDecl.inferredType.baseType).toBe('number');
      });

      it('should parse multiple reactive variables', () => {
        const content = `
$counter! = 0
$name! = "reactive"
$active! = true
`;
        const ast = parser.parseModern(content);
        
        expect(ast.body).toHaveLength(3);
        ast.body.forEach((stmt: any) => {
          expect(stmt.hasReactiveSuffix).toBe(true);
          expect(stmt.isReactive).toBe(true);
        });
      });

      it('should parse mixed reactive and non-reactive variables', () => {
        const content = `
$counter! = 0
$name = "static"
$active! = true
$price = 19.99
`;
        const ast = parser.parseModern(content);
        
        expect(ast.body).toHaveLength(4);
        
        expect(ast.body[0].isReactive).toBe(true);  // counter!
        expect(ast.body[1].isReactive).toBe(false); // name
        expect(ast.body[2].isReactive).toBe(true);  // active!
        expect(ast.body[3].isReactive).toBe(false); // price
      });
    });

    describe('optional semicolons', () => {
      it('should parse variables with semicolons', () => {
        const content = `
$count = 42;
$name = "test";
`;
        const ast = parser.parseModern(content);
        
        expect(ast.body).toHaveLength(2);
        expect(ast.body[0].name).toBe('count');
        expect(ast.body[1].name).toBe('name');
      });

      it('should parse variables without semicolons', () => {
        const content = `
$count = 42
$name = "test"
`;
        const ast = parser.parseModern(content);
        
        expect(ast.body).toHaveLength(2);
        expect(ast.body[0].name).toBe('count');
        expect(ast.body[1].name).toBe('name');
      });

      it('should parse mixed semicolon usage', () => {
        const content = `
$count = 42;
$name = "test"
$active = true;
$price = 19.99
`;
        const ast = parser.parseModern(content);
        
        expect(ast.body).toHaveLength(4);
        ast.body.forEach((stmt: any, index: number) => {
          expect(stmt.type).toBe('VariableDeclaration');
        });
      });
    });

    describe('complex variable declaration patterns', () => {
      it('should parse all combinations of features', () => {
        const content = `
$simple = 42
$typed: string = "hello"
$reactive! = 0
$reactiveTyped!: boolean = true
$withSemicolon = "test";
$reactiveWithSemicolon!: number = 100;
`;
        const ast = parser.parseModern(content);
        
        expect(ast.body).toHaveLength(6);
        
        // simple
        expect(ast.body[0].name).toBe('simple');
        expect(ast.body[0].typeAnnotation).toBeUndefined();
        expect(ast.body[0].isReactive).toBe(false);
        
        // typed
        expect(ast.body[1].name).toBe('typed');
        expect(ast.body[1].typeAnnotation.baseType).toBe('string');
        expect(ast.body[1].isReactive).toBe(false);
        
        // reactive
        expect(ast.body[2].name).toBe('reactive');
        expect(ast.body[2].typeAnnotation).toBeUndefined();
        expect(ast.body[2].isReactive).toBe(true);
        
        // reactiveTyped
        expect(ast.body[3].name).toBe('reactiveTyped');
        expect(ast.body[3].typeAnnotation.baseType).toBe('boolean');
        expect(ast.body[3].isReactive).toBe(true);
        
        // withSemicolon
        expect(ast.body[4].name).toBe('withSemicolon');
        expect(ast.body[4].isReactive).toBe(false);
        
        // reactiveWithSemicolon
        expect(ast.body[5].name).toBe('reactiveWithSemicolon');
        expect(ast.body[5].typeAnnotation.baseType).toBe('number');
        expect(ast.body[5].isReactive).toBe(true);
      });

      it('should handle different quote types for strings', () => {
        const content = `
$single = 'single quotes'
$double = "double quotes"
$backtick = \`template literal\`
`;
        const ast = parser.parseModern(content);
        
        expect(ast.body).toHaveLength(3);
        
        expect(ast.body[0].initializer.value).toBe('single quotes');
        expect(ast.body[1].initializer.value).toBe('double quotes');
        expect(ast.body[2].initializer.value).toBe('template literal');
        
        ast.body.forEach((stmt: any) => {
          expect(stmt.inferredType.baseType).toBe('string');
        });
      });

      it('should handle null values', () => {
        const content = '$nullable = null';
        const ast = parser.parseModern(content);
        
        const varDecl = ast.body[0] as any;
        expect(varDecl.initializer.value).toBe(null);
        expect(varDecl.inferredType.baseType).toBe('any');
        expect(varDecl.inferredType.nullable).toBe(true);
      });
    });

    describe('error handling', () => {
      it('should throw error for missing variable name', () => {
        const content = '$ = 42';
        expect(() => parser.parseModern(content)).toThrow('Expected variable name');
      });

      it('should throw error for missing equals sign', () => {
        const content = '$count 42';
        expect(() => parser.parseModern(content)).toThrow("Expected '=' in variable declaration");
      });

      it('should throw error for missing type after colon', () => {
        const content = '$count: = 42';
        expect(() => parser.parseModern(content)).toThrow('Expected type name');
      });

      it('should throw error for invalid token in expression', () => {
        const content = '$count = @invalid';
        expect(() => parser.parseModern(content)).toThrow('Unexpected token');
      });

      it('should provide location information in errors', () => {
        const content = `
$valid = 42
$invalid @error
`;
        try {
          parser.parseModern(content);
          fail('Should have thrown an error');
        } catch (error) {
          expect(error.message).toContain('line');
        }
      });
    });

    describe('whitespace and formatting', () => {
      it('should handle various whitespace patterns', () => {
        const content = `
  $count   =   42  
$name="test"
  $active!  :  boolean  =  true  ;
`;
        const ast = parser.parseModern(content);
        
        expect(ast.body).toHaveLength(3);
        expect(ast.body[0].name).toBe('count');
        expect(ast.body[1].name).toBe('name');
        expect(ast.body[2].name).toBe('active');
      });

      it('should handle empty lines', () => {
        const content = `
$first = 1

$second = 2


$third = 3
`;
        const ast = parser.parseModern(content);
        
        expect(ast.body).toHaveLength(3);
        expect(ast.body[0].name).toBe('first');
        expect(ast.body[1].name).toBe('second');
        expect(ast.body[2].name).toBe('third');
      });
    });
  });

  describe('backward compatibility', () => {
    it('should maintain compatibility with original parser interface', () => {
      const filePath = join(testDir, 'compat.mtm');
      const content = `---
target: reactjs
channels:
  - event: test-event
    emit: onTest
route: /test
layout: main
---

export default function CompatTest() {
  return template(\`<div>Test</div>\`);
}`;
      
      writeFileSync(filePath, content);
      
      const result = parser.parse(filePath);
      
      // Should have all original properties
      expect(result.frontmatter).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.filePath).toBe(filePath);
      
      // Should have new properties
      expect(result.syntaxVersion).toBeDefined();
      
      // Should validate frontmatter correctly
      const validation = parser.validate(result.frontmatter);
      expect(validation.isValid).toBe(true);
    });

    it('should handle all original validation rules', () => {
      const validFrontmatter = {
        target: 'reactjs',
        channels: [
          { event: 'test-event', emit: 'onTest' }
        ],
        route: '/test',
        layout: 'main'
      };
      
      const validation = parser.validate(validFrontmatter);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });
});