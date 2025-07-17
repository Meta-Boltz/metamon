/**
 * Debug session for tracking compilation process
 */
export class DebugSession {
    constructor(file) {
        this.file = file;
        this.steps = [];
        this.startTime = Date.now();
    }
    /**
     * Start tracking a compilation phase
     */
    startPhase(phase) {
        this.currentStep = {
            phase,
            startTime: Date.now()
        };
    }
    /**
     * End current phase with success
     */
    endPhase(metadata) {
        if (!this.currentStep)
            return;
        const duration = Date.now() - this.currentStep.startTime;
        this.steps.push({
            timestamp: this.currentStep.startTime,
            file: this.file,
            phase: this.currentStep.phase,
            duration,
            success: true,
            metadata
        });
        this.currentStep = undefined;
    }
    /**
     * End current phase with error
     */
    endPhaseWithError(error, metadata) {
        if (!this.currentStep)
            return;
        const duration = Date.now() - this.currentStep.startTime;
        this.steps.push({
            timestamp: this.currentStep.startTime,
            file: this.file,
            phase: this.currentStep.phase,
            duration,
            success: false,
            error,
            metadata
        });
        this.currentStep = undefined;
    }
    /**
     * Get debug summary
     */
    getSummary() {
        const totalDuration = Date.now() - this.startTime;
        const errors = this.steps
            .filter(step => !step.success && step.error)
            .map(step => step.error);
        return {
            file: this.file,
            totalDuration,
            steps: this.steps,
            success: errors.length === 0,
            errors
        };
    }
}
/**
 * Debug tools for MTM compilation process
 */
