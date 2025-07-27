<!-- Vue Button Component for MTM Integration -->
<template>
  <button 
    :class="buttonClasses"
    @click="handleClick"
    :disabled="disabled"
  >
    <span v-if="loading" class="loading-spinner">⏳</span>
    {{ label }}
  </button>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

interface Props {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  disabled: false,
  loading: false
});

const emit = defineEmits<{
  click: [];
}>();

const buttonClasses = computed(() => [
  'vue-button',
  `vue-button--${props.variant}`,
  {
    'vue-button--disabled': props.disabled,
    'vue-button--loading': props.loading
  }
]);

const handleClick = () => {
  if (!props.disabled && !props.loading) {
    emit('click');
    if (props.onClick) {
      props.onClick();
    }
  }
};
</script>

<style scoped>
.vue-button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.vue-button--primary {
  background: #667eea;
  color: white;
}

.vue-button--primary:hover {
  background: #5a6fd8;
}

.vue-button--secondary {
  background: #6c757d;
  color: white;
}

.vue-button--danger {
  background: #e74c3c;
  color: white;
}

.vue-button--disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>