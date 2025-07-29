/**
 * Safe property assignment utility for Metamon framework
 * 
 * This utility addresses the TypeError that occurs when attempting to set properties
 * on objects that have getter-only properties, which is a common issue when loading
 * chunks generated from .mtm files.
 */

/**
 * Safely assigns a value to an object property, handling getter-only properties
 * 
 * @param {Object} obj - The target object
 * @param {string} prop - The property name to assign
 * @param {any} value - The value to assign
 * @returns {Object} - The original object or a new object with the assigned property
 */
export function safeAssign(obj, prop, value) {
  // Skip assignment for null or undefined objects
  if (obj == null) {
    return obj;
  }

  // Check if property exists and has a getter but no setter
  const descriptor = Object.getOwnPropertyDescriptor(obj, prop);

  // Check if object is frozen or sealed
  const isImmutable = Object.isFrozen(obj) || Object.isSealed(obj);

  if ((descriptor && descriptor.get && !descriptor.set) || isImmutable) {
    // Property has getter but no setter, or object is immutable
    try {
      // Try to use Object.defineProperty to override if configurable
      if (descriptor && descriptor.configurable && !isImmutable) {
        Object.defineProperty(obj, prop, {
          configurable: true,
          enumerable: descriptor.enumerable,
          get: () => value,
          set: (newValue) => {
            value = newValue;
          }
        });
        return obj;
      } else {
        // Property is not configurable or object is immutable, create a new object
        throw new Error('Property is not configurable or object is immutable');
      }
    } catch (e) {
      // If defineProperty fails, create a new object with the desired properties
      const newObj = Object.create(Object.getPrototypeOf(obj));

      // Copy all own properties (including symbols) except the one we're trying to set
      const allKeys = [...Object.getOwnPropertyNames(obj), ...Object.getOwnPropertySymbols(obj)];
      allKeys.forEach((key) => {
        if (key !== prop) {
          const keyDescriptor = Object.getOwnPropertyDescriptor(obj, key);
          if (keyDescriptor) {
            try {
              // For getter-only properties that might throw, create a safe copy
              if (keyDescriptor.get && !keyDescriptor.set) {
                try {
                  const value = keyDescriptor.get.call(obj);
                  Object.defineProperty(newObj, key, {
                    configurable: keyDescriptor.configurable,
                    enumerable: keyDescriptor.enumerable,
                    writable: true,
                    value
                  });
                } catch (getterError) {
                  // If getter throws, skip this property or create a placeholder
                  Object.defineProperty(newObj, key, {
                    configurable: true,
                    enumerable: keyDescriptor.enumerable,
                    writable: true,
                    value: undefined
                  });
                }
              } else {
                Object.defineProperty(newObj, key, keyDescriptor);
              }
            } catch (e) {
              // If we can't copy the descriptor, try to copy the value
              try {
                newObj[key] = obj[key];
              } catch (e2) {
                // Skip properties that can't be copied
              }
            }
          }
        }
      });

      // Add our property with the new value
      try {
        Object.defineProperty(newObj, prop, {
          configurable: true,
          enumerable: descriptor ? descriptor.enumerable : true,
          writable: true,
          value
        });
      } catch (e) {
        // If defineProperty fails, try simple assignment
        newObj[prop] = value;
      }

      return newObj; // Return new object to replace the original
    }
  } else {
    try {
      // Try normal property assignment
      obj[prop] = value;
      return obj;
    } catch (e) {
      // If assignment fails, create a new object
      const newObj = Object.create(Object.getPrototypeOf(obj));

      // Copy all own properties (including symbols)
      const allKeys = [...Object.getOwnPropertyNames(obj), ...Object.getOwnPropertySymbols(obj)];
      allKeys.forEach((key) => {
        const keyDescriptor = Object.getOwnPropertyDescriptor(obj, key);
        if (keyDescriptor) {
          try {
            // For getter-only properties that might throw, create a safe copy
            if (keyDescriptor.get && !keyDescriptor.set) {
              try {
                const value = keyDescriptor.get.call(obj);
                Object.defineProperty(newObj, key, {
                  configurable: keyDescriptor.configurable,
                  enumerable: keyDescriptor.enumerable,
                  writable: true,
                  value
                });
              } catch (getterError) {
                // If getter throws, skip this property or create a placeholder
                Object.defineProperty(newObj, key, {
                  configurable: true,
                  enumerable: keyDescriptor.enumerable,
                  writable: true,
                  value: undefined
                });
              }
            } else {
              Object.defineProperty(newObj, key, keyDescriptor);
            }
          } catch (e) {
            // If we can't copy the descriptor, try to copy the value
            try {
              newObj[key] = obj[key];
            } catch (e2) {
              // Skip properties that can't be copied
            }
          }
        }
      });

      // Add our property with the new value
      try {
        Object.defineProperty(newObj, prop, {
          configurable: true,
          enumerable: true,
          writable: true,
          value
        });
      } catch (e) {
        // If defineProperty fails, try simple assignment
        try {
          newObj[prop] = value;
        } catch (e2) {
          // If simple assignment also fails, skip this property
          // This can happen with read-only properties
        }
      }

      return newObj;
    }
  }
}

/**
 * Safely assigns multiple properties to an object
 * 
 * @param {Object} obj - The target object
 * @param {Object} props - Object containing properties to assign
 * @returns {Object} - The resulting object after all assignments
 */
export function safeAssignAll(obj, props) {
  if (!props || typeof props !== 'object') {
    return obj;
  }

  let result = obj;

  // Handle both string/number keys and symbol keys
  const allKeys = [...Object.keys(props), ...Object.getOwnPropertySymbols(props)];

  for (const key of allKeys) {
    result = safeAssign(result, key, props[key]);
  }

  return result;
}

/**
 * Creates a safe property descriptor that ensures the property can be written to
 * 
 * @param {Object} obj - The object to check
 * @param {string} prop - The property name
 * @returns {PropertyDescriptor|null} - A safe property descriptor or null if not applicable
 */
export function createSafeDescriptor(obj, prop) {
  if (obj == null) {
    return null;
  }

  const descriptor = Object.getOwnPropertyDescriptor(obj, prop);

  // If no descriptor or already has a setter, no need to modify
  if (!descriptor || descriptor.set || descriptor.writable) {
    return null;
  }

  // Create a new descriptor that allows writing
  let value;
  try {
    value = descriptor.get ? descriptor.get.call(obj) : undefined;
  } catch (e) {
    value = undefined; // Handle getters that throw errors
  }

  return {
    configurable: true,
    enumerable: descriptor.enumerable,
    writable: true,
    value
  };
}