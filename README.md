# 🔮 MTM Framework - Meta-Template-Metamon

**Write once, compile to React, Vue, Svelte, SolidJS, or Pure HTML/JS**

MTM is a revolutionary meta-framework that allows you to write components using a unified syntax and compile them to multiple target frameworks. The pure HTML/JS compilation works like a merge between PHP and Next.js - no framework dependencies needed!

## ✨ Features

- 🎯 **Write Once, Run Anywhere**: Single MTM syntax compiles to multiple frameworks
- 🚀 **Pure HTML/JS Mode**: Works like PHP + Next.js with no framework dependencies
- ⚡ **Reactive Variables**: Simple `$variable!` syntax for reactive state
- 🔄 **Cross-Framework Signals**: Share state between different framework components
- 📦 **Zero Configuration**: Framework detection by filename
- 🛡️ **Type Safe**: Full TypeScript support with automatic inference
- 🎨 **Modern Syntax**: Clean, readable, and intuitive

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/mtm-framework/mtm
cd mtm

# Install dependencies
npm install
```

### Your First MTM Component

Create a file called `counter.mtm`:

```javascript
// counter.mtm - Pure HTML/JS version
export default function Counter() {
  // Reactive variables
  $count! = 0

  // Event handlers
  $increment = () => {
    $count++
  }

  $decrement = () => {
    $count--
  }

  <template>
    <div class="counter">
      <h3>Simple Counter</h3>
      <div class="counter-display">
        <button click={$decrement}>-</button>
        <span class="count">{$count}</span>
        <button click={$increment}>+</button>
      </div>
      <p>This works like PHP + Next.js - pure HTML/JS!</p>
    </div>
  </template>
}
```

### Compile and Run

```bash
# Compile to pure HTML/JS
node src/mtm-compiler/final-compiler.js counter.mtm

# Open the compiled HTML file in your browser
open compiled/counter.html
```

## 📁 Project Structure

```
mtm-framework/
├── src/
│   └── mtm-compiler/
│       ├── final-compiler.js     # Working MTM compiler
│       ├── parser.js            # MTM syntax parser
│       ├── html-generator.js    # Pure HTML/JS generator
│       └── cli.js               # Command line interface
├── examples/
│   ├── mtm-components/          # MTM source files
│   │   ├── simple-counter.mtm   # Working counter example
│   │   ├── counter.react.mtm    # React version (planned)
│   │   ├── counter.vue.mtm      # Vue version (planned)
│   │   └── form.mtm             # Form example (planned)
│   └── serve-compiled.js        # Development server
├── compiled/                    # Compiled output files
└── README.md
```

## 🎯 MTM Syntax Guide

### Framework Detection by Filename

```javascript
counter.mtm; // → Pure HTML/JS
counter.react.mtm; // → React component
counter.vue.mtm; // → Vue component
counter.svelte.mtm; // → Svelte component
counter.solid.mtm; // → SolidJS component
```

### Reactive Variables

```javascript
// Reactive variables (trigger UI updates)
$count! = 0
$message! = "Hello"
$items! = []

// Computed variables (derived from reactive variables)
$doubleCount = $count * 2
$greeting = `Hello, ${$message}!`
```

### Functions

```javascript
// Event handlers
$increment = () => {
  $count++;
};

