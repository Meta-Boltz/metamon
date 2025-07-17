import { CompilationResult, Channel, MTMFile } from '@metamon/core';
import { FrameworkAdapter } from '../base/framework-adapter.js';
/**
 * Vue framework adapter for compiling .mtm files to Vue components
 */
export declare class VueAdapter implements FrameworkAdapter {
    readonly name = "vue";
    readonly fileExtension = ".vue";
    /**
     * Compile MTM file content to Vue component
     */
    compile(mtmFile: MTMFile): CompilationResult;
    /**
     * Generate imports for Vue components
     */
    generateImports(dependencies: string[]): string;
    /**
     * Wrap component with runtime integration for signals and pub/sub
     */
    wrapWithRuntime(component: string, channels: Channel[]): string;
    /**
     * Inject runtime code into component
     */
    injectRuntime(component: string): string;
    /**
     * Setup signal integration composables for Vue
     */
    setupSignalIntegration(): string;
    /**
     * Setup pub/sub integration for Vue components
     */
    setupPubSubIntegration(channels: Channel[]): string;
    /**
     * Parse content to extract imports and component code
     */
    private parseContent;
    /**
     * Generate Vue-specific imports including runtime composables
     */
    private generateVueImports;
    /**
     * Extract dependencies from import statements
     */
    private extractDependencies;
    /**
     * Get import name from file path
     */
    private getImportName;
}
