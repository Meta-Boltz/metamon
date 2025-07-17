import { MetamonPubSub } from './metamon-pubsub.js';

export { MetamonPubSub };

// Create a singleton instance for global use
export const pubSubSystem = new MetamonPubSub();