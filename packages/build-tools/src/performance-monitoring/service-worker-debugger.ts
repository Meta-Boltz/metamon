/**
 * Service Worker Debugger
 * Provides debugging and visualization tools for service worker operations
 */

import {
  DebugInfo,
  ServiceWorkerPerformance,
  BackgroundTaskMetrics,
  CacheOperationMetrics,
  PerformanceTimelineEntry
} from '../types/performance-monitoring.js';
import { FrameworkType } from '../types/framework-loader.js';

export interface ServiceWorkerDebugEvent {
  id: string;
  timestamp: number;
  type: 'registration' | 'activation' | 'message' | 'fetch' | 'cache' | 'error' | 'background-task';
  data: any;
  duration?: number;
  success: boolean;
  error?: string;
}

export interface ServiceWorkerState {
  registration: ServiceWorkerRegistration | null;
  controller: ServiceWorker | null;
  state: 'none' | 'installing' | 'installed' | 'activating' | 'activated' | 'redundant';
  scope: string;
  updateFound: boolean;
  controllerChanged: boolean;
}

export interface CacheDebugEntry {
  cacheName: string;
  keys: string[];
  size: number;
  lastAccessed: number;
  hitCount: number;
  missCount: number;
}

export interface MessageDebugEntry {
  id: string;
  timestamp: number;
  direction: 'to-sw' | 'from-sw';
  type: string;
  data: any;
  responseTime?: number;
  error?: string;
}

export class ServiceWorkerDebugger {
  private debugEvents: ServiceWorkerDebugEvent[] = new Map();
  private messageHistory: MessageDebugEntry[] = [];
  private cacheDebugInfo: Map<string, CacheDebugEntry> = new Map();
  private serviceWorkerState: ServiceWorkerState;
  private eventListeners: Map<string, EventListener[]> = new Map();
  private maxHistorySize: number = 500;
  private isDebugging: boolean = false;

  constructor() {
    this.serviceWorkerState = {
      registration: null,
      controller: null,
      state: 'none',
      scope: '',
      updateFound: false,
      controllerChanged: false
    };

    this.initializeServiceWorkerMonitoring();
  }

  /**
   * Start debugging service worker operations
   */
  startDebugging(): void {
    if (this.isDebugging) {
      return;
    }

    this.isDebugging = true;
    this.setupServiceWorkerListeners();
    this.startPeriodicStateCheck();
  }

  /**
   * Stop debugging service worker operations
   */
  stopDebugging(): void {
    if (!this.isDebugging) {
      return;
    }

    this.isDebugging = false;
    this.removeServiceWorkerListeners();
  }

  /**
   * Get current service worker state
   */
  getServiceWorkerState(): ServiceWorkerState {
    this.updateServiceWorkerState();
    return { ...this.serviceWorkerState };
  }

  /**
   * Get debug events
   */
  getDebugEvents(limit?: number): ServiceWorkerDebugEvent[] {
    const events = Array.from(this.debugEvents.values())
      .sort((a, b) => b.timestamp - a.timestamp);
    
    return limit ? events.slice(0, limit) : events;
  }

