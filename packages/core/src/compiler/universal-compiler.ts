/**
 * Universal MTM Compiler - No target framework needed!
 * Automatically detects and handles multi-framework imports
 */

import * as yaml from 'yaml';
import { CompilationError } from '../error-handling/compilation-error.js';

export interface UniversalMTMFile {
  content: string;
  filePath: string;
  imports: FrameworkImport[];
  hasUniversalFeatures: boolean;
}

export interface FrameworkImport {
  framework: 'react' | 'vue' | 'solid' | 'svelte';
  componentName: string;
  filePath: string;
  importStatement: string;
}

export interface UniversalCompilationResult {
  code: string;
  frameworks: string[];
  dependencies: string[];
  exports: string[];
  isUniversal: boolean;
}

/**
 * Universal MTM Parser - No frontmatter needed!
 */
export class UniversalMTMParser {
  static parse(content: string, filePath: string): UniversalMTMFile {
    try {
      // Extract imports and detect frameworks
      const imports = this.extractFrameworkImports(content);
      const hasUniversalFeatures = this.detectUniversalFeatures(content);
      
      return {
        content: content.trim(),
        filePath,
        imports,
        hasUniversalFeatures
      };
    } catch (error) {
      throw CompilationError.syntax(
        `Failed to parse universal .mtm file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath
      );
    }
  }

  private static extractFrameworkImports(content: string): FrameworkImport[] {
    const imports: FrameworkImport[] = [];
    const importRegex = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const [fullMatch, componentName, importPath] = match;
      const framework = this.detectFrameworkFromPath(importPath);
      
      if (framework) {
        imports.push({
          framework,
          componentName,
          filePath: importPath,
          importStatement: fullMatch
        });
      }
    }

    return imports;
  }

  private static detectFrameworkFromPath(path: string): 'react' | 'vue' | 'solid' | 'svelte' | null {
    if (path.endsWith('.jsx') || path.endsWith('.tsx')) {
      // Could be React or Solid - we'll determine by content analysis
      return 'react'; // Default assumption
    }
    if (path.endsWith('.vue')) return 'vue';
    if (path.endsWith('.svelte')) return 'svelte';
    return null;
  }

  private static detectUniversalFeatures(content: string): boolean {
    // Check for universal functions like signal(), events(), onMount(), etc.
    const universalPatterns = [
      /\bsignal\s*\(/,
      /\bevents\s*\(/,
      /\bonMount\s*\(/,
      /\bonDestroy\s*\(/,
      /\bemit\s*\(/,
      /\bon\s*\(/
    ];

    return universalPatterns.some(pattern => pattern.test(content));
  }
}

/**
 * Universal MTM Compiler - Handles multi-framework components
 */
export class UniversalMTMCompiler {
  compile(mtmFile: UniversalMTMFile): UniversalCompilationResult {
    try {
      const frameworks = [...new Set(mtmFile.imports.map(imp => imp.framework))];
      
      if (frameworks.length === 0) {
        // No framework imports - treat as vanilla JS
        return this.compileVanilla(mtmFile);
      }
      
      if (frameworks.length === 1) {
        // Single framework - compile to that framework
        return this.compileSingleFramework(mtmFile, frameworks[0]);
      }
      
      // Multi-framework - create universal wrapper
      return this.compileUniversal(mtmFile, frameworks);
    } catch (error) {
      throw CompilationError.framework(
        `Universal compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        mtmFile.filePath,
        'Universal',
        error instanceof Error ? error : undefined
      );
    }
  }

  private compileVanilla(mtmFile: UniversalMTMFile): UniversalCompilationResult {
    // Simple vanilla JS component
    const code = this.wrapWithUniversalRuntime(mtmFile.content);
    
    return {
      code,
      frameworks: [],
      dependencies: ['@metamon/runtime'],
      exports: ['default'],
      isUniversal: false
    };
  }

  private compileSingleFramework(mtmFile: UniversalMTMFile, framework: string): UniversalCompilationResult {
    // Single framework with universal features
    const code = this.wrapWithFrameworkAdapter(mtmFile.content, framework);
    
    return {
      code,
      frameworks: [framework],
      dependencies: [this.getFrameworkDependency(framework), '@metamon/runtime'],
      exports: ['default'],
      isUniversal: true
    };
  }

  private compileUniversal(mtmFile: UniversalMTMFile, frameworks: string[]): UniversalCompilationResult {
    // Multi-framework universal component
    const code = this.createUniversalWrapper(mtmFile, frameworks);
    
    return {
      code,
      frameworks,
      dependencies: [
        ...frameworks.map(f => this.getFrameworkDependency(f)),
        '@metamon/runtime'
      ],
      exports: ['default'],
      isUniversal: true
    };
  }

  private wrapWithUniversalRuntime(content: string): string {
    return `
import { signal, events, onMount, onDestroy } from '@metamon/runtime';

${content}
`;
  }

  private wrapWithFrameworkAdapter(content: string, framework: string): string {
    const adapterImport = this.getAdapterImport(framework);
    
    return `
${adapterImport}
import { signal, events, onMount, onDestroy } from '@metamon/runtime/${framework}';

${content}
`;
  }

  private createUniversalWrapper(mtmFile: UniversalMTMFile, frameworks: string[]): string {
    // This is the magic - create a wrapper that can render components from multiple frameworks
    const imports = frameworks.map(f => this.getAdapterImport(f)).join('\n');
    
    return `
${imports}
import { UniversalRenderer, signal, events, onMount, onDestroy } from '@metamon/runtime';

${mtmFile.content}

// Wrap the component with universal renderer
const WrappedComponent = UniversalRenderer.wrap(${this.getExportedComponentName(mtmFile.content)});
export default WrappedComponent;
`;
  }

  private getFrameworkDependency(framework: string): string {
    switch (framework) {
      case 'react': return 'react';
      case 'vue': return 'vue';
      case 'solid': return 'solid-js';
      case 'svelte': return 'svelte';
      default: return '';
    }
  }

  private getAdapterImport(framework: string): string {
    return `import { ${framework}Adapter } from '@metamon/runtime/${framework}';`;
  }

  private getExportedComponentName(content: string): string {
    // Extract the default export function name
    const match = content.match(/export\s+default\s+function\s+(\w+)/);
    return match ? match[1] : 'Component';
  }
}