# Enhanced MTM Framework Design

## Overview

The Enhanced MTM Framework transforms the simple meta-framework into a professional-grade development tool that supports link-based routing, component imports, external JavaScript compilation, and seamless integration with existing React/Vue/Svelte ecosystems.

## Architecture

### Core Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MTM Parser    │───▶│  MTM Compiler   │───▶│ Output Generator│
│                 │    │                 │    │                 │
│ - Route Parser  │    │ - Link Handler  │    │ - HTML Files    │
│ - Import Parser │    │ - Component     │    │ - JS Files      │
│ - Meta Parser   │    │   Resolver      │    │ - Route Config  │
│ - Template      │    │ - JS Compiler   │    │ - Component     │
│   Parser        │    │ - Router Gen    │    │   Bundles       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  Router System  │
                       │                 │
                       │ - Route Table   │
                       │ - Link Handler  │
                       │ - History API   │
                       │ - Component     │
                       │   Loader        │
                       └─────────────────┘
```

### File Structure

```
enhanced-mtm-app/
├── pages/
│   ├── index.mtm              # route: "/"
│   ├── about.mtm              # route: "/about"
│   ├── contact.mtm            # route: "/contact"
│   └── blog/
│       ├── index.mtm          # route: "/blog"
│       └── [slug].mtm         # route: "/blog/:slug"
├── components/
│   ├── Counter.tsx            # React component
│   ├── Button.vue             # Vue component
│   └── Card.svelte            # Svelte component
├── dist/
│   ├── index.html             # Main SPA entry
│   ├── app.js                 # Router and components
│   ├── pages/
│   │   ├── about.js           # Page-specific JS
│   │   └── contact.js         # Page-specific JS
│   └── components/
│       └── shared.js          # Shared components
└── mtm.config.js              # MTM configuration
```

## Enhanced MTM Syntax

### Page Definition

```javascript
// pages/about.mtm
route: "/about"
title: "About Us"
description: "Learn more about our company"
compileJs: "external.js"

import Counter from "@components/Counter.tsx"
import Button from "@components/Button.vue"
import Card from "@components/Card.svelte"

// Reactive state
$pageViews! = signal('aboutPageViews', 0)
$showDetails! = signal('showDetails', false)

// Page functions
$incrementViews = () => {
  $pageViews++
}

$toggleDetails = () => {
  $showDetails = !$showDetails
}

