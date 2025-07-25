/**
 * Minimal reproduction case for the chunk loading issue
 * This file demonstrates the TypeError: Cannot set property data of #<Object> which has only a getter
 */

// Create an object with a getter-only property
const createObjectWithGetter = () => {
  const obj = {};
  Object.defineProperty(obj, 'data', {
    get: function () {
      return 'getter-only data';
    },
    enumerable: true,
    configurable: false // Make it non-configurable to reproduce the issue
  });
  return obj;
};

// Simulate chunk loading by trying to set a property on an object
const simulateChunkLoading = (obj) => {
  try {
    console.log('Before assignment, data =', obj.data);

    // This is where the error occurs in the real code
    obj.data = 'new value';

    console.log('After assignment, data =', obj.data);
    return true;
  } catch (error) {
    console.error('Error during chunk loading:', error.message);
    return false;
  }
};

// Create a safe property assignment function
const safeAssign = (obj, prop, value) => {
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
      Object.getOwnPropertyNames(obj).forEach((key) => {
        if (key !== prop) {
          Object.defineProperty(
            newObj,
            key,
            Object.getOwnPropertyDescriptor(obj, key)
          );
        }
      });
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

// Test cases
console.log('=== Test Case 1: Direct Assignment (Should Fail) ===');
const obj1 = createObjectWithGetter();
const result1 = simulateChunkLoading(obj1);
console.log('Assignment successful:', result1);

console.log('\n=== Test Case 2: Safe Assignment (Should Succeed) ===');
const obj2 = createObjectWithGetter();
console.log('Before safe assignment, data =', obj2.data);
const result2 = safeAssign(obj2, 'data', 'new value');
console.log('After safe assignment, data =', result2.data);

console.log('\n=== Test Case 3: Non-configurable Property ===');
const obj3 = {};
Object.defineProperty(obj3, 'data', {
  get: function () { return 'non-configurable getter'; },
  enumerable: true,
  configurable: false
});
console.log('Before safe assignment, data =', obj3.data);
const result3 = safeAssign(obj3, 'data', 'new value');
console.log('After safe assignment, data =', result3.data);