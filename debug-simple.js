/**
 * More accurate reproduction case for the chunk loading issue
 * This file demonstrates the TypeError: Cannot set property data of #<Object> which has only a getter
 */

// Create an object with a getter-only property that throws when attempting to set
const createObjectWithStrictGetter = () => {
  const obj = {};
  Object.defineProperty(obj, 'data', {
    get: function () {
      return 'getter-only data';
    },
    // No setter defined
    enumerable: true,
    configurable: false // Make it non-configurable to reproduce the issue
  });
  return obj;
};

// Simulate chunk loading by trying to set a property on an object
const simulateChunkLoading = (obj) => {
  console.log('Before assignment, data =', obj.data);

  // This is where the error occurs in the real code
  // In strict mode, this will throw TypeError
  obj.data = 'new value';

  console.log('After assignment, data =', obj.data);
  return true;
};

// Run in strict mode to trigger the error
'use strict';

// Test case
console.log('=== Test Case: Direct Assignment (Should Fail) ===');
const obj = createObjectWithStrictGetter();
try {
  simulateChunkLoading(obj);
} catch (error) {
  console.error('Error during chunk loading:', error.message);
}