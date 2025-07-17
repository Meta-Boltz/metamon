# @metamon/dev-tools

Development tools and language support for Metamon .mtm files.

## Features

- **Language Server Protocol (LSP)** support for .mtm files
- **Syntax highlighting** with TextMate grammar
- **IntelliSense and autocomplete** for frontmatter configuration
- **Real-time error reporting** and validation
- **VS Code extension** for seamless development experience

## Components

### Language Server

The language server provides:

- Real-time validation of .mtm files
- Autocomplete for frontmatter fields and framework-specific code
- Error diagnostics with helpful suggestions
- Support for all target frameworks (React, Vue, Solid, Svelte)

### Syntax Highlighting

TextMate grammar for .mtm files with:

- Frontmatter YAML syntax highlighting
- Framework-specific code highlighting in content area
- Special highlighting for Metamon-specific fields

### VS Code Extension

Complete VS Code integration including:

- Language support for .mtm files
- Code snippets for common patterns
- Commands for creating new .mtm files
- Framework information and help

## Installation

### Language Server

```bash
npm install @metamon/dev-tools
```

### VS Code Extension

1. Copy the `vscode-extension` folder to your VS Code extensions directory
2. Reload VS Code
3. The extension will automatically activate for .mtm files

## Usage

### Language Server

Start the language server:

```bash
npx metamon-language-server
```

Or use it programmatically:

```typescript
import { MTMFileParser, MTMValidator, ErrorReporter } from "@metamon/dev-tools";

const parser = new MTMFileParser();
const validator = new MTMValidator();
const errorReporter = new ErrorReporter({
  onError: (report) => console.log("Errors:", report.errors),
  onClear: (file) => console.log("Cleared:", file),
});

// Parse and validate a .mtm file
const content = `---
target: reactjs
channels:
  - event: userLogin
    emit: onUserLogin
---

import React from 'react';
export default function Component() {
  return <div>Hello World</div>;
}`;

const parsed = parser.parse(content, "component.mtm");
const errors = validator.validate(parsed);

if (errors.length > 0) {
  console.log("Validation errors:", errors);
}
```

### Error Reporter

Real-time error reporting with debouncing:

```typescript
import { ErrorReporter } from "@metamon/dev-tools";

const reporter = new ErrorReporter({
  onError: (report) => {
    console.log(`Errors in ${report.file}:`, report.errors);
  },
  onClear: (file) => {
    console.log(`Errors cleared in ${file}`);
  },
  debounceMs: 300,
});

// Report file changes
reporter.reportFile("component.mtm", fileContent);

// Clean up when done
reporter.dispose();
```

## API Reference

### MTMFileParser

```typescript
class MTMFileParser {
  parse(content: string, filePath: string): MTMFile;
  getFrontmatterPosition(
    content: string,
    line: number,
    character: number
  ): boolean;
  getYamlPath(content: string, line: number, character: number): string[];
}
```

### MTMValidator

```typescript
class MTMValidator {
  validate(mtmFile: MTMFile): ValidationError[];
}
```

### MTMCompletionProvider

```typescript
class MTMCompletionProvider {
  provideCompletions(
    document: TextDocument,
    position: Position
  ): CompletionItem[];
  resolveCompletion(item: CompletionItem): CompletionItem;
}
```

### ErrorReporter

```typescript
class ErrorReporter {
  constructor(options: ErrorReporterOptions);
  reportFile(filePath: string, content: string): void;
  clearFile(filePath: string): void;
  getLastReport(filePath: string): ErrorReport | undefined;
  getAllReports(): Map<string, ErrorReport>;
  dispose(): void;
}
```

## Supported Features

### Frontmatter Validation

- Target framework validation (reactjs, vue, solid, svelte)
- Channel configuration validation
- Route format validation
- Layout specification validation

### Content Validation

Framework-specific validation:

- **React**: Import validation, export validation
- **Vue**: Composition API/Options API structure validation
- **Solid**: Solid.js import validation
- **Svelte**: Component structure validation

### Autocomplete

- Frontmatter field completion
- Framework-specific code completion
- Metamon runtime API completion
- Code snippets for common patterns

## VS Code Snippets

Available snippets:

- `mtm-react` - React component template
- `mtm-vue` - Vue component template
- `mtm-solid` - Solid component template
- `mtm-svelte` - Svelte component template
- `mtm-page` - Page component with routing
- `channel` - Channel definition
- `frontmatter` - Frontmatter block

## Development

### Running Tests

```bash
npm test
```

### Building

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

## License

MIT