// Async functions
$fetchData = async () => {
  $loading = true;
  $data = await fetch("/api/data").then((r) => r.json());
  $loading = false;
};
```

### Template Syntax

```html
<template>
  <!-- Variable interpolation -->
  <span>{$count}</span>
  <span>{$message}</span>

  <!-- Event handlers -->
  <button click="{$increment}">Click me</button>

  <!-- Conditional rendering -->
  {#if $count > 5}
  <div>Count is high!</div>
  {/if}

  <!-- List rendering -->
  {#each $items as item}
  <div>{item.name}</div>
  {/each}
</template>
```

## 🔧 Compilation

### Current Status

| Framework        | Status         | Description                                           |
| ---------------- | -------------- | ----------------------------------------------------- |
| **Pure HTML/JS** | ✅ **Working** | Complete HTML files with embedded reactive JavaScript |
| **React**        | 🚧 Planned     | JSX with hooks (useState, useCallback)                |
| **Vue**          | 🚧 Planned     | Vue 3 composition API with reactive refs              |
| **Svelte**       | 🚧 Planned     | Svelte syntax with reactive statements                |
| **SolidJS**      | 🚧 Planned     | SolidJS components with createSignal                  |

### Compilation Examples

**MTM Input:**

```javascript
// counter.mtm
export default function Counter() {
  $count! = 0

  $increment = () => {
    $count++
  }

  <template>
    <div class="counter">
      <button click={$increment}>Count: {$count}</button>
    </div>
  </template>
}
```

**Pure HTML/JS Output:**

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Counter</title>
    <style>
      /* Beautiful CSS styles */
    </style>
  </head>
  <body>
    <div id="app">
      <div class="counter">
        <button data-click="$increment">
          Count: <span data-bind="$count">0</span>
        </button>
      </div>
    </div>

    <script>
      // Reactive system
      const reactive = (initialValue) => {
        let value = initialValue;
        const subscribers = [];
        return {
          get value() {
            return value;
          },
          set value(newValue) {
            value = newValue;
            subscribers.forEach((fn) => fn(newValue));
          },
          subscribe(fn) {
            subscribers.push(fn);
          },
        };
      };

      // Component
      function Counter() {
        const $count = reactive(0);

        const $increment = () => {
          $count.value++;
        };

        // DOM bindings
        const container = document.getElementById("app");

        container.querySelectorAll('[data-bind="$count"]').forEach((el) => {
          const update = () => (el.textContent = $count.value);
          update();
          $count.subscribe(update);
        });

        container
          .querySelectorAll('[data-click="$increment"]')
          .forEach((el) => {
            el.addEventListener("click", $increment);
          });
      }

      document.addEventListener("DOMContentLoaded", () => {
        Counter();
      });
    </script>
  </body>
</html>
```

## 🎨 Why MTM Framework?

### The Problem

- **Framework Lock-in**: Choose React, Vue, or Svelte and you're stuck
- **Code Duplication**: Same logic written multiple times for different frameworks
- **Learning Curve**: Each framework has different syntax and patterns
- **Bundle Size**: Framework overhead even for simple components

### The MTM Solution

- ✅ **Write Once**: Single MTM syntax for all frameworks
- ✅ **No Lock-in**: Compile to any framework or pure HTML/JS
- ✅ **PHP + Next.js Style**: Pure HTML/JS works without any framework
- ✅ **Modern Syntax**: Clean, readable, and intuitive
- ✅ **Zero Overhead**: Pure HTML/JS has no framework bundle
- ✅ **Cross-Framework**: Share state between different framework components

### MTM vs Other Solutions

| Feature                     | MTM | Astro | Qwik | Lit |
| --------------------------- | --- | ----- | ---- | --- |
| **Pure HTML/JS Output**     | ✅  | ❌    | ❌   | ❌  |
| **Multi-Framework**         | ✅  | ✅    | ❌   | ❌  |
| **PHP-like Simplicity**     | ✅  | ❌    | ❌   | ❌  |
| **Zero Dependencies**       | ✅  | ❌    | ❌   | ❌  |
| **Reactive Variables**      | ✅  | ❌    | ✅   | ✅  |
| **Cross-Framework Signals** | ✅  | ❌    | ❌   | ❌  |

## 🚀 Getting Started

### 1. Try the Working Example

```bash
# Compile the simple counter
node src/mtm-compiler/final-compiler.js examples/mtm-components/simple-counter.mtm

# Open in browser
open compiled/simple-counter.html
```

### 2. Create Your Own Component

```bash
# Create a new MTM file
echo 'export default function MyComponent() {
  $message! = "Hello MTM!"

  <template>
    <div>
      <h1>{$message}</h1>
      <p>This works like PHP + Next.js!</p>
    </div>
  </template>
}' > my-component.mtm

# Compile it
node src/mtm-compiler/final-compiler.js my-component.mtm

# Open the result
open compiled/my-component.html
```

### 3. Start the Development Server

```bash
# Install dependencies
npm install

# Start the server
npm run serve-examples

# Open http://localhost:3000
```

## 🛠️ Development

### Running Tests

```bash
npm test
```

### Compiling Examples

```bash
# Compile all examples
node compile-all-examples.js

# Compile specific file
node test-compiler.js
```

### Adding New Framework Support

1. Create a new generator in `src/mtm-compiler/`
2. Add framework detection logic
3. Implement the compilation pipeline
4. Add tests and examples

## 🎯 Roadmap

### Phase 1: Core Foundation ✅

- [x] MTM syntax parser
- [x] Pure HTML/JS compiler
- [x] Basic reactive system
- [x] Working examples

### Phase 2: Framework Generators 🚧

- [ ] React generator
- [ ] Vue generator
- [ ] Svelte generator
- [ ] SolidJS generator

### Phase 3: Advanced Features 📋

- [ ] TypeScript support
- [ ] CSS preprocessing
- [ ] Component composition
- [ ] Server-side rendering
- [ ] Build optimizations

### Phase 4: Developer Experience 📋

- [ ] VS Code extension
- [ ] CLI improvements
- [ ] Hot reloading
- [ ] Error reporting
- [ ] Documentation site

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Try MTM**: Use it in your projects and report issues
2. **Add Framework Support**: Implement generators for React, Vue, etc.
3. **Improve Parser**: Add support for more MTM syntax features
4. **Write Examples**: Create more MTM component examples
5. **Documentation**: Help improve docs and guides

### Development Setup

```bash
git clone https://github.com/mtm-framework/mtm
cd mtm
npm install
npm test
```

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Inspired by the simplicity of PHP and the power of Next.js
- Built with modern JavaScript and a focus on developer experience
- Thanks to all the framework creators who inspired this meta-framework approach

---

**MTM Framework - Write once, compile anywhere! 🔮**

_The future of meta-framework development is here. No more framework lock-in, no more code duplication, just pure simplicity that works like PHP + Next.js._