<template>
  <div class="about-page">
    <h1>{title}</h1>
    <p>{description}</p>

    <nav>
      <Link href="/">Home</Link>
      <Link href="/contact">Contact</Link>
    </nav>

    <Counter initialValue={$pageViews} onIncrement={$incrementViews} />

    <Button
      label="Toggle Details"
      onClick={$toggleDetails}
      variant="primary"
    />

    {#if $showDetails}
      <Card title="Company Details">
        <p>We are a leading technology company...</p>
      </Card>
    {/if}

    <footer>
      <a href="/privacy">Privacy Policy</a>
      <a href="/terms">Terms of Service</a>
    </footer>
  </div>
</template>
```

### Component Import Resolution

```javascript
// Import resolution patterns
import Counter from "@components/Counter.tsx"; // React component
import Button from "@components/Button.vue"; // Vue component
import Card from "@components/Card.svelte"; // Svelte component
import { Modal, Dialog } from "@ui/components"; // Named imports
import * as Utils from "@utils/helpers"; // Namespace imports
```

### Link Component

```html
<!-- Built-in Link component for client-side navigation -->
<Link href="/about" className="nav-link">About Us</Link>
<Link href="/blog/post-1" prefetch>Blog Post</Link>
<Link href="/external" external>External Link</Link>

<!-- Standard anchor tags (intercepted for SPA navigation) -->
<a href="/contact">Contact</a>
<a href="https://external.com" target="_blank">External</a>
```

## Compilation Process

### 1. Parse Phase

```javascript
// MTM file parsing
const parsedPage = {
  metadata: {
    route: "/about",
    title: "About Us",
    description: "Learn more about our company",
    compileJs: "external.js",
  },
  imports: [
    { name: "Counter", from: "@components/Counter.tsx", type: "react" },
    { name: "Button", from: "@components/Button.vue", type: "vue" },
    { name: "Card", from: "@components/Card.svelte", type: "svelte" },
  ],
  variables: [
    {
      name: "pageViews",
      type: "reactive",
      value: "signal('aboutPageViews', 0)",
    },
  ],
  functions: [{ name: "incrementViews", body: "$pageViews++" }],
  template: "<!-- parsed template -->",
};
```

### 2. Component Resolution

```javascript
// Component resolver
class ComponentResolver {
  resolveImport(importSpec) {
    const { name, from, type } = importSpec;

    switch (type) {
      case "react":
        return this.resolveReactComponent(from);
      case "vue":
        return this.resolveVueComponent(from);
      case "svelte":
        return this.resolveSvelteComponent(from);
      default:
        return this.resolveGenericComponent(from);
    }
  }

  generateComponentWrapper(component, type) {
    // Generate MTM-compatible wrapper for external components
    return `
      const ${component.name}Wrapper = (props) => {
        return ${this.generateFrameworkSpecificWrapper(component, type)};
      };
    `;
  }
}
```

### 3. Router Generation

```javascript
// Generated router system
const MTMRouter = {
  routes: {
    "/": () => import("./pages/index.js"),
    "/about": () => import("./pages/about.js"),
    "/contact": () => import("./pages/contact.js"),
    "/blog": () => import("./pages/blog/index.js"),
    "/blog/:slug": () => import("./pages/blog/[slug].js"),
  },

  navigate(path) {
    const route = this.matchRoute(path);
    if (route) {
      this.loadPage(route, path);
      this.updateHistory(path);
    }
  },

  interceptLinks() {
    document.addEventListener("click", (e) => {
      if (e.target.tagName === "A" && this.isInternalLink(e.target.href)) {
        e.preventDefault();
        this.navigate(e.target.pathname);
      }
    });
  },
};
```

### 4. JavaScript Compilation Options

#### Inline Compilation

```html
<!-- compileJs: "inline" -->
<!DOCTYPE html>
<html>
  <head>
    <title>About Us</title>
  </head>
  <body>
    <div id="app"></div>
    <script>
      // All JavaScript embedded directly
      const MTMRouter = {
        /* router code */
      };
      const AboutPage = {
        /* page code */
      };
      // Component code embedded
    </script>
  </body>
</html>
```

#### External Compilation

```html
<!-- compileJs: "external.js" -->
<!DOCTYPE html>
<html>
  <head>
    <title>About Us</title>
  </head>
  <body>
    <div id="app"></div>
    <script src="./js/mtm-router.js"></script>
    <script src="./js/components.js"></script>
    <script src="./js/about.js"></script>
  </body>
</html>
```

## Link Handling System

### Link Interception

```javascript
class LinkHandler {
  constructor(router) {
    this.router = router;
    this.setupLinkInterception();
  }

  setupLinkInterception() {
    document.addEventListener("click", (e) => {
      const link = e.target.closest("a");
      if (link && this.shouldIntercept(link)) {
        e.preventDefault();
        this.handleNavigation(link.href);
      }
    });
  }

  shouldIntercept(link) {
    const href = link.getAttribute("href");
    return (
      href &&
      !link.hasAttribute("external") &&
      !href.startsWith("http") &&
      !href.startsWith("mailto:") &&
      !href.startsWith("tel:")
    );
  }

  handleNavigation(href) {
    const url = new URL(href, window.location.origin);
    this.router.navigate(url.pathname);
  }
}
```

### Link Component Implementation

```javascript
// Built-in Link component
const Link = ({ href, children, className, prefetch, external, ...props }) => {
  const handleClick = (e) => {
    if (!external && !href.startsWith("http")) {
      e.preventDefault();
      MTMRouter.navigate(href);
    }
  };

  return `
    <a 
      href="${href}" 
      class="${className || ""}"
      ${external ? 'target="_blank" rel="noopener"' : ""}
      onclick="handleClick(event)"
      ${prefetch ? 'data-prefetch="true"' : ""}
      ${Object.entries(props)
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ")}
    >
      ${children}
    </a>
  `;
};
```

## Component Integration

### React Component Integration

```javascript
// React component wrapper
function wrapReactComponent(Component) {
  return function MTMReactWrapper(props) {
    const containerRef = useRef();

    useEffect(() => {
      const root = ReactDOM.createRoot(containerRef.current);
      root.render(React.createElement(Component, props));

      return () => root.unmount();
    }, [props]);

    return `<div ref="${containerRef}"></div>`;
  };
}
```

### Vue Component Integration

```javascript
// Vue component wrapper
function wrapVueComponent(Component) {
  return function MTMVueWrapper(props) {
    const app = Vue.createApp({
      render() {
        return Vue.h(Component, props);
      },
    });

    return {
      mount(element) {
        app.mount(element);
      },
      unmount() {
        app.unmount();
      },
    };
  };
}
```

## Performance Optimizations

### Code Splitting

- Automatic route-based code splitting
- Component-level code splitting
- Dynamic imports for lazy loading

### Caching Strategy

- External JS files with cache headers
- Component bundle optimization
- Route prefetching

### Build Optimizations

- Tree shaking for unused components
- Minification and compression
- Source map generation for debugging

## Development Experience

### Hot Reloading

- File watching for MTM files
- Component hot replacement
- Route hot reloading

### Error Handling

- Detailed compilation error messages
- Runtime error boundaries
- Development vs production error handling

### Debugging Tools

- Route debugging information
- Component inspection
- Performance monitoring
