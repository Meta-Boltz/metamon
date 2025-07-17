import { CompilationResult, Channel, MTMFile } from '@metamon/core';
import { FrameworkAdapter } from '../base/framework-adapter.js';
/**
 * React framework adapter for compiling .mtm files to React components
 */
export declare class ReactAdapter implements FrameworkAdapter {
    readonly name = "reactjs";
    readonly fileExtension = ".jsx";
    /**
     * Compile MTM file content to React component
     */
    compile(mtmFile: MTMFile): CompilationResult;
    /**
     * Generate imports for React components
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
     * Setup signal integration hooks for React
     */
    setupSignalIntegration(): string;
    /**
     * Setup pub/sub integration for React components
     */
    setupPubSubIntegration(channels: Channel[]): string;
    /**
     * Parse content to extract imports and component code
     */
    private parseContent;
    /**
     * Generate React-specific imports including runtime hooks
     */
    private generateReactImports;
    /**
     * Extract dependencies from import statements
     */
    private extractDependencies;
    /**
     * Get import name from file path
     */
    private getImportName;
}
