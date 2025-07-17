/**
 * Represents a parsed .mtm file with frontmatter and content
 */
export interface MTMFile {
  frontmatter: {
    target: 'reactjs' | 'vue' | 'solid' | 'svelte';
    channels?: Array<{
      event: string;
      emit: string;
    }>;
    route?: string;
    layout?: string;
  };
  content: string;
  filePath: string;
}

/**
 * Result of frontmatter validation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Interface for parsing .mtm files
 */
export interface FileParser {
  parse(filePath: string): MTMFile;
  validate(frontmatter: any): ValidationResult;
}