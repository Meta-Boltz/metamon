import * as fs from 'fs/promises';
/**
 * Tree-shaking optimizer for Metamon bundles
 */
export class TreeShaker {
    constructor(config) {
        this.usedFeatures = new Set();
        this.usedAdapters = new Set();
        this.usedComponents = new Set();
        this.config = config;
    }
    /**
     * Analyze and optimize bundle by removing unused code
     */
    async optimize(bundlePath, dependencyGraph) {
        const originalContent = await fs.readFile(bundlePath, 'utf-8');
        const originalSize = Buffer.byteLength(originalContent, 'utf-8');
        // Analyze usage patterns
        await this.analyzeUsage(dependencyGraph);
        // Apply tree-shaking optimizations
        let optimizedContent = originalContent;
        const removedFeatures = [];
        const warnings = [];
        if (this.config.runtime) {
            const runtimeResult = this.shakeRuntimeFeatures(optimizedContent);
            optimizedContent = runtimeResult.code;
            removedFeatures.push(...runtimeResult.removed);
            warnings.push(...runtimeResult.warnings);
        }
        if (this.config.adapters) {
            const adapterResult = this.shakeFrameworkAdapters(optimizedContent);
            optimizedContent = adapterResult.code;
            removedFeatures.push(...adapterResult.removed);
            warnings.push(...adapterResult.warnings);
        }
        if (this.config.components) {
            const componentResult = this.shakeUnusedComponents(optimizedContent);
            optimizedContent = componentResult.code;
            removedFeatures.push(...componentResult.removed);
            warnings.push(...componentResult.warnings);
        }
        // Apply dead code elimination
        optimizedContent = this.eliminateDeadCode(optimizedContent);
        // Write optimized bundle
        await fs.writeFile(bundlePath, optimizedContent);
        const optimizedSize = Buffer.byteLength(optimizedContent, 'utf-8');
        const bytesSaved = originalSize - optimizedSize;
        const reductionPercentage = (bytesSaved / originalSize) * 100;
        return {
            originalSize,
            optimizedSize,
            bytesSaved,
            reductionPercentage,
            removedFeatures,
            warnings
        };
    }
    /**
     * Analyze which features are actually used in the dependency graph
     */
    async analyzeUsage(dependencyGraph) {
        this.usedFeatures.clear();
        this.usedAdapters.clear();
        this.usedComponents.clear();
        for (const [filePath, fileInfo] of dependencyGraph.files) {
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                // Analyze runtime feature usage
                this.analyzeRuntimeUsage(content);
                // Track used framework adapters
                this.usedAdapters.add(fileInfo.framework);
                // Track component dependencies
                fileInfo.dependencies.forEach(dep => {
                    if (dep.importee.endsWith('.mtm')) {
                        this.usedComponents.add(dep.importee);
                    }
                });
            }
            catch (error) {
                console.warn(`Failed to analyze ${filePath}: ${error}`);
            }
        }
    }
    /**
     * Analyze runtime feature usage in code
     */
    analyzeRuntimeUsage(code) {
        const runtimeFeatures = [
            'MetamonPubSub',
            'SignalManager',
            'MetamonRouter',
            'useSignal',
            'useMetamonSignal',
            'createSignal',
            'subscribe',
            'emit',
            'navigate',
            'onRouteChange'
        ];
        runtimeFeatures.forEach(feature => {
            if (code.includes(feature)) {
                this.usedFeatures.add(feature);
            }
        });
    }
    /**
     * Remove unused runtime features
     */
    shakeRuntimeFeatures(code) {
        const removed = [];
        const warnings = [];
        let optimizedCode = code;
        const runtimeFeatures = {
            'MetamonPubSub': {
                pattern: /class MetamonPubSub[\s\S]*?^}/gm,
                dependencies: ['subscribe', 'emit']
            },
            'SignalManager': {
                pattern: /class SignalManager[\s\S]*?^}/gm,
                dependencies: ['createSignal', 'useSignal']
            },
            'MetamonRouter': {
                pattern: /class MetamonRouter[\s\S]*?^}/gm,
                dependencies: ['navigate', 'onRouteChange']
            }
        };
        Object.entries(runtimeFeatures).forEach(([feature, config]) => {
            const isUsed = this.usedFeatures.has(feature) ||
                config.dependencies.some(dep => this.usedFeatures.has(dep));
            if (!isUsed && !this.config.preserve.includes(feature)) {
                optimizedCode = optimizedCode.replace(config.pattern, '');
                removed.push(feature);
                if (this.config.aggressive) {
                    // Also remove related utility functions
                    const utilPattern = new RegExp(`function.*${feature}.*\\{[\\s\\S]*?^\\}`, 'gm');
                    optimizedCode = optimizedCode.replace(utilPattern, '');
                }
            }
        });
        return { code: optimizedCode, removed, warnings };
    }
    /**
     * Remove unused framework adapters
     */
    shakeFrameworkAdapters(code) {
        const removed = [];
        const warnings = [];
        let optimizedCode = code;
        const adapters = ['ReactAdapter', 'VueAdapter', 'SolidAdapter', 'SvelteAdapter'];
        const frameworks = ['reactjs', 'vue', 'solid', 'svelte'];
        adapters.forEach((adapter, index) => {
            const framework = frameworks[index];
            if (!this.usedAdapters.has(framework) && !this.config.preserve.includes(adapter)) {
                // Remove adapter class
                const adapterPattern = new RegExp(`class ${adapter}[\\s\\S]*?^}`, 'gm');
                optimizedCode = optimizedCode.replace(adapterPattern, '');
                // Remove adapter imports
                const importPattern = new RegExp(`import.*${adapter}.*from.*`, 'g');
                optimizedCode = optimizedCode.replace(importPattern, '');
                // Remove from adapter registry
                const registryPattern = new RegExp(`${framework}:\\s*new\\s+${adapter}\\(\\),?`, 'g');
                optimizedCode = optimizedCode.replace(registryPattern, '');
                removed.push(adapter);
            }
        });
        return { code: optimizedCode, removed, warnings };
    }
    /**
     * Remove unused component imports and definitions
     */
    shakeUnusedComponents(code) {
        const removed = [];
        const warnings = [];
        let optimizedCode = code;
        // Find all component imports
        const importRegex = /import\s+.*from\s+['"]([^'"]*\.mtm)['"]/g;
        let match;
        while ((match = importRegex.exec(code)) !== null) {
            const componentPath = match[1];
            if (!this.usedComponents.has(componentPath) && !this.config.preserve.includes(componentPath)) {
                // Remove the import statement
                optimizedCode = optimizedCode.replace(match[0], '');
                removed.push(componentPath);
                if (this.config.aggressive) {
                    // Try to remove unused component definitions
                    const componentName = this.extractComponentName(match[0]);
                    if (componentName) {
                        const usagePattern = new RegExp(`\\b${componentName}\\b`, 'g');
                        const usageCount = (optimizedCode.match(usagePattern) || []).length;
                        if (usageCount <= 1) { // Only the import statement
                            warnings.push(`Removed potentially unused component: ${componentName}`);
                        }
                    }
                }
            }
        }
        return { code: optimizedCode, removed, warnings };
    }
    /**
     * Extract component name from import statement
     */
    extractComponentName(importStatement) {
        const match = importStatement.match(/import\s+(\w+)/);
        return match ? match[1] : null;
    }
    /**
     * Eliminate dead code (unreachable code, unused variables, etc.)
     */
    eliminateDeadCode(code) {
        let optimizedCode = code;
        // Remove empty lines and excessive whitespace
        optimizedCode = optimizedCode.replace(/^\s*[\r\n]/gm, '');
        optimizedCode = optimizedCode.replace(/\n\s*\n\s*\n/g, '\n\n');
        // Remove unused variable declarations (simple heuristic)
        if (this.config.aggressive) {
            // Remove variables that are declared but never used
            const varPattern = /(?:const|let|var)\s+(\w+)\s*=.*?;/g;
            let varMatch;
            while ((varMatch = varPattern.exec(optimizedCode)) !== null) {
                const varName = varMatch[1];
                const usagePattern = new RegExp(`\\b${varName}\\b`, 'g');
                const usageCount = (optimizedCode.match(usagePattern) || []).length;
                // If variable is only used in its declaration, it might be unused
                if (usageCount === 1) {
                    optimizedCode = optimizedCode.replace(varMatch[0], '');
                }
            }
        }
        // Remove unreachable code after return statements
        optimizedCode = optimizedCode.replace(/return\s+[^;]+;[\s\S]*?(?=\n\s*})/g, (match) => {
            return match.split('\n')[0];
        });
        return optimizedCode;
    }
    /**
     * Get tree-shaking statistics for analysis
     */
    getStatistics() {
        return {
            usedFeatures: Array.from(this.usedFeatures),
            usedAdapters: Array.from(this.usedAdapters),
            usedComponents: Array.from(this.usedComponents)
        };
    }
}
