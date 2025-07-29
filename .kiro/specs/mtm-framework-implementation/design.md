# MTM Framework Implementation Design

## Overview

The MTM (Meta-Template-Metamon) framework is a meta-framework that allows developers to write components once using a unified syntax and compile them to multiple target frameworks. The system consists of a parser, compiler, signal system, and development tools that work together to provide a seamless cross-framework development experience.

## Architecture

### Core Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MTM Parser    │───▶│  MTM Compiler   │───▶│ Target Outputs  │
│                 │    │                 │    │                 │
│ - Lexer         │    │ - React Gen     │    │ - React JSX     │
│ - AST Builder   │    │ - Vue Gen       │    │ - Vue SFC       │
│ - Validator     │    │ - Svelte Gen    │    │ - Svelte Comp   │
└─────────────────┘    │ - SolidJS Gen   │    │ - SolidJS Comp  │
                       │ - HTML/JS Gen   │    │ - Pure HTML/JS  │
                       └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  Signal System  │
                       │                 │
                       │ - Global Store  │
                       │ - Event Bus     │
                       │ - Subscriptions │
                       └─────────────────┘
```

### File Structure

```
mtm-framework/
├── src/
│   ├── parser/
│   │   ├── lexer.js          # Tokenizes MTM syntax
│   │   ├── parser.js         # Builds AST from tokens
│   │   └── validator.js      # Validates AST structure
│   ├── compiler/
│   │   ├── base-generator.js # Base class for code generators
│   │   ├── react-generator.js# React-specific code generation
│   │   ├── vue-generator.js  # Vue-specific code generation
│   │   ├── svelte-generator.js# Svelte-specific code generation
│   │   ├── solidjs-generator.js# SolidJS-specific code generation
│   │   └── html-generator.js # Pure HTML/JS code generation (PHP/Next.js style)
│   ├── signal/
│   │   ├── signal-system.js  # Core signal implementation
│   │   └── framework-adapters.js # Framework-specific adapters
│   ├── cli/
│   │   ├── compile.js        # Compilation commands
│   │   ├── watch.js          # File watching
│   │   └── migrate.js        # Migration utilities
│   └── utils/
│       ├── file-utils.js     # File system utilities
│       └── error-handler.js  # Error reporting
├── examples/
│   ├── components/
│   │   ├── counter.react.mtm
│   │   ├── counter.vue.mtm
│   │   ├── counter.svelte.mtm
│   │   ├── counter.solid.mtm
│   │   ├── counter.mtm        # Pure HTML/JS version
│   │   ├── form.react.mtm
│   │   └── list.vue.mtm
│   └── compiled/
│       ├── react/
│       ├── vue/
│       ├── svelte/
│       ├── solidjs/
│       └── html/              # Pure HTML/JS output
└── tests/
    ├── parser.test.js
    ├── compiler.test.js
    └── signal.test.js
```

## Components and Interfaces

### MTM Parser

The parser converts MTM syntax into an Abstract Syntax Tree (AST) that can be processed by code generators.

```javascript
// AST Node Structure
interface MTMComponent {
  name: string;
  framework: "react" | "vue" | "svelte" | "js";
  variables: MTMVariable[];
  functions: MTMFunction[];
  template: MTMTemplate;
}

interface MTMVariable {
  name: string;
  type: "reactive" | "computed";
  dataType?: string;
  initialValue: any;
  signalKey?: string;
}

interface MTMFunction {
  name: string;
  params: Parameter[];
  body: string;
  async: boolean;
}

interface MTMTemplate {
  elements: TemplateElement[];
  bindings: DataBinding[];
  events: EventBinding[];
}
```

### Code Generators

Each framework has a specific generator that transforms the AST into target framework code.

```javascript
// Base Generator Interface
class BaseGenerator {
  generate(ast) {
    return {
      imports: this.generateImports(ast),
      component: this.generateComponent(ast),
      exports: this.generateExports(ast),
    };
  }

  generateImports(ast) {
    /* Abstract */
  }
  generateComponent(ast) {
    /* Abstract */
  }
  generateExports(ast) {
    /* Abstract */
  }
}

// React Generator Example
class ReactGenerator extends BaseGenerator {
  generateImports(ast) {
    return `import React, { useState, useCallback } from 'react';
import { signal } from '@mtm/signal';`;
  }

  generateComponent(ast) {
    // Transform MTM syntax to React hooks and JSX
  }
}
```

### Signal System

The signal system provides cross-framework reactive state management.

```javascript
// Signal System API
class SignalSystem {
  signals = new Map();
  subscribers = new Map();

