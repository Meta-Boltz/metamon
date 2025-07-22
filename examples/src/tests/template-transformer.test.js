/**
 * Template Transformer Tests
 * Tests for ultra-modern MTM template transformation to different frameworks
 */

import { describe, it, expect, beforeEach } from 'vitest';
import TemplateTransformer from '../build-tools/template-transformer.js';

describe('TemplateTransformer', () => {
  let transformer;

  beforeEach(() => {
    transformer = new TemplateTransformer();
  });

  describe('React Transformation', () => {
    it('should transform simple counter component to React', () => {
      const mtmCode = `
        export default function Counter() {
          $count! = 0
          
          $increment = () => {
            $count++
          }
          
          <template>
            <div class="counter">
              <span>{$count}</span>
              <button click={$increment}>+</button>
            </div>
          </template>
        }
      `;

      const result = transformer.transform(mtmCode, 'react');

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('import React');
      expect(result.code).toContain('useState');
      expect(result.code).toContain('useCallback');
      expect(result.code).toContain('const [count, setCount] = useState(0)');
      expect(result.code).toContain('onClick={increment}');
      expect(result.code).toContain('className="counter"');
      expect(result.code).toContain('{count}');
    });

    it('should transform signal variables to React', () => {
      const mtmCode = `
        export default function Component() {
          $globalCount! = signal('globalCount', 0)
          
          <template>
            <div>{$globalCount}</div>
          </template>
        }
      `;

      const result = transformer.transform(mtmCode, 'react');

      expect(result.code).toContain('signal.use(\'globalCount\', 0)');
      expect(result.code).toContain('const [globalCount, setGlobalCount]');
    });

    it('should transform computed variables to React useMemo', () => {
      const mtmCode = `
        export default function Component() {
          $items! = []
          $count = $items.length
          
          <template>
            <div>Count: {$count}</div>
          </template>
        }
      `;

      const result = transformer.transform(mtmCode, 'react');

      expect(result.code).toContain('useMemo');
      expect(result.code).toContain('items.length');
    });

    it('should transform control flow to React', () => {
      const mtmCode = `
        export default function Component() {
          $isVisible! = true
          $items! = []
          
          <template>
            <div>
              {#if $isVisible}
                <p>Visible</p>
              {:else}
                <p>Hidden</p>
              {/if}
              
              {#each $items as item}
                <div key={item.id}>{item.name}</div>
              {/each}
            </div>
          </template>
        }
      `;

      const result = transformer.transform(mtmCode, 'react');

      expect(result.code).toContain('isVisible ? (');
      expect(result.code).toContain(') : (');
      expect(result.code).toContain('items.map(item =>');
    });

    it('should handle async functions in React', () => {
      const mtmCode = `
        export default function Component() {
          $fetchData = async ($url: string) => {
            const response = await fetch($url)
            return response.json()
          }
          
          <template>
            <button click={$fetchData}>Fetch</button>
          </template>
        }
      `;

      const result = transformer.transform(mtmCode, 'react');

      expect(result.code).toContain('useCallback(async (url) =>');
      expect(result.code).toContain('await fetch(url)');
    });
  });

  describe('Vue Transformation', () => {
    it('should transform simple counter component to Vue', () => {
      const mtmCode = `
        export default function Counter() {
          $count! = 0
          
          $increment = () => {
            $count++
          }
          
          <template>
            <div class="counter">
              <span>{$count}</span>
              <button click={$increment}>+</button>
            </div>
          </template>
        }
      `;

      const result = transformer.transform(mtmCode, 'vue');

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('<template>');
      expect(result.code).toContain('<script setup>');
      expect(result.code).toContain('import { ref');
      expect(result.code).toContain('const count = ref(0)');
      expect(result.code).toContain('@click="increment"');
      expect(result.code).toContain('{{ count }}');
    });

    it('should transform signal variables to Vue', () => {
      const mtmCode = `
        export default function Component() {
          $globalCount! = signal('globalCount', 0)
          
          <template>
            <div>{$globalCount}</div>
          </template>
        }
      `;

      const result = transformer.transform(mtmCode, 'vue');

      expect(result.code).toContain('signal.use(\'globalCount\', 0)');
      expect(result.code).toContain('const [globalCount, setGlobalCount]');
    });

    it('should transform computed variables to Vue computed', () => {
      const mtmCode = `
        export default function Component() {
          $items! = []
          $count = $items.length
          
          <template>
            <div>Count: {$count}</div>
          </template>
        }
      `;

      const result = transformer.transform(mtmCode, 'vue');

      expect(result.code).toContain('computed');
      expect(result.code).toContain('items.value.length');
    });

    it('should transform control flow to Vue', () => {
      const mtmCode = `
        export default function Component() {
          $isVisible! = true
          $items! = []
          
          <template>
            <div>
              {#if $isVisible}
                <p>Visible</p>
              {:else}
                <p>Hidden</p>
              {/if}
              
              {#each $items as item}
                <div key={item.id}>{item.name}</div>
              {/each}
            </div>
          </template>
        }
      `;

      const result = transformer.transform(mtmCode, 'vue');

      expect(result.code).toContain('v-if="isVisible"');
      expect(result.code).toContain('v-else');
      expect(result.code).toContain('v-for="item in items"');
    });
  });

  describe('Svelte Transformation', () => {
    it('should transform simple counter component to Svelte', () => {
      const mtmCode = `
        export default function Counter() {
          $count! = 0
          
          $increment = () => {
            $count++
          }
          
          <template>
            <div class="counter">
              <span>{$count}</span>
              <button click={$increment}>+</button>
            </div>
          </template>
        }
      `;

      const result = transformer.transform(mtmCode, 'svelte');

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('<script>');
      expect(result.code).toContain('let count = 0');
      expect(result.code).toContain('function increment()');
      expect(result.code).toContain('on:click={increment}');
      expect(result.code).toContain('{count}');
    });

    it('should transform signal variables to Svelte', () => {
      const mtmCode = `
        export default function Component() {
          $globalCount! = signal('globalCount', 0)
          
          <template>
            <div>{$globalCount}</div>
          </template>
        }
      `;

      const result = transformer.transform(mtmCode, 'svelte');

      expect(result.code).toContain('signal.use(\'globalCount\', 0)');
      expect(result.code).toContain('const [globalCount, setGlobalCount]');
    });

    it('should transform control flow to Svelte', () => {
      const mtmCode = `
        export default function Component() {
          $isVisible! = true
          $items! = []
          
          <template>
            <div>
              {#if $isVisible}
                <p>Visible</p>
              {:else}
                <p>Hidden</p>
              {/if}
              
              {#each $items as item}
                <div key={item.id}>{item.name}</div>
              {/each}
            </div>
          </template>
        }
      `;

      const result = transformer.transform(mtmCode, 'svelte');

      expect(result.code).toContain('{#if isVisible}');
      expect(result.code).toContain('{:else}');
      expect(result.code).toContain('{#each items as item}');
      expect(result.code).toContain('{/each}');
    });
  });

  describe('Vanilla JavaScript Transformation', () => {
    it('should transform simple counter component to Vanilla JS', () => {
      const mtmCode = `
        export default function Counter() {
          $count! = 0
          
          $increment = () => {
            $count++
          }
          
          <template>
            <div class="counter">
              <span>{$count}</span>
              <button click={$increment}>+</button>
            </div>
          </template>
        }
      `;

      const result = transformer.transform(mtmCode, 'vanilla');

      expect(result.errors).toHaveLength(0);
      expect(result.code).toContain('let count = 0');
      expect(result.code).toContain('const increment = () =>');
      expect(result.code).toContain('document.createElement');
      expect(result.code).toContain('addEventListener');
      expect(result.code).toContain('innerHTML');
    });

    it('should transform signal variables to Vanilla JS', () => {
      const mtmCode = `
        export default function Component() {
          $globalCount! = signal('globalCount', 0)
          
          <template>
            <div>{$globalCount}</div>
          </template>
        }
      `;

      const result = transformer.transform(mtmCode, 'vanilla');

      expect(result.code).toContain('signal.use(\'globalCount\', 0)');
      expect(result.code).toContain('signal.on(\'globalCount\'');
    });
  });

  describe('Complex Transformations', () => {
    it('should transform comprehensive component with all features', () => {
      const mtmCode = `
        export default function ComprehensiveDemo() {
          $counter! = 0
          $message: string = "Hello MTM!"
          $isVisible! = true
          $items! = []
          $user! = { name: '', email: '' }
          
          $completedCount = $items.filter($item => $item.completed).length
          $totalItems = $items.length
          
          $increment = () => {
            $counter++
            signal.emit('demo-action', { type: 'increment', value: $counter })
          }
          
          $addItem = ($text: string) => {
            if (!$text.trim()) return
            $items = [...$items, { id: Date.now(), text: $text.trim() }]
          }
          
          $updateUser = ($field: string, $value: string) => {
            $user = { ...$user, [$field]: $value }
          }
          
          <template>
            <div class="comprehensive-demo">
              <h1>{$message}</h1>
              
              <div class="counter">
                <button click={$increment}>Count: {$counter}</button>
              </div>
              
              {#if $isVisible}
                <div class="conditional-content">
                  <p>Items: {$totalItems}, Completed: {$completedCount}</p>
                </div>
              {/if}
              
              {#each $items as item}
                <div key={item.id} class="item">
                  {item.text}
                </div>
              {/each}
              
              <form submit={$handleSubmit}>
                <input 
                  value={$user.name}
                  input={(e) => $updateUser('name', e.target.value)}
                  placeholder="Name"
                />
                <button type="submit">Submit</button>
              </form>
            </div>
          </template>
        }
      `;

      const reactResult = transformer.transform(mtmCode, 'react');
      const vueResult = transformer.transform(mtmCode, 'vue');
      const svelteResult = transformer.transform(mtmCode, 'svelte');
      const vanillaResult = transformer.transform(mtmCode, 'vanilla');

      // All transformations should succeed
      expect(reactResult.errors).toHaveLength(0);
      expect(vueResult.errors).toHaveLength(0);
      expect(svelteResult.errors).toHaveLength(0);
      expect(vanillaResult.errors).toHaveLength(0);

      // React specific checks
      expect(reactResult.code).toContain('useState');
      expect(reactResult.code).toContain('useCallback');
      expect(reactResult.code).toContain('useMemo');
      expect(reactResult.code).toContain('className="comprehensive-demo"');

      // Vue specific checks
      expect(vueResult.code).toContain('<template>');
      expect(vueResult.code).toContain('<script setup>');
      expect(vueResult.code).toContain('ref(');
      expect(vueResult.code).toContain('computed(');

      // Svelte specific checks
      expect(svelteResult.code).toContain('<script>');
      expect(svelteResult.code).toContain('let counter = 0');
      expect(svelteResult.code).toContain('{#if isVisible}');

      // Vanilla JS specific checks
      expect(vanillaResult.code).toContain('document.createElement');
      expect(vanillaResult.code).toContain('addEventListener');
    });

    it('should handle type annotations correctly', () => {
      const mtmCode = `
        export default function TypedComponent() {
          $price: float = 99.99
          $name: string = "MTM"
          $isActive: boolean = true
          
          $updatePrice = ($newPrice: float) => {
            $price = $newPrice
          }
          
          <template>
            <div>
              <span>Price: ${$price}</span>
              <span>Name: {$name}</span>
              <span>Active: {$isActive ? 'Yes' : 'No'}</span>
            </div>
          </template>
        }
      `;

      const result = transformer.transform(mtmCode, 'react');

      expect(result.errors).toHaveLength(0);
      expect(result.parsed.variables.get('price').type).toBe('float');
      expect(result.parsed.variables.get('name').type).toBe('string');
      expect(result.parsed.variables.get('isActive').type).toBe('boolean');
      expect(result.parsed.functions.get('updatePrice').params[0].type).toBe('float');
    });

    it('should handle nested control flow', () => {
      const mtmCode = `
        export default function NestedComponent() {
          $users! = []
          $showDetails! = false
          
          <template>
            <div>
              {#if $users.length > 0}
                <h2>Users</h2>
                {#each $users as user}
                  <div class="user">
                    <h3>{user.name}</h3>
                    {#if $showDetails}
                      <p>Email: {user.email}</p>
                      <p>Age: {user.age}</p>
                    {/if}
                  </div>
                {/each}
              {:else}
                <p>No users found</p>
              {/if}
            </div>
          </template>
        }
      `;

      const reactResult = transformer.transform(mtmCode, 'react');
      const vueResult = transformer.transform(mtmCode, 'vue');
      const svelteResult = transformer.transform(mtmCode, 'svelte');

      expect(reactResult.errors).toHaveLength(0);
      expect(vueResult.errors).toHaveLength(0);
      expect(svelteResult.errors).toHaveLength(0);

      // Check that nested conditions are handled
      expect(reactResult.code).toContain('users.length > 0');
      expect(reactResult.code).toContain('users.map(user =>');
      expect(reactResult.code).toContain('showDetails &&');

      expect(vueResult.code).toContain('v-if="users.length > 0"');
      expect(vueResult.code).toContain('v-for="user in users"');
      expect(vueResult.code).toContain('v-if="showDetails"');

      expect(svelteResult.code).toContain('{#if users.length > 0}');
      expect(svelteResult.code).toContain('{#each users as user}');
      expect(svelteResult.code).toContain('{#if showDetails}');
    });
  });

  describe('Error Handling', () => {
    it('should handle syntax errors gracefully', () => {
      const invalidCode = `
        export default function Invalid() {
          $count! = 
          $invalid syntax here
          
          <template>
            <div>Unclosed div
          </template>
        }
      `;

      const result = transformer.transform(invalidCode, 'react');

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.code).toContain('MTM Transform Error');
    });

    it('should handle unsupported framework', () => {
      const code = `
        export default function Component() {
          $count! = 0
          <template><div>{$count}</div></template>
        }
      `;

      const result = transformer.transform(code, 'unsupported');

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.code).toContain('MTM Transform Error');
    });

    it('should generate appropriate error components for each framework', () => {
      const invalidCode = `invalid syntax`;

      const reactResult = transformer.transform(invalidCode, 'react');
      const vueResult = transformer.transform(invalidCode, 'vue');
      const svelteResult = transformer.transform(invalidCode, 'svelte');
      const vanillaResult = transformer.transform(invalidCode, 'vanilla');

      expect(reactResult.code).toContain('React.createElement');
      expect(vueResult.code).toContain('<template>');
      expect(svelteResult.code).toContain('<div style=');
      expect(vanillaResult.code).toContain('document.createElement');
    });
  });

  describe('Advanced Features', () => {
    it('should handle for loops correctly', () => {
      const mtmCode = `
        export default function ForLoopComponent() {
          <template>
            <div>
              {#for i=0 to 9}
                <span>{i}</span>
              {/for}
            </div>
          </template>
        }
      `;

      const reactResult = transformer.transform(mtmCode, 'react');

      expect(reactResult.code).toContain('Array.from({length: 10}');
      expect(reactResult.code).toContain('.map(i =>');
    });

    it('should handle while loops with warnings', () => {
      const mtmCode = `
        export default function WhileLoopComponent() {
          $count! = 5
          
          <template>
            <div>
              {#while $count > 0}
                <span>{$count}</span>
              {/while}
            </div>
          </template>
        }
      `;

      const reactResult = transformer.transform(mtmCode, 'react');

      // While loops should be converted to conditionals in React with warning
      expect(reactResult.code).toContain('count > 0 &&');
    });

    it('should preserve custom imports', () => {
      const mtmCode = `
        import { customUtil } from './utils'
        import * as helpers from './helpers'
        
        export default function Component() {
          $value! = customUtil.getValue()
          
          <template>
            <div>{$value}</div>
          </template>
        }
      `;

      const result = transformer.transform(mtmCode, 'react');

      expect(result.code).toContain("import { customUtil } from './utils'");
      expect(result.code).toContain("import * as helpers from './helpers'");
    });

    it('should handle complex expressions in bindings', () => {
      const mtmCode = `
        export default function ExpressionComponent() {
          $items! = []
          $filter! = ''
          
          <template>
            <div>
              <span>{$items.filter(item => item.name.includes($filter)).length}</span>
              <span>{$items.length > 0 ? 'Has items' : 'Empty'}</span>
              <span>{\`Total: \${$items.length}\`}</span>
            </div>
          </template>
        }
      `;

      const result = transformer.transform(mtmCode, 'react');

      expect(result.code).toContain('items.filter(item => item.name.includes(filter)).length');
      expect(result.code).toContain('items.length > 0 ? \'Has items\' : \'Empty\'');
      expect(result.code).toContain('`Total: ${items.length}`');
    });
  });
});