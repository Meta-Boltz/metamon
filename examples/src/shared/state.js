// Simple cross-framework state management
// This simulates what the Metamon framework will provide

class SimpleSignal {
  constructor(initialValue) {
    this.value = initialValue;
    this.listeners = new Set();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  update(newValue) {
    this.value = newValue;
    this.listeners.forEach(callback => callback(newValue));
  }
}

class SimplePubSub {
  constructor() {
    this.events = new Map();
  }

  subscribe(event, callback) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event).add(callback);
    
    return () => {
      const eventListeners = this.events.get(event);
      if (eventListeners) {
        eventListeners.delete(callback);
      }
    };
  }

  emit(event, data) {
    const eventListeners = this.events.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data));
    }
  }
}

// Global state instances
export const signals = {
  userCount: new SimpleSignal(0),
  messages: new SimpleSignal([]),
  theme: new SimpleSignal('light')
};

export const pubsub = new SimplePubSub();

// Helper functions for framework integration
export function useSignal(signal) {
  return {
    get value() { return signal.value; },
    update: (newValue) => signal.update(newValue),
    subscribe: (callback) => signal.subscribe(callback)
  };
}