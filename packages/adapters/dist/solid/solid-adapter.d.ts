import { CompilationResult, Channel, MTMFile } from '@metamon/core';
import { FrameworkAdapter } from '../base/framework-adapter.js';
/**
 * Solid framework adapter for compiling .mtm files to Solid components
 */
export declare class SolidAdapter implements FrameworkAdapter {
    readonly name = "solid";
    readonly fileExtension = ".jsx";
    /**
     * Compile MTM file content to Solid component
     */
    compile(mtmFile: MTMFile): CompilationResult;
    /**
     * Generate imports for Solid components
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
     * Setup signal integration for Solid components using native Solid signals
     */
    setupSignalIntegration(): string;
    /**
     * Setup pub/sub integration for Solid components
     */
    setupPubSubIntegration(channels: Channel[]): string;
    /**
     * Parse content to extract imports and component code
     */
    private parseContent;
    /**
     * Generate Solid-specific imports including runtime functions
     */
    private generateSolidImports;
    /**
     * Extract dependencies from import statements
     */
    private extractDependencies;
    /**
     * Get import name from file path
     */
    private getImportName;
}
