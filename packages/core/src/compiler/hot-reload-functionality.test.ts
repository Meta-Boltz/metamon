/**
 * Hot reload functionality tests for modern MTM syntax
 * Tests incremental compilation and state preservation during development
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnhancedMTMParser } from '../parser/enhanced-mtm-parser.js';
import { ReactTransformer } from '../transformers/react-transformer.js';
import { VueTransformer } from '../transformers/vue-transformer.js';
import { SvelteTransformer } from '../transformers/svelte-transformer.js';
import { ReactiveVariableAnalyzer } from '../reactive/reactive-analyzer.js';
import type { ProgramNode } from '../types/unified-ast.js';

interface HotReloadState {
  preservedVariables: Map<string, any>;
  changedVariables: Set<string>;
  addedVariables: Set<string>;
  removedVariables: Set<string>;
  changedFunctions: Set<string>;
}

describe('Hot Reload Functionality Tests', () => {
  let parser: EnhancedMTMParser;
  let reactTransformer: ReactTransformer;
  let vueTransformer: VueTransformer;
  let svelteTransformer: SvelteTransformer;
  let reactiveAnalyzer: ReactiveVariableAnalyzer;

  beforeEach(() => {
    parser = new EnhancedMTMParser();
    reactTransformer = new ReactTransformer();
    vueTransformer = new VueTransformer();
    svelteTransformer = new SvelteTransformer();
    reactiveAnalyzer = new ReactiveVariableAnalyzer();
  });

  const analyzeChanges = (oldAST: ProgramNode, newAST: ProgramNode): HotReloadState => {
    const oldVars = new Map();
    const newVars = new Map();
    const oldFuncs = new Map();
    const newFuncs = new Map();

    // Extract variables and functions from old AST
    oldAST.body.forEach(node => {
      if (node.type === 'VariableDeclaration') {
        oldVars.set((node as any).name, node);
      } else if (node.type === 'FunctionDeclaration') {
        oldFuncs.set((node as any).name, node);
      }
    });

    // Extract variables and functions from new AST
    newAST.body.forEach(node => {
      if (node.type === 'VariableDeclaration') {
        newVars.set((node as any).name, node);
      } else if (node.type === 'FunctionDeclaration') {
        newFuncs.set((node as any).name, node);
      }
    });

    const preservedVariables = new Map();
    const changedVariables = new Set<string>();
    const addedVariables = new Set<string>();
    const removedVariables = new Set<string>();
    const changedFunctions = new Set<string>();

    // Analyze variable changes
    for (const [name, oldVar] of oldVars) {
      if (newVars.has(name)) {
        const newVar = newVars.get(name);
        if (JSON.stringify(oldVar) !== JSON.stringify(newVar)) {
          changedVariables.add(name);
        } else if ((oldVar as any).isReactive) {
          // Preserve reactive variables that haven't changed
          preservedVariables.set(name, oldVar);
        }
      } else {
        removedVariables.add(name);
      }
    }

    for (const [name] of newVars) {
      if (!oldVars.has(name)) {
        addedVariables.add(name);
      }
    }

    // Analyze function changes
    for (const [name, oldFunc] of oldFuncs) {
      if (newFuncs.has(name)) {
        const newFunc = newFuncs.get(name);
        if (JSON.stringify(oldFunc) !== JSON.stringify(newFunc)) {
          changedFunctions.add(name);
        }
      } else {
        changedFunctions.add(name); // Removed functions are also "changed"
      }
    }

    for (const [name] of newFuncs) {
      if (!oldFuncs.has(name)) {
        changedFunctions.add(name);
      }
    }

    return {
      preservedVariables,
      changedVariables,
      addedVariables,
      removedVariables,
      changedFunctions
    };
  };

  describe('Incremental Compilation', () => {
    it('should detect minimal changes for hot reload', () => {
      const originalSyntax = `---
target: reactjs
---

$counter! = 0
$message = "Hello"

$increment = () => {
  $counter++
}

return template(\`
  <div>
    <h1>{{$message}}</h1>
    <p>Count: {{$counter}}</p>
    <button click="$increment()">+</button>
  </div>
\`)`;

      const modifiedSyntax = `---
target: reactjs
---

$counter! = 0
$message = "Hello World" // Changed initial value

$increment = () => {
  $counter++
}

$decrement = () => { // Added new function
  $counter--
}

return template(\`
  <div>
    <h1>{{$message}}</h1>
    <p>Count: {{$counter}}</p>
    <button click="$decrement()">-</button>
    <button click="$increment()">+</button>
  </div>
\`)`;

      const originalAST = parser.parse(originalSyntax, 'original.mtm');
      const modifiedAST = parser.parse(modifiedSyntax, 'modified.mtm');

      const changes = analyzeChanges(originalAST, modifiedAST);

      expect(changes.changedVariables.has('message')).toBe(true);
      expect(changes.changedVariables.has('counter')).toBe(false); // Counter unchanged
      expect(changes.addedVariables.size).toBe(0);
      expect(changes.removedVariables.size).toBe(0);
      expect(changes.changedFunctions.has('decrement')).toBe(true); // New function
      expect(changes.changedFunctions.has('increment')).toBe(false); // Unchanged function
    });

    it('should handle reactive variable additions efficiently', () => {
      const originalSyntax = `---
target: vue
---

$name! = "John"
$greeting! = \`Hello, \${$name}!\`

$updateName = (newName: string) => {
  $name = newName
}`;

      const modifiedSyntax = `---
target: vue
---

$name! = "John"
$age! = 25 // New reactive variable
$greeting! = \`Hello, \${$name}! You are \${$age} years old.\` // Updated to use age

$updateName = (newName: string) => {
  $name = newName
}

$updateAge = (newAge: number) => { // New function
  $age = newAge
}`;

      const originalAST = parser.parse(originalSyntax, 'original-vue.mtm');
      const modifiedAST = parser.parse(modifiedSyntax, 'modified-vue.mtm');

      const changes = analyzeChanges(originalAST, modifiedAST);

      expect(changes.addedVariables.has('age')).toBe(true);
      expect(changes.changedVariables.has('greeting')).toBe(true); // Changed due to age dependency
      expect(changes.preservedVariables.has('name')).toBe(true); // Should preserve name state
      expect(changes.changedFunctions.has('updateAge')).toBe(true); // New function
    });

    it('should handle reactive variable removals safely', () => {
      const originalSyntax = `---
target: svelte
---

$count! = 0
$doubled! = $count * 2
$tripled! = $count * 3
$total! = $doubled + $tripled

$increment = () => $count++`;

      const modifiedSyntax = `---
target: svelte
---

$count! = 0
$doubled! = $count * 2
// Removed $tripled
$total! = $doubled // Updated to not use tripled

$increment = () => $count++`;

      const originalAST = parser.parse(originalSyntax, 'original-svelte.mtm');
      const modifiedAST = parser.parse(modifiedSyntax, 'modified-svelte.mtm');

      const changes = analyzeChanges(originalAST, modifiedAST);

      expect(changes.removedVariables.has('tripled')).toBe(true);
      expect(changes.changedVariables.has('total')).toBe(true); // Changed due to removed dependency
      expect(changes.preservedVariables.has('count')).toBe(true);
      expect(changes.preservedVariables.has('doubled')).toBe(true);
    });
  });

  describe('State Preservation', () => {
    it('should preserve reactive variable state during hot reload', () => {
      const syntax = `---
target: reactjs
---

$counter! = 0
$history! = []

$increment = () => {
  $counter++
  $history.push(\`Incremented to \${$counter}\`)
}

$reset = () => {
  $counter = 0
  $history = []
}`;

      const ast = parser.parse(syntax, 'state-preservation.mtm');
      const graph = reactiveAnalyzer.analyzeReactiveVariables(ast);

      // Simulate current state
      const currentState = {
        counter: 5,
        history: ['Incremented to 1', 'Incremented to 2', 'Incremented to 3', 'Incremented to 4', 'Incremented to 5']
      };

      // Check which variables should be preserved
      const reactiveVars = Array.from(graph.variables.values());
      const preservableVars = reactiveVars.filter(v => v.isReactive);

      expect(preservableVars).toHaveLength(2); // counter and history
      expect(preservableVars.map(v => v.name)).toContain('counter');
      expect(preservableVars.map(v => v.name)).toContain('history');
    });

    it('should handle complex object state preservation', () => {
      const syntax = `---
target: vue
---

$user! = {
  id: 1,
  profile: {
    name: "John Doe",
    email: "john@example.com",
    preferences: {
      theme: "dark",
      notifications: true
    }
  },
  posts: []
}

$updateProfile = (field: string, value: any) => {
  $user.profile[field] = value
}

$addPost = (post: any) => {
  $user.posts.push(post)
}`;

      const ast = parser.parse(syntax, 'complex-state.mtm');
      const graph = reactiveAnalyzer.analyzeReactiveVariables(ast);

      const userVar = graph.variables.get('user');
      expect(userVar?.isReactive).toBe(true);
      expect(userVar?.inferredType.baseType).toBe('object');

      // Complex objects should be preservable
      expect(userVar?.inferredType.properties).toBeDefined();
    });

    it('should not preserve non-reactive variables', () => {
      const syntax = `---
target: svelte
---

$reactiveData! = { count: 0 }
const staticConfig = { apiUrl: "https://api.example.com" }
let temporaryValue = "temp"

$updateData = () => {
  $reactiveData.count++
  temporaryValue = "updated"
}`;

      const ast = parser.parse(syntax, 'mixed-variables.mtm');
      const graph = reactiveAnalyzer.analyzeReactiveVariables(ast);

      // Only reactive variables should be in the graph
      expect(graph.variables.has('reactiveData')).toBe(true);
      expect(graph.variables.has('staticConfig')).toBe(false);
      expect(graph.variables.has('temporaryValue')).toBe(false);

      const reactiveVar = graph.variables.get('reactiveData');
      expect(reactiveVar?.isReactive).toBe(true);
    });
  });

  describe('Dependency Update Handling', () => {
    it('should update dependent variables when dependencies change', () => {
      const originalSyntax = `---
target: reactjs
---

$price! = 10
$quantity! = 2
$total! = $price * $quantity`;

      const modifiedSyntax = `---
target: reactjs
---

$price! = 10
$quantity! = 2
$tax! = 0.1 // New variable
$total! = $price * $quantity * (1 + $tax) // Updated calculation`;

      const originalAST = parser.parse(originalSyntax, 'original-deps.mtm');
      const modifiedAST = parser.parse(modifiedSyntax, 'modified-deps.mtm');

      const originalGraph = reactiveAnalyzer.analyzeReactiveVariables(originalAST);
      const modifiedGraph = reactiveAnalyzer.analyzeReactiveVariables(modifiedAST);

      const originalTotal = originalGraph.variables.get('total');
      const modifiedTotal = modifiedGraph.variables.get('total');

      expect(originalTotal?.dependencies).toEqual(['price', 'quantity']);
      expect(modifiedTotal?.dependencies).toEqual(['price', 'quantity', 'tax']);

      const changes = analyzeChanges(originalAST, modifiedAST);
      expect(changes.addedVariables.has('tax')).toBe(true);
      expect(changes.changedVariables.has('total')).toBe(true);
    });

    it('should handle circular dependency detection during hot reload', () => {
      const problematicSyntax = `---
target: vue
---

$a! = $b + 1
$b! = $c + 1
$c! = $a + 1 // Creates circular dependency`;

      expect(() => {
        const ast = parser.parse(problematicSyntax, 'circular.mtm');
        reactiveAnalyzer.analyzeReactiveVariables(ast);
      }).toThrow(/circular|dependency/i);
    });

    it('should optimize update chains for hot reload', () => {
      const chainSyntax = `---
target: svelte
---

$input! = ""
$trimmed! = $input.trim()
$lowercase! = $trimmed.toLowerCase()
$words! = $lowercase.split(" ")
$wordCount! = $words.length
$summary! = \`Input has \${$wordCount} words\`

$updateInput = (value: string) => {
  $input = value
}`;

      const ast = parser.parse(chainSyntax, 'update-chain.mtm');
      const graph = reactiveAnalyzer.analyzeReactiveVariables(ast);

      // Check update chain from input to summary
      const inputChain = graph.updateChains.find(chain => chain.trigger === 'input');
      expect(inputChain?.affected).toContain('trimmed');
      expect(inputChain?.affected).toContain('lowercase');
      expect(inputChain?.affected).toContain('words');
      expect(inputChain?.affected).toContain('wordCount');
      expect(inputChain?.affected).toContain('summary');

      // Should be optimized for batch updates
      expect(inputChain?.batchable).toBe(true);
    });
  });

  describe('Framework-Specific Hot Reload', () => {
    it('should generate React hot reload compatible code', () => {
      const syntax = `---
target: reactjs
---

$count! = 0
$increment = () => $count++

return template(\`<button click="$increment()">{{$count}}</button>\`)`;

      const ast = parser.parse(syntax, 'react-hot-reload.mtm');
      const transformed = reactTransformer.transform(ast);

      // React hot reload should preserve hooks
      expect(transformed).toBeDefined();
      
      // Should generate useState for reactive variables
      const countVar = ast.body.find(node => 
        node.type === 'VariableDeclaration' && (node as any).name === 'count'
      ) as any;
      expect(countVar?.isReactive).toBe(true);
    });

    it('should generate Vue hot reload compatible code', () => {
      const syntax = `---
target: vue
---

$message! = "Hello"
$updateMessage = (msg: string) => {
  $message = msg
}

return template(\`
  <div>
    <input value="{{$message}}" oninput="$updateMessage(event.target.value)" />
    <p>{{$message}}</p>
  </div>
\`)`;

      const ast = parser.parse(syntax, 'vue-hot-reload.mtm');
      const transformed = vueTransformer.transform(ast);

      // Vue hot reload should preserve refs
      expect(transformed).toBeDefined();
      
      const messageVar = ast.body.find(node => 
        node.type === 'VariableDeclaration' && (node as any).name === 'message'
      ) as any;
      expect(messageVar?.isReactive).toBe(true);
    });

    it('should generate Svelte hot reload compatible code', () => {
      const syntax = `---
target: svelte
---

$items! = ["apple", "banana", "cherry"]
$newItem = ""

$addItem = () => {
  if ($newItem.trim()) {
    $items.push($newItem.trim())
    $newItem = ""
  }
}

return template(\`
  <div>
    <input value="{{$newItem}}" oninput="$newItem = event.target.value" />
    <button click="$addItem()">Add Item</button>
    <ul>
      {{#each $items as item}}
        <li>{{item}}</li>
      {{/each}}
    </ul>
  </div>
\`)`;

      const ast = parser.parse(syntax, 'svelte-hot-reload.mtm');
      const transformed = svelteTransformer.transform(ast);

      // Svelte hot reload should preserve stores
      expect(transformed).toBeDefined();
      
      const itemsVar = ast.body.find(node => 
        node.type === 'VariableDeclaration' && (node as any).name === 'items'
      ) as any;
      expect(itemsVar?.isReactive).toBe(true);
    });
  });

  describe('Error Recovery During Hot Reload', () => {
    it('should handle syntax errors gracefully during hot reload', () => {
      const validSyntax = `---
target: reactjs
---

$counter! = 0
$increment = () => $counter++`;

      const invalidSyntax = `---
target: reactjs
---

$counter! = 0
$increment = () => { $counter++ // Missing closing brace`;

      const validAST = parser.parse(validSyntax, 'valid.mtm');
      expect(validAST).toBeDefined();

      expect(() => {
        parser.parse(invalidSyntax, 'invalid.mtm');
      }).toThrow();

      // Should be able to recover and parse valid syntax again
      const recoveredAST = parser.parse(validSyntax, 'recovered.mtm');
      expect(recoveredAST).toBeDefined();
    });

    it('should handle type errors during hot reload', () => {
      const validSyntax = `---
target: vue
---

$count: number = 0
$increment = () => $count++`;

      const typeErrorSyntax = `---
target: vue
---

$count: number = "not a number"
$increment = () => $count++`;

      const validAST = parser.parse(validSyntax, 'valid-types.mtm');
      expect(validAST).toBeDefined();

      expect(() => {
        parser.parse(typeErrorSyntax, 'type-error.mtm');
      }).toThrow();
    });

    it('should preserve working state when encountering errors', () => {
      const workingSyntax = `---
target: svelte
---

$data! = { items: [1, 2, 3] }
$total! = $data.items.reduce((sum, item) => sum + item, 0)`;

      const errorSyntax = `---
target: svelte
---

$data! = { items: [1, 2, 3] }
$total! = $data.items.reduce((sum, item) => sum + item, 0)
$broken! = $undefinedVariable.someMethod() // Error`;

      const workingAST = parser.parse(workingSyntax, 'working.mtm');
      const workingGraph = reactiveAnalyzer.analyzeReactiveVariables(workingAST);

      expect(workingGraph.variables.has('data')).toBe(true);
      expect(workingGraph.variables.has('total')).toBe(true);

      // Error syntax should fail but not affect previous working state
      expect(() => {
        parser.parse(errorSyntax, 'error.mtm');
      }).toThrow();

      // Working syntax should still work after error
      const recoveredAST = parser.parse(workingSyntax, 'recovered.mtm');
      const recoveredGraph = reactiveAnalyzer.analyzeReactiveVariables(recoveredAST);

      expect(recoveredGraph.variables.has('data')).toBe(true);
      expect(recoveredGraph.variables.has('total')).toBe(true);
    });
  });

  describe('Performance During Hot Reload', () => {
    it('should perform incremental updates quickly', () => {
      const baseSyntax = `---
target: reactjs
---

${Array.from({ length: 50 }, (_, i) => `$var${i}! = ${i}`).join('\n')}

$updateAll = () => {
  ${Array.from({ length: 50 }, (_, i) => `$var${i} = $var${i} + 1`).join('\n  ')}
}`;

      const modifiedSyntax = `---
target: reactjs
---

${Array.from({ length: 50 }, (_, i) => `$var${i}! = ${i}`).join('\n')}
$newVar! = 100 // Added one new variable

$updateAll = () => {
  ${Array.from({ length: 50 }, (_, i) => `$var${i} = $var${i} + 1`).join('\n  ')}
  $newVar = $newVar + 1 // Updated function
}`;

      const startTime = performance.now();
      
      const baseAST = parser.parse(baseSyntax, 'base.mtm');
      const modifiedAST = parser.parse(modifiedSyntax, 'modified.mtm');
      const changes = analyzeChanges(baseAST, modifiedAST);
      
      const endTime = performance.now();
      const hotReloadTime = endTime - startTime;

      expect(hotReloadTime).toBeLessThan(100); // Should be fast
      expect(changes.addedVariables.has('newVar')).toBe(true);
      expect(changes.changedFunctions.has('updateAll')).toBe(true);
      expect(changes.preservedVariables.size).toBeGreaterThan(40); // Most variables preserved
    });
  });
});