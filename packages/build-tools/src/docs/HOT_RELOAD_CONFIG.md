# Hot Reload Configuration and Developer Tools

This document describes how to configure and use the hot reload system in Metamon, including the developer tools for monitoring performance and debugging.

## Overview

The hot reload system provides:
- **Configuration Management**: Flexible configuration for hot reload behavior
- **Developer Tools**: Performance monitoring and metrics collection
- **Debug Logging**: Detailed logging for troubleshooting hot reload issues
- **Visual Feedback**: Progress indicators and error overlays

## Configuration

### Basic Configuration

Add hot reload configuration to your Vite plugin options:

```typescript
import { defineConfig } from 'vite';
import { metamonVitePlugin } from '@metamon/build-tools';

export default defineConfig({
  plugins: [
    metamonVitePlugin({
      // ... other options
      hotReload: {
        preserveState: true,
        debounceMs: 100,
        enableDevTools: true,
        logLevel: 'info'
      }
    })
  ]
});
```

### External Configuration File

Create a `metamon.hotreload.config.js` file in your project root:

```javascript
export default {
  // File watching
  watchPatterns: ['**/*.mtm', '**/*.jsx', '**/*.vue'],
  ignorePatterns: ['**/node_modules/**', '**/dist/**'],
  
  // Reload behavior
  preserveState: true,
  batchUpdates: true,
  debounceMs: 100,
  
  // Cross-framework settings
  syncFrameworks: true,
  syncTimeout: 5000,
  
  // Error handling
  showErrorOverlay: true,
  errorRecoveryMode: 'graceful',
  
  // Performance settings
  maxConcurrentReloads: 5,
  reloadTimeout: 10000,
  
  // Developer tools
  enableDevTools: true,
  enablePerformanceMonitoring: true,
  enableDebugLogging: false,
  logLevel: 'info'
};
```

## Configuration Options

### File Watching

- **`watchPatterns`**: Array of glob patterns for files to watch
- **`ignorePatterns`**: Array of glob patterns for files to ignore

### Reload Behavior

- **`preserveState`**: Whether to preserve component state during reloads
- **`batchUpdates`**: Whether to batch multiple file changes
- **`debounceMs`**: Debounce time in milliseconds for file changes

### Cross-Framework Settings

- **`syncFrameworks`**: Whether to synchronize state across frameworks
- **`syncTimeout`**: Timeout for framework synchronization in milliseconds

### Error Handling

- **`showErrorOverlay`**: Whether to show error overlay on compilation errors
- **`errorRecoveryMode`**: Error recovery strategy (`'graceful'` or `'strict'`)

### Performance Settings

- **`maxConcurrentReloads`**: Maximum number of concurrent reload operations
- **`reloadTimeout`**: Timeout for reload operations in milliseconds

### Developer Tools

- **`enableDevTools`**: Enable developer tools and metrics collection
- **`enablePerformanceMonitoring`**: Enable performance monitoring
- **`enableStatePreservationLogging`**: Enable detailed state preservation logging
- **`enableDebugLogging`**: Enable debug logging to console
- **`logLevel`**: Logging level (`'error'`, `'warn'`, `'info'`, `'debug'`)

## Developer Tools Usage

### Accessing Developer Tools

```typescript
import { getDevTools } from '@metamon/build-tools';

const devTools = getDevTools();
if (devTools) {
  // Get current metrics
  const metrics = devTools.getMetrics();
  console.log('Reload count:', metrics.reload.reloadCount);
  console.log('Average reload time:', metrics.reload.averageReloadTime);
  
  // Generate performance report
  const report = devTools.generatePerformanceReport();
  console.log(report);
  
  // Export metrics as JSON
  const exported = devTools.exportMetrics();
  // Save to file or send to analytics service
}
```

### Performance Metrics

The developer tools track various metrics:

#### Reload Metrics
- Total reload count
- Average, fastest, and slowest reload times
- Failed reload count
- State preservation success rate
- Detailed reload history

#### State Preservation Metrics
- Number of signals preserved
- Number of subscriptions preserved
- Number of component states preserved
- Preservation and restoration times
- Preservation failure count

### Debug Logging

Enable debug logging for detailed troubleshooting:

```typescript
import { getDebugLogger, logInfo, logError } from '@metamon/build-tools';

// Get logger instance
const logger = getDebugLogger();

// Start a debug session
const sessionId = logger?.startSession('my-debug-session');

// Use convenience functions
logInfo('reload', 'Component reloaded successfully');
logError('state', 'Failed to preserve component state');

// Generate debug report
const report = logger?.generateDebugReport();
console.log(report);
```

## Environment-Specific Configuration

### Development Configuration

```javascript
export default {
  enableDevTools: true,
  enablePerformanceMonitoring: true,
  enableDebugLogging: true,
  logLevel: 'debug',
  showErrorOverlay: true,
  debounceMs: 50 // Faster response for development
};
```

### Production Configuration

```javascript
export default {
  enableDevTools: false,
  enablePerformanceMonitoring: false,
  enableDebugLogging: false,
  logLevel: 'error',
  showErrorOverlay: false,
  debounceMs: 200 // More conservative for production
};
```

## Validation

The configuration is automatically validated. Common validation errors:

- `debounceMs` must be between 0 and 5000
- `syncTimeout` must be between 1000 and 30000
- `maxConcurrentReloads` must be between 1 and 20
- `reloadTimeout` must be between 1000 and 60000
- `errorRecoveryMode` must be either 'graceful' or 'strict'
- `logLevel` must be one of: 'error', 'warn', 'info', 'debug'

## Best Practices

### Performance Optimization

1. **Use appropriate debounce times**: 50-100ms for development, 200-300ms for slower systems
2. **Limit concurrent reloads**: Keep `maxConcurrentReloads` between 3-5 for most applications
3. **Monitor memory usage**: Use performance monitoring to track memory consumption
4. **Disable dev tools in production**: Always disable developer tools in production builds

### Debugging

1. **Enable debug logging temporarily**: Use debug logging only when troubleshooting issues
2. **Use debug sessions**: Start debug sessions to group related logs
3. **Monitor state preservation**: Enable state preservation logging to debug state issues
4. **Check performance reports**: Regularly review performance reports to identify bottlenecks

### Error Handling

1. **Use graceful error recovery**: Prefer 'graceful' mode for better user experience
2. **Show error overlays in development**: Enable error overlays to catch issues early
3. **Set appropriate timeouts**: Configure timeouts based on your application complexity

## Troubleshooting

### Common Issues

1. **Slow reloads**: Increase `debounceMs` or reduce `maxConcurrentReloads`
2. **State not preserved**: Check state preservation logs and ensure `preserveState` is enabled
3. **Framework sync issues**: Increase `syncTimeout` for complex cross-framework scenarios
4. **Memory leaks**: Monitor performance metrics and check for excessive history retention

### Debug Commands

```typescript
// Reset all metrics
devTools?.resetMetrics();

// Clear debug logs
logger?.clearLogs();

// Export data for analysis
const metrics = devTools?.exportMetrics();
const logs = logger?.exportLogs();
```

## Integration with Build Tools

The hot reload configuration integrates seamlessly with the Metamon build system:

```typescript
import { getConfig } from '@metamon/build-tools';

// Get merged configuration including hot reload settings
const config = getConfig({
  hotReload: {
    enableDevTools: process.env.NODE_ENV === 'development'
  }
}, process.env.NODE_ENV === 'development');
```

This ensures that hot reload settings are properly merged with other build configuration options.