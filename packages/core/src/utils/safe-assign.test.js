/**
 * Tests for the safe property assignment utility
 */

import { describe, it, expect } from 'vitest';
import { safeAssign, safeAssignAll, createSafeDescriptor } from './safe-assign';

describe('safeAssign', () => {
  it('should assign values to normal properties', () => {
    const obj = { name: 'test' };
    const result = safeAssign(obj, 'name', 'updated');

    expect(result).toBe(obj); // Should return the same object
    expect(result.name).toBe('updated');
  });

  it('should handle null and undefined objects', () => {
    expect(safeAssign(null, 'prop', 'value')).toBeNull();
    expect(safeAssign(undefined, 'prop', 'value')).toBeUndefined();
  });

  it('should handle properties with getters but no setters', () => {
    const obj = {};
    Object.defineProperty(obj, 'data', {
      get: () => ({ content: 'original' }),
      enumerable: true,
      configurable: true
    });

    const result = safeAssign(obj, 'data', { content: 'updated' });

    expect(result.data).toEqual({ content: 'updated' });
  });

  it('should create a new object when property is not configurable', () => {
    const obj = {};
    Object.defineProperty(obj, 'data', {
      get: () => ({ content: 'original' }),
      enumerable: true,
      configurable: false // Not configurable
    });

    const result = safeAssign(obj, 'data', { content: 'updated' });

    expect(result).not.toBe(obj); // Should be a different object
    expect(result.data).toEqual({ content: 'updated' });
  });

  it('should preserve other properties when creating a new object', () => {
    const obj = { name: 'test', id: 123 };
    Object.defineProperty(obj, 'data', {
      get: () => ({ content: 'original' }),
      enumerable: true,
      configurable: false
    });

    const result = safeAssign(obj, 'data', { content: 'updated' });

    expect(result).not.toBe(obj);
    expect(result.data).toEqual({ content: 'updated' });
    expect(result.name).toBe('test');
    expect(result.id).toBe(123);
  });

  it('should handle objects with null prototype', () => {
    const obj = Object.create(null);
    obj.name = 'test';

    const result = safeAssign(obj, 'name', 'updated');

    expect(result.name).toBe('updated');
    expect(Object.getPrototypeOf(result)).toBeNull();
  });

  it('should handle frozen objects by creating a new object', () => {
    const obj = { name: 'test' };
    Object.freeze(obj);

    const result = safeAssign(obj, 'name', 'updated');

    expect(result).not.toBe(obj);
    expect(result.name).toBe('updated');
  });

  // Additional edge case tests
  it('should handle sealed objects by creating a new object', () => {
    const obj = { name: 'test' };
    Object.seal(obj);

    const result = safeAssign(obj, 'newProp', 'value');

    expect(result).not.toBe(obj);
    expect(result.newProp).toBe('value');
    expect(result.name).toBe('test');
  });

  it('should handle objects with complex prototype chains', () => {
    const parent = { parentProp: 'parent' };
    const child = Object.create(parent);
    child.childProp = 'child';

    Object.defineProperty(child, 'data', {
      get: () => 'original',
      enumerable: true,
      configurable: false
    });

    const result = safeAssign(child, 'data', 'updated');

    expect(result).not.toBe(child);
    expect(result.data).toBe('updated');
    expect(result.childProp).toBe('child');
    expect(result.parentProp).toBe('parent'); // Should inherit from prototype
  });

  it('should handle non-enumerable properties', () => {
    const obj = {};
    Object.defineProperty(obj, 'hidden', {
      value: 'secret',
      enumerable: false,
      writable: true,
      configurable: true
    });

    Object.defineProperty(obj, 'data', {
      get: () => 'original',
      enumerable: true,
      configurable: false
    });

    const result = safeAssign(obj, 'data', 'updated');

    expect(result).not.toBe(obj);
    expect(result.data).toBe('updated');
    expect(result.hidden).toBe('secret');
    expect(Object.propertyIsEnumerable.call(result, 'hidden')).toBe(false);
  });

  it('should handle properties with both getter and setter', () => {
    const obj = {};
    let internalValue = 'original';

    Object.defineProperty(obj, 'data', {
      get: () => internalValue,
      set: (value) => { internalValue = value; },
      enumerable: true,
      configurable: true
    });

    const result = safeAssign(obj, 'data', 'updated');

    expect(result).toBe(obj); // Should use normal assignment
    expect(result.data).toBe('updated');
    expect(internalValue).toBe('updated');
  });

  it('should handle circular references in objects', () => {
    const obj = { name: 'test' };
    obj.self = obj; // Circular reference

    Object.defineProperty(obj, 'data', {
      get: () => 'original',
      enumerable: true,
      configurable: false
    });

    const result = safeAssign(obj, 'data', 'updated');

    expect(result).not.toBe(obj);
    expect(result.data).toBe('updated');
    expect(result.name).toBe('test');
    expect(result.self).toBe(obj); // Should preserve circular reference
  });

  it('should handle symbols as property keys', () => {
    const sym = Symbol('test');
    const obj = {};
    obj[sym] = 'symbol value';

    Object.defineProperty(obj, 'data', {
      get: () => 'original',
      enumerable: true,
      configurable: false
    });

    const result = safeAssign(obj, 'data', 'updated');

    expect(result).not.toBe(obj);
    expect(result.data).toBe('updated');
    expect(result[sym]).toBe('symbol value');
  });

  it.skip('should handle getters that throw errors', () => {
    const obj = {};
    Object.defineProperty(obj, 'data', {
      get: () => { throw new Error('Getter error'); },
      enumerable: true,
      configurable: false
    });

    // Should not throw during assignment
    let result;
    expect(() => {
      result = safeAssign(obj, 'data', 'updated');
    }).not.toThrow();

    expect(result).not.toBe(obj);

    // Check that the property descriptor was replaced with a writable one
    const descriptor = Object.getOwnPropertyDescriptor(result, 'data');
    expect(descriptor.writable).toBe(true);
    expect(descriptor.value).toBe('updated');
  });

  it('should handle assignment to array indices', () => {
    const arr = [1, 2, 3];
    Object.defineProperty(arr, '1', {
      get: () => 'getter value',
      enumerable: true,
      configurable: false
    });

    const result = safeAssign(arr, '1', 'updated');

    expect(result).not.toBe(arr);
    expect(result[1]).toBe('updated');
    expect(result[0]).toBe(1);
    expect(result[2]).toBe(3);
    // Note: The result may not be a true array since we create a new object
    // but it should have array-like properties
    expect(result.length).toBe(3);
  });

  it('should handle objects with custom toString/valueOf methods', () => {
    const obj = {
      toString: () => 'custom toString',
      valueOf: () => 42
    };

    Object.defineProperty(obj, 'data', {
      get: () => 'original',
      enumerable: true,
      configurable: false
    });

    const result = safeAssign(obj, 'data', 'updated');

    expect(result).not.toBe(obj);
    expect(result.data).toBe('updated');
    expect(result.toString()).toBe('custom toString');
    expect(result.valueOf()).toBe(42);
  });

  it('should handle extremely nested property descriptors', () => {
    const obj = {};

    // Create a deeply nested getter
    Object.defineProperty(obj, 'level1', {
      get: () => ({
        level2: {
          level3: {
            value: 'deep'
          }
        }
      }),
      enumerable: true,
      configurable: false
    });

    const result = safeAssign(obj, 'level1', { updated: true });

    expect(result).not.toBe(obj);
    expect(result.level1).toEqual({ updated: true });
  });

  it('should handle assignment failures gracefully', () => {
    // Create an object that will fail normal assignment
    const obj = {};
    Object.defineProperty(obj, 'data', {
      get: () => 'original',
      set: () => { throw new Error('Setter error'); },
      enumerable: true,
      configurable: true
    });

    const result = safeAssign(obj, 'data', 'updated');

    // Should create a new object when setter fails
    expect(result).not.toBe(obj);
    expect(result.data).toBe('updated');
  });
});

