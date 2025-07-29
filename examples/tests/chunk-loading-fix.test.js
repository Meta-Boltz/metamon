// Chunk Loading Fix Tests
// Tests for the safe property assignment utility integrated into the build system

import { describe, it, expect } from 'vitest';

describe('Chunk Loading Fix', () => {
  // Test the safe assignment utility that gets embedded in compiled chunks
  const safeAssignCode = `
    function safeAssign(obj, prop, value) {
      if (!obj || typeof obj !== 'object') {
        return obj;
      }

      try {
        const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
        
        if (descriptor) {
          if (descriptor.get && !descriptor.set) {
            const newObj = Object.create(Object.getPrototypeOf(obj));
            
            for (const key of Object.getOwnPropertyNames(obj)) {
              if (key !== prop) {
                try {
                  const existingDescriptor = Object.getOwnPropertyDescriptor(obj, key);
                  if (existingDescriptor) {
                    Object.defineProperty(newObj, key, existingDescriptor);
                  }
                } catch (e) {
                  // Skip properties that can't be copied
                }
              }
            }
            
            Object.defineProperty(newObj, prop, {
              value: value,
              writable: true,
              enumerable: true,
              configurable: true
            });
            
            return newObj;
          }
          
          if (descriptor.writable !== false || descriptor.set) {
            obj[prop] = value;
            return obj;
          }
          
          const newObj = Object.create(Object.getPrototypeOf(obj));
          
          for (const key of Object.getOwnPropertyNames(obj)) {
            if (key !== prop) {
              try {
                const existingDescriptor = Object.getOwnPropertyDescriptor(obj, key);
                if (existingDescriptor) {
                  Object.defineProperty(newObj, key, existingDescriptor);
                }
              } catch (e) {
                // Skip properties that can't be copied
              }
            }
          }
          
          Object.defineProperty(newObj, prop, {
            value: value,
            writable: true,
            enumerable: true,
            configurable: true
          });
          
          return newObj;
        }
        
        obj[prop] = value;
        return obj;
        
      } catch (error) {
        try {
          const newObj = Object.create(Object.getPrototypeOf(obj));
          
          for (const key in obj) {
            if (key !== prop && obj.hasOwnProperty(key)) {
              try {
                newObj[key] = obj[key];
              } catch (e) {
                // Skip properties that can't be copied
              }
            }
          }
          
          newObj[prop] = value;
          return newObj;
        } catch (fallbackError) {
          return obj;
        }
      }
    }
    
    return safeAssign;
  `;

  // Create the safeAssign function for testing
  const safeAssign = new Function(safeAssignCode)();

  it('should handle writable properties normally', () => {
    const obj = { data: 'original' };
    const result = safeAssign(obj, 'data', 'updated');

    expect(result).toBe(obj);
    expect(result.data).toBe('updated');
  });

  it('should create new object for getter-only properties', () => {
    const obj = {};
    Object.defineProperty(obj, 'data', {
      get() { return 'getter-value'; },
      enumerable: true,
      configurable: true
    });

    const result = safeAssign(obj, 'data', 'new-value');

    expect(result).not.toBe(obj);
    expect(result.data).toBe('new-value');
    expect(obj.data).toBe('getter-value'); // Original unchanged
  });

  it('should create new object for non-writable properties', () => {
    const obj = {};
    Object.defineProperty(obj, 'data', {
      value: 'readonly-value',
      writable: false,
      enumerable: true,
      configurable: true
    });

    const result = safeAssign(obj, 'data', 'new-value');

    expect(result).not.toBe(obj);
    expect(result.data).toBe('new-value');
    expect(obj.data).toBe('readonly-value'); // Original unchanged
  });

  it('should handle getter-setter properties normally', () => {
    let internalValue = 'initial';
    const obj = {};
    Object.defineProperty(obj, 'data', {
      get() { return internalValue; },
      set(value) { internalValue = value; },
      enumerable: true,
      configurable: true
    });

    const result = safeAssign(obj, 'data', 'setter-value');

    expect(result).toBe(obj);
    expect(result.data).toBe('setter-value');
  });

  it('should add new properties normally', () => {
    const obj = { existing: 'value' };
    const result = safeAssign(obj, 'newProp', 'new-value');

    expect(result).toBe(obj);
    expect(result.newProp).toBe('new-value');
    expect(result.existing).toBe('value');
  });

  it('should handle invalid objects gracefully', () => {
    expect(safeAssign(null, 'prop', 'value')).toBe(null);
    expect(safeAssign(undefined, 'prop', 'value')).toBe(undefined);
    expect(safeAssign('string', 'prop', 'value')).toBe('string');
  });

  it('should preserve prototype chain when creating new objects', () => {
    const parent = { parentProp: 'parent-value' };
    const obj = Object.create(parent);
    obj.ownProp = 'own-value';

    Object.defineProperty(obj, 'data', {
      get() { return 'getter-value'; },
      enumerable: true,
      configurable: true
    });

    const result = safeAssign(obj, 'data', 'new-value');

    expect(result).not.toBe(obj);
    expect(result.data).toBe('new-value');
    expect(result.ownProp).toBe('own-value');
    expect(result.parentProp).toBe('parent-value');
    expect(Object.getPrototypeOf(result)).toBe(Object.getPrototypeOf(obj));
  });
});