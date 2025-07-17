import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { signalManager, pubSubSystem } from '@metamon/core';
import {
  useSignal,
  useMetamonSignal,
  usePubSub,
  useEmit,
  useMetamonLifecycle,
  useComputedSignal,
  useSignalModel
} from './composables.js';

// Mock the core modules
vi.mock('@metamon/core', () => ({
  signalManager: {
    createSignal: vi.fn(),
    getSignal: vi.fn(),
    destroySignal: vi.fn()
  },
  pubSubSystem: {
    subscribe: vi.fn(),
    emit: vi.fn(),
    cleanup: vi.fn()
  }
}));

describe('Vue Composables', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useSignal', () => {
    it('should create and manage a signal', async () => {
      const mockSignal = {
        value: 'initial',
        subscribe: vi.fn().mockReturnValue(() => {}),
        update: vi.fn()
      };

      vi.mocked(signalManager.createSignal).mockReturnValue(mockSignal);

      const TestComponent = {
        setup() {
          const [value, updateSignal] = useSignal('initial');
          return { value, updateSignal };
        },
        template: '<div>{{ value }}</div>'
      };

      const wrapper = mount(TestComponent);
      await nextTick();

      expect(signalManager.createSignal).toHaveBeenCalledWith('initial');
      expect(mockSignal.subscribe).toHaveBeenCalled();
      expect(wrapper.text()).toBe('initial');
    });

    it('should use named signal when key provided', async () => {
      const mockSignal = {
        value: 'named',
        subscribe: vi.fn().mockReturnValue(() => {}),
        update: vi.fn()
      };

      vi.mocked(signalManager.getSignal).mockReturnValue(mockSignal);

      const TestComponent = {
        setup() {
          const [value, updateSignal] = useSignal('initial', 'testKey');
          return { value, updateSignal };
        },
        template: '<div>{{ value }}</div>'
      };

      const wrapper = mount(TestComponent);
      await nextTick();

      expect(signalManager.getSignal).toHaveBeenCalledWith('testKey');
      expect(wrapper.text()).toBe('named');
    });

    it('should create named signal if it does not exist', async () => {
      const mockSignal = {
        value: 'created',
        subscribe: vi.fn().mockReturnValue(() => {}),
        update: vi.fn()
      };

      vi.mocked(signalManager.getSignal).mockReturnValue(null);
      vi.mocked(signalManager.createSignal).mockReturnValue(mockSignal);

      const TestComponent = {
        setup() {
          const [value, updateSignal] = useSignal('initial', 'newKey');
          return { value, updateSignal };
        },
        template: '<div>{{ value }}</div>'
      };

      const wrapper = mount(TestComponent);
      await nextTick();

      expect(signalManager.getSignal).toHaveBeenCalledWith('newKey');
      expect(signalManager.createSignal).toHaveBeenCalledWith('initial', 'newKey');
    });

    it('should update signal value', async () => {
      const mockSignal = {
        value: 'initial',
        subscribe: vi.fn().mockReturnValue(() => {}),
        update: vi.fn()
      };

      vi.mocked(signalManager.createSignal).mockReturnValue(mockSignal);

      const TestComponent = {
        setup() {
          const [value, updateSignal] = useSignal('initial');
          return { value, updateSignal };
        },
        template: '<div @click="updateSignal(\'updated\')">{{ value }}</div>'
      };

      const wrapper = mount(TestComponent);
      await nextTick();

      await wrapper.trigger('click');

      expect(mockSignal.update).toHaveBeenCalledWith('updated');
    });
  });

  describe('useMetamonSignal', () => {
    it('should be an alias for useSignal with key', async () => {
      const mockSignal = {
        value: 'metamon',
        subscribe: vi.fn().mockReturnValue(() => {}),
        update: vi.fn()
      };

      vi.mocked(signalManager.getSignal).mockReturnValue(mockSignal);

      const TestComponent = {
        setup() {
          const [value, updateSignal] = useMetamonSignal('testKey', 'initial');
          return { value, updateSignal };
        },
        template: '<div>{{ value }}</div>'
      };

      const wrapper = mount(TestComponent);
      await nextTick();

      expect(signalManager.getSignal).toHaveBeenCalledWith('testKey');
      expect(wrapper.text()).toBe('metamon');
    });
  });

  describe('usePubSub', () => {
    it('should subscribe to events and provide emit function', async () => {
      const mockHandler = vi.fn();

      const TestComponent = {
        setup() {
          const emit = usePubSub('testEvent', mockHandler);
          return { emit };
        },
        template: '<div @click="emit(\'payload\')">Test</div>'
      };

      const wrapper = mount(TestComponent);
      await nextTick();

      expect(pubSubSystem.subscribe).toHaveBeenCalledWith(
        'testEvent',
        mockHandler,
        expect.any(String)
      );

      await wrapper.trigger('click');
      expect(pubSubSystem.emit).toHaveBeenCalledWith('testEvent', 'payload');
    });

    it('should cleanup subscriptions on unmount', async () => {
      const TestComponent = {
        setup() {
          const emit = usePubSub('testEvent', vi.fn());
          return { emit };
        },
        template: '<div>Test</div>'
      };

      const wrapper = mount(TestComponent);
      await nextTick();

      wrapper.unmount();

      expect(pubSubSystem.cleanup).toHaveBeenCalledWith(expect.any(String));
    });
  });

  describe('useEmit', () => {
    it('should provide emit function for specific event', async () => {
      const TestComponent = {
        setup() {
          const emit = useEmit('testEvent');
          return { emit };
        },
        template: '<div @click="emit(\'payload\')">Test</div>'
      };

      const wrapper = mount(TestComponent);
      await wrapper.trigger('click');

      expect(pubSubSystem.emit).toHaveBeenCalledWith('testEvent', 'payload');
    });
  });

  describe('useMetamonLifecycle', () => {
    it('should log component lifecycle and cleanup on unmount', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const TestComponent = {
        setup() {
          const componentId = useMetamonLifecycle('TestComponent');
          return { componentId };
        },
        template: '<div>{{ componentId }}</div>'
      };

      const wrapper = mount(TestComponent);
      await nextTick();

      expect(consoleSpy).toHaveBeenCalledWith('Metamon component TestComponent mounted');

      wrapper.unmount();

      expect(pubSubSystem.cleanup).toHaveBeenCalledWith('TestComponent');
      expect(consoleSpy).toHaveBeenCalledWith('Metamon component TestComponent unmounted');

      consoleSpy.mockRestore();
    });

    it('should generate random component ID when name not provided', async () => {
      const TestComponent = {
        setup() {
          const componentId = useMetamonLifecycle();
          return { componentId };
        },
        template: '<div>{{ componentId }}</div>'
      };

      const wrapper = mount(TestComponent);
      await nextTick();

      expect(wrapper.vm.componentId).toMatch(/^[a-z0-9]{9}$/);
    });
  });

  describe('useComputedSignal', () => {
    it('should create computed value from signal', async () => {
      const mockSignal = {
        value: 5,
        subscribe: vi.fn().mockReturnValue(() => {}),
        update: vi.fn()
      };

      vi.mocked(signalManager.getSignal).mockReturnValue(mockSignal);

      const TestComponent = {
        setup() {
          const doubled = useComputedSignal('counter', 5, (value) => value * 2);
          return { doubled };
        },
        template: '<div>{{ doubled }}</div>'
      };

      const wrapper = mount(TestComponent);
      await nextTick();

      expect(wrapper.text()).toBe('10');
    });
  });

  describe('useSignalModel', () => {
    it('should create two-way binding with signal', async () => {
      const mockSignal = {
        value: 'initial',
        subscribe: vi.fn().mockReturnValue(() => {}),
        update: vi.fn()
      };

      vi.mocked(signalManager.getSignal).mockReturnValue(mockSignal);

      const TestComponent = {
        setup() {
          const [modelValue, updateSignal] = useSignalModel('inputValue', 'initial');
          return { modelValue, updateSignal };
        },
        template: '<input v-model="modelValue" />'
      };

      const wrapper = mount(TestComponent);
      await nextTick();

      expect(wrapper.find('input').element.value).toBe('initial');

      // Test computed setter
      const input = wrapper.find('input');
      await input.setValue('updated');

      expect(mockSignal.update).toHaveBeenCalledWith('updated');
    });
  });
});