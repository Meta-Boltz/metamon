/**
 * Framework Loading Time Tracker
 * Tracks and analyzes framework loading performance
 */

import {
  FrameworkLoadingPerformance,
  PerformanceTimelineEntry
} from '../types/performance-monitoring.js';
import { FrameworkType, LoadPriority } from '../types/framework-loader.js';

export interface LoadingSession {
  id: string;
  framework: FrameworkType;
  startTime: number;
  endTime?: number;
  priority: LoadPriority;
  cacheAttempted: boolean;
  cacheHit?: boolean;
  networkLatency?: number;
  bundleSize?: number;
  parseStartTime?: number;
  parseEndTime?: number;
  executionStartTime?: number;
  executionEndTime?: number;
  error?: Error;
}

export interface LoadingStats {
  framework: FrameworkType;
  totalLoads: number;
  successfulLoads: number;
  failedLoads: number;
  averageLoadTime: number;
  medianLoadTime: number;
  p95LoadTime: number;
  cacheHitRate: number;
  averageBundleSize: number;
  loadTimesByPriority: Map<LoadPriority, number[]>;
  loadTimesTrend: { timestamp: number; loadTime: number }[];
}

export class FrameworkLoadingTracker {
  private activeSessions: Map<string, LoadingSession> = new Map();
  private completedSessions: LoadingSession[] = [];
  private maxHistorySize: number = 1000;
  private performanceMarks: Map<string, number> = new Map();

  /**
   * Start tracking a framework loading session
   */
  startLoading(
    framework: FrameworkType,
    priority: LoadPriority = LoadPriority.NORMAL,
    options: {
      cacheAttempted?: boolean;
      expectedBundleSize?: number;
    } = {}
  ): string {
    const sessionId = this.generateSessionId(framework);
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const session: LoadingSession = {
      id: sessionId,
      framework,
      startTime,
      priority,
      cacheAttempted: options.cacheAttempted || false,
      bundleSize: options.expectedBundleSize
    };

    this.activeSessions.set(sessionId, session);
    
    // Create performance mark
    const markName = `framework-load-start-${sessionId}`;
    try {
      if (typeof performance !== 'undefined') {
        performance.mark(markName);
      }
    } catch (error) {
      // Ignore performance API errors
    }
    this.performanceMarks.set(sessionId, startTime);

    return sessionId;
  }

