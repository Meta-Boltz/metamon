/**
 * Performance benchmarks for MTM compilation pipeline
 * Tests compilation speed and memory usage across different scenarios
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedMTMParser } from '../parser/enhanced-mtm-parser.js';
import { ReactTransformer } from '../transformers/react-transformer.js';
import { VueTransformer } from '../transformers/vue-transformer.js';
import { SvelteTransformer } from '../transformers/svelte-transformer.js';
import { ReactiveVariableAnalyzer } from '../reactive/reactive-analyzer.js';
import { UpdateBatcher } from '../reactive/update-batcher.js';

interface BenchmarkResult {
  parseTime: number;
  transformTime: number;
  analyzeTime: number;
  totalTime: number;
  memoryUsage: number;
  astSize: number;
}

describe('Performance Benchmarks', () => {
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

  const runBenchmark = (
    syntax: string, 
    framework: 'reactjs' | 'vue' | 'svelte',
    filename: string
  ): BenchmarkResult => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Parse timing
    const parseStart = performance.now();
    const ast = parser.parse(syntax, filename);
    const parseEnd = performance.now();
    
    // Transform timing
    const transformStart = performance.now();
    let transformedAST;
    if (framework === 'reactjs') {
      transformedAST = reactTransformer.transform(ast);
    } else if (framework === 'vue') {
      transformedAST = vueTransformer.transform(ast);
    } else {
      transformedAST = svelteTransformer.transform(ast);
    }
    const transformEnd = performance.now();
    
    // Analysis timing
    const analyzeStart = performance.now();
    const graph = reactiveAnalyzer.analyzeReactiveVariables(ast);
    const analyzeEnd = performance.now();
    
    const finalMemory = process.memoryUsage().heapUsed;
    
    return {
      parseTime: parseEnd - parseStart,
      transformTime: transformEnd - transformStart,
      analyzeTime: analyzeEnd - analyzeStart,
      totalTime: analyzeEnd - parseStart,
      memoryUsage: finalMemory - initialMemory,
      astSize: JSON.stringify(ast).length
    };
  };

  describe('Small File Benchmarks', () => {
    it('should compile simple components quickly', () => {
      const simpleSyntax = `---
target: reactjs
---

$counter! = 0
$increment = () => $counter++

return template(\`
  <button click="$increment()">Count: {{$counter}}</button>
\`)`;

      const result = runBenchmark(simpleSyntax, 'reactjs', 'simple.mtm');
      
      expect(result.parseTime).toBeLessThan(10); // < 10ms
      expect(result.transformTime).toBeLessThan(5); // < 5ms
      expect(result.analyzeTime).toBeLessThan(5); // < 5ms
      expect(result.totalTime).toBeLessThan(20); // < 20ms total
      expect(result.memoryUsage).toBeLessThan(1024 * 1024); // < 1MB
    });

    it('should handle basic reactive variables efficiently', () => {
      const reactiveSyntax = `---
target: vue
---

$name! = "John"
$age! = 25
$greeting! = \`Hello, I'm \${$name} and I'm \${$age} years old\`

$updateName = (newName: string) => {
  $name = newName
}

return template(\`
  <div>
    <input value="{{$name}}" oninput="$updateName(event.target.value)" />
    <p>{{$greeting}}</p>
  </div>
\`)`;

      const result = runBenchmark(reactiveSyntax, 'vue', 'reactive.mtm');
      
      expect(result.parseTime).toBeLessThan(15);
      expect(result.transformTime).toBeLessThan(10);
      expect(result.analyzeTime).toBeLessThan(10);
      expect(result.totalTime).toBeLessThan(35);
    });
  });

  describe('Medium File Benchmarks', () => {
    it('should handle moderate complexity efficiently', () => {
      const mediumSyntax = `---
target: svelte
---

${Array.from({ length: 20 }, (_, i) => `$var${i}! = ${i * 10}`).join('\n')}

$total! = ${Array.from({ length: 20 }, (_, i) => `$var${i}`).join(' + ')}

${Array.from({ length: 10 }, (_, i) => `
$update${i} = (value: number) => {
  $var${i} = value
}`).join('\n')}

return template(\`
  <div>
    ${Array.from({ length: 20 }, (_, i) => `
    <div>
      <label>Var ${i}:</label>
      <input type="number" value="{{$var${i}}}" oninput="$update${Math.floor(i/2)}(event.target.value)" />
    </div>`).join('')}
    <h2>Total: {{$total}}</h2>
  </div>
\`)`;

      const result = runBenchmark(mediumSyntax, 'svelte', 'medium.mtm');
      
      expect(result.parseTime).toBeLessThan(50); // < 50ms
      expect(result.transformTime).toBeLessThan(30); // < 30ms
      expect(result.analyzeTime).toBeLessThan(40); // < 40ms
      expect(result.totalTime).toBeLessThan(120); // < 120ms total
      expect(result.memoryUsage).toBeLessThan(5 * 1024 * 1024); // < 5MB
    });

    it('should handle complex reactive dependencies', () => {
      const complexDependencySyntax = `---
target: reactjs
---

$a! = 1
$b! = 2
$c! = 3
$d! = $a + $b
$e! = $b + $c
$f! = $c + $a
$g! = $d + $e
$h! = $e + $f
$i! = $f + $d
$j! = $g + $h + $i

${Array.from({ length: 10 }, (_, i) => `
$derived${i}! = $j * ${i + 1}
$formatted${i}! = \`Value ${i}: \${$derived${i}}\``).join('\n')}

$updateBase = (which: string, value: number) => {
  if (which === 'a') $a = value
  else if (which === 'b') $b = value
  else if (which === 'c') $c = value
}

return template(\`
  <div>
    <input oninput="$updateBase('a', event.target.value)" value="{{$a}}" />
    <input oninput="$updateBase('b', event.target.value)" value="{{$b}}" />
    <input oninput="$updateBase('c', event.target.value)" value="{{$c}}" />
    
    ${Array.from({ length: 10 }, (_, i) => `<p>{{$formatted${i}}}</p>`).join('\n    ')}
    
    <h1>Final: {{$j}}</h1>
  </div>
\`)`;

      const result = runBenchmark(complexDependencySyntax, 'reactjs', 'complex-deps.mtm');
      
      expect(result.parseTime).toBeLessThan(80);
      expect(result.transformTime).toBeLessThan(60);
      expect(result.analyzeTime).toBeLessThan(100); // More time for dependency analysis
      expect(result.totalTime).toBeLessThan(240);
    });
  });

  describe('Large File Benchmarks', () => {
    it('should handle large files within reasonable time limits', () => {
      const largeSyntax = `---
target: vue
---

${Array.from({ length: 100 }, (_, i) => `$item${i}! = { id: ${i}, name: "Item ${i}", value: ${i * 100} }`).join('\n')}

$filteredItems! = [${'$item0'}${Array.from({ length: 99 }, (_, i) => `, $item${i + 1}`).join('')}].filter(item => item.value > 0)

${Array.from({ length: 50 }, (_, i) => `
$process${i} = (items: any[]) => {
  return items.map(item => ({ ...item, processed: true, batch: ${i} }))
}`).join('\n')}

$processAll = () => {
  ${Array.from({ length: 100 }, (_, i) => `$item${i}.processed = true`).join('\n  ')}
}

return template(\`
  <div>
    <button click="$processAll()">Process All</button>
    <div class="items">
      ${Array.from({ length: 100 }, (_, i) => `
      <div class="item">
        <h3>{{$item${i}.name}}</h3>
        <p>Value: {{$item${i}.value}}</p>
        <p>Processed: {{$item${i}.processed ? 'Yes' : 'No'}}</p>
      </div>`).join('')}
    </div>
    <p>Filtered Count: {{$filteredItems.length}}</p>
  </div>
\`)`;

      const result = runBenchmark(largeSyntax, 'vue', 'large.mtm');
      
      expect(result.parseTime).toBeLessThan(200); // < 200ms
      expect(result.transformTime).toBeLessThan(150); // < 150ms
      expect(result.analyzeTime).toBeLessThan(300); // < 300ms for complex analysis
      expect(result.totalTime).toBeLessThan(650); // < 650ms total
      expect(result.memoryUsage).toBeLessThan(20 * 1024 * 1024); // < 20MB
    });

    it('should maintain performance with deeply nested reactive dependencies', () => {
      const deepNestingSyntax = `---
target: svelte
---

$level0! = 1
${Array.from({ length: 20 }, (_, i) => `$level${i + 1}! = $level${i} * 2`).join('\n')}

$deepObject! = {
  ${Array.from({ length: 10 }, (_, i) => `
  level${i}: {
    value: $level${i},
    doubled: $level${i} * 2,
    nested: {
      tripled: $level${i} * 3,
      quadrupled: $level${i} * 4
    }
  }`).join(',')}
}

$updateLevel0 = (value: number) => {
  $level0 = value
}

return template(\`
  <div>
    <input type="number" value="{{$level0}}" oninput="$updateLevel0(event.target.value)" />
    
    ${Array.from({ length: 21 }, (_, i) => `<p>Level ${i}: {{$level${i}}}</p>`).join('\n    ')}
    
    <div class="deep-object">
      ${Array.from({ length: 10 }, (_, i) => `
      <div>
        <h3>Level ${i}</h3>
        <p>Value: {{$deepObject.level${i}.value}}</p>
        <p>Doubled: {{$deepObject.level${i}.doubled}}</p>
        <p>Tripled: {{$deepObject.level${i}.nested.tripled}}</p>
        <p>Quadrupled: {{$deepObject.level${i}.nested.quadrupled}}</p>
      </div>`).join('')}
    </div>
  </div>
\`)`;

      const result = runBenchmark(deepNestingSyntax, 'svelte', 'deep-nesting.mtm');
      
      expect(result.parseTime).toBeLessThan(100);
      expect(result.transformTime).toBeLessThan(80);
      expect(result.analyzeTime).toBeLessThan(200); // Complex dependency analysis
      expect(result.totalTime).toBeLessThan(380);
    });
  });

  describe('Framework Comparison Benchmarks', () => {
    it('should have similar performance across frameworks for identical logic', () => {
      const identicalLogic = `
$users! = [
  { id: 1, name: "Alice", age: 30 },
  { id: 2, name: "Bob", age: 25 },
  { id: 3, name: "Charlie", age: 35 }
]

$filter! = ""
$sortBy! = "name"

$filteredUsers! = $users.filter(user => 
  user.name.toLowerCase().includes($filter.toLowerCase())
)

$sortedUsers! = $filteredUsers.sort((a, b) => {
  if ($sortBy === "name") return a.name.localeCompare(b.name)
  if ($sortBy === "age") return a.age - b.age
  return 0
})

$updateFilter = (value: string) => {
  $filter = value
}

$updateSort = (value: string) => {
  $sortBy = value
}

return template(\`
  <div>
    <input placeholder="Filter users..." value="{{$filter}}" oninput="$updateFilter(event.target.value)" />
    <select onchange="$updateSort(event.target.value)">
      <option value="name">Sort by Name</option>
      <option value="age">Sort by Age</option>
    </select>
    
    <div class="users">
      {{#each $sortedUsers as user}}
        <div class="user">
          <h3>{{user.name}}</h3>
          <p>Age: {{user.age}}</p>
        </div>
      {{/each}}
    </div>
  </div>
\`)`;

      const frameworks: Array<'reactjs' | 'vue' | 'svelte'> = ['reactjs', 'vue', 'svelte'];
      const results = frameworks.map(framework => {
        const syntax = `---\ntarget: ${framework}\n---\n${identicalLogic}`;
        return {
          framework,
          ...runBenchmark(syntax, framework, `${framework}-comparison.mtm`)
        };
      });

      // Compare performance across frameworks
      const parseTimes = results.map(r => r.parseTime);
      const transformTimes = results.map(r => r.transformTime);
      const analyzeTimes = results.map(r => r.analyzeTime);
      const totalTimes = results.map(r => r.totalTime);

      // No framework should be more than 2x slower than the fastest
      const maxParseTime = Math.max(...parseTimes);
      const minParseTime = Math.min(...parseTimes);
      expect(maxParseTime / minParseTime).toBeLessThan(2);

      const maxTransformTime = Math.max(...transformTimes);
      const minTransformTime = Math.min(...transformTimes);
      expect(maxTransformTime / minTransformTime).toBeLessThan(2);

      const maxAnalyzeTime = Math.max(...analyzeTimes);
      const minAnalyzeTime = Math.min(...analyzeTimes);
      expect(maxAnalyzeTime / minAnalyzeTime).toBeLessThan(2);

      const maxTotalTime = Math.max(...totalTimes);
      const minTotalTime = Math.min(...totalTimes);
      expect(maxTotalTime / minTotalTime).toBeLessThan(2);

      // Log results for analysis
      console.log('Framework Performance Comparison:');
      results.forEach(result => {
        console.log(`${result.framework}: Parse=${result.parseTime.toFixed(2)}ms, Transform=${result.transformTime.toFixed(2)}ms, Analyze=${result.analyzeTime.toFixed(2)}ms, Total=${result.totalTime.toFixed(2)}ms`);
      });
    });
  });

  describe('Memory Usage Benchmarks', () => {
    it('should maintain reasonable memory usage for large reactive graphs', () => {
      const largeReactiveGraph = `---
target: reactjs
---

${Array.from({ length: 200 }, (_, i) => `$node${i}! = ${i}`).join('\n')}

// Create complex dependency chains
${Array.from({ length: 50 }, (_, i) => {
  const deps = Array.from({ length: 4 }, (_, j) => `$node${(i * 4 + j) % 200}`).join(' + ');
  return `$computed${i}! = ${deps}`;
}).join('\n')}

// Create update functions
${Array.from({ length: 50 }, (_, i) => `
$update${i} = (value: number) => {
  $node${i} = value
}`).join('\n')}

return template(\`
  <div>
    ${Array.from({ length: 200 }, (_, i) => `<span>{{$node${i}}}</span>`).join('\n    ')}
    ${Array.from({ length: 50 }, (_, i) => `<p>Computed ${i}: {{$computed${i}}}</p>`).join('\n    ')}
  </div>
\`)`;

      const initialMemory = process.memoryUsage().heapUsed;
      const result = runBenchmark(largeReactiveGraph, 'reactjs', 'large-reactive.mtm');
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const totalMemoryIncrease = finalMemory - initialMemory;
      
      expect(result.memoryUsage).toBeLessThan(50 * 1024 * 1024); // < 50MB during compilation
      expect(totalMemoryIncrease).toBeLessThan(30 * 1024 * 1024); // < 30MB retained
    });

    it('should clean up memory after compilation', () => {
      const testSyntax = `---
target: vue
---

${Array.from({ length: 100 }, (_, i) => `$temp${i}! = "temporary data ${i}"`).join('\n')}

$cleanup = () => {
  ${Array.from({ length: 100 }, (_, i) => `$temp${i} = null`).join('\n  ')}
}`;

      const initialMemory = process.memoryUsage().heapUsed;
      
      // Run multiple compilations
      for (let i = 0; i < 10; i++) {
        runBenchmark(testSyntax, 'vue', `cleanup-test-${i}.mtm`);
      }
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be minimal after multiple compilations
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // < 10MB increase
    });
  });

  describe('Incremental Compilation Benchmarks', () => {
    it('should support fast incremental updates', () => {
      const baseSyntax = `---
target: svelte
---

$counter! = 0
$increment = () => $counter++

return template(\`<button click="$increment()">{{$counter}}</button>\`)`;

      const modifiedSyntax = `---
target: svelte
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

      // Initial compilation
      const initialResult = runBenchmark(baseSyntax, 'svelte', 'incremental-base.mtm');
      
      // Modified compilation (simulating hot reload)
      const modifiedResult = runBenchmark(modifiedSyntax, 'svelte', 'incremental-modified.mtm');
      
      // Incremental compilation should be fast
      expect(modifiedResult.totalTime).toBeLessThan(initialResult.totalTime * 1.5);
      
      // Both should be reasonably fast
      expect(initialResult.totalTime).toBeLessThan(50);
      expect(modifiedResult.totalTime).toBeLessThan(75);
    });
  });
});