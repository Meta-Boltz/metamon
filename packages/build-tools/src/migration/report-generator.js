/**
 * Migration Report Generator
 * Generates comprehensive reports for MTM migrations
 */

import fs from 'fs/promises';
import path from 'path';

export class MigrationReportGenerator {
  constructor(options = {}) {
    this.options = {
      format: 'json', // json, html, markdown
      includeDetails: true,
      includeRecommendations: true,
      includeStatistics: true,
      ...options
    };
  }

  /**
   * Generate migration report
   * @param {Object} migrationData - Migration results data
   * @param {string} outputPath - Output file path
   * @returns {Promise<string>} Generated report path
   */
  async generateReport(migrationData, outputPath = null) {
    const reportData = this.processReportData(migrationData);

    if (!outputPath) {
      outputPath = this.generateOutputPath(this.options.format);
    }

    let content;
    switch (this.options.format.toLowerCase()) {
      case 'html':
        content = this.generateHTMLReport(reportData);
        break;
      case 'markdown':
      case 'md':
        content = this.generateMarkdownReport(reportData);
        break;
      case 'json':
      default:
        content = this.generateJSONReport(reportData);
        break;
    }

    await fs.writeFile(outputPath, content, 'utf-8');
    return outputPath;
  }

  /**
   * Process raw migration data into report format
   * @private
   */
  processReportData(migrationData) {
    const processed = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        generator: 'MTM Migration Tool'
      },
      summary: {
        totalFiles: migrationData.totalFiles || 0,
        migratedFiles: migrationData.migratedFiles || 0,
        skippedFiles: migrationData.skippedFiles || 0,
        errorCount: (migrationData.errors || []).length,
        warningCount: (migrationData.warnings || []).length,
        successRate: 0
      },
      statistics: this.generateStatistics(migrationData),
      changes: this.categorizeChanges(migrationData.changes || []),
      errors: migrationData.errors || [],
      warnings: migrationData.warnings || [],
      recommendations: migrationData.recommendations || []
    };

    // Calculate success rate
    if (processed.summary.totalFiles > 0) {
      processed.summary.successRate = Math.round(
        (processed.summary.migratedFiles / processed.summary.totalFiles) * 100
      );
    }

    return processed;
  }

  /**
   * Generate statistics from migration data
   * @private
   */
  generateStatistics(migrationData) {
    const stats = {
      changeTypes: {},
      fileTypes: {},
      errorTypes: {},
      warningTypes: {},
      migrationPatterns: {}
    };

    // Analyze changes
    (migrationData.changes || []).forEach(change => {
      stats.changeTypes[change.type] = (stats.changeTypes[change.type] || 0) + 1;
    });

    // Analyze errors
    (migrationData.errors || []).forEach(error => {
      stats.errorTypes[error.type] = (stats.errorTypes[error.type] || 0) + 1;
    });

    // Analyze warnings
    (migrationData.warnings || []).forEach(warning => {
      stats.warningTypes[warning.type] = (stats.warningTypes[warning.type] || 0) + 1;
    });

    // Detect migration patterns
    const changes = migrationData.changes || [];
    if (changes.some(c => c.type === 'route_format')) {
      stats.migrationPatterns.routeFormatUpdate = true;
    }
    if (changes.some(c => c.type === 'signal_syntax')) {
      stats.migrationPatterns.signalSyntaxUpdate = true;
    }
    if (changes.some(c => c.type === 'template_wrapper')) {
      stats.migrationPatterns.templateWrapping = true;
    }

    return stats;
  }

  /**
   * Categorize changes by type
   * @private
   */
  categorizeChanges(changes) {
    const categories = {
      frontmatter: [],
      syntax: [],
      structure: [],
      compatibility: []
    };

    const categoryMappings = {
      route_format: 'frontmatter',
      field_rename: 'frontmatter',
      keywords_format: 'frontmatter',
      default_layout: 'frontmatter',
      required_field: 'frontmatter',
      signal_syntax: 'syntax',
      event_syntax: 'syntax',
      deprecated_lifecycle: 'syntax',
      template_wrapper: 'structure',
      missing_template_wrapper: 'structure',
      legacy_signal_syntax: 'compatibility',
      legacy_event_syntax: 'compatibility'
    };

    changes.forEach(change => {
      const category = categoryMappings[change.type] || 'compatibility';
      categories[category].push(change);
    });

    return categories;
  }

  /**
   * Generate JSON report
   * @private
   */
  generateJSONReport(reportData) {
    return JSON.stringify(reportData, null, 2);
  }

  /**
   * Generate HTML report
   * @private
   */
  generateHTMLReport(reportData) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MTM Migration Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            border-bottom: 2px solid #e1e5e9;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #2c3e50;
            margin: 0;
            font-size: 2.5em;
        }
        .header .subtitle {
            color: #7f8c8d;
            font-size: 1.1em;
            margin-top: 5px;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            background: #f8f9fa;
            border-left: 4px solid #3498db;
            padding: 20px;
            border-radius: 4px;
        }
        .summary-card.success { border-left-color: #27ae60; }
        .summary-card.warning { border-left-color: #f39c12; }
        .summary-card.error { border-left-color: #e74c3c; }
        .summary-card h3 {
            margin: 0 0 10px 0;
            color: #2c3e50;
            font-size: 1.1em;
        }
        .summary-card .value {
            font-size: 2em;
            font-weight: bold;
            color: #2c3e50;
        }
        .section {
            margin-bottom: 40px;
        }
        .section h2 {
            color: #2c3e50;
            border-bottom: 1px solid #e1e5e9;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .changes-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }
        .change-category {
            background: #f8f9fa;
            border-radius: 6px;
            padding: 20px;
        }
        .change-category h3 {
            margin: 0 0 15px 0;
            color: #2c3e50;
        }
        .change-item {
            background: white;
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 10px;
            border-left: 3px solid #3498db;
        }
        .change-item:last-child { margin-bottom: 0; }
        .change-description {
            font-weight: 500;
            margin-bottom: 5px;
        }
        .change-details {
            font-size: 0.9em;
            color: #7f8c8d;
        }
        .error-list, .warning-list {
            background: #f8f9fa;
            border-radius: 6px;
            padding: 20px;
        }
        .error-item, .warning-item {
            background: white;
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 10px;
        }
        .error-item { border-left: 3px solid #e74c3c; }
        .warning-item { border-left: 3px solid #f39c12; }
        .error-item:last-child, .warning-item:last-child { margin-bottom: 0; }
        .recommendations {
            background: #e8f5e8;
            border-radius: 6px;
            padding: 20px;
        }
        .recommendation {
            background: white;
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 10px;
            border-left: 3px solid #27ae60;
        }
        .recommendation:last-child { margin-bottom: 0; }
        .priority-high { border-left-color: #e74c3c; }
        .priority-medium { border-left-color: #f39c12; }
        .priority-low { border-left-color: #27ae60; }
        .statistics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }
        .stat-card {
            background: #f8f9fa;
            border-radius: 6px;
            padding: 20px;
        }
        .stat-card h3 {
            margin: 0 0 15px 0;
            color: #2c3e50;
        }
        .stat-item {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            border-bottom: 1px solid #e1e5e9;
        }
        .stat-item:last-child { border-bottom: none; }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e1e5e9;
            text-align: center;
            color: #7f8c8d;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 MTM Migration Report</h1>
            <div class="subtitle">Generated on ${new Date(reportData.metadata.timestamp).toLocaleString()}</div>
        </div>

        <div class="summary">
            <div class="summary-card">
                <h3>Total Files</h3>
                <div class="value">${reportData.summary.totalFiles}</div>
            </div>
            <div class="summary-card success">
                <h3>Migrated</h3>
                <div class="value">${reportData.summary.migratedFiles}</div>
            </div>
            <div class="summary-card">
                <h3>Skipped</h3>
                <div class="value">${reportData.summary.skippedFiles}</div>
            </div>
            <div class="summary-card ${reportData.summary.errorCount > 0 ? 'error' : ''}">
                <h3>Errors</h3>
                <div class="value">${reportData.summary.errorCount}</div>
            </div>
            <div class="summary-card ${reportData.summary.warningCount > 0 ? 'warning' : ''}">
                <h3>Warnings</h3>
                <div class="value">${reportData.summary.warningCount}</div>
            </div>
            <div class="summary-card success">
                <h3>Success Rate</h3>
                <div class="value">${reportData.summary.successRate}%</div>
            </div>
        </div>

        ${this.generateHTMLChangesSection(reportData.changes)}
        ${this.generateHTMLStatisticsSection(reportData.statistics)}
        ${reportData.errors.length > 0 ? this.generateHTMLErrorsSection(reportData.errors) : ''}
        ${reportData.warnings.length > 0 ? this.generateHTMLWarningsSection(reportData.warnings) : ''}
        ${reportData.recommendations.length > 0 ? this.generateHTMLRecommendationsSection(reportData.recommendations) : ''}

        <div class="footer">
            Generated by MTM Migration Tool v${reportData.metadata.version}
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate HTML changes section
   * @private
   */
  generateHTMLChangesSection(changes) {
    if (!changes || Object.keys(changes).length === 0) return '';

    let html = '<div class="section"><h2>📝 Changes Made</h2><div class="changes-grid">';

    Object.entries(changes).forEach(([category, categoryChanges]) => {
      if (categoryChanges.length === 0) return;

      html += `<div class="change-category">
        <h3>${category.charAt(0).toUpperCase() + category.slice(1)} Changes</h3>`;

      categoryChanges.forEach(change => {
        html += `<div class="change-item">
          <div class="change-description">${change.description}</div>
          ${change.before ? `<div class="change-details">Before: ${this.escapeHtml(change.before)}</div>` : ''}
          ${change.after ? `<div class="change-details">After: ${this.escapeHtml(change.after)}</div>` : ''}
        </div>`;
      });

      html += '</div>';
    });

    html += '</div></div>';
    return html;
  }

  /**
   * Generate HTML statistics section
   * @private
   */
  generateHTMLStatisticsSection(statistics) {
    if (!statistics) return '';

    let html = '<div class="section"><h2>📊 Statistics</h2><div class="statistics">';

    if (Object.keys(statistics.changeTypes).length > 0) {
      html += '<div class="stat-card"><h3>Change Types</h3>';
      Object.entries(statistics.changeTypes)
        .sort(([, a], [, b]) => b - a)
        .forEach(([type, count]) => {
          html += `<div class="stat-item">
            <span>${type.replace(/_/g, ' ')}</span>
            <span>${count}</span>
          </div>`;
        });
      html += '</div>';
    }

    if (Object.keys(statistics.errorTypes).length > 0) {
      html += '<div class="stat-card"><h3>Error Types</h3>';
      Object.entries(statistics.errorTypes)
        .sort(([, a], [, b]) => b - a)
        .forEach(([type, count]) => {
          html += `<div class="stat-item">
            <span>${type.replace(/_/g, ' ')}</span>
            <span>${count}</span>
          </div>`;
        });
      html += '</div>';
    }

    if (Object.keys(statistics.warningTypes).length > 0) {
      html += '<div class="stat-card"><h3>Warning Types</h3>';
      Object.entries(statistics.warningTypes)
        .sort(([, a], [, b]) => b - a)
        .forEach(([type, count]) => {
          html += `<div class="stat-item">
            <span>${type.replace(/_/g, ' ')}</span>
            <span>${count}</span>
          </div>`;
        });
      html += '</div>';
    }

    html += '</div></div>';
    return html;
  }

  /**
   * Generate HTML errors section
   * @private
   */
  generateHTMLErrorsSection(errors) {
    let html = '<div class="section"><h2>❌ Errors</h2><div class="error-list">';

    errors.forEach(error => {
      html += `<div class="error-item">
        <div><strong>${error.type || 'Error'}:</strong> ${this.escapeHtml(error.message)}</div>
        ${error.suggestion ? `<div style="margin-top: 5px; font-style: italic;">Suggestion: ${this.escapeHtml(error.suggestion)}</div>` : ''}
      </div>`;
    });

    html += '</div></div>';
    return html;
  }

  /**
   * Generate HTML warnings section
   * @private
   */
  generateHTMLWarningsSection(warnings) {
    let html = '<div class="section"><h2>⚠️ Warnings</h2><div class="warning-list">';

    warnings.forEach(warning => {
      html += `<div class="warning-item">
        <div><strong>${warning.type || 'Warning'}:</strong> ${this.escapeHtml(warning.message)}</div>
        ${warning.file ? `<div style="margin-top: 5px; font-size: 0.9em; color: #666;">File: ${this.escapeHtml(warning.file)}</div>` : ''}
      </div>`;
    });

    html += '</div></div>';
    return html;
  }

  /**
   * Generate HTML recommendations section
   * @private
   */
  generateHTMLRecommendationsSection(recommendations) {
    let html = '<div class="section"><h2>💡 Recommendations</h2><div class="recommendations">';

    recommendations.forEach(rec => {
      const priorityClass = `priority-${rec.priority || 'medium'}`;
      html += `<div class="recommendation ${priorityClass}">
        <div><strong>${rec.message}</strong></div>
        ${rec.action ? `<div style="margin-top: 5px; font-style: italic;">Action: ${this.escapeHtml(rec.action)}</div>` : ''}
      </div>`;
    });

    html += '</div></div>';
    return html;
  }

  /**
   * Generate Markdown report
   * @private
   */
  generateMarkdownReport(reportData) {
    let md = `# 🚀 MTM Migration Report

Generated on ${new Date(reportData.metadata.timestamp).toLocaleString()}

## 📊 Summary

| Metric | Value |
|--------|-------|
| Total Files | ${reportData.summary.totalFiles} |
| Migrated | ${reportData.summary.migratedFiles} |
| Skipped | ${reportData.summary.skippedFiles} |
| Errors | ${reportData.summary.errorCount} |
| Warnings | ${reportData.summary.warningCount} |
| Success Rate | ${reportData.summary.successRate}% |

`;

    // Changes section
    if (reportData.changes && Object.keys(reportData.changes).length > 0) {
      md += '## 📝 Changes Made\n\n';

      Object.entries(reportData.changes).forEach(([category, categoryChanges]) => {
        if (categoryChanges.length === 0) return;

        md += `### ${category.charAt(0).toUpperCase() + category.slice(1)} Changes\n\n`;

        categoryChanges.forEach(change => {
          md += `- **${change.description}**\n`;
          if (change.before) md += `  - Before: \`${change.before}\`\n`;
          if (change.after) md += `  - After: \`${change.after}\`\n`;
          md += '\n';
        });
      });
    }

    // Statistics section
    if (reportData.statistics) {
      md += '## 📊 Statistics\n\n';

      if (Object.keys(reportData.statistics.changeTypes).length > 0) {
        md += '### Change Types\n\n';
        Object.entries(reportData.statistics.changeTypes)
          .sort(([, a], [, b]) => b - a)
          .forEach(([type, count]) => {
            md += `- ${type.replace(/_/g, ' ')}: ${count}\n`;
          });
        md += '\n';
      }
    }

    // Errors section
    if (reportData.errors.length > 0) {
      md += '## ❌ Errors\n\n';
      reportData.errors.forEach(error => {
        md += `- **${error.type || 'Error'}:** ${error.message}\n`;
        if (error.suggestion) md += `  - Suggestion: ${error.suggestion}\n`;
      });
      md += '\n';
    }

    // Warnings section
    if (reportData.warnings.length > 0) {
      md += '## ⚠️ Warnings\n\n';
      reportData.warnings.forEach(warning => {
        md += `- **${warning.type || 'Warning'}:** ${warning.message}\n`;
        if (warning.file) md += `  - File: ${warning.file}\n`;
      });
      md += '\n';
    }

    // Recommendations section
    if (reportData.recommendations.length > 0) {
      md += '## 💡 Recommendations\n\n';
      reportData.recommendations.forEach(rec => {
        const priority = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        md += `${priority} **${rec.message}**\n`;
        if (rec.action) md += `   - Action: ${rec.action}\n`;
        md += '\n';
      });
    }

    md += `---\n*Generated by MTM Migration Tool v${reportData.metadata.version}*\n`;

    return md;
  }

  /**
   * Generate output path based on format
   * @private
   */
  generateOutputPath(format) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const extension = format === 'html' ? 'html' : format === 'markdown' || format === 'md' ? 'md' : 'json';
    return `mtm-migration-report-${timestamp}.${extension}`;
  }

  /**
   * Escape HTML characters
   * @private
   */
  escapeHtml(text) {
    if (typeof text !== 'string') return text;

    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };

    return text.replace(/[&<>"']/g, m => map[m]);
  }
}

export default MigrationReportGenerator;