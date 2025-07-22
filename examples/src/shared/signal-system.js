/**
 * Ultra-Modern MTM Signal System
 * Unified signal system for state management and event communication
 */

class SignalSystem {
  constructor() {
    this.signals = new Map();
    this.listeners = new Map();
    this.debug = false;
  }

  /**
   * Create or get a signal
   */
  signal(key, initialValue) {
    if (!this.signals.has(key)) {
      if (this.debug) console.log(`Creating signal: ${key} with value:`, initialValue);
      this.signals.set(key, {
        value: initialValue,
        subscribers: new Set()
      });
    }
    
    const signalData = this.signals.get(key);
    
    // Return reactive getter/setter
    const signalProxy = {
      get value() {
        return signalData.value;
      },
      
      set value(newValue) {
        const oldValue = signalData.value;
        signalData.value = newValue;
        
        // Notify all subscribers
        signalData.subscribers.forEach(callback => {
          try {
            callback(newValue, oldValue);
          } catch (error) {
            console.error(`Error in signal subscriber for ${key}:`, error);
          }
        });
        
        // Emit change event
        signal.emit(`${key}:changed`, { key, value: newValue, oldValue });
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
        return this.value;
      }
    };
    
    return signalProxy;
  }

  /**
   * Shorthand for creating signals (used in MTM syntax)
   */
  use(key, initialValue) {
    return this.signal(key, initialValue);
  }

  /**
   * Emit events
   */
  emit(event, data) {
    if (this.debug) console.log(`Emitting event: ${event}`, data);
    
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
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
    if (this.debug) console.log(`Added listener for event: ${event}`);
    
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
    const signalProxy = this.signal(key, value);
    signalProxy.value = value;
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
   * Enable or disable debug mode
   */
  setDebug(enabled) {
    this.debug = enabled;
    console.log(`Signal system debug mode: ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
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
const signal = new SignalSystem();

// Enable debug mode in development
if (process.env.NODE_ENV !== 'production') {
  signal.setDebug(true);
}

// Export both the instance and the class
export { signal, SignalSystem };
export default signal;

// Global access for development
if (typeof window !== 'undefined') {
  window.signal = signal;
}