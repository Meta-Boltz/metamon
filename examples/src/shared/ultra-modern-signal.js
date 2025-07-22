/**
 * Ultra-Modern MTM Signal System
 * Unified signal system for state management and event communication
 */

class UltraModernSignal {
  constructor() {
    this.signals = new Map();
    this.listeners = new Map();
  }

  /**
   * Create or get a signal
   */
  signal(key, initialValue) {
    if (!this.signals.has(key)) {
      this.signals.set(key, {
        value: initialValue,
        subscribers: new Set()
      });
    }
    
    const signalData = this.signals.get(key);
    
    // Return reactive getter/setter
    return {
      get value() {
        return signalData.value;
      },
      
      set value(newValue) {
        const oldValue = signalData.value;
        signalData.value = newValue;
        
        // Notify all subscribers
        signalData.subscribers.forEach(callback => {
          callback(newValue, oldValue);
        });
        
        // Emit change event
        this.emit(`${key}:changed`, { key, value: newValue, oldValue });
      },
      
      // Subscribe to changes
      subscribe(callback) {
        signalData.subscribers.add(callback);
        return () => signalData.subscribers.delete(callback);
      },
      
      // Update with function
      update(updater) {
        if (typeof updater === 'function') {
          this.value = updater(this.value);
        } else {
          this.value = updater;
        }
      }
    };
  }

  /**
   * Framework-specific signal hooks
   */
  use(key, initialValue) {
    // This would be implemented differently for each framework
    // React: useState + useEffect
    // Vue: ref + watch
    // Svelte: writable store
    // Pure JS: direct signal
    
    return this.signal(key, initialValue);
  }

  /**
   * Emit events
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in signal listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Listen to events
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event).add(callback);
    
    // Return unsubscribe function
    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(callback);
        if (eventListeners.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Get current value of a signal
   */
  get(key) {
    const signalData = this.signals.get(key);
    return signalData ? signalData.value : undefined;
  }

  /**
   * Set value of a signal
   */
  set(key, value) {
    const signal = this.signal(key, value);
    signal.value = value;
  }

  /**
   * Check if signal exists
   */
  has(key) {
    return this.signals.has(key);
  }

  /**
   * Delete a signal
   */
  delete(key) {
    const signalData = this.signals.get(key);
    if (signalData) {
      // Clear all subscribers
      signalData.subscribers.clear();
      this.signals.delete(key);
      
      // Emit deletion event
      this.emit(`${key}:deleted`, { key });
      return true;
    }
    return false;
  }

  /**
   * Clear all signals
   */
  clear() {
    this.signals.clear();
    this.listeners.clear();
  }

  /**
   * Get all signal keys
   */
  keys() {
    return Array.from(this.signals.keys());
  }

  /**
   * Get debug information
   */
  debug() {
    return {
      signals: Object.fromEntries(
        Array.from(this.signals.entries()).map(([key, data]) => [
          key, 
          { 
            value: data.value, 
            subscribers: data.subscribers.size 
          }
        ])
      ),
      listeners: Object.fromEntries(
        Array.from(this.listeners.entries()).map(([event, callbacks]) => [
          event,
          callbacks.size
        ])
      )
    };
  }
}

// Create global signal instance
const signal = new UltraModernSignal();

// Export both the instance and the class
export { signal, UltraModernSignal };
export default signal;

// Global access for development
if (typeof window !== 'undefined') {
  window.signal = signal;
}