  /**
   * Get debug events by type
   */
  getDebugEventsByType(type: ServiceWorkerDebugEvent['type']): ServiceWorkerDebugEvent[] {
    return Array.from(this.debugEvents.values())
      .filter(event => event.type === type)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get message history
   */
  getMessageHistory(limit?: number): MessageDebugEntry[] {
    const messages = [...this.messageHistory].sort((a, b) => b.timestamp - a.timestamp);
    return limit ? messages.slice(0, limit) : messages;
  }

  /**
   * Get cache debug information
   */
  getCacheDebugInfo(): Map<string, CacheDebugEntry> {
    return new Map(this.cacheDebugInfo);
  }

  /**
   * Send debug message to service worker
   */
  async sendDebugMessage(type: string, data: any): Promise<any> {
    if (!this.serviceWorkerState.controller) {
      throw new Error('No active service worker controller');
    }

    const messageId = this.generateMessageId();
    const timestamp = Date.now();

    const message = {
      id: messageId,
      type: 'debug',
      subType: type,
      data,
      timestamp
    };

    // Record outgoing message
    this.recordMessage({
      id: messageId,
      timestamp,
      direction: 'to-sw',
      type,
      data
    });

    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        const responseTime = Date.now() - timestamp;
        
        // Update message with response time
        const messageEntry = this.messageHistory.find(m => m.id === messageId);
        if (messageEntry) {
          messageEntry.responseTime = responseTime;
        }

        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.result);
        }
      };

      this.serviceWorkerState.controller.postMessage(message, [channel.port2]);

      // Timeout after 5 seconds
      setTimeout(() => {
        reject(new Error('Service worker debug message timeout'));
      }, 5000);
    });
  }

  /**
   * Get service worker performance metrics
   */
  async getServiceWorkerMetrics(): Promise<ServiceWorkerPerformance> {
    try {
      const metrics = await this.sendDebugMessage('get-metrics', {});
      return metrics;
    } catch (error) {
      console.warn('Failed to get service worker metrics:', error);
      return this.getDefaultMetrics();
    }
  }

  /**
   * Get cache operations from service worker
   */
  async getCacheOperations(): Promise<CacheOperationMetrics[]> {
    try {
      const operations = await this.sendDebugMessage('get-cache-operations', {});
      return operations;
    } catch (error) {
      console.warn('Failed to get cache operations:', error);
      return [];
    }
  }

  /**
   * Get background task metrics from service worker
   */
  async getBackgroundTaskMetrics(): Promise<BackgroundTaskMetrics[]> {
    try {
      const tasks = await this.sendDebugMessage('get-background-tasks', {});
      return tasks;
    } catch (error) {
      console.warn('Failed to get background task metrics:', error);
      return [];
    }
  }

  /**
   * Clear service worker cache
   */
  async clearCache(cacheName?: string): Promise<void> {
    try {
      await this.sendDebugMessage('clear-cache', { cacheName });
      this.recordDebugEvent({
        type: 'cache',
        data: { operation: 'clear', cacheName },
        success: true
      });
    } catch (error) {
      this.recordDebugEvent({
        type: 'cache',
        data: { operation: 'clear', cacheName },
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Force service worker update
   */
  async forceUpdate(): Promise<void> {
    if (!this.serviceWorkerState.registration) {
      throw new Error('No service worker registration found');
    }

    try {
      await this.serviceWorkerState.registration.update();
      this.recordDebugEvent({
        type: 'registration',
        data: { operation: 'force-update' },
        success: true
      });
    } catch (error) {
      this.recordDebugEvent({
        type: 'registration',
        data: { operation: 'force-update' },
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get comprehensive debug information
   */
  async getDebugInfo(): Promise<DebugInfo> {
    const swState = this.getServiceWorkerState();
    const cacheInfo = this.getCacheDebugInfo();
    
    // Convert cache debug info to the expected format
    const cacheStatus = {
      totalSize: Array.from(cacheInfo.values()).reduce((sum, cache) => sum + cache.size, 0),
      entryCount: Array.from(cacheInfo.values()).reduce((sum, cache) => sum + cache.keys.length, 0),
      hitRate: this.calculateOverallHitRate(cacheInfo),
      oldestEntry: Math.min(...Array.from(cacheInfo.values()).map(cache => cache.lastAccessed)),
      newestEntry: Math.max(...Array.from(cacheInfo.values()).map(cache => cache.lastAccessed)),
      corruptedEntries: 0 // Would need to implement corruption detection
    };

    // Get framework states (simplified)
    const frameworkStates = new Map();
    [FrameworkType.REACT, FrameworkType.VUE, FrameworkType.SVELTE, FrameworkType.SOLID].forEach(framework => {
      frameworkStates.set(framework, {
        framework,
        status: 'not-loaded', // Would need to track actual states
        version: 'unknown',
        cacheHit: false,
        bundleSize: 0,
        dependencies: [],
        errors: []
      });
    });

    // Get network conditions
    const networkConditions = {
      online: navigator.onLine,
      effectiveType: (navigator as any).connection?.effectiveType || 'unknown',
      downlink: (navigator as any).connection?.downlink || 0,
      rtt: (navigator as any).connection?.rtt || 0,
      saveData: (navigator as any).connection?.saveData || false,
      requestsInFlight: 0 // Would need to track active requests
    };

    // Get recent errors and warnings
    const recentEvents = this.getDebugEvents(50);
    const errors = recentEvents
      .filter(event => !event.success && event.error)
      .map(event => ({
        id: event.id,
        type: event.type,
        message: event.error!,
        timestamp: event.timestamp,
        context: event.data
      }));

    const warnings = recentEvents
      .filter(event => event.type === 'cache' && event.data.operation === 'miss')
      .map(event => ({
        id: event.id,
        type: 'cache-miss',
        message: `Cache miss for ${event.data.key}`,
        timestamp: event.timestamp,
        context: event.data
      }));

    return {
      serviceWorkerState: swState.state,
      cacheStatus,
      frameworkStates,
      networkConditions,
      errors,
      warnings
    };
  }

  /**
   * Get performance timeline entries for service worker operations
   */
  getTimelineEntries(): PerformanceTimelineEntry[] {
    return this.getDebugEvents().map(event => ({
      timestamp: event.timestamp,
      type: event.type === 'cache' ? 'cache-operation' : 'framework-load',
      data: event.data,
      duration: event.duration
    }));
  }

  /**
   * Export debug data
   */
  exportDebugData(): {
    state: ServiceWorkerState;
    events: ServiceWorkerDebugEvent[];
    messages: MessageDebugEntry[];
    cacheInfo: Map<string, CacheDebugEntry>;
  } {
    return {
      state: this.getServiceWorkerState(),
      events: this.getDebugEvents(),
      messages: this.getMessageHistory(),
      cacheInfo: this.getCacheDebugInfo()
    };
  }

  /**
   * Clear debug history
   */
  clearDebugHistory(): void {
    this.debugEvents.clear();
    this.messageHistory = [];
    this.cacheDebugInfo.clear();
  }

  // Private methods

  private initializeServiceWorkerMonitoring(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        this.serviceWorkerState.registration = registration;
        this.updateServiceWorkerState();
      });
    }
  }

  private setupServiceWorkerListeners(): void {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    // Listen for service worker registration events
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      this.serviceWorkerState.controllerChanged = true;
      this.updateServiceWorkerState();
      this.recordDebugEvent({
        type: 'registration',
        data: { event: 'controllerchange' },
        success: true
      });
    });

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      this.handleServiceWorkerMessage(event);
    });

    // Listen for service worker updates
    navigator.serviceWorker.addEventListener('updatefound', () => {
      this.serviceWorkerState.updateFound = true;
      this.recordDebugEvent({
        type: 'registration',
        data: { event: 'updatefound' },
        success: true
      });
    });
  }

  private removeServiceWorkerListeners(): void {
    // Note: In a real implementation, you'd need to store references to the actual listener functions
    // to properly remove them. This is a simplified version.
  }

  private updateServiceWorkerState(): void {
    if (!('serviceWorker' in navigator)) {
      this.serviceWorkerState.state = 'none';
      return;
    }

    const controller = navigator.serviceWorker.controller;
    this.serviceWorkerState.controller = controller;

    if (controller) {
      this.serviceWorkerState.state = controller.state as any;
      this.serviceWorkerState.scope = controller.scriptURL;
    } else {
      this.serviceWorkerState.state = 'none';
    }
  }

  private handleServiceWorkerMessage(event: MessageEvent): void {
    const message = event.data;
    
    this.recordMessage({
      id: message.id || this.generateMessageId(),
      timestamp: Date.now(),
      direction: 'from-sw',
      type: message.type || 'unknown',
      data: message.data || message
    });

    // Handle specific message types
    if (message.type === 'cache-operation') {
      this.updateCacheDebugInfo(message.data);
    } else if (message.type === 'background-task') {
      this.recordDebugEvent({
        type: 'background-task',
        data: message.data,
        success: !message.data.error,
        error: message.data.error,
        duration: message.data.duration
      });
    }
  }

  private recordDebugEvent(eventData: Omit<ServiceWorkerDebugEvent, 'id' | 'timestamp'>): void {
    const event: ServiceWorkerDebugEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      ...eventData
    };

    this.debugEvents.set(event.id, event);

    // Limit history size
    if (this.debugEvents.size > this.maxHistorySize) {
      const oldestId = Array.from(this.debugEvents.keys())[0];
      this.debugEvents.delete(oldestId);
    }
  }

  private recordMessage(message: MessageDebugEntry): void {
    this.messageHistory.push(message);

    // Limit history size
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(-Math.floor(this.maxHistorySize * 0.8));
    }
  }

  private updateCacheDebugInfo(cacheData: any): void {
    const { cacheName, operation, key, success, size } = cacheData;
    
    let cacheEntry = this.cacheDebugInfo.get(cacheName);
    if (!cacheEntry) {
      cacheEntry = {
        cacheName,
        keys: [],
        size: 0,
        lastAccessed: Date.now(),
        hitCount: 0,
        missCount: 0
      };
      this.cacheDebugInfo.set(cacheName, cacheEntry);
    }

    cacheEntry.lastAccessed = Date.now();

    if (operation === 'get' || operation === 'match') {
      if (success) {
        cacheEntry.hitCount++;
      } else {
        cacheEntry.missCount++;
      }
    } else if (operation === 'put' && success) {
      if (!cacheEntry.keys.includes(key)) {
        cacheEntry.keys.push(key);
      }
      if (size) {
        cacheEntry.size += size;
      }
    } else if (operation === 'delete' && success) {
      const keyIndex = cacheEntry.keys.indexOf(key);
      if (keyIndex > -1) {
        cacheEntry.keys.splice(keyIndex, 1);
      }
    }
  }

  private calculateOverallHitRate(cacheInfo: Map<string, CacheDebugEntry>): number {
    let totalHits = 0;
    let totalRequests = 0;

    cacheInfo.forEach(cache => {
      totalHits += cache.hitCount;
      totalRequests += cache.hitCount + cache.missCount;
    });

    return totalRequests > 0 ? totalHits / totalRequests : 0;
  }

  private getDefaultMetrics(): ServiceWorkerPerformance {
    return {
      registrationTime: 0,
      activationTime: 0,
      cacheOperations: [],
      backgroundTasks: [],
      messageLatency: [],
      errorCount: 0,
      uptime: 0
    };
  }

  private startPeriodicStateCheck(): void {
    setInterval(() => {
      if (this.isDebugging) {
        this.updateServiceWorkerState();
      }
    }, 1000);
  }

  private generateEventId(): string {
    return `sw_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `sw_msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}