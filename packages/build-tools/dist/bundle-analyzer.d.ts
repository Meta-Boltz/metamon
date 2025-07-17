import { BundleInfo, BundleResult } from './types/module-bundler.js';
/**
 * Configuration for bundle analysis
 */
export interface BundleAnalysisConfig {
    /** Generate detailed size breakdown */
    detailed: boolean;
    /** Include source map analysis */
    sourceMaps: boolean;
    /** Generate visualization data */
    visualization: boolean;
    /** Size thresholds for warnings */
    thresholds: {
        warning: number;
        error: number;
    };
}
/**
 * Detailed analysis of a single bundle
 */
export interface DetailedBundleAnalysis {
    /** Bundle information */
    bundle: BundleInfo;
    /** Size breakdown by category */
    sizeBreakdown: {
        code: number;
        dependencies: number;
        runtime: number;
        framework: number;
    };
    /** Compression analysis */
    compression: {
        gzipped: number;
        brotli: number;
        compressionRatio: number;
    };
    /** Performance metrics */
    performance: {
        parseTime: number;
        loadTime: number;
        executionTime: number;
    };
    /** Optimization suggestions */
    suggestions: string[];
    /** Warnings and issues */
    warnings: string[];
}
/**
 * Complete bundle analysis result
 */
export interface CompleteBundleAnalysis {
    /** Overall statistics */
    overview: {
        totalBundles: number;
        totalSize: number;
        totalGzippedSize: number;
        averageBundleSize: number;
        largestBundle: string;
        smallestBundle: string;
    };
    /** Per-bundle analysis */
    bundles: DetailedBundleAnalysis[];
    /** Cross-bundle analysis */
    crossBundle: {
        duplicatedCode: Array<{
            code: string;
            size: number;
            bundles: string[];
        }>;
        sharedDependencies: Array<{
            dependency: string;
            size: number;
            bundles: string[];
        }>;
        optimizationOpportunities: string[];
    };
    /** Performance recommendations */
    recommendations: {
        splitting: string[];
        compression: string[];
        caching: string[];
        loading: string[];
    };
}
/**
 * Bundle analyzer for size optimization and performance insights
 */
export declare class BundleAnalyzer {
    private config;
    constructor(config: BundleAnalysisConfig);
    /**
     * Analyze bundle result and generate comprehensive report
     */
    analyze(bundleResult: BundleResult): Promise<CompleteBundleAnalysis>;
    /**
     * Analyze a single bundle in detail
     */
    private analyzeSingleBundle;
    /**
     * Analyze size breakdown by category
     */
    private analyzeSizeBreakdown;
    /**
     * Analyze compression ratios
     */
    private analyzeCompression;
    /**
     * Analyze performance characteristics
     */
    private analyzePerformance;
    /**
     * Generate optimization suggestions for a bundle
     */
    private generateBundleSuggestions;
    /**
     * Generate warnings for potential issues
     */
    private generateBundleWarnings;
    /**
     * Analyze patterns across multiple bundles
     */
    private analyzeCrossBundlePatterns;
    /**
     * Generate overview statistics
     */
    private generateOverview;
    /**
     * Generate performance recommendations
     */
    private generateRecommendations;
    /**
     * Generate visualization data for bundle analysis
     */
    generateVisualization(analysis: CompleteBundleAnalysis): Promise<any>;
}
