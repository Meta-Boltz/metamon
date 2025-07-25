# Requirements Document

## Introduction

This feature enhances the MTM framework with a comprehensive routing system that supports client-side navigation using standard HTML anchor tags, frontmatter-based route configuration, flexible JavaScript compilation modes, and seamless integration with multiple frontend frameworks (React, Vue, Solid, Svelte). The system should provide a simple, intuitive developer experience while maintaining the power and flexibility needed for modern web applications.

## Requirements

### Requirement 1

**User Story:** As a developer, I want to define routes using frontmatter configuration in .mtm files, so that I can easily specify the URL path for each page without complex routing configuration.

#### Acceptance Criteria

1. WHEN I create a .mtm file with `---route: "/relative-page-path"---` THEN the system SHALL register that route in the routing table
2. WHEN I define a route path in frontmatter THEN the system SHALL make that page accessible at the specified URL
3. WHEN I omit the route attribute THEN the system SHALL use the file path as the default route
4. WHEN I define duplicate routes THEN the system SHALL show a clear error message during compilation
5. WHEN I use dynamic route segments like `/user/[id]` THEN the system SHALL support parameterized routing

### Requirement 2

**User Story:** As a developer, I want to navigate between pages using standard HTML anchor tags with href attributes, so that I can use familiar HTML syntax for client-side routing.

#### Acceptance Criteria

1. WHEN I use `<a href="/the-relative-page-path-here">The page title</a>` THEN the system SHALL perform client-side navigation
2. WHEN I click on internal links THEN the page SHALL navigate without a full page reload
3. WHEN I use external links (starting with http/https) THEN the system SHALL perform normal browser navigation
4. WHEN I right-click on internal links THEN the browser context menu SHALL work correctly (open in new tab, etc.)
5. WHEN I use keyboard navigation (Tab, Enter) THEN the links SHALL be accessible and functional

### Requirement 3

**User Story:** As a developer, I want to control JavaScript compilation mode through frontmatter configuration, so that I can choose between inline scripts and external JavaScript files based on my needs.

#### Acceptance Criteria

1. WHEN I set `---compileJsMode: external.js---` THEN the system SHALL compile JavaScript to a separate .js file
2. WHEN I set `---compileJsMode: inline---` THEN the system SHALL embed JavaScript directly in the HTML
3. WHEN I omit the compileJsMode attribute THEN the system SHALL use a sensible default (inline for small scripts, external for larger ones)
4. WHEN I use external mode THEN the system SHALL generate optimized, minified JavaScript files
5. WHEN I use inline mode THEN the system SHALL optimize the embedded JavaScript for faster initial page load

### Requirement 4

**User Story:** As a developer, I want to import and use React components in my MTM pages with simple import syntax, so that I can leverage the React ecosystem seamlessly.

#### Acceptance Criteria

1. WHEN I use `import Counter from "@components/Counter.tsx"` in frontmatter THEN the system SHALL resolve and import the React component
2. WHEN I use `<Counter />` in the template THEN the system SHALL render the React component correctly
3. WHEN React components have props THEN the system SHALL pass them correctly from MTM to React
4. WHEN React components use hooks THEN the system SHALL maintain proper React context and state
5. WHEN I build for production THEN React components SHALL be properly tree-shaken and optimized

### Requirement 5

**User Story:** As a developer, I want to import and use Vue components in my MTM pages with simple import syntax, so that I can leverage the Vue ecosystem seamlessly.

#### Acceptance Criteria

1. WHEN I use `import VueComponent from "@components/VueComponent.vue"` in frontmatter THEN the system SHALL resolve and import the Vue component
2. WHEN I use `<VueComponent />` in the template THEN the system SHALL render the Vue component correctly
3. WHEN Vue components have props THEN the system SHALL pass them correctly from MTM to Vue
4. WHEN Vue components use Composition API THEN the system SHALL maintain proper Vue reactivity
5. WHEN I build for production THEN Vue components SHALL be properly optimized with Vue's compiler

### Requirement 6

**User Story:** As a developer, I want to import and use Solid components in my MTM pages with simple import syntax, so that I can leverage Solid's performance benefits.

#### Acceptance Criteria

1. WHEN I use `import SolidComponent from "@components/SolidComponent.tsx"` in frontmatter THEN the system SHALL resolve and import the Solid component
2. WHEN I use `<SolidComponent />` in the template THEN the system SHALL render the Solid component correctly
3. WHEN Solid components use signals THEN the system SHALL maintain proper Solid reactivity
4. WHEN Solid components have props THEN the system SHALL pass them correctly from MTM to Solid
5. WHEN I build for production THEN Solid components SHALL be properly compiled and optimized

### Requirement 7

**User Story:** As a developer, I want to import and use Svelte components in my MTM pages with simple import syntax, so that I can leverage Svelte's compile-time optimizations.

#### Acceptance Criteria

1. WHEN I use `import SvelteComponent from "@components/SvelteComponent.svelte"` in frontmatter THEN the system SHALL resolve and import the Svelte component
2. WHEN I use `<SvelteComponent />` in the template THEN the system SHALL render the Svelte component correctly
3. WHEN Svelte components have reactive statements THEN the system SHALL maintain proper Svelte reactivity
4. WHEN Svelte components have props THEN the system SHALL pass them correctly from MTM to Svelte
5. WHEN I build for production THEN Svelte components SHALL be properly compiled and optimized

### Requirement 8

**User Story:** As a developer, I want a unified component path resolution system, so that I can use consistent import paths across all frameworks.

#### Acceptance Criteria

1. WHEN I use `@components/` prefix THEN the system SHALL resolve to a configured components directory
2. WHEN I use relative imports like `./ComponentName` THEN the system SHALL resolve relative to the current file
3. WHEN I use absolute imports THEN the system SHALL resolve from the project root
4. WHEN component files don't exist THEN the system SHALL show clear error messages with suggested fixes
5. WHEN I use TypeScript components THEN the system SHALL provide proper type checking and IntelliSense

### Requirement 9

**User Story:** As a user, I want client-side routing to work seamlessly with browser history, so that back/forward buttons and bookmarking work as expected.

#### Acceptance Criteria

1. WHEN I navigate between pages THEN the browser URL SHALL update correctly
2. WHEN I use browser back/forward buttons THEN the correct page SHALL load
3. WHEN I bookmark a page THEN the bookmark SHALL work correctly when accessed later
4. WHEN I refresh a page THEN the same page SHALL load without errors
5. WHEN I share a URL THEN the recipient SHALL see the correct page

### Requirement 10

**User Story:** As a developer, I want comprehensive examples demonstrating all features, so that I can understand how to use the enhanced MTM framework effectively.

#### Acceptance Criteria

1. WHEN I look at the examples THEN there SHALL be a home page using pure MTM syntax
2. WHEN I look at the examples THEN there SHALL be an about page demonstrating basic routing
3. WHEN I look at the examples THEN there SHALL be pages showcasing React, Vue, Solid, and Svelte integration
4. WHEN I run the examples THEN all navigation SHALL work with client-side routing
5. WHEN I examine the example code THEN it SHALL demonstrate best practices and proper syntax
