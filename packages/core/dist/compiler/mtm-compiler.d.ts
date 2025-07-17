/**
 * MTM Compiler - Compiles .mtm files to framework-specific components
 */
export interface MTMFrontmatter {
    target: 'reactjs' | 'vue' | 'solid' | 'svelte';
    channels?: Array<{
        event: string;
        emit: string;
    }>;
    props?: Record<string, string>;
    styles?: string[];
}
export interface MTMFile {
    frontmatter: MTMFrontmatter;
    content: string;
    filePath: string;
}
export interface CompilationResult {
    code: string;
    framework: string;
    dependencies: string[];
    exports: string[];
}
/**
 * Parses .mtm files and extracts frontmatter + content
 */
export declare class MTMParser {
    static parse(content: string, filePath: string): MTMFile;
    private static validateFrontmatter;
}
/**
 * Compiles .mtm files to framework-specific components
 */
export declare class MTMCompiler {
    private adapters;
    constructor();
    compile(mtmFile: MTMFile): CompilationResult;
}
