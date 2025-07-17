/**
 * Hot reload debugging utilities and logging system
 */

import { HotReloadConfig } from './hot-reload-config.js';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  stack?: string;
}

export interface DebugSession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  logs: LogEntry[];
  metrics: {
    reloadAttempts: number;
    successfulReloads: number;
    failedReloads: number;
    statePreservationAttempts: number;
    statePreservationSuccesses: number;
  };
}

/**
 * Hot reload debug logger
 */
export class HotReloadDebugLogger {
  private config: HotReloadConfig;
  private logs: LogEntry[] = [];
  private currentSession: DebugSession | null = null;
  private maxLogSize = 1000;
  private logLevels: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
  };

  constructor(config: HotReloadConfig) {
    this.config = config;
  }

  /**
   * Start a new debug session
   */
  startSession(sessionId?: string): string {
    const id = sessionId || `session_${Date.now()}`;
    
    this.currentSession = {
      sessionId: id,
      startTime: Date.now(),
      logs: [],
      metrics: {
        reloadAttempts: 0,
        successfulReloads: 0,
        failedReloads: 0,
        statePreservationAttempts: 0,
        statePreservationSuccesses: 0
      }
    };

    this.log('info', 'session', `Debug session started: ${id}`);
    return id;
  }

  /**
   * End the current debug session
   */
  endSession(): DebugSession | null {
    if (!this.currentSession) return null;

    this.currentSession.endTime = Date.now();
    this.log('info', 'session', `Debug session ended: ${this.currentSession.sessionId}`);
    
    const session = this.currentSession;
    this.currentSession = null;
    return session;
  }

  /**
   * Log a message
   */
  log(level: LogLevel, category: string, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data: data ? this.sanitizeData(data) : undefined,
      stack: level === 'error' ? new Error().stack : undefined
    };

    // Add to global logs
    this.logs.push(entry);
    if (this.logs.length > this.maxLogSize) {
      this.logs.shift();
    }

    // Add to current session
    if (this.currentSession) {
      this.currentSession.logs.push(entry);
    }

    // Output to console if debug logging is enabled
    if (this.config.enableDebugLogging) {
      this.outputToConsole(entry);
    }
  }

  /**
   * Log reload attempt
   */
  logReloadAttempt(filePath: string, changeType: string): void {
    if (this.currentSession) {
      this.currentSession.metrics.reloadAttempts++;
    }
    
    this.log('debug', 'reload', `Reload attempt: ${filePath} (${changeType})`);
  }

  /**
   * Log successful reload
   */
  logReloadSuccess(filePath: string, duration: number, statePreserved: boolean): void {
    if (this.currentSession) {
      this.currentSession.metrics.successfulReloads++;
    }
    
    this.log('info', 'reload', `Reload successful: ${filePath} (${duration}ms)`, {
      duration,
      statePreserved
    });
  }

  /**
   * Log failed reload
   */
  logReloadFailure(filePath: string, error: Error): void {
    if (this.currentSession) {
      this.currentSession.metrics.failedReloads++;
    }
    
    this.log('error', 'reload', `Reload failed: ${filePath}`, {
      error: error.message,
      stack: error.stack
    });
  }

  /**
   * Log state preservation attempt
   */
  logStatePreservationAttempt(componentId: string, stateType: string): void {
    if (this.currentSession) {
      this.currentSession.metrics.statePreservationAttempts++;
    }
    
    this.log('debug', 'state', `State preservation attempt: ${componentId} (${stateType})`);
  }

  /**
   * Log state preservation success
   */
  logStatePreservationSuccess(componentId: string, stateType: string, duration: number): void {
    if (this.currentSession) {
      this.currentSession.metrics.statePreservationSuccesses++;
    }
    
    this.log('debug', 'state', `State preserved: ${componentId} (${stateType}, ${duration}ms)`);
  }

  /**
   * Log state preservation failure
   */
  logStatePreservationFailure(componentId: string, stateType: string, error: Error): void {
    this.log('warn', 'state', `State preservation failed: ${componentId} (${stateType})`, {
      error: error.message
    });
  }

  /**
   * Log framework synchronization
   */
  logFrameworkSync(frameworks: string[], duration: number): void {
    this.log('debug', 'sync', `Framework sync completed: ${frameworks.join(', ')} (${duration}ms)`);
  }

  /**
   * Log error recovery
   */
  logErrorRecovery(error: Error, recoveryAction: string): void {
    this.log('warn', 'recovery', `Error recovery: ${recoveryAction}`, {
      error: error.message
    });
  }

  /**
   * Get all logs
   */
  getLogs(level?: LogLevel, category?: string): LogEntry[] {
    let filteredLogs = [...this.logs];

    if (level) {
      const levelValue = this.logLevels[level];
      filteredLogs = filteredLogs.filter(log => this.logLevels[log.level] <= levelValue);
    }

    if (category) {
      filteredLogs = filteredLogs.filter(log => log.category === category);
    }

    return filteredLogs;
  }

  /**
   * Get current session
   */
  getCurrentSession(): DebugSession | null {
    return this.currentSession;
  }

  /**
   * Export logs to JSON
   */
  exportLogs(): string {
    return JSON.stringify({
      logs: this.logs,
      currentSession: this.currentSession,
      config: {
        logLevel: this.config.logLevel,
        enableDebugLogging: this.config.enableDebugLogging
      }
    }, null, 2);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    if (this.currentSession) {
      this.currentSession.logs = [];
    }
  }

  /**
   * Generate debug report
   */
  generateDebugReport(): string {
    const report = [];
    
    report.push('=== Hot Reload Debug Report ===');
    report.push(`Total Log Entries: ${this.logs.length}`);
    report.push(`Log Level: ${this.config.logLevel}`);
    report.push(`Debug Logging: ${this.config.enableDebugLogging ? 'Enabled' : 'Disabled'}`);
    report.push('');

    if (this.currentSession) {
      const session = this.currentSession;
      const duration = Date.now() - session.startTime;
      
      report.push('=== Current Session ===');
      report.push(`Session ID: ${session.sessionId}`);
      report.push(`Duration: ${duration}ms`);
      report.push(`Reload Attempts: ${session.metrics.reloadAttempts}`);
      report.push(`Successful Reloads: ${session.metrics.successfulReloads}`);
      report.push(`Failed Reloads: ${session.metrics.failedReloads}`);
      report.push(`State Preservation Attempts: ${session.metrics.statePreservationAttempts}`);
      report.push(`State Preservation Successes: ${session.metrics.statePreservationSuccesses}`);
      report.push('');
    }

    // Log level breakdown
    const levelCounts = this.logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<LogLevel, number>);

    report.push('=== Log Level Breakdown ===');
    Object.entries(levelCounts).forEach(([level, count]) => {
      report.push(`${level.toUpperCase()}: ${count}`);
    });
    report.push('');

    // Category breakdown
    const categoryCount = this.logs.reduce((acc, log) => {
      acc[log.category] = (acc[log.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    report.push('=== Category Breakdown ===');
    Object.entries(categoryCount).forEach(([category, count]) => {
      report.push(`${category}: ${count}`);
    });

    return report.join('\n');
  }

  /**
   * Check if should log at given level
   */
  private shouldLog(level: LogLevel): boolean {
    const configLevel = this.logLevels[this.config.logLevel];
    const messageLevel = this.logLevels[level];
    return messageLevel <= configLevel;
  }

  /**
   * Sanitize data for logging
   */
  private sanitizeData(data: any): any {
    try {
      return JSON.parse(JSON.stringify(data));
    } catch {
      return String(data);
    }
  }

  /**
   * Output log entry to console
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.category}]`;
    
    switch (entry.level) {
      case 'error':
        console.error(`${prefix} ${entry.message}`, entry.data || '');
        if (entry.stack) console.error(entry.stack);
        break;
      case 'warn':
        console.warn(`${prefix} ${entry.message}`, entry.data || '');
        break;
      case 'info':
        console.info(`${prefix} ${entry.message}`, entry.data || '');
        break;
      case 'debug':
        console.debug(`${prefix} ${entry.message}`, entry.data || '');
        break;
    }
  }
}

/**
 * Global debug logger instance
 */
let globalLogger: HotReloadDebugLogger | null = null;

/**
 * Initialize global debug logger
 */
export function initializeDebugLogger(config: HotReloadConfig): HotReloadDebugLogger {
  globalLogger = new HotReloadDebugLogger(config);
  return globalLogger;
}

/**
 * Get global debug logger instance
 */
export function getDebugLogger(): HotReloadDebugLogger | null {
  return globalLogger;
}

/**
 * Convenience logging functions
 */
export function logDebug(category: string, message: string, data?: any): void {
  globalLogger?.log('debug', category, message, data);
}

export function logInfo(category: string, message: string, data?: any): void {
  globalLogger?.log('info', category, message, data);
}

export function logWarn(category: string, message: string, data?: any): void {
  globalLogger?.log('warn', category, message, data);
}

export function logError(category: string, message: string, data?: any): void {
  globalLogger?.log('error', category, message, data);
}