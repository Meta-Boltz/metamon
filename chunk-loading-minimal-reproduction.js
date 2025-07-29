/**
 * Minimal reproduction case for the Metamon chunk loading issue
 * 
 * This file demonstrates the TypeError: Cannot set property data of #<Object> which has only a getter
 * that occurs during chunk loading in the Metamon framework.
 */

'use strict'; // Enable strict mode to reproduce the error

// ===== PART 1: Setup - Create objects that simulate the MTM module structure =====

// Create a mock MTM module with getter-only properties (simulates transformed .mtm file)
const createMockMTMModule = () => {
  const module = {};

  // Define a getter-only property that's non-configurable (similar to what the MTM transformer creates)
  Object.defineProperty(module, 'data', {
    get: function () {
      return { content: 'original content' };
    },
    enumerable: true,
    configurable: false // This makes it impossible to redefine the property
  });

  return module;
};

// ===== PART 2: Problem - Demonstrate the chunk loading error =====

// Simulate the chunk loader trying to set properties on the module
const simulateChunkLoader = (importedModule) => {
  console.log('=== Chunk Loader Simulation (Will Fail) ===');
  console.log('Initial module.data:', importedModule.data);

  try {
    // This is where the error occurs in the real code
    // In strict mode, this throws TypeError: Cannot set property data of #<Object> which has only a getter
    importedModule.data = { content: 'updated content' };

    console.log('After assignment, module.data:', importedModule.data);
    return { success: true, module: importedModule };
  } catch (error) {
    console.error('ERROR:', error.name + ':', error.message);
    return { success: false, error };
  }
};

// ===== PART 3: Solution - Implement safe property assignment =====

// Safe property assignment function that checks for getter-only properties
const safeAssign = (obj, prop, value) => {
  console.log('=== Safe Property Assignment ===');

  // Check if property exists and has a getter but no setter
  const descriptor = Object.getOwnPropertyDescriptor(obj, prop);

  if (descriptor && descriptor.get && !descriptor.set) {
    console.log('Property has getter but no setter, using alternative approach');

    try {
      // Try to use Object.defineProperty to override
      Object.defineProperty(obj, prop, {
        configurable: true,
        enumerable: descriptor.enumerable,
        get: () => value,
        set: (newValue) => {
          value = newValue;
        }
      });
    } catch (e) {
      console.log('defineProperty failed, creating new object');

      // If that fails, create a new object with the desired properties
      const newObj = Object.create(Object.getPrototypeOf(obj));

      // Copy all properties except the one we're trying to set
      Object.getOwnPropertyNames(obj).forEach((key) => {
        if (key !== prop) {
          Object.defineProperty(
            newObj,
            key,
            Object.getOwnPropertyDescriptor(obj, key)
          );
        }
      });

      // Add our property with the new value
      Object.defineProperty(newObj, prop, {
        configurable: true,
        enumerable: true,
        writable: true,
        value
      });

      return newObj; // Return new object to replace the original
    }
    return obj;
  } else {
    // Normal property assignment
    obj[prop] = value;
    return obj;
  }
};

// Simulate the chunk loader with safe property assignment
const simulateSafeChunkLoader = (importedModule) => {
  console.log('\n=== Safe Chunk Loader Simulation (Should Succeed) ===');
  console.log('Initial module.data:', importedModule.data);

  try {
    // Use safe property assignment instead of direct assignment
    const updatedModule = safeAssign(importedModule, 'data', { content: 'updated content' });

    console.log('After safe assignment, module.data:', updatedModule.data);
    return { success: true, module: updatedModule };
  } catch (error) {
    console.error('ERROR:', error.name + ':', error.message);
    return { success: false, error };
  }
};

// ===== PART 4: Run the tests =====

// Create a mock MTM module
const mockModule = createMockMTMModule();

// Test the regular chunk loader (will fail in strict mode)
const regularResult = simulateChunkLoader(mockModule);
console.log('Regular chunk loading successful:', regularResult.success);

// Create another mock module for the safe test
const mockModule2 = createMockMTMModule();

// Test the safe chunk loader (should succeed)
const safeResult = simulateSafeChunkLoader(mockModule2);
console.log('Safe chunk loading successful:', safeResult.success);

// ===== PART 5: Summary =====

console.log('\n=== Summary ===');
console.log('Regular chunk loading:', regularResult.success ? 'Succeeded' : 'Failed');
console.log('Safe chunk loading:', safeResult.success ? 'Succeeded' : 'Failed');

if (!regularResult.success) {
  console.log('\nThis demonstrates the issue in the Metamon framework:');
  console.log('1. The MTM transformer creates objects with getter-only properties');
  console.log('2. The chunk loader tries to set values on these properties');
  console.log('3. In strict mode, this throws a TypeError');
  console.log('\nThe solution is to use safe property assignment that checks for getter-only properties.');
}