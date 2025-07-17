import { CompilationError } from '@metamon/core';
/**
 * Solid framework adapter for compiling .mtm files to Solid components
 */
export class SolidAdapter {
    constructor() {
        this.name = 'solid';
        this.fileExtension = '.jsx';
    }
    /**
     * Compile MTM file content to Solid component
     */
    compile(mtmFile) {
        try {
            const { frontmatter, content, filePath } = mtmFile;
            if (frontmatter.target !== 'solid') {
                throw new Error(`Invalid target framework: ${frontmatter.target}. Expected 'solid'`);
            }
            // Extract imports and component code
            const { imports, componentCode } = this.parseContent(content);
            // Generate Solid-specific imports
            const solidImports = this.generateSolidImports(imports, frontmatter.channels || []);
            // Wrap component with runtime integration
            const wrappedComponent = this.wrapWithRuntime(componentCode, frontmatter.channels || []);
            // Combine imports and component
            const finalCode = `${solidImports}\n\n${wrappedComponent}`;
            return {
                code: finalCode,
                dependencies: this.extractDependencies(imports),
                exports: ['default'],
                sourceMap: undefined // TODO: Implement source maps in future task
            };
        }
        catch (error) {
            throw CompilationError.framework(error instanceof Error ? error.message : 'Unknown compilation error', mtmFile.filePath, 'Solid', error instanceof Error ? error : undefined);
        }
    }
    /**
     * Generate imports for Solid components
     */
    generateImports(dependencies) {
        const imports = ['import { createSignal, createEffect, onCleanup } from \'solid-js\';'];
        dependencies.forEach(dep => {
            if (dep.startsWith('./') || dep.startsWith('../')) {
                imports.push(`import ${this.getImportName(dep)} from '${dep}';`);
            }
            else {
                imports.push(`import ${dep} from '${dep}';`);
            }
        });
        return imports.join('\n');
    }
    /**
     * Wrap component with runtime integration for signals and pub/sub
     */
    wrapWithRuntime(component, channels) {
        const signalIntegration = this.setupSignalIntegration();
        const pubSubIntegration = this.setupPubSubIntegration(channels);
        return `${signalIntegration}

${pubSubIntegration}

${component}`;
    }
    /**
     * Inject runtime code into component
     */
    injectRuntime(component) {
        return `import { createEffect, onCleanup } from 'solid-js';
import { pubSubSystem } from '@metamon/core';

${component}`;
    }
    /**
     * Setup signal integration for Solid components using native Solid signals
     */
    setupSignalIntegration() {
        return `import { createSignal, createEffect, onCleanup } from 'solid-js';
import { signalManager } from '@metamon/core';

/**
 * Solid function for using Metamon signals with native Solid reactivity
 */
export function useSignal(initialValue, key) {
  const [value, setValue] = createSignal(initialValue);
  let signal = null;
  
  // Initialize signal on component creation
  if (key) {
    signal = signalManager.getSignal(key) || signalManager.createSignal(initialValue, key);
  } else {
    signal = signalManager.createSignal(initialValue);
  }
  
  // Sync initial value
  setValue(signal.value);
  
  // Subscribe to signal changes
  const unsubscribe = signal.subscribe((newValue) => {
    setValue(newValue);
  });
  
  // Cleanup on component disposal
  onCleanup(() => {
    unsubscribe();
    if (!key) {
      // Only destroy unnamed signals
      signal.destroy?.();
    }
  });
  
  const updateSignal = (newValue) => {
    if (signal) {
      signal.update(newValue);
    }
  };
  
  return [value, updateSignal];
}

/**
 * Solid function for using named Metamon signals
 */
export function useMetamonSignal(key, initialValue) {
  return useSignal(initialValue, key);
}

/**
 * Create a Solid signal that syncs with a Metamon signal for optimal performance
 */
export function createMetamonSignal(initialValue, key) {
  let metamonSignal;
  
  if (key) {
    metamonSignal = signalManager.getSignal(key) || signalManager.createSignal(initialValue, key);
  } else {
    metamonSignal = signalManager.createSignal(initialValue);
  }
  
  // Create native Solid signal
  const [value, setValue] = createSignal(metamonSignal.value);
  
  // Sync Metamon signal changes to Solid signal
  const unsubscribe = metamonSignal.subscribe((newValue) => {
    setValue(newValue);
  });
  
  // Cleanup
  onCleanup(() => {
    unsubscribe();
    if (!key) {
      metamonSignal.destroy?.();
    }
  });
  
  // Return Solid-style accessor and setter that updates both signals
  const setSignal = (newValue) => {
    metamonSignal.update(newValue);
    setValue(newValue);
  };
  
  return [value, setSignal];
}`;
    }
    /**
     * Setup pub/sub integration for Solid components
     */
    setupPubSubIntegration(channels) {
        if (channels.length === 0) {
            return '';
        }
        const eventHandlers = channels.map(channel => `const ${channel.emit} = (payload) => {
    pubSubSystem.emit('${channel.event}', payload);
  };`).join('\n  ');
        const subscriptions = channels.map(channel => `createEffect(() => {
    const componentId = Math.random().toString(36).substr(2, 9);
    
    pubSubSystem.subscribe('${channel.event}', (payload) => {
      // Event received: ${channel.event}
      console.log('Received event ${channel.event}:', payload);
    }, componentId);
    
    onCleanup(() => {
      pubSubSystem.cleanup(componentId);
    });
  });`).join('\n  ');
        return `import { pubSubSystem } from '@metamon/core';

// Event handlers
${eventHandlers}

// Event subscriptions
${subscriptions}`;
    }
    /**
     * Parse content to extract imports and component code
     */
    parseContent(content) {
        const lines = content.split('\n');
        const imports = [];
        const componentLines = [];
        let inImportSection = true;
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('import ') && inImportSection) {
                imports.push(trimmedLine);
            }
            else if (trimmedLine === '' && inImportSection) {
                // Skip empty lines in import section
                continue;
            }
            else {
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
     * Generate Solid-specific imports including runtime functions
     */
    generateSolidImports(userImports, channels) {
        const imports = [];
        // Add Solid primitives based on usage
        const solidPrimitives = ['createSignal', 'createEffect', 'onCleanup'];
        imports.push(`import { ${solidPrimitives.join(', ')} } from 'solid-js';`);
        // Add Metamon core imports
        imports.push('import { signalManager, pubSubSystem } from \'@metamon/core\';');
        // Add user imports
        userImports.forEach(importLine => {
            if (!importLine.includes('solid-js')) {
                imports.push(importLine);
            }
        });
        return imports.join('\n');
    }
    /**
     * Extract dependencies from import statements
     */
    extractDependencies(imports) {
        const dependencies = [];
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
    getImportName(filePath) {
        const fileName = filePath.split('/').pop()?.replace(/\.[^/.]+$/, '');
        return fileName ? fileName.charAt(0).toUpperCase() + fileName.slice(1) : 'Component';
    }
}
