# 🚀 Modern MTM Syntax Specification

## **Design Principles**

1. **Modern & Clean**: $ prefix variables with automatic type inference
2. **Reactive by Default**: ! suffix for reactive variables that auto-update UI
3. **Framework-Agnostic**: Universal patterns that compile to any framework
4. **Type-Safe**: Full TypeScript support with optional explicit typing
5. **Developer-Friendly**: Familiar JavaScript patterns with enhanced features

## **File Structure**

```javascript
---
target: reactjs | vue | solid | svelte
channels:
  - event: event-name
    emit: handlerName
---

export default function ComponentName() {
  // Modern MTM syntax with $ prefix and reactive variables
  $state! = initialValue
  $computed = () => derivedValue

  return template(`...`)
}
```

## **Modern Syntax Features**

### **Variable Declarations**

```javascript
// Reactive variables with automatic type inference
$counter! = 0                    // number (reactive)
$message! = "Hello"              // string (reactive)
$items! = []                     // array (reactive)
$user! = { name: '', age: 0 }    // object (reactive)

// Explicit type annotations
$price: float = 99.99            // explicit float type
$name: string = "MTM"            // explicit string type
$isActive: boolean = true        // explicit boolean type

// Non-reactive variables (computed/derived)
$total = $items.length           // computed from reactive variables
$greeting = `Hello, ${$name}!`   // template literal with reactive data
```

### **Function Declarations**

```javascript
// Simplified arrow function syntax
$increment = () => {
  $counter++; // Direct reactive variable update
  emit("counter-changed", $counter);
};

// Functions with parameters and type annotations
$addItem = ($text: string) => {
  $items = [...$items, { id: Date.now(), text: $text }];
};

// Async functions
$fetchData = async ($url: string) => {
  $loading = true;
  $data = await fetch($url).then((r) => r.json());
  $loading = false;
};
```

### **Template Syntax**

```html
<!-- Variable interpolation -->
<span>{{$counter}}</span>
<span>{{$user.name}}</span>
<span>{{$total * 2}}</span>

<!-- Event handlers -->
<button click="{{$increment}}">Click</button>
<input input="{{(e) => $name = e.target.value}}" />

<!-- Conditional rendering -->
{{#if $isVisible}}
<div>Shown when true</div>
{{/if}} {{#if $counter > 5}}
<div>High count!</div>
{{else}}
<div>Low count</div>
{{/if}}

<!-- List rendering -->
{{#each $items as item}}
<div key="{{item.id}}">{{item.text}}</div>
{{/each}}

<!-- Attributes and properties -->
<div class="{{$theme}}" style="color: {{$textColor}}">
  <input value="{{$inputValue}}" disabled="{{$isDisabled}}" />
</div>
```

## **Example Components**

### **Counter Component (Modern Syntax)**

```javascript
---
target: reactjs
channels:
  - event: counter-updated
    emit: onCounterUpdate
---

export default function Counter() {
  // Modern MTM syntax with reactive variables
  $count! = useSignal('globalCount', 0)

  $increment = () => {
    $count++
    emit('counter-updated', { value: $count })
  }

  $decrement = () => {
    $count = Math.max(0, $count - 1)
  }

  return template(`
    <div class="counter">
      <h3>Counter</h3>
      <div class="counter-display">
        <button click="{{$decrement}}">-</button>
        <span class="count">{{$count}}</span>
        <button click="{{$increment}}">+</button>
      </div>
      <small>Global count shared across frameworks</small>
    </div>
  `)
}
```

### **Form Component (Modern Syntax)**

```javascript
---
target: vue
channels:
  - event: form-submitted
    emit: onFormSubmit
---

export default function ContactForm() {
  // Reactive form state with type annotations
  $name! = ''
  $email! = ''
  $message! = ''

  // Computed validation
  $isValid = $name.trim() && $email.includes('@') && $message.trim()

  $handleSubmit = ($e) => {
    $e.preventDefault()
    if (!$isValid) return

    $formData = {
      name: $name,
      email: $email,
      message: $message,
      timestamp: Date.now()
    }

    emit('form-submitted', $formData)

    // Reset form
    $name = ''
    $email = ''
    $message = ''
  }

  return template(`
    <form class="contact-form" submit="{{$handleSubmit}}">
      <h3>Contact Form</h3>

      <div class="form-group">
        <label>Name:</label>
        <input
          type="text"
          value="{{$name}}"
          input="{{(e) => $name = e.target.value}}"
          required
        />
      </div>

      <div class="form-group">
        <label>Email:</label>
        <input
          type="email"
          value="{{$email}}"
          input="{{(e) => $email = e.target.value}}"
          required
        />
      </div>

      <div class="form-group">
        <label>Message:</label>
        <textarea
          value="{{$message}}"
          input="{{(e) => $message = e.target.value}}"
          required
        ></textarea>
      </div>

      <button type="submit" disabled="{{!$isValid}}">
        Send Message
      </button>
    </form>
  `)
}
```

## **Compilation Examples**

### **Modern MTM Input**

```javascript
---
target: reactjs
---

export default function Counter() {
  $count! = useSignal('globalCount', 0)

  $increment = () => {
    $count++
    emit('counter-updated', { value: $count })
  }

  $decrement = () => {
    $count = Math.max(0, $count - 1)
  }

  return template(`
    <div class="counter">
      <h3>Counter</h3>
      <div class="counter-display">
        <button click="{{$decrement}}">-</button>
        <span class="count">{{$count}}</span>
        <button click="{{$increment}}">+</button>
      </div>
      <small>Global count shared across frameworks</small>
    </div>
  `)
}
```

