import { CompilationResult, Channel, MTMFile } from '@metamon/core';
import { FrameworkAdapter } from '../base/framework-adapter.js';
/**
 * Svelte framework adapter for compiling .mtm files to Svelte components
 */
export declare class SvelteAdapter implements FrameworkAdapter {
    readonly name = "svelte";
    readonly fileExtension = ".svelte";
    /**
     * Compile MTM file content to Svelte component
     */
    compile(mtmFile: MTMFile): CompilationResult;
    /**
     * Generate imports for Svelte components
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
     * Setup signal integration for Svelte components using Svelte stores
     */
    setupSignalIntegration(): string;
    /**
     * Setup pub/sub integration for Svelte components
     */
    setupPubSubIntegration(channels: Channel[]): string;
    /**
     * Parse content to extract imports and component code
     */
    private parseContent;
    /**
     * Generate Svelte-specific imports including runtime functions
     */
    private generateSvelteImports;
    /**
     * Extract dependencies from import statements
     */
    private extractDependencies;
    /**
     * Get import name from file path
     */
    private getImportName;
}
