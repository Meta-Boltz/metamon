import { BundleResult } from './types/module-bundler.js';
import { TreeShakingConfig } from './tree-shaker.js';
/**
 * Configuration for production optimization
 */
export interface ProductionOptimizationConfig {
    /** Enable minification */
    minify: {
        enabled: boolean;
        /** Remove comments */
        removeComments: boolean;
        /** Remove console statements */
        removeConsole: boolean;
        /** Remove debugger statements */
        removeDebugger: boolean;
        /** Mangle variable names */
        mangle: boolean;
        /** Compress expressions */
        compress: boolean;
    };
    /** Enable compression */
    compression: {
        /** Enable gzip compression */
        gzip: boolean;
        /** Enable brotli compression */
        brotli: boolean;
        /** Compression level (1-9) */
        level: number;
    };
    /** Tree-shaking configuration */
    treeShaking: TreeShakingConfig;
    /** Enable source map generation */
    sourceMaps: boolean;
    /** Target environment */
    target: 'es5' | 'es2015' | 'es2017' | 'es2020' | 'esnext';
    /** Enable polyfills */
    polyfills: boolean;
}
/**
 * Result of production optimization
 */
export interface ProductionOptimizationResult {
    /** Original bundle result */
    original: BundleResult;
    /** Optimized bundle result */
    optimized: BundleResult;
    /** Optimization statistics */
    stats: {
        /** Total size reduction */
        sizeReduction: number;
        /** Percentage reduction */
        reductionPercentage: number;
        /** Optimization time */
        optimizationTime: number;
        /** Applied optimizations */
        appliedOptimizations: string[];
    };
    /** Compressed file information */
    compressed?: {
        gzip?: {
            size: number;
            ratio: number;
        };
        brotli?: {
            size: number;
            ratio: number;
        };
    };
}
/**
 * Production build optimizer with minification and compression
 */
export declare class ProductionOptimizer {
    private config;
    private treeShaker;
    constructor(config: ProductionOptimizationConfig);
    /**
     * Optimize bundle result for production
     */
    optimize(bundleResult: BundleResult): Promise<ProductionOptimizationResult>;
    /**
     * Optimize a single bundle
     */
    private optimizeBundle;
    /**
     * Minify JavaScript code
     */
    private minifyCode;
    /**
     * Simple variable name mangling
     */
    private mangleVariableNames;
    /**
     * Generate mangled variable name
     */
    private generateMangledName;
    /**
     * Check if a word is reserved
     */
    private isReservedWord;
    /**
     * Transform code for target environment
     */
    private transformForTarget;
    /**
     * Add polyfills for older browsers
     */
    private addPolyfills;
    /**
     * Generate source map
     */
    private generateSourceMap;
    /**
     * Generate compressed versions of bundles
     */
    private generateCompressedVersions;
    /**
     * Compress content with gzip
     */
    private compressGzip;
    /**
     * Compress content with brotli
     */
    private compressBrotli;
    /**
     * Get optimization statistics
     */
    getOptimizationStats(): {
        treeShakingStats: any;
        minificationEnabled: boolean;
        compressionEnabled: boolean;
        targetEnvironment: string;
    };
}
