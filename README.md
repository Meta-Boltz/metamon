# Metamon Framework

A meta-framework that enables JavaScript developers to write pages and components once using .mtm files with frontmatter configuration, allowing them to target specific frameworks (React, Vue, Solid, Svelte) while sharing state and events through a unified pub/sub system.

## Project Structure

```
metamon/
├── packages/
│   ├── core/                 # Core interfaces and types
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── mtm-file.ts      # MTM file parsing interfaces
│   │   │   │   ├── compiler.ts      # Framework compiler interfaces
│   │   │   │   ├── pubsub.ts        # Pub/sub system interfaces
│   │   │   │   ├── signals.ts       # Signal management interfaces
│   │   │   │   └── router.ts        # Router interfaces
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── adapters/             # Framework-specific adapters
│   │   ├── src/
│   │   │   ├── base/
│   │   │   │   └── framework-adapter.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── build-tools/          # Build tools and plugins
│       ├── src/
│       │   ├── types/
│       │   │   └── build-options.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── package.json              # Root package.json with workspaces
├── turbo.json               # Turbo build configuration
├── tsconfig.json            # Root TypeScript configuration
└── README.md
```

## 🚀 Quick Start

### Try the Examples

The fastest way to see Metamon in action is to run the comprehensive example application:

```bash
# Quick setup (recommended)
node setup-examples.js

# Manual setup
npm install          # Install dependencies
npm run build        # Build packages
cd examples          # Navigate to examples
npm install          # Install example dependencies
npm run dev          # Start development server
```

Then open `http://localhost:3000` to see:

- Multi-framework components working together
- Cross-framework state sharing and communication
- Live performance benchmarks
- Interactive documentation with code examples

### What You'll See

- **React Counter** sharing state with **Svelte User List**
- **Vue Message Board** receiving events from all frameworks
- **Solid Theme Toggle** changing themes across all components
- Real-time performance comparisons vs native frameworks

## 📚 Documentation

- **[Example Application](./examples/README.md)** - Comprehensive demo with all features
- **[Getting Started Guide](./examples/README.md#-getting-started-with-your-own-project)** - Create your first .mtm component
- **[API Documentation](./examples/src/pages/documentation.mtm)** - Framework-specific examples

## 🏗️ Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run in development mode
npm run dev

# Run tests
npm run test
```

## Core Interfaces

The framework is built around several core interfaces:

- **MTMFile**: Represents parsed .mtm files with frontmatter and content
- **FrameworkCompiler**: Transforms .mtm files into framework-specific components
- **PubSubSystem**: Enables cross-framework event communication
- **SignalManager**: Provides cross-framework reactive state management
- **MetamonRouter**: Handles client-side routing for .mtm pages
