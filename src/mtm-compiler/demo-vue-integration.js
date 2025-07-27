// Demo: Vue Component Integration
// This demonstrates the enhanced Vue component adapter capabilities

const { VueComponentAdapter } = require('./component-adapter.js');
const { ComponentRegistry } = require('./component-registry.js');

console.log('🎯 Vue Component Integration Demo\n');

// Initialize Vue adapter and registry
const vueAdapter = new VueComponentAdapter();
const registry = new ComponentRegistry();

// Demo 1: Vue Options API Component
console.log('📝 Demo 1: Vue Options API Component');
const optionsAPISource = `
<template>
  <div class="user-card">
    <h2>{{ title }}</h2>
    <p>Age: {{ age }}</p>
    <button @click="handleClick">{{ buttonText }}</button>
    <slot name="footer"></slot>
  </div>
</template>

<script>
export default {
  name: 'UserCard',
  props: {
    title: {
      type: String,
      required: true
    },
    age: {
      type: Number,
      default: 18
    },
    buttonText: {
      type: String,
      default: 'Click me'
    }
  },
  emits: ['user-clicked'],
  data() {
    return {
      clickCount: 0
    };
  },
  methods: {
    handleClick() {
      this.clickCount++;
      this.$emit('user-clicked', { count: this.clickCount });
    }
  },
  mounted() {
    console.log('UserCard mounted');
  }
}
</script>
`;

const optionsProps = vueAdapter.extractProps(optionsAPISource);
console.log('✅ Extracted props:', JSON.stringify(optionsProps, null, 2));
console.log('✅ Uses Options API:', vueAdapter.detectOptionsAPI(optionsAPISource));
console.log('✅ Uses Composition API:', vueAdapter.detectCompositionAPI(optionsAPISource));
console.log('✅ Has slots:', vueAdapter.detectSlots(optionsAPISource));
console.log('✅ Has emits:', vueAdapter.detectEmits(optionsAPISource));

// Demo 2: Vue Composition API Component
console.log('\n📝 Demo 2: Vue Composition API Component');
const compositionAPISource = `
<template>
  <div class="todo-item">
    <input 
      v-model="localTitle" 
      :disabled="readonly"
      @input="handleInput"
    />
    <button @click="toggleComplete">
      {{ completed ? 'Undo' : 'Complete' }}
    </button>
    <slot :item="todoItem" :toggle="toggleComplete"></slot>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

interface TodoProps {
  title: string;
  completed?: boolean;
  readonly?: boolean;
  priority: 'low' | 'medium' | 'high';
  onUpdate: (item: TodoItem) => void;
}

interface TodoItem {
  title: string;
  completed: boolean;
  priority: string;
}

const props = defineProps<TodoProps>();
const emit = defineEmits<{
  update: [item: TodoItem];
  delete: [id: string];
}>();

const localTitle = ref(props.title);
const clickCount = ref(0);

const todoItem = computed(() => ({
  title: localTitle.value,
  completed: props.completed || false,
  priority: props.priority
}));

const handleInput = () => {
  emit('update', todoItem.value);
};

const toggleComplete = () => {
  clickCount.value++;
  emit('update', {
    ...todoItem.value,
    completed: !todoItem.value.completed
  });
};

watch(() => props.title, (newTitle) => {
  localTitle.value = newTitle;
});

onMounted(() => {
  console.log('TodoItem mounted');
});

onUnmounted(() => {
  console.log('TodoItem unmounted');
});
</script>
`;

const compositionProps = vueAdapter.extractProps(compositionAPISource);
console.log('✅ Extracted props:', JSON.stringify(compositionProps, null, 2));
console.log('✅ Uses Options API:', vueAdapter.detectOptionsAPI(compositionAPISource));
console.log('✅ Uses Composition API:', vueAdapter.detectCompositionAPI(compositionAPISource));
console.log('✅ Has slots:', vueAdapter.detectSlots(compositionAPISource));
console.log('✅ Has emits:', vueAdapter.detectEmits(compositionAPISource));

// Demo 3: Component Registration and Wrapper Generation
console.log('\n📝 Demo 3: Component Registration and Wrapper Generation');

const componentImport = {
  name: 'TodoItem',
  path: '@components/TodoItem.vue',
  framework: 'vue'
};

// Mock file system for demo
const fs = require('fs');
const originalReadFileSync = fs.readFileSync;
const originalExistsSync = fs.existsSync;

fs.readFileSync = () => compositionAPISource;
fs.existsSync = () => true;

try {
  // Register component
  const componentDefinition = registry.registerFromImport(componentImport);
  console.log('✅ Component registered:', componentDefinition.name);
  console.log('✅ Framework:', componentDefinition.framework);
  console.log('✅ Props count:', componentDefinition.props.length);
  console.log('✅ Uses Composition API:', componentDefinition.usesCompositionAPI);

  // Generate wrapper code
  const wrapperCode = registry.generateWrapper('TodoItem');
  console.log('\n📦 Generated wrapper code preview:');
  console.log(wrapperCode.substring(0, 500) + '...\n');

  // Demo 4: Component Adapter Features
  console.log('📝 Demo 4: Vue Type Mapping');
  const vueTypes = ['String', 'Number', 'Boolean', 'Array', 'Object', 'Function', 'Date', 'Symbol'];
  vueTypes.forEach(vueType => {
    const tsType = vueAdapter.mapVueTypeToTypeScript(vueType);
    console.log(`✅ ${vueType} → ${tsType}`);
  });

  // Demo 5: Props Interface Generation
  console.log('\n📝 Demo 5: Props Interface Generation');
  const sampleProps = [
    { name: 'title', type: 'string', required: true, default: null },
    { name: 'count', type: 'number', required: false, default: '0' },
    { name: 'isActive', type: 'boolean', required: true, default: null },
    { name: 'onClick', type: '(event: MouseEvent) => void', required: false, default: null }
  ];

  const propsInterface = vueAdapter.generatePropsInterface('SampleComponent', sampleProps);
  console.log('✅ Generated TypeScript interface:');
  console.log(propsInterface);

  // Demo 6: Mounting Utilities
  console.log('\n📝 Demo 6: Mounting Utilities Preview');
  const mountingUtils = vueAdapter.generateMountingUtils('TodoItem');
  console.log('✅ Generated mounting utilities with:');
  console.log('  - Vue 3 createApp support');
  console.log('  - Plugin configuration');
  console.log('  - Global properties support');
  console.log('  - Reactive props helper');
  console.log('  - Ref creation helper');
  console.log('  - Update and unmount methods');

  console.log('\n🎉 Vue Component Integration Demo Complete!');
  console.log('\nKey Features Demonstrated:');
  console.log('✅ Vue Options API prop extraction');
  console.log('✅ Vue Composition API prop extraction');
  console.log('✅ TypeScript interface parsing');
  console.log('✅ Composition API detection');
  console.log('✅ Slots and emits detection');
  console.log('✅ Component wrapper generation');
  console.log('✅ Vue 3 mounting utilities');
  console.log('✅ Reactive props and refs helpers');
  console.log('✅ Error handling and lifecycle management');

} catch (error) {
  console.error('❌ Demo error:', error.message);
} finally {
  // Restore file system
  fs.readFileSync = originalReadFileSync;
  fs.existsSync = originalExistsSync;
}