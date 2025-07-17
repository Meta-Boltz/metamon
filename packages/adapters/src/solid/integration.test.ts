import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SolidAdapter } from './solid-adapter.js';
import type { MTMFile, Channel } from '@metamon/core';

// Mock the core module
vi.mock('@metamon/core', () => ({
  signalManager: {
    createSignal: vi.fn(),
    getSignal: vi.fn(),
  },
  pubSubSystem: {
    subscribe: vi.fn(),
    emit: vi.fn(),
    cleanup: vi.fn(),
  }
}));

describe('Solid Integration Tests', () => {
  let adapter: SolidAdapter;

  beforeEach(() => {
    adapter = new SolidAdapter();
  });

  describe('End-to-end component compilation', () => {
    it('should compile a complete Solid component with signals and pub/sub', () => {
      const channels: Channel[] = [
        { event: 'userLogin', emit: 'handleUserLogin' },
        { event: 'dataUpdate', emit: 'handleDataUpdate' }
      ];

      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'solid',
          channels
        },
        content: `import { createSignal, createEffect } from 'solid-js';
import { For } from 'solid-js';

export default function UserDashboard() {
  const [users, setUsers] = createSignal([]);
  const [loading, setLoading] = createSignal(false);

  createEffect(() => {
    console.log('Users updated:', users());
  });

  return (
    <div class="dashboard">
      <h1>User Dashboard</h1>
      {loading() ? (
        <div>Loading...</div>
      ) : (
        <For each={users()}>
          {(user) => <div class="user-card">{user.name}</div>}
        </For>
      )}
    </div>
  );
}`,
        filePath: '/pages/dashboard.mtm'
      };

      const result = adapter.compile(mtmFile);

      // Check that all necessary imports are included
      expect(result.code).toContain('import { createSignal, createEffect, onCleanup } from \'solid-js\';');
      expect(result.code).toContain('import { signalManager, pubSubSystem } from \'@metamon/core\';');

      // Check that signal integration functions are included
      expect(result.code).toContain('export function useSignal');
      expect(result.code).toContain('export function useMetamonSignal');
      expect(result.code).toContain('export function createMetamonSignal');

      // Check that pub/sub integration is included
      expect(result.code).toContain('handleUserLogin');
      expect(result.code).toContain('handleDataUpdate');
      expect(result.code).toContain('userLogin');
      expect(result.code).toContain('dataUpdate');

      // Check that the original component code is preserved
      expect(result.code).toContain('UserDashboard');
      expect(result.code).toContain('User Dashboard');
      expect(result.code).toContain('For each={users()}');

      // Check compilation result metadata
      expect(result.exports).toEqual(['default']);
      expect(result.dependencies).toContain('solid-js');
    });

    it('should handle complex component with multiple imports', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'solid'
        },
        content: `import { createSignal, createMemo, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { debounce } from 'lodash';
import { validateEmail } from '../utils/validation';

export default function ContactForm() {
  const [form, setForm] = createStore({
    name: '',
    email: '',
    message: ''
  });

  const isValid = createMemo(() => 
    form.name.length > 0 && 
    validateEmail(form.email) && 
    form.message.length > 10
  );

  const debouncedValidation = debounce(() => {
    console.log('Validating form...');
  }, 300);

  return (
    <form>
      <input 
        value={form.name}
        onInput={(e) => setForm('name', e.target.value)}
        placeholder="Name"
      />
      <input 
        value={form.email}
        onInput={(e) => setForm('email', e.target.value)}
        placeholder="Email"
      />
      <textarea 
        value={form.message}
        onInput={(e) => setForm('message', e.target.value)}
        placeholder="Message"
      />
      <Show when={isValid()}>
        <button type="submit">Send Message</button>
      </Show>
    </form>
  );
}`,
        filePath: '/components/ContactForm.mtm'
      };

      const result = adapter.compile(mtmFile);

      // Check that all user imports are preserved
      expect(result.code).toContain('createStore');
      expect(result.code).toContain('debounce');
      expect(result.code).toContain('validateEmail');

      // Check that Solid-specific imports are added
      expect(result.code).toContain('import { createSignal, createEffect, onCleanup } from \'solid-js\';');

      // Check that the component logic is preserved
      expect(result.code).toContain('ContactForm');
      expect(result.code).toContain('createMemo');
      expect(result.code).toContain('isValid()');

      // Check dependencies
      expect(result.dependencies).toContain('solid-js');
      expect(result.dependencies).toContain('solid-js/store');
      expect(result.dependencies).toContain('lodash');
      expect(result.dependencies).toContain('../utils/validation');
    });
  });

  describe('Signal integration scenarios', () => {
    it('should generate code for cross-framework signal sharing', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'solid'
        },
        content: `import { createSignal } from 'solid-js';

export default function SharedCounter() {
  // This will use Metamon signals for cross-framework sharing
  const [count, setCount] = useMetamonSignal('globalCounter', 0);

  return (
    <div>
      <p>Count: {count()}</p>
      <button onClick={() => setCount(count() + 1)}>
        Increment
      </button>
    </div>
  );
}`,
        filePath: '/components/SharedCounter.mtm'
      };

      const result = adapter.compile(mtmFile);

      expect(result.code).toContain('useMetamonSignal');
      expect(result.code).toContain('signalManager');
      expect(result.code).toContain('globalCounter');
    });

    it('should generate optimal native Solid signal integration', () => {
      const signalCode = adapter.setupSignalIntegration();

      expect(signalCode).toContain('createMetamonSignal');
      expect(signalCode).toContain('native Solid signal');
      expect(signalCode).toContain('optimal performance');
      expect(signalCode).toContain('createSignal(metamonSignal.value)');
    });
  });

  describe('Pub/Sub integration scenarios', () => {
    it('should handle multiple event channels correctly', () => {
      const channels: Channel[] = [
        { event: 'user:login', emit: 'onUserLogin' },
        { event: 'user:logout', emit: 'onUserLogout' },
        { event: 'data:refresh', emit: 'onDataRefresh' },
        { event: 'notification:show', emit: 'showNotification' }
      ];

      const pubSubCode = adapter.setupPubSubIntegration(channels);

      // Check all event handlers are generated
      expect(pubSubCode).toContain('onUserLogin');
      expect(pubSubCode).toContain('onUserLogout');
      expect(pubSubCode).toContain('onDataRefresh');
      expect(pubSubCode).toContain('showNotification');

      // Check all events are subscribed to
      expect(pubSubCode).toContain('user:login');
      expect(pubSubCode).toContain('user:logout');
      expect(pubSubCode).toContain('data:refresh');
      expect(pubSubCode).toContain('notification:show');

      // Check Solid-specific lifecycle integration
      expect(pubSubCode).toContain('createEffect');
      expect(pubSubCode).toContain('onCleanup');
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle empty component gracefully', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'solid'
        },
        content: '',
        filePath: '/empty.mtm'
      };

      const result = adapter.compile(mtmFile);

      expect(result.code).toContain('signalManager');
      expect(result.code).toContain('createSignal');
      expect(result.exports).toEqual(['default']);
    });

    it('should handle component with only imports', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'solid'
        },
        content: `import { createSignal } from 'solid-js';
import { debounce } from 'lodash';`,
        filePath: '/imports-only.mtm'
      };

      const result = adapter.compile(mtmFile);

      expect(result.dependencies).toContain('solid-js');
      expect(result.dependencies).toContain('lodash');
      expect(result.code).toContain('signalManager');
    });

    it('should preserve JSX syntax and Solid-specific features', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'solid'
        },
        content: `import { createSignal, Show, For, Switch, Match } from 'solid-js';

export default function SolidFeatures() {
  const [items, setItems] = createSignal(['a', 'b', 'c']);
  const [mode, setMode] = createSignal('list');

  return (
    <div>
      <Switch>
        <Match when={mode() === 'list'}>
          <For each={items()}>
            {(item, index) => <div>{index()}: {item}</div>}
          </For>
        </Match>
        <Match when={mode() === 'empty'}>
          <div>No items</div>
        </Match>
      </Switch>
      <Show when={items().length > 0}>
        <button onClick={() => setItems([])}>Clear</button>
      </Show>
    </div>
  );
}`,
        filePath: '/solid-features.mtm'
      };

      const result = adapter.compile(mtmFile);

      // Check that Solid-specific JSX features are preserved
      expect(result.code).toContain('Switch');
      expect(result.code).toContain('Match');
      expect(result.code).toContain('For each={items()}');
      expect(result.code).toContain('Show when={items().length > 0}');
      expect(result.code).toContain('index()');
    });
  });
});