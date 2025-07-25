/**
 * Debug script to reproduce and test the chunk loading issue
 */

// Simulate the safe assignment utility
function safeAssign(obj, prop, value) {
  if (obj == null) {
    return obj;
  }

  try {
    // Check if property has getter but no setter
    const descriptor = Object.getOwnPropertyDescriptor(obj, prop);

    if (descriptor && descriptor.get && !descriptor.set) {
      console.log(`Property ${prop} has getter but no setter, creating new object`);
      // Create a new object with the desired property
      const newObj = Object.create(Object.getPrototypeOf(obj));

      // Copy existing properties
      Object.getOwnPropertyNames(obj).forEach(key => {
        if (key !== prop) {
          try {
            const keyDescriptor = Object.getOwnPropertyDescriptor(obj, key);
            if (keyDescriptor) {
              Object.defineProperty(newObj, key, keyDescriptor);
            }
          } catch (e) {
            // Skip properties that can't be copied
          }
        }
      });

      // Add our property
      newObj[prop] = value;
      return newObj;
    } else {
      // Normal assignment
      obj[prop] = value;
      return obj;
    }
  } catch (e) {
    console.warn(`Failed to assign property ${prop}, creating new object:`, e);
    // Create a completely new object as last resort
    const newObj = { ...obj };
    newObj[prop] = value;
    return newObj;
  }
}

// Simulate the module that's being created by the MTM transformation
function createMockMTMModule() {
  const pageInfo = {
    route: '/',
    title: 'Test Page',
    description: 'A test page'
  };

  // This simulates what the MTM plugin creates
  const module = {
    pageInfo: pageInfo,
    route: '/',
    renderPage: function (context = {}) {
      return {
        html: '<div>Test content</div>',
        route: '/',
        pageInfo: pageInfo,
        data: {
          timestamp: Date.now(),
          errors: [],
          hmrEnabled: true
        }
      };
    }
  };

  // Add a getter-only property to simulate the issue
  Object.defineProperty(module, 'data', {
    get() {
      return this._data || {
        timestamp: Date.now(),
        errors: [],
        hmrEnabled: true
      };
    },
    enumerable: true,
    configurable: true
    // No setter - this causes the TypeError
  });

  return module;
}

// Test the issue
console.log('=== Testing Chunk Loading Issue ===');

const mockModule = createMockMTMModule();
console.log('Created mock module:', mockModule);

// This should fail with the original error
try {
  console.log('Attempting direct assignment...');
  mockModule.data = {
    chunkId: 'test-chunk',
    loaded: true,
    timestamp: Date.now()
  };
  console.log('✅ Direct assignment succeeded');
} catch (error) {
  console.error('❌ Direct assignment failed:', error.message);

  // Now try with safe assignment
  try {
    console.log('Attempting safe assignment...');
    const result = safeAssign(mockModule, 'data', {
      chunkId: 'test-chunk',
      loaded: true,
      timestamp: Date.now()
    });
    console.log('✅ Safe assignment succeeded');
    console.log('Result data:', result.data);
    console.log('Module changed:', result !== mockModule);
  } catch (safeError) {
    console.error('❌ Safe assignment also failed:', safeError.message);
  }
}

console.log('=== Test Complete ===');