import { SourceMapGenerator, SourceMapConsumer } from 'source-map';

/**
 * Source map generation for linking generated code to original .mtm files
 */
export class MTMSourceMapGenerator {
  private generator: SourceMapGenerator;
  private originalContent: string;
  private generatedLines: string[];

  constructor(
    originalFile: string,
    originalContent: string,
    generatedFile?: string
  ) {
    this.generator = new SourceMapGenerator({
      file: generatedFile || originalFile.replace('.mtm', '.js'),
      sourceRoot: ''
    });
    
    this.originalContent = originalContent;
    this.generatedLines = [];
    
    // Add original source content
    this.generator.setSourceContent(originalFile, originalContent);
  }

  /**
   * Add mapping between original and generated code
   */
  addMapping(
    generatedLine: number,
    generatedColumn: number,
    originalLine: number,
    originalColumn: number,
    originalFile: string,
    name?: string
  ): void {
    this.generator.addMapping({
      generated: {
        line: generatedLine,
        column: generatedColumn
      },
      original: {
        line: originalLine,
        column: originalColumn
      },
      source: originalFile,
      name
    });
  }

  /**
   * Add generated line with automatic mapping
   */
  addGeneratedLine(
    generatedCode: string,
    originalLine: number,
    originalColumn: number = 0,
    originalFile: string
  ): void {
    const generatedLineNumber = this.generatedLines.length + 1;
    this.generatedLines.push(generatedCode);
    
    this.addMapping(
      generatedLineNumber,
      0,
      originalLine,
      originalColumn,
      originalFile
    );
  }

  /**
   * Generate source map string
   */
  generateSourceMap(): string {
    return this.generator.toString();
  }

  /**
   * Generate inline source map comment
   */
  generateInlineSourceMap(): string {
    const sourceMap = this.generateSourceMap();
    const base64 = Buffer.from(sourceMap).toString('base64');
    return `//# sourceMappingURL=data:application/json;charset=utf-8;base64,${base64}`;
  }

  /**
   * Get generated code with source map
   */
  getGeneratedCodeWithSourceMap(): { code: string; sourceMap: string } {
    const code = this.generatedLines.join('\n');
    const sourceMap = this.generateSourceMap();
    
    return { code, sourceMap };
  }

  /**
   * Create source map for MTM file compilation
   */
  static createForMTMCompilation(
    originalFile: string,
    originalContent: string,
    generatedCode: string,
    frontmatterLineCount: number = 0
  ): MTMSourceMapGenerator {
    const generator = new MTMSourceMapGenerator(originalFile, originalContent);
    
    // Split generated code into lines
    const generatedLines = generatedCode.split('\n');
    const originalLines = originalContent.split('\n');
    
    // Find the start of actual component code (after frontmatter)
    let originalCodeStartLine = 0;
    let inFrontmatter = false;
    
    for (let i = 0; i < originalLines.length; i++) {
      const line = originalLines[i].trim();
      if (line === '---') {
        if (!inFrontmatter) {
          inFrontmatter = true;
        } else {
          originalCodeStartLine = i + 1;
          break;
        }
      }
    }
    
    // Map generated lines to original lines
    generatedLines.forEach((generatedLine, index) => {
      const originalLineIndex = originalCodeStartLine + index;
      if (originalLineIndex < originalLines.length) {
        generator.addMapping(
          index + 1,
          0,
          originalLineIndex + 1,
          0,
          originalFile
        );
      }
    });
    
    return generator;
  }

  /**
   * Parse existing source map to find original location
   */
  static async findOriginalLocation(
    sourceMapContent: string,
    generatedLine: number,
    generatedColumn: number
  ): Promise<{ source: string; line: number; column: number; name?: string } | null> {
    try {
      const consumer = await new SourceMapConsumer(sourceMapContent);
      const originalPosition = consumer.originalPositionFor({
        line: generatedLine,
        column: generatedColumn
      });
      
      consumer.destroy();
      
      if (originalPosition.source) {
        return {
          source: originalPosition.source,
          line: originalPosition.line || 0,
          column: originalPosition.column || 0,
          name: originalPosition.name || undefined
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing source map:', error);
      return null;
    }
  }
}