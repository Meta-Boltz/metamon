import { CompilationError } from '@metamon/core';
/**
 * Vue framework adapter for compiling .mtm files to Vue components
 */
export class VueAdapter {
    constructor() {
        this.name = 'vue';
        this.fileExtension = '.vue';
    }
    /**
     * Compile MTM file content to Vue component
     */
    compile(mtmFile) {
        try {
            const { frontmatter, content, filePath } = mtmFile;
            if (frontmatter.target !== 'vue') {
                throw new Error(`Invalid target framework: ${frontmatter.target}. Expected 'vue'`);
            }
            // Extract imports and component code
            const { imports, componentCode } = this.parseContent(content);
            // Generate Vue-specific imports
            const vueImports = this.generateVueImports(imports, frontmatter.channels || []);
            // Wrap component with runtime integration
            const wrappedComponent = this.wrapWithRuntime(componentCode, frontmatter.channels || []);
            // Combine imports and component
            const finalCode = `${vueImports}\n\n${wrappedComponent}`;
            return {
                code: finalCode,
                dependencies: this.extractDependencies(imports),
                exports: ['default'],
                sourceMap: undefined // TODO: Implement source maps in future task
            };
        }
        catch (error) {
            throw CompilationError.framework(error instanceof Error ? error.message : 'Unknown compilation error', mtmFile.filePath, 'Vue', error instanceof Error ? error : undefined);
        }
    }
    /**
     * Generate imports for Vue components
     */
    generateImports(dependencies) {
        const imports = ['import { defineComponent } from \'vue\';'];
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
        return `import { onMounted, onUnmounted } from 'vue';
import { pubSubSystem } from '@metamon/core';

${component}`;
    }
    /**
     * Setup signal integration composables for Vue
     */
    setupSignalIntegration() {
        return `import { ref, onMounted, onUnmounted, computed } from 'vue';
import { signalManager } from '@metamon/core';

/**
 * Vue composable for using Metamon signals
 */
export function useSignal(initialValue, key) {
  const value = ref(initialValue);
  let signal = null;
  let unsubscribe = null;
  
  onMounted(() => {
    if (key) {
      signal = signalManager.getSignal(key) || signalManager.createSignal(initialValue, key);
    } else {
      signal = signalManager.createSignal(initialValue);
    }
    
    value.value = signal.value;
    
    unsubscribe = signal.subscribe((newValue) => {
      value.value = newValue;
    });
  });
  
  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe();
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
 * Vue composable for using named Metamon signals
 */
export function useMetamonSignal(key, initialValue) {
  return useSignal(initialValue, key);
}`;
    }
    /**
     * Setup pub/sub integration for Vue components
     */
    setupPubSubIntegration(channels) {
        if (channels.length === 0) {
            return '';
        }
        const eventHandlers = channels.map(channel => `const ${channel.emit} = (payload) => {
    pubSubSystem.emit('${channel.event}', payload);
  };`).join('\n  ');
        const subscriptions = channels.map(channel => `onMounted(() => {
    const componentId = Math.random().toString(36).substr(2, 9);
    
    pubSubSystem.subscribe('${channel.event}', (payload) => {
      // Event received: ${channel.event}
      console.log('Received event ${channel.event}:', payload);
    }, componentId);
    
    onUnmounted(() => {
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
     * Generate Vue-specific imports including runtime composables
     */
    generateVueImports(userImports, channels) {
        const imports = ['import { defineComponent } from \'vue\';'];
        // Add Vue composables based on usage
        const vueComposables = ['ref', 'onMounted', 'onUnmounted', 'computed'];
        imports.push(`import { ${vueComposables.join(', ')} } from 'vue';`);
        // Add Metamon core imports
        imports.push('import { signalManager, pubSubSystem } from \'@metamon/core\';');
        // Add user imports
        userImports.forEach(importLine => {
            if (!importLine.includes('vue')) {
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
