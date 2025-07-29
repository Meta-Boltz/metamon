/**
 * Reproduction case for the chunk loading issue with MTM files
 * This file demonstrates the TypeError: Cannot set property data of #<Object> which has only a getter
 */

// Create a mock MTM module with getter-only properties
const createMockMTMModule = () => {
  const module = {};

  // Create a data property with only a getter
  Object.defineProperty(module, 'data', {
    get: function () {
      return { content: 'original content' };
    },
    enumerable: true,
    configurable: false
  });

  return module;
};

// Simulate the chunk loader trying to set properties on the module
const simulateChunkLoader = (importedModule) => {
  console.log('Starting chunk loading simulation');

  try {
    // First, access the property
    console.log('Initial module.data:', importedModule.data);

    // Now try to modify it (this is what happens in the chunk loader)
    console.log('Attempting to set module.data...');
    importedModule.data = { content: 'updated content' };

    console.log('After assignment, module.data:', importedModule.data);
    return true;
  } catch (error) {
    console.error('ERROR:', error.name + ':', error.message);
    return false;
  }
};

// Run in strict mode to ensure the error is thrown
'use strict';

// Test the chunk loading
console.log('=== MTM Chunk Loading Simulation ===');
const mockModule = createMockMTMModule();
const result = simulateChunkLoader(mockModule);
console.log('Chunk loading successful:', result);

// Now implement a safe version that would fix the issue
const safeChunkLoader = (importedModule) => {
  console.log('\n=== Safe Chunk Loading Simulation ===');

  try {
    // First, access the property
    console.log('Initial module.data:', importedModule.data);

    // Use safe property assignment
    console.log('Using safe property assignment...');
    const descriptor = Object.getOwnPropertyDescriptor(importedModule, 'data');

    if (descriptor && descriptor.get && !descriptor.set) {
      console.log('Property has getter but no setter, creating new object');

      // Create a new object with all properties except 'data'
      const newModule = Object.create(Object.getPrototypeOf(importedModule));

      Object.getOwnPropertyNames(importedModule).forEach(key => {
        if (key !== 'data') {
          Object.defineProperty(
            newModule,
            key,
            Object.getOwnPropertyDescriptor(importedModule, key)
          );
        }
      });

      // Add our own 'data' property
      const newData = { content: 'updated content' };
      Object.defineProperty(newModule, 'data', {
        value: newData,
        writable: true,
        enumerable: true,
        configurable: true
      });

      console.log('After safe assignment, newModule.data:', newModule.data);
      return { success: true, module: newModule };
    } else {
      // Normal assignment
      importedModule.data = { content: 'updated content' };
      console.log('After normal assignment, module.data:', importedModule.data);
      return { success: true, module: importedModule };
    }
  } catch (error) {
    console.error('ERROR:', error.name + ':', error.message);
    return { success: false, error };
  }
};

// Test the safe chunk loading
const mockModule2 = createMockMTMModule();
const safeResult = safeChunkLoader(mockModule2);
console.log('Safe chunk loading successful:', safeResult.success);