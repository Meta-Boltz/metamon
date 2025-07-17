/**
 * Metamon Runtime - Core runtime for .mtm components
 * Provides universal APIs that work across all frameworks
 */

export interface Signal<T> {
  value: T;
  update(newValue: T | ((prev: T) => T)): void;
  subscribe(callback: (value: T) => void): () => void;
}

export interface PubSubAPI {
  emit(event: string, data: any): void;
  subscribe(event: string, callback: (data: any) => void): () => void;
}

export interface ComponentTemplate {
  render(): any;
  framework: string;
}

/**
 * Universal Signal Implementation
 */
class MetamonSignal<T> implements Signal<T> {
  private _value: T;
  private listeners = new Set<(value: T) => void>();
  private key?: string;

  constructor(initialValue: T, key?: string) {
    this._value = initialValue;
    this.key = key;
    
    // Register global signal if key provided
    if (key) {
      MetamonRuntime.registerSignal(key, this);
    }
  }

  get value(): T {
    return this._value;
  }

  update(newValue: T | ((prev: T) => T)): void {
    const nextValue = typeof newValue === 'function' 
      ? (newValue as (prev: T) => T)(this._value)
      : newValue;
    
    if (nextValue !== this._value) {
      this._value = nextValue;
      this.listeners.forEach(callback => callback(nextValue));
    }
  }

  subscribe(callback: (value: T) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
}

/**
 * Universal PubSub Implementation
 */
class MetamonPubSub implements PubSubAPI {
  private events = new Map<string, Set<(data: any) => void>>();

  emit(event: string, data: any): void {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    
    this.events.get(event)!.add(callback);
    
    return () => {
      const listeners = this.events.get(event);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }
}

/**
 * Template Compiler - Converts universal templates to framework-specific code
 */
class TemplateCompiler {
  static compile(templateString: string, framework: string): ComponentTemplate {
    return {
      render: () => this.compileForFramework(templateString, framework),
      framework
    };
  }

  private static compileForFramework(template: string, framework: string): any {
    switch (framework) {
      case 'react':
        return this.compileToReact(template);
      case 'vue':
        return this.compileToVue(template);
      case 'solid':
        return this.compileToSolid(template);
      case 'svelte':
        return this.compileToSvelte(template);
      default:
        throw new Error(`Unsupported framework: ${framework}`);
    }
  }

  private static compileToReact(template: string): string {
    // Convert {{variable}} to {variable}
    let reactTemplate = template.replace(/\{\{([^}]+)\}\}/g, '{$1}');
    
    // Convert onclick to onClick
    reactTemplate = reactTemplate.replace(/onclick=/g, 'onClick=');
    reactTemplate = reactTemplate.replace(/oninput=/g, 'onInput=');
    reactTemplate = reactTemplate.replace(/onkeyup=/g, 'onKeyUp=');
    
    // Convert class to className
    reactTemplate = reactTemplate.replace(/class=/g, 'className=');
    
    return reactTemplate;
  }

  private static compileToVue(template: string): string {
    // Convert {{variable}} to {{ variable }}
    let vueTemplate = template.replace(/\{\{([^}]+)\}\}/g, '{{ $1 }}');
    
    // Convert onclick to @click
    vueTemplate = vueTemplate.replace(/onclick="([^"]+)"/g, '@click="$1"');
    vueTemplate = vueTemplate.replace(/oninput="([^"]+)"/g, '@input="$1"');
    vueTemplate = vueTemplate.replace(/onkeyup="([^"]+)"/g, '@keyup="$1"');
    
    return vueTemplate;
  }

  private static compileToSolid(template: string): string {
    // Convert {{variable}} to {variable()}
    let solidTemplate = template.replace(/\{\{([^}]+)\}\}/g, '{$1}');
    
    // Convert onclick to onClick
    solidTemplate = solidTemplate.replace(/onclick=/g, 'onClick=');
    solidTemplate = solidTemplate.replace(/oninput=/g, 'onInput=');
    solidTemplate = solidTemplate.replace(/onkeyup=/g, 'onKeyUp=');
    
    // Convert class to class (Solid uses class, not className)
    return solidTemplate;
  }

  private static compileToSvelte(template: string): string {
    // Convert {{variable}} to {variable}
    let svelteTemplate = template.replace(/\{\{([^}]+)\}\}/g, '{$1}');
    
    // Convert onclick to on:click
    svelteTemplate = svelteTemplate.replace(/onclick="([^"]+)"/g, 'on:click={$1}');
    svelteTemplate = svelteTemplate.replace(/oninput="([^"]+)"/g, 'on:input={$1}');
    svelteTemplate = svelteTemplate.replace(/onkeyup="([^"]+)"/g, 'on:keyup={$1}');
    
    return svelteTemplate;
  }
}

/**
 * Main Metamon Runtime
 */
export class MetamonRuntime {
  private static instance: MetamonRuntime;
  private static globalSignals = new Map<string, Signal<any>>();
  private static globalPubSub = new MetamonPubSub();

  static getInstance(): MetamonRuntime {
    if (!this.instance) {
      this.instance = new MetamonRuntime();
    }
    return this.instance;
  }

  static registerSignal(key: string, signal: Signal<any>): void {
    this.globalSignals.set(key, signal);
  }

  static getSignal<T>(key: string): Signal<T> | undefined {
    return this.globalSignals.get(key) as Signal<T>;
  }

  static createSignal<T>(key: string | null, initialValue: T): Signal<T> {
    if (key) {
      const existing = this.getSignal<T>(key);
      if (existing) {
        return existing;
      }
    }
    
    return new MetamonSignal(initialValue, key || undefined);
  }

  static getPubSub(): PubSubAPI {
    return this.globalPubSub;
  }

  static compileTemplate(template: string, framework: string): ComponentTemplate {
    return TemplateCompiler.compile(template, framework);
  }
}

/**
 * Universal APIs for .mtm components
 */
export function useSignal<T>(key: string | null, initialValue: T): Signal<T> {
  return MetamonRuntime.createSignal(key, initialValue);
}

export function usePubSub(): PubSubAPI {
  return MetamonRuntime.getPubSub();
}

export function template(templateString: string): (framework: string) => ComponentTemplate {
  return (framework: string) => MetamonRuntime.compileTemplate(templateString, framework);
}