import {
  FrameworkCompiler,
  CompilationResult,
  Channel,
  MTMFile,
  CompilationError
} from '@metamon/core';
import { FrameworkAdapter, MTMConfig } from '../base/framework-adapter.js';

/**
 * React framework adapter for compiling .mtm files to React components
 */
export class ReactAdapter implements FrameworkAdapter {
  public readonly name = 'reactjs';
  public readonly fileExtension = '.jsx';

  /**
   * Compile MTM file content to React component
   */
  compile(mtmFile: MTMFile): CompilationResult {
    try {
      const { frontmatter, content, filePath } = mtmFile;
      
      if (frontmatter.target !== 'reactjs') {
        throw new Error(`Invalid target framework: ${frontmatter.target}. Expected 'reactjs'`);
      }

      // Extract imports and component code
      const { imports, componentCode } = this.parseContent(content);
      
      // Generate React-specific imports
      const reactImports = this.generateReactImports(imports, frontmatter.channels || []);
      
      // Wrap component with runtime integration
      const wrappedComponent = this.wrapWithRuntime(componentCode, frontmatter.channels || []);
      
      // Combine imports and component
      const finalCode = `${reactImports}\n\n${wrappedComponent}`;
      
      return {
        code: finalCode,
        dependencies: this.extractDependencies(imports),
        exports: ['default'],
        sourceMap: undefined // TODO: Implement source maps in future task
      };
    } catch (error) {
      throw CompilationError.framework(
        error instanceof Error ? error.message : 'Unknown compilation error',
        mtmFile.filePath,
        'React',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Generate imports for React components
   */
  generateImports(dependencies: string[]): string {
    const imports = ['import React from \'react\';'];
    
    dependencies.forEach(dep => {
      if (dep.startsWith('./') || dep.startsWith('../')) {
        imports.push(`import ${this.getImportName(dep)} from '${dep}';`);
      } else {
        imports.push(`import ${dep} from '${dep}';`);
      }
    });
    
    return imports.join('\n');
  }

  /**
   * Wrap component with runtime integration for signals and pub/sub
   */
  wrapWithRuntime(component: string, channels: Channel[]): string {
    const signalIntegration = this.setupSignalIntegration();
    const pubSubIntegration = this.setupPubSubIntegration(channels);
    
    return `${signalIntegration}

${pubSubIntegration}

${component}`;
  }

  /**
   * Inject runtime code into component
   */
  injectRuntime(component: string): string {
    return `import { useEffect } from 'react';
import { pubSubSystem } from '@metamon/core';

${component}`;
  }

  /**
   * Setup signal integration hooks for React
   */
  setupSignalIntegration(): string {
    return `import { useState, useEffect, useCallback } from 'react';
import { signalManager } from '@metamon/core';

/**
 * React hook for using Metamon signals
 */
export function useSignal(initialValue, key) {
  const [value, setValue] = useState(initialValue);
  const [signal, setSignal] = useState(null);
  
  useEffect(() => {
    let currentSignal;
    
    if (key) {
      currentSignal = signalManager.getSignal(key) || signalManager.createSignal(initialValue, key);
    } else {
      currentSignal = signalManager.createSignal(initialValue);
    }
    
    setSignal(currentSignal);
    setValue(currentSignal.value);
    
    const unsubscribe = currentSignal.subscribe((newValue) => {
      setValue(newValue);
    });
    
    return () => {
      unsubscribe();
      if (!key) {
        // Only destroy unnamed signals
        currentSignal.destroy?.();
      }
    };
  }, [key, initialValue]);
  
  const updateSignal = useCallback((newValue) => {
    if (signal) {
      signal.update(newValue);
    }
  }, [signal]);
  
  return [value, updateSignal];
}

/**
 * React hook for using named Metamon signals
 */
export function useMetamonSignal(key, initialValue) {
  return useSignal(initialValue, key);
}`;
  }

  /**
   * Setup pub/sub integration for React components
   */
  setupPubSubIntegration(channels: Channel[]): string {
    if (channels.length === 0) {
      return '';
    }

    const eventHandlers = channels.map(channel => 
      `const ${channel.emit} = useCallback((payload) => {
    pubSubSystem.emit('${channel.event}', payload);
  }, []);`
    ).join('\n  ');

    const subscriptions = channels.map(channel =>
      `useEffect(() => {
    const componentId = Math.random().toString(36).substr(2, 9);
    
    pubSubSystem.subscribe('${channel.event}', (payload) => {
      // Event received: ${channel.event}
      console.log('Received event ${channel.event}:', payload);
    }, componentId);
    
    return () => {
      pubSubSystem.cleanup(componentId);
    };
  }, []);`
    ).join('\n  ');

    return `import { pubSubSystem } from '@metamon/core';

// Event handlers
${eventHandlers}

// Event subscriptions
${subscriptions}`;
  }

  /**
   * Parse content to extract imports and component code
   */
  private parseContent(content: string): { imports: string[], componentCode: string } {
    const lines = content.split('\n');
    const imports: string[] = [];
    const componentLines: string[] = [];
    
    let inImportSection = true;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('import ') && inImportSection) {
        imports.push(trimmedLine);
      } else if (trimmedLine === '' && inImportSection) {
        // Skip empty lines in import section
        continue;
      } else {
        inImportSection = false;
        componentLines.push(line);
      }
    }
    
    return {
      imports,
      componentCode: componentLines.join('\n')
    };
  }

  /**
   * Generate React-specific imports including runtime hooks
   */
  private generateReactImports(userImports: string[], channels: Channel[]): string {
    const imports = ['import React from \'react\';'];
    
    // Add React hooks based on usage
    const reactHooks = ['useState', 'useEffect', 'useCallback'];
    imports.push(`import { ${reactHooks.join(', ')} } from 'react';`);
    
    // Add Metamon core imports
    imports.push('import { signalManager, pubSubSystem } from \'@metamon/core\';');
    
    // Add user imports
    userImports.forEach(importLine => {
      if (!importLine.includes('react')) {
        imports.push(importLine);
      }
    });
    
    return imports.join('\n');
  }

  /**
   * Extract dependencies from import statements
   */
  private extractDependencies(imports: string[]): string[] {
    const dependencies: string[] = [];
    
    imports.forEach(importLine => {
      const match = importLine.match(/from\s+['"]([^'"]+)['"]/);
      if (match) {
        dependencies.push(match[1]);
      }
    });
    
    return dependencies;
  }

  /**
   * Get import name from file path
   */
  private getImportName(filePath: string): string {
    const fileName = filePath.split('/').pop()?.replace(/\.[^/.]+$/, '');
    return fileName ? fileName.charAt(0).toUpperCase() + fileName.slice(1) : 'Component';
  }
}