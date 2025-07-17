# Metamon Framework - Example Application

This comprehensive example application demonstrates the full capabilities of the Metamon meta-framework, showcasing how components written in different JavaScript frameworks (React, Vue, Solid, Svelte) can work together seamlessly.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm (recommended)

### Step 1: Install Dependencies

From the **root directory** of the Metamon project:

```bash
# Install all workspace dependencies
npm install

# Or if using pnpm
pnpm install
```

### Step 2: Build the Framework Packages

The examples depend on the Metamon packages, so build them first:

```bash
# Build all packages (from root directory)
npm run build

# Or if using pnpm
pnpm build
```

### Step 3: Run the Example Application

```bash
# Navigate to examples directory
cd examples

# Start development server
npm run dev

# Or from root directory using workspace
npm run dev --workspace=examples
```

The application will be available at `http://localhost:3000`

### Step 4: Explore the Features

- **Main Demo** (`/`): See all framework components working together
- **Performance** (`/performance`): Run live benchmarks
- **Documentation** (`/docs`): Browse code examples and best practices

## 🧪 Running Tests

### Unit Tests

```bash
cd examples
npm test
```

### End-to-End Tests

```bash
cd examples

# Install Playwright browsers (first time only)
npx playwright install

# Run E2E tests
npm run test:e2e
```

### Performance Benchmarks

```bash
cd examples
npm run benchmark
```

## 🔧 Troubleshooting

### Common Issues

**"Cannot resolve @metamon/core"**

- Make sure you've run `npm run build` from the root directory first
- The examples use workspace dependencies that need to be built

**"Vite plugin errors"**

- Ensure all framework plugins are installed: `npm install` in examples directory
- Check that Node.js version is 18+

**"Playwright tests fail"**

- Run `npx playwright install` to install browser dependencies
- Make sure the dev server is running on port 3000

**"Port 3000 already in use"**

- Change the port in `examples/vite.config.js`:
  ```js
  server: {
    port: 3001; // or any available port
  }
  ```

## 📁 Project Structure

```
examples/
├── src/
│   ├── components/          # Multi-framework components
│   │   ├── react-counter.mtm       # React component with signals
│   │   ├── vue-message-board.mtm   # Vue component with pub/sub
│   │   ├── solid-theme-toggle.mtm  # Solid component with native signals
│   │   └── svelte-user-list.mtm    # Svelte component with stores
│   ├── pages/               # Application pages
│   │   ├── index.mtm               # Main demo page (React)
│   │   ├── performance.mtm         # Performance benchmarks (React)
│   │   └── documentation.mtm       # Documentation (Vue)
│   ├── main.js             # Application entry point
│   └── style.css           # Global styles
├── tests/
│   └── e2e/                # End-to-end tests
│       └── cross-framework.spec.js
├── scripts/
│   └── benchmark.js        # Performance benchmarking
└── README.md
```

## 🎯 What This Example Demonstrates

### 1. Multi-Framework Components

- **React Counter**: Demonstrates signal-based state management with React hooks
- **Vue Message Board**: Shows cross-framework event communication using Vue Composition API
- **Solid Theme Toggle**: Native Solid.js signal integration with global state
- **Svelte User List**: Combines Svelte stores with Metamon signals

### 2. Cross-Framework Communication

- **Shared Signals**: Global state that updates across all framework components
- **Pub/Sub Events**: Components emit events that other frameworks can listen to
- **Real-time Updates**: Changes in one framework instantly reflect in others

### 3. Unified Development Experience

- **Single Build System**: One Vite configuration handles all frameworks
- **Consistent API**: Same signal and event APIs across all frameworks
- **Hot Module Replacement**: Live updates during development for all frameworks

## 🔧 Key Features Showcased

### Signal Management

```javascript
// Works the same across all frameworks
const [count, setCount] = useMetamonSignal("globalCount");
```

### Event Communication

```javascript
// Emit events from any framework
emit("user-action", { framework: "React", action: "increment" });

// Listen from any framework
subscribe("user-action", (data) => {
  console.log(`${data.framework} performed: ${data.action}`);
});
```

### File-based Routing

```
src/pages/index.mtm          → /
src/pages/performance.mtm    → /performance
src/pages/documentation.mtm  → /docs
```

## 📊 Performance Benchmarks

The example includes comprehensive performance benchmarks comparing Metamon to native framework implementations:

```bash
npm run benchmark
```

### Benchmark Results (Typical)

- **Signal Updates**: 0-15% overhead vs native
- **Event Emission**: 5-20% overhead vs native
- **Bundle Size**: +15-25KB overhead
- **Memory Usage**: Minimal with automatic cleanup

