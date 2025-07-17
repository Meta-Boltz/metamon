/**
 * Source map generation for linking generated code to original .mtm files
 */
export declare class MTMSourceMapGenerator {
    private generator;
    private originalContent;
    private generatedLines;
    constructor(originalFile: string, originalContent: string, generatedFile?: string);
    /**
     * Add mapping between original and generated code
     */
    addMapping(generatedLine: number, generatedColumn: number, originalLine: number, originalColumn: number, originalFile: string, name?: string): void;
    /**
     * Add generated line with automatic mapping
     */
    addGeneratedLine(generatedCode: string, originalLine: number, originalColumn: number | undefined, originalFile: string): void;
    /**
     * Generate source map string
     */
    generateSourceMap(): string;
    /**
     * Generate inline source map comment
     */
    generateInlineSourceMap(): string;
    /**
     * Get generated code with source map
     */
    getGeneratedCodeWithSourceMap(): {
        code: string;
        sourceMap: string;
    };
    /**
     * Create source map for MTM file compilation
     */
    static createForMTMCompilation(originalFile: string, originalContent: string, generatedCode: string, frontmatterLineCount?: number): MTMSourceMapGenerator;
    /**
     * Parse existing source map to find original location
     */
    static findOriginalLocation(sourceMapContent: string, generatedLine: number, generatedColumn: number): Promise<{
        source: string;
        line: number;
        column: number;
        name?: string;
    } | null>;
}