describe('safeAssignAll', () => {
  it('should assign multiple properties safely', () => {
    const obj = { name: 'test' };
    Object.defineProperty(obj, 'data', {
      get: () => ({ content: 'original' }),
      enumerable: true,
      configurable: false
    });

    const result = safeAssignAll(obj, {
      name: 'updated',
      data: { content: 'updated' },
      newProp: 'added'
    });

    expect(result.name).toBe('updated');
    expect(result.data).toEqual({ content: 'updated' });
    expect(result.newProp).toBe('added');
  });

  it('should handle null or non-object props', () => {
    const obj = { name: 'test' };

    expect(safeAssignAll(obj, null)).toBe(obj);
    expect(safeAssignAll(obj, 'not an object')).toBe(obj);
  });

  it('should handle empty props object', () => {
    const obj = { name: 'test' };
    const result = safeAssignAll(obj, {});

    expect(result).toBe(obj);
    expect(result.name).toBe('test');
  });

  it('should handle multiple problematic properties', () => {
    const obj = {};

    Object.defineProperty(obj, 'getter1', {
      get: () => 'value1',
      enumerable: true,
      configurable: false
    });

    Object.defineProperty(obj, 'getter2', {
      get: () => 'value2',
      enumerable: true,
      configurable: false
    });

    const result = safeAssignAll(obj, {
      getter1: 'updated1',
      getter2: 'updated2',
      normal: 'normal value'
    });

    expect(result).not.toBe(obj);
    expect(result.getter1).toBe('updated1');
    expect(result.getter2).toBe('updated2');
    expect(result.normal).toBe('normal value');
  });

  it('should handle mixed property types in assignment', () => {
    const obj = { existing: 'value' };
    Object.freeze(obj);

    const sym = Symbol('test');
    const result = safeAssignAll(obj, {
      newProp: 'new',
      [sym]: 'symbol value',
      123: 'numeric key'
    });

    expect(result).not.toBe(obj);
    expect(result.existing).toBe('value'); // Existing frozen property should remain
    expect(result.newProp).toBe('new');
    expect(result[sym]).toBe('symbol value');
    expect(result['123']).toBe('numeric key'); // Numeric keys are converted to strings
  });

  it('should handle undefined and null values in props', () => {
    const obj = { name: 'test' };

    const result = safeAssignAll(obj, {
      name: undefined,
      nullProp: null,
      zeroProp: 0,
      falseProp: false
    });

    expect(result.name).toBeUndefined();
    expect(result.nullProp).toBeNull();
    expect(result.zeroProp).toBe(0);
    expect(result.falseProp).toBe(false);
  });

  it('should preserve object identity when no problematic properties exist', () => {
    const obj = { name: 'test', id: 123 };

    const result = safeAssignAll(obj, {
      name: 'updated',
      id: 456,
      newProp: 'added'
    });

    expect(result).toBe(obj); // Should be same object
    expect(result.name).toBe('updated');
    expect(result.id).toBe(456);
    expect(result.newProp).toBe('added');
  });
});

