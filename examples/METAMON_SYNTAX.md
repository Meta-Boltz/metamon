# 🚀 Ultra-Modern MTM Syntax Specification

## **Design Principles**

1. **Ultra-Clean**: No frontmatter, framework determined by filename
2. **Signal-Only**: Unified signal system for state and events
3. **Template-First**: Clean `<template>` blocks with modern binding syntax
4. **Type-Safe**: Full TypeScript support with automatic inference
5. **Pure JS Fallback**: No framework extension = pure JavaScript output

## **File Structure**

```javascript
// Framework determined by filename extension:
// counter.react.mtm → React component
// counter.vue.mtm → Vue component
// counter.svelte.mtm → Svelte component
// counter.mtm → Pure JavaScript

export default function ComponentName() {
  // Modern MTM syntax with $ prefix and reactive variables
  $state! = signal('key', initialValue)
  $computed = () => derivedValue

  <template>
    <div>{$state}</div>
  </template>
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
  $counter++;
  signal.emit("counter-changed", $counter);
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
<template>
  <!-- Variable interpolation -->
  <span>{$counter}</span>
  <span>{$user.name}</span>
  <span>{$total * 2}</span>

  <!-- Event handlers -->
  <button click="{$increment}">Click</button>
  <input input={(e) => $name = e.target.value} />

  <!-- Conditional rendering -->
  {#if $isVisible}
  <div>Shown when true</div>
  {/if} {#if $counter > 5}
  <div>High count!</div>
  {:else}
  <div>Low count</div>
  {/if}

  <!-- List rendering -->
  {#each $items as item}
  <div key="{item.id}">{item.text}</div>
  {/each}

  <!-- Attributes and properties -->
  <div class="{$theme}" style="color: {$textColor}">
    <input value="{$inputValue}" disabled="{$isDisabled}" />
  </div>
</template>
```

## **Example Components**

### **Counter Component (Ultra-Modern Syntax)**

```javascript
// counter.react.mtm - Framework determined by filename
export default function Counter() {
  // Ultra-modern MTM syntax with signals
  $count! = signal('globalCount', 0)

  $increment = () => {
    $count++
    signal.emit('counter-updated', { value: $count })
  }

  $decrement = () => {
    $count = Math.max(0, $count - 1)
  }

  <template>
    <div class="counter">
      <h3>Counter</h3>
      <div class="counter-display">
        <button click={$decrement}>-</button>
        <span class="count">{$count}</span>
        <button click={$increment}>+</button>
      </div>
      <small>Global count shared across frameworks</small>
    </div>
  </template>
}
```

### **Form Component (Ultra-Modern Syntax)**

```javascript
// contact-form.vue.mtm - Framework determined by filename
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

    signal.emit('form-submitted', $formData)

    // Reset form
    $name = ''
    $email = ''
    $message = ''
  }

  <template>
    <form class="contact-form" submit={$handleSubmit}>
      <h3>Contact Form</h3>

      <div class="form-group">
        <label>Name:</label>
        <input
          type="text"
          value={$name}
          input={(e) => $name = e.target.value}
          required
        />
      </div>

      <div class="form-group">
        <label>Email:</label>
        <input
          type="email"
          value={$email}
          input={(e) => $email = e.target.value}
          required
        />
      </div>

      <div class="form-group">
        <label>Message:</label>
        <textarea
          value={$message}
          input={(e) => $message = e.target.value}
          required
        ></textarea>
      </div>

      <button type="submit" disabled={!$isValid}>
        Send Message
      </button>
    </form>
  </template>
}
```

## **Compilation Examples**

### **Ultra-Modern MTM Input**

```javascript
// counter.react.mtm - Framework determined by filename
export default function Counter() {
  $count! = signal('globalCount', 0)

  $increment = () => {
    $count++
    signal.emit('counter-updated', { value: $count })
  }

  $decrement = () => {
    $count = Math.max(0, $count - 1)
  }

  <template>
    <div class="counter">
      <h3>Counter</h3>
      <div class="counter-display">
        <button click={$decrement}>-</button>
        <span class="count">{$count}</span>
        <button click={$increment}>+</button>
      </div>
      <small>Global count shared across frameworks</small>
    </div>
  </template>
}
```

