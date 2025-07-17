import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorReporter } from '../error-reporter';

describe('ErrorReporter', () => {
  let errorReporter: ErrorReporter;
  let onErrorSpy: ReturnType<typeof vi.fn>;
  let onClearSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onErrorSpy = vi.fn();
    onClearSpy = vi.fn();
    errorReporter = new ErrorReporter({
      onError: onErrorSpy,
      onClear: onClearSpy,
      debounceMs: 10 // Short debounce for testing
    });
  });

  afterEach(() => {
    errorReporter.dispose();
  });

  describe('reportFile', () => {
    it('should report errors for invalid MTM file', async () => {
      const content = `---
target: invalid-framework
---
content`;

      errorReporter.reportFile('test.mtm', content);

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(onErrorSpy).toHaveBeenCalledOnce();
      const report = onErrorSpy.mock.calls[0][0];
      expect(report.file).toBe('test.mtm');
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0].message).toContain('Unsupported target framework');
      expect(report.severity).toBe('error');
    });

    it('should report parse errors', async () => {
      const content = `---
invalid: [unclosed
---
content`;

      errorReporter.reportFile('test.mtm', content);

      await new Promise(resolve => setTimeout(resolve, 20));

      expect(onErrorSpy).toHaveBeenCalledOnce();
      const report = onErrorSpy.mock.calls[0][0];
      expect(report.errors[0].message).toContain('Parse error');
    });

    it('should clear errors when file becomes valid', async () => {
      // First report invalid file
      const invalidContent = `---
target: invalid-framework
---
content without imports`;
      errorReporter.reportFile('test.mtm', invalidContent);
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(onErrorSpy).toHaveBeenCalledOnce();

      // Then report valid file
      const validContent = `---
target: reactjs
---
import React from 'react';
export default function Component() { return <div />; }`;
      
      errorReporter.reportFile('test.mtm', validContent);
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(onClearSpy).toHaveBeenCalledWith('test.mtm');
    });

    it('should debounce multiple rapid calls', async () => {
      const content = `---
target: reactjs
---
function Component() { return <div />; }`; // Missing React import - will cause validation error

      // Make multiple rapid calls
      errorReporter.reportFile('test.mtm', content);
      errorReporter.reportFile('test.mtm', content);
      errorReporter.reportFile('test.mtm', content);

      await new Promise(resolve => setTimeout(resolve, 20));

      // Should only process once due to debouncing
      expect(onErrorSpy).toHaveBeenCalledOnce();
    });

    it('should not report if errors have not changed', async () => {
      const content = `---
target: invalid-framework
---
content without imports`;

      errorReporter.reportFile('test.mtm', content);
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(onErrorSpy).toHaveBeenCalledOnce();

      // Report same content again
      errorReporter.reportFile('test.mtm', content);
      await new Promise(resolve => setTimeout(resolve, 20));

      // Should not call onError again
      expect(onErrorSpy).toHaveBeenCalledOnce();
    });
  });

  describe('clearFile', () => {
    it('should clear file and call onClear', async () => {
      const content = `---
target: invalid-framework
---`;

      errorReporter.reportFile('test.mtm', content);
      await new Promise(resolve => setTimeout(resolve, 20));

      errorReporter.clearFile('test.mtm');

      expect(onClearSpy).toHaveBeenCalledWith('test.mtm');
      expect(errorReporter.getLastReport('test.mtm')).toBeUndefined();
    });
  });

  describe('getLastReport', () => {
    it('should return last report for file', async () => {
      const content = `---
target: invalid-framework
---
content without imports`;

      errorReporter.reportFile('test.mtm', content);
      await new Promise(resolve => setTimeout(resolve, 20));

      const report = errorReporter.getLastReport('test.mtm');
      expect(report).toBeDefined();
      expect(report!.file).toBe('test.mtm');
      expect(report!.errors.length).toBeGreaterThan(0);
    });

    it('should return undefined for unknown file', () => {
      const report = errorReporter.getLastReport('unknown.mtm');
      expect(report).toBeUndefined();
    });
  });

  describe('getAllReports', () => {
    it('should return all reports', async () => {
      const content1 = `---
target: invalid-framework
---`;
      const content2 = `---
channels: invalid
---`;

      errorReporter.reportFile('test1.mtm', content1);
      errorReporter.reportFile('test2.mtm', content2);
      await new Promise(resolve => setTimeout(resolve, 20));

      const allReports = errorReporter.getAllReports();
      expect(allReports.size).toBe(2);
      expect(allReports.has('test1.mtm')).toBe(true);
      expect(allReports.has('test2.mtm')).toBe(true);
    });
  });

  describe('dispose', () => {
    it('should clear all timers and reports', async () => {
      const content = `---
target: invalid-framework
---`;

      errorReporter.reportFile('test.mtm', content);
      
      errorReporter.dispose();

      // Wait longer than debounce time
      await new Promise(resolve => setTimeout(resolve, 20));

      // Should not have called onError because dispose cleared the timer
      expect(onErrorSpy).not.toHaveBeenCalled();
      expect(errorReporter.getAllReports().size).toBe(0);
    });
  });
});