#!/usr/bin/env node

// TypeScript Integration Demo
const { EnhancedMTMParser } = require('./enhanced-parser.js');
const { TypeScriptPathResolver } = require('./typescript-path-resolver.js');
const { TypeScriptIntegration } = require('./typescript-integration.js');
const fs = require('fs');
const path = require('path');

console.log('🚀 MTM Framework - TypeScript Integration Demo\n');
console.log('='.repeat(60));

// Create demo components directory
const demoDir = path.join(__dirname, '../../temp-typescript-demo');
const componentsDir = path.join(demoDir, 'src/components');

function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createDemoFiles() {
  console.log('📁 Creating demo TypeScript components...\n');

  ensureDirectoryExists(componentsDir);

  // React TypeScript component
  const reactComponent = `// React TypeScript Component
import React, { useState, useEffect } from 'react';

interface UserCardProps {
  userId: number;
  name: string;
  email?: string;
  onUserClick?: (userId: number) => void;
  className?: string;
}

const UserCard: React.FC<UserCardProps> = ({ 
  userId, 
  name, 
  email, 
  onUserClick,
  className = '' 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    // Simulate data loading
    setIsLoading(true);
    setTimeout(() => {
      setUserData({ id: userId, name, email });
      setIsLoading(false);
    }, 1000);
  }, [userId, name, email]);

  const handleClick = () => {
    if (onUserClick) {
      onUserClick(userId);
    }
  };

  if (isLoading) {
    return <div className={\`user-card loading \${className}\`}>Loading...</div>;
  }

  return (
    <div className={\`user-card \${className}\`} onClick={handleClick}>
      <h3>{name}</h3>
      {email && <p>{email}</p>}
      <small>ID: {userId}</small>
    </div>
  );
};

export default UserCard;`;

  // Vue TypeScript component
  const vueComponent = `<template>
  <div class="todo-list" :class="className">
    <h3>{{ title }}</h3>
    <ul>
      <li 
        v-for="todo in todos" 
        :key="todo.id"
        :class="{ completed: todo.completed }"
        @click="toggleTodo(todo.id)"
      >
        {{ todo.text }}
      </li>
    </ul>
    <button @click="addTodo" :disabled="!newTodoText">
      Add Todo
    </button>
    <input 
      v-model="newTodoText" 
      placeholder="Enter new todo..."
      @keyup.enter="addTodo"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

interface Props {
  title: string;
  initialTodos?: Todo[];
  className?: string;
}

interface Emits {
  todoAdded: [todo: Todo];
  todoToggled: [todoId: number, completed: boolean];
}

const props = withDefaults(defineProps<Props>(), {
  initialTodos: () => [],
  className: ''
});

const emit = defineEmits<Emits>();

const todos = ref<Todo[]>(props.initialTodos);
const newTodoText = ref('');
const nextId = ref(1);

const completedCount = computed(() => 
  todos.value.filter(todo => todo.completed).length
);

const addTodo = () => {
  if (newTodoText.value.trim()) {
    const newTodo: Todo = {
      id: nextId.value++,
      text: newTodoText.value.trim(),
      completed: false
    };
    
    todos.value.push(newTodo);
    emit('todoAdded', newTodo);
    newTodoText.value = '';
  }
};

const toggleTodo = (todoId: number) => {
  const todo = todos.value.find(t => t.id === todoId);
  if (todo) {
    todo.completed = !todo.completed;
    emit('todoToggled', todoId, todo.completed);
  }
};
</script>

<style scoped>
.todo-list {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  margin: 8px 0;
}

.completed {
  text-decoration: line-through;
  opacity: 0.6;
}
</style>`;

  // Solid TypeScript component
  const solidComponent = `// Solid TypeScript Component
import { createSignal, createEffect, For } from 'solid-js';

interface DataPoint {
  label: string;
  value: number;
  color: string;
}

interface AnalyticsChartProps {
  title?: string;
  data?: DataPoint[];
  onDataChange?: (data: DataPoint[]) => void;
  className?: string;
}

const AnalyticsChart = (props: AnalyticsChartProps) => {
  const [data, setData] = createSignal<DataPoint[]>(props.data || [
    { label: 'React', value: 35, color: '#61dafb' },
    { label: 'Vue', value: 25, color: '#4fc08d' },
    { label: 'Solid', value: 20, color: '#2c4f7c' },
    { label: 'Svelte', value: 20, color: '#ff3e00' }
  ]);

  const [selectedItem, setSelectedItem] = createSignal<DataPoint | null>(null);
  const [animationProgress, setAnimationProgress] = createSignal(0);

  // Animate chart on mount
  createEffect(() => {
    let start = 0;
    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / 1000, 1);
      setAnimationProgress(progress);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  });

  const total = () => data().reduce((sum, item) => sum + item.value, 0);
  const maxValue = () => Math.max(...data().map(item => item.value));

  const handleItemClick = (item: DataPoint) => {
    setSelectedItem(selectedItem() === item ? null : item);
  };

  const addRandomData = () => {
    const colors = ['#e74c3c', '#f39c12', '#9b59b6', '#1abc9c'];
    const labels = ['Angular', 'Ember', 'Alpine', 'Lit'];
    
    const newItem: DataPoint = {
      label: labels[Math.floor(Math.random() * labels.length)],
      value: Math.floor(Math.random() * 30) + 5,
      color: colors[Math.floor(Math.random() * colors.length)]
    };

    const newData = [...data(), newItem];
    setData(newData);
    
    if (props.onDataChange) {
      props.onDataChange(newData);
    }
  };

  return (
    <div class={\`analytics-chart \${props.className || ''}\`}>
      <header class="chart-header">
        <h3>{props.title || 'Analytics Chart'}</h3>
        <p>Interactive data visualization with Solid.js</p>
      </header>

      <div class="chart-container">
        <div class="bar-chart">
          <For each={data()}>
            {(item) => {
              const percentage = () => (item.value / maxValue()) * 100;
              const animatedHeight = () => percentage() * animationProgress();
              
              return (
                <div 
                  class={\`bar-item \${selectedItem() === item ? 'selected' : ''}\`}
                  onClick={() => handleItemClick(item)}
                >
                  <div class="bar-container">
                    <div 
                      class="bar"
                      style={{
                        height: \`\${animatedHeight()}%\`,
                        'background-color': item.color
                      }}
                    />
                  </div>
                  <div class="bar-label">{item.label}</div>
                  <div class="bar-value">{item.value}%</div>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      {selectedItem() && (
        <div class="item-details">
          <h4>Selected: {selectedItem()!.label}</h4>
          <p>Value: {selectedItem()!.value}%</p>
          <p>Percentage: {((selectedItem()!.value / total()) * 100).toFixed(1)}%</p>
        </div>
      )}

      <div class="chart-controls">
        <button class="add-btn" onClick={addRandomData}>
          Add Random Data
        </button>
        <div class="total-display">
          Total: {total()}%
        </div>
      </div>
    </div>
  );
};

export default AnalyticsChart;`;

  // Svelte TypeScript component
  const svelteComponent = `<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { writable, derived } from 'svelte/store';

  interface Notification {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    duration?: number;
  }

  export let maxNotifications: number = 5;
  export let defaultDuration: number = 5000;
  export let position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' = 'top-right';
  export let className: string = '';

  const dispatch = createEventDispatcher<{
    notificationAdded: Notification;
    notificationRemoved: string;
    allCleared: null;
  }>();

  const notifications = writable<Notification[]>([]);
  const notificationCount = derived(notifications, $notifications => $notifications.length);

  let notificationContainer: HTMLDivElement;

  onMount(() => {
    // Auto-remove notifications after their duration
    const unsubscribe = notifications.subscribe($notifications => {
      $notifications.forEach(notification => {
        if (notification.duration && notification.duration > 0) {
          setTimeout(() => {
            removeNotification(notification.id);
          }, notification.duration);
        }
      });
    });

    return unsubscribe;
  });

  export function addNotification(notification: Omit<Notification, 'id'>) {
    const id = \`notification-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
    const newNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration ?? defaultDuration
    };

    notifications.update(current => {
      const updated = [newNotification, ...current];
      // Limit to maxNotifications
      if (updated.length > maxNotifications) {
        updated.splice(maxNotifications);
      }
      return updated;
    });

    dispatch('notificationAdded', newNotification);
  }

  export function removeNotification(id: string) {
    notifications.update(current => {
      const filtered = current.filter(n => n.id !== id);
      if (filtered.length !== current.length) {
        dispatch('notificationRemoved', id);
      }
      return filtered;
    });
  }

  export function clearAll() {
    notifications.set([]);
    dispatch('allCleared', null);
  }

  function getNotificationIcon(type: Notification['type']): string {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return 'ℹ️';
    }
  }

  function handleNotificationClick(notification: Notification) {
    removeNotification(notification.id);
  }

  // Demo functions
  function addDemoNotification(type: Notification['type']) {
    const messages = {
      info: { title: 'Info', message: 'This is an informational message.' },
      success: { title: 'Success', message: 'Operation completed successfully!' },
      warning: { title: 'Warning', message: 'Please check your input.' },
      error: { title: 'Error', message: 'Something went wrong.' }
    };

    addNotification({
      type,
      ...messages[type]
    });
  }
</script>

<div class="notification-system {className}" class:position-{position}>
  <div class="demo-controls">
    <h3>Notification System</h3>
    <div class="control-buttons">
      <button on:click={() => addDemoNotification('info')}>Add Info</button>
      <button on:click={() => addDemoNotification('success')}>Add Success</button>
      <button on:click={() => addDemoNotification('warning')}>Add Warning</button>
      <button on:click={() => addDemoNotification('error')}>Add Error</button>
      <button on:click={clearAll} disabled={$notificationCount === 0}>
        Clear All ({$notificationCount})
      </button>
    </div>
  </div>

  <div 
    class="notification-container" 
    bind:this={notificationContainer}
  >
    {#each $notifications as notification (notification.id)}
      <div 
        class="notification notification-{notification.type}"
        on:click={() => handleNotificationClick(notification)}
        role="alert"
        tabindex="0"
        on:keydown={(e) => e.key === 'Enter' && handleNotificationClick(notification)}
      >
        <div class="notification-icon">
          {getNotificationIcon(notification.type)}
        </div>
        <div class="notification-content">
          <div class="notification-title">{notification.title}</div>
          <div class="notification-message">{notification.message}</div>
        </div>
        <button 
          class="notification-close"
          on:click|stopPropagation={() => removeNotification(notification.id)}
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
    {/each}
  </div>
</div>

<style>
  .notification-system {
    position: relative;
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: #f9f9f9;
  }

  .demo-controls {
    margin-bottom: 20px;
  }

  .control-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .control-buttons button {
    padding: 8px 16px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .control-buttons button:hover:not(:disabled) {
    background: #f0f0f0;
  }

  .control-buttons button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .notification-container {
    position: relative;
    max-height: 400px;
    overflow-y: auto;
  }

  .notification {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    margin-bottom: 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s ease;
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .notification:hover {
    transform: translateX(-4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .notification-info {
    background: #e3f2fd;
    border-left: 4px solid #2196f3;
  }

  .notification-success {
    background: #e8f5e8;
    border-left: 4px solid #4caf50;
  }

  .notification-warning {
    background: #fff3e0;
    border-left: 4px solid #ff9800;
  }

  .notification-error {
    background: #ffebee;
    border-left: 4px solid #f44336;
  }

  .notification-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .notification-content {
    flex: 1;
  }

  .notification-title {
    font-weight: bold;
    margin-bottom: 4px;
  }

  .notification-message {
    font-size: 14px;
    color: #666;
  }

  .notification-close {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background-color 0.2s;
  }

  .notification-close:hover {
    background: rgba(0, 0, 0, 0.1);
  }
</style>`;

  // Write demo components
  fs.writeFileSync(path.join(componentsDir, 'UserCard.tsx'), reactComponent);
  fs.writeFileSync(path.join(componentsDir, 'TodoList.vue'), vueComponent);
  fs.writeFileSync(path.join(componentsDir, 'AnalyticsChart.tsx'), solidComponent);
  fs.writeFileSync(path.join(componentsDir, 'NotificationSystem.svelte'), svelteComponent);

  console.log('✅ Created demo TypeScript components:');
  console.log('   - UserCard.tsx (React)');
  console.log('   - TodoList.vue (Vue)');
  console.log('   - AnalyticsChart.tsx (Solid)');
  console.log('   - NotificationSystem.svelte (Svelte)\n');
}

