/**
 * Mixed legacy/modern syntax integration tests
 * Tests projects that contain both legacy and modern MTM syntax files
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedMTMParser } from '../parser/enhanced-mtm-parser.js';
import { ReactTransformer } from '../transformers/react-transformer.js';
import { VueTransformer } from '../transformers/vue-transformer.js';
import { SvelteTransformer } from '../transformers/svelte-transformer.js';
import { ReactiveVariableAnalyzer } from '../reactive/reactive-analyzer.js';
import { SyntaxMigrationAnalyzer } from '../migration/syntax-migration-analyzer.js';
import type { ProgramNode } from '../types/unified-ast.js';

describe('Mixed Legacy/Modern Syntax Integration', () => {
  let parser: EnhancedMTMParser;
  let reactTransformer: ReactTransformer;
  let vueTransformer: VueTransformer;
  let svelteTransformer: SvelteTransformer;
  let reactiveAnalyzer: ReactiveVariableAnalyzer;
  let migrationAnalyzer: SyntaxMigrationAnalyzer;

  beforeEach(() => {
    parser = new EnhancedMTMParser();
    reactTransformer = new ReactTransformer();
    vueTransformer = new VueTransformer();
    svelteTransformer = new SvelteTransformer();
    reactiveAnalyzer = new ReactiveVariableAnalyzer();
    migrationAnalyzer = new SyntaxMigrationAnalyzer();
  });

  describe('Legacy and Modern Syntax Coexistence', () => {
    it('should handle projects with both legacy and modern components', () => {
      // Legacy component
      const legacyComponent = `---
target: reactjs
---

// Legacy MTM syntax
const counter = signal(0);
const message = signal("Hello from legacy");

const increment = () => {
  counter.set(counter.get() + 1);
};

const updateMessage = (msg) => {
  message.set(msg);
};

return template(\`
  <div>
    <h1>\${message}</h1>
    <p>Count: \${counter}</p>
    <button onclick="\${increment}">Legacy Increment</button>
    <input oninput="updateMessage(event.target.value)" value="\${message}" />
  </div>
\`)`;

      // Modern component
      const modernComponent = `---
target: reactjs
---

// Modern MTM syntax
$counter! = 0
$message! = "Hello from modern"

$increment = () => {
  $counter++
}

$updateMessage = (msg: string) => {
  $message = msg
}

return template(\`
  <div>
    <h1>{{$message}}</h1>
    <p>Count: {{$counter}}</p>
    <button click="$increment()">Modern Increment</button>
    <input oninput="$updateMessage(event.target.value)" value="{{$message}}" />
  </div>
\`)`;

      // Parse both components
      const legacyAST = parser.parse(legacyComponent, 'legacy-component.mtm');
      const modernAST = parser.parse(modernComponent, 'modern-component.mtm');

      expect(legacyAST.syntaxVersion).toBe('legacy');
      expect(modernAST.syntaxVersion).toBe('modern');

      // Both should be transformable
      const legacyTransformed = reactTransformer.transform(legacyAST);
      const modernTransformed = reactTransformer.transform(modernAST);

      expect(legacyTransformed).toBeDefined();
      expect(modernTransformed).toBeDefined();

      // Modern should have enhanced features
      expect(modernAST.modernFeatures?.dollarPrefixVariables).toBe(true);
      expect(modernAST.modernFeatures?.reactiveVariables).toBe(true);
      expect(legacyAST.modernFeatures).toBeUndefined();
    });

    it('should provide migration analysis for mixed projects', () => {
      const mixedSyntaxFile = `---
target: vue
---

// Mix of legacy and modern syntax in same file
const oldSignal = signal(0);
$newReactive! = 0

const oldFunction = () => {
  oldSignal.set(oldSignal.get() + 1);
};

$newFunction = () => {
  $newReactive++
}

// Legacy template syntax
const legacyTemplate = template(\`
  <div>
    <p>Old: \${oldSignal}</p>
    <button onclick="\${oldFunction}">Old Button</button>
  </div>
\`);

// Modern template syntax
return template(\`
  <div>
    <p>New: {{$newReactive}}</p>
    <button click="$newFunction()">New Button</button>
  </div>
\`)`;

      const ast = parser.parse(mixedSyntaxFile, 'mixed-syntax.mtm');
      expect(ast.syntaxVersion).toBe('mixed');

      // Analyze migration opportunities
      const analysis = migrationAnalyzer.analyzeMigrationOpportunities(mixedSyntaxFile, 'mixed-syntax.mtm');

      expect(analysis.hasLegacySyntax).toBe(true);
      expect(analysis.hasModernSyntax).toBe(true);
      expect(analysis.migrationOpportunities.length).toBeGreaterThan(0);

      // Should suggest converting legacy signals to modern reactive variables
      const signalMigration = analysis.migrationOpportunities.find(op => 
        op.type === 'signal-to-reactive'
      );
      expect(signalMigration).toBeDefined();
      expect(signalMigration?.description).toContain('signal');
    });

    it('should handle gradual migration within a single file', () => {
      const gradualMigrationSyntax = `---
target: svelte
---

// Phase 1: Legacy signals (to be migrated)
const userCount = signal(0);
const isLoading = signal(false);

// Phase 2: Modern reactive variables (already migrated)
$currentUser! = null
$userPreferences! = { theme: "light", lang: "en" }

// Phase 3: Mixed functions (some migrated, some not)
const fetchUserCount = async () => {
  isLoading.set(true);
  try {
    const response = await fetch('/api/users/count');
    const count = await response.json();
    userCount.set(count);
  } finally {
    isLoading.set(false);
  }
};

$updatePreferences = async (prefs: any) => {
  $userPreferences = { ...$userPreferences, ...prefs }
  await fetch('/api/user/preferences', {
    method: 'POST',
    body: JSON.stringify($userPreferences)
  })
}

// Phase 4: Template mixing both syntaxes
return template(\`
  <div>
    <!-- Legacy template bindings -->
    <div class="legacy-section">
      <p>User Count: \${userCount}</p>
      {{#if \${isLoading}}}
        <p>Loading...</p>
      {{/if}}
      <button onclick="\${fetchUserCount}">Refresh Count</button>
    </div>
    
    <!-- Modern template bindings -->
    <div class="modern-section">
      {{#if $currentUser}}
        <h2>Welcome, {{$currentUser.name}}!</h2>
        <div class="preferences">
          <label>
            Theme:
            <select onchange="$updatePreferences({theme: event.target.value})">
              <option value="light" selected="{{$userPreferences.theme === 'light'}}">Light</option>
              <option value="dark" selected="{{$userPreferences.theme === 'dark'}}">Dark</option>
            </select>
          </label>
        </div>
      {{else}}
        <p>Please log in</p>
      {{/if}}
    </div>
  </div>
\`)`;

      const ast = parser.parse(gradualMigrationSyntax, 'gradual-migration.mtm');
      expect(ast.syntaxVersion).toBe('mixed');

      // Should identify both legacy and modern elements
      const legacyElements = ast.body.filter(node => 
        node.type === 'VariableDeclaration' && 
        (node as any).initializer?.type === 'CallExpression' &&
        (node as any).initializer?.callee?.name === 'signal'
      );
      
      const modernElements = ast.body.filter(node => 
        node.type === 'VariableDeclaration' && 
        (node as any).hasDollarPrefix
      );

      expect(legacyElements.length).toBeGreaterThan(0);
      expect(modernElements.length).toBeGreaterThan(0);

      // Migration analysis should provide step-by-step guidance
      const analysis = migrationAnalyzer.analyzeMigrationOpportunities(gradualMigrationSyntax, 'gradual-migration.mtm');
      expect(analysis.migrationComplexity).toBe('medium');
      expect(analysis.estimatedEffort).toContain('hour');
    });
  });

  describe('Cross-Syntax State Sharing', () => {
    it('should enable state sharing between legacy and modern components', () => {
      // Legacy component that manages shared state
      const legacyStateManager = `---
target: reactjs
---

// Legacy state management
const sharedStore = signal({
  user: null,
  theme: 'light',
  notifications: []
});

const updateUser = (user) => {
  const current = sharedStore.get();
  sharedStore.set({ ...current, user });
  emit('user-updated', user);
};

const updateTheme = (theme) => {
  const current = sharedStore.get();
  sharedStore.set({ ...current, theme });
  emit('theme-updated', theme);
};

// Listen for updates from modern components
on('modern-user-update', (user) => {
  updateUser(user);
});

on('modern-theme-update', (theme) => {
  updateTheme(theme);
});

return template(\`
  <div class="legacy-state-manager">
    <h3>Legacy State Manager</h3>
    <p>Current User: \${sharedStore.user?.name || 'None'}</p>
    <p>Theme: \${sharedStore.theme}</p>
    <button onclick="updateTheme('\${sharedStore.theme === 'light' ? 'dark' : 'light'}')">
      Toggle Theme
    </button>
  </div>
\`)`;

      // Modern component that consumes shared state
      const modernStateConsumer = `---
target: reactjs
---

// Modern reactive state that syncs with legacy
$localUser! = null
$localTheme! = "light"

// Sync with legacy state manager
on('user-updated', (user) => {
  $localUser = user
})

on('theme-updated', (theme) => {
  $localTheme = theme
})

$updateUserFromModern = (userData: any) => {
  $localUser = userData
  emit('modern-user-update', userData)
}

$updateThemeFromModern = (theme: string) => {
  $localTheme = theme
  emit('modern-theme-update', theme)
}

return template(\`
  <div class="modern-state-consumer">
    <h3>Modern State Consumer</h3>
    {{#if $localUser}}
      <p>Hello, {{$localUser.name}}!</p>
      <button click="$updateUserFromModern(null)">Logout</button>
    {{else}}
      <button click="$updateUserFromModern({name: 'John', id: 1})">Login as John</button>
    {{/if}}
    
    <div class="theme-controls">
      <p>Current Theme: {{$localTheme}}</p>
      <button click="$updateThemeFromModern($localTheme === 'light' ? 'dark' : 'light')">
        Switch to {{$localTheme === 'light' ? 'Dark' : 'Light'}} Theme
      </button>
    </div>
  </div>
\`)`;

      // Parse both components
      const legacyAST = parser.parse(legacyStateManager, 'legacy-state-manager.mtm');
      const modernAST = parser.parse(modernStateConsumer, 'modern-state-consumer.mtm');

      expect(legacyAST.syntaxVersion).toBe('legacy');
      expect(modernAST.syntaxVersion).toBe('modern');

      // Both should be able to communicate via events
      const legacyEvents = legacyAST.body.filter(node => 
        node.type === 'CallExpression' && 
        ['emit', 'on'].includes((node as any).callee?.name)
      );
      
      const modernEvents = modernAST.body.filter(node => 
        node.type === 'CallExpression' && 
        ['emit', 'on'].includes((node as any).callee?.name)
      );

      expect(legacyEvents.length).toBeGreaterThan(0);
      expect(modernEvents.length).toBeGreaterThan(0);

      // Modern component should have reactive variables
      const modernGraph = reactiveAnalyzer.analyzeReactiveVariables(modernAST);
      expect(modernGraph.variables.has('localUser')).toBe(true);
      expect(modernGraph.variables.has('localTheme')).toBe(true);
    });

    it('should handle type consistency between legacy and modern syntax', () => {
      const typeConsistencySyntax = `---
target: vue
---

// Legacy typed signals
const typedNumber = signal(42);
const typedString = signal("hello");
const typedArray = signal([1, 2, 3]);

// Modern typed reactive variables
$modernNumber!: number = 42
$modernString!: string = "hello"
$modernArray!: number[] = [1, 2, 3]

// Functions that work with both
const processNumber = (num) => {
  return num * 2;
};

$processModernNumber = (num: number): number => {
  return num * 2
}

// Cross-syntax operations
const combineValues = () => {
  const legacySum = typedArray.get().reduce((a, b) => a + b, 0);
  const modernSum = $modernArray.reduce((a, b) => a + b, 0);
  return legacySum + modernSum + typedNumber.get() + $modernNumber;
};

$modernCombineValues = (): number => {
  const legacySum = typedArray.get().reduce((a, b) => a + b, 0)
  const modernSum = $modernArray.reduce((a, b) => a + b, 0)
  return legacySum + modernSum + typedNumber.get() + $modernNumber
}`;

      const ast = parser.parse(typeConsistencySyntax, 'type-consistency.mtm');
      expect(ast.syntaxVersion).toBe('mixed');

      // Should handle type inference for both syntaxes
      const modernVars = ast.body.filter(node => 
        node.type === 'VariableDeclaration' && (node as any).hasDollarPrefix
      );

      modernVars.forEach(variable => {
        const varNode = variable as any;
        expect(varNode.inferredType).toBeDefined();
        
        if (varNode.name === 'modernNumber') {
          expect(varNode.inferredType.baseType).toBe('number');
        } else if (varNode.name === 'modernString') {
          expect(varNode.inferredType.baseType).toBe('string');
        } else if (varNode.name === 'modernArray') {
          expect(varNode.inferredType.baseType).toBe('array');
        }
      });
    });
  });

  describe('Migration Path Validation', () => {
    it('should validate incremental migration steps', () => {
      const migrationSteps = [
        // Step 1: Original legacy code
        `---
target: svelte
---

const count = signal(0);
const increment = () => count.set(count.get() + 1);
return template(\`<button onclick="\${increment}">Count: \${count}</button>\`);`,

        // Step 2: Migrate variable to modern syntax
        `---
target: svelte
---

$count! = 0
const increment = () => count.set(count.get() + 1); // Still legacy function
return template(\`<button onclick="\${increment}">Count: \${count}</button>\`);`,

        // Step 3: Migrate function to modern syntax
        `---
target: svelte
---

$count! = 0
$increment = () => $count++ // Modern function
return template(\`<button onclick="\${increment}">Count: \${count}</button>\`);`,

        // Step 4: Migrate template to modern syntax
        `---
target: svelte
---

$count! = 0
$increment = () => $count++
return template(\`<button click="$increment()">Count: {{$count}}</button>\`);`
      ];

      const asts = migrationSteps.map((syntax, index) => {
        try {
          return parser.parse(syntax, `migration-step-${index + 1}.mtm`);
        } catch (error) {
          return { error: error.message, step: index + 1 };
        }
      });

      // All steps should parse successfully
      asts.forEach((ast, index) => {
        if ('error' in ast) {
          throw new Error(`Migration step ${index + 1} failed: ${ast.error}`);
        }
        expect(ast).toBeDefined();
      });

      // Verify progression from legacy to modern
      expect(asts[0].syntaxVersion).toBe('legacy');
      expect(asts[1].syntaxVersion).toBe('mixed');
      expect(asts[2].syntaxVersion).toBe('mixed');
      expect(asts[3].syntaxVersion).toBe('modern');

      // Final step should have full modern features
      const finalAST = asts[3] as ProgramNode;
      expect(finalAST.modernFeatures?.dollarPrefixVariables).toBe(true);
      expect(finalAST.modernFeatures?.reactiveVariables).toBe(true);
    });

    it('should detect and warn about problematic migration patterns', () => {
      const problematicMigration = `---
target: reactjs
---

// Problematic: mixing signal and reactive variable with same name
const counter = signal(0);
$counter! = 0 // Name conflict!

// Problematic: legacy function accessing modern variable
const legacyIncrement = () => {
  $counter++ // Legacy function shouldn't access modern syntax
};

// Problematic: modern function accessing legacy signal
$modernIncrement = () => {
  counter.set(counter.get() + 1) // Modern function using legacy API
}`;

      expect(() => {
        parser.parse(problematicMigration, 'problematic-migration.mtm');
      }).toThrow(/conflict|mixed|syntax/i);
    });

    it('should provide migration recommendations based on complexity', () => {
      const complexLegacyCode = `---
target: vue
---

// Complex legacy code with multiple interdependencies
const userStore = signal({
  currentUser: null,
  preferences: {},
  history: []
});

const authStore = signal({
  isAuthenticated: false,
  token: null,
  permissions: []
});

const uiStore = signal({
  theme: 'light',
  sidebarOpen: false,
  notifications: []
});

// Complex interdependent functions
const login = async (credentials) => {
  const response = await fetch('/api/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  });
  
  if (response.ok) {
    const data = await response.json();
    authStore.set({
      isAuthenticated: true,
      token: data.token,
      permissions: data.permissions
    });
    
    userStore.set({
      currentUser: data.user,
      preferences: data.preferences,
      history: []
    });
    
    uiStore.set({
      ...uiStore.get(),
      theme: data.preferences.theme || 'light'
    });
  }
};

const logout = () => {
  authStore.set({
    isAuthenticated: false,
    token: null,
    permissions: []
  });
  
  userStore.set({
    currentUser: null,
    preferences: {},
    history: []
  });
};`;

      const analysis = migrationAnalyzer.analyzeMigrationOpportunities(complexLegacyCode, 'complex-legacy.mtm');
      
      expect(analysis.migrationComplexity).toBe('high');
      expect(analysis.estimatedEffort).toContain('day');
      expect(analysis.recommendations).toContain('incremental');
      expect(analysis.migrationOpportunities.length).toBeGreaterThan(5);
      
      // Should recommend starting with simple stores
      const storeRecommendations = analysis.migrationOpportunities.filter(op => 
        op.type === 'signal-to-reactive'
      );
      expect(storeRecommendations.length).toBeGreaterThan(0);
    });
  });
});