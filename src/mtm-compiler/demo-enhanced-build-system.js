// Demo script for Enhanced Build System Integration
const fs = require('fs');
const path = require('path');
const { BuildSystemIntegration } = require('./build-system-integration.js');

async function runEnhancedBuildDemo() {
  console.log('🔮 Enhanced MTM Build System Demo');
  console.log('=====================================\n');

  // Create demo directory structure
  const demoDir = path.join(__dirname, 'demo-enhanced-build');
  const srcDir = path.join(demoDir, 'src');
  const pagesDir = path.join(srcDir, 'pages');
  const componentsDir = path.join(srcDir, 'components');
  const distDir = path.join(demoDir, 'dist');

  // Clean up previous demo
  if (fs.existsSync(demoDir)) {
    fs.rmSync(demoDir, { recursive: true, force: true });
  }

  // Create directory structure
  fs.mkdirSync(pagesDir, { recursive: true });
  fs.mkdirSync(componentsDir, { recursive: true });

  console.log('📁 Created demo directory structure');

  // Create sample React component
  const reactComponent = `import React, { useState } from 'react';

interface CounterProps {
  initialValue?: number;
  step?: number;
}

export default function Counter({ initialValue = 0, step = 1 }: CounterProps) {
  const [count, setCount] = useState(initialValue);

  return (
    <div className="counter">
      <h3>React Counter</h3>
      <div className="counter-display">
        <button onClick={() => setCount(count - step)}>-</button>
        <span className="count">{count}</span>
        <button onClick={() => setCount(count + step)}>+</button>
      </div>
    </div>
  );
}`;

  fs.writeFileSync(path.join(componentsDir, 'Counter.tsx'), reactComponent);

  // Create sample Vue component
  const vueComponent = `<template>
  <div class="todo-list">
    <h3>Vue Todo List</h3>
    <div class="todo-input">
      <input v-model="newTodo" @keyup.enter="addTodo" placeholder="Add todo...">
      <button @click="addTodo">Add</button>
    </div>
    <ul>
      <li v-for="todo in todos" :key="todo.id" :class="{ completed: todo.completed }">
        <input type="checkbox" v-model="todo.completed">
        <span>{{ todo.text }}</span>
        <button @click="removeTodo(todo.id)">Remove</button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

const newTodo = ref('');
const todos = reactive<Todo[]>([
  { id: 1, text: 'Learn MTM Framework', completed: false },
  { id: 2, text: 'Build awesome apps', completed: false }
]);

let nextId = 3;

function addTodo() {
  if (newTodo.value.trim()) {
    todos.push({
      id: nextId++,
      text: newTodo.value,
      completed: false
    });
    newTodo.value = '';
  }
}

function removeTodo(id: number) {
  const index = todos.findIndex(todo => todo.id === id);
  if (index > -1) {
    todos.splice(index, 1);
  }
}
</script>

<style scoped>
.todo-list { padding: 1rem; border: 1px solid #ddd; border-radius: 8px; }
.todo-input { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
.todo-input input { flex: 1; padding: 0.5rem; }
.completed span { text-decoration: line-through; opacity: 0.6; }
</style>`;

  fs.writeFileSync(path.join(componentsDir, 'TodoList.vue'), vueComponent);

  // Create sample Solid component
  const solidComponent = `import { createSignal, createEffect } from 'solid-js';

interface DataChartProps {
  data?: number[];
  title?: string;
}

export default function DataChart(props: DataChartProps) {
  const [data, setData] = createSignal(props.data || [10, 20, 15, 30, 25]);
  const [maxValue, setMaxValue] = createSignal(0);

  createEffect(() => {
    setMaxValue(Math.max(...data()));
  });

  const addDataPoint = () => {
    const newValue = Math.floor(Math.random() * 50) + 1;
    setData([...data(), newValue]);
  };

  const clearData = () => {
    setData([]);
  };

  return (
    <div class="data-chart">
      <h3>{props.title || 'Solid Data Chart'}</h3>
      <div class="chart-container">
        {data().map((value, index) => (
          <div 
            class="bar" 
            style={{
              height: \`\${(value / maxValue()) * 100}px\`,
              'background-color': \`hsl(\${(value / maxValue()) * 120}, 70%, 50%)\`
            }}
            title={\`Value: \${value}\`}
          />
        ))}
      </div>
      <div class="chart-controls">
        <button onClick={addDataPoint}>Add Data</button>
        <button onClick={clearData}>Clear</button>
        <span>Max: {maxValue()}</span>
      </div>
    </div>
  );
}`;

  fs.writeFileSync(path.join(componentsDir, 'DataChart.tsx'), solidComponent);

  // Create sample Svelte component
  const svelteComponent = `<script lang="ts">
  export let location: string = 'New York';
  export let unit: 'C' | 'F' = 'C';

  interface WeatherData {
    temperature: number;
    condition: string;
    humidity: number;
    windSpeed: number;
  }

  let weather: WeatherData = {
    temperature: unit === 'C' ? 22 : 72,
    condition: 'Sunny',
    humidity: 65,
    windSpeed: 12
  };

  let loading = false;

  async function refreshWeather() {
    loading = true;
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    weather = {
      temperature: unit === 'C' 
        ? Math.floor(Math.random() * 30) + 5
        : Math.floor(Math.random() * 54) + 41,
      condition: ['Sunny', 'Cloudy', 'Rainy', 'Windy'][Math.floor(Math.random() * 4)],
      humidity: Math.floor(Math.random() * 40) + 40,
      windSpeed: Math.floor(Math.random() * 20) + 5
    };
    
    loading = false;
  }

  function toggleUnit() {
    if (unit === 'C') {
      unit = 'F';
      weather.temperature = Math.round(weather.temperature * 9/5 + 32);
    } else {
      unit = 'C';
      weather.temperature = Math.round((weather.temperature - 32) * 5/9);
    }
  }
</script>

<div class="weather-widget">
  <h3>Svelte Weather Widget</h3>
  <div class="location">{location}</div>
  
  {#if loading}
    <div class="loading">Loading weather data...</div>
  {:else}
    <div class="weather-info">
      <div class="temperature">
        {weather.temperature}°{unit}
        <button on:click={toggleUnit} class="unit-toggle">
          Switch to °{unit === 'C' ? 'F' : 'C'}
        </button>
      </div>
      <div class="condition">{weather.condition}</div>
      <div class="details">
        <div>Humidity: {weather.humidity}%</div>
        <div>Wind: {weather.windSpeed} km/h</div>
      </div>
    </div>
  {/if}
  
  <button on:click={refreshWeather} disabled={loading} class="refresh-btn">
    {loading ? 'Refreshing...' : 'Refresh Weather'}
  </button>
</div>

<style>
  .weather-widget {
    padding: 1.5rem;
    border: 2px solid #e0e0e0;
    border-radius: 12px;
    background: linear-gradient(135deg, #74b9ff, #0984e3);
    color: white;
    text-align: center;
    min-width: 250px;
  }
  
  .location {
    font-size: 1.2em;
    font-weight: bold;
    margin-bottom: 1rem;
  }
  
  .temperature {
    font-size: 3em;
    font-weight: bold;
    margin: 1rem 0;
    position: relative;
  }
  
  .unit-toggle {
    position: absolute;
    top: 0;
    right: -60px;
    font-size: 0.3em;
    padding: 0.2em 0.4em;
    background: rgba(255,255,255,0.2);
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 4px;
    color: white;
    cursor: pointer;
  }
  
  .condition {
    font-size: 1.3em;
    margin-bottom: 1rem;
  }
  
  .details {
    display: flex;
    justify-content: space-around;
    margin: 1rem 0;
    font-size: 0.9em;
  }
  
  .refresh-btn {
    background: rgba(255,255,255,0.2);
    border: 1px solid rgba(255,255,255,0.3);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .refresh-btn:hover:not(:disabled) {
    background: rgba(255,255,255,0.3);
  }
  
  .refresh-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .loading {
    font-style: italic;
    margin: 2rem 0;
  }
</style>`;

  fs.writeFileSync(path.join(componentsDir, 'WeatherWidget.svelte'), svelteComponent);

  console.log('📦 Created sample framework components');

  // Create MTM pages that use these components
  const homePage = `---
route: "/"
title: "Enhanced MTM Demo - Home"
description: "Showcase of enhanced MTM framework with multi-framework support"
compileJsMode: "external.js"
keywords: "mtm, react, vue, solid, svelte, framework"
---

<template>
  <div class="home-page">
    <header class="hero">
      <h1>🔮 Enhanced MTM Framework</h1>
      <p>One framework to rule them all - React, Vue, Solid, and Svelte in harmony</p>
    </header>

    <nav class="navigation">
      <a href="/" data-link="true">Home</a>
      <a href="/react-demo" data-link="true">React Demo</a>
      <a href="/vue-demo" data-link="true">Vue Demo</a>
      <a href="/solid-demo" data-link="true">Solid Demo</a>
      <a href="/svelte-demo" data-link="true">Svelte Demo</a>
      <a href="/multi-framework" data-link="true">Multi-Framework</a>
    </nav>

    <main class="content">
      <section class="features">
        <h2>🚀 Enhanced Features</h2>
        <div class="feature-grid">
          <div class="feature-card">
            <h3>🔥 Hot Module Replacement</h3>
            <p>Lightning-fast development with real-time updates</p>
          </div>
          <div class="feature-card">
            <h3>📦 Framework Bundles</h3>
            <p>Optimized code splitting by framework</p>
          </div>
          <div class="feature-card">
            <h3>🌳 Tree Shaking</h3>
            <p>Eliminate dead code for smaller bundles</p>
          </div>
          <div class="feature-card">
            <h3>📊 Bundle Analysis</h3>
            <p>Detailed insights into your build</p>
          </div>
        </div>
      </section>

      <section class="getting-started">
        <h2>🎯 Getting Started</h2>
        <p>Navigate through the demo pages to see different frameworks in action:</p>
        <ul>
          <li><strong>React Demo:</strong> Interactive counter component</li>
          <li><strong>Vue Demo:</strong> Todo list with Composition API</li>
          <li><strong>Solid Demo:</strong> Real-time data chart</li>
          <li><strong>Svelte Demo:</strong> Weather widget with animations</li>
          <li><strong>Multi-Framework:</strong> All frameworks on one page</li>
        </ul>
      </section>
    </main>
  </div>
</template>`;

  fs.writeFileSync(path.join(pagesDir, 'index.mtm'), homePage);

  const reactDemo = `---
route: "/react-demo"
title: "React Demo - Enhanced MTM"
description: "React components in MTM framework"
compileJsMode: "external.js"
---
import Counter from "@components/Counter.tsx"

<template>
  <div class="demo-page">
    <header>
      <h1>⚛️ React Demo</h1>
      <p>Interactive React components in MTM</p>
    </header>

    <nav class="navigation">
      <a href="/" data-link="true">← Back to Home</a>
      <a href="/vue-demo" data-link="true">Vue Demo →</a>
    </nav>

    <main>
      <section class="component-showcase">
        <h2>React Counter Component</h2>
        <p>This counter is built with React hooks and TypeScript:</p>
        
        <div class="component-demo">
          <Counter initialValue={10} step={2} />
        </div>
        
        <div class="component-demo">
          <Counter initialValue={0} step={1} />
        </div>
        
        <div class="component-demo">
          <Counter initialValue={100} step={10} />
        </div>
      </section>

      <section class="code-example">
        <h3>Component Features:</h3>
        <ul>
          <li>✅ TypeScript interfaces for props</li>
          <li>✅ React hooks (useState)</li>
          <li>✅ Configurable initial value and step</li>
          <li>✅ Hot module replacement support</li>
          <li>✅ Production optimizations</li>
        </ul>
      </section>
    </main>
  </div>
</template>`;

  fs.writeFileSync(path.join(pagesDir, 'react-demo.mtm'), reactDemo);

  const vueDemo = `---
route: "/vue-demo"
title: "Vue Demo - Enhanced MTM"
description: "Vue components with Composition API in MTM framework"
compileJsMode: "external.js"
---
import TodoList from "@components/TodoList.vue"

<template>
  <div class="demo-page">
    <header>
      <h1>💚 Vue Demo</h1>
      <p>Vue 3 Composition API components in MTM</p>
    </header>

    <nav class="navigation">
      <a href="/react-demo" data-link="true">← React Demo</a>
      <a href="/" data-link="true">Home</a>
      <a href="/solid-demo" data-link="true">Solid Demo →</a>
    </nav>

    <main>
      <section class="component-showcase">
        <h2>Vue Todo List Component</h2>
        <p>This todo list uses Vue 3's Composition API with TypeScript:</p>
        
        <div class="component-demo">
          <TodoList />
        </div>
      </section>

      <section class="code-example">
        <h3>Component Features:</h3>
        <ul>
          <li>✅ Vue 3 Composition API</li>
          <li>✅ TypeScript support</li>
          <li>✅ Reactive data with ref() and reactive()</li>
          <li>✅ Scoped CSS styling</li>
          <li>✅ Template directives (v-for, v-model)</li>
        </ul>
      </section>
    </main>
  </div>
</template>`;

  fs.writeFileSync(path.join(pagesDir, 'vue-demo.mtm'), vueDemo);

  const solidDemo = `---
route: "/solid-demo"
title: "Solid Demo - Enhanced MTM"
description: "SolidJS components with signals in MTM framework"
compileJsMode: "external.js"
---
import DataChart from "@components/DataChart.tsx"

<template>
  <div class="demo-page">
    <header>
      <h1>🟦 Solid Demo</h1>
      <p>SolidJS reactive components in MTM</p>
    </header>

    <nav class="navigation">
      <a href="/vue-demo" data-link="true">← Vue Demo</a>
      <a href="/" data-link="true">Home</a>
      <a href="/svelte-demo" data-link="true">Svelte Demo →</a>
    </nav>

    <main>
      <section class="component-showcase">
        <h2>Solid Data Chart Component</h2>
        <p>This chart uses SolidJS signals for fine-grained reactivity:</p>
        
        <div class="component-demo">
          <DataChart title="Sales Data" />
        </div>
        
        <div class="component-demo">
          <DataChart title="Performance Metrics" data={[5, 15, 25, 35, 20, 30]} />
        </div>
      </section>

      <section class="code-example">
        <h3>Component Features:</h3>
        <ul>
          <li>✅ SolidJS signals (createSignal)</li>
          <li>✅ Reactive effects (createEffect)</li>
          <li>✅ TypeScript interfaces</li>
          <li>✅ Dynamic styling</li>
          <li>✅ Fine-grained reactivity</li>
        </ul>
      </section>
    </main>
  </div>
</template>`;

  fs.writeFileSync(path.join(pagesDir, 'solid-demo.mtm'), solidDemo);

  const svelteDemo = `---
route: "/svelte-demo"
title: "Svelte Demo - Enhanced MTM"
description: "Svelte components with reactive statements in MTM framework"
compileJsMode: "external.js"
---
import WeatherWidget from "@components/WeatherWidget.svelte"

<template>
  <div class="demo-page">
    <header>
      <h1>🧡 Svelte Demo</h1>
      <p>Svelte reactive components in MTM</p>
    </header>

    <nav class="navigation">
      <a href="/solid-demo" data-link="true">← Solid Demo</a>
      <a href="/" data-link="true">Home</a>
      <a href="/multi-framework" data-link="true">Multi-Framework →</a>
    </nav>

    <main>
      <section class="component-showcase">
        <h2>Svelte Weather Widget</h2>
        <p>This widget demonstrates Svelte's reactive statements and animations:</p>
        
        <div class="widget-grid">
          <WeatherWidget location="New York" unit="F" />
          <WeatherWidget location="London" unit="C" />
          <WeatherWidget location="Tokyo" unit="C" />
        </div>
      </section>

      <section class="code-example">
        <h3>Component Features:</h3>
        <ul>
          <li>✅ Svelte reactive statements</li>
          <li>✅ TypeScript support</li>
          <li>✅ Conditional rendering (#if blocks)</li>
          <li>✅ Event handling (on:click)</li>
          <li>✅ Scoped CSS with animations</li>
        </ul>
      </section>
    </main>
  </div>
</template>`;

  fs.writeFileSync(path.join(pagesDir, 'svelte-demo.mtm'), svelteDemo);

  const multiFramework = `---
route: "/multi-framework"
title: "Multi-Framework Demo - Enhanced MTM"
description: "All frameworks working together in one page"
compileJsMode: "external.js"
---
import Counter from "@components/Counter.tsx"
import TodoList from "@components/TodoList.vue"
import DataChart from "@components/DataChart.tsx"
import WeatherWidget from "@components/WeatherWidget.svelte"

<template>
  <div class="demo-page">
    <header>
      <h1>🌈 Multi-Framework Demo</h1>
      <p>React, Vue, Solid, and Svelte components working together!</p>
    </header>

    <nav class="navigation">
      <a href="/svelte-demo" data-link="true">← Svelte Demo</a>
      <a href="/" data-link="true">Home</a>
    </nav>

    <main>
      <section class="framework-showcase">
        <div class="framework-section">
          <h3>⚛️ React Counter</h3>
          <Counter initialValue={5} step={1} />
        </div>

        <div class="framework-section">
          <h3>💚 Vue Todo List</h3>
          <TodoList />
        </div>

        <div class="framework-section">
          <h3>🟦 Solid Data Chart</h3>
          <DataChart title="Mixed Framework Data" />
        </div>

        <div class="framework-section">
          <h3>🧡 Svelte Weather</h3>
          <WeatherWidget location="San Francisco" unit="F" />
        </div>
      </section>

      <section class="integration-info">
        <h2>🔮 Framework Integration</h2>
        <p>This page demonstrates the power of the Enhanced MTM Framework:</p>
        <ul>
          <li>✅ Multiple frameworks on a single page</li>
          <li>✅ Shared routing and navigation</li>
          <li>✅ Optimized bundle loading</li>
          <li>✅ Framework-specific optimizations</li>
          <li>✅ Hot module replacement for all frameworks</li>
        </ul>
      </section>
    </main>
  </div>
</template>`;

  fs.writeFileSync(path.join(pagesDir, 'multi-framework.mtm'), multiFramework);

  console.log('📄 Created demo MTM pages');

  // Initialize build system
  const buildSystem = new BuildSystemIntegration({
    inputDir: srcDir,
    outputDir: distDir
  });

  console.log('\n🔧 Build System Configuration:');
  console.log('- Framework optimizations: enabled');
  console.log('- Tree shaking: enabled');
  console.log('- Code splitting: enabled');
  console.log('- Bundle analysis: enabled');

  // Run development build
  console.log('\n🏗️  Running Development Build...');
  const devResult = await buildSystem.build({
    development: true,
    frameworkOptimizations: true,
    treeshaking: false, // Disabled in dev for faster builds
    codeSplitting: false, // Disabled in dev
    bundleAnalysis: false
  });

  console.log(`\n📊 Development Build Results:`);
  console.log(`- Success: ${devResult.success}`);
  console.log(`- Build time: ${devResult.buildTime}ms`);
  console.log(`- Pages compiled: ${devResult.results.length}`);
  console.log(`- Frameworks used: ${Object.keys(devResult.buildStats.frameworkUsage).join(', ')}`);

  // Run production build
  console.log('\n🏭 Running Production Build...');
  const prodResult = await buildSystem.build({
    production: true,
    minify: true,
    frameworkOptimizations: true,
    treeshaking: true,
    codeSplitting: true,
    bundleAnalysis: true
  });

  console.log(`\n📊 Production Build Results:`);
  console.log(`- Success: ${prodResult.success}`);
  console.log(`- Build time: ${prodResult.buildTime}ms`);
  console.log(`- Pages compiled: ${prodResult.results.length}`);
  console.log(`- Total bundle size: ${Object.values(prodResult.buildStats.bundleSizes).reduce((sum, size) => sum + size, 0)} bytes`);
  console.log(`- Optimizations applied: ${prodResult.buildStats.optimizations.length}`);

  // Display framework analysis
  console.log('\n🔍 Framework Analysis:');
  Object.entries(prodResult.buildStats.frameworkUsage).forEach(([framework, analysis]) => {
    if (analysis.files && analysis.files.length > 0) {
      console.log(`- ${framework}: ${analysis.files.length} files, ${analysis.components.length} components`);
    }
  });

  // Show bundle sizes
  console.log('\n📦 Bundle Sizes:');
  Object.entries(prodResult.buildStats.bundleSizes).forEach(([filename, size]) => {
    console.log(`- ${filename}: ${buildSystem.formatBytes(size)}`);
  });

  // Start development server demo
  console.log('\n🚀 Starting Development Server Demo...');
  const server = await buildSystem.startDevServer({
    port: 3001,
    hmrPort: 24679,
    watch: false // Disabled for demo
  });

  console.log('\n✅ Development server started!');
  console.log('🌐 Open http://localhost:3001 to view the demo');
  console.log('🔥 HMR WebSocket server running on port 24679');

  // Show available files
  console.log('\n📁 Generated Files:');
  const listFiles = (dir, prefix = '') => {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        console.log(`${prefix}📁 ${item}/`);
        listFiles(fullPath, prefix + '  ');
      } else {
        const size = buildSystem.formatBytes(stat.size);
        console.log(`${prefix}📄 ${item} (${size})`);
      }
    });
  };

  listFiles(distDir);

  console.log('\n🎯 Demo Features Showcased:');
  console.log('✅ Multi-framework component support (React, Vue, Solid, Svelte)');
  console.log('✅ Framework-specific optimizations');
  console.log('✅ Code splitting and tree shaking');
  console.log('✅ Bundle analysis and recommendations');
  console.log('✅ Hot module replacement');
  console.log('✅ Development server with file watching');
  console.log('✅ Production build optimizations');
  console.log('✅ Enhanced routing with framework awareness');

  console.log('\n💡 Next Steps:');
  console.log('1. Open the generated HTML files in a browser');
  console.log('2. Check the bundle-analysis.html for detailed insights');
  console.log('3. Modify the MTM files to see HMR in action');
  console.log('4. Explore the generated router configuration');

  // Keep server running for a bit
  setTimeout(async () => {
    console.log('\n🛑 Stopping development server...');
    await server.stop();
    console.log('✅ Demo completed successfully!');
  }, 5000);
}

// Run the demo
if (require.main === module) {
  runEnhancedBuildDemo().catch(error => {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  });
}

module.exports = { runEnhancedBuildDemo };