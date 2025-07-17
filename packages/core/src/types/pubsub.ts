/**
 * Event listener function type
 */
export type EventListener = {
  callback: Function;
  componentId: string;
};

/**
 * Interface for cross-framework pub/sub event system
 */
export interface PubSubSystem {
  subscribe(event: string, callback: Function, componentId: string): void;
  unsubscribe(event: string, componentId: string): void;
  emit(event: string, payload: any): void;
  cleanup(componentId: string): void;
}

/**
 * Event subscription details
 */
export interface EventSubscription {
  event: string;
  componentId: string;
  callback: Function;
}