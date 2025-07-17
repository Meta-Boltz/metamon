# Requirements Document

## Introduction

Metamon is a meta-framework that enables JavaScript developers to write pages and components once using .mtm files with frontmatter configuration, allowing them to target specific frameworks (React, Vue, Solid, Svelte) while sharing state and events through a unified pub/sub system. Each .mtm file contains framework-specific code in its body with metadata defining the target framework and event channels, enabling seamless communication between components regardless of their underlying framework.

## Requirements

### Requirement 1

**User Story:** As a JavaScript developer, I want to write components and pages in .mtm files with frontmatter configuration, so that I can specify the target framework and event channels for each component.

#### Acceptance Criteria

1. WHEN a developer creates a .mtm file THEN the system SHALL parse the frontmatter to extract target framework and channel configuration
2. WHEN the frontmatter specifies `target: reactjs` THEN the component body SHALL be processed as React code
3. WHEN the frontmatter defines channels with event names and emit functions THEN the system SHALL register these events in the global pub/sub system
4. WHEN a .mtm file is saved THEN the system SHALL validate the frontmatter syntax and provide clear error messages for invalid configurations

### Requirement 2

**User Story:** As a developer, I want a unified pub/sub event system that works across all JavaScript frameworks, so that components written in different frameworks can communicate with each other.

#### Acceptance Criteria

1. WHEN a component emits an event through the pub/sub system THEN all subscribed components SHALL receive the event regardless of their framework
2. WHEN an event is emitted THEN the system SHALL deliver it to all registered listeners with the correct payload
3. WHEN components are destroyed or unmounted THEN the system SHALL automatically clean up their event subscriptions
4. WHEN multiple components listen to the same event THEN all listeners SHALL receive the event in the order they were registered

### Requirement 3

**User Story:** As a developer, I want built-in client-side routing that works with .mtm pages, so that I can create single-page applications without additional routing libraries.

#### Acceptance Criteria

1. WHEN .mtm files are placed in a pages directory structure THEN the system SHALL automatically generate routes based on file paths
2. WHEN a route is accessed THEN the system SHALL render the corresponding .mtm page with its specified framework
3. WHEN navigating between routes THEN the system SHALL maintain the pub/sub event system state across page transitions
4. WHEN a route contains dynamic segments THEN the system SHALL pass route parameters to the page component

### Requirement 4

**User Story:** As a developer, I want the framework to handle the build process automatically, so that I can focus on writing components without worrying about framework-specific compilation.

#### Acceptance Criteria

1. WHEN running `dev` mode THEN the system SHALL watch .mtm files for changes and hot-reload the appropriate components
2. WHEN building for production THEN the system SHALL compile each .mtm file to its target framework's optimized output
3. WHEN a .mtm file targets React THEN the build system SHALL generate proper React components with JSX compilation
4. WHEN a .mtm file targets Vue THEN the build system SHALL generate proper Vue components with template compilation
5. WHEN a .mtm file targets Solid THEN the build system SHALL generate proper Solid components with reactive compilation
6. WHEN a .mtm file targets Svelte THEN the build system SHALL generate proper Svelte components with compiler optimizations

### Requirement 5

**User Story:** As a developer, I want to organize my project with .mtm files for both pages and components, so that I can maintain a clear project structure.

#### Acceptance Criteria

1. WHEN creating page files like `home/index.mtm` THEN the system SHALL treat them as routable pages
2. WHEN creating component files like `components/button.mtm` THEN the system SHALL treat them as reusable components
3. WHEN importing .mtm components THEN the system SHALL resolve imports correctly regardless of the target framework
4. WHEN .mtm files reference each other THEN the system SHALL maintain proper dependency resolution during build

### Requirement 6

**User Story:** As a developer, I want JavaScript signals for global state management, so that I can share reactive state across components written in different frameworks.

#### Acceptance Criteria

1. WHEN creating global state THEN the system SHALL use JavaScript signals as the underlying reactive primitive
2. WHEN a signal value changes THEN all components subscribed to that signal SHALL update regardless of their target framework
3. WHEN React components use signals THEN the system SHALL integrate with React's rendering cycle to trigger re-renders
4. WHEN Vue components use signals THEN the system SHALL integrate with Vue's reactivity system
5. WHEN Solid components use signals THEN the system SHALL use Solid's native signal implementation
6. WHEN Svelte components use signals THEN the system SHALL integrate with Svelte's reactive stores
7. WHEN signals are updated THEN the changes SHALL be batched and optimized for performance across all frameworks

### Requirement 7

**User Story:** As a developer, I want comprehensive development tooling support, so that I can have a smooth development experience with syntax highlighting, error reporting, and debugging.

#### Acceptance Criteria

1. WHEN editing .mtm files THEN the system SHALL provide appropriate syntax highlighting for the target framework code
2. WHEN there are compilation errors THEN the system SHALL display clear error messages with file locations and suggestions
3. WHEN debugging applications THEN the system SHALL provide source maps linking generated code back to original .mtm files
4. WHEN the pub/sub system has issues THEN the system SHALL provide debugging tools to inspect event flow and subscriptions
5. WHEN working with signals THEN the system SHALL provide debugging tools to inspect signal values and dependencies