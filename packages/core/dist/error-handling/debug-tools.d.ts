import { CompilationError } from './compilation-error.js';
import { MTMFile } from '../types/mtm-file.js';
import { CompilationResult } from '../types/compiler.js';
/**
 * Debug information for compilation process
 */
export interface DebugInfo {
    timestamp: number;
    file: string;
    phase: 'parsing' | 'validation' | 'compilation' | 'runtime';
    duration: number;
    success: boolean;
    error?: CompilationError;
    metadata?: Record<string, any>;
}
/**
 * Debug session for tracking compilation process
 */
export declare class DebugSession {
    private file;
    private startTime;
    private steps;
    private currentStep?;
    constructor(file: string);
    /**
     * Start tracking a compilation phase
     */
    startPhase(phase: 'parsing' | 'validation' | 'compilation' | 'runtime'): void;
    /**
     * End current phase with success
     */
    endPhase(metadata?: Record<string, any>): void;
    /**
     * End current phase with error
     */
    endPhaseWithError(error: CompilationError, metadata?: Record<string, any>): void;
    /**
     * Get debug summary
     */
    getSummary(): {
        file: string;
        totalDuration: number;
        steps: DebugInfo[];
        success: boolean;
        errors: CompilationError[];
    };
}
/**
 * Debug tools for MTM compilation process
 */
export declare class DebugTools {
    private static sessions;
    private static globalDebugEnabled;
    /**
     * Enable global debugging
     */
    static enableDebug(): void;
    /**
     * Disable global debugging
     */
    static disableDebug(): void;
    /**
     * Check if debugging is enabled
     */
    static isDebugEnabled(): boolean;
    /**
     * Start debug session for file
     */
    static startSession(file: string): DebugSession;
    /**
     * Get debug session for file
     */
    static getSession(file: string): DebugSession | undefined;
    /**
     * End debug session and get summary
     */
    static endSession(file: string): ReturnType<DebugSession['getSummary']> | undefined;
    /**
     * Format debug summary for console output
     */
    static formatDebugSummary(summary: ReturnType<DebugSession['getSummary']>): string;
    /**
     * Validate MTM file structure and report issues
     */
    static validateMTMStructure(mtmFile: MTMFile): {
        isValid: boolean;
        warnings: string[];
        suggestions: string[];
    };
    /**
     * Analyze compilation result for potential issues
     */
    static analyzeCompilationResult(result: CompilationResult, originalFile: MTMFile): {
        warnings: string[];
        suggestions: string[];
        metrics: {
            codeSize: number;
            dependencyCount: number;
            exportCount: number;
            hasSourceMap: boolean;
        };
    };
    /**
     * Generate debug report for compilation process
     */
    static generateDebugReport(file: string, mtmFile: MTMFile, result?: CompilationResult, error?: CompilationError): string;
}
