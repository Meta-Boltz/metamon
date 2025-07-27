#!/usr/bin/env node

/**
 * Integration Test Runner for Enhanced MTM Framework
 * 
 * This script provides a convenient way to run all integration tests
 * with proper setup, teardown, and reporting.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { CITestSuite } = require('./tests/ci-test-suite.js');

class IntegrationTestRunner {
  constructor() {
    this.testDir = path.join(__dirname, 'tests');
    this.tempDir = path.join(__dirname, 'temp-test-artifacts');
    this.reportsDir = path.join(__dirname, 'reports');
  }

  async setup() {
    console.log('🔧 Setting up test environment...');

    // Create necessary directories
    const dirs = [this.tempDir, this.reportsDir];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    // Check for required dependencies
    await this.checkDependencies();

    // Setup test data
    await this.setupTestData();

    console.log('✅ Test environment setup complete');
  }

  async checkDependencies() {
    const requiredPackages = [
      'jest',
      'jsdom',
      '@babel/core',
      '@babel/preset-env'
    ];

    const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      const missing = requiredPackages.filter(pkg => !allDeps[pkg]);

      if (missing.length > 0) {
        console.log(`⚠️  Missing dependencies: ${missing.join(', ')}`);
        console.log('Please install them with: npm install --save-dev ' + missing.join(' '));
      }
    }
  }

  async setupTestData() {
    // Create sample component files for testing
    const componentsDir = path.join(this.tempDir, 'components');
    if (!fs.existsSync(componentsDir)) {
      fs.mkdirSync(componentsDir, { recursive: true });
    }

    // Sample React component
    const reactComponent = `import React, { useState, useEffect } from 'react';

interface CounterProps {
  initialValue?: number;
  onUpdate?: (value: number) => void;
  className?: string;
}

const Counter: React.FC<CounterProps> = ({ 
  initialValue = 0, 
  onUpdate,
  className = ''
}) => {
  const [count, setCount] = useState(initialValue);

  useEffect(() => {
    if (onUpdate) {
      onUpdate(count);
    }
  }, [count, onUpdate]);

  const increment = () => setCount(prev => prev + 1);
  const decrement = () => setCount(prev => prev - 1);
  const reset = () => setCount(initialValue);

  return (
    <div className={\`counter-component \${className}\`}>
      <div className="counter-display">
        <span className="counter-value">{count}</span>
      </div>
      <div className="counter-controls">
        <button onClick={decrement} className="counter-btn counter-btn--decrement">
          -
        </button>
        <button onClick={reset} className="counter-btn counter-btn--reset">
          Reset
        </button>
        <button onClick={increment} className="counter-btn counter-btn--increment">
          +
        </button>
      </div>
    </div>
  );
};

export default Counter;`;

    fs.writeFileSync(path.join(componentsDir, 'Counter.tsx'), reactComponent);

    // Sample Vue component
    const vueComponent = `<template>
  <div class="todo-list-component">
    <div class="todo-input">
      <input
        v-model="newTodo"
        @keyup.enter="addTodo"
        placeholder="Add a new todo..."
        class="todo-input-field"
      />
      <button @click="addTodo" class="todo-add-btn">Add</button>
    </div>
    
    <div class="todo-items">
      <div
        v-for="todo in todos"
        :key="todo.id"
        class="todo-item"
        :class="{ 'todo-item--completed': todo.completed }"
      >
        <input
          type="checkbox"
          v-model="todo.completed"
          @change="updateTodo(todo)"
          class="todo-checkbox"
        />
        <span class="todo-text">{{ todo.text }}</span>
        <button @click="removeTodo(todo.id)" class="todo-remove-btn">×</button>
      </div>
    </div>
    
    <div class="todo-stats">
      <span>{{ completedCount }}/{{ todos.length }} completed</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

interface Props {
  todos?: Todo[];
  onUpdate?: (todos: Todo[]) => void;
}

const props = withDefaults(defineProps<Props>(), {
  todos: () => []
});

const emit = defineEmits<{
  update: [todos: Todo[]];
}>();

const todos = ref<Todo[]>([...props.todos]);
const newTodo = ref('');

const completedCount = computed(() => 
  todos.value.filter(todo => todo.completed).length
);

const addTodo = () => {
  if (newTodo.value.trim()) {
    todos.value.push({
      id: Date.now(),
      text: newTodo.value.trim(),
      completed: false
    });
    newTodo.value = '';
    emitUpdate();
  }
};

const removeTodo = (id: number) => {
  todos.value = todos.value.filter(todo => todo.id !== id);
  emitUpdate();
};

const updateTodo = (updatedTodo: Todo) => {
  const index = todos.value.findIndex(todo => todo.id === updatedTodo.id);
  if (index !== -1) {
    todos.value[index] = updatedTodo;
    emitUpdate();
  }
};

const emitUpdate = () => {
  emit('update', [...todos.value]);
  if (props.onUpdate) {
    props.onUpdate([...todos.value]);
  }
};

watch(() => props.todos, (newTodos) => {
  todos.value = [...newTodos];
}, { deep: true });
</script>

<style scoped>
.todo-list-component {
  max-width: 400px;
  margin: 0 auto;
  padding: 1rem;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  background: white;
}

.todo-input {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.todo-input-field {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.todo-add-btn {
  padding: 0.5rem 1rem;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-bottom: 1px solid #f0f0f0;
}

.todo-item--completed .todo-text {
  text-decoration: line-through;
  opacity: 0.6;
}

.todo-text {
  flex: 1;
}

.todo-remove-btn {
  background: #f44336;
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.todo-stats {
  margin-top: 1rem;
  text-align: center;
  color: #666;
  font-size: 0.9rem;
}
</style>`;

    fs.writeFileSync(path.join(componentsDir, 'TodoList.vue'), vueComponent);

    // Sample Svelte component
    const svelteComponent = `<script lang="ts">
  export let notifications: Array<{
    id: number;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    timestamp: string;
  }> = [];
  
  export let onNotificationAdd: ((notification: any) => void) | undefined = undefined;
  export let maxNotifications = 5;

  let newMessage = '';
  let selectedType: 'info' | 'success' | 'warning' | 'error' = 'info';

  function addNotification() {
    if (newMessage.trim()) {
      const notification = {
        id: Date.now(),
        message: newMessage.trim(),
        type: selectedType,
        timestamp: new Date().toLocaleTimeString()
      };
      
      if (onNotificationAdd) {
        onNotificationAdd(notification);
      }
      
      newMessage = '';
    }
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return 'ℹ️';
    }
  }

  function getNotificationClass(type: string) {
    return \`notification notification--\${type}\`;
  }
</script>

<div class="weather-widget">
  <div class="widget-header">
    <h3>🌤️ Weather Widget</h3>
  </div>
  
  <div class="add-notification">
    <input
      bind:value={newMessage}
      on:keyup={(e) => e.key === 'Enter' && addNotification()}
      placeholder="Add a notification..."
      class="notification-input"
    />
    
    <select bind:value={selectedType} class="notification-type">
      <option value="info">Info</option>
      <option value="success">Success</option>
      <option value="warning">Warning</option>
      <option value="error">Error</option>
    </select>
    
    <button on:click={addNotification} class="add-btn">Add</button>
  </div>
  
  <div class="notifications-list">
    {#each notifications.slice(-maxNotifications) as notification (notification.id)}
      <div class={getNotificationClass(notification.type)}>
        <span class="notification-icon">
          {getNotificationIcon(notification.type)}
        </span>
        <div class="notification-content">
          <div class="notification-message">{notification.message}</div>
          <div class="notification-time">{notification.timestamp}</div>
        </div>
      </div>
    {/each}
    
    {#if notifications.length === 0}
      <div class="no-notifications">
        <p>No notifications yet. Add one above!</p>
      </div>
    {/if}
  </div>
  
  <div class="widget-footer">
    <small>Showing {Math.min(notifications.length, maxNotifications)} of {notifications.length} notifications</small>
  </div>
</div>

<style>
  .weather-widget {
    max-width: 350px;
    margin: 0 auto;
    padding: 1rem;
    border: 1px solid #e1e5e9;
    border-radius: 12px;
    background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .widget-header {
    text-align: center;
    margin-bottom: 1rem;
  }

  .widget-header h3 {
    margin: 0;
    font-size: 1.2rem;
  }

  .add-notification {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .notification-input {
    flex: 1;
    padding: 0.5rem;
    border: none;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.9);
  }

  .notification-type {
    padding: 0.5rem;
    border: none;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.9);
  }

  .add-btn {
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .add-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .notifications-list {
    max-height: 300px;
    overflow-y: auto;
    margin-bottom: 1rem;
  }

  .notification {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
  }

  .notification--info {
    border-left: 4px solid #74b9ff;
  }

  .notification--success {
    border-left: 4px solid #00b894;
  }

  .notification--warning {
    border-left: 4px solid #fdcb6e;
  }

  .notification--error {
    border-left: 4px solid #e17055;
  }

  .notification-icon {
    font-size: 1.2rem;
  }

  .notification-content {
    flex: 1;
  }

  .notification-message {
    font-weight: 500;
    margin-bottom: 0.25rem;
  }

  .notification-time {
    font-size: 0.8rem;
    opacity: 0.8;
  }

  .no-notifications {
    text-align: center;
    padding: 2rem;
    opacity: 0.7;
  }

  .widget-footer {
    text-align: center;
    opacity: 0.8;
  }
</style>`;

    fs.writeFileSync(path.join(componentsDir, 'WeatherWidget.svelte'), svelteComponent);

    console.log('📁 Test data setup complete');
  }

  async cleanup() {
    console.log('🧹 Cleaning up test environment...');

    // Remove temporary files
    if (fs.existsSync(this.tempDir)) {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    }

    console.log('✅ Cleanup complete');
  }

  async runTests(options = {}) {
    const {
      suite = 'all',
      verbose = false,
      coverage = false,
      bail = false,
      parallel = true
    } = options;

    console.log('🚀 Starting Enhanced MTM Framework Integration Tests');
    console.log('='.repeat(60));

    try {
      await this.setup();

      if (suite === 'smoke') {
        const ciSuite = new CITestSuite();
        const success = await ciSuite.runQuickSmokeTests();
        return success;
      } else if (suite === 'all') {
        const ciSuite = new CITestSuite();
        const results = await ciSuite.runAllTests();
        return results.summary.failed === 0;
      } else {
        // Run specific test suite
        return await this.runSpecificSuite(suite, { verbose, coverage, bail });
      }
    } catch (error) {
      console.error('💥 Test execution failed:', error);
      return false;
    } finally {
      await this.cleanup();
    }
  }

  async runSpecificSuite(suiteName, options) {
    const testFile = path.join(this.testDir, `${suiteName}.test.js`);

    if (!fs.existsSync(testFile)) {
      console.error(`❌ Test suite not found: ${suiteName}`);
      return false;
    }

    console.log(`🧪 Running specific test suite: ${suiteName}`);

    const jestArgs = [
      'jest',
      testFile,
      '--verbose',
      '--no-cache'
    ];

    if (options.coverage) {
      jestArgs.push('--coverage');
    }

    if (options.bail) {
      jestArgs.push('--bail');
    }

    return new Promise((resolve) => {
      const jest = spawn('npx', jestArgs, {
        stdio: 'inherit',
        cwd: __dirname
      });

      jest.on('close', (code) => {
        resolve(code === 0);
      });

      jest.on('error', (error) => {
        console.error('Jest execution error:', error);
        resolve(false);
      });
    });
  }

  async generateCoverageReport() {
    console.log('📊 Generating coverage report...');

    const coverageArgs = [
      'jest',
      '--coverage',
      '--coverageDirectory=coverage',
      '--coverageReporters=html,text,lcov'
    ];

    return new Promise((resolve) => {
      const jest = spawn('npx', coverageArgs, {
        stdio: 'inherit',
        cwd: __dirname
      });

      jest.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Coverage report generated in ./coverage directory');
        }
        resolve(code === 0);
      });
    });
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const runner = new IntegrationTestRunner();

  const options = {
    suite: 'all',
    verbose: args.includes('--verbose') || args.includes('-v'),
    coverage: args.includes('--coverage'),
    bail: args.includes('--bail'),
    parallel: !args.includes('--no-parallel')
  };

  // Parse suite argument
  const suiteIndex = args.findIndex(arg => arg === '--suite');
  if (suiteIndex !== -1 && args[suiteIndex + 1]) {
    options.suite = args[suiteIndex + 1];
  }

  // Check for smoke test flag
  if (args.includes('--smoke')) {
    options.suite = 'smoke';
  }

  runner.runTests(options).then(success => {
    if (success) {
      console.log('\n🎉 All tests completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Some tests failed. Please check the output above.');
      process.exit(1);
    }
  }).catch(error => {
    console.error('\n💥 Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { IntegrationTestRunner };