### **React Output (Compiled)**

```jsx
import React, { useState, useCallback } from "react";
import { signal } from "@metamon/signal";

export default function Counter() {
  const [count, setCount] = signal.use("globalCount", 0);

  const increment = useCallback(() => {
    setCount((prev) => prev + 1);
    signal.emit("counter-updated", { value: count + 1 });
  }, [count, setCount]);

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
import { signal } from "@metamon/signal";

const [count, setCount] = signal.use("globalCount", 0);

const increment = () => {
  setCount(count.value + 1);
  signal.emit("counter-updated", { value: count.value + 1 });
};

const decrement = () => {
  setCount(Math.max(0, count.value - 1));
};
</script>
```

### **Svelte Output (Compiled)**

```svelte
<script>
  import { signal } from "@metamon/signal";

  const [count, setCount] = signal.use("globalCount", 0);

  function increment() {
    setCount($count + 1);
    signal.emit("counter-updated", { value: $count + 1 });
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

### **Pure JavaScript Output (Compiled)**

```javascript
// counter.mtm - No framework extension = Pure JS
import { signal } from "@metamon/signal";

export default function Counter() {
  const [count, setCount] = signal.use("globalCount", 0);

  const increment = () => {
    setCount(count + 1);
    signal.emit("counter-updated", { value: count });
  };

  const decrement = () => {
    setCount(Math.max(0, count - 1));
  };

  // Pure DOM manipulation
  const element = document.createElement("div");
  element.className = "counter";
  element.innerHTML = `
    <h3>Counter</h3>
    <div class="counter-display">
      <button class="decrement">-</button>
      <span class="count">${count}</span>
      <button class="increment">+</button>
    </div>
    <small>Global count shared across frameworks</small>
  `;

  // Event listeners
  element.querySelector(".increment").addEventListener("click", increment);
  element.querySelector(".decrement").addEventListener("click", decrement);

  // Reactive updates
  signal.on("globalCount", (newCount) => {
    element.querySelector(".count").textContent = newCount;
  });

  return element;
}
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

| Feature            | Legacy Syntax                                    | Ultra-Modern Syntax                        |
| ------------------ | ------------------------------------------------ | ------------------------------------------ |
| **File Structure** | Frontmatter + target config                      | Filename-based framework detection         |
| **Variables**      | `const count = useSignal('count', 0)`            | `$count! = signal('count', 0)`             |
| **Functions**      | `const increment = useCallback(() => {...}, [])` | `$increment = () => {...}`                 |
| **Templates**      | `return template(\`{count.value}\`)`             | `<template><div>{$count}</div></template>` |
| **Events**         | `onClick={increment}`                            | `click={$increment}`                       |
| **State System**   | Separate useSignal + usePubSub                   | Unified signal system                      |
| **Types**          | Manual TypeScript annotations                    | Automatic inference + optional explicit    |
| **Pure JS**        | Not supported                                    | Automatic fallback for .mtm files          |

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

## **🎉 The Result: Most Advanced Meta-Framework**

We've created the most modern, clean, and intuitive meta-framework syntax available:

- ✅ **Zero configuration** - Framework detection by filename
- ✅ **Unified system** - Single signal system for everything
- ✅ **Modern syntax** - Clean, readable, and intuitive
- ✅ **Pure JS support** - Works without any framework
- ✅ **Type safety** - Automatic inference with optional explicit types
- ✅ **Template-first** - Clean separation of logic and presentation
- ✅ **Cross-framework** - Write once, run anywhere

This transformation represents a quantum leap in meta-framework design, making MTM the most advanced and developer-friendly solution available! 🚀

## **🔗 Try It Now**

Open `ultra-modern-demo.html` to see the new syntax in action, or check out the example components:

- `counter.react.mtm` - React component with ultra-modern syntax
- `message-board.vue.mtm` - Vue component with signal system
- `user-list.svelte.mtm` - Svelte component with reactive variables
- `theme-toggle.mtm` - Pure JavaScript component
- `comprehensive-demo.react.mtm` - Full feature showcase

The future of meta-framework development is here! 🚀
