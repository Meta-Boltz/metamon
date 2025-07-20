/**
 * Cross-framework compatibility tests for modern MTM syntax
 * Tests state synchronization and behavior consistency across frameworks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnhancedMTMParser } from '../parser/enhanced-mtm-parser.js';
import { ReactTransformer } from '../transformers/react-transformer.js';
import { VueTransformer } from '../transformers/vue-transformer.js';
import { SvelteTransformer } from '../transformers/svelte-transformer.js';
import { ReactiveVariableAnalyzer } from '../reactive/reactive-analyzer.js';
import { UpdateBatcher } from '../reactive/update-batcher.js';
import type { ProgramNode, ReactiveVariableNode } from '../types/unified-ast.js';

describe('Cross-Framework Compatibility Tests', () => {
  let parser: EnhancedMTMParser;
  let reactTransformer: ReactTransformer;
  let vueTransformer: VueTransformer;
  let svelteTransformer: SvelteTransformer;
  let reactiveAnalyzer: ReactiveVariableAnalyzer;
  let updateBatcher: UpdateBatcher;

  beforeEach(() => {
    parser = new EnhancedMTMParser();
    reactTransformer = new ReactTransformer();
    vueTransformer = new VueTransformer();
    svelteTransformer = new SvelteTransformer();
    reactiveAnalyzer = new ReactiveVariableAnalyzer();
    updateBatcher = new UpdateBatcher();
  });

  describe('State Synchronization Between Frameworks', () => {
    it('should synchronize reactive variables across React and Vue components', () => {
      const sharedStateSyntax = `
$sharedCounter! = 0
$sharedMessage! = "Hello from shared state"

$updateCounter = (value: number) => {
  $sharedCounter = value
}

$updateMessage = (msg: string) => {
  $sharedMessage = msg
}`;

      // Parse for React
      const reactSyntax = `---\ntarget: reactjs\n---\n${sharedStateSyntax}`;
      const reactAST = parser.parse(reactSyntax, 'react-shared.mtm');
      const reactTransformed = reactTransformer.transform(reactAST);

      // Parse for Vue
      const vueSyntax = `---\ntarget: vue\n---\n${sharedStateSyntax}`;
      const vueAST = parser.parse(vueSyntax, 'vue-shared.mtm');
      const vueTransformed = vueTransformer.transform(vueAST);

      // Both should have same reactive variables
      const reactReactiveVars = reactAST.body.filter(node => 
        node.type === 'VariableDeclaration' && (node as any).isReactive
      );
      const vueReactiveVars = vueAST.body.filter(node => 
        node.type === 'VariableDeclaration' && (node as any).isReactive
      );

      expect(reactReactiveVars).toHaveLength(2);
      expect(vueReactiveVars).toHaveLength(2);
      
      // Variable names should match
      const reactVarNames = reactReactiveVars.map(v => (v as any).name).sort();
      const vueVarNames = vueReactiveVars.map(v => (v as any).name).sort();
      expect(reactVarNames).toEqual(vueVarNames);
    });

    it('should maintain consistent state updates across Svelte and React', () => {
      const complexStateSyntax = `
$user! = { 
  id: 1, 
  name: "John", 
  preferences: { theme: "dark", lang: "en" } 
}

$updateUserName = (newName: string) => {
  $user.name = newName
}

$updateTheme = (theme: string) => {
  $user.preferences.theme = theme
}

$resetUser = () => {
  $user = { id: 1, name: "Anonymous", preferences: { theme: "light", lang: "en" } }
}`;

      // Parse for React
      const reactSyntax = `---\ntarget: reactjs\n---\n${complexStateSyntax}`;
      const reactAST = parser.parse(reactSyntax, 'react-complex.mtm');

      // Parse for Svelte
      const svelteSyntax = `---\ntarget: svelte\n---\n${complexStateSyntax}`;
      const svelteAST = parser.parse(svelteSyntax, 'svelte-complex.mtm');

      // Analyze reactive dependencies
      const reactGraph = reactiveAnalyzer.analyzeReactiveVariables(reactAST);
      const svelteGraph = reactiveAnalyzer.analyzeReactiveVariables(svelteAST);

      // Both should have same dependency structure
      expect(reactGraph.variables.size).toBe(svelteGraph.variables.size);
      expect(reactGraph.variables.has('user')).toBe(true);
      expect(svelteGraph.variables.has('user')).toBe(true);

      // Object type inference should be consistent
      const reactUserVar = reactGraph.variables.get('user');
      const svelteUserVar = svelteGraph.variables.get('user');
      
      expect(reactUserVar?.inferredType.baseType).toBe('object');
      expect(svelteUserVar?.inferredType.baseType).toBe('object');
    });

    it('should handle array state synchronization across all frameworks', () => {
      const arrayStateSyntax = `
$items! = [
  { id: 1, text: "Item 1", completed: false },
  { id: 2, text: "Item 2", completed: true }
]

$addItem = (text: string) => {
  const newId = Math.max(...$items.map(item => item.id)) + 1
  $items.push({ id: newId, text, completed: false })
}

$toggleItem = (id: number) => {
  const item = $items.find(item => item.id === id)
  if (item) {
    item.completed = !item.completed
  }
}

$removeItem = (id: number) => {
  $items = $items.filter(item => item.id !== id)
}`;

      const frameworks = ['reactjs', 'vue', 'svelte'];
      const asts = frameworks.map(framework => {
        const syntax = `---\ntarget: ${framework}\n---\n${arrayStateSyntax}`;
        return parser.parse(syntax, `${framework}-array.mtm`);
      });

      // All should have same array variable structure
      asts.forEach(ast => {
        const itemsVar = ast.body.find(node => 
          node.type === 'VariableDeclaration' && (node as any).name === 'items'
        ) as any;
        
        expect(itemsVar?.isReactive).toBe(true);
        expect(itemsVar?.inferredType.baseType).toBe('array');
        
        // Should have array manipulation functions
        const functions = ast.body.filter(node => 
          node.type === 'FunctionDeclaration'
        );
        expect(functions).toHaveLength(3); // addItem, toggleItem, removeItem
      });
    });
  });

  describe('Reactive Variable Behavior Across Framework Boundaries', () => {
    it('should maintain reactive dependencies when crossing framework boundaries', () => {
      const crossFrameworkSyntax = `
$baseValue! = 10
$multiplier! = 2
$result! = $baseValue * $multiplier
$formatted! = \`Result: \${$result}\`

$updateBase = (value: number) => {
  $baseValue = value
}`;

      const frameworks = ['reactjs', 'vue', 'svelte'];
      const graphs = frameworks.map(framework => {
        const syntax = `---\ntarget: ${framework}\n---\n${crossFrameworkSyntax}`;
        const ast = parser.parse(syntax, `${framework}-deps.mtm`);
        return reactiveAnalyzer.analyzeReactiveVariables(ast);
      });

      // All frameworks should have same dependency chains
      graphs.forEach(graph => {
        const resultVar = graph.variables.get('result');
        const formattedVar = graph.variables.get('formatted');
        
        expect(resultVar?.dependencies).toContain('baseValue');
        expect(resultVar?.dependencies).toContain('multiplier');
        expect(formattedVar?.dependencies).toContain('result');
        
        // Check update chains
        const updateChains = graph.updateChains;
        const baseValueChain = updateChains.find(chain => 
          chain.trigger === 'baseValue'
        );
        
        expect(baseValueChain?.affected).toContain('result');
        expect(baseValueChain?.affected).toContain('formatted');
      });
    });

    it('should batch updates consistently across frameworks', () => {
      const batchUpdateSyntax = `
$count1! = 0
$count2! = 0
$count3! = 0
$total! = $count1 + $count2 + $count3

$updateAll = () => {
  $count1++
  $count2++
  $count3++
}`;

      const frameworks = ['reactjs', 'vue', 'svelte'];
      
      frameworks.forEach(framework => {
        const syntax = `---\ntarget: ${framework}\n---\n${batchUpdateSyntax}`;
        const ast = parser.parse(syntax, `${framework}-batch.mtm`);
        const graph = reactiveAnalyzer.analyzeReactiveVariables(ast);
        
        // Simulate batch update
        const updates = [
          { variable: 'count1', value: 1 },
          { variable: 'count2', value: 1 },
          { variable: 'count3', value: 1 }
        ];
        
        const batchedUpdates = updateBatcher.batchUpdates(updates, graph);
        
        // Should batch all updates together since they affect same dependent
        expect(batchedUpdates.batches).toHaveLength(1);
        expect(batchedUpdates.batches[0].updates).toHaveLength(3);
        expect(batchedUpdates.batches[0].affectedVariables).toContain('total');
      });
    });

    it('should handle async reactive updates across frameworks', () => {
      const asyncReactiveSyntax = `
$loading! = false
$data! = null
$error! = null
$hasData! = $data !== null && !$loading && !$error

$fetchData = async (url: string) => {
  $loading = true
  $error = null
  
  try {
    const response = await fetch(url)
    $data = await response.json()
  } catch (err) {
    $error = err.message
  } finally {
    $loading = false
  }
}`;

      const frameworks = ['reactjs', 'vue', 'svelte'];
      
      frameworks.forEach(framework => {
        const syntax = `---\ntarget: ${framework}\n---\n${asyncReactiveSyntax}`;
        const ast = parser.parse(syntax, `${framework}-async.mtm`);
        const graph = reactiveAnalyzer.analyzeReactiveVariables(ast);
        
        // hasData should depend on all three state variables
        const hasDataVar = graph.variables.get('hasData');
        expect(hasDataVar?.dependencies).toContain('data');
        expect(hasDataVar?.dependencies).toContain('loading');
        expect(hasDataVar?.dependencies).toContain('error');
        
        // Async function should be detected
        const fetchFunc = ast.body.find(node => 
          node.type === 'FunctionDeclaration' && (node as any).name === 'fetchData'
        ) as any;
        expect(fetchFunc?.async).toBe(true);
      });
    });
  });

  describe('Mixed Legacy/Modern Syntax Projects', () => {
    it('should handle projects with both legacy and modern syntax files', () => {
      const legacySyntax = `---
target: reactjs
---

// Legacy syntax
const counter = signal(0);
const increment = () => counter.set(counter.get() + 1);

return template(\`
  <button onclick="\${increment}">Count: \${counter}</button>
\`)`;

      const modernSyntax = `---
target: reactjs
---

// Modern syntax
$counter! = 0
$increment = () => $counter++

return template(\`
  <button click="$increment()">Count: {{$counter}}</button>
\`)`;

      // Parse both syntaxes
      const legacyAST = parser.parse(legacySyntax, 'legacy.mtm');
      const modernAST = parser.parse(modernSyntax, 'modern.mtm');

      expect(legacyAST.syntaxVersion).toBe('legacy');
      expect(modernAST.syntaxVersion).toBe('modern');

      // Both should be transformable to same framework
      const legacyTransformed = reactTransformer.transform(legacyAST);
      const modernTransformed = reactTransformer.transform(modernAST);

      expect(legacyTransformed).toBeDefined();
      expect(modernTransformed).toBeDefined();
    });

    it('should provide migration suggestions for mixed syntax projects', () => {
      const mixedSyntax = `---
target: vue
---

// Mix of legacy and modern
const oldCounter = signal(0);
$newCounter! = 0

const oldIncrement = () => oldCounter.set(oldCounter.get() + 1);
$newIncrement = () => $newCounter++

return template(\`
  <div>
    <button onclick="\${oldIncrement}">Old: \${oldCounter}</button>
    <button click="$newIncrement()">New: {{$newCounter}}</button>
  </div>
\`)`;

      const ast = parser.parse(mixedSyntax, 'mixed.mtm');
      
      // Should detect mixed syntax
      expect(ast.syntaxVersion).toBe('mixed');
      
      // Should have both legacy and modern features
      const hasLegacyFeatures = ast.body.some(node => 
        node.type === 'CallExpression' && (node as any).callee?.name === 'signal'
      );
      const hasModernFeatures = ast.body.some(node => 
        node.type === 'VariableDeclaration' && (node as any).hasDollarPrefix
      );
      
      expect(hasLegacyFeatures).toBe(true);
      expect(hasModernFeatures).toBe(true);
    });
  });

  describe('Error Handling Consistency Across Frameworks', () => {
    it('should provide consistent error messages for type conflicts', () => {
      const typeErrorSyntax = `---
target: {FRAMEWORK}
---

$number: number = "string"
$array: string[] = { not: "array" }`;

      const frameworks = ['reactjs', 'vue', 'svelte'];
      const errors: Error[] = [];

      frameworks.forEach(framework => {
        const syntax = typeErrorSyntax.replace('{FRAMEWORK}', framework);
        try {
          parser.parse(syntax, `${framework}-type-error.mtm`);
        } catch (error) {
          errors.push(error as Error);
        }
      });

      // All frameworks should throw similar errors
      expect(errors).toHaveLength(3);
      errors.forEach(error => {
        expect(error.message).toContain('type');
        expect(error.message).toContain('conflict');
      });
    });

    it('should handle reactive variable errors consistently', () => {
      const reactiveErrorSyntax = `---
target: {FRAMEWORK}
---

$counter! = "not a number"
$increment = () => {
  $counter++ // Error: can't increment string
}`;

      const frameworks = ['reactjs', 'vue', 'svelte'];
      const errors: Error[] = [];

      frameworks.forEach(framework => {
        const syntax = reactiveErrorSyntax.replace('{FRAMEWORK}', framework);
        try {
          const ast = parser.parse(syntax, `${framework}-reactive-error.mtm`);
          // Error should be caught during analysis
          reactiveAnalyzer.analyzeReactiveVariables(ast);
        } catch (error) {
          errors.push(error as Error);
        }
      });

      expect(errors.length).toBeGreaterThan(0);
      errors.forEach(error => {
        expect(error.message).toMatch(/increment|operator|type/i);
      });
    });

    it('should provide helpful suggestions for framework-specific issues', () => {
      const frameworkSpecificErrors = {
        reactjs: `---
target: reactjs
---

$state! = { value: 0 }
$updateState = () => {
  $state.value++ // React: should use setState pattern
}`,
        vue: `---
target: vue
---

$ref! = null
$updateRef = () => {
  $ref.value = "new value" // Vue: ref access pattern
}`,
        svelte: `---
target: svelte
---

$store! = writable(0)
$updateStore = () => {
  $store++ // Svelte: store update pattern
}`
      };

      Object.entries(frameworkSpecificErrors).forEach(([framework, syntax]) => {
        try {
          const ast = parser.parse(syntax, `${framework}-specific.mtm`);
          // Should parse but may have framework-specific warnings
          expect(ast).toBeDefined();
        } catch (error) {
          // If error occurs, should be framework-specific
          expect((error as Error).message).toContain(framework);
        }
      });
    });
  });

  describe('Performance Consistency Across Frameworks', () => {
    it('should have similar compilation times across frameworks', () => {
      const complexSyntax = `
${Array.from({ length: 50 }, (_, i) => `$var${i}! = ${i}`).join('\n')}

${Array.from({ length: 25 }, (_, i) => `
$func${i} = (param: number) => {
  return $var${i} * param
}`).join('\n')}

return template(\`
  <div>
    ${Array.from({ length: 50 }, (_, i) => `<span>{{$var${i}}}</span>`).join('\n    ')}
  </div>
\`)`;

      const frameworks = ['reactjs', 'vue', 'svelte'];
      const compilationTimes: number[] = [];

      frameworks.forEach(framework => {
        const syntax = `---\ntarget: ${framework}\n---\n${complexSyntax}`;
        
        const startTime = performance.now();
        const ast = parser.parse(syntax, `${framework}-perf.mtm`);
        
        // Transform based on framework
        if (framework === 'reactjs') {
          reactTransformer.transform(ast);
        } else if (framework === 'vue') {
          vueTransformer.transform(ast);
        } else {
          svelteTransformer.transform(ast);
        }
        
        const endTime = performance.now();
        compilationTimes.push(endTime - startTime);
      });

      // Compilation times should be within reasonable range of each other
      const maxTime = Math.max(...compilationTimes);
      const minTime = Math.min(...compilationTimes);
      const ratio = maxTime / minTime;
      
      expect(ratio).toBeLessThan(3); // No framework should be 3x slower than others
    });

    it('should have consistent memory usage patterns', () => {
      const memorySyntax = `
${Array.from({ length: 100 }, (_, i) => `$data${i}! = { id: ${i}, value: "item${i}" }`).join('\n')}

$processAll = () => {
  ${Array.from({ length: 100 }, (_, i) => `$data${i}.processed = true`).join('\n  ')}
}`;

      const frameworks = ['reactjs', 'vue', 'svelte'];
      const memoryUsages: number[] = [];

      frameworks.forEach(framework => {
        const syntax = `---\ntarget: ${framework}\n---\n${memorySyntax}`;
        
        const initialMemory = process.memoryUsage().heapUsed;
        const ast = parser.parse(syntax, `${framework}-memory.mtm`);
        
        // Transform and analyze
        const graph = reactiveAnalyzer.analyzeReactiveVariables(ast);
        const finalMemory = process.memoryUsage().heapUsed;
        
        memoryUsages.push(finalMemory - initialMemory);
      });

      // Memory usage should be consistent across frameworks
      const maxMemory = Math.max(...memoryUsages);
      const minMemory = Math.min(...memoryUsages);
      const ratio = maxMemory / minMemory;
      
      expect(ratio).toBeLessThan(2); // No framework should use 2x more memory
    });
  });
});