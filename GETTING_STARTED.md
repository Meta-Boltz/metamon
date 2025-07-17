# 🚀 Getting Started with Metamon Framework

This guide will walk you through setting up and running the Metamon example application step by step.

## Prerequisites

Before you begin, make sure you have:

- **Node.js 18+** installed ([Download here](https://nodejs.org/))
- **Git** installed
- A terminal/command prompt

## Step-by-Step Setup

### 1. Clone or Navigate to the Project

If you haven't already, make sure you're in the Metamon project directory:

```bash
# If cloning for the first time
git clone <repository-url>
cd metamon

# Or if you already have the project
cd path/to/metamon
```

### 2. Quick Setup (Recommended)

Run the automated setup script:

```bash
node setup-examples.js
```

This script will:

- ✅ Check your Node.js version
- 📦 Install all dependencies
- 🔨 Build the Metamon packages
- 🎯 Set up the example application

### 3. Manual Setup (Alternative)

If you prefer to run each step manually:

```bash
# Step 1: Install root dependencies
npm install

# Step 2: Build all Metamon packages
npm run build

# Step 3: Set up examples
cd examples
npm install
```

### 4. Start the Development Server

```bash
# From the examples directory
cd examples
npm run dev

# Or from the root directory
npm run dev --workspace=examples
```

### 5. Open Your Browser

Navigate to: **http://localhost:3000**

You should see the Metamon demo application! 🎉

## What You'll See

### Main Demo Page (`/`)

- **React Counter**: Increment buttons that update global state
- **Vue Message Board**: Real-time message system with cross-framework events
- **Solid Theme Toggle**: Theme switcher that affects all components
- **Svelte User List**: User management with shared state
- **Live State Display**: Shows real-time updates across all frameworks

### Performance Page (`/performance`)

- Click "Run Benchmarks" to see live performance comparisons
- Compare Metamon vs native framework performance
- View bundle size analysis and memory usage

### Documentation Page (`/docs`)

- Interactive code examples for each framework
- Copy-paste ready code snippets
- Best practices and patterns

## Testing the Cross-Framework Magic

Try these interactions to see the frameworks communicating:

1. **Shared State**: Click "+1 Global" in React Counter → Watch Svelte User List count update
2. **Event Communication**: Add a user in Svelte → See message appear in Vue Message Board
3. **Theme Changes**: Toggle theme in Solid → Watch all components change appearance
4. **Real-time Updates**: All changes reflect instantly in the shared state display

## Running Tests

### Unit Tests

```bash
cd examples
npm test
```

### End-to-End Tests

```bash
cd examples

# First time only: install browser dependencies
npx playwright install

# Run E2E tests
npm run test:e2e
```

### Performance Benchmarks

```bash
cd examples
npm run benchmark
```

## Troubleshooting

### Common Issues and Solutions

**❌ "Cannot resolve @metamon/core"**

```bash
# Solution: Build the packages first
npm run build  # from root directory
```

**❌ "Port 3000 already in use"**

```bash
# Solution: Kill the process or change port
# Kill process on port 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Kill process on port 3000 (Mac/Linux)
lsof -ti:3000 | xargs kill -9

# Or change port in examples/vite.config.js
```

**❌ "Playwright tests fail"**

```bash
# Solution: Install browser dependencies
cd examples
npx playwright install
```

**❌ "Node.js version error"**

```bash
# Solution: Update Node.js to version 18+
# Check current version
node --version

# Update Node.js from nodejs.org
```

### Getting Help

If you encounter issues:

1. **Check the console** for error messages
2. **Verify Node.js version**: `node --version` (should be 18+)
3. **Clean install**: Delete `node_modules` and run `npm install` again
4. **Check the examples README**: `examples/README.md` for detailed troubleshooting

## Next Steps

Once you have the examples running:

1. **Explore the Code**: Look at `.mtm` files in `examples/src/components/`
2. **Modify Components**: Try changing the React counter or Vue message board
3. **Create New Components**: Add your own `.mtm` files
4. **Read Documentation**: Visit `/docs` in the running application

## Creating Your First Component

Try creating a simple component:

1. Create `examples/src/components/my-component.mtm`:

```javascript
---
target: reactjs
channels:
  - event: hello-world
    emit: onHelloWorld
---

import React from 'react';
import { useMetamonSignal, useMetamonPubSub } from '@metamon/adapters/react';

export default function MyComponent() {
  const [message, setMessage] = useMetamonSignal('myMessage', 'Hello Metamon!');
  const { emit } = useMetamonPubSub();

  const handleClick = () => {
    setMessage('You clicked me!');
    emit('hello-world', { timestamp: Date.now() });
  };

  return (
    <div>
      <h3>{message}</h3>
      <button onClick={handleClick}>Click Me!</button>
    </div>
  );
}
```

2. Import and use it in `examples/src/pages/index.mtm`

3. Watch it work with the other framework components!

## 🎉 You're Ready!

You now have a fully functional Metamon development environment. The example application demonstrates all the key features:

- ✅ Multi-framework components
- ✅ Cross-framework state sharing
- ✅ Event communication system
- ✅ Performance benchmarking
- ✅ Comprehensive testing

Happy coding with Metamon! 🚀
