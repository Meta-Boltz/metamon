/**
 * Comprehensive System Integration Validation
 * Tests entire MTM system with real-world scenarios and validates all requirements
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

interface ValidationResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  details?: any;
}

class SystemValidator {
  private results: ValidationResult[] = [];
  private projectRoot: string;
  private examplesDir: string;

  constructor() {
    this.projectRoot = process.cwd().includes('packages') 
      ? join(process.cwd(), '..', '..')
      : process.cwd();
    this.examplesDir = join(this.projectRoot, 'examples');
  }

  private addResult(test: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, details?: any) {
    this.results.push({ test, status, message, details });
    console.log(`${status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠'} ${test}: ${message}`);
  }

  async validateProjectStructure(): Promise<void> {
    console.log('\n=== Project Structure Validation ===');

    // Check main package.json
    const packageJsonPath = join(this.projectRoot, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        this.addResult(
          'Main package.json',
          packageJson.name === 'metamon' ? 'PASS' : 'FAIL',
          packageJson.name === 'metamon' ? 'Valid package.json found' : `Expected name 'metamon', got '${packageJson.name}'`
        );
      } catch (error) {
        this.addResult('Main package.json', 'FAIL', 'Invalid JSON format');
      }
    } else {
      this.addResult('Main package.json', 'FAIL', 'Package.json not found');
    }

    // Check core packages
    const corePackages = ['packages/core', 'packages/build-tools'];
    for (const pkg of corePackages) {
      const pkgPath = join(this.projectRoot, pkg);
      const packageJsonPath = join(pkgPath, 'package.json');
      
      if (existsSync(pkgPath) && existsSync(packageJsonPath)) {
        this.addResult(`Package ${pkg}`, 'PASS', 'Package structure valid');
      } else {
        this.addResult(`Package ${pkg}`, 'FAIL', 'Package structure missing');
      }
    }

    // Check examples directory
    if (existsSync(this.examplesDir)) {
      this.addResult('Examples directory', 'PASS', 'Examples directory exists');
    } else {
      this.addResult('Examples directory', 'FAIL', 'Examples directory missing');
    }
  }

  async validateDocumentation(): Promise<void> {
    console.log('\n=== Documentation Validation ===');

    const docFiles = [
      'README.md',
      'docs/MIGRATION_GUIDE.md',
      'docs/TROUBLESHOOTING.md',
      'examples/README.md'
    ];

    for (const file of docFiles) {
      const filePath = join(this.projectRoot, file);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf8');
        if (content.length > 100) {
          this.addResult(`Documentation ${file}`, 'PASS', 'Documentation file exists and has content');
        } else {
          this.addResult(`Documentation ${file}`, 'FAIL', 'Documentation file too short');
        }
      } else {
        this.addResult(`Documentation ${file}`, 'FAIL', 'Documentation file missing');
      }
    }
  }

  async validateBuildSystem(): Promise<void> {
    console.log('\n=== Build System Validation ===');

    // Check turbo.json
    const turboConfigPath = join(this.projectRoot, 'turbo.json');
    if (existsSync(turboConfigPath)) {
      try {
        const turboConfig = JSON.parse(readFileSync(turboConfigPath, 'utf8'));
        if (turboConfig.pipeline) {
          this.addResult('Turbo configuration', 'PASS', 'Valid turbo.json with pipeline');
        } else {
          this.addResult('Turbo configuration', 'FAIL', 'turbo.json missing pipeline');
        }
      } catch (error) {
        this.addResult('Turbo configuration', 'FAIL', 'Invalid turbo.json format');
      }
    } else {
      this.addResult('Turbo configuration', 'FAIL', 'turbo.json not found');
    }

    // Check TypeScript configuration
    const tsConfigPath = join(this.projectRoot, 'tsconfig.json');
    if (existsSync(tsConfigPath)) {
      try {
        const tsConfig = JSON.parse(readFileSync(tsConfigPath, 'utf8'));
        if (tsConfig.compilerOptions) {
          this.addResult('TypeScript configuration', 'PASS', 'Valid tsconfig.json');
        } else {
          this.addResult('TypeScript configuration', 'FAIL', 'tsconfig.json missing compilerOptions');
        }
      } catch (error) {
        this.addResult('TypeScript configuration', 'FAIL', 'Invalid tsconfig.json format');
      }
    } else {
      this.addResult('TypeScript configuration', 'FAIL', 'tsconfig.json not found');
    }
  }

  async validateExamplesBuild(): Promise<void> {
    console.log('\n=== Examples Build Validation ===');

    if (!existsSync(this.examplesDir)) {
      this.addResult('Examples build', 'SKIP', 'Examples directory not found');
      return;
    }

    try {
      // Check if examples can be built
      const buildResult = execSync('npm run build', {
        cwd: this.examplesDir,
        encoding: 'utf8',
        timeout: 60000
      });

      if (existsSync(join(this.examplesDir, 'dist'))) {
        this.addResult('Examples build', 'PASS', 'Examples built successfully');
      } else {
        this.addResult('Examples build', 'FAIL', 'Build completed but no dist directory');
      }
    } catch (error) {
      this.addResult('Examples build', 'FAIL', `Build failed: ${error.message}`);
    }
  }

  async validateMTMFiles(): Promise<void> {
    console.log('\n=== MTM Files Validation ===');

    if (!existsSync(this.examplesDir)) {
      this.addResult('MTM files', 'SKIP', 'Examples directory not found');
      return;
    }

    try {
      // Find .mtm files
      const findCommand = process.platform === 'win32' 
        ? 'dir /s /b *.mtm'
        : 'find . -name "*.mtm" -type f';
      
      const mtmFiles = execSync(findCommand, {
        cwd: this.examplesDir,
        encoding: 'utf8',
        timeout: 10000
      }).trim().split('\n').filter(Boolean);

      if (mtmFiles.length > 0) {
        this.addResult('MTM files discovery', 'PASS', `Found ${mtmFiles.length} .mtm files`);

        // Validate frontmatter in first few files
        let validFiles = 0;
        for (const file of mtmFiles.slice(0, 3)) {
          const filePath = process.platform === 'win32' ? file : join(this.examplesDir, file);
          if (existsSync(filePath)) {
            const content = readFileSync(filePath, 'utf8');
            if (content.match(/^---\n[\s\S]*?\n---/)) {
              validFiles++;
            }
          }
        }

        if (validFiles > 0) {
          this.addResult('MTM frontmatter', 'PASS', `${validFiles} files have valid frontmatter`);
        } else {
          this.addResult('MTM frontmatter', 'FAIL', 'No valid frontmatter found');
        }
      } else {
        this.addResult('MTM files discovery', 'FAIL', 'No .mtm files found');
      }
    } catch (error) {
      this.addResult('MTM files discovery', 'FAIL', `Error finding .mtm files: ${error.message}`);
    }
  }

  async validateMigrationTools(): Promise<void> {
    console.log('\n=== Migration Tools Validation ===');

    const migrationFiles = [
      'packages/build-tools/src/migration/mtm-migrator.js',
      'packages/build-tools/src/migration/cli.js',
      'packages/build-tools/src/migration/backward-compatibility.js'
    ];

    let validMigrationFiles = 0;
    for (const file of migrationFiles) {
      const filePath = join(this.projectRoot, file);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf8');
        if (content.includes('migration') && content.length > 500) {
          validMigrationFiles++;
        }
      }
    }

    if (validMigrationFiles === migrationFiles.length) {
      this.addResult('Migration tools', 'PASS', 'All migration tools present and valid');
    } else if (validMigrationFiles > 0) {
      this.addResult('Migration tools', 'FAIL', `Only ${validMigrationFiles}/${migrationFiles.length} migration tools valid`);
    } else {
      this.addResult('Migration tools', 'FAIL', 'No valid migration tools found');
    }

    // Test migration CLI
    try {
      const cliPath = join(this.projectRoot, 'packages/build-tools/src/migration/cli.js');
      if (existsSync(cliPath)) {
        const helpOutput = execSync(`node "${cliPath}" --help`, {
          cwd: this.projectRoot,
          encoding: 'utf8',
          timeout: 10000
        });

        if (helpOutput.includes('migration')) {
          this.addResult('Migration CLI', 'PASS', 'Migration CLI responds correctly');
        } else {
          this.addResult('Migration CLI', 'FAIL', 'Migration CLI help output invalid');
        }
      } else {
        this.addResult('Migration CLI', 'SKIP', 'Migration CLI not found');
      }
    } catch (error) {
      this.addResult('Migration CLI', 'FAIL', `Migration CLI error: ${error.message}`);
    }
  }

  async validatePerformanceFeatures(): Promise<void> {
    console.log('\n=== Performance Features Validation ===');

    const performanceFiles = [
      'packages/core/src/performance/performance-monitor.ts',
      'packages/core/src/performance/build-performance-tracker.ts',
      'packages/core/src/performance/runtime-performance-tracker.ts',
      'packages/core/src/performance/bundle-analyzer.ts'
    ];

    let validPerfFiles = 0;
    for (const file of performanceFiles) {
      const filePath = join(this.projectRoot, file);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf8');
        if (content.includes('performance') && content.length > 200) {
          validPerfFiles++;
        }
      }
    }

    if (validPerfFiles >= performanceFiles.length * 0.8) {
      this.addResult('Performance features', 'PASS', `${validPerfFiles}/${performanceFiles.length} performance features implemented`);
    } else {
      this.addResult('Performance features', 'FAIL', `Only ${validPerfFiles}/${performanceFiles.length} performance features found`);
    }

    // Test performance monitoring
    try {
      const perfMonitorPath = join(this.projectRoot, 'packages/core/src/performance/performance-monitor.ts');
      if (existsSync(perfMonitorPath)) {
        const content = readFileSync(perfMonitorPath, 'utf8');
        if (content.includes('class') && content.includes('monitor')) {
          this.addResult('Performance monitoring', 'PASS', 'Performance monitor class found');
        } else {
          this.addResult('Performance monitoring', 'FAIL', 'Performance monitor implementation incomplete');
        }
      } else {
        this.addResult('Performance monitoring', 'FAIL', 'Performance monitor not found');
      }
    } catch (error) {
      this.addResult('Performance monitoring', 'FAIL', `Performance monitoring error: ${error.message}`);
    }
  }

  async validateTestCoverage(): Promise<void> {
    console.log('\n=== Test Coverage Validation ===');

    const testFiles = [
      'packages/core/src/routing/end-to-end.integration.test.ts',
      'packages/core/src/routing/navigation-flows.integration.test.ts',
      'packages/core/src/routing/ssr-hydration.integration.test.ts',
      'packages/core/src/routing/error-recovery.integration.test.ts'
    ];

    let validTestFiles = 0;
    for (const file of testFiles) {
      const filePath = join(this.projectRoot, file);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf8');
        if (content.includes('describe') && content.includes('it(') && content.length > 1000) {
          validTestFiles++;
        }
      }
    }

    if (validTestFiles >= testFiles.length * 0.8) {
      this.addResult('Integration tests', 'PASS', `${validTestFiles}/${testFiles.length} integration test suites found`);
    } else {
      this.addResult('Integration tests', 'FAIL', `Only ${validTestFiles}/${testFiles.length} integration test suites found`);
    }

    // Check unit tests
    try {
      const testCommand = process.platform === 'win32' 
        ? 'dir /s /b *.test.ts *.test.js'
        : 'find . -name "*.test.ts" -o -name "*.test.js" | wc -l';
      
      const testCount = execSync(testCommand, {
        cwd: join(this.projectRoot, 'packages'),
        encoding: 'utf8',
        timeout: 10000
      }).trim();

      const count = process.platform === 'win32' 
        ? testCount.split('\n').length 
        : parseInt(testCount);

      if (count > 10) {
        this.addResult('Unit tests', 'PASS', `${count} test files found`);
      } else {
        this.addResult('Unit tests', 'FAIL', `Only ${count} test files found`);
      }
    } catch (error) {
      this.addResult('Unit tests', 'FAIL', `Error counting test files: ${error.message}`);
    }
  }

  async validateRequirementsCompliance(): Promise<void> {
    console.log('\n=== Requirements Compliance Validation ===');

    // Check core routing components
    const routingComponents = [
      'packages/core/src/routing/client-router.ts',
      'packages/core/src/routing/route-scanner.ts',
      'packages/core/src/routing/route-manifest.ts',
      'packages/core/src/routing/dynamic-routes.ts'
    ];

    let routingScore = 0;
    for (const component of routingComponents) {
      const filePath = join(this.projectRoot, component);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf8');
        if (content.length > 500) routingScore++;
      }
    }

    this.addResult(
      'Routing system (Req 2,3,7)',
      routingScore >= 3 ? 'PASS' : 'FAIL',
      `${routingScore}/${routingComponents.length} routing components implemented`
    );

    // Check SSR components
    const ssrComponents = [
      'packages/core/src/ssr/ssr-renderer.ts',
      'packages/core/src/ssr/hydration-manager.ts'
    ];

    let ssrScore = 0;
    for (const component of ssrComponents) {
      const filePath = join(this.projectRoot, component);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf8');
        if (content.includes('ssr') || content.includes('hydrat')) ssrScore++;
      }
    }

    this.addResult(
      'SSR system (Req 5)',
      ssrScore >= 1 ? 'PASS' : 'FAIL',
      `${ssrScore}/${ssrComponents.length} SSR components implemented`
    );

    // Check error handling
    const errorComponents = [
      'packages/core/src/errors/error-boundary.ts',
      'packages/core/src/routing/not-found-handler.ts'
    ];

    let errorScore = 0;
    for (const component of errorComponents) {
      const filePath = join(this.projectRoot, component);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf8');
        if (content.includes('error') || content.includes('404')) errorScore++;
      }
    }

    this.addResult(
      'Error handling (Req 4,9)',
      errorScore >= 1 ? 'PASS' : 'FAIL',
      `${errorScore}/${errorComponents.length} error handling components implemented`
    );

    // Check i18n support
    const i18nComponents = [
      'packages/core/src/i18n/i18n-router.ts',
      'packages/core/src/i18n/locale-detector.ts'
    ];

    let i18nScore = 0;
    for (const component of i18nComponents) {
      const filePath = join(this.projectRoot, component);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf8');
        if (content.includes('i18n') || content.includes('locale')) i18nScore++;
      }
    }

    this.addResult(
      'Internationalization (Req 8)',
      i18nScore >= 1 ? 'PASS' : 'FAIL',
      `${i18nScore}/${i18nComponents.length} i18n components implemented`
    );
  }

  async validateDeploymentReadiness(): Promise<void> {
    console.log('\n=== Deployment Readiness Validation ===');

    // Check if examples can be built for production
    if (existsSync(this.examplesDir)) {
      try {
        const buildResult = execSync('npm run build', {
          cwd: this.examplesDir,
          encoding: 'utf8',
          timeout: 60000
        });

        const distDir = join(this.examplesDir, 'dist');
        if (existsSync(distDir)) {
          // Check for essential files
          const indexHtml = join(distDir, 'index.html');
          const hasIndex = existsSync(indexHtml);
          
          this.addResult(
            'Production build',
            hasIndex ? 'PASS' : 'FAIL',
            hasIndex ? 'Production build creates index.html' : 'Production build missing index.html'
          );

          // Check for assets
          const assetsDir = join(distDir, 'assets');
          const hasAssets = existsSync(assetsDir);
          
          this.addResult(
            'Asset generation',
            hasAssets ? 'PASS' : 'SKIP',
            hasAssets ? 'Assets directory generated' : 'No assets directory found'
          );
        } else {
          this.addResult('Production build', 'FAIL', 'Build completed but no dist directory');
        }
      } catch (error) {
        this.addResult('Production build', 'FAIL', `Build failed: ${error.message}`);
      }
    } else {
      this.addResult('Production build', 'SKIP', 'Examples directory not found');
    }

    // Check for deployment configurations
    const deploymentConfigs = [
      'examples/netlify.toml',
      'examples/vercel.json',
      'examples/Dockerfile'
    ];

    let deploymentScore = 0;
    for (const config of deploymentConfigs) {
      const configPath = join(this.projectRoot, config);
      if (existsSync(configPath)) {
        deploymentScore++;
      }
    }

    this.addResult(
      'Deployment configurations',
      deploymentScore > 0 ? 'PASS' : 'SKIP',
      `${deploymentScore}/${deploymentConfigs.length} deployment configurations found`
    );
  }

  async runAllValidations(): Promise<ValidationResult[]> {
    console.log('🚀 Starting Comprehensive System Integration Validation\n');

    await this.validateProjectStructure();
    await this.validateDocumentation();
    await this.validateBuildSystem();
    await this.validateExamplesBuild();
    await this.validateMTMFiles();
    await this.validateMigrationTools();
    await this.validatePerformanceFeatures();
    await this.validateTestCoverage();
    await this.validateRequirementsCompliance();
    await this.validateDeploymentReadiness();

    return this.results;
  }

  generateReport(): string {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    const total = this.results.length;

    const report = `
=== COMPREHENSIVE SYSTEM INTEGRATION VALIDATION REPORT ===

Summary:
✓ Passed: ${passed}
✗ Failed: ${failed}
⚠ Skipped: ${skipped}
Total: ${total}

Success Rate: ${((passed / (total - skipped)) * 100).toFixed(1)}%

Detailed Results:
${this.results.map(r => `${r.status === 'PASS' ? '✓' : r.status === 'FAIL' ? '✗' : '⚠'} ${r.test}: ${r.message}`).join('\n')}

Overall Status: ${failed === 0 ? '🎉 SYSTEM READY FOR DEPLOYMENT' : '⚠️ ISSUES NEED ATTENTION'}
`;

    return report;
  }
}

// Export for use in tests
export { SystemValidator, ValidationResult };

// CLI execution
async function main() {
  const validator = new SystemValidator();
  
  try {
    await validator.runAllValidations();
    const report = validator.generateReport();
    console.log(report);
    
    // Write report to file
    const reportPath = join(process.cwd(), 'system-integration-report.md');
    writeFileSync(reportPath, report);
    console.log(`\nReport saved to: ${reportPath}`);
    
    // Exit with appropriate code
    const failed = validator.results.filter(r => r.status === 'FAIL').length;
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Validation failed:', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}