import { describe, it, expect } from 'vitest';
import { VueAdapter } from './vue-adapter.js';
import type { MTMFile } from '@metamon/core';

describe('Vue Adapter Demo', () => {
  const adapter = new VueAdapter();

  it('should demonstrate Vue component compilation with signals and events', () => {
    const mtmFile: MTMFile = {
      frontmatter: {
        target: 'vue',
        channels: [
          { event: 'userLogin', emit: 'onUserLogin' },
          { event: 'dataUpdate', emit: 'onDataUpdate' }
        ],
        route: '/dashboard',
        layout: 'main'
      },
      content: `import { defineComponent, ref, computed } from 'vue';

export default defineComponent({
  name: 'DashboardComponent',
  setup() {
    // Local reactive state
    const user = ref(null);
    const loading = ref(false);
    
    // Shared state using Metamon signals
    const [globalCounter, setGlobalCounter] = useMetamonSignal('appCounter', 0);
    const [userPreferences, setUserPreferences] = useSignal({ theme: 'light' });
    
    // Computed values
    const isLoggedIn = computed(() => user.value !== null);
    const displayCounter = computed(() => \`Count: \${globalCounter.value}\`);
    
    // Event handlers
    const handleLogin = (userData) => {
      user.value = userData;
      onUserLogin(userData); // Emit to other frameworks
    };
    
    const handleDataRefresh = () => {
      loading.value = true;
      // Simulate data fetch
      setTimeout(() => {
        loading.value = false;
        onDataUpdate({ timestamp: Date.now() });
      }, 1000);
    };
    
    const incrementCounter = () => {
      setGlobalCounter(globalCounter.value + 1);
    };
    
    const toggleTheme = () => {
      const newTheme = userPreferences.value.theme === 'light' ? 'dark' : 'light';
      setUserPreferences({ ...userPreferences.value, theme: newTheme });
    };
    
    return {
      user,
      loading,
      globalCounter,
      userPreferences,
      isLoggedIn,
      displayCounter,
      handleLogin,
      handleDataRefresh,
      incrementCounter,
      toggleTheme
    };
  },
  template: \`
    <div class="dashboard" :class="userPreferences.theme">
      <header>
        <h1>Vue Dashboard</h1>
        <div v-if="isLoggedIn">
          Welcome, {{ user.name }}!
        </div>
        <div v-else>
          <button @click="handleLogin({ name: 'John Doe', id: 1 })">
            Login
          </button>
        </div>
      </header>
      
      <main>
        <section class="counter-section">
          <h2>{{ displayCounter }}</h2>
          <button @click="incrementCounter">Increment Global Counter</button>
        </section>
        
        <section class="data-section">
          <button @click="handleDataRefresh" :disabled="loading">
            {{ loading ? 'Refreshing...' : 'Refresh Data' }}
          </button>
        </section>
        
        <section class="preferences">
          <button @click="toggleTheme">
            Switch to {{ userPreferences.theme === 'light' ? 'Dark' : 'Light' }} Theme
          </button>
        </section>
      </main>
    </div>
  \`
});`,
      filePath: 'dashboard.mtm'
    };

    const result = adapter.compile(mtmFile);

    // Verify the compilation includes all necessary imports
    expect(result.code).toContain('import { defineComponent } from \'vue\';');
    expect(result.code).toContain('import { ref, onMounted, onUnmounted, computed } from \'vue\';');
    expect(result.code).toContain('import { signalManager, pubSubSystem } from \'@metamon/core\';');

    // Verify signal integration is included
    expect(result.code).toContain('export function useSignal(initialValue, key)');
    expect(result.code).toContain('export function useMetamonSignal(key, initialValue)');

    // Verify pub/sub integration for channels
    expect(result.code).toContain('const onUserLogin = (payload) => {');
    expect(result.code).toContain('pubSubSystem.emit(\'userLogin\', payload);');
    expect(result.code).toContain('const onDataUpdate = (payload) => {');
    expect(result.code).toContain('pubSubSystem.emit(\'dataUpdate\', payload);');

    // Verify event subscriptions are set up
    expect(result.code).toContain('pubSubSystem.subscribe(\'userLogin\'');
    expect(result.code).toContain('pubSubSystem.subscribe(\'dataUpdate\'');

    // Verify the original component code is preserved
    expect(result.code).toContain('name: \'DashboardComponent\'');
    expect(result.code).toContain('const user = ref(null);');
    expect(result.code).toContain('const loading = ref(false);');
    expect(result.code).toContain('useMetamonSignal(\'appCounter\', 0)');
    expect(result.code).toContain('template: `');
    expect(result.code).toContain('<div class="dashboard"');

    // Verify compilation metadata
    expect(result.exports).toEqual(['default']);
    expect(result.dependencies).toContain('vue');

    console.log('Vue Adapter Demo - Compiled Code Preview:');
    console.log('=====================================');
    console.log(result.code.substring(0, 500) + '...');
  });

  it('should demonstrate Vue SFC (Single File Component) compilation', () => {
    const mtmFile: MTMFile = {
      frontmatter: {
        target: 'vue',
        channels: [
          { event: 'themeChange', emit: 'onThemeChange' }
        ]
      },
      content: `<template>
  <div class="theme-switcher" :class="currentTheme">
    <h3>Theme Switcher Component</h3>
    <div class="theme-options">
      <button 
        v-for="theme in themes" 
        :key="theme.name"
        @click="selectTheme(theme)"
        :class="{ active: currentTheme === theme.name }"
      >
        {{ theme.label }}
      </button>
    </div>
    <p>Current theme: {{ currentTheme }}</p>
  </div>
</template>

<script>
import { defineComponent, ref, watch } from 'vue';

export default defineComponent({
  name: 'ThemeSwitcher',
  setup() {
    const themes = ref([
      { name: 'light', label: 'Light Theme' },
      { name: 'dark', label: 'Dark Theme' },
      { name: 'auto', label: 'Auto Theme' }
    ]);
    
    const [currentTheme, setCurrentTheme] = useMetamonSignal('appTheme', 'light');
    
    const selectTheme = (theme) => {
      setCurrentTheme(theme.name);
      onThemeChange({ theme: theme.name, timestamp: Date.now() });
    };
    
    // Watch for external theme changes
    watch(currentTheme, (newTheme) => {
      document.body.className = \`theme-\${newTheme}\`;
    });
    
    return {
      themes,
      currentTheme,
      selectTheme
    };
  }
});
</script>

<style scoped>
.theme-switcher {
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
}

.theme-switcher.light {
  background: #ffffff;
  color: #333333;
}

.theme-switcher.dark {
  background: #333333;
  color: #ffffff;
}

.theme-options {
  display: flex;
  gap: 10px;
  margin: 15px 0;
}

button {
  padding: 8px 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
}

button.active {
  background: #007bff;
  color: white;
}
</style>`,
      filePath: 'theme-switcher.mtm'
    };

    const result = adapter.compile(mtmFile);

    // Verify SFC structure is preserved
    expect(result.code).toContain('<template>');
    expect(result.code).toContain('<script>');
    expect(result.code).toContain('<style scoped>');

    // Verify Vue directives and syntax are preserved
    expect(result.code).toContain('v-for="theme in themes"');
    expect(result.code).toContain(':key="theme.name"');
    expect(result.code).toContain('@click="selectTheme(theme)"');
    expect(result.code).toContain(':class="{ active: currentTheme === theme.name }"');

    // Verify Metamon integration
    expect(result.code).toContain('useMetamonSignal(\'appTheme\', \'light\')');
    expect(result.code).toContain('onThemeChange({ theme: theme.name');

    console.log('Vue SFC Demo - Component Structure Preserved:');
    console.log('===========================================');
    console.log('✓ Template section with Vue directives');
    console.log('✓ Script section with Composition API');
    console.log('✓ Style section with scoped styles');
    console.log('✓ Metamon signal integration');
    console.log('✓ Pub/sub event emission');
  });
});