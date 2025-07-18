/**
 * Priority Queue for Framework Loading Requests
 */

import { LoadPriority, PriorityQueueItem } from '../types/framework-loader.js';

/**
 * Priority queue implementation for framework loading requests
 * Higher priority items are processed first
 */
export class FrameworkLoadingPriorityQueue {
  private queue: PriorityQueueItem[] = [];
  private priorityWeights: Record<LoadPriority, number>;

  constructor(priorityWeights?: Record<LoadPriority, number>) {
    this.priorityWeights = priorityWeights || {
      [LoadPriority.CRITICAL]: 1000,
      [LoadPriority.HIGH]: 100,
      [LoadPriority.NORMAL]: 10,
      [LoadPriority.LOW]: 1
    };
  }

  /**
   * Add item to priority queue
   */
  enqueue(item: PriorityQueueItem): void {
    this.queue.push(item);
    this.queue.sort((a, b) => this.compareItems(a, b)); // Sort with proper comparison
  }

  /**
   * Remove and return highest priority item
   */
  dequeue(): PriorityQueueItem | undefined {
    return this.queue.shift();
  }

  /**
   * Peek at highest priority item without removing it
   */
  peek(): PriorityQueueItem | undefined {
    return this.queue[0];
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Remove specific item from queue
   */
  remove(predicate: (item: PriorityQueueItem) => boolean): PriorityQueueItem | undefined {
    const index = this.queue.findIndex(predicate);
    if (index !== -1) {
      return this.queue.splice(index, 1)[0];
    }
    return undefined;
  }

  /**
   * Clear all items from queue
   */
  clear(): PriorityQueueItem[] {
    const items = [...this.queue];
    this.queue = [];
    return items;
  }

  /**
   * Get all items with specific priority
   */
  getItemsByPriority(priority: LoadPriority): PriorityQueueItem[] {
    return this.queue.filter(item => item.request.priority === priority);
  }

  /**
   * Get all items for specific framework
   */
  getItemsByFramework(framework: string): PriorityQueueItem[] {
    return this.queue.filter(item => item.request.framework === framework);
  }

  /**
   * Update priority weights and re-sort queue
   */
  updatePriorityWeights(weights: Record<LoadPriority, number>): void {
    this.priorityWeights = weights;
    this.queue.sort((a, b) => this.compareItems(a, b));
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    totalItems: number;
    itemsByPriority: Record<LoadPriority, number>;
    oldestItem?: { framework: string; age: number };
    averageAge: number;
  } {
    const now = Date.now();
    const itemsByPriority = {
      [LoadPriority.CRITICAL]: 0,
      [LoadPriority.HIGH]: 0,
      [LoadPriority.NORMAL]: 0,
      [LoadPriority.LOW]: 0
    };

    let oldestItem: { framework: string; age: number } | undefined;
    let totalAge = 0;

    for (const item of this.queue) {
      itemsByPriority[item.request.priority]++;
      
      const age = now - item.timestamp;
      totalAge += age;
      
      if (!oldestItem || age > oldestItem.age) {
        oldestItem = {
          framework: item.request.framework,
          age
        };
      }
    }

    return {
      totalItems: this.queue.length,
      itemsByPriority,
      oldestItem,
      averageAge: this.queue.length > 0 ? totalAge / this.queue.length : 0
    };
  }

  /**
   * Compare two queue items for priority ordering
   * Higher priority weights should come first (descending order)
   */
  private compareItems(a: PriorityQueueItem, b: PriorityQueueItem): number {
    const priorityDiff = this.priorityWeights[b.request.priority] - this.priorityWeights[a.request.priority];
    
    // If priorities are equal, use timestamp (FIFO for same priority)
    if (priorityDiff === 0) {
      return a.timestamp - b.timestamp;
    }
    
    return priorityDiff;
  }
}