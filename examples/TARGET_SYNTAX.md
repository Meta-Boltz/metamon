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

### **Counter Component (Modern Syntax)**

```javascript
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

  <template>
    <div class="counter">
      <h3>Counter</h3>
      <div class="counter-display">
        <button click={$decrement}>-</button>
        <span class="count">{$count}</span>
        <button click={$increment}>+</button>
      </div>
      <small>Global count shared across frameworks</small>
      {#for i=0 to 9}
        <span>{i}</span>
      {/for}

      {#while $count>0}
        <span>{$count}</span>
      {/while}

      {#if $count>10}
        <span>count > 10</span>
      {/if}

      {#if $count>5}
        <span m-html={$count}></span>
        <span m-html={$count} />
      {/if}
    </div>
  </template>
}
```