## 🧪 Testing

### Unit Tests

```bash
npm test
```

### End-to-End Tests

```bash
npm run test:e2e
```

The E2E tests verify:

- Cross-framework state sharing
- Event communication between frameworks
- Theme changes across components
- Routing between pages
- Performance benchmark execution
- Component cleanup and memory management

## 🎨 Framework-Specific Examples

### React Component (.mtm)

```javascript
---
target: reactjs
channels:
  - event: user-action
    emit: onUserAction
---

import React from 'react';
import { useMetamonSignal, useMetamonPubSub } from '@metamon/adapters/react';

export default function ReactComponent() {
  const [count, setCount] = useMetamonSignal('globalCount');
  const { emit } = useMetamonPubSub();

  return (
    <button onClick={() => {
      setCount(count + 1);
      emit('user-action', { framework: 'React', action: 'increment' });
    }}>
      Count: {count}
    </button>
  );
}
```

### Vue Component (.mtm)

```vue
---
target: vue
channels:
  - event: message-sent
    emit: onMessageSent
---

<template>
  <div>
    <input v-model="message" @keyup.enter="sendMessage" />
    <button @click="sendMessage">Send</button>
    <p>Messages: {{ messages.length }}</p>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useMetamonSignal, useMetamonPubSub } from "@metamon/adapters/vue";

const [messages, setMessages] = useMetamonSignal("messages");
const { emit } = useMetamonPubSub();
const message = ref("");

const sendMessage = () => {
  setMessages([...messages.value, message.value]);
  emit("message-sent", { text: message.value, framework: "Vue" });
  message.value = "";
};
</script>
```

### Solid Component (.mtm)

```javascript
---
target: solid
channels:
  - event: theme-changed
    emit: onThemeChanged
---

import { useMetamonSignal, useMetamonPubSub } from '@metamon/adapters/solid';

export default function SolidComponent() {
  const [theme, setTheme] = useMetamonSignal('theme');
  const { emit } = useMetamonPubSub();

  const toggleTheme = () => {
    const newTheme = theme() === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    emit('theme-changed', { theme: newTheme, framework: 'Solid' });
  };

  return (
    <button onClick={toggleTheme}>
      Theme: {theme()}
    </button>
  );
}
```

### Svelte Component (.mtm)

```svelte
---
target: svelte
channels:
  - event: user-added
    emit: onUserAdded
---

<script>
  import { useMetamonSignal, useMetamonPubSub } from '@metamon/adapters/svelte';

  const [userCount, setUserCount] = useMetamonSignal('userCount');
  const { emit } = useMetamonPubSub();

  function addUser() {
    setUserCount($userCount + 1);
    emit('user-added', { count: $userCount + 1, framework: 'Svelte' });
  }
</script>

<div>
  <button on:click={addUser}>Add User</button>
  <p>Users: {$userCount}</p>
</div>
```

## 🌟 Best Practices Demonstrated

1. **Signal Naming**: Use descriptive names for global signals
2. **Event Contracts**: Consistent event payload structures
3. **Component Cleanup**: Automatic cleanup of subscriptions
4. **Performance**: Batched updates and optimized rendering
5. **Development**: Hot reloading and error handling

## 🔗 Navigation

- **Home** (`/`): Main demo with all framework components
- **Performance** (`/performance`): Benchmarks and performance analysis
- **Documentation** (`/docs`): Code examples and best practices

## 🚀 Getting Started with Your Own Project

1. **Install Metamon**:

   ```bash
   npm install @metamon/core @metamon/adapters @metamon/build-tools
   ```

2. **Configure Vite**:

   ```javascript
   import { metamon } from "@metamon/build-tools";

   export default defineConfig({
     plugins: [metamon({ frameworks: ["react", "vue"] })],
   });
   ```

3. **Create your first .mtm file**:

   ```javascript
   ---
   target: reactjs
   ---

   import React from 'react';

   export default function MyComponent() {
     return <h1>Hello Metamon!</h1>;
   }
   ```

## 📚 Learn More

- Visit the [Documentation page](/docs) in the example app
- Check out the [Performance page](/performance) for benchmarks
- Explore the source code in `src/components/` for implementation details
- Run the E2E tests to see cross-framework communication in action

## 🤝 Contributing

This example application serves as both a demonstration and a test suite for the Metamon framework. When adding new features to Metamon:

1. Add corresponding examples to this application
2. Update the documentation page with new code examples
3. Add E2E tests to verify cross-framework functionality
4. Update performance benchmarks if needed

## 📄 License

This example application is part of the Metamon framework and follows the same license terms.
