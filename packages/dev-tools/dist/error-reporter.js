import { MTMFileParser } from './mtm-parser';
import { MTMValidator } from './mtm-validator';
export class ErrorReporter {
    constructor(options = {}) {
        this.parser = new MTMFileParser();
        this.validator = new MTMValidator();
        this.debounceTimers = new Map();
        this.lastReports = new Map();
        this.options = {
            debounceMs: 300,
            ...options
        };
    }
    reportFile(filePath, content) {
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
    processFile(filePath, content) {
        try {
            const parsed = this.parser.parse(content, filePath);
            const errors = this.validator.validate(parsed);
            const report = {
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
                }
                else if (errors.length > 0) {
                    // New errors or changed errors
                    this.options.onError?.(report);
                }
            }
        }
        catch (error) {
            const report = {
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
    reportsEqual(a, b) {
        if (!a)
            return false;
        if (a.errors.length !== b.errors.length)
            return false;
        return a.errors.every((errorA, index) => {
            const errorB = b.errors[index];
            return errorA.message === errorB.message &&
                errorA.offset === errorB.offset &&
                errorA.length === errorB.length;
        });
    }
    clearFile(filePath) {
        const timer = this.debounceTimers.get(filePath);
        if (timer) {
            clearTimeout(timer);
            this.debounceTimers.delete(filePath);
        }
        this.lastReports.delete(filePath);
        this.options.onClear?.(filePath);
    }
    getLastReport(filePath) {
        return this.lastReports.get(filePath);
    }
    getAllReports() {
        return new Map(this.lastReports);
    }
    dispose() {
        // Clear all timers
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
        this.lastReports.clear();
    }
}