function demonstratePathResolution() {
  console.log('🔍 Demonstrating TypeScript Path Resolution...\n');

  const resolver = new TypeScriptPathResolver({
    baseUrl: demoDir,
    paths: {
      '@components/*': ['src/components/*'],
      '@utils/*': ['src/utils/*'],
      '@types/*': ['src/types/*']
    }
  });

  const testPaths = [
    '@components/UserCard',
    '@components/TodoList.vue',
    './AnalyticsChart',
    '../components/NotificationSystem.svelte'
  ];

  for (const testPath of testPaths) {
    try {
      const result = resolver.resolve(testPath, path.join(demoDir, 'src/pages/test.mtm'));

      console.log(`📁 Path: ${testPath}`);
      console.log(`   ✅ Resolved: ${result.found ? 'Yes' : 'No'}`);
      if (result.found) {
        console.log(`   📄 File: ${path.relative(demoDir, result.resolvedPath)}`);
        console.log(`   🎯 Framework: ${result.framework}`);
        console.log(`   📝 TypeScript: ${result.isTypeScript ? 'Yes' : 'No'}`);
        console.log(`   🔗 Node Module: ${result.isNodeModule ? 'Yes' : 'No'}`);
      } else {
        console.log(`   ❌ Error: ${result.error}`);
      }
      console.log('');
    } catch (error) {
      console.log(`📁 Path: ${testPath}`);
      console.log(`   ❌ Error: ${error.message}\n`);
    }
  }
}

