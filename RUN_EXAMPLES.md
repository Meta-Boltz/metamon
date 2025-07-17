# 🎯 How to Run Metamon Examples

## TL;DR - Quick Start

```bash
# One command setup (from project root)
npm run setup-examples

# Start the examples
npm run examples

# Open http://localhost:3000
```

## What This Gets You

A fully functional demo application showing:

- **React Counter** + **Vue Message Board** + **Solid Theme Toggle** + **Svelte User List**
- All components sharing state and communicating in real-time
- Performance benchmarks comparing Metamon vs native frameworks
- Interactive documentation with copy-paste code examples

## Step-by-Step Guide

### Option 1: Automated Setup (Recommended)

```bash
# From the Metamon project root directory
npm run setup-examples
```

This single command:

- ✅ Installs all dependencies
- ✅ Builds the Metamon packages
- ✅ Sets up the example application
- ✅ Provides next steps

Then start the examples:

```bash
npm run examples
# or
cd examples && npm run dev
```

### Option 2: Manual Setup

```bash
# 1. Install root dependencies
npm install

# 2. Build Metamon packages
npm run build

# 3. Setup examples
cd examples
npm install

# 4. Start development server
npm run dev
```

## Available Commands

From the **root directory**:

```bash
npm run setup-examples    # One-time setup
npm run examples          # Start example app
npm run build            # Build all packages
```

From the **examples directory**:

```bash
npm run dev              # Start development server
npm test                 # Run unit tests
npm run test:e2e         # Run E2E tests (requires: npx playwright install)
npm run benchmark        # Run performance benchmarks
npm run build            # Build for production
```

## What to Explore

### 🏠 Main Demo (`http://localhost:3000`)

- Watch React increment a counter that updates Svelte's user count
- Add users in Svelte and see events appear in Vue's message board
- Toggle themes in Solid and watch all components change appearance
- See real-time shared state updates in the top panel

### 📊 Performance (`/performance`)

- Click "Run Benchmarks" to see live performance comparisons
- Compare Metamon overhead vs native framework performance
- View bundle size analysis and memory usage stats

### 📚 Documentation (`/docs`)

- Browse framework-specific code examples
- Copy-paste ready snippets for React, Vue, Solid, and Svelte
- Learn best practices and patterns

## Troubleshooting

**"Cannot resolve @metamon/core"**
→ Run `npm run build` from the root directory first

**"Port 3000 already in use"**
→ Kill the process or change port in `examples/vite.config.js`

**"Node.js version error"**
→ Upgrade to Node.js 18+ from [nodejs.org](https://nodejs.org/)

**Playwright tests fail**
→ Run `npx playwright install` from the examples directory

## File Structure

```
metamon/
├── examples/                    # Example application
│   ├── src/
│   │   ├── components/         # Multi-framework components
│   │   │   ├── react-counter.mtm
│   │   │   ├── vue-message-board.mtm
│   │   │   ├── solid-theme-toggle.mtm
│   │   │   └── svelte-user-list.mtm
│   │   ├── pages/              # Application pages
│   │   │   ├── index.mtm       # Main demo
│   │   │   ├── performance.mtm # Benchmarks
│   │   │   └── documentation.mtm # Docs
│   │   └── main.js             # App entry point
│   ├── tests/e2e/              # End-to-end tests
│   └── package.json
├── packages/                    # Metamon framework packages
│   ├── core/                   # Core interfaces
│   ├── adapters/               # Framework adapters
│   ├── build-tools/            # Build plugins
│   └── dev-tools/              # Development tools
├── setup-examples.js           # Automated setup script
├── GETTING_STARTED.md          # Detailed setup guide
└── package.json                # Root package with scripts
```

## Next Steps

1. **Explore the code**: Look at `.mtm` files in `examples/src/components/`
2. **Modify components**: Try changing the React counter or Vue message board
3. **Create new components**: Add your own `.mtm` files
4. **Run tests**: Verify everything works with `npm run test:e2e`

## Need Help?

- 📖 **Detailed Guide**: See `GETTING_STARTED.md`
- 🔧 **Examples README**: See `examples/README.md`
- 🧪 **Try the Interactive Docs**: Visit `/docs` in the running app

---

**Ready to see multi-framework magic in action? Run the setup and open your browser!** 🚀
