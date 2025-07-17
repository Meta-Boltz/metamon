# @metamon/build-tools

Build optimization and tooling for the Metamon meta-framework.

## Features

### 🌳 Tree-Shaking

Remove unused runtime features, framework adapters, and components to reduce bundle size.

### 📊 Bundle Analysis

Comprehensive analysis of bundle sizes, dependencies, and optimization opportunities.

### ⚡ Production Optimization

Minification, compression, and code splitting for production builds.

### 🏃 Performance Testing

Benchmark build performance and identify bottlenecks.

## Installation

```bash
npm install @metamon/build-tools
```

## Usage

### Vite Plugin

```javascript
// vite.config.js
import { metamon } from "@metamon/build-tools";

export default {
  plugins: [
    metamon({
      root: "src",
      pagesDir: "pages",
      componentsDir: "components",
      optimization: {
        treeShaking: {
          runtime: true,
          adapters: true,
          components: true,
          aggressive: false,
        },
        minify: {
          enabled: true,
          removeComments: true,
          removeConsole: true,
          mangle: true,
          compress: true,
        },
        compression: {
          gzip: true,
          brotli: true,
          level: 6,
        },
        analysis: {
          detailed: true,
          visualization: true,
          thresholds: {
            warning: 250 * 1024, // 250KB
            error: 500 * 1024, // 500KB
          },
        },
      },
    }),
  ],
};
```

### CLI Tools

```bash
# Analyze bundle sizes and dependencies
metamon-build analyze ./dist ./analysis

# Apply production optimizations
metamon-build optimize ./dist ./config.json

# Run performance benchmarks
metamon-build perf-test ./perf-results
```

## API Reference

### TreeShaker

Remove unused code from bundles:

```typescript
import { TreeShaker } from "@metamon/build-tools";

const treeShaker = new TreeShaker({
  runtime: true, // Remove unused runtime features
  adapters: true, // Remove unused framework adapters
  components: true, // Remove unused components
  preserve: [], // Preserve specific exports
  aggressive: false, // Enable aggressive optimization
});

const result = await treeShaker.optimize(bundlePath, dependencyGraph);
console.log(
  `Saved ${result.bytesSaved} bytes (${result.reductionPercentage}%)`
);
```

### BundleAnalyzer

Analyze bundle composition and performance:

```typescript
import { BundleAnalyzer } from "@metamon/build-tools";

const analyzer = new BundleAnalyzer({
  detailed: true,
  sourceMaps: true,
  visualization: true,
  thresholds: {
    warning: 250 * 1024,
    error: 500 * 1024,
  },
});

const analysis = await analyzer.analyze(bundleResult);
console.log(`Total size: ${analysis.overview.totalSize} bytes`);
console.log(
  `Optimization opportunities: ${analysis.crossBundle.optimizationOpportunities.length}`
);
```

### ProductionOptimizer

Apply comprehensive production optimizations:

```typescript
import { ProductionOptimizer } from "@metamon/build-tools";

const optimizer = new ProductionOptimizer({
  minify: {
    enabled: true,
    removeComments: true,
    removeConsole: true,
    mangle: true,
    compress: true,
  },
  compression: {
    gzip: true,
    brotli: true,
    level: 6,
  },
  treeShaking: {
    runtime: true,
    adapters: true,
    components: true,
  },
  target: "es2015",
  sourceMaps: false,
});

const result = await optimizer.optimize(bundleResult);
console.log(`Size reduction: ${result.stats.reductionPercentage}%`);
```

### PerformanceTestRunner

Benchmark build performance:

```typescript
import { PerformanceTestRunner } from "@metamon/build-tools";

const testRunner = new PerformanceTestRunner({
  iterations: 10,
  bundleSizes: [10, 50, 100, 250], // KB
  frameworks: ["reactjs", "vue", "solid", "svelte"],
  detailed: true,
  outputDir: "./perf-results",
});

const results = await testRunner.runTestSuite();
console.log(`Average build time: ${results.overview.averageTime}ms`);
```

## Configuration

### Tree-Shaking Options

