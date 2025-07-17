/**
 * Tests for hot reload debug logger
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HotReloadDebugLogger,
  initializeDebugLogger,
  getDebugLogger,
  logDebug,
  logInfo,
  logWarn,
  logError
} from '../hot-reload-debug-logger.js';
import { defaultHotReloadConfig } from '../hot-reload-config.js';

// Mock console methods
const mockConsole = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

vi.stubGlobal('console', mockConsole);

describe('HotReloadDebugLogger', () => {
  let logger: HotReloadDebugLogger;
  let config: typeof defaultHotReloadConfig;

  beforeEach(() => {
    config = {
      ...defaultHotReloadConfig,
      enableDebugLogging: true,
      logLevel: 'debug'
    };
    logger = new HotReloadDebugLogger(config);
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with empty logs', () => {
      const logs = logger.getLogs();
      expect(logs).toHaveLength(0);
    });

    it('should initialize without active session', () => {
      const session = logger.getCurrentSession();
      expect(session).toBeNull();
    });
  });

  describe('log', () => {
    it('should log messages at appropriate levels', () => {
      logger.log('info', 'test', 'Test message');
      
      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].category).toBe('test');
      expect(logs[0].message).toBe('Test message');
      expect(logs[0].timestamp).toBeTypeOf('number');
    });

    it('should include data when provided', () => {
      const testData = { key: 'value', number: 42 };
      logger.log('debug', 'test', 'Test with data', testData);
      
      const logs = logger.getLogs();
      expect(logs[0].data).toEqual(testData);
    });

    it('should include stack trace for error level', () => {
      logger.log('error', 'test', 'Error message');
      
      const logs = logger.getLogs();
      expect(logs[0].stack).toBeDefined();
      expect(logs[0].stack).toContain('Error');
    });

    it('should respect log level filtering', () => {
      const warnLogger = new HotReloadDebugLogger({
        ...config,
        logLevel: 'warn'
      });

      warnLogger.log('debug', 'test', 'Debug message');
      warnLogger.log('info', 'test', 'Info message');
      warnLogger.log('warn', 'test', 'Warn message');
      warnLogger.log('error', 'test', 'Error message');

      const logs = warnLogger.getLogs();
      expect(logs).toHaveLength(2); // Only warn and error
      expect(logs[0].level).toBe('warn');
      expect(logs[1].level).toBe('error');
    });

    it('should output to console when debug logging is enabled', () => {
      logger.log('info', 'test', 'Console test');
      
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] [test] Console test'),
        ''
      );
    });

    it('should not output to console when debug logging is disabled', () => {
      const quietLogger = new HotReloadDebugLogger({
        ...config,
        enableDebugLogging: false
      });

      quietLogger.log('info', 'test', 'Silent test');
      
      expect(mockConsole.info).not.toHaveBeenCalled();
    });
  });

  describe('session management', () => {
    it('should start a new session', () => {
      const sessionId = logger.startSession('test-session');
      
      expect(sessionId).toBe('test-session');
      
      const session = logger.getCurrentSession();
      expect(session).not.toBeNull();
      expect(session!.sessionId).toBe('test-session');
      expect(session!.startTime).toBeTypeOf('number');
      expect(session!.endTime).toBeUndefined();
      expect(session!.logs).toHaveLength(1); // Start session log
    });

    it('should generate session ID if not provided', () => {
      const sessionId = logger.startSession();
      
      expect(sessionId).toMatch(/^session_\d+$/);
    });

    it('should end current session', () => {
      logger.startSession('test-session');
      const endedSession = logger.endSession();
      
      expect(endedSession).not.toBeNull();
      expect(endedSession!.sessionId).toBe('test-session');
      expect(endedSession!.endTime).toBeTypeOf('number');
      
      const currentSession = logger.getCurrentSession();
      expect(currentSession).toBeNull();
    });

    it('should return null when ending session without active session', () => {
      const result = logger.endSession();
      expect(result).toBeNull();
    });

    it('should track session metrics', () => {
      logger.startSession('metrics-test');
      
      logger.logReloadAttempt('test.mtm', 'modification');
      logger.logReloadSuccess('test.mtm', 150, true);
      logger.logStatePreservationAttempt('component1', 'signals');
      logger.logStatePreservationSuccess('component1', 'signals', 25);

      const session = logger.getCurrentSession();
      expect(session!.metrics.reloadAttempts).toBe(1);
      expect(session!.metrics.successfulReloads).toBe(1);
      expect(session!.metrics.statePreservationAttempts).toBe(1);
      expect(session!.metrics.statePreservationSuccesses).toBe(1);
    });
  });

  describe('specialized logging methods', () => {
    beforeEach(() => {
      logger.startSession('test-session');
    });

    it('should log reload attempts', () => {
      logger.logReloadAttempt('test.mtm', 'modification');
      
      const logs = logger.getLogs('debug', 'reload');
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toContain('Reload attempt: test.mtm (modification)');
    });

    it('should log reload success', () => {
      logger.logReloadSuccess('test.mtm', 150, true);
      
      const logs = logger.getLogs('info', 'reload');
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toContain('Reload successful: test.mtm (150ms)');
      expect(logs[0].data).toEqual({ duration: 150, statePreserved: true });
    });

    it('should log reload failures', () => {
      const error = new Error('Compilation failed');
      logger.logReloadFailure('test.mtm', error);
      
      const logs = logger.getLogs('error', 'reload');
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toContain('Reload failed: test.mtm');
      expect(logs[0].data.error).toBe('Compilation failed');
    });

    it('should log state preservation attempts', () => {
      logger.logStatePreservationAttempt('component1', 'signals');
      
      const logs = logger.getLogs('debug', 'state');
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toContain('State preservation attempt: component1 (signals)');
    });

    it('should log state preservation success', () => {
      logger.logStatePreservationSuccess('component1', 'signals', 25);
      
      const logs = logger.getLogs('debug', 'state');
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toContain('State preserved: component1 (signals, 25ms)');
    });

    it('should log state preservation failures', () => {
      const error = new Error('State backup failed');
      logger.logStatePreservationFailure('component1', 'signals', error);
      
      const logs = logger.getLogs('warn', 'state');
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toContain('State preservation failed: component1 (signals)');
    });

    it('should log framework synchronization', () => {
      logger.logFrameworkSync(['react', 'vue'], 75);
      
      const logs = logger.getLogs('debug', 'sync');
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toContain('Framework sync completed: react, vue (75ms)');
    });

    it('should log error recovery', () => {
      const error = new Error('Recovery needed');
      logger.logErrorRecovery(error, 'rollback to previous state');
      
      const logs = logger.getLogs('warn', 'recovery');
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toContain('Error recovery: rollback to previous state');
    });
  });

  describe('log filtering', () => {
    beforeEach(() => {
      logger.log('debug', 'category1', 'Debug message');
      logger.log('info', 'category1', 'Info message');
      logger.log('warn', 'category2', 'Warn message');
      logger.log('error', 'category2', 'Error message');
    });

    it('should filter logs by level', () => {
      const warnAndAbove = logger.getLogs('warn');
      expect(warnAndAbove).toHaveLength(2);
      expect(warnAndAbove.every(log => ['warn', 'error'].includes(log.level))).toBe(true);
    });

    it('should filter logs by category', () => {
      const category1Logs = logger.getLogs(undefined, 'category1');
      expect(category1Logs).toHaveLength(2);
      expect(category1Logs.every(log => log.category === 'category1')).toBe(true);
    });

    it('should filter logs by both level and category', () => {
      const filtered = logger.getLogs('warn', 'category2');
      expect(filtered).toHaveLength(2);
      expect(filtered.every(log => log.category === 'category2' && ['warn', 'error'].includes(log.level))).toBe(true);
    });
  });

  describe('generateDebugReport', () => {
    it('should generate comprehensive debug report', () => {
      logger.startSession('report-test');
      logger.log('info', 'test', 'Test message');
      logger.log('error', 'error', 'Error message');
      logger.logReloadAttempt('test.mtm', 'modification');
      logger.logReloadSuccess('test.mtm', 150, true);

      const report = logger.generateDebugReport();
      
      expect(report).toContain('Hot Reload Debug Report');
      expect(report).toContain('Total Log Entries:');
      expect(report).toContain('Current Session');
      expect(report).toContain('Session ID: report-test');
      expect(report).toContain('Reload Attempts: 1');
      expect(report).toContain('Successful Reloads: 1');
      expect(report).toContain('Log Level Breakdown');
      expect(report).toContain('Category Breakdown');
    });
  });

  describe('utility functions', () => {
    it('should export logs as JSON', () => {
      logger.log('info', 'test', 'Export test');
      
      const exported = logger.exportLogs();
      const parsed = JSON.parse(exported);
      
      expect(parsed.logs).toHaveLength(1);
      expect(parsed.logs[0].message).toBe('Export test');
      expect(parsed.config.logLevel).toBe('debug');
    });

    it('should clear all logs', () => {
      logger.log('info', 'test', 'Clear test');
      logger.startSession('clear-session');
      
      logger.clearLogs();
      
      const logs = logger.getLogs();
      expect(logs).toHaveLength(0);
      
      const session = logger.getCurrentSession();
      expect(session!.logs).toHaveLength(0);
    });
  });

  describe('global functions', () => {
    it('should initialize and get global logger', () => {
      const globalLogger = initializeDebugLogger(config);
      expect(globalLogger).toBeInstanceOf(HotReloadDebugLogger);
      
      const retrieved = getDebugLogger();
      expect(retrieved).toBe(globalLogger);
    });

    it('should provide convenience logging functions', () => {
      initializeDebugLogger(config);
      
      logDebug('test', 'Debug message');
      logInfo('test', 'Info message');
      logWarn('test', 'Warn message');
      logError('test', 'Error message');
      
      const logger = getDebugLogger();
      const logs = logger!.getLogs();
      
      expect(logs).toHaveLength(4);
      expect(logs.map(l => l.level)).toEqual(['debug', 'info', 'warn', 'error']);
    });
  });
});