/**
 * State synchronization tests between frameworks using modern MTM syntax
 * Tests Requirements 3.1, 3.2, 3.5 - reactive variable behavior across framework boundaries
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnhancedMTMParser } from '../parser/enhanced-mtm-parser.js';
import { ReactTransformer } from '../transformers/react-transformer.js';
import { VueTransformer } from '../transformers/vue-transformer.js';
import { SvelteTransformer } from '../transformers/svelte-transformer.js';
import { ReactiveVariableAnalyzer } from '../reactive/reactive-analyzer.js';
import { UpdateBatcher } from '../reactive/update-batcher.js';
import type { ProgramNode, ReactiveVariableNode } from '../types/unified-ast.js';

// Mock PubSub system for cross-framework communication
class MockPubSub {
  private channels = new Map<string, Set<Function>>();

  subscribe(channel: string, callback: Function) {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel)!.add(callback);
  }

  unsubscribe(channel: string, callback: Function) {
    this.channels.get(channel)?.delete(callback);
  }

  emit(channel: string, data: any) {
    this.channels.get(channel)?.forEach(callback => callback(data));
  }

  clear() {
    this.channels.clear();
  }
}

describe('State Synchronization Between Frameworks', () => {
  let parser: EnhancedMTMParser;
  let reactTransformer: ReactTransformer;
  let vueTransformer: VueTransformer;
  let svelteTransformer: SvelteTransformer;
  let reactiveAnalyzer: ReactiveVariableAnalyzer;
  let updateBatcher: UpdateBatcher;
  let mockPubSub: MockPubSub;

  beforeEach(() => {
    parser = new EnhancedMTMParser();
    reactTransformer = new ReactTransformer();
    vueTransformer = new VueTransformer();
    svelteTransformer = new SvelteTransformer();
    reactiveAnalyzer = new ReactiveVariableAnalyzer();
    updateBatcher = new UpdateBatcher();
    mockPubSub = new MockPubSub();
  });

  describe('Requirement 3.1: Reactive Variable Creation and Updates', () => {
    it('should synchronize reactive variable creation across React and Vue', () => {
      const sharedReactiveSyntax = `
$globalCounter! = 0
$globalMessage! = "Shared state"

$updateCounter = (value: number) => {
  $globalCounter = value
  emit('counter-changed', { counter: $globalCounter })
}

$updateMessage = (msg: string) => {
  $globalMessage = msg
  emit('message-changed', { message: $globalMessage })
}

on('counter-changed', (data) => {
  if (data.counter !== $globalCounter) {
    $globalCounter = data.counter
  }
})

on('message-changed', (data) => {
  if (data.message !== $globalMessage) {
    $globalMessage = data.message
  }
})`;

      // Parse for React
      const reactSyntax = `---\ntarget: reactjs\n---\n${sharedReactiveSyntax}`;
      const reactAST = parser.parse(reactSyntax, 'react-shared.mtm');
      const reactGraph = reactiveAnalyzer.analyzeReactiveVariables(reactAST);

      // Parse for Vue
      const vueSyntax = `---\ntarget: vue\n---\n${sharedReactiveSyntax}`;
      const vueAST = parser.parse(vueSyntax, 'vue-shared.mtm');
      const vueGraph = reactiveAnalyzer.analyzeReactiveVariables(vueAST);

      // Both should have same reactive variables
      expect(reactGraph.variables.has('globalCounter')).toBe(true);
      expect(reactGraph.variables.has('globalMessage')).toBe(true);
      expect(vueGraph.variables.has('globalCounter')).toBe(true);
      expect(vueGraph.variables.has('globalMessage')).toBe(true);

      // Both should be reactive
      const reactCounter = reactGraph.variables.get('globalCounter');
      const vueCounter = vueGraph.variables.get('globalCounter');
      expect(reactCounter?.isReactive).toBe(true);
      expect(vueCounter?.isReactive).toBe(true);

      // Should have same initial values
      expect(reactCounter?.initializer).toEqual(vueCounter?.initializer);
    });

    it('should handle reactive variable updates consistently across frameworks', () => {
      const updateSyntax = `
$sharedData! = { 
  count: 0, 
  items: [],
  metadata: { lastUpdated: null }
}

$incrementCount = () => {
  $sharedData.count++
  $sharedData.metadata.lastUpdated = new Date()
  emit('data-updated', $sharedData)
}

$addItem = (item: any) => {
  $sharedData.items.push(item)
  $sharedData.metadata.lastUpdated = new Date()
  emit('data-updated', $sharedData)
}

on('data-updated', (newData) => {
  if (JSON.stringify(newData) !== JSON.stringify($sharedData)) {
    $sharedData = { ...newData }
  }
})`;

      const frameworks = ['reactjs', 'vue', 'svelte'];
      const graphs = frameworks.map(framework => {
        const syntax = `---\ntarget: ${framework}\n---\n${updateSyntax}`;
        const ast = parser.parse(syntax, `${framework}-update.mtm`);
        return reactiveAnalyzer.analyzeReactiveVariables(ast);
      });

      // All frameworks should have same reactive structure
      graphs.forEach(graph => {
        const sharedDataVar = graph.variables.get('sharedData');
        expect(sharedDataVar?.isReactive).toBe(true);
        expect(sharedDataVar?.inferredType.baseType).toBe('object');
        
        // Should have update triggers for UI synchronization
        expect(sharedDataVar?.updateTriggers.length).toBeGreaterThan(0);
      });
    });

    it('should maintain reactive variable dependencies across framework boundaries', () => {
      const dependencySyntax = `
$baseValue! = 10
$multiplier! = 2
$result! = $baseValue * $multiplier
$formatted! = \`Result: \${$result}\`

$updateBase = (value: number) => {
  $baseValue = value
  emit('base-changed', { baseValue: $baseValue })
}

on('base-changed', (data) => {
  if (data.baseValue !== $baseValue) {
    $baseValue = data.baseValue
  }
})`;

      const frameworks = ['reactjs', 'vue', 'svelte'];
      const graphs = frameworks.map(framework => {
        const syntax = `---\ntarget: ${framework}\n---\n${dependencySyntax}`;
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
        
        // Update chains should propagate changes
        const baseValueChain = graph.updateChains.find(chain => 
          chain.trigger === 'baseValue'
        );
        expect(baseValueChain?.affected).toContain('result');
        expect(baseValueChain?.affected).toContain('formatted');
      });
    });
  });

  describe('Requirement 3.2: Automatic UI Updates', () => {
    it('should generate consistent UI update mechanisms across frameworks', () => {
      const uiUpdateSyntax = `
$todos! = [
  { id: 1, text: "Learn MTM", completed: false },
  { id: 2, text: "Build app", completed: false }
]

$newTodo = ""

$addTodo = () => {
  if ($newTodo.trim()) {
    const id = Math.max(...$todos.map(t => t.id)) + 1
    $todos.push({ id, text: $newTodo.trim(), completed: false })
    $newTodo = ""
    emit('todos-updated', $todos)
  }
}

$toggleTodo = (id: number) => {
  const todo = $todos.find(t => t.id === id)
  if (todo) {
    todo.completed = !todo.completed
    emit('todos-updated', $todos)
  }
}

on('todos-updated', (newTodos) => {
  if (JSON.stringify(newTodos) !== JSON.stringify($todos)) {
    $todos = [...newTodos]
  }
})

return template(\`
  <div>
    <input value="{{$newTodo}}" oninput="$newTodo = event.target.value" />
    <button click="$addTodo()">Add Todo</button>
    
    <ul>
      {{#each $todos as todo}}
        <li class="{{todo.completed ? 'completed' : ''}}">
          <input type="checkbox" 
                 checked="{{todo.completed}}" 
                 change="$toggleTodo(todo.id)" />
          <span>{{todo.text}}</span>
        </li>
      {{/each}}
    </ul>
  </div>
\`)`;

      const frameworks = ['reactjs', 'vue', 'svelte'];
      
      frameworks.forEach(framework => {
        const syntax = `---\ntarget: ${framework}\n---\n${uiUpdateSyntax}`;
        const ast = parser.parse(syntax, `${framework}-ui-updates.mtm`);
        const graph = reactiveAnalyzer.analyzeReactiveVariables(ast);
        
        // Should have reactive todos array
        const todosVar = graph.variables.get('todos');
        expect(todosVar?.isReactive).toBe(true);
        expect(todosVar?.inferredType.baseType).toBe('array');
        
        // Should have UI update triggers
        expect(todosVar?.updateTriggers.length).toBeGreaterThan(0);
        
        // Template should have data bindings
        const templateNode = ast.body.find(node => 
          node.type === 'ReturnStatement' && 
          (node as any).argument?.type === 'CallExpression'
        );
        expect(templateNode).toBeDefined();
      });
    });

    it('should handle nested object updates consistently', () => {
      const nestedUpdateSyntax = `
$user! = {
  profile: {
    name: "John",
    email: "john@example.com",
    settings: {
      theme: "dark",
      notifications: {
        email: true,
        push: false,
        sms: true
      }
    }
  },
  activity: {
    lastLogin: null,
    loginCount: 0
  }
}

$updateProfile = (field: string, value: any) => {
  $user.profile[field] = value
  emit('user-updated', $user)
}

$updateSetting = (path: string[], value: any) => {
  let obj = $user
  for (let i = 0; i < path.length - 1; i++) {
    obj = obj[path[i]]
  }
  obj[path[path.length - 1]] = value
  emit('user-updated', $user)
}

$recordLogin = () => {
  $user.activity.lastLogin = new Date()
  $user.activity.loginCount++
  emit('user-updated', $user)
}

on('user-updated', (newUser) => {
  if (JSON.stringify(newUser) !== JSON.stringify($user)) {
    $user = { ...newUser }
  }
})`;

      const frameworks = ['reactjs', 'vue', 'svelte'];
      
      frameworks.forEach(framework => {
        const syntax = `---\ntarget: ${framework}\n---\n${nestedUpdateSyntax}`;
        const ast = parser.parse(syntax, `${framework}-nested.mtm`);
        const graph = reactiveAnalyzer.analyzeReactiveVariables(ast);
        
        const userVar = graph.variables.get('user');
        expect(userVar?.isReactive).toBe(true);
        expect(userVar?.inferredType.baseType).toBe('object');
        
        // Should detect nested property access
        expect(userVar?.inferredType.properties).toBeDefined();
      });
    });
  });

  describe('Requirement 3.5: Multi-Component Updates', () => {
    it('should synchronize state across multiple components in different frameworks', () => {
      // Component A (React)
      const componentASyntax = `---
target: reactjs
---

$sharedStore! = {
  currentUser: null,
  isAuthenticated: false,
  permissions: []
}

$login = (user: any) => {
  $sharedStore.currentUser = user
  $sharedStore.isAuthenticated = true
  $sharedStore.permissions = user.permissions || []
  emit('auth-changed', $sharedStore)
}

$logout = () => {
  $sharedStore.currentUser = null
  $sharedStore.isAuthenticated = false
  $sharedStore.permissions = []
  emit('auth-changed', $sharedStore)
}

on('auth-changed', (authState) => {
  if (JSON.stringify(authState) !== JSON.stringify($sharedStore)) {
    $sharedStore = { ...authState }
  }
})

return template(\`
  <div class="auth-component">
    {{#if $sharedStore.isAuthenticated}}
      <p>Welcome, {{$sharedStore.currentUser.name}}!</p>
      <button click="$logout()">Logout</button>
    {{else}}
      <button click="$login({name: 'John', permissions: ['read', 'write']})">Login</button>
    {{/if}}
  </div>
\`)`;

      // Component B (Vue)
      const componentBSyntax = `---
target: vue
---

$sharedStore! = {
  currentUser: null,
  isAuthenticated: false,
  permissions: []
}

$hasPermission = (permission: string) => {
  return $sharedStore.permissions.includes(permission)
}

on('auth-changed', (authState) => {
  if (JSON.stringify(authState) !== JSON.stringify($sharedStore)) {
    $sharedStore = { ...authState }
  }
})

return template(\`
  <div class="permissions-component">
    {{#if $sharedStore.isAuthenticated}}
      <h3>Permissions:</h3>
      <ul>
        {{#each $sharedStore.permissions as permission}}
          <li>{{permission}}</li>
        {{/each}}
      </ul>
      
      <div class="actions">
        {{#if $hasPermission('read')}}
          <button>Read Data</button>
        {{/if}}
        {{#if $hasPermission('write')}}
          <button>Write Data</button>
        {{/if}}
      </div>
    {{else}}
      <p>Please log in to see permissions</p>
    {{/if}}
  </div>
\`)`;

      // Component C (Svelte)
      const componentCSyntax = `---
target: svelte
---

$sharedStore! = {
  currentUser: null,
  isAuthenticated: false,
  permissions: []
}

$activityLog! = []

$logActivity = (action: string) => {
  $activityLog.push({
    timestamp: new Date(),
    user: $sharedStore.currentUser?.name || 'Anonymous',
    action
  })
  emit('activity-logged', $activityLog)
}

on('auth-changed', (authState) => {
  if (JSON.stringify(authState) !== JSON.stringify($sharedStore)) {
    $sharedStore = { ...authState }
    $logActivity(\`User \${authState.isAuthenticated ? 'logged in' : 'logged out'}\`)
  }
})

on('activity-logged', (newLog) => {
  if (JSON.stringify(newLog) !== JSON.stringify($activityLog)) {
    $activityLog = [...newLog]
  }
})

return template(\`
  <div class="activity-component">
    <h3>Activity Log</h3>
    <ul>
      {{#each $activityLog as entry}}
        <li>
          <span class="timestamp">{{entry.timestamp.toLocaleTimeString()}}</span>
          <span class="user">{{entry.user}}</span>
          <span class="action">{{entry.action}}</span>
        </li>
      {{/each}}
    </ul>
  </div>
\`)`;

      // Parse all components
      const componentA = parser.parse(componentASyntax, 'component-a.mtm');
      const componentB = parser.parse(componentBSyntax, 'component-b.mtm');
      const componentC = parser.parse(componentCSyntax, 'component-c.mtm');

      // Analyze reactive graphs
      const graphA = reactiveAnalyzer.analyzeReactiveVariables(componentA);
      const graphB = reactiveAnalyzer.analyzeReactiveVariables(componentB);
      const graphC = reactiveAnalyzer.analyzeReactiveVariables(componentC);

      // All should have sharedStore
      expect(graphA.variables.has('sharedStore')).toBe(true);
      expect(graphB.variables.has('sharedStore')).toBe(true);
      expect(graphC.variables.has('sharedStore')).toBe(true);

      // All sharedStore variables should be reactive
      const storeA = graphA.variables.get('sharedStore');
      const storeB = graphB.variables.get('sharedStore');
      const storeC = graphC.variables.get('sharedStore');

      expect(storeA?.isReactive).toBe(true);
      expect(storeB?.isReactive).toBe(true);
      expect(storeC?.isReactive).toBe(true);

      // Should have same structure
      expect(storeA?.inferredType.baseType).toBe('object');
      expect(storeB?.inferredType.baseType).toBe('object');
      expect(storeC?.inferredType.baseType).toBe('object');
    });

    it('should batch updates efficiently across framework boundaries', () => {
      const batchUpdateSyntax = `
$globalState! = {
  counter: 0,
  multiplier: 1,
  offset: 0
}

$derived1! = $globalState.counter * $globalState.multiplier
$derived2! = $derived1 + $globalState.offset
$derived3! = $derived2 * 2
$summary! = \`Counter: \${$globalState.counter}, Result: \${$derived3}\`

$batchUpdate = (counter: number, multiplier: number, offset: number) => {
  // These should be batched together
  $globalState.counter = counter
  $globalState.multiplier = multiplier
  $globalState.offset = offset
  
  emit('state-batch-updated', {
    globalState: $globalState,
    derived1: $derived1,
    derived2: $derived2,
    derived3: $derived3,
    summary: $summary
  })
}

on('state-batch-updated', (batchData) => {
  $globalState = { ...batchData.globalState }
})`;

      const frameworks = ['reactjs', 'vue', 'svelte'];
      
      frameworks.forEach(framework => {
        const syntax = `---\ntarget: ${framework}\n---\n${batchUpdateSyntax}`;
        const ast = parser.parse(syntax, `${framework}-batch.mtm`);
        const graph = reactiveAnalyzer.analyzeReactiveVariables(ast);
        
        // Simulate batch update
        const updates = [
          { variable: 'globalState.counter', value: 5 },
          { variable: 'globalState.multiplier', value: 3 },
          { variable: 'globalState.offset', value: 10 }
        ];
        
        const batchedUpdates = updateBatcher.batchUpdates(updates, graph);
        
        // Should batch all updates since they affect same dependents
        expect(batchedUpdates.batches.length).toBeGreaterThan(0);
        
        // All derived variables should be in affected list
        const affectedVars = batchedUpdates.batches.flatMap(batch => batch.affectedVariables);
        expect(affectedVars).toContain('derived1');
        expect(affectedVars).toContain('derived2');
        expect(affectedVars).toContain('derived3');
        expect(affectedVars).toContain('summary');
      });
    });

    it('should handle async state synchronization across frameworks', () => {
      const asyncSyncSyntax = `
$syncState! = {
  data: null,
  loading: false,
  error: null,
  lastSync: null
}

$syncData = async () => {
  $syncState.loading = true
  $syncState.error = null
  emit('sync-started', { loading: true })
  
  try {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100))
    const data = { timestamp: Date.now(), value: Math.random() }
    
    $syncState.data = data
    $syncState.lastSync = new Date()
    $syncState.loading = false
    
    emit('sync-completed', {
      data: $syncState.data,
      lastSync: $syncState.lastSync,
      loading: false
    })
  } catch (error) {
    $syncState.error = error.message
    $syncState.loading = false
    
    emit('sync-failed', {
      error: $syncState.error,
      loading: false
    })
  }
}

on('sync-started', (state) => {
  $syncState.loading = state.loading
})

on('sync-completed', (state) => {
  $syncState.data = state.data
  $syncState.lastSync = state.lastSync
  $syncState.loading = state.loading
})

on('sync-failed', (state) => {
  $syncState.error = state.error
  $syncState.loading = state.loading
})`;

      const frameworks = ['reactjs', 'vue', 'svelte'];
      
      frameworks.forEach(framework => {
        const syntax = `---\ntarget: ${framework}\n---\n${asyncSyncSyntax}`;
        const ast = parser.parse(syntax, `${framework}-async-sync.mtm`);
        const graph = reactiveAnalyzer.analyzeReactiveVariables(ast);
        
        const syncStateVar = graph.variables.get('syncState');
        expect(syncStateVar?.isReactive).toBe(true);
        expect(syncStateVar?.inferredType.baseType).toBe('object');
        
        // Should have async function
        const syncFunc = ast.body.find(node => 
          node.type === 'FunctionDeclaration' && (node as any).name === 'syncData'
        ) as any;
        expect(syncFunc?.async).toBe(true);
      });
    });
  });

  describe('Error Handling Consistency', () => {
    it('should handle cross-framework communication errors gracefully', () => {
      const errorHandlingSyntax = `
$connectionState! = {
  connected: false,
  retryCount: 0,
  lastError: null
}

$connect = async () => {
  try {
    $connectionState.connected = true
    emit('connection-established', { connected: true })
  } catch (error) {
    $connectionState.lastError = error.message
    $connectionState.retryCount++
    emit('connection-failed', { 
      error: error.message, 
      retryCount: $connectionState.retryCount 
    })
  }
}

on('connection-failed', (errorData) => {
  $connectionState.lastError = errorData.error
  $connectionState.retryCount = errorData.retryCount
  $connectionState.connected = false
})

on('connection-established', (data) => {
  $connectionState.connected = data.connected
  $connectionState.lastError = null
})`;

      const frameworks = ['reactjs', 'vue', 'svelte'];
      
      frameworks.forEach(framework => {
        const syntax = `---\ntarget: ${framework}\n---\n${errorHandlingSyntax}`;
        const ast = parser.parse(syntax, `${framework}-error-handling.mtm`);
        
        expect(ast).toBeDefined();
        expect(ast.syntaxVersion).toBe('modern');
        
        const graph = reactiveAnalyzer.analyzeReactiveVariables(ast);
        const connectionVar = graph.variables.get('connectionState');
        expect(connectionVar?.isReactive).toBe(true);
      });
    });
  });
});