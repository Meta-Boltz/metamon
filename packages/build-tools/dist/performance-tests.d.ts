/**
 * Performance test configuration
 */
export interface PerformanceTestConfig {
    /** Number of test iterations */
    iterations: number;
    /** Test bundle sizes (in KB) */
    bundleSizes: number[];
    /** Test different framework combinations */
    frameworks: string[];
    /** Enable detailed timing breakdown */
    detailed: boolean;
    /** Output directory for test results */
    outputDir: string;
}
/**
 * Performance test result
 */
export interface PerformanceTestResult {
    /** Test name */
    name: string;
    /** Average execution time (ms) */
    averageTime: number;
    /** Minimum execution time (ms) */
    minTime: number;
    /** Maximum execution time (ms) */
    maxTime: number;
    /** Standard deviation */
    stdDev: number;
    /** Memory usage (MB) */
    memoryUsage: number;
    /** Throughput (operations per second) */
    throughput: number;
    /** Additional metrics */
    metrics: Record<string, number>;
}
/**
 * Complete performance test suite result
 */
export interface PerformanceTestSuiteResult {
    /** Overall test statistics */
    overview: {
        totalTests: number;
        totalTime: number;
        averageTime: number;
        fastestTest: string;
        slowestTest: string;
    };
    /** Individual test results */
    results: PerformanceTestResult[];
    /** Performance comparison */
    comparison: {
        baseline: string;
        improvements: Array<{
            test: string;
            improvement: number;
            percentage: number;
        }>;
    };
    /** Recommendations */
    recommendations: string[];
}
/**
 * Performance test runner for build optimization features
 */
export declare class PerformanceTestRunner {
    private config;
    private testData;
    constructor(config: PerformanceTestConfig);
    /**
     * Run complete performance test suite
     */
    runTestSuite(): Promise<PerformanceTestSuiteResult>;
    /**
     * Prepare test data for performance tests
     */
    private prepareTestData;
    /**
     * Test tree-shaking performance
     */
    private testTreeShakingPerformance;
    /**
     * Test bundle analysis performance
     */
    private testBundleAnalysisPerformance;
    /**
     * Test production optimization performance
     */
    private testProductionOptimizationPerformance;
    /**
     * Test module bundling performance
     */
    private testModuleBundlingPerformance;
    /**
     * Test end-to-end build performance
     */
    private testEndToEndBuildPerformance;
    /**
     * Test memory usage under load
     */
    private testMemoryUsagePerformance;
    /**
     * Generate test bundle content
     */
    private generateTestBundle;
    /**
     * Generate test dependency graph
     */
    private generateTestDependencyGraph;
    /**
     * Generate test bundle result
     */
    private generateTestBundleResult;
    /**
     * Calculate test result statistics
     */
    private calculateTestResult;
    /**
     * Generate overview statistics
     */
    private generateOverview;
    /**
     * Generate performance comparison
     */
    private generateComparison;
    /**
     * Generate performance recommendations
     */
    private generateRecommendations;
    /**
     * Save test results to file
     */
    private saveResults;
    /**
     * Generate markdown report
     */
    private generateMarkdownReport;
}