  create(key, initialValue) {
    // Create or get existing signal
  }

  emit(event, data) {
    // Broadcast event to all subscribers
  }

  subscribe(key, callback) {
    // Subscribe to signal changes
  }

  unsubscribe(key, callback) {
    // Remove subscription
  }
}

// Framework Adapters
class ReactSignalAdapter {
  use(key, initialValue) {
    // Return [value, setter] compatible with React hooks
  }
}

class VueSignalAdapter {
  use(key, initialValue) {
    // Return reactive ref compatible with Vue
  }
}

class SolidJSSignalAdapter {
  use(key, initialValue) {
    // Return createSignal compatible with SolidJS
  }
}

class HTMLSignalAdapter {
  use(key, initialValue) {
    // Return DOM-based reactive system for pure HTML/JS
    // Works like PHP sessions + Next.js hydration
  }
}
```

## Data Models

### MTM Syntax Tokens

```javascript
const TokenTypes = {
  VARIABLE_REACTIVE: "$variable!",
  VARIABLE_COMPUTED: "$variable",
  FUNCTION: "$function",
  TEMPLATE_START: "<template>",
  TEMPLATE_END: "</template>",
  INTERPOLATION: "{$variable}",
  EVENT_BINDING: "click={$handler}",
  CONDITIONAL: "{#if condition}",
  LOOP: "{#each items as item}",
  RANGE_LOOP: "{#for i=0 to 9}",
};
```

### Compilation Configuration

```javascript
interface CompilationConfig {
  input: string; // Input MTM file path
  output: string; // Output directory
  framework: string; // Target framework
  watch: boolean; // Enable file watching
  sourceMaps: boolean; // Generate source maps
  minify: boolean; // Minify output
}
```

## Error Handling

### Parser Errors

```javascript
class MTMSyntaxError extends Error {
  constructor(message, line, column, file) {
    super(`${file}:${line}:${column} - ${message}`);
    this.line = line;
    this.column = column;
    this.file = file;
  }
}
```

### Compilation Errors

```javascript
class MTMCompilationError extends Error {
  constructor(message, component, framework) {
    super(`Failed to compile ${component} for ${framework}: ${message}`);
    this.component = component;
    this.framework = framework;
  }
}
```

### Runtime Errors

```javascript
class MTMRuntimeError extends Error {
  constructor(message, signal, component) {
    super(`Runtime error in ${component}: ${message}`);
    this.signal = signal;
    this.component = component;
  }
}
```

## Testing Strategy

### Unit Tests

1. **Parser Tests**: Verify correct AST generation from MTM syntax
2. **Generator Tests**: Ensure accurate code generation for each framework
3. **Signal Tests**: Validate cross-framework state synchronization
4. **CLI Tests**: Test command-line interface functionality

### Integration Tests

1. **End-to-End Compilation**: Test complete MTM to framework compilation
2. **Cross-Framework Communication**: Verify signal system works across frameworks
3. **Example Components**: Ensure all example components compile and run correctly

### Performance Tests

1. **Compilation Speed**: Measure compilation time for various component sizes
2. **Runtime Performance**: Compare performance of compiled components vs hand-written
3. **Memory Usage**: Monitor memory consumption of signal system

## Implementation Phases

### Phase 1: Core Parser and AST

- Implement lexer for MTM syntax
- Build AST parser
- Add syntax validation
- Create basic error reporting

### Phase 2: Code Generators

- Implement React generator
- Implement Vue generator
- Implement Svelte generator
- Implement Pure JS generator

### Phase 3: Signal System

- Create core signal implementation
- Add framework adapters
- Implement cross-framework communication
- Add subscription management

### Phase 4: CLI and Tools

- Build compilation CLI
- Add file watching
- Create migration tools
- Add development server

### Phase 5: Examples and Documentation

- Convert existing HTML examples to MTM
- Create comprehensive component library
- Write API documentation
- Add migration guides

## Performance Considerations

### Compilation Optimization

- Cache parsed ASTs to avoid re-parsing unchanged files
- Use incremental compilation for large projects
- Implement parallel compilation for multiple files

### Runtime Optimization

- Minimize signal system overhead
- Use efficient data structures for subscriptions
- Implement lazy loading for large component trees

### Memory Management

- Automatic cleanup of unused signals
- Weak references for component subscriptions
- Garbage collection of orphaned event listeners
