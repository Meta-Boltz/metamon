/**
 * Template Parser Tests
 * Tests for ultra-modern MTM template parsing functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import TemplateParser from '../build-tools/template-parser.js';

describe('TemplateParser', () => {
  let parser;

  beforeEach(() => {
    parser = new TemplateParser();
  });

  describe('Variable Extraction', () => {
    it('should extract reactive variables with ! syntax', () => {
      const code = `
        $count! = 0
        $message! = "Hello"
        $items! = []
      `;

      const result = parser.parse(code);

      expect(result.variables.has('count')).toBe(true);
      expect(result.variables.has('message')).toBe(true);
      expect(result.variables.has('items')).toBe(true);

      expect(result.variables.get('count').reactive).toBe(true);
      expect(result.variables.get('count').value.type).toBe('number');
      expect(result.variables.get('count').value.value).toBe(0);

      expect(result.variables.get('message').reactive).toBe(true);
      expect(result.variables.get('message').value.type).toBe('string');
      expect(result.variables.get('message').value.value).toBe('Hello');
    });

    it('should extract typed reactive variables', () => {
      const code = `
        $price: float = 99.99
        $name: string = "MTM"
        $isActive: boolean = true
      `;

      const result = parser.parse(code);

      expect(result.variables.get('price').hasTypeAnnotation).toBe(true);
      expect(result.variables.get('price').type).toBe('float');
      expect(result.variables.get('price').value.value).toBe(99.99);

      expect(result.variables.get('name').hasTypeAnnotation).toBe(true);
      expect(result.variables.get('name').type).toBe('string');
    });

    it('should extract computed variables', () => {
      const code = `
        $count! = 0
        $doubled = $count * 2
        $greeting = \`Hello, \${$name}!\`
      `;

      const result = parser.parse(code);

      expect(result.variables.get('doubled').computed).toBe(true);
      expect(result.variables.get('doubled').reactive).toBe(false);
      expect(result.variables.get('greeting').computed).toBe(true);
    });

    it('should extract signal variables', () => {
      const code = `
        $globalCount! = signal('globalCount', 0)
        $sharedState! = signal('shared', { user: 'test' })
      `;

      const result = parser.parse(code);

      expect(result.variables.get('globalCount').value.type).toBe('signal');
      expect(result.variables.get('globalCount').value.key).toBe('globalCount');
      expect(result.variables.get('globalCount').value.initialValue.value).toBe(0);
    });
  });

  describe('Function Extraction', () => {
    it('should extract arrow functions', () => {
      const code = `
        $increment = () => {
          $count++
          signal.emit('counter-updated', { value: $count })
        }
        
        $addItem = ($text: string) => {
          $items = [...$items, { id: Date.now(), text: $text }]
        }
      `;

      const result = parser.parse(code);

      expect(result.functions.has('increment')).toBe(true);
      expect(result.functions.has('addItem')).toBe(true);

      const incrementFunc = result.functions.get('increment');
      expect(incrementFunc.isArrow).toBe(true);
      expect(incrementFunc.params).toHaveLength(0);
      expect(incrementFunc.body).toContain('$count++');

      const addItemFunc = result.functions.get('addItem');
      expect(addItemFunc.params).toHaveLength(1);
      expect(addItemFunc.params[0].name).toBe('$text');
      expect(addItemFunc.params[0].type).toBe('string');
      expect(addItemFunc.params[0].hasTypeAnnotation).toBe(true);
    });

    it('should extract async functions', () => {
      const code = `
        $fetchData = async ($url: string) => {
          $loading = true
          $data = await fetch($url).then(r => r.json())
          $loading = false
        }
      `;

      const result = parser.parse(code);

      expect(result.functions.has('fetchData')).toBe(true);
      const func = result.functions.get('fetchData');
      expect(func.isAsync).toBe(true);
      expect(func.body).toContain('await fetch');
    });

    it('should extract single expression functions', () => {
      const code = `
        $double = (x) => x * 2
        $isEven = (n) => n % 2 === 0
      `;

      const result = parser.parse(code);

      expect(result.functions.has('double')).toBe(true);
      expect(result.functions.has('isEven')).toBe(true);

      expect(result.functions.get('double').body).toBe('x * 2');
      expect(result.functions.get('isEven').body).toBe('n % 2 === 0');
    });
  });

  describe('Template Extraction', () => {
    it('should extract template blocks', () => {
      const code = `
        export default function Counter() {
          $count! = 0
          
          <template>
            <div class="counter">
              <span>{$count}</span>
              <button click={$increment}>+</button>
            </div>
          </template>
        }
      `;

      const result = parser.parse(code);

      expect(result.template).toContain('<div class="counter">');
      expect(result.template).toContain('<span>{$count}</span>');
      expect(result.template).toContain('<button click={$increment}>+</button>');
    });

    it('should handle multiline templates', () => {
      const code = `
        <template>
          <div class="component">
            <h1>Title</h1>
            <p>Description</p>
            <ul>
              <li>Item 1</li>
              <li>Item 2</li>
            </ul>
          </div>
        </template>
      `;

      const result = parser.parse(code);

      expect(result.template).toContain('<h1>Title</h1>');
      expect(result.template).toContain('<ul>');
      expect(result.template).toContain('<li>Item 1</li>');
    });
  });

  describe('Data Bindings', () => {
    it('should extract data bindings', () => {
      const code = `
        <template>
          <div>
            <span>{$count}</span>
            <span>{$user.name}</span>
            <span>{$total * 2}</span>
            <span>{$items.length}</span>
          </div>
        </template>
      `;

      const result = parser.parse(code);

      expect(result.bindings).toHaveLength(4);

      const countBinding = result.bindings.find(b => b.expression === '$count');
      expect(countBinding.type).toBe('data');
      expect(countBinding.isVariable).toBe(true);
      expect(countBinding.variableName).toBe('count');

      const expressionBinding = result.bindings.find(b => b.expression === '$total * 2');
      expect(expressionBinding.type).toBe('data');
      expect(expressionBinding.isVariable).toBe(false);
    });

    it('should handle complex expressions in bindings', () => {
      const code = `
        <template>
          <div>
            <span>{$count > 5 ? 'High' : 'Low'}</span>
            <span>{$items.filter(item => item.active).length}</span>
            <span>{\`Hello, \${$user.name}!\`}</span>
          </div>
        </template>
      `;

      const result = parser.parse(code);

      expect(result.bindings).toHaveLength(3);
      expect(result.bindings[0].expression).toBe("$count > 5 ? 'High' : 'Low'");
      expect(result.bindings[1].expression).toBe('$items.filter(item => item.active).length');
    });
  });

  describe('Event Bindings', () => {
    it('should extract event bindings', () => {
      const code = `
        <template>
          <div>
            <button click={$increment}>+</button>
            <input input={$handleInput} />
            <form submit={$handleSubmit}>
              <button type="submit">Submit</button>
            </form>
          </div>
        </template>
      `;

      const result = parser.parse(code);

      expect(result.events).toHaveLength(3);

      const clickEvent = result.events.find(e => e.type === 'click');
      expect(clickEvent.handler).toBe('$increment');
      expect(clickEvent.isFunction).toBe(true);
      expect(clickEvent.functionName).toBe('increment');

      const inputEvent = result.events.find(e => e.type === 'input');
      expect(inputEvent.handler).toBe('$handleInput');
      expect(inputEvent.isFunction).toBe(true);
    });

    it('should extract inline event handlers', () => {
      const code = `
        <template>
          <div>
            <button click={(e) => $count++}>Increment</button>
            <input input={(e) => $name = e.target.value} />
          </div>
        </template>
      `;

      const result = parser.parse(code);

      expect(result.events).toHaveLength(2);

      const clickEvent = result.events.find(e => e.type === 'click');
      expect(clickEvent.isInline).toBe(true);
      expect(clickEvent.handler).toBe('(e) => $count++');

      const inputEvent = result.events.find(e => e.type === 'input');
      expect(inputEvent.isInline).toBe(true);
      expect(inputEvent.handler).toBe('(e) => $name = e.target.value');
    });
  });

  describe('Control Flow', () => {
    it('should extract conditional rendering', () => {
      const code = `
        <template>
          <div>
            {#if $isVisible}
              <p>Visible content</p>
            {/if}
            
            {#if $count > 5}
              <p>High count</p>
            {:else}
              <p>Low count</p>
            {/if}
          </div>
        </template>
      `;

      const result = parser.parse(code);

      expect(result.controlFlow).toHaveLength(2);

      const simpleIf = result.controlFlow.find(c => c.condition === '$isVisible');
      expect(simpleIf.type).toBe('conditional');
      expect(simpleIf.ifContent).toContain('Visible content');
      expect(simpleIf.elseContent).toBeNull();

      const ifElse = result.controlFlow.find(c => c.condition === '$count > 5');
      expect(ifElse.type).toBe('conditional');
      expect(ifElse.ifContent).toContain('High count');
      expect(ifElse.elseContent).toContain('Low count');
    });

    it('should extract list rendering', () => {
      const code = `
        <template>
          <div>
            {#each $items as item}
              <div key={item.id}>{item.name}</div>
            {/each}
            
            {#each $users as user, index}
              <p>{index}: {user.name}</p>
            {/each}
          </div>
        </template>
      `;

      const result = parser.parse(code);

      expect(result.controlFlow).toHaveLength(2);

      const simpleEach = result.controlFlow.find(c => c.itemName === 'item');
      expect(simpleEach.type).toBe('loop');
      expect(simpleEach.iterable).toBe('$items');
      expect(simpleEach.indexName).toBeNull();
      expect(simpleEach.content).toContain('{item.name}');

      const indexedEach = result.controlFlow.find(c => c.itemName === 'user');
      expect(indexedEach.type).toBe('loop');
      expect(indexedEach.iterable).toBe('$users');
      expect(indexedEach.indexName).toBe('index');
    });

    it('should extract for loops', () => {
      const code = `
        <template>
          <div>
            {#for i=0 to 9}
              <span>{i}</span>
            {/for}
            
            {#for j=1 to 5}
              <div>Item {j}</div>
            {/for}
          </div>
        </template>
      `;

      const result = parser.parse(code);

      expect(result.controlFlow).toHaveLength(2);

      const firstFor = result.controlFlow.find(c => c.variable === 'i');
      expect(firstFor.type).toBe('for');
      expect(firstFor.start).toBe(0);
      expect(firstFor.end).toBe(9);
      expect(firstFor.content).toContain('{i}');

      const secondFor = result.controlFlow.find(c => c.variable === 'j');
      expect(secondFor.type).toBe('for');
      expect(secondFor.start).toBe(1);
      expect(secondFor.end).toBe(5);
    });

    it('should extract while loops', () => {
      const code = `
        <template>
          <div>
            {#while $count > 0}
              <span>{$count}</span>
            {/while}
          </div>
        </template>
      `;

      const result = parser.parse(code);

      expect(result.controlFlow).toHaveLength(1);

      const whileLoop = result.controlFlow[0];
      expect(whileLoop.type).toBe('while');
      expect(whileLoop.condition).toBe('$count > 0');
      expect(whileLoop.content).toContain('{$count}');
    });
  });

  describe('Import/Export Extraction', () => {
    it('should extract import statements', () => {
      const code = `
        import React from 'react'
        import { useState, useEffect } from 'react'
        import * as utils from './utils'
        import { signal } from '../shared/signal-system.js'
      `;

      const result = parser.parse(code);

      expect(result.imports).toHaveLength(4);

      const reactImport = result.imports.find(i => i.source === 'react' && i.defaultImport);
      expect(reactImport.type).toBe('default');
      expect(reactImport.defaultImport).toBe('React');

      const namedImport = result.imports.find(i => i.namedImports.includes('useState'));
      expect(namedImport.type).toBe('named');
      expect(namedImport.namedImports).toContain('useState');
      expect(namedImport.namedImports).toContain('useEffect');

      const namespaceImport = result.imports.find(i => i.namespaceImport === 'utils');
      expect(namespaceImport.type).toBe('namespace');
    });

    it('should extract export statements', () => {
      const code = `
        export default function Counter() {
          // component code
        }
        
        export const helper = () => {}
        export function utility() {}
      `;

      const result = parser.parse(code);

      expect(result.exports).toHaveLength(3);

      const defaultExport = result.exports.find(e => e.type === 'default');
      expect(defaultExport.name).toBe('Counter');
      expect(defaultExport.isFunction).toBe(true);

      const namedExports = result.exports.filter(e => e.type === 'named');
      expect(namedExports).toHaveLength(2);
      expect(namedExports.map(e => e.name)).toContain('helper');
      expect(namedExports.map(e => e.name)).toContain('utility');
    });
  });

  describe('Error Handling', () => {
    it('should handle parsing errors gracefully', () => {
      const code = `
        $invalid syntax here
        {#if unclosed condition
        <template>
          <div>Unclosed div
        </template>
      `;

      const result = parser.parse(code);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('parse_error');
      expect(result.errors[0].message).toBeDefined();
    });

    it('should provide helpful error suggestions', () => {
      const code = `
        $count! = invalid_value
      `;

      const result = parser.parse(code);

      // Should still parse what it can
      expect(result.variables.has('count')).toBe(true);

      // May have warnings about invalid values
      if (result.errors.length > 0) {
        expect(result.errors[0].suggestion).toBeDefined();
      }
    });
  });

  describe('Complex Examples', () => {
    it('should parse comprehensive MTM component', () => {
      const code = `
        export default function ComprehensiveDemo() {
          // Variables with different types
          $counter! = 0
          $message: string = "Hello MTM!"
          $isVisible! = true
          $items! = []
          $user! = { name: '', email: '' }
          $price: float = 99.99
          
          // Computed values
          $completedCount = $items.filter($item => $item.completed).length
          $totalItems = $items.length
          
          // Functions
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
                  <p>Price: ${$price}</p>
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
                <input 
                  type="email"
                  value={$user.email}
                  input={(e) => $updateUser('email', e.target.value)}
                  placeholder="Email"
                />
                <button type="submit">Submit</button>
              </form>
            </div>
          </template>
        }
      `;

      const result = parser.parse(code);

      // Should parse without errors
      expect(result.errors).toHaveLength(0);

      // Should extract all variables
      expect(result.variables.size).toBeGreaterThan(5);
      expect(result.variables.has('counter')).toBe(true);
      expect(result.variables.has('message')).toBe(true);
      expect(result.variables.has('completedCount')).toBe(true);

      // Should extract all functions
      expect(result.functions.size).toBeGreaterThan(2);
      expect(result.functions.has('increment')).toBe(true);
      expect(result.functions.has('addItem')).toBe(true);
      expect(result.functions.has('updateUser')).toBe(true);

      // Should extract template
      expect(result.template).toContain('comprehensive-demo');

      // Should extract bindings
      expect(result.bindings.length).toBeGreaterThan(5);

      // Should extract events
      expect(result.events.length).toBeGreaterThan(3);

      // Should extract control flow
      expect(result.controlFlow.length).toBeGreaterThan(1);

      // Should extract exports
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0].name).toBe('ComprehensiveDemo');
    });
  });
});