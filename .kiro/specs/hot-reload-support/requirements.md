# Requirements Document

## Introduction

This feature will enhance the hot reload capabilities of the Metamon framework to provide seamless development experience when working with .mtm files and cross-framework components. The current Vite-based setup provides basic HMR, but we need specialized hot reload support that preserves state across framework boundaries and handles the unique aspects of Metamon's multi-framework architecture.

## Requirements

### Requirement 1

**User Story:** As a developer, I want .mtm files to hot reload instantly when I make changes to any part of the file (frontmatter, imports, or component code), so that I can see updates without losing application state or waiting for full rebuilds.

#### Acceptance Criteria

1. WHEN a .mtm file content is modified THEN the system SHALL reload the component within 500ms
2. WHEN a .mtm file is reloaded THEN the system SHALL preserve existing signal state across frameworks
3. WHEN a .mtm file has syntax errors THEN the system SHALL display clear error messages without breaking the application
4. WHEN a .mtm file is reloaded THEN the system SHALL maintain active subscriptions to signals and events
5. WHEN a .mtm file's JavaScript/TypeScript code is modified THEN the component SHALL update without full page refresh

### Requirement 2

**User Story:** As a developer, I want cross-framework component changes to hot reload without breaking inter-framework communication, so that I can develop complex multi-framework features efficiently.

#### Acceptance Criteria

1. WHEN a React component is modified THEN other framework components SHALL continue to receive its events
2. WHEN a Vue component is modified THEN its signal subscriptions SHALL remain active after reload
3. WHEN a Svelte component is modified THEN its store integrations SHALL persist through the reload
4. WHEN a Solid component is modified THEN its signal connections SHALL be automatically restored

### Requirement 3

**User Story:** As a developer, I want shared state and signals to persist during hot reloads, so that I don't lose my development progress when making changes.

#### Acceptance Criteria

1. WHEN any component is hot reloaded THEN global signals SHALL retain their current values
2. WHEN any component is hot reloaded THEN pub/sub subscriptions SHALL be automatically re-established
3. WHEN any component is hot reloaded THEN the shared state display SHALL continue showing accurate values
4. IF a component's signal usage changes THEN the system SHALL update subscriptions without losing state

### Requirement 4

**User Story:** As a developer, I want clear visual feedback during hot reload operations, so that I know when changes are being applied and if any issues occur.

#### Acceptance Criteria

1. WHEN a hot reload begins THEN the system SHALL show a subtle loading indicator
2. WHEN a hot reload completes successfully THEN the system SHALL show a brief success notification
3. WHEN a hot reload fails THEN the system SHALL display the error with file location and line number
4. WHEN multiple files are being reloaded THEN the system SHALL show progress for each file

### Requirement 5

**User Story:** As a developer, I want hot reload to work with the MTM plugin's compilation process, so that changes to MTM syntax are immediately reflected in the browser.

#### Acceptance Criteria

1. WHEN MTM frontmatter is modified THEN the component SHALL be recompiled and reloaded
2. WHEN MTM target framework is changed THEN the component SHALL be rebuilt for the new framework
3. WHEN MTM channels configuration is updated THEN event subscriptions SHALL be updated accordingly
4. WHEN MTM imports are modified THEN dependency resolution SHALL be updated without full page reload

### Requirement 6

**User Story:** As a developer, I want to import and use native framework components directly (ReactCounter.jsx, VueComponent.vue, SvelteComponent.svelte) with full hot reload support, so that I can write components in their primitive framework syntax when needed.

#### Acceptance Criteria

1. WHEN a .jsx/.tsx React component is modified THEN it SHALL hot reload while preserving Metamon signal connections
2. WHEN a .vue Vue component is modified THEN it SHALL hot reload while maintaining pub/sub subscriptions
3. WHEN a .svelte Svelte component is modified THEN it SHALL hot reload while preserving store integrations
4. WHEN native framework components are imported in .mtm files THEN changes SHALL trigger hot reload of the importing .mtm file
5. WHEN native framework components use Metamon adapters THEN hot reload SHALL preserve cross-framework state connections

### Requirement 7

**User Story:** As a developer, I want hot reload to handle CSS and styling changes in multi-framework components, so that visual changes are immediately visible.

#### Acceptance Criteria

1. WHEN CSS classes are modified in any framework component THEN styles SHALL update without component remount
2. WHEN theme-related changes are made THEN all framework components SHALL reflect the new styling
3. WHEN framework-specific styling is updated THEN only affected components SHALL re-render
4. WHEN global styles are modified THEN all components SHALL receive the updated styles