### **React Output (Compiled)**

```jsx
import React, { useState, useCallback } from "react";
import { useMetamonSignal, useMetamonPubSub } from "@metamon/adapters/react";

export default function Counter() {
  const [count, setCount] = useMetamonSignal("globalCount", 0);
  const { emit } = useMetamonPubSub();

  const increment = useCallback(() => {
    setCount((prev) => prev + 1);
    emit("counter-updated", { value: count + 1 });
  }, [count, setCount, emit]);

  const decrement = useCallback(() => {
    setCount((prev) => Math.max(0, prev - 1));
  }, [setCount]);

  return (
    <div className="counter">
      <h3>Counter</h3>
      <div className="counter-display">
        <button onClick={decrement}>-</button>
        <span className="count">{count}</span>
        <button onClick={increment}>+</button>
      </div>
      <small>Global count shared across frameworks</small>
    </div>
  );
}
```

### **Vue Output (Compiled)**

```vue
<template>
  <div class="counter">
    <h3>Counter</h3>
    <div class="counter-display">
      <button @click="decrement">-</button>
      <span class="count">{{ count }}</span>
      <button @click="increment">+</button>
    </div>
    <small>Global count shared across frameworks</small>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useMetamonSignal, useMetamonPubSub } from "@metamon/adapters/vue";

const [count, setCount] = useMetamonSignal("globalCount", 0);
const { emit } = useMetamonPubSub();

const increment = () => {
  setCount(count.value + 1);
  emit("counter-updated", { value: count.value + 1 });
};

const decrement = () => {
  setCount(Math.max(0, count.value - 1));
};
</script>
```

### **Svelte Output (Compiled)**

```svelte
<script>
  import { writable } from "svelte/store";
  import { useMetamonSignal, useMetamonPubSub } from "@metamon/adapters/svelte";

  const [count, setCount] = useMetamonSignal("globalCount", 0);
  const { emit } = useMetamonPubSub();

  function increment() {
    setCount($count + 1);
    emit("counter-updated", { value: $count + 1 });
  }

  function decrement() {
    setCount(Math.max(0, $count - 1));
  }
</script>

<div class="counter">
  <h3>Counter</h3>
  <div class="counter-display">
    <button on:click={decrement}>-</button>
    <span class="count">{$count}</span>
    <button on:click={increment}>+</button>
  </div>
  <small>Global count shared across frameworks</small>
</div>
```

## **IDE Support Strategy**

### **Phase 1: JavaScript + Comments**

```javascript
// .mtm files are valid JavaScript with special comments
export default function Counter() {
  const count = useSignal("globalCount", 0); // ✅ Full autocomplete
  return template(`<div>{{count.value}}</div>`); // ✅ String templates
}
```

### **Phase 2: TypeScript Definitions**

```typescript
// @metamon/types
declare function useSignal<T>(key: string, initial: T): Signal<T>;
declare function usePubSub(): PubSubAPI;
declare function template(str: string): ComponentTemplate;
```

### **Phase 3: VS Code Extension**

- Syntax highlighting for .mtm files
- Template string highlighting
- Autocomplete for Metamon APIs
- Error checking and validation

## **Benefits of Modern MTM Syntax**

### **For Developers**

- ✅ **Clean & Modern**: $ prefix variables feel natural and modern
- ✅ **Reactive by Default**: ! suffix makes reactive variables explicit
- ✅ **Type Safety**: Automatic inference + optional explicit typing
- ✅ **Framework Agnostic**: Same code compiles to React, Vue, Svelte
- ✅ **Simplified Functions**: Arrow syntax with automatic this binding
- ✅ **Template Binding**: Clean {{}} syntax for data binding

### **For Teams**

- ✅ **Consistent Patterns**: Same reactive patterns across all frameworks
- ✅ **Better Performance**: Optimized reactive updates and batching
- ✅ **Easy Migration**: Gradual migration from legacy syntax
- ✅ **Developer Experience**: Enhanced error messages and type hints

### **Key Improvements Over Legacy Syntax**

| Feature   | Legacy Syntax                                    | Modern Syntax                           |
| --------- | ------------------------------------------------ | --------------------------------------- |
| Variables | `const count = useSignal('count', 0)`            | `$count! = 0`                           |
| Functions | `const increment = useCallback(() => {...}, [])` | `$increment = () => {...}`              |
| Templates | `{count.value}`                                  | `{{$count}}`                            |
| Events    | `onClick={increment}`                            | `click="{{$increment}}"`                |
| Types     | Manual TypeScript annotations                    | Automatic inference + optional explicit |

---

## **Migration Guide**

### **From Legacy to Modern Syntax**

1. **Replace useSignal calls**: `const count = useSignal('count', 0)` → `$count! = 0`
2. **Update function declarations**: `const func = useCallback(...)` → `$func = (...) => {...}`
3. **Modernize templates**: `{count.value}` → `{{$count}}`
4. **Update event handlers**: `onClick={handler}` → `click="{{$handler}}"`
5. **Add type annotations where needed**: `$price: float = 99.99`

### **Automatic Migration Tool**

The MTM compiler includes an automatic migration tool that can convert legacy syntax to modern syntax:

```bash
# Analyze migration opportunities
mtm migrate analyze src/components/

# Apply automatic migration
mtm migrate apply src/components/legacy-component.mtm
```

This modern syntax makes MTM development faster, cleaner, and more intuitive! 🚀
