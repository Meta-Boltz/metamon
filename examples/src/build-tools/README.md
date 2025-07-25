# Fixed MTM Transformer

This directory contains a fixed version of the MTM transformer that addresses the chunk loading issue in the Metamon framework.

## The Issue

The original MTM transformer generates code that creates objects with getter-only properties. When the chunk loader attempts to set values on these properties, it fails with a TypeError:

```
Failed to load chunk _src_pages_index_mtm_import_mtm_transformed: TypeError: Cannot set property data of #<Object> which has only a getter at index.mtm:1:1
```

This error occurs because:

1. The MTM transformer creates objects with getter-only properties
2. The chunk loader tries to set values on these properties
3. In strict mode, this throws a TypeError

## The Solution

The fixed MTM transformer (`mtm-transformer-fixed.js`) addresses this issue by:

1. Ensuring that exported objects have writable properties
2. Adding a compatibility wrapper that uses the `safeAssign` utility
3. Providing metadata about the transformed module to help with debugging

## How to Use

### Option 1: Use the Fixed Vite Config

The easiest way to use the fixed transformer is to use the updated Vite config:

```bash
# Start the development server with the fixed config
npx vite --config vite.config.fixed.js
```

### Option 2: Update Your Imports

If you're using the MTM transformer directly, update your imports:

```javascript
// Before
import TemplateTransformer from "./template-transformer.js";

// After
import MTMTransformer from "./mtm-transformer-fixed.js";
```

### Option 3: Use the Safe Assignment Utility

If you can't update the transformer, you can use the `safeAssign` utility directly:

```javascript
import { safeAssign } from "../../../packages/core/src/utils/safe-assign.js";

// Instead of:
obj.data = newValue;

// Use:
const updatedObj = safeAssign(obj, "data", newValue);
```

## Testing

To run the tests for the fixed transformer:

```bash
npx vitest run examples/src/tests/mtm-transformer-fixed.test.js
```

## Implementation Details

The fixed transformer adds a compatibility wrapper to the transformed code that:

1. Imports the `safeAssign` utility
2. Creates a new exports object with writable properties
3. Adds metadata about the transformation
4. Replaces the module exports with the safe version

For ESM modules, it adds a special `__mtmEnsureSafeExports` function that can be called by the chunk loader to ensure safe exports.

## Compatibility

The fixed transformer is compatible with all frameworks supported by the original transformer:

- React
- Vue
- Svelte
- Solid
- Vanilla JavaScript
