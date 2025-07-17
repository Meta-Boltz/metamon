import { CompilationError } from '@metamon/core';
/**
 * Svelte framework adapter for compiling .mtm files to Svelte components
 */
export class SvelteAdapter {
    constructor() {
        this.name = 'svelte';
        this.fileExtension = '.svelte';
    }
    /**
     * Compile MTM file content to Svelte component
     */
    compile(mtmFile) {
        try {
            const { frontmatter, content, filePath } = mtmFile;
            if (frontmatter.target !== 'svelte') {
                throw new Error(`Invalid target framework: ${frontmatter.target}. Expected 'svelte'`);
            }
            // Extract imports and component code
            const { imports, componentCode } = this.parseContent(content);
            // Generate Svelte-specific imports
            const svelteImports = this.generateSvelteImports(imports, frontmatter.channels || []);
            // Wrap component with runtime integration
            const wrappedComponent = this.wrapWithRuntime(componentCode, frontmatter.channels || []);
            // Combine imports and component
            const finalCode = `${svelteImports}\n\n${wrappedComponent}`;
            return {
                code: finalCode,
                dependencies: this.extractDependencies(imports),
                exports: ['default'],
                sourceMap: undefined // TODO: Implement source maps in future task
            };
        }
        catch (error) {
            throw CompilationError.framework(error instanceof Error ? error.message : 'Unknown compilation error', mtmFile.filePath, 'Svelte', error instanceof Error ? error : undefined);
        }
    }
    /**
     * Generate imports for Svelte components
     */
    generateImports(dependencies) {
        const imports = ['import { onMount, onDestroy } from \'svelte\';'];
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
        return `import { onMount, onDestroy } from 'svelte';
import { pubSubSystem } from '@metamon/core';

${component}`;
    }
    /**
     * Setup signal integration for Svelte components using Svelte stores
     */
    setupSignalIntegration() {
        return `import { writable, derived } from 'svelte/store';
import { onMount, onDestroy } from 'svelte';
import { signalManager } from '@metamon/core';

/**
 * Svelte function for using Metamon signals with Svelte stores
 */
export function useSignal(initialValue, key) {
  const store = writable(initialValue);
  let signal = null;
  let unsubscribe = null;
  
  // Initialize signal and sync with store
  onMount(() => {
    if (key) {
      signal = signalManager.getSignal(key) || signalManager.createSignal(initialValue, key);
    } else {
      signal = signalManager.createSignal(initialValue);
    }
    
    // Sync initial value
    store.set(signal.value);
    
    // Subscribe to signal changes and update store
    unsubscribe = signal.subscribe((newValue) => {
      store.set(newValue);
    });
  });
  
  // Cleanup on component destroy
  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
    if (!key && signal) {
      // Only destroy unnamed signals
      signal.destroy?.();
    }
  });
  
  const updateSignal = (newValue) => {
    if (signal) {
      signal.update(newValue);
    }
  };
  
  return [store, updateSignal];
}

/**
 * Svelte function for using named Metamon signals
 */
export function useMetamonSignal(key, initialValue) {
  return useSignal(initialValue, key);
}

/**
 * Create a Svelte store that syncs with a Metamon signal
 */
export function createMetamonStore(initialValue, key) {
  let metamonSignal;
  
  if (key) {
    metamonSignal = signalManager.getSignal(key) || signalManager.createSignal(initialValue, key);
  } else {
    metamonSignal = signalManager.createSignal(initialValue);
  }
  
  // Create Svelte writable store
  const store = writable(metamonSignal.value);
  
  // Sync Metamon signal changes to Svelte store
  const unsubscribe = metamonSignal.subscribe((newValue) => {
    store.set(newValue);
  });
  
  // Enhanced store with Metamon integration
  const enhancedStore = {
    subscribe: store.subscribe,
    set: (value) => {
      metamonSignal.update(value);
      store.set(value);
    },
    update: (updater) => {
      const currentValue = metamonSignal.value;
      const newValue = updater(currentValue);
      metamonSignal.update(newValue);
      store.set(newValue);
    },
    destroy: () => {
      unsubscribe();
      if (!key) {
        metamonSignal.destroy?.();
      }
    }
  };
  
  return enhancedStore;
}`;
    }
    /**
     * Setup pub/sub integration for Svelte components
     */
    setupPubSubIntegration(channels) {
        if (channels.length === 0) {
            return '';
        }
        const eventHandlers = channels.map(channel => `const ${channel.emit} = (payload) => {
    pubSubSystem.emit('${channel.event}', payload);
  };`).join('\n  ');
        const subscriptions = channels.map(channel => `onMount(() => {
    const componentId = Math.random().toString(36).substr(2, 9);
    
    pubSubSystem.subscribe('${channel.event}', (payload) => {
      // Event received: ${channel.event}
      console.log('Received event ${channel.event}:', payload);
    }, componentId);
    
    onDestroy(() => {
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
     * Generate Svelte-specific imports including runtime functions
     */
    generateSvelteImports(userImports, channels) {
        const imports = [];
        // Add Svelte primitives based on usage
        const sveltePrimitives = ['onMount', 'onDestroy'];
        const svelteStores = ['writable', 'derived'];
        imports.push(`import { ${sveltePrimitives.join(', ')} } from 'svelte';`);
        imports.push(`import { ${svelteStores.join(', ')} } from 'svelte/store';`);
        // Add Metamon core imports
        imports.push('import { signalManager, pubSubSystem } from \'@metamon/core\';');
        // Add user imports (preserve all user imports, including Svelte ones)
        userImports.forEach(importLine => {
            imports.push(importLine);
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
