import type { MTMFile, ValidationResult, FileParser } from '../types/mtm-file.js';
/**
 * Parser for .mtm files that extracts YAML frontmatter and component content
 */
export declare class MTMParser implements FileParser {
    private static readonly FRONTMATTER_DELIMITER;
    private static readonly SUPPORTED_TARGETS;
    /**
     * Parse a .mtm file and extract frontmatter and content
     */
    parse(filePath: string): MTMFile;
    /**
     * Validate frontmatter configuration
     */
    validate(frontmatter: any): ValidationResult;
    /**
     * Extract frontmatter and content from file content
     */
    private extractFrontmatter;
}
