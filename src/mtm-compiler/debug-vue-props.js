// Debug Vue prop extraction
const { VueComponentAdapter } = require('./component-adapter.js');

const adapter = new VueComponentAdapter();

// Test complex prop definitions
const complexSource = `
export default {
  props: {
    title: {
      type: String,
      required: true
    },
    count: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      required: false,
      default: false
    }
  }
}
`;

console.log('Testing complex prop definitions:');
console.log('Source:', complexSource);

const props = adapter.extractProps(complexSource);
console.log('Extracted props:', JSON.stringify(props, null, 2));

// Test Composition API props
const compositionSource = `
<script setup lang="ts">
interface Props {
  title: string;
  count?: number;
  isActive: boolean;
  onClick: (id: string) => void;
}

const props = defineProps<Props>();
</script>
`;

console.log('\nTesting Composition API props:');
console.log('Source:', compositionSource);

const compositionProps = adapter.extractProps(compositionSource);
console.log('Extracted props:', JSON.stringify(compositionProps, null, 2));

// Test object-style defineProps
const objectDefinePropsSource = `
<script setup>
const props = defineProps({
  title: String,
  count: {
    type: Number,
    default: 0
  },
  isActive: Boolean
});
</script>
`;

console.log('\nTesting object-style defineProps:');
console.log('Source:', objectDefinePropsSource);

const objectProps = adapter.extractProps(objectDefinePropsSource);
console.log('Extracted props:', JSON.stringify(objectProps, null, 2));