export class DebugTools {
    /**
     * Enable global debugging
     */
    static enableDebug() {
        DebugTools.globalDebugEnabled = true;
    }
    /**
     * Disable global debugging
     */
    static disableDebug() {
        DebugTools.globalDebugEnabled = false;
    }
    /**
     * Check if debugging is enabled
     */
    static isDebugEnabled() {
        return DebugTools.globalDebugEnabled || process.env.MTM_DEBUG === 'true';
    }
    /**
     * Start debug session for file
     */
    static startSession(file) {
        const session = new DebugSession(file);
        DebugTools.sessions.set(file, session);
        return session;
    }
    /**
     * Get debug session for file
     */
    static getSession(file) {
        return DebugTools.sessions.get(file);
    }
    /**
     * End debug session and get summary
     */
    static endSession(file) {
        const session = DebugTools.sessions.get(file);
        if (!session)
            return undefined;
        const summary = session.getSummary();
        DebugTools.sessions.delete(file);
        if (DebugTools.isDebugEnabled()) {
            console.log(DebugTools.formatDebugSummary(summary));
        }
        return summary;
    }
    /**
     * Format debug summary for console output
     */
    static formatDebugSummary(summary) {
        const lines = [];
        lines.push(`\n🔍 DEBUG SUMMARY: ${summary.file}`);
        lines.push(`⏱️  Total Duration: ${summary.totalDuration}ms`);
        lines.push(`${summary.success ? '✅' : '❌'} Status: ${summary.success ? 'SUCCESS' : 'FAILED'}`);
        if (summary.errors.length > 0) {
            lines.push(`\n🚨 Errors (${summary.errors.length}):`);
            summary.errors.forEach((error, index) => {
                lines.push(`   ${index + 1}. [${error.type}] ${error.message}`);
            });
        }
        lines.push(`\n📋 Compilation Steps:`);
        summary.steps.forEach((step, index) => {
            const status = step.success ? '✅' : '❌';
            const duration = `${step.duration}ms`;
            lines.push(`   ${index + 1}. ${status} ${step.phase} (${duration})`);
            if (step.metadata) {
                Object.entries(step.metadata).forEach(([key, value]) => {
                    lines.push(`      ${key}: ${JSON.stringify(value)}`);
                });
            }
        });
        lines.push('');
        return lines.join('\n');
    }
    /**
     * Validate MTM file structure and report issues
     */
    static validateMTMStructure(mtmFile) {
        const warnings = [];
        const suggestions = [];
        // Check frontmatter completeness
        if (!mtmFile.frontmatter.target) {
            warnings.push('Missing target framework in frontmatter');
            suggestions.push('Add target: "reactjs" | "vue" | "solid" | "svelte" to frontmatter');
        }
        // Check for common issues
        if (mtmFile.content.trim().length === 0) {
            warnings.push('Empty component content');
            suggestions.push('Add component implementation after frontmatter');
        }
        // Check channel configuration
        if (mtmFile.frontmatter.channels) {
            mtmFile.frontmatter.channels.forEach((channel, index) => {
                if (!channel.event || !channel.emit) {
                    warnings.push(`Incomplete channel configuration at index ${index}`);
                    suggestions.push('Ensure each channel has both "event" and "emit" properties');
                }
            });
        }
        // Check for potential framework mismatches
        const content = mtmFile.content.toLowerCase();
        const target = mtmFile.frontmatter.target;
        // Check for React - look for React imports, JSX syntax, or React-specific patterns
        // JSX typically appears in return statements or as direct elements
        const hasJSXSyntax = content.includes('return <') ||
            content.includes('react.createelement') ||
            content.includes('jsx');
        if (target === 'reactjs' &&
            !content.includes('react') &&
            !hasJSXSyntax &&
            !content.includes('usestate') &&
            !content.includes('useeffect')) {
            warnings.push('Target is React but no React imports found');
            suggestions.push('Add React import or verify target framework');
        }
        // Check for Vue - look for Vue imports, template syntax, or Vue-specific patterns
        if (target === 'vue' &&
            !content.includes('vue') &&
            !content.includes('template') &&
            !content.includes('v-') && // Vue directives
            !content.includes('{{')) { // Vue interpolation
            warnings.push('Target is Vue but no Vue-specific syntax found');
            suggestions.push('Add Vue imports or verify target framework');
        }
        return {
            isValid: warnings.length === 0,
            warnings,
            suggestions
        };
    }
    /**
     * Analyze compilation result for potential issues
     */
    static analyzeCompilationResult(result, originalFile) {
        const warnings = [];
        const suggestions = [];
        // Analyze code size
        const codeSize = result.code.length;
        if (codeSize > 50000) { // 50KB threshold
            warnings.push('Generated code is quite large');
            suggestions.push('Consider code splitting or optimizing component size');
        }
        // Analyze dependencies
        if (result.dependencies.length > 10) {
            warnings.push('High number of dependencies detected');
            suggestions.push('Review dependencies for potential optimization');
        }
        // Check for missing exports
        if (result.exports.length === 0) {
            warnings.push('No exports detected in compiled code');
            suggestions.push('Ensure component is properly exported');
        }
        // Check source map
        if (!result.sourceMap) {
            warnings.push('No source map generated');
            suggestions.push('Enable source map generation for better debugging');
        }
        return {
            warnings,
            suggestions,
            metrics: {
                codeSize,
                dependencyCount: result.dependencies.length,
                exportCount: result.exports.length,
                hasSourceMap: !!result.sourceMap
            }
        };
    }
    /**
     * Generate debug report for compilation process
     */
    static generateDebugReport(file, mtmFile, result, error) {
        const lines = [];
        lines.push(`# Debug Report: ${file}`);
        lines.push(`Generated: ${new Date().toISOString()}`);
        lines.push('');
        // File structure validation
        const validation = DebugTools.validateMTMStructure(mtmFile);
        lines.push('## File Structure Validation');
        lines.push(`Status: ${validation.isValid ? 'VALID' : 'ISSUES FOUND'}`);
        if (validation.warnings.length > 0) {
            lines.push('\n### Warnings:');
            validation.warnings.forEach(warning => lines.push(`- ${warning}`));
        }
        if (validation.suggestions.length > 0) {
            lines.push('\n### Suggestions:');
            validation.suggestions.forEach(suggestion => lines.push(`- ${suggestion}`));
        }
        // Compilation result analysis
        if (result) {
            const analysis = DebugTools.analyzeCompilationResult(result, mtmFile);
            lines.push('\n## Compilation Analysis');
            lines.push(`Code Size: ${analysis.metrics.codeSize} bytes`);
            lines.push(`Dependencies: ${analysis.metrics.dependencyCount}`);
            lines.push(`Exports: ${analysis.metrics.exportCount}`);
            lines.push(`Source Map: ${analysis.metrics.hasSourceMap ? 'Yes' : 'No'}`);
            if (analysis.warnings.length > 0) {
                lines.push('\n### Warnings:');
                analysis.warnings.forEach(warning => lines.push(`- ${warning}`));
            }
        }
        // Error information
        if (error) {
            lines.push('\n## Error Details');
            lines.push(`Type: ${error.type}`);
            lines.push(`Message: ${error.message}`);
            if (error.line)
                lines.push(`Line: ${error.line}`);
            if (error.column)
                lines.push(`Column: ${error.column}`);
            if (error.suggestions) {
                lines.push('\n### Suggestions:');
                error.suggestions.forEach(suggestion => lines.push(`- ${suggestion}`));
            }
        }
        return lines.join('\n');
    }
}
DebugTools.sessions = new Map();
DebugTools.globalDebugEnabled = false;
