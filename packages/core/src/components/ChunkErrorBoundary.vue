<template>
  <div v-if="hasError" class="chunk-error-fallback" role="alert" aria-live="assertive">
    <div class="chunk-error-container">
      <div class="chunk-error-icon">⚠️</div>
      <div class="chunk-error-content">
        <h3 class="chunk-error-title">Component Failed to Load</h3>
        <p class="chunk-error-message">{{ userMessage }}</p>
        
        <button 
          v-if="canRetry" 
          class="chunk-error-retry-button" 
          @click="retry"
          aria-label="Retry loading the component"
        >
          Try Again
        </button>
        
        <div v-if="showDetails" class="chunk-error-details">
          <button 
            class="chunk-error-toggle" 
            @click="toggleExpanded"
            :aria-expanded="expanded"
            aria-controls="error-details-panel"
          >
            {{ expanded ? 'Hide Details' : 'Show Details' }}
          </button>
          
          <pre 
            v-if="expanded" 
            id="error-details-panel" 
            class="chunk-error-code"
          >{{ errorDetails }}</pre>
        </div>
      </div>
    </div>
  </div>
  <slot v-else></slot>
</template>

<script>
import { ref, computed, onErrorCaptured } from 'vue';
import { ChunkError } from '../utils/chunk-error.js';

export default {
  name: 'ChunkErrorBoundary',
  
  props: {
    showDetails: {
      type: Boolean,
      default: false
    },
    maxRetries: {
      type: Number,
      default: 3
    },
    onError: {
      type: Function,
      default: null
    },
    onRetry: {
      type: Function,
      default: null
    }
  },
  
  setup(props, { slots }) {
    const error = ref(null);
    const hasError = ref(false);
    const expanded = ref(false);
    const retryCount = ref(0);
    
    const canRetry = computed(() => retryCount.value < props.maxRetries);
    
    const userMessage = computed(() => {
      if (!error.value) return 'Failed to load component';
      
      return error.value instanceof ChunkError 
        ? error.value.getUserMessage() 
        : 'Failed to load component';
    });
    
    const errorDetails = computed(() => {
      if (!error.value) return null;
      
      let details = {
        message: error.value.message,
        type: error.value.name || 'Error'
      };
      
      if (error.value instanceof ChunkError) {
        details = {
          ...details,
          chunkId: error.value.chunkId,
          phase: error.value.phase,
          timestamp: error.value.timestamp
        };
      }
      
      return JSON.stringify(details, null, 2);
    });
    
    const resetError = () => {
      error.value = null;
      hasError.value = false;
    };
    
    const retry = () => {
      retryCount.value += 1;
      resetError();
      
      if (props.onRetry) {
        props.onRetry(retryCount.value);
      }
    };
    
    const toggleExpanded = () => {
      expanded.value = !expanded.value;
    };
    
    onErrorCaptured((err, instance, info) => {
      error.value = err;
      hasError.value = true;
      
      if (props.onError) {
        props.onError(err, info);
      }
      
      console.error('Chunk loading error caught by boundary:', err);
      
      // Prevent the error from propagating further
      return false;
    });
    
    return {
      error,
      hasError,
      expanded,
      retryCount,
      canRetry,
      userMessage,
      errorDetails,
      resetError,
      retry,
      toggleExpanded
    };
  }
};
</script>

<style scoped>
.chunk-error-fallback {
  border: 1px solid #f5c2c7;
  border-radius: 4px;
  background-color: #f8d7da;
  padding: 16px;
  margin: 16px 0;
  color: #842029;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.chunk-error-container {
  display: flex;
  align-items: flex-start;
}

.chunk-error-icon {
  font-size: 24px;
  margin-right: 16px;
}

.chunk-error-content {
  flex: 1;
}

.chunk-error-title {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
}

.chunk-error-message {
  margin: 0 0 16px 0;
  font-size: 14px;
}

.chunk-error-retry-button {
  background-color: #842029;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  margin-right: 8px;
}

.chunk-error-retry-button:hover {
  background-color: #6c1a22;
}

.chunk-error-toggle {
  background: none;
  border: none;
  color: #842029;
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
  font-size: 14px;
}

.chunk-error-details {
  margin-top: 16px;
}

.chunk-error-code {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 12px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  overflow-x: auto;
  margin-top: 8px;
}
</style>

<script setup>
// Helper function to create a component with error boundary
export function defineAsyncComponent(loader, options = {}) {
  const { 
    showDetails = false,
    maxRetries = 3,
    onError = null,
    onRetry = null,
    loadingComponent = null,
    delay = 200,
    timeout = 30000
  } = options;
  
  return {
    setup() {
      return () => h(ChunkErrorBoundary, {
        showDetails,
        maxRetries,
        onError,
        onRetry
      }, {
        default: () => h(defineAsyncComponentVue(loader, {
          loadingComponent,
          delay,
          timeout,
          onError: (err, instance, info) => {
            if (onError) onError(err, info);
            return false; // Let the error boundary handle it
          }
        }))
      });
    }
  };
}
</script>