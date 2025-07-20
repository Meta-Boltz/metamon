import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { EnhancedMTMParser, type SyntaxVersion, type ModernSyntaxFeatures } from './enhanced-mtm-parser.js';
import { fail } from 'assert';

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

      it('should include dependency tracking metadata for reactive variables', () => {
        const content = '$counter! = 0';
        const ast = parser.parseModern(content);
        
        const varDecl = ast.body[0] as any;
        expect(varDecl.name).toBe('counter');
        expect(varDecl.isReactive).toBe(true);
        expect(varDecl.updateTriggers).toBeDefined();
        expect(varDecl.dependencies).toBeDefined();
        expect(Array.isArray(varDecl.updateTriggers)).toBe(true);
        expect(Array.isArray(varDecl.dependencies)).toBe(true);
        expect(varDecl.updateTriggers).toContain('ui-element-counter');
        expect(varDecl.updateTriggers).toContain('template-binding-counter');
      });

      it('should not include dependency tracking for non-reactive variables', () => {
        const content = '$regular = 42';
        const ast = parser.parseModern(content);
        
        const varDecl = ast.body[0] as any;
        expect(varDecl.name).toBe('regular');
        expect(varDecl.isReactive).toBe(false);
        expect(varDecl.updateTriggers).toBeUndefined();
        expect(varDecl.dependencies).toBeUndefined();
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

    describe('class syntax enhancements', () => {
      describe('enhanced class property parsing', () => {
        it('should parse class with $ prefix properties', () => {
          const content = `
class TestClass {
  $name: string = "test"
  $count: number = 42
  $active: boolean = true
}`;
          const ast = parser.parseModern(content);
          
          expect(ast.type).toBe('Program');
          expect(ast.body).toHaveLength(1);
          
          const classDecl = ast.body[0] as any;
          expect(classDecl.type).toBe('ClassDeclaration');
          expect(classDecl.name).toBe('TestClass');
          expect(classDecl.properties).toHaveLength(3);
          
          // Check first property
          const nameProperty = classDecl.properties[0];
          expect(nameProperty.type).toBe('ClassProperty');
          expect(nameProperty.name).toBe('name');
          expect(nameProperty.hasDollarPrefix).toBe(true);
          expect(nameProperty.typeAnnotation.baseType).toBe('string');
          expect(nameProperty.initializer.value).toBe('test');
          expect(nameProperty.inferredType.baseType).toBe('string');
          expect(nameProperty.isReactive).toBe(false);
          
          // Check second property
          const countProperty = classDecl.properties[1];
          expect(countProperty.name).toBe('count');
          expect(countProperty.typeAnnotation.baseType).toBe('number');
          expect(countProperty.initializer.value).toBe(42);
          expect(countProperty.inferredType.baseType).toBe('number');
          
          // Check third property
          const activeProperty = classDecl.properties[2];
          expect(activeProperty.name).toBe('active');
          expect(activeProperty.typeAnnotation.baseType).toBe('boolean');
          expect(activeProperty.initializer.value).toBe(true);
          expect(activeProperty.inferredType.baseType).toBe('boolean');
        });

        it('should parse class properties without initializers', () => {
          const content = `
class TestClass {
  $name: string
  $count: number
  $data
}`;
          const ast = parser.parseModern(content);
          
          const classDecl = ast.body[0] as any;
          expect(classDecl.properties).toHaveLength(3);
          
          // Property with type annotation but no initializer
          const nameProperty = classDecl.properties[0];
          expect(nameProperty.name).toBe('name');
          expect(nameProperty.typeAnnotation.baseType).toBe('string');
          expect(nameProperty.initializer).toBeUndefined();
          expect(nameProperty.inferredType.baseType).toBe('string');
          
          // Property with type annotation but no initializer
          const countProperty = classDecl.properties[1];
          expect(countProperty.name).toBe('count');
          expect(countProperty.typeAnnotation.baseType).toBe('number');
          expect(countProperty.initializer).toBeUndefined();
          expect(countProperty.inferredType.baseType).toBe('number');
          
          // Property without type annotation or initializer
          const dataProperty = classDecl.properties[2];
          expect(dataProperty.name).toBe('data');
          expect(dataProperty.typeAnnotation).toBeUndefined();
          expect(dataProperty.initializer).toBeUndefined();
          expect(dataProperty.inferredType.baseType).toBe('any');
          expect(dataProperty.inferredType.nullable).toBe(true);
        });

        it('should parse reactive class properties with ! suffix', () => {
          const content = `
class ReactiveClass {
  $counter!: number = 0
  $name! = "reactive"
  $active!: boolean = true
}`;
          const ast = parser.parseModern(content);
          
          const classDecl = ast.body[0] as any;
          expect(classDecl.properties).toHaveLength(3);
          
          // All properties should be reactive
          classDecl.properties.forEach((prop: any) => {
            expect(prop.isReactive).toBe(true);
            expect(prop.hasDollarPrefix).toBe(true);
          });
          
          // Check specific properties
          expect(classDecl.properties[0].name).toBe('counter');
          expect(classDecl.properties[0].typeAnnotation.baseType).toBe('number');
          expect(classDecl.properties[1].name).toBe('name');
          expect(classDecl.properties[1].inferredType.baseType).toBe('string');
          expect(classDecl.properties[2].name).toBe('active');
          expect(classDecl.properties[2].typeAnnotation.baseType).toBe('boolean');
        });

        it('should parse mixed reactive and non-reactive class properties', () => {
          const content = `
class MixedClass {
  $static: string = "static"
  $reactive!: number = 0
  $anotherStatic = 42
  $anotherReactive! = true
}`;
          const ast = parser.parseModern(content);
          
          const classDecl = ast.body[0] as any;
          expect(classDecl.properties).toHaveLength(4);
          
          expect(classDecl.properties[0].isReactive).toBe(false); // static
          expect(classDecl.properties[1].isReactive).toBe(true);  // reactive!
          expect(classDecl.properties[2].isReactive).toBe(false); // anotherStatic
          expect(classDecl.properties[3].isReactive).toBe(true);  // anotherReactive!
        });

        it('should validate class property type annotations', () => {
          const content = `
class ValidatedClass {
  $name: string = "valid"
  $count: number = 42
  $price: float = 19.99
}`;
          const ast = parser.parseModern(content);
          
          const classDecl = ast.body[0] as any;
          expect(classDecl.properties).toHaveLength(3);
          
          // All should pass validation
          classDecl.properties.forEach((prop: any) => {
            expect(prop.typeAnnotation).toBeDefined();
            expect(prop.inferredType).toBeDefined();
          });
        });

        it('should throw error for class property type conflicts', () => {
          const content = `
class InvalidClass {
  $name: number = "string value"
}`;
          
          expect(() => parser.parseModern(content)).toThrow('Type validation failed');
        });

        it('should parse class properties with different value types', () => {
          const content = `
class TypedClass {
  $stringProp: string = "hello"
  $numberProp: number = 42
  $floatProp: float = 3.14
  $booleanProp: boolean = true
  $nullProp = null
}`;
          const ast = parser.parseModern(content);
          
          const classDecl = ast.body[0] as any;
          expect(classDecl.properties).toHaveLength(5);
          
          expect(classDecl.properties[0].inferredType.baseType).toBe('string');
          expect(classDecl.properties[1].inferredType.baseType).toBe('number');
          expect(classDecl.properties[2].inferredType.baseType).toBe('float');
          expect(classDecl.properties[3].inferredType.baseType).toBe('boolean');
          expect(classDecl.properties[4].inferredType.baseType).toBe('any');
          expect(classDecl.properties[4].inferredType.nullable).toBe(true);
        });

        it('should parse class with methods and properties', () => {
          const content = `
class MixedClass {
  $name: string = "test"
  $count: number = 0
  
  $increment = () => {
    this.$count++
  }
  
  $getName = () => this.$name
}`;
          const ast = parser.parseModern(content);
          
          const classDecl = ast.body[0] as any;
          expect(classDecl.properties).toHaveLength(2);
          expect(classDecl.methods).toHaveLength(2);
          
          // Check properties
          expect(classDecl.properties[0].name).toBe('name');
          expect(classDecl.properties[1].name).toBe('count');
          
          // Check methods
          expect(classDecl.methods[0].name).toBe('increment');
          expect(classDecl.methods[0].type).toBe('ClassMethod');
          expect(classDecl.methods[1].name).toBe('getName');
          expect(classDecl.methods[1].type).toBe('ClassMethod');
        });

        it('should handle optional semicolons in class properties', () => {
          const content = `
class SemicolonClass {
  $withSemicolon: string = "test";
  $withoutSemicolon: number = 42
  $mixed! = true;
  $anotherMixed! = false
}`;
          const ast = parser.parseModern(content);
          
          const classDecl = ast.body[0] as any;
          expect(classDecl.properties).toHaveLength(4);
          
          // All should parse correctly regardless of semicolon presence
          classDecl.properties.forEach((prop: any) => {
            expect(prop.type).toBe('ClassProperty');
            expect(prop.hasDollarPrefix).toBe(true);
          });
        });

        it('should parse empty class', () => {
          const content = `
class EmptyClass {
}`;
          const ast = parser.parseModern(content);
          
          const classDecl = ast.body[0] as any;
          expect(classDecl.type).toBe('ClassDeclaration');
          expect(classDecl.name).toBe('EmptyClass');
          expect(classDecl.properties).toHaveLength(0);
          expect(classDecl.methods).toHaveLength(0);
          expect(classDecl.constructor).toBeUndefined();
        });

        it('should handle whitespace and formatting in class properties', () => {
          const content = `
class FormattedClass {
  $prop1   :   string   =   "test"  ;
  $prop2!:number=42
    $prop3  :  boolean  =  true
}`;
          const ast = parser.parseModern(content);
          
          const classDecl = ast.body[0] as any;
          expect(classDecl.properties).toHaveLength(3);
          
          expect(classDecl.properties[0].name).toBe('prop1');
          expect(classDecl.properties[0].isReactive).toBe(false);
          expect(classDecl.properties[1].name).toBe('prop2');
          expect(classDecl.properties[1].isReactive).toBe(true);
          expect(classDecl.properties[2].name).toBe('prop3');
          expect(classDecl.properties[2].isReactive).toBe(false);
        });
      });

      describe('constructor parameter assignment', () => {
        it('should parse constructor with automatic parameter assignment', () => {
          const content = `
class TestClass {
  constructor(public name: string, private age: number) {
    // constructor body
  }
}`;
          const ast = parser.parseModern(content);
          
          const classDecl = ast.body[0] as any;
          expect(classDecl.constructor).toBeDefined();
          expect(classDecl.constructor.parameters).toHaveLength(2);
          
          // Check first parameter
          const nameParam = classDecl.constructor.parameters[0];
          expect(nameParam.name).toBe('name');
          expect(nameParam.isPropertyAssignment).toBe(true);
          expect(nameParam.accessModifier).toBe('public');
          expect(nameParam.typeAnnotation.baseType).toBe('string');
          expect(nameParam.inferredType.baseType).toBe('string');
          
          // Check second parameter
          const ageParam = classDecl.constructor.parameters[1];
          expect(ageParam.name).toBe('age');
          expect(ageParam.isPropertyAssignment).toBe(true);
          expect(ageParam.accessModifier).toBe('private');
          expect(ageParam.typeAnnotation.baseType).toBe('number');
          expect(ageParam.inferredType.baseType).toBe('number');
        });

        it('should parse constructor with mixed parameter assignment and regular parameters', () => {
          const content = `
class MixedClass {
  constructor(public name: string, regularParam: number, protected data: boolean) {
    // constructor body
  }
}`;
          const ast = parser.parseModern(content);
          
          const classDecl = ast.body[0] as any;
          const params = classDecl.constructor.parameters;
          expect(params).toHaveLength(3);
          
          // public name - should be property assignment
          expect(params[0].name).toBe('name');
          expect(params[0].isPropertyAssignment).toBe(true);
          expect(params[0].accessModifier).toBe('public');
          
          // regularParam - should not be property assignment
          expect(params[1].name).toBe('regularParam');
          expect(params[1].isPropertyAssignment).toBe(false);
          expect(params[1].accessModifier).toBeUndefined();
          
          // protected data - should be property assignment
          expect(params[2].name).toBe('data');
          expect(params[2].isPropertyAssignment).toBe(true);
          expect(params[2].accessModifier).toBe('protected');
        });

        it('should parse constructor with default values for property assignment', () => {
          const content = `
class DefaultClass {
  constructor(public name: string = "default", private count: number = 0) {
    // constructor body
  }
}`;
          const ast = parser.parseModern(content);
          
          const classDecl = ast.body[0] as any;
          const params = classDecl.constructor.parameters;
          expect(params).toHaveLength(2);
          
          // Check first parameter with default value
          expect(params[0].name).toBe('name');
          expect(params[0].isPropertyAssignment).toBe(true);
          expect(params[0].accessModifier).toBe('public');
          expect(params[0].defaultValue).toBeDefined();
          expect(params[0].defaultValue.value).toBe('default');
          
          // Check second parameter with default value
          expect(params[1].name).toBe('count');
          expect(params[1].isPropertyAssignment).toBe(true);
          expect(params[1].accessModifier).toBe('private');
          expect(params[1].defaultValue).toBeDefined();
          expect(params[1].defaultValue.value).toBe(0);
        });

        it('should infer parameter types from default values when no explicit type', () => {
          const content = `
class InferredClass {
  constructor(public name = "test", private count = 42, protected active = true) {
    // constructor body
  }
}`;
          const ast = parser.parseModern(content);
          
          const classDecl = ast.body[0] as any;
          const params = classDecl.constructor.parameters;
          expect(params).toHaveLength(3);
          
          // Check type inference from default values
          expect(params[0].inferredType.baseType).toBe('string');
          expect(params[1].inferredType.baseType).toBe('number');
          expect(params[2].inferredType.baseType).toBe('boolean');
          
          // All should be property assignments
          params.forEach((param: any) => {
            expect(param.isPropertyAssignment).toBe(true);
          });
        });

        it('should parse constructor with all access modifier types', () => {
          const content = `
class AccessClass {
  constructor(
    public publicProp: string,
    private privateProp: number,
    protected protectedProp: boolean
  ) {
    // constructor body
  }
}`;
          const ast = parser.parseModern(content);
          
          const classDecl = ast.body[0] as any;
          const params = classDecl.constructor.parameters;
          expect(params).toHaveLength(3);
          
          expect(params[0].accessModifier).toBe('public');
          expect(params[1].accessModifier).toBe('private');
          expect(params[2].accessModifier).toBe('protected');
          
          // All should be property assignments
          params.forEach((param: any) => {
            expect(param.isPropertyAssignment).toBe(true);
          });
        });

        it('should parse empty constructor', () => {
          const content = `
class EmptyConstructorClass {
  constructor() {
    // empty constructor
  }
}`;
          const ast = parser.parseModern(content);
          
          const classDecl = ast.body[0] as any;
          expect(classDecl.constructor).toBeDefined();
          expect(classDecl.constructor.parameters).toHaveLength(0);
        });

        it('should parse constructor without access modifiers', () => {
          const content = `
class RegularClass {
  constructor(name: string, age: number) {
    this.name = name;
    this.age = age;
  }
}`;
          const ast = parser.parseModern(content);
          
          const classDecl = ast.body[0] as any;
          const params = classDecl.constructor.parameters;
          expect(params).toHaveLength(2);
          
          // Neither should be property assignments
          expect(params[0].isPropertyAssignment).toBe(false);
          expect(params[1].isPropertyAssignment).toBe(false);
          expect(params[0].accessModifier).toBeUndefined();
          expect(params[1].accessModifier).toBeUndefined();
        });

        it('should handle complex constructor parameter patterns', () => {
          const content = `
class ComplexClass {
  constructor(
    public name: string = "default",
    private id: number,
    protected data: any,
    regularParam: boolean
  ) {
    // constructor body
  }
}`;
          const ast = parser.parseModern(content);
          
          const classDecl = ast.body[0] as any;
          const params = classDecl.constructor.parameters;
          expect(params).toHaveLength(4);
          
          // public name with default
          expect(params[0].isPropertyAssignment).toBe(true);
          expect(params[0].accessModifier).toBe('public');
          expect(params[0].defaultValue).toBeDefined();
          
          // private id
          expect(params[1].isPropertyAssignment).toBe(true);
          expect(params[1].accessModifier).toBe('private');
          
          // protected data
          expect(params[2].isPropertyAssignment).toBe(true);
          expect(params[2].accessModifier).toBe('protected');
          
          // regular parameter
          expect(params[3].isPropertyAssignment).toBe(false);
          expect(params[3].accessModifier).toBeUndefined();
        });

        it('should validate constructor parameter type annotations', () => {
          const content = `
class ValidatedConstructorClass {
  constructor(public name: string = "valid", private count: number = 42) {
    // constructor body
  }
}`;
          const ast = parser.parseModern(content);
          
          const classDecl = ast.body[0] as any;
          const params = classDecl.constructor.parameters;
          
          // Both parameters should have matching types and default values
          expect(params[0].typeAnnotation.baseType).toBe('string');
          expect(params[0].inferredType.baseType).toBe('string');
          expect(params[1].typeAnnotation.baseType).toBe('number');
          expect(params[1].inferredType.baseType).toBe('number');
        });

        it('should parse class with both constructor parameter assignment and regular properties', () => {
          const content = `
class HybridClass {
  $regularProp: string = "regular"
  
  constructor(public constructorProp: number, private data: boolean) {
    // constructor body
  }
  
  $method = () => {
    return this.constructorProp + this.$regularProp;
  }
}`;
          const ast = parser.parseModern(content);
          
          const classDecl = ast.body[0] as any;
          
          // Should have regular properties
          expect(classDecl.properties).toHaveLength(1);
          expect(classDecl.properties[0].name).toBe('regularProp');
          
          // Should have constructor with parameter assignment
          expect(classDecl.constructor.parameters).toHaveLength(2);
          expect(classDecl.constructor.parameters[0].isPropertyAssignment).toBe(true);
          expect(classDecl.constructor.parameters[1].isPropertyAssignment).toBe(true);
          
          // Should have methods
          expect(classDecl.methods).toHaveLength(1);
          expect(classDecl.methods[0].name).toBe('method');
        });
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
        expect(() => parser.parseModern(content)).toThrow('Expected name');
      });

      it('should throw error for missing equals sign', () => {
        const content = '$count 42';
        expect(() => parser.parseModern(content)).toThrow("Expected '=' in declaration");
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

  describe('type validation and conflict detection', () => {
    it('should validate matching explicit and inferred types', () => {
      const content = '$count: number = 42';
      const ast = parser.parseModern(content);
      
      const varDecl = ast.body[0] as any;
      expect(varDecl.name).toBe('count');
      expect(varDecl.typeAnnotation.baseType).toBe('number');
      expect(varDecl.inferredType.baseType).toBe('number');
    });

    it('should throw error for type conflicts', () => {
      const content = '$name: number = "hello"';
      
      expect(() => parser.parseModern(content)).toThrow('Type validation failed');
    });

    it('should handle number/float compatibility', () => {
      const content = '$price: number = 19.99';
      
      // This should not throw an error due to number/float compatibility
      expect(() => parser.parseModern(content)).not.toThrow();
    });

    it('should handle float/number compatibility', () => {
      const content = '$count: float = 42';
      
      // This should not throw an error due to float/number compatibility
      expect(() => parser.parseModern(content)).not.toThrow();
    });

    it('should detect boolean type conflicts', () => {
      const content = '$flag: boolean = "true"';
      
      expect(() => parser.parseModern(content)).toThrow('Type validation failed');
    });

    it('should detect string type conflicts', () => {
      const content = '$message: string = 123';
      
      expect(() => parser.parseModern(content)).toThrow('Type validation failed');
    });
  });

  describe('modern syntax parsing - $ prefix function declarations', () => {
    describe('basic $ prefix function parsing', () => {
      it('should parse simple $ prefix arrow function', () => {
        const content = '$add = (a, b) => a + b';
        const ast = parser.parseModern(content);
        
        expect(ast.type).toBe('Program');
        expect(ast.syntaxVersion).toBe('modern');
        expect(ast.body).toHaveLength(1);
        
        const funcDecl = ast.body[0] as any;
        expect(funcDecl.type).toBe('FunctionDeclaration');
        expect(funcDecl.name).toBe('add');
        expect(funcDecl.hasDollarPrefix).toBe(true);
        expect(funcDecl.isArrow).toBe(true);
        expect(funcDecl.autoBindThis).toBe(true);
        expect(funcDecl.async).toBe(false);
        expect(funcDecl.parameters).toHaveLength(2);
        expect(funcDecl.parameters[0].name).toBe('a');
        expect(funcDecl.parameters[1].name).toBe('b');
      });

      it('should parse $ prefix function with no parameters', () => {
        const content = '$getValue = () => 42';
        const ast = parser.parseModern(content);
        
        const funcDecl = ast.body[0] as any;
        expect(funcDecl.name).toBe('getValue');
        expect(funcDecl.parameters).toHaveLength(0);
        expect(funcDecl.body.type).toBe('BlockStatement');
      });

      it('should parse $ prefix function with single parameter', () => {
        const content = '$double = (x) => x * 2';
        const ast = parser.parseModern(content);
        
        const funcDecl = ast.body[0] as any;
        expect(funcDecl.name).toBe('double');
        expect(funcDecl.parameters).toHaveLength(1);
        expect(funcDecl.parameters[0].name).toBe('x');
      });

      it('should parse $ prefix function with multiple parameters', () => {
        const content = '$calculate = (a, b, c) => a + b * c';
        const ast = parser.parseModern(content);
        
        const funcDecl = ast.body[0] as any;
        expect(funcDecl.name).toBe('calculate');
        expect(funcDecl.parameters).toHaveLength(3);
        expect(funcDecl.parameters[0].name).toBe('a');
        expect(funcDecl.parameters[1].name).toBe('b');
        expect(funcDecl.parameters[2].name).toBe('c');
      });
    });

    describe('function parameter type annotations', () => {
      it('should parse function with typed parameters', () => {
        const content = '$add = (a: number, b: number) => a + b';
        const ast = parser.parseModern(content);
        
        const funcDecl = ast.body[0] as any;
        expect(funcDecl.parameters).toHaveLength(2);
        expect(funcDecl.parameters[0].typeAnnotation.baseType).toBe('number');
        expect(funcDecl.parameters[1].typeAnnotation.baseType).toBe('number');
        expect(funcDecl.parameters[0].inferredType.baseType).toBe('number');
        expect(funcDecl.parameters[1].inferredType.baseType).toBe('number');
      });

      it('should parse function with mixed typed and untyped parameters', () => {
        const content = '$process = (data: string, count) => data.repeat(count)';
        const ast = parser.parseModern(content);
        
        const funcDecl = ast.body[0] as any;
        expect(funcDecl.parameters).toHaveLength(2);
        expect(funcDecl.parameters[0].typeAnnotation.baseType).toBe('string');
        expect(funcDecl.parameters[1].typeAnnotation).toBeUndefined();
        expect(funcDecl.parameters[0].inferredType.baseType).toBe('string');
        expect(funcDecl.parameters[1].inferredType.baseType).toBe('any');
      });

      it('should parse function with default parameter values', () => {
        const content = '$greet = (name: string = "World") => "Hello " + name';
        const ast = parser.parseModern(content);
        
        const funcDecl = ast.body[0] as any;
        expect(funcDecl.parameters).toHaveLength(1);
        expect(funcDecl.parameters[0].name).toBe('name');
        expect(funcDecl.parameters[0].typeAnnotation.baseType).toBe('string');
        expect(funcDecl.parameters[0].defaultValue.type).toBe('Literal');
        expect(funcDecl.parameters[0].defaultValue.value).toBe('World');
      });

      it('should infer parameter types from default values', () => {
        const content = '$multiply = (x = 1, y = 2) => x * y';
        const ast = parser.parseModern(content);
        
        const funcDecl = ast.body[0] as any;
        expect(funcDecl.parameters).toHaveLength(2);
        expect(funcDecl.parameters[0].inferredType.baseType).toBe('number');
        expect(funcDecl.parameters[1].inferredType.baseType).toBe('number');
      });
    });

    describe('function return type annotations', () => {
      it('should parse function with explicit return type', () => {
        const content = '$add: (a: number, b: number): number => a + b';
        const ast = parser.parseModern(content);
        
        const funcDecl = ast.body[0] as any;
        expect(funcDecl.returnType.baseType).toBe('number');
        expect(funcDecl.inferredReturnType.baseType).toBe('number');
      });

      it('should parse function with return type after parameters', () => {
        const content = '$calculate = (x: number, y: number): number => x + y';
        const ast = parser.parseModern(content);
        
        const funcDecl = ast.body[0] as any;
        expect(funcDecl.returnType.baseType).toBe('number');
      });

      it('should infer return type when not explicitly provided', () => {
        const content = '$getValue = () => 42';
        const ast = parser.parseModern(content);
        
        const funcDecl = ast.body[0] as any;
        expect(funcDecl.returnType).toBeUndefined();
        expect(funcDecl.inferredReturnType).toBeDefined();
      });
    });

    describe('async function support', () => {
      it('should parse async function with $ prefix', () => {
        const content = '$fetchData = async (url) => fetch(url)';
        const ast = parser.parseModern(content);
        
        const funcDecl = ast.body[0] as any;
        expect(funcDecl.name).toBe('fetchData');
        expect(funcDecl.async).toBe(true);
        expect(funcDecl.parameters).toHaveLength(1);
        expect(funcDecl.parameters[0].name).toBe('url');
      });

      it('should parse async function with typed parameters', () => {
        const content = '$loadUser = async (id: number): Promise<any> => await getUserById(id)';
        const ast = parser.parseModern(content);
        
        const funcDecl = ast.body[0] as any;
        expect(funcDecl.name).toBe('loadUser');
        expect(funcDecl.async).toBe(true);
        expect(funcDecl.parameters[0].typeAnnotation.baseType).toBe('number');
        expect(funcDecl.returnType.baseType).toBe('Promise');
      });

      it('should parse async function with block body', () => {
        const content = '$processAsync = async (data) => { return await process(data); }';
        const ast = parser.parseModern(content);
        
        const funcDecl = ast.body[0] as any;
        expect(funcDecl.name).toBe('processAsync');
        expect(funcDecl.async).toBe(true);
        expect(funcDecl.body.type).toBe('BlockStatement');
      });

      it('should infer Promise return type for async functions', () => {
        const content = '$asyncFunc = async () => "result"';
        const ast = parser.parseModern(content);
        
        const funcDecl = ast.body[0] as any;
        expect(funcDecl.async).toBe(true);
        expect(funcDecl.inferredReturnType.baseType).toBe('object'); // Promise<T>
        expect(funcDecl.inferredReturnType.generic).toBeDefined();
      });
    });

    describe('function body parsing', () => {
      it('should parse function with expression body', () => {
        const content = '$add = (a, b) => a + b';
        const ast = parser.parseModern(content);
        
        const funcDecl = ast.body[0] as any;
        expect(funcDecl.body.type).toBe('BlockStatement');
        expect(funcDecl.body.body).toHaveLength(1);
        expect(funcDecl.body.body[0].type).toBe('ReturnStatement');
      });

      it('should parse function with block body', () => {
        const content = '$complex = (x) => { const result = x * 2; return result; }';
        const ast = parser.parseModern(content);
        
        const funcDecl = ast.body[0] as any;
        expect(funcDecl.body.type).toBe('BlockStatement');
        expect(funcDecl.body.body.length).toBeGreaterThan(0);
      });
    });

    describe('reactive functions', () => {
      it('should parse reactive function with ! suffix', () => {
        const content = '$handler! = (event) => console.log(event)';
        const ast = parser.parseModern(content);
        
        const funcDecl = ast.body[0] as any;
        expect(funcDecl.name).toBe('handler');
        expect(funcDecl.hasReactiveSuffix).toBe(true);
      });

      it('should parse reactive async function', () => {
        const content = '$asyncHandler! = async (data) => await processData(data)';
        const ast = parser.parseModern(content);
        
        const funcDecl = ast.body[0] as any;
        expect(funcDecl.name).toBe('asyncHandler');
        expect(funcDecl.hasReactiveSuffix).toBe(true);
        expect(funcDecl.async).toBe(true);
      });
    });

    describe('multiple function declarations', () => {
      it('should parse multiple $ prefix functions', () => {
        const content = `
$add = (a, b) => a + b
$subtract = (a, b) => a - b
$multiply = (a, b) => a * b
`;
        const ast = parser.parseModern(content);
        
        expect(ast.body).toHaveLength(3);
        expect(ast.body[0].name).toBe('add');
        expect(ast.body[1].name).toBe('subtract');
        expect(ast.body[2].name).toBe('multiply');
        ast.body.forEach((func: any) => {
          expect(func.type).toBe('FunctionDeclaration');
          expect(func.hasDollarPrefix).toBe(true);
          expect(func.isArrow).toBe(true);
        });
      });

      it('should parse mixed variables and functions', () => {
        const content = `
$count = 0
$increment = () => $count++
$name = "test"
$greet = (person) => "Hello " + person
`;
        const ast = parser.parseModern(content);
        
        expect(ast.body).toHaveLength(4);
        expect(ast.body[0].type).toBe('VariableDeclaration');
        expect(ast.body[1].type).toBe('FunctionDeclaration');
        expect(ast.body[2].type).toBe('VariableDeclaration');
        expect(ast.body[3].type).toBe('FunctionDeclaration');
      });
    });

    describe('optional semicolons with functions', () => {
      it('should parse functions with semicolons', () => {
        const content = `
$add = (a, b) => a + b;
$subtract = (a, b) => a - b;
`;
        const ast = parser.parseModern(content);
        
        expect(ast.body).toHaveLength(2);
        expect(ast.body[0].name).toBe('add');
        expect(ast.body[1].name).toBe('subtract');
      });

      it('should parse functions without semicolons', () => {
        const content = `
$add = (a, b) => a + b
$subtract = (a, b) => a - b
`;
        const ast = parser.parseModern(content);
        
        expect(ast.body).toHaveLength(2);
        expect(ast.body[0].name).toBe('add');
        expect(ast.body[1].name).toBe('subtract');
      });
    });

    describe('error handling for functions', () => {
      it('should throw error for missing parameter list', () => {
        const content = '$func = => 42';
        expect(() => parser.parseModern(content)).toThrow("Unexpected token");
      });

      it('should throw error for missing arrow', () => {
        const content = '$func = (a, b) 42';
        expect(() => parser.parseModern(content)).toThrow("Expected '=>' for arrow function");
      });

      it('should throw error for invalid parameter syntax', () => {
        const content = '$func = (a:) => 42';
        expect(() => parser.parseModern(content)).toThrow('Expected type name');
      });

      it('should throw error for missing closing parenthesis', () => {
        const content = '$func = (a, b => 42';
        expect(() => parser.parseModern(content)).toThrow("Expected ')' after function parameters");
      });
    });

    describe('automatic this binding', () => {
      it('should set autoBindThis to true for all $ prefix arrow functions', () => {
        const content = `
$method = () => this.value
$asyncMethod = async () => this.data
$paramMethod = (x) => this.process(x)
`;
        const ast = parser.parseModern(content);
        
        ast.body.forEach((func: any) => {
          expect(func.autoBindThis).toBe(true);
        });
      });
    });

    describe('type inference for functions', () => {
      it('should register function type for future reference', () => {
        const content = '$add = (a: number, b: number): number => a + b';
        const ast = parser.parseModern(content);
        
        // The function should be registered in the type inference engine
        // This would be tested by checking if the function can be referenced later
        const funcDecl = ast.body[0] as any;
        expect(funcDecl.name).toBe('add');
        expect(funcDecl.parameters[0].inferredType.baseType).toBe('number');
        expect(funcDecl.parameters[1].inferredType.baseType).toBe('number');
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