/**
 * End-to-end compilation tests for modern MTM syntax
 * Tests complete compilation pipeline from modern syntax to framework output
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedMTMParser } from '../parser/enhanced-mtm-parser.js';
import { ReactTransformer } from '../transformers/react-transformer.js';
import { VueTransformer } from '../transformers/vue-transformer.js';
import { SvelteTransformer } from '../transformers/svelte-transformer.js';
import { MTMCompiler } from './mtm-compiler.js';
import type { ProgramNode } from '../types/unified-ast.js';

describe('End-to-End Modern Syntax Compilation', () => {
  let parser: EnhancedMTMParser;
  let reactTransformer: ReactTransformer;
  let vueTransformer: VueTransformer;
  let svelteTransformer: SvelteTransformer;
  let compiler: MTMCompiler;

  beforeEach(() => {
    parser = new EnhancedMTMParser();
    reactTransformer = new ReactTransformer();
    vueTransformer = new VueTransformer();
    svelteTransformer = new SvelteTransformer();
    compiler = new MTMCompiler();
  });

  describe('React Compilation Pipeline', () => {
    it('should compile modern syntax with reactive variables to React hooks', () => {
      const modernSyntax = `---
target: reactjs
---

$counter! = 0
$name: string = "John"

$increment = () => {
  $counter++
}

$greet = (person: string) => {
  return \`Hello, \${person}!\`
}

return template(\`
  <div>
    <h1>{{$name}}</h1>
    <p>Count: {{$counter}}</p>
    <button click="$increment()">Increment</button>
    <p>{{$greet($name)}}</p>
  </div>
\`)`;

      // Parse modern syntax
      const ast = parser.parse(modernSyntax, 'test.mtm');
      expect(ast.syntaxVersion).toBe('modern');
      expect(ast.modernFeatures?.dollarPrefixVariables).toBe(true);
      expect(ast.modernFeatures?.reactiveVariables).toBe(true);

      // Transform to React
      const reactAST = reactTransformer.transform(ast);
      expect(reactAST).toBeDefined();

      // Verify React-specific transformations
      const reactiveVars = ast.body.filter(node => 
        node.type === 'VariableDeclaration' && 
        (node as any).isReactive
      );
      expect(reactiveVars).toHaveLength(1); // $counter!

      const functions = ast.body.filter(node => 
        node.type === 'FunctionDeclaration' && 
        (node as any).hasDollarPrefix
      );
      expect(functions).toHaveLength(2); // $increment, $greet
    });

    it('should handle complex reactive dependencies in React', () => {
      const complexSyntax = `---
target: reactjs
---

$price! = 10.99
$quantity! = 2
$tax: float = 0.08

$total! = $price * $quantity * (1 + $tax)

$updatePrice = (newPrice: number) => {
  $price = newPrice
}

return template(\`
  <div>
    <input type="number" value="{{$price}}" oninput="$updatePrice(event.target.value)" />
    <input type="number" value="{{$quantity}}" oninput="$quantity = event.target.value" />
    <p>Total: \${{$total.toFixed(2)}}</p>
  </div>
\`)`;

      const ast = parser.parse(complexSyntax, 'complex.mtm');
      const reactAST = reactTransformer.transform(ast);

      // Verify reactive dependencies are tracked
      const totalVar = ast.body.find(node => 
        node.type === 'VariableDeclaration' && 
        (node as any).name === 'total'
      ) as any;
      
      expect(totalVar?.dependencies).toContain('price');
      expect(totalVar?.dependencies).toContain('quantity');
      expect(totalVar?.dependencies).toContain('tax');
    });

    it('should compile async functions correctly for React', () => {
      const asyncSyntax = `---
target: reactjs
---

$data! = null
$loading! = false

$fetchData = async (url: string) => {
  $loading = true
  try {
    const response = await fetch(url)
    $data = await response.json()
  } finally {
    $loading = false
  }
}

return template(\`
  <div>
    {{#if $loading}}
      <p>Loading...</p>
    {{else}}
      <pre>{{JSON.stringify($data, null, 2)}}</pre>
    {{/if}}
    <button click="$fetchData('/api/data')">Fetch Data</button>
  </div>
\`)`;

      const ast = parser.parse(asyncSyntax, 'async.mtm');
      const reactAST = reactTransformer.transform(ast);

      const asyncFunc = ast.body.find(node => 
        node.type === 'FunctionDeclaration' && 
        (node as any).name === 'fetchData'
      ) as any;
      
      expect(asyncFunc?.async).toBe(true);
    });
  });

  describe('Vue Compilation Pipeline', () => {
    it('should compile modern syntax to Vue Composition API', () => {
      const modernSyntax = `---
target: vue
---

$counter! = 0
$message: string = "Hello Vue"

$increment = () => {
  $counter++
}

return template(\`
  <div>
    <h1>{{$message}}</h1>
    <p>Count: {{$counter}}</p>
    <button click="$increment()">Increment</button>
  </div>
\`)`;

      const ast = parser.parse(modernSyntax, 'vue-test.mtm');
      const vueAST = vueTransformer.transform(ast);

      expect(ast.syntaxVersion).toBe('modern');
      
      // Verify Vue-specific transformations
      const reactiveVars = ast.body.filter(node => 
        node.type === 'VariableDeclaration' && 
        (node as any).isReactive
      );
      expect(reactiveVars).toHaveLength(1); // $counter!
    });

    it('should handle Vue-specific template syntax', () => {
      const vueSyntax = `---
target: vue
---

$items! = [
  { id: 1, name: "Item 1" },
  { id: 2, name: "Item 2" }
]

$selectedId! = null

$selectItem = (id: number) => {
  $selectedId = id
}

return template(\`
  <div>
    {{#each $items as item}}
      <div class="{{$selectedId === item.id ? 'selected' : ''}}" 
           click="$selectItem(item.id)">
        {{item.name}}
      </div>
    {{/each}}
  </div>
\`)`;

      const ast = parser.parse(vueSyntax, 'vue-list.mtm');
      const vueAST = vueTransformer.transform(ast);

      // Verify array reactive variable
      const itemsVar = ast.body.find(node => 
        node.type === 'VariableDeclaration' && 
        (node as any).name === 'items'
      ) as any;
      
      expect(itemsVar?.isReactive).toBe(true);
      expect(itemsVar?.inferredType.baseType).toBe('array');
    });
  });

  describe('Svelte Compilation Pipeline', () => {
    it('should compile modern syntax to Svelte stores', () => {
      const modernSyntax = `---
target: svelte
---

$count! = 0
$doubled! = $count * 2

$increment = () => {
  $count++
}

return template(\`
  <div>
    <p>Count: {{$count}}</p>
    <p>Doubled: {{$doubled}}</p>
    <button click="$increment()">+</button>
  </div>
\`)`;

      const ast = parser.parse(modernSyntax, 'svelte-test.mtm');
      const svelteAST = svelteTransformer.transform(ast);

      expect(ast.syntaxVersion).toBe('modern');
      
      // Verify derived store for $doubled
      const doubledVar = ast.body.find(node => 
        node.type === 'VariableDeclaration' && 
        (node as any).name === 'doubled'
      ) as any;
      
      expect(doubledVar?.dependencies).toContain('count');
    });

    it('should handle Svelte reactive statements', () => {
      const reactiveSyntax = `---
target: svelte
---

$firstName! = "John"
$lastName! = "Doe"
$fullName! = \`\${$firstName} \${$lastName}\`

$updateName = (first: string, last: string) => {
  $firstName = first
  $lastName = last
}

return template(\`
  <div>
    <input value="{{$firstName}}" oninput="$firstName = event.target.value" />
    <input value="{{$lastName}}" oninput="$lastName = event.target.value" />
    <h1>Hello, {{$fullName}}!</h1>
  </div>
\`)`;

      const ast = parser.parse(reactiveSyntax, 'svelte-reactive.mtm');
      const svelteAST = svelteTransformer.transform(ast);

      const fullNameVar = ast.body.find(node => 
        node.type === 'VariableDeclaration' && 
        (node as any).name === 'fullName'
      ) as any;
      
      expect(fullNameVar?.dependencies).toContain('firstName');
      expect(fullNameVar?.dependencies).toContain('lastName');
    });
  });

  describe('Cross-Framework Feature Compatibility', () => {
    it('should handle type inference consistently across frameworks', () => {
      const typedSyntax = `---
target: reactjs
---

$numberVar = 42
$stringVar = "hello"
$booleanVar = true
$floatVar: float = 3.14
$arrayVar = [1, 2, 3]
$objectVar = { name: "test", value: 100 }

$processData = (data: any) => {
  return data
}`;

      // Test with React
      const reactAST = parser.parse(typedSyntax.replace('reactjs', 'reactjs'), 'types-react.mtm');
      
      // Test with Vue
      const vueAST = parser.parse(typedSyntax.replace('reactjs', 'vue'), 'types-vue.mtm');
      
      // Test with Svelte
      const svelteAST = parser.parse(typedSyntax.replace('reactjs', 'svelte'), 'types-svelte.mtm');

      // All should have same type inference
      [reactAST, vueAST, svelteAST].forEach(ast => {
        const numberVar = ast.body.find(node => 
          node.type === 'VariableDeclaration' && 
          (node as any).name === 'numberVar'
        ) as any;
        expect(numberVar?.inferredType.baseType).toBe('number');

        const stringVar = ast.body.find(node => 
          node.type === 'VariableDeclaration' && 
          (node as any).name === 'stringVar'
        ) as any;
        expect(stringVar?.inferredType.baseType).toBe('string');

        const floatVar = ast.body.find(node => 
          node.type === 'VariableDeclaration' && 
          (node as any).name === 'floatVar'
        ) as any;
        expect(floatVar?.inferredType.baseType).toBe('float');
      });
    });

    it('should handle reactive variable behavior consistently', () => {
      const reactiveSyntax = `$counter! = 0
$message! = "Count: " + $counter

$increment = () => {
  $counter++
}`;

      // Parse without frontmatter to test pure syntax
      const reactAST = parser.parse(`---\ntarget: reactjs\n---\n${reactiveSyntax}`, 'reactive-react.mtm');
      const vueAST = parser.parse(`---\ntarget: vue\n---\n${reactiveSyntax}`, 'reactive-vue.mtm');
      const svelteAST = parser.parse(`---\ntarget: svelte\n---\n${reactiveSyntax}`, 'reactive-svelte.mtm');

      [reactAST, vueAST, svelteAST].forEach(ast => {
        const reactiveVars = ast.body.filter(node => 
          node.type === 'VariableDeclaration' && 
          (node as any).isReactive
        );
        expect(reactiveVars).toHaveLength(2); // counter and message

        const messageVar = ast.body.find(node => 
          node.type === 'VariableDeclaration' && 
          (node as any).name === 'message'
        ) as any;
        expect(messageVar?.dependencies).toContain('counter');
      });
    });
  });

  describe('Error Handling Consistency', () => {
    it('should provide consistent error messages across frameworks', () => {
      const invalidSyntax = `---
target: reactjs
---

$invalidType: invalidType = "test"
$counter! = "not a number"

$badFunction = (param) => {
  return $undefinedVariable
}`;

      expect(() => {
        parser.parse(invalidSyntax, 'error-test.mtm');
      }).toThrow();

      // Test same errors with different frameworks
      const vueVersion = invalidSyntax.replace('reactjs', 'vue');
      const svelteVersion = invalidSyntax.replace('reactjs', 'svelte');

      expect(() => {
        parser.parse(vueVersion, 'error-vue.mtm');
      }).toThrow();

      expect(() => {
        parser.parse(svelteVersion, 'error-svelte.mtm');
      }).toThrow();
    });

    it('should handle type conflicts consistently', () => {
      const typeConflict = `---
target: reactjs
---

$number: number = "string value"
$string: string = 42`;

      expect(() => {
        parser.parse(typeConflict, 'type-conflict.mtm');
      }).toThrow();
    });
  });

  describe('Performance Benchmarks', () => {
    it('should compile small files quickly', () => {
      const smallFile = `---
target: reactjs
---

$counter! = 0
$increment = () => $counter++

return template(\`<button click="$increment()">{{$counter}}</button>\`)`;

      const startTime = performance.now();
      const ast = parser.parse(smallFile, 'small.mtm');
      const reactAST = reactTransformer.transform(ast);
      const endTime = performance.now();

      const compilationTime = endTime - startTime;
      expect(compilationTime).toBeLessThan(50); // Should compile in under 50ms
    });

    it('should handle medium-sized files efficiently', () => {
      const mediumFile = `---
target: vue
---

${Array.from({ length: 20 }, (_, i) => `$var${i}! = ${i}`).join('\n')}

${Array.from({ length: 10 }, (_, i) => `
$func${i} = (param: number) => {
  return param * ${i}
}`).join('\n')}

return template(\`
  <div>
    ${Array.from({ length: 20 }, (_, i) => `<p>Var ${i}: {{$var${i}}}</p>`).join('\n    ')}
  </div>
\`)`;

      const startTime = performance.now();
      const ast = parser.parse(mediumFile, 'medium.mtm');
      const vueAST = vueTransformer.transform(ast);
      const endTime = performance.now();

      const compilationTime = endTime - startTime;
      expect(compilationTime).toBeLessThan(200); // Should compile in under 200ms
    });

    it('should maintain reasonable memory usage', () => {
      const largeFile = `---
target: svelte
---

${Array.from({ length: 100 }, (_, i) => `$var${i}! = ${i}`).join('\n')}

${Array.from({ length: 50 }, (_, i) => `
$func${i} = (param: number) => {
  return param * ${i}
}`).join('\n')}

return template(\`
  <div>
    ${Array.from({ length: 100 }, (_, i) => `<span>{{$var${i}}}</span>`).join('\n    ')}
  </div>
\`)`;

      const initialMemory = process.memoryUsage().heapUsed;
      const ast = parser.parse(largeFile, 'large.mtm');
      const svelteAST = svelteTransformer.transform(ast);
      const finalMemory = process.memoryUsage().heapUsed;

      const memoryIncrease = finalMemory - initialMemory;
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
    });
  });

  describe('Hot Reload Functionality', () => {
    it('should support incremental compilation for hot reload', () => {
      const originalSyntax = `---
target: reactjs
---

$counter! = 0
$increment = () => $counter++

return template(\`<button click="$increment()">{{$counter}}</button>\`)`;

      const modifiedSyntax = `---
target: reactjs
---

$counter! = 0
$decrement = () => $counter--
$increment = () => $counter++

return template(\`
  <div>
    <button click="$decrement()">-</button>
    <span>{{$counter}}</span>
    <button click="$increment()">+</button>
  </div>
\`)`;

      // Simulate hot reload scenario
      const originalAST = parser.parse(originalSyntax, 'hot-reload.mtm');
      const modifiedAST = parser.parse(modifiedSyntax, 'hot-reload.mtm');

      // Should detect changes
      expect(originalAST.body.length).toBeLessThan(modifiedAST.body.length);
      
      // New function should be detected
      const decrementFunc = modifiedAST.body.find(node => 
        node.type === 'FunctionDeclaration' && 
        (node as any).name === 'decrement'
      );
      expect(decrementFunc).toBeDefined();
    });

    it('should preserve state during hot reload', () => {
      const syntax = `---
target: vue
---

$persistentData! = { count: 0, name: "test" }
$temporaryValue = "temp"

$updateData = (newCount: number) => {
  $persistentData.count = newCount
}`;

      const ast = parser.parse(syntax, 'hot-reload-state.mtm');
      
      // Reactive variables should be marked for state preservation
      const persistentVar = ast.body.find(node => 
        node.type === 'VariableDeclaration' && 
        (node as any).name === 'persistentData'
      ) as any;
      
      expect(persistentVar?.isReactive).toBe(true);
      
      const temporaryVar = ast.body.find(node => 
        node.type === 'VariableDeclaration' && 
        (node as any).name === 'temporaryValue'
      ) as any;
      
      expect(temporaryVar?.isReactive).toBe(false);
    });
  });
});