import { MTMFileParser, MTMFile } from './mtm-parser';
import { MTMValidator, ValidationError } from './mtm-validator';

export interface ErrorReport {
  file: string;
  errors: ValidationError[];
  timestamp: Date;
  severity: 'error' | 'warning' | 'info';
}

export interface ErrorReporterOptions {
  onError?: (report: ErrorReport) => void;
  onClear?: (file: string) => void;
  debounceMs?: number;
}

export class ErrorReporter {
  private parser = new MTMFileParser();
  private validator = new MTMValidator();
  private options: ErrorReporterOptions;
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private lastReports = new Map<string, ErrorReport>();

  constructor(options: ErrorReporterOptions = {}) {
    this.options = {
      debounceMs: 300,
      ...options
    };
  }

  reportFile(filePath: string, content: string): void {
    // Clear existing timer for this file
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounced timer
    const timer = setTimeout(() => {
      this.processFile(filePath, content);
      this.debounceTimers.delete(filePath);
    }, this.options.debounceMs);

    this.debounceTimers.set(filePath, timer);
  }

  private processFile(filePath: string, content: string): void {
    try {
      const parsed = this.parser.parse(content, filePath);
      const errors = this.validator.validate(parsed);

      const report: ErrorReport = {
        file: filePath,
        errors,
        timestamp: new Date(),
        severity: errors.length > 0 ? 'error' : 'info'
      };

      // Check if errors have changed
      const lastReport = this.lastReports.get(filePath);
      if (!this.reportsEqual(lastReport, report)) {
        this.lastReports.set(filePath, report);

        if (errors.length === 0 && lastReport && lastReport.errors.length > 0) {
          // Errors cleared
          this.options.onClear?.(filePath);
        } else if (errors.length > 0) {
          // New errors or changed errors
          this.options.onError?.(report);
        }
      }
    } catch (error) {
      const report: ErrorReport = {
        file: filePath,
        errors: [{
          message: `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          suggestions: ['Check file syntax and structure']
        }],
        timestamp: new Date(),
        severity: 'error'
      };

      this.lastReports.set(filePath, report);
      this.options.onError?.(report);
    }
  }

  private reportsEqual(a: ErrorReport | undefined, b: ErrorReport): boolean {
    if (!a) return false;
    if (a.errors.length !== b.errors.length) return false;

    return a.errors.every((errorA, index) => {
      const errorB = b.errors[index];
      return errorA.message === errorB.message &&
             errorA.offset === errorB.offset &&
             errorA.length === errorB.length;
    });
  }

  clearFile(filePath: string): void {
    const timer = this.debounceTimers.get(filePath);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(filePath);
    }
    this.lastReports.delete(filePath);
    this.options.onClear?.(filePath);
  }

  getLastReport(filePath: string): ErrorReport | undefined {
    return this.lastReports.get(filePath);
  }

  getAllReports(): Map<string, ErrorReport> {
    return new Map(this.lastReports);
  }

  dispose(): void {
    // Clear all timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.lastReports.clear();
  }
}