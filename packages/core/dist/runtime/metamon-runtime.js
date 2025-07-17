/**
 * Metamon Runtime - Core runtime for .mtm components
 * Provides universal APIs that work across all frameworks
 */
/**
 * Universal Signal Implementation
 */
class MetamonSignal {
    constructor(initialValue, key) {
        this.listeners = new Set();
        this._value = initialValue;
        this.key = key;
        // Register global signal if key provided
        if (key) {
            MetamonRuntime.registerSignal(key, this);
        }
    }
    get value() {
        return this._value;
    }
    update(newValue) {
        const nextValue = typeof newValue === 'function'
            ? newValue(this._value)
            : newValue;
        if (nextValue !== this._value) {
            this._value = nextValue;
            this.listeners.forEach(callback => callback(nextValue));
        }
    }
    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }
}
/**
 * Universal PubSub Implementation
 */
class MetamonPubSub {
    constructor() {
        this.events = new Map();
    }
    emit(event, data) {
        const listeners = this.events.get(event);
        if (listeners) {
            listeners.forEach(callback => callback(data));
        }
    }
    subscribe(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event).add(callback);
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
    static compile(templateString, framework) {
        return {
            render: () => this.compileForFramework(templateString, framework),
            framework
        };
    }
    static compileForFramework(template, framework) {
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
    static compileToReact(template) {
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
    static compileToVue(template) {
        // Convert {{variable}} to {{ variable }}
        let vueTemplate = template.replace(/\{\{([^}]+)\}\}/g, '{{ $1 }}');
        // Convert onclick to @click
        vueTemplate = vueTemplate.replace(/onclick="([^"]+)"/g, '@click="$1"');
        vueTemplate = vueTemplate.replace(/oninput="([^"]+)"/g, '@input="$1"');
        vueTemplate = vueTemplate.replace(/onkeyup="([^"]+)"/g, '@keyup="$1"');
        return vueTemplate;
    }
    static compileToSolid(template) {
        // Convert {{variable}} to {variable()}
        let solidTemplate = template.replace(/\{\{([^}]+)\}\}/g, '{$1}');
        // Convert onclick to onClick
        solidTemplate = solidTemplate.replace(/onclick=/g, 'onClick=');
        solidTemplate = solidTemplate.replace(/oninput=/g, 'onInput=');
        solidTemplate = solidTemplate.replace(/onkeyup=/g, 'onKeyUp=');
        // Convert class to class (Solid uses class, not className)
        return solidTemplate;
    }
    static compileToSvelte(template) {
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
    static getInstance() {
        if (!this.instance) {
            this.instance = new MetamonRuntime();
        }
        return this.instance;
    }
    static registerSignal(key, signal) {
        this.globalSignals.set(key, signal);
    }
    static getSignal(key) {
        return this.globalSignals.get(key);
    }
    static createSignal(key, initialValue) {
        if (key) {
            const existing = this.getSignal(key);
            if (existing) {
                return existing;
            }
        }
        return new MetamonSignal(initialValue, key || undefined);
    }
    static getPubSub() {
        return this.globalPubSub;
    }
    static compileTemplate(template, framework) {
        return TemplateCompiler.compile(template, framework);
    }
}
MetamonRuntime.globalSignals = new Map();
MetamonRuntime.globalPubSub = new MetamonPubSub();
/**
 * Universal APIs for .mtm components
 */
export function useSignal(key, initialValue) {
    return MetamonRuntime.createSignal(key, initialValue);
}
export function usePubSub() {
    return MetamonRuntime.getPubSub();
}
export function template(templateString) {
    return (framework) => MetamonRuntime.compileTemplate(templateString, framework);
}