describe('createSafeDescriptor', () => {
  it('should create a writable descriptor for getter-only properties', () => {
    const obj = {};
    Object.defineProperty(obj, 'data', {
      get: () => ({ content: 'original' }),
      enumerable: true,
      configurable: true
    });

    const descriptor = createSafeDescriptor(obj, 'data');

    expect(descriptor).toEqual({
      configurable: true,
      enumerable: true,
      writable: true,
      value: { content: 'original' }
    });
  });

  it('should return null for properties that already have setters', () => {
    const obj = {};
    Object.defineProperty(obj, 'data', {
      get: () => ({ content: 'original' }),
      set: () => { },
      enumerable: true,
      configurable: true
    });

    const descriptor = createSafeDescriptor(obj, 'data');

    expect(descriptor).toBeNull();
  });

  it('should return null for writable properties', () => {
    const obj = { name: 'test' };
    const descriptor = createSafeDescriptor(obj, 'name');

    expect(descriptor).toBeNull();
  });

  it('should return null for null or undefined objects', () => {
    expect(createSafeDescriptor(null, 'prop')).toBeNull();
    expect(createSafeDescriptor(undefined, 'prop')).toBeNull();
  });

  it('should handle non-enumerable getter-only properties', () => {
    const obj = {};
    Object.defineProperty(obj, 'hidden', {
      get: () => 'secret',
      enumerable: false,
      configurable: true
    });

    const descriptor = createSafeDescriptor(obj, 'hidden');

    expect(descriptor).toEqual({
      configurable: true,
      enumerable: false,
      writable: true,
      value: 'secret'
    });
  });

  it('should return null for non-existent properties', () => {
    const obj = { name: 'test' };
    const descriptor = createSafeDescriptor(obj, 'nonExistent');

    expect(descriptor).toBeNull();
  });

  it('should handle getters that return undefined', () => {
    const obj = {};
    Object.defineProperty(obj, 'data', {
      get: () => undefined,
      enumerable: true,
      configurable: true
    });

    const descriptor = createSafeDescriptor(obj, 'data');

    expect(descriptor).toEqual({
      configurable: true,
      enumerable: true,
      writable: true,
      value: undefined
    });
  });

  it('should handle getters that throw errors', () => {
    const obj = {};
    Object.defineProperty(obj, 'data', {
      get: () => { throw new Error('Getter error'); },
      enumerable: true,
      configurable: true
    });

    // Should not throw an error
    expect(() => {
      const descriptor = createSafeDescriptor(obj, 'data');
      expect(descriptor).toEqual({
        configurable: true,
        enumerable: true,
        writable: true,
        value: undefined // Should handle error gracefully
      });
    }).not.toThrow();
  });

  it('should handle properties with complex getter return values', () => {
    const complexValue = {
      nested: {
        array: [1, 2, 3],
        func: () => 'test'
      }
    };

    const obj = {};
    Object.defineProperty(obj, 'complex', {
      get: () => complexValue,
      enumerable: true,
      configurable: true
    });

    const descriptor = createSafeDescriptor(obj, 'complex');

    expect(descriptor).toEqual({
      configurable: true,
      enumerable: true,
      writable: true,
      value: complexValue
    });
  });

  it('should handle symbol properties', () => {
    const sym = Symbol('test');
    const obj = {};
    Object.defineProperty(obj, sym, {
      get: () => 'symbol value',
      enumerable: true,
      configurable: true
    });

    const descriptor = createSafeDescriptor(obj, sym);

    expect(descriptor).toEqual({
      configurable: true,
      enumerable: true,
      writable: true,
      value: 'symbol value'
    });
  });

  it('should handle numeric string properties', () => {
    const obj = {};
    Object.defineProperty(obj, '123', {
      get: () => 'numeric key',
      enumerable: true,
      configurable: true
    });

    const descriptor = createSafeDescriptor(obj, '123');

    expect(descriptor).toEqual({
      configurable: true,
      enumerable: true,
      writable: true,
      value: 'numeric key'
    });
  });
});