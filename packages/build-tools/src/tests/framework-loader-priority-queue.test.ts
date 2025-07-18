/**
 * Tests for Framework Loading Priority Queue
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FrameworkLoadingPriorityQueue } from '../framework-loader/priority-queue.js';
import { FrameworkType, LoadPriority, PriorityQueueItem } from '../types/framework-loader.js';

describe('FrameworkLoadingPriorityQueue', () => {
  let queue: FrameworkLoadingPriorityQueue;

  beforeEach(() => {
    queue = new FrameworkLoadingPriorityQueue();
  });

  describe('Basic Queue Operations', () => {
    it('should start empty', () => {
      expect(queue.isEmpty()).toBe(true);
      expect(queue.size()).toBe(0);
    });

    it('should enqueue and dequeue items', () => {
      const item = createMockQueueItem(FrameworkType.REACT, LoadPriority.NORMAL);
      
      queue.enqueue(item);
      expect(queue.isEmpty()).toBe(false);
      expect(queue.size()).toBe(1);
      
      const dequeued = queue.dequeue();
      expect(dequeued).toBe(item);
      expect(queue.isEmpty()).toBe(true);
    });

    it('should peek without removing item', () => {
      const item = createMockQueueItem(FrameworkType.REACT, LoadPriority.NORMAL);
      
      queue.enqueue(item);
      const peeked = queue.peek();
      
      expect(peeked).toBe(item);
      expect(queue.size()).toBe(1);
    });
  });

  describe('Priority Ordering', () => {
    it('should prioritize CRITICAL over other priorities', () => {
      const lowItem = createMockQueueItem(FrameworkType.REACT, LoadPriority.LOW);
      const criticalItem = createMockQueueItem(FrameworkType.VUE, LoadPriority.CRITICAL);
      const normalItem = createMockQueueItem(FrameworkType.SVELTE, LoadPriority.NORMAL);
      
      queue.enqueue(lowItem);
      queue.enqueue(criticalItem);
      queue.enqueue(normalItem);
      
      expect(queue.dequeue()).toBe(criticalItem);
      expect(queue.dequeue()).toBe(normalItem);
      expect(queue.dequeue()).toBe(lowItem);
    });

    it('should use FIFO for same priority items', () => {
      const item1 = createMockQueueItem(FrameworkType.REACT, LoadPriority.NORMAL, 1000);
      const item2 = createMockQueueItem(FrameworkType.VUE, LoadPriority.NORMAL, 2000);
      const item3 = createMockQueueItem(FrameworkType.SVELTE, LoadPriority.NORMAL, 3000);
      
      queue.enqueue(item1);
      queue.enqueue(item2);
      queue.enqueue(item3);
      
      expect(queue.dequeue()).toBe(item1);
      expect(queue.dequeue()).toBe(item2);
      expect(queue.dequeue()).toBe(item3);
    });

    it('should handle custom priority weights', () => {
      const customWeights = {
        [LoadPriority.CRITICAL]: 100,
        [LoadPriority.HIGH]: 50,
        [LoadPriority.NORMAL]: 25,
        [LoadPriority.LOW]: 1
      };
      
      const customQueue = new FrameworkLoadingPriorityQueue(customWeights);
      
      const lowItem = createMockQueueItem(FrameworkType.REACT, LoadPriority.LOW);
      const highItem = createMockQueueItem(FrameworkType.VUE, LoadPriority.HIGH);
      
      customQueue.enqueue(lowItem);
      customQueue.enqueue(highItem);
      
      expect(customQueue.dequeue()).toBe(highItem);
      expect(customQueue.dequeue()).toBe(lowItem);
    });
  });

  describe('Queue Management', () => {
    it('should remove specific items', () => {
      const item1 = createMockQueueItem(FrameworkType.REACT, LoadPriority.NORMAL);
      const item2 = createMockQueueItem(FrameworkType.VUE, LoadPriority.NORMAL);
      
      queue.enqueue(item1);
      queue.enqueue(item2);
      
      const removed = queue.remove(item => item.request.framework === FrameworkType.VUE);
      
      expect(removed).toBe(item2);
      expect(queue.size()).toBe(1);
      expect(queue.dequeue()).toBe(item1);
    });

    it('should clear all items', () => {
      const item1 = createMockQueueItem(FrameworkType.REACT, LoadPriority.NORMAL);
      const item2 = createMockQueueItem(FrameworkType.VUE, LoadPriority.NORMAL);
      
      queue.enqueue(item1);
      queue.enqueue(item2);
      
      const cleared = queue.clear();
      
      expect(cleared).toHaveLength(2);
      expect(queue.isEmpty()).toBe(true);
    });

    it('should get items by priority', () => {
      const criticalItem = createMockQueueItem(FrameworkType.REACT, LoadPriority.CRITICAL);
      const normalItem = createMockQueueItem(FrameworkType.VUE, LoadPriority.NORMAL);
      const anotherCriticalItem = createMockQueueItem(FrameworkType.SVELTE, LoadPriority.CRITICAL);
      
      queue.enqueue(criticalItem);
      queue.enqueue(normalItem);
      queue.enqueue(anotherCriticalItem);
      
      const criticalItems = queue.getItemsByPriority(LoadPriority.CRITICAL);
      
      expect(criticalItems).toHaveLength(2);
      expect(criticalItems).toContain(criticalItem);
      expect(criticalItems).toContain(anotherCriticalItem);
    });

    it('should get items by framework', () => {
      const reactItem1 = createMockQueueItem(FrameworkType.REACT, LoadPriority.NORMAL);
      const vueItem = createMockQueueItem(FrameworkType.VUE, LoadPriority.NORMAL);
      const reactItem2 = createMockQueueItem(FrameworkType.REACT, LoadPriority.HIGH);
      
      queue.enqueue(reactItem1);
      queue.enqueue(vueItem);
      queue.enqueue(reactItem2);
      
      const reactItems = queue.getItemsByFramework(FrameworkType.REACT);
      
      expect(reactItems).toHaveLength(2);
      expect(reactItems).toContain(reactItem1);
      expect(reactItems).toContain(reactItem2);
    });
  });

  describe('Statistics', () => {
    it('should provide queue statistics', () => {
      const now = Date.now();
      const oldItem = createMockQueueItem(FrameworkType.REACT, LoadPriority.NORMAL, now - 5000);
      const newItem = createMockQueueItem(FrameworkType.VUE, LoadPriority.CRITICAL, now - 1000);
      
      queue.enqueue(oldItem);
      queue.enqueue(newItem);
      
      const stats = queue.getStats();
      
      expect(stats.totalItems).toBe(2);
      expect(stats.itemsByPriority[LoadPriority.NORMAL]).toBe(1);
      expect(stats.itemsByPriority[LoadPriority.CRITICAL]).toBe(1);
      expect(stats.oldestItem?.framework).toBe(FrameworkType.REACT);
      expect(stats.averageAge).toBeGreaterThan(0);
    });
  });

  describe('Priority Weight Updates', () => {
    it('should update priority weights and re-sort queue', () => {
      const lowItem = createMockQueueItem(FrameworkType.REACT, LoadPriority.LOW);
      const normalItem = createMockQueueItem(FrameworkType.VUE, LoadPriority.NORMAL);
      
      queue.enqueue(lowItem);
      queue.enqueue(normalItem);
      
      // Normal should come first with default weights
      expect(queue.peek()).toBe(normalItem);
      
      // Update weights to prioritize LOW over NORMAL
      queue.updatePriorityWeights({
        [LoadPriority.CRITICAL]: 1000,
        [LoadPriority.HIGH]: 100,
        [LoadPriority.NORMAL]: 5,
        [LoadPriority.LOW]: 10
      });
      
      // Now LOW should come first
      expect(queue.peek()).toBe(lowItem);
    });
  });
});

// Helper function to create mock queue items
function createMockQueueItem(
  framework: FrameworkType, 
  priority: LoadPriority,
  timestamp: number = Date.now()
): PriorityQueueItem {
  return {
    request: {
      framework,
      priority,
      timeout: 5000
    },
    timestamp,
    resolve: () => {},
    reject: () => {}
  };
}