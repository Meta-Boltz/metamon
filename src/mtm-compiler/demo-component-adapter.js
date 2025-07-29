// Demo: Component Adapter System
const { ComponentRegistry } = require('./component-registry.js');

console.log('🧩 Component Adapter System Demo\n');

// Create a new component registry
const registry = new ComponentRegistry();

console.log('📊 Initial Registry Stats:');
console.log(registry.getStats());
console.log();

// Demo 1: Register components from imports
console.log('1️⃣ Registering components from imports...');

const reactImport = {
  name: 'Button',
  path: '@components/Button.tsx',
  framework: 'react'
};

const vueImport = {
  name: 'Card',
  path: '@components/Card.vue',
  framework: 'vue'
};

const solidImport = {
  name: 'Counter',
  path: '@components/Counter.solid.tsx',
  framework: 'solid'
};

try {
  const reactComponent = registry.registerFromImport(reactImport);
  console.log(`✅ Registered React component: ${reactComponent.name}`);

  const vueComponent = registry.registerFromImport(vueImport);
  console.log(`✅ Registered Vue component: ${vueComponent.name}`);

  const solidComponent = registry.registerFromImport(solidImport);
  console.log(`✅ Registered Solid component: ${solidComponent.name}`);
} catch (error) {
  console.log(`⚠️ Registration warning: ${error.message}`);
}

console.log();

// Demo 2: Path resolution
console.log('2️⃣ Path resolution examples...');

const paths = [
  '@components/Button.tsx',
  '@/utils/helper.js',
  './LocalComponent.vue',
  '../shared/Modal.svelte'
];

paths.forEach(path => {
  const resolved = registry.resolvePath(path);
  console.log(`📁 ${path} → ${resolved}`);
});

console.log();

// Demo 3: Component resolution
console.log('3️⃣ Component resolution...');

const componentNames = ['Button', 'Card', 'Counter', 'NonExistent'];

componentNames.forEach(name => {
  const component = registry.resolve(name);
  if (component) {
    console.log(`✅ Found ${name}: ${component.framework} component`);
  } else {
    console.log(`❌ Component ${name} not found`);
  }
});

console.log();

// Demo 4: Adapter detection
console.log('4️⃣ Adapter detection...');

const testPaths = [
  'Component.tsx',
  'Component.vue',
  'Component.svelte',
  'Component.solid.tsx',
  'react-component.js'
];

testPaths.forEach(path => {
  const componentImport = { name: 'Test', path };
  const adapter = registry.getAdapterForImport(componentImport);
  console.log(`🔧 ${path} → ${adapter ? adapter.framework : 'no adapter'} adapter`);
});

console.log();

// Demo 5: Wrapper generation
console.log('5️⃣ Wrapper generation...');

const wrapperComponents = ['Button', 'Card'];

wrapperComponents.forEach(name => {
  const wrapper = registry.generateWrapper(name);
  if (wrapper) {
    console.log(`📝 Generated wrapper for ${name}:`);
    console.log(wrapper.trim());
    console.log();
  }
});

// Demo 6: Component validation
console.log('6️⃣ Component validation...');

const validComponent = {
  name: 'ValidComponent',
  framework: 'react',
  path: '/test/path.tsx'
};

const invalidComponent = {
  framework: 'unknown'
  // missing name and path
};

console.log('Valid component validation:');
const validErrors = registry.validateComponent(validComponent);
console.log(validErrors.length === 0 ? '✅ No errors' : `❌ ${validErrors.length} errors`);

console.log('Invalid component validation:');
const invalidErrors = registry.validateComponent(invalidComponent);
console.log(`❌ ${invalidErrors.length} errors found:`);
invalidErrors.forEach(error => {
  console.log(`  - ${error.field}: ${error.message}`);
});

console.log();

// Demo 7: Final stats
console.log('7️⃣ Final Registry Stats:');
const finalStats = registry.getStats();
console.log(`📊 Total components: ${finalStats.totalComponents}`);
console.log(`🔧 Total adapters: ${finalStats.totalAdapters}`);
console.log(`📁 Total path mappings: ${finalStats.totalPathMappings}`);
console.log('Framework breakdown:', finalStats.frameworkCounts);

console.log('\n🎉 Component Adapter System Demo Complete!');