  /**
   * Record cache hit/miss for a loading session
   */
  recordCacheResult(sessionId: string, cacheHit: boolean): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.cacheHit = cacheHit;
    }
  }

  /**
   * Record network latency for a loading session
   */
  recordNetworkLatency(sessionId: string, latency: number): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.networkLatency = latency;
    }
  }

  /**
   * Record bundle size for a loading session
   */
  recordBundleSize(sessionId: string, size: number): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.bundleSize = size;
    }
  }

  /**
   * Record parse timing for a loading session
   */
  recordParseTime(sessionId: string, startTime?: number, endTime?: number): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      if (startTime !== undefined) {
        session.parseStartTime = startTime;
      }
      if (endTime !== undefined) {
        session.parseEndTime = endTime;
      }
    }
  }

  /**
   * Record execution timing for a loading session
   */
  recordExecutionTime(sessionId: string, startTime?: number, endTime?: number): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      if (startTime !== undefined) {
        session.executionStartTime = startTime;
      }
      if (endTime !== undefined) {
        session.executionEndTime = endTime;
      }
    }
  }

  /**
   * Complete a loading session successfully
   */
  completeLoading(sessionId: string): FrameworkLoadingPerformance | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    session.endTime = endTime;

    // Create performance measure
    const measureName = `framework-load-${sessionId}`;
    const markName = `framework-load-start-${sessionId}`;
    
    try {
      if (typeof performance !== 'undefined') {
        performance.measure(measureName, markName);
      }
    } catch (error) {
      console.warn('Failed to create performance measure:', error);
    }

    // Move to completed sessions
    this.activeSessions.delete(sessionId);
    this.completedSessions.push(session);

    // Limit history size
    if (this.completedSessions.length > this.maxHistorySize) {
      this.completedSessions = this.completedSessions.slice(-Math.floor(this.maxHistorySize * 0.8));
    }

    // Create performance data
    const performanceData: FrameworkLoadingPerformance = {
      framework: session.framework,
      loadStartTime: session.startTime,
      loadEndTime: endTime,
      loadDuration: endTime - session.startTime,
      cacheHit: session.cacheHit || false,
      bundleSize: session.bundleSize || 0,
      priority: session.priority,
      networkLatency: session.networkLatency,
      parseTime: session.parseStartTime && session.parseEndTime 
        ? session.parseEndTime - session.parseStartTime 
        : undefined,
      executionTime: session.executionStartTime && session.executionEndTime
        ? session.executionEndTime - session.executionStartTime
        : undefined
    };

    return performanceData;
  }

  /**
   * Fail a loading session
   */
  failLoading(sessionId: string, error: Error): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return;
    }

    session.endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    session.error = error;

    // Move to completed sessions
    this.activeSessions.delete(sessionId);
    this.completedSessions.push(session);
  }

  /**
   * Get loading statistics for a specific framework
   */
  getFrameworkStats(framework: FrameworkType): LoadingStats {
    const frameworkSessions = this.completedSessions.filter(s => s.framework === framework);
    const successfulSessions = frameworkSessions.filter(s => !s.error && s.endTime);
    const failedSessions = frameworkSessions.filter(s => s.error);

    const loadTimes = successfulSessions
      .map(s => s.endTime! - s.startTime)
      .sort((a, b) => a - b);

    const cacheHits = successfulSessions.filter(s => s.cacheHit).length;
    const bundleSizes = successfulSessions
      .filter(s => s.bundleSize)
      .map(s => s.bundleSize!);

    // Group load times by priority
    const loadTimesByPriority = new Map<LoadPriority, number[]>();
    successfulSessions.forEach(session => {
      const loadTime = session.endTime! - session.startTime;
      const existing = loadTimesByPriority.get(session.priority) || [];
      existing.push(loadTime);
      loadTimesByPriority.set(session.priority, existing);
    });

    // Create trend data (last 50 loads)
    const recentSessions = successfulSessions.slice(-50);
    const loadTimesTrend = recentSessions.map(session => ({
      timestamp: session.startTime,
      loadTime: session.endTime! - session.startTime
    }));

    return {
      framework,
      totalLoads: frameworkSessions.length,
      successfulLoads: successfulSessions.length,
      failedLoads: failedSessions.length,
      averageLoadTime: loadTimes.length > 0 ? loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length : 0,
      medianLoadTime: loadTimes.length > 0 ? loadTimes[Math.floor(loadTimes.length / 2)] : 0,
      p95LoadTime: loadTimes.length > 0 ? loadTimes[Math.floor(loadTimes.length * 0.95)] : 0,
      cacheHitRate: successfulSessions.length > 0 ? cacheHits / successfulSessions.length : 0,
      averageBundleSize: bundleSizes.length > 0 ? bundleSizes.reduce((a, b) => a + b, 0) / bundleSizes.length : 0,
      loadTimesByPriority,
      loadTimesTrend
    };
  }

  /**
   * Get overall loading statistics across all frameworks
   */
  getOverallStats(): {
    totalLoads: number;
    successfulLoads: number;
    failedLoads: number;
    averageLoadTime: number;
    cacheHitRate: number;
    frameworkStats: Map<FrameworkType, LoadingStats>;
  } {
    const allFrameworks = [FrameworkType.REACT, FrameworkType.VUE, FrameworkType.SVELTE, FrameworkType.SOLID];
    const frameworkStats = new Map<FrameworkType, LoadingStats>();

    let totalLoads = 0;
    let successfulLoads = 0;
    let failedLoads = 0;
    let totalLoadTime = 0;
    let totalCacheHits = 0;

    allFrameworks.forEach(framework => {
      const stats = this.getFrameworkStats(framework);
      frameworkStats.set(framework, stats);

      totalLoads += stats.totalLoads;
      successfulLoads += stats.successfulLoads;
      failedLoads += stats.failedLoads;
      totalLoadTime += stats.averageLoadTime * stats.successfulLoads;
      totalCacheHits += stats.cacheHitRate * stats.successfulLoads;
    });

    return {
      totalLoads,
      successfulLoads,
      failedLoads,
      averageLoadTime: successfulLoads > 0 ? totalLoadTime / successfulLoads : 0,
      cacheHitRate: successfulLoads > 0 ? totalCacheHits / successfulLoads : 0,
      frameworkStats
    };
  }

  /**
   * Get active loading sessions
   */
  getActiveSessions(): LoadingSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get recent completed sessions
   */
  getRecentSessions(limit: number = 50): LoadingSession[] {
    return this.completedSessions
      .slice(-limit)
      .sort((a, b) => (b.endTime || b.startTime) - (a.endTime || a.startTime));
  }

  /**
   * Get performance timeline entries for framework loading
   */
  getTimelineEntries(): PerformanceTimelineEntry[] {
    return this.completedSessions
      .filter(session => session.endTime)
      .map(session => ({
        timestamp: session.endTime!,
        type: 'framework-load' as const,
        data: {
          framework: session.framework,
          loadDuration: session.endTime! - session.startTime,
          cacheHit: session.cacheHit,
          priority: session.priority,
          bundleSize: session.bundleSize,
          networkLatency: session.networkLatency,
          parseTime: session.parseStartTime && session.parseEndTime 
            ? session.parseEndTime - session.parseStartTime 
            : undefined,
          executionTime: session.executionStartTime && session.executionEndTime
            ? session.executionEndTime - session.executionStartTime
            : undefined,
          error: session.error?.message
        },
        duration: session.endTime! - session.startTime
      }));
  }

  /**
   * Clear old sessions to free memory
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    
    // Clear old completed sessions
    this.completedSessions = this.completedSessions.filter(
      session => now - session.startTime < maxAge
    );

    // Clear old active sessions (likely stale)
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now - session.startTime > staleThreshold) {
        this.activeSessions.delete(sessionId);
      }
    }

    // Clear old performance marks
    this.performanceMarks.forEach((timestamp, sessionId) => {
      if (now - timestamp > maxAge) {
        this.performanceMarks.delete(sessionId);
        try {
          performance.clearMarks(`framework-load-start-${sessionId}`);
          performance.clearMeasures(`framework-load-${sessionId}`);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });
  }

  /**
   * Export data for analysis
   */
  exportData(): {
    activeSessions: LoadingSession[];
    completedSessions: LoadingSession[];
    stats: ReturnType<typeof this.getOverallStats>;
  } {
    return {
      activeSessions: this.getActiveSessions(),
      completedSessions: this.completedSessions,
      stats: this.getOverallStats()
    };
  }

  private generateSessionId(framework: FrameworkType): string {
    return `${framework}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}