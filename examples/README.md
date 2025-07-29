# Enhanced Routing Multi-Framework Examples

This example application demonstrates the enhanced MTM framework with comprehensive routing system, client-side navigation using standard HTML anchor tags, frontmatter-based route configuration, flexible JavaScript compilation modes, and seamless integration with multiple frontend frameworks (React, Vue, Solid, Svelte).

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm (recommended)

### Step 1: Install Dependencies

```bash
cd examples
npm install
```

### Step 2: Run the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Step 3: Explore the Features

- **Home** (`/`): Main demo showcasing all framework components working together
- **About** (`/about`): Basic routing demonstration
- **React Example** (`/react-example`): React component integration
- **Vue Example** (`/vue-example`): Vue component integration
- **Solid Example** (`/solid-example`): Solid component integration
- **Svelte Example** (`/svelte-example`): Svelte component integration

## 🎯 What This Example Demonstrates

### 1. Enhanced Routing System

- **Frontmatter Route Configuration**: Define routes using `---route: "/path"---` in .mtm files
- **Client-Side Navigation**: Standard HTML anchor tags with `href` attributes
- **Dynamic Route Segments**: Support for parameterized routing like `/user/[id]`
- **Browser History Integration**: Back/forward buttons and bookmarking work correctly

### 2. Multi-Framework Component Integration

- **React Components**: Counter and DataChart components with hooks
- **Vue Components**: Button and TodoList components with Composition API
- **Solid Components**: UserProfile with native signals
- **Svelte Components**: Card and WeatherWidget with stores

### 3. Flexible JavaScript Compilation

- **Inline Mode**: `---compileJsMode: inline---` embeds JavaScript in HTML
- **External Mode**: `---compileJsMode: external.js---` generates separate .js files
- **Automatic Optimization**: Smart defaults based on script size

### 4. Unified Component Path Resolution

- **@components/ prefix**: Consistent import paths across frameworks
- **Relative imports**: `./ComponentName` resolves relative to current file
- **TypeScript support**: Proper type checking and IntelliSense

## 📁 Project Structure

```
examples/
├── src/
│   ├── components/          # Multi-framework components
│   │   ├── Button.vue              # Vue button component
│   │   ├── Card.svelte             # Svelte card component
│   │   ├── Counter.tsx             # React counter component
│   │   ├── DataChart.tsx           # React data visualization
│   │   ├── Modal.tsx               # React modal component
│   │   ├── TodoList.vue            # Vue todo list component
│   │   ├── UserProfile.tsx         # Solid user profile
│   │   └── WeatherWidget.svelte    # Svelte weather widget
│   ├── pages/               # Application pages (.mtm files)
│   │   ├── index.mtm               # Home page
│   │   ├── about.mtm               # About page
│   │   ├── react-example.mtm       # React integration demo
│   │   ├── vue-example.mtm         # Vue integration demo
│   │   ├── solid-example.mtm       # Solid integration demo
│   │   └── svelte-example.mtm      # Svelte integration demo
│   └── styles/              # Global styles
│       └── global.css              # Application styles
├── tests/                   # Test files
│   └── e2e/                # End-to-end tests
├── scripts/                # Build and utility scripts
└── README.md
```

## 🔧 Key Features Showcased

### Frontmatter Route Configuration

```mtm
---
route: "/user/profile"
compileJsMode: "external.js"
title: "User Profile"
description: "User profile management page"
---

import UserCard from "@components/UserCard.tsx"
import ProfileForm from "@components/ProfileForm.vue"

<template>
  <div class="profile-page">
    <h1>User Profile</h1>
    <UserCard />
    <ProfileForm />

    <nav>
      <a href="/dashboard">Dashboard</a>
      <a href="/settings">Settings</a>
    </nav>
  </div>
</template>
```

### Client-Side Navigation

```html
<!-- Standard HTML anchor tags work for client-side routing -->
<a href="/about">About</a>
<a href="/react-example">React Demo</a>
<a href="/vue-example">Vue Demo</a>

<!-- External links work normally -->
<a href="https://example.com">External Link</a>
```

### Multi-Framework Component Usage

```mtm
---
route: "/demo"
---

import Counter from "@components/Counter.tsx"        <!-- React -->
import TodoList from "@components/TodoList.vue"     <!-- Vue -->
import UserProfile from "@components/UserProfile.tsx" <!-- Solid -->
import WeatherWidget from "@components/WeatherWidget.svelte" <!-- Svelte -->

<template>
  <div>
    <Counter initialValue={0} />
    <TodoList items={[]} />
    <UserProfile userId="123" />
    <WeatherWidget location="New York" />
  </div>
</template>
```

### JavaScript Compilation Modes

```mtm
---
route: "/inline-demo"
compileJsMode: "inline"
---

<!-- JavaScript will be embedded directly in HTML -->

---
route: "/external-demo"
compileJsMode: "external.js"
---

<!-- JavaScript will be compiled to separate .js file -->
```

## 🧪 Running Tests

### Unit Tests

```bash
npm test
```

### End-to-End Tests

```bash
# Install Playwright browsers (first time only)
npx playwright install

# Run E2E tests
npm run test:e2e
```

### Browser Compatibility Tests

```bash
npm run test:browser-compat
```

### Production Build Tests

```bash
npm run test:production
```

## 🚀 Building for Production

```bash
# Build optimized production bundle
npm run build

# Preview production build
npm run preview
```

## 🔧 Development

### Hot Module Replacement

The development server supports HMR for all frameworks:

- React components update instantly
- Vue components preserve state during updates
- Solid components re-render efficiently
- Svelte components update with minimal overhead

### Error Handling

- Clear compilation errors for route conflicts
- Helpful messages for import resolution failures
- Runtime error boundaries for component failures
- Development-friendly error overlays

## 📊 Performance Features

- **Tree Shaking**: Unused framework code is eliminated
- **Code Splitting**: Routes are loaded on demand
- **Component Lazy Loading**: Components load when needed
- **Bundle Optimization**: Framework-specific optimizations applied

## 🌟 Best Practices Demonstrated

1. **Route Organization**: Logical page structure with clear URLs
2. **Component Reusability**: Components work across different pages
3. **Import Consistency**: Unified import paths across frameworks
4. **Performance Optimization**: Efficient compilation and bundling
5. **Developer Experience**: Fast development with HMR and error handling

## 🔗 Navigation Examples

The application demonstrates various navigation patterns:

- **Static Routes**: `/about`, `/contact`
- **Framework Examples**: `/react-example`, `/vue-example`
- **Nested Navigation**: Components with internal navigation
- **External Links**: Proper handling of external URLs

## 🤝 Contributing

When adding new examples:

1. Create new .mtm files in `src/pages/`
2. Add corresponding components in `src/components/`
3. Update navigation links in existing pages
4. Add E2E tests for new functionality
5. Update this README with new features

## 📄 License

This example application demonstrates the enhanced MTM framework capabilities and is provided for educational and development purposes.