function demonstrateComponentAnalysis() {
  console.log('🔬 Demonstrating Component Type Analysis...\n');

  const integration = new TypeScriptIntegration();

  const components = [
    { name: 'UserCard', path: path.join(componentsDir, 'UserCard.tsx'), framework: 'react' },
    { name: 'TodoList', path: path.join(componentsDir, 'TodoList.vue'), framework: 'vue' },
    { name: 'AnalyticsChart', path: path.join(componentsDir, 'AnalyticsChart.tsx'), framework: 'solid' },
    { name: 'NotificationSystem', path: path.join(componentsDir, 'NotificationSystem.svelte'), framework: 'svelte' }
  ];

  for (const component of components) {
    console.log(`🧩 Component: ${component.name} (${component.framework})`);

    try {
      const metadata = integration.analyzeComponentTypes(component.path, component.framework);

      console.log(`   📝 TypeScript: ${metadata.hasTypeScript ? 'Yes' : 'No'}`);
      console.log(`   🎛️  Props: ${metadata.props.length}`);

      if (metadata.props.length > 0) {
        for (const prop of metadata.props.slice(0, 3)) { // Show first 3 props
          const optional = prop.optional ? '?' : '';
          const defaultValue = prop.default ? ` = ${prop.default}` : '';
          console.log(`      - ${prop.name}${optional}: ${prop.type}${defaultValue}`);
        }
        if (metadata.props.length > 3) {
          console.log(`      ... and ${metadata.props.length - 3} more`);
        }
      }

      // Framework-specific info
      if (metadata.hooks && metadata.hooks.length > 0) {
        console.log(`   🪝 Hooks: ${metadata.hooks.join(', ')}`);
      }
      if (metadata.emits && metadata.emits.length > 0) {
        console.log(`   📡 Emits: ${metadata.emits.length} events`);
      }
      if (metadata.signals && metadata.signals.length > 0) {
        console.log(`   📶 Signals: ${metadata.signals.length}`);
      }
      if (metadata.stores && metadata.stores.length > 0) {
        console.log(`   🏪 Stores: ${metadata.stores.join(', ')}`);
      }

    } catch (error) {
      console.log(`   ❌ Analysis Error: ${error.message}`);
    }

    console.log('');
  }
}

