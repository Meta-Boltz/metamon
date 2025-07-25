// Debug Composition API detection
const { VueComponentAdapter } = require('./component-adapter.js');

const adapter = new VueComponentAdapter();

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

console.log('Testing Composition API detection:');
console.log('Source contains defineProps:', vueSource.includes('defineProps'));
console.log('Source contains defineEmits:', vueSource.includes('defineEmits'));
console.log('Source contains ref(:', vueSource.includes('ref('));
console.log('Source contains onMounted:', vueSource.includes('onMounted'));

const usesCompositionAPI = adapter.detectCompositionAPI(vueSource);
console.log('detectCompositionAPI result:', usesCompositionAPI);

// Test individual patterns
const compositionPatterns = [
  /setup\s*\(/g,
  /defineComponent/g,
  /defineProps/g,
  /defineEmits/g,
  /ref\s*\(/g,
  /reactive\s*\(/g,
  /computed\s*\(/g,
  /watch\s*\(/g,
  /watchEffect\s*\(/g,
  /onMounted/g,
  /onUnmounted/g,
  /onUpdated/g
];

console.log('\nTesting individual patterns:');
compositionPatterns.forEach((pattern, index) => {
  const matches = pattern.test(vueSource);
  console.log(`Pattern ${index} (${pattern.source}): ${matches}`);
});