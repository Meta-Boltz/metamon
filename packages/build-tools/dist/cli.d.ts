#!/usr/bin/env node
/**
 * CLI for Metamon build optimization tools
 */
declare class MetamonBuildCLI {
    private args;
    constructor(args: string[]);
    run(): Promise<void>;
    private runBundleAnalysis;
    private runProductionOptimization;
    private runPerformanceTests;
    private findBundleFiles;
    private createBundleResultFromFiles;
    private extractDependencies;
    private determineFramework;
    private findDuplicateDependencies;
    private showHelp;
}
export { MetamonBuildCLI };