function demonstrateEnhancedParsing() {
  console.log('⚡ Demonstrating Enhanced MTM Parsing with TypeScript...\n');

  const parser = new EnhancedMTMParser({
    enableTypeScript: true,
    typeScriptResolver: new TypeScriptPathResolver({
      baseUrl: demoDir,
      paths: {
        '@components/*': ['src/components/*']
      }
    })
  });

  const mtmSource = `---
route: "/typescript-demo"
compileJsMode: "external.js"
title: "TypeScript Integration Demo"
---

import UserCard from "@components/UserCard.tsx"
import TodoList from "@components/TodoList.vue"
import AnalyticsChart from "@components/AnalyticsChart.tsx"
import NotificationSystem from "@components/NotificationSystem.svelte"

\$user! = signal('user', { id: 1, name: 'John Doe', email: 'john@example.com' })
\$todos! = signal('todos', [])
\$chartData! = signal('chartData', [])

\$handleUserClick = (userId) => {
  console.log('User clicked:', userId)
}

\$handleTodoAdded = (todo) => {
  \$todos = [...\$todos, todo]
}

\$handleDataChange = (newData) => {
  \$chartData = newData
}

<template>
  <div class="typescript-demo">
    <h1>TypeScript Integration Demo</h1>
    
    <section class="user-section">
      <h2>React Component (TypeScript)</h2>
      <UserCard 
        userId={\$user.id}
        name={\$user.name}
        email={\$user.email}
        onUserClick={\$handleUserClick}
        className="demo-user-card"
      />
    </section>

    <section class="todo-section">
      <h2>Vue Component (TypeScript)</h2>
      <TodoList 
        title="My Tasks"
        initialTodos={\$todos}
        onTodoAdded={\$handleTodoAdded}
        className="demo-todo-list"
      />
    </section>

    <section class="chart-section">
      <h2>Solid Component (TypeScript)</h2>
      <AnalyticsChart 
        title="Framework Usage"
        data={\$chartData}
        onDataChange={\$handleDataChange}
        className="demo-chart"
      />
    </section>

    <section class="notification-section">
      <h2>Svelte Component (TypeScript)</h2>
      <NotificationSystem 
        maxNotifications={5}
        defaultDuration={3000}
        position="top-right"
        className="demo-notifications"
      />
    </section>
  </div>
</template>
`;

  try {
    const ast = parser.parse(mtmSource, path.join(demoDir, 'pages/demo.mtm'));

    console.log('📊 Parsing Results:');
    console.log(`   📄 Component: ${ast.name}`);
    console.log(`   🎯 Framework: ${ast.framework}`);
    console.log(`   📦 Imports: ${ast.imports.length}`);
    console.log(`   🔧 Enhanced Imports: ${ast.enhancedImports.length}`);
    console.log(`   📝 Variables: ${ast.variables.length}`);
    console.log(`   ⚡ Functions: ${ast.functions.length}`);
    console.log(`   ❌ Type Errors: ${ast.typeValidationErrors.length}`);
    console.log('');

    // Show enhanced import details
    console.log('🔍 Enhanced Import Analysis:');
    for (const imp of ast.enhancedImports) {
      console.log(`   📦 ${imp.name} (${imp.framework})`);
      console.log(`      ✅ Resolved: ${!imp.error ? 'Yes' : 'No'}`);
      if (!imp.error) {
        console.log(`      📄 File: ${path.relative(demoDir, imp.resolved.resolvedPath)}`);
        console.log(`      📝 TypeScript: ${imp.hasTypeScript ? 'Yes' : 'No'}`);
        console.log(`      🎛️  Props: ${imp.componentMetadata.props.length}`);
      } else {
        console.log(`      ❌ Error: ${imp.error.message}`);
      }
      console.log('');
    }

    // Generate IntelliSense info
    const intelliSense = parser.generateIntelliSenseInfo(ast, path.join(demoDir, 'pages/demo.mtm'));

    console.log('🧠 IntelliSense Information:');
    console.log(`   🧩 Components: ${intelliSense.components.length}`);
    console.log(`   📝 Variables: ${intelliSense.variables.length}`);
    console.log(`   ⚡ Functions: ${intelliSense.functions.length}`);
    console.log(`   💡 Completions: ${intelliSense.completions.length}`);
    console.log(`   ⚠️  Diagnostics: ${intelliSense.diagnostics.length}`);
    console.log('');

    // Show some completions
    console.log('💡 Sample Completions:');
    const sampleCompletions = intelliSense.completions.slice(0, 5);
    for (const completion of sampleCompletions) {
      console.log(`   - ${completion.label} (${completion.kind}): ${completion.detail}`);
    }
    if (intelliSense.completions.length > 5) {
      console.log(`   ... and ${intelliSense.completions.length - 5} more`);
    }

  } catch (error) {
    console.log(`❌ Parsing Error: ${error.message}`);
  }
}

function cleanup() {
  console.log('\\n🧹 Cleaning up demo files...');

  try {
    if (fs.existsSync(demoDir)) {
      fs.rmSync(demoDir, { recursive: true, force: true });
      console.log('✅ Demo files cleaned up.');
    }
  } catch (error) {
    console.log(`⚠️  Cleanup warning: ${error.message}`);
  }
}

async function runDemo() {
  try {
    createDemoFiles();
    demonstratePathResolution();
    demonstrateComponentAnalysis();
    demonstrateEnhancedParsing();

    console.log('='.repeat(60));
    console.log('🎉 TypeScript Integration Demo Complete!');
    console.log('');
    console.log('Key Features Demonstrated:');
    console.log('✅ TypeScript path resolution with aliases');
    console.log('✅ Multi-framework component type analysis');
    console.log('✅ Enhanced MTM parsing with TypeScript support');
    console.log('✅ IntelliSense information generation');
    console.log('✅ Type validation and error reporting');
    console.log('');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.error(error.stack);
  } finally {
    cleanup();
  }
}

// Run the demo
if (require.main === module) {
  runDemo();
}

module.exports = { runDemo };