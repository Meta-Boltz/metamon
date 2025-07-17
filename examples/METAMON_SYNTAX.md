# 🎯 Metamon .mtm Syntax Specification

## **Design Principles**

1. **IDE-Friendly**: Standard JavaScript with full autocomplete/IntelliSense
2. **Framework-Agnostic**: Universal patterns that compile to any framework
3. **Simple Templates**: Easy-to-understand template syntax
4. **Type-Safe**: Full TypeScript support
5. **Developer-Friendly**: Familiar patterns, minimal learning curve

## **File Structure**

```javascript
---
target: reactjs | vue | solid | svelte
channels:
  - event: event-name
    emit: handlerName
---

// Standard JavaScript with Metamon APIs
export default function ComponentName() {
  // Component logic here
  return template(`...`);
}
```

## **Core APIs**

### **State Management**

```javascript
// Create reactive state
const count = useSignal("globalCount", 0); // Global signal
const localState = useSignal(null, "initial"); // Local signal

// Update state
count.update(newValue);
count.update((prev) => prev + 1);

// Read state
console.log(count.value);
```

### **Event Communication**

```javascript
const { emit, subscribe } = usePubSub();

// Emit events
emit('user-action', { type: 'click', data: {...} });

// Subscribe to events
subscribe('user-action', (data) => {
  console.log('Received:', data);
});
```

### **Template Syntax**

```html
<!-- Variable interpolation -->
<span>{{variable}}</span>
<span>{{object.property}}</span>
<span>{{computedValue()}}</span>

<!-- Event handlers -->
<button onclick="{{handleClick}}">Click</button>
<input oninput="{{(e) => updateValue(e.target.value)}}" />

<!-- Conditional rendering -->
{{#if condition}}
<div>Shown when true</div>
{{/if}} {{#if condition}}
<div>True branch</div>
{{else}}
<div>False branch</div>
{{/if}}

<!-- List rendering -->
{{#each items as item}}
<div key="{{item.id}}">{{item.name}}</div>
{{/each}}

<!-- Attributes -->
<div class="{{dynamicClass}}" style="{{dynamicStyle}}">
  <input value="{{inputValue}}" disabled="{{isDisabled}}" />
</div>
```

## **Example Components**

### **Counter Component**

```javascript
---
target: reactjs
channels:
  - event: counter-updated
    emit: onCounterUpdate
---

export default function Counter() {
  const count = useSignal('globalCount', 0);
  const { emit } = usePubSub();

  const increment = () => {
    count.update(count.value + 1);
    emit('counter-updated', { value: count.value });
  };

  const decrement = () => {
    count.update(Math.max(0, count.value - 1));
  };

  return template(`
    <div class="counter">
      <h3>Counter</h3>
      <div class="counter-display">
        <button onclick="{{decrement}}">-</button>
        <span class="count">{{count.value}}</span>
        <button onclick="{{increment}}">+</button>
      </div>
      <small>Global count shared across frameworks</small>
    </div>
  `);
}
```

### **Form Component**

```javascript
---
target: vue
channels:
  - event: form-submitted
    emit: onFormSubmit
---

export default function ContactForm() {
  const name = useSignal(null, '');
  const email = useSignal(null, '');
  const message = useSignal(null, '');
  const { emit } = usePubSub();

  const isValid = () => {
    return name.value.trim() &&
           email.value.includes('@') &&
           message.value.trim();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid()) return;

    const formData = {
      name: name.value,
      email: email.value,
      message: message.value,
      timestamp: Date.now()
    };

    emit('form-submitted', formData);

    // Reset form
    name.update('');
    email.update('');
    message.update('');
  };

  return template(`
    <form class="contact-form" onsubmit="{{handleSubmit}}">
      <h3>Contact Form</h3>

      <div class="form-group">
        <label>Name:</label>
        <input
          type="text"
          value="{{name.value}}"
          oninput="{{(e) => name.update(e.target.value)}}"
          required
        />
      </div>

      <div class="form-group">
        <label>Email:</label>
        <input
          type="email"
          value="{{email.value}}"
          oninput="{{(e) => email.update(e.target.value)}}"
          required
        />
      </div>

      <div class="form-group">
        <label>Message:</label>
        <textarea
          value="{{message.value}}"
          oninput="{{(e) => message.update(e.target.value)}}"
          required
        ></textarea>
      </div>

      <button type="submit" disabled="{{!isValid()}}">
        Send Message
      </button>
    </form>
  `);
}
```

## **Compilation Examples**

### **React Output**

```jsx
import React, { useState, useEffect } from "react";
import { useMetamonSignal, useMetamonPubSub } from "@metamon/adapters/react";

export default function Counter() {
  const [count, setCount] = useMetamonSignal("globalCount", 0);
  const { emit } = useMetamonPubSub();

  const increment = () => {
    setCount(count + 1);
    emit("counter-updated", { value: count });
  };

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

### **Vue Output**

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
import { useMetamonSignal, useMetamonPubSub } from "@metamon/adapters/vue";

const [count, setCount] = useMetamonSignal("globalCount", 0);
const { emit } = useMetamonPubSub();

const increment = () => {
  setCount(count.value + 1);
  emit("counter-updated", { value: count.value });
};
</script>
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

## **Benefits**

### **For Developers**

- ✅ **Full IDE Support**: Autocomplete, error checking, refactoring
- ✅ **Familiar Syntax**: Standard JavaScript + simple templates
- ✅ **Type Safety**: Full TypeScript support
- ✅ **Framework Agnostic**: Same code, multiple targets

### **For Teams**

- ✅ **Easy Learning**: Minimal new syntax to learn
- ✅ **Consistent Patterns**: Same patterns across all frameworks
- ✅ **Better DX**: Full development tool support
- ✅ **Gradual Adoption**: Can start with simple components

---

## **Recommendation: Use Primitive Syntax**

Until we have full IDE support for .mtm files, using primitive/universal syntax gives us:

1. **Full IDE Support** - Autocomplete, error checking, refactoring
2. **Framework Flexibility** - Same code compiles to any framework
3. **Developer Experience** - Familiar JavaScript patterns
4. **Future-Proof** - Easy to extend with more features

This approach makes .mtm files practical for real development work! 🚀