```typescript
interface TreeShakingConfig {
  runtime: boolean; // Remove unused runtime features
  adapters: boolean; // Remove unused framework adapters
  components: boolean; // Remove unused components
  preserve: string[]; // Preserve specific exports
  aggressive: boolean; // Enable aggressive optimization
}
```

### Minification Options

```typescript
interface MinifyConfig {
  enabled: boolean; // Enable minification
  removeComments: boolean; // Remove comments
  removeConsole: boolean; // Remove console statements
  removeDebugger: boolean; // Remove debugger statements
  mangle: boolean; // Mangle variable names
  compress: boolean; // Compress expressions
}
```

### Compression Options

```typescript
interface CompressionConfig {
  gzip: boolean; // Enable gzip compression
  brotli: boolean; // Enable brotli compression
  level: number; // Compression level (1-9)
}
```

### Analysis Options

```typescript
interface BundleAnalysisConfig {
  detailed: boolean; // Generate detailed breakdown
  sourceMaps: boolean; // Include source map analysis
  visualization: boolean; // Generate visualization data
  thresholds: {
    warning: number; // Warning threshold (bytes)
    error: number; // Error threshold (bytes)
  };
}
```

## Performance Benchmarks

The build optimization features provide significant improvements:

- **Tree-shaking**: 15-30% bundle size reduction
- **Minification**: 40-60% size reduction
- **Compression**: 70-80% size reduction (gzip/brotli)
- **Analysis**: Sub-second analysis for bundles up to 10MB

## Best Practices

### 1. Enable Tree-Shaking in Production

```javascript
// vite.config.js
export default {
  plugins: [
    metamon({
      optimization: {
        treeShaking: {
          runtime: true,
          adapters: true,
          components: true,
          // Only enable aggressive mode if you've tested thoroughly
          aggressive: process.env.NODE_ENV === "production",
        },
      },
    }),
  ],
};
```

### 2. Use Bundle Analysis for Optimization

```bash
# Analyze your bundles regularly
metamon-build analyze ./dist ./analysis

# Check for optimization opportunities
cat ./analysis/bundle-analysis.json | jq '.crossBundle.optimizationOpportunities'
```

### 3. Configure Appropriate Thresholds

```javascript
const config = {
  analysis: {
    thresholds: {
      warning: 250 * 1024, // 250KB - warn for large components
      error: 500 * 1024, // 500KB - error for very large bundles
    },
  },
};
```

### 4. Monitor Performance Over Time

```bash
# Run performance tests regularly
metamon-build perf-test ./perf-results

# Compare results over time
diff ./perf-results/performance-report.md ./previous-results/performance-report.md
```

## Integration Examples

### GitHub Actions

```yaml
name: Bundle Analysis
on: [push, pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"
      - run: npm ci
      - run: npm run build
      - run: npx metamon-build analyze ./dist ./analysis
      - uses: actions/upload-artifact@v3
        with:
          name: bundle-analysis
          path: ./analysis/
```

### Webpack Integration

```javascript
// webpack.config.js
const { ProductionOptimizer } = require("@metamon/build-tools");

module.exports = {
  // ... other config
  plugins: [
    // ... other plugins
    {
      apply: (compiler) => {
        compiler.hooks.afterEmit.tapAsync(
          "MetamonOptimizer",
          async (compilation, callback) => {
            const optimizer = new ProductionOptimizer({
              minify: { enabled: true },
              compression: { gzip: true },
              treeShaking: { runtime: true },
            });

            // Apply optimizations to emitted assets
            // ... optimization logic

            callback();
          }
        );
      },
    },
  ],
};
```

## Troubleshooting

### Common Issues

1. **Tree-shaking removes needed code**

   - Add exports to the `preserve` array
   - Disable `aggressive` mode
   - Check for dynamic imports

2. **Bundle analysis fails**

   - Ensure bundle files exist
   - Check file permissions
   - Verify bundle format is supported

3. **Performance tests are slow**
   - Reduce `iterations` count
   - Use smaller `bundleSizes`
   - Run tests on faster hardware

### Debug Mode

Enable debug logging:

```javascript
process.env.METAMON_DEBUG = "true";
```

## Contributing

See the main [Metamon repository](https://github.com/metamon/metamon) for contribution guidelines.

## License

MIT License - see LICENSE file for details.
