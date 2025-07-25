// Test Vue component integration
const { VueComponentAdapter } = require('./component-adapter.js');

const adapter = new VueComponentAdapter();

// Test component import
const componentImport = {
  name: 'TestComponent',
  path: '@components/Test.vue',
  framework: 'vue'
};

console.log('Testing Vue component transformation...');

// Mock fs.readFileSync
const fs = require('fs');
const originalReadFileSync = fs.readFileSync;

const vueSource = `
<template>
  <div>
    <slot name="header"></slot>
    {{ title }}
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string;
}

const props = defineProps<Props>();
const emit = defineEmits(['update']);

import { ref, onMounted } from 'vue';
const count = ref(0);

onMounted(() => {
  console.log('Component mounted');
});
</script>
`;

fs.readFileSync = () => vueSource;
fs.existsSync = () => true;

try {
  const definition = adapter.transform(componentImport);

  console.log('Transform result:');
  console.log('- name:', definition.name);
  console.log('- framework:', definition.framework);
  console.log('- isVueComponent:', definition.isVueComponent);
  console.log('- usesCompositionAPI:', definition.usesCompositionAPI);
  console.log('- usesOptionsAPI:', definition.usesOptionsAPI);
  console.log('- hasSlots:', definition.hasSlots);
  console.log('- hasEmits:', definition.hasEmits);
  console.log('- exportType:', definition.exportType);
  console.log('- props:', JSON.stringify(definition.props, null, 2));

} catch (error) {
  console.error('Error during transformation:', error);
} finally {
  // Restore original function
  fs.readFileSync = originalReadFileSync;
}