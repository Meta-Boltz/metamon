import * as yaml from 'yaml';
export class MTMFileParser {
    parse(content, filePath) {
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        if (!frontmatterMatch) {
            // No frontmatter found
            return {
                frontmatter: {},
                content: content,
                filePath,
                contentRange: { start: 0, end: content.length }
            };
        }
        const [, frontmatterText, bodyContent] = frontmatterMatch;
        const frontmatterStart = 4; // After "---\n"
        const frontmatterEnd = frontmatterStart + frontmatterText.length;
        const contentStart = frontmatterEnd + 5; // After "\n---\n"
        let frontmatter = {};
        try {
            frontmatter = yaml.parse(frontmatterText) || {};
        }
        catch (error) {
            throw new Error(`Invalid YAML in frontmatter: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        return {
            frontmatter,
            content: bodyContent,
            filePath,
            frontmatterRange: { start: frontmatterStart, end: frontmatterEnd },
            contentRange: { start: contentStart, end: content.length }
        };
    }
    getFrontmatterPosition(content, line, character) {
        const lines = content.split('\n');
        let inFrontmatter = false;
        let frontmatterStartLine = -1;
        let frontmatterEndLine = -1;
        for (let i = 0; i < lines.length; i++) {
            const lineContent = lines[i];
            if (i === 0 && lineContent === '---') {
                inFrontmatter = true;
                frontmatterStartLine = i;
            }
            else if (inFrontmatter && lineContent === '---') {
                frontmatterEndLine = i;
                break;
            }
        }
        if (frontmatterStartLine === -1 || frontmatterEndLine === -1) {
            return false;
        }
        return line > frontmatterStartLine && line < frontmatterEndLine;
    }
    getYamlPath(content, line, character) {
        const lines = content.split('\n');
        const frontmatterLines = [];
        let inFrontmatter = false;
        let frontmatterLineStart = -1;
        // Extract frontmatter lines
        for (let i = 0; i < lines.length; i++) {
            const lineContent = lines[i];
            if (i === 0 && lineContent === '---') {
                inFrontmatter = true;
                frontmatterLineStart = i + 1;
                continue;
            }
            else if (inFrontmatter && lineContent === '---') {
                break;
            }
            else if (inFrontmatter) {
                frontmatterLines.push(lineContent);
            }
        }
        if (!inFrontmatter || line < frontmatterLineStart) {
            return [];
        }
        const frontmatterLineIndex = line - frontmatterLineStart;
        if (frontmatterLineIndex >= frontmatterLines.length || frontmatterLineIndex < 0) {
            return [];
        }
        // Get the current line
        const currentLine = frontmatterLines[frontmatterLineIndex];
        let currentIndent = currentLine.match(/^\s*/)?.[0].length || 0;
        // Check if current line has a root-level key
        const currentKeyMatch = currentLine.match(/^\s*([^:\s-]+):/);
        if (currentKeyMatch && currentIndent === 0) {
            return [currentKeyMatch[1]];
        }
        // Look backwards to find parent keys
        const path = [];
        for (let i = frontmatterLineIndex; i >= 0; i--) {
            const prevLine = frontmatterLines[i];
            const prevIndent = prevLine.match(/^\s*/)?.[0].length || 0;
            // If we find a line with less indentation, it might be a parent
            if (prevIndent < currentIndent) {
                const keyMatch = prevLine.match(/^\s*([^:\s-]+):/);
                if (keyMatch) {
                    path.unshift(keyMatch[1]);
                    // Continue looking for more parents
                    currentIndent = prevIndent;
                    if (prevIndent === 0)
                        break; // Reached root level
                }
            }
        }
        return path;
    }
}
