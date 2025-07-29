// Demo: Solid Component Integration
const { SolidComponentAdapter } = require('./component-adapter.js');

console.log('🧪 Testing Solid Component Integration...\n');

// Create adapter instance
const adapter = new SolidComponentAdapter();

// Test 1: Basic component handling
console.log('1. Testing file extension handling:');
console.log('   Component.solid.tsx:', adapter.canHandle('Component.solid.tsx'));
console.log('   solid-component.tsx:', adapter.canHandle('solid-component.tsx'));
console.log('   Component.tsx:', adapter.canHandle('Component.tsx'));
console.log('   Component.vue:', adapter.canHandle('Component.vue'));
console.log('   Component.svelte:', adapter.canHandle('Component.svelte'));

// Test 2: Props extraction
console.log('\n2. Testing props extraction:');
const solidSource = `
import { createSignal, createEffect, createStore } from 'solid-js';

interface CounterProps {
  initialCount?: number;
  onCountChange: (count: number) => void;
  disabled: boolean;
  theme?: 'light' | 'dark';
}

export default function Counter({ initialCount = 0, onCountChange, disabled, theme = 'light' }: CounterProps) {
  const [count, setCount] = createSignal(initialCount);
  const [store, setStore] = createStore({ history: [] });
  
  createEffect(() => {
    onCountChange(count());
    setStore('history', [...store.history, count()]);
  });
  
  return (
    <div class={\`counter \${theme}\`}>
      <button 
        disabled={disabled}
        onClick={() => setCount(c => c + 1)}
      >
        Count: {count()}
      </button>
      <p>History: {store.history.join(', ')}</p>
    </div>
  );
}
`;

const props = adapter.extractProps(solidSource);
console.log('   Extracted props:', props.length);
props.forEach((prop, index) => {
  console.log(`   ${index + 1}. ${prop.name}${prop.required ? '' : '?'}: ${prop.type}${prop.default ? ` = ${prop.default}` : ''}`);
});

// Test 3: Solid feature detection
console.log('\n3. Testing Solid feature detection:');
console.log('   Uses signals:', adapter.detectSignals(solidSource));
console.log('   Uses stores:', adapter.detectStores(solidSource));
console.log('   Uses effects:', adapter.detectEffects(solidSource));
console.log('   Uses resources:', adapter.detectResources(solidSource));
console.log('   Export type:', adapter.detectExportType(solidSource));

// Test 4: Component transformation
console.log('\n4. Testing component transformation:');
const componentImport = {
  name: 'Counter',
  path: '@components/Counter.solid.tsx',
  framework: 'solid'
};

// Mock fs functions for the demo
const fs = require('fs');
const originalReadFileSync = fs.readFileSync;
const originalExistsSync = fs.existsSync;
fs.readFileSync = () => solidSource;
fs.existsSync = () => true;

const componentDefinition = adapter.transform(componentImport);
console.log('   Component name:', componentDefinition.name);
console.log('   Framework:', componentDefinition.framework);
console.log('   Is Solid component:', componentDefinition.isSolidComponent);
console.log('   Uses signals:', componentDefinition.usesSignals);
console.log('   Uses stores:', componentDefinition.usesStores);
console.log('   Uses effects:', componentDefinition.usesEffects);
console.log('   Props count:', componentDefinition.props.length);

// Test 5: Wrapper generation
console.log('\n5. Testing wrapper generation:');
const wrapper = adapter.generateWrapper(componentDefinition);
console.log('   Wrapper generated successfully:', wrapper.length > 0);
console.log('   Contains props interface:', wrapper.includes('interface CounterProps'));
console.log('   Contains wrapper function:', wrapper.includes('function CounterWrapper'));
console.log('   Contains signal integration:', wrapper.includes('Solid.createMemo'));
console.log('   Contains mounting utils:', wrapper.includes('CounterUtils'));
console.log('   Contains error handling:', wrapper.includes('try {'));

// Test 6: Props interface generation
console.log('\n6. Testing props interface generation:');
const propsInterface = adapter.generatePropsInterface('Counter', componentDefinition.props);
console.log('   Props interface preview:');
console.log('   ' + propsInterface.split('\n').slice(0, 3).join('\n   '));

// Test 7: Mounting utilities generation
console.log('\n7. Testing mounting utilities:');
const mountingUtils = adapter.generateMountingUtils('Counter');
console.log('   Contains mount function:', mountingUtils.includes('mount: function'));
console.log('   Contains createSignal utility:', mountingUtils.includes('createSignal: function'));
console.log('   Contains createStore utility:', mountingUtils.includes('createStore: function'));
console.log('   Contains createMemo utility:', mountingUtils.includes('createMemo: function'));
console.log('   Contains createEffect utility:', mountingUtils.includes('createEffect: function'));
console.log('   Contains Solid.render:', mountingUtils.includes('Solid.render'));

// Restore original fs functions
fs.readFileSync = originalReadFileSync;
fs.existsSync = originalExistsSync;

console.log('\n✅ Solid Component Integration Demo Complete!');
console.log('\nKey Features Implemented:');
console.log('• Enhanced prop extraction for TypeScript interfaces and function parameters');
console.log('• Solid-specific feature detection (signals, stores, effects, resources)');
console.log('• Signal integration in wrapper components');
console.log('• Comprehensive mounting utilities with reactivity support');
console.log('• Error handling and fallback rendering');
console.log('• TypeScript interface generation for props');
console.log('• Component lifecycle management');