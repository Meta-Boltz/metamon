import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReactAdapter } from './react-adapter.js';
import type { MTMFile, Channel } from '@metamon/core';

describe('ReactAdapter', () => {
  let adapter: ReactAdapter;

  beforeEach(() => {
    adapter = new ReactAdapter();
  });

  describe('basic properties', () => {
    it('should have correct name and file extension', () => {
      expect(adapter.name).toBe('reactjs');
      expect(adapter.fileExtension).toBe('.jsx');
    });
  });

  describe('compile method', () => {
    it('should compile simple React component', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'reactjs'
        },
        content: `import React from 'react';

export default function TestComponent() {
  return <div>Hello World</div>;
}`,
        filePath: '/test/component.mtm'
      };

      const result = adapter.compile(mtmFile);

      expect(result.code).toContain('import React from \'react\';');
      expect(result.code).toContain('export default function TestComponent()');
      expect(result.code).toContain('Hello World');
      expect(result.dependencies).toContain('react');
      expect(result.exports).toEqual(['default']);
    });

    it('should compile React component with channels', () => {
      const channels: Channel[] = [
        { event: 'userLogin', emit: 'onUserLogin' },
        { event: 'dataUpdate', emit: 'onDataUpdate' }
      ];

      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'reactjs',
          channels
        },
        content: `import React, { useState } from 'react';

export default function UserComponent() {
  const [user, setUser] = useState(null);
  return <div>User: {user?.name}</div>;
}`,
        filePath: '/test/user.mtm'
      };

      const result = adapter.compile(mtmFile);

      expect(result.code).toContain('pubSubSystem');
      expect(result.code).toContain('onUserLogin');
      expect(result.code).toContain('onDataUpdate');
      expect(result.code).toContain('userLogin');
      expect(result.code).toContain('dataUpdate');
    });

    it('should throw error for invalid target framework', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'vue' as any
        },
        content: 'export default function Test() {}',
        filePath: '/test/invalid.mtm'
      };

      expect(() => adapter.compile(mtmFile)).toThrow('Invalid target framework: vue');
    });

    it('should handle compilation errors gracefully', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'reactjs'
        },
        content: 'invalid javascript syntax {{{',
        filePath: '/test/error.mtm'
      };

      // This should not throw but should handle the error gracefully
      const result = adapter.compile(mtmFile);
      expect(result.code).toBeDefined();
    });
  });

  describe('generateImports method', () => {
    it('should generate basic React imports', () => {
      const dependencies = ['react', 'lodash'];
      const imports = adapter.generateImports(dependencies);

      expect(imports).toContain('import React from \'react\';');
      expect(imports).toContain('import lodash from \'lodash\';');
    });

    it('should handle relative imports', () => {
      const dependencies = ['./utils', '../components/Button'];
      const imports = adapter.generateImports(dependencies);

      expect(imports).toContain('import Utils from \'./utils\';');
      expect(imports).toContain('import Button from \'../components/Button\';');
    });
  });

  describe('wrapWithRuntime method', () => {
    it('should wrap component with signal integration', () => {
      const component = 'export default function Test() { return <div>Test</div>; }';
      const channels: Channel[] = [];

      const wrapped = adapter.wrapWithRuntime(component, channels);

      expect(wrapped).toContain('useSignal');
      expect(wrapped).toContain('useMetamonSignal');
      expect(wrapped).toContain('signalManager');
      expect(wrapped).toContain(component);
    });

    it('should wrap component with pub/sub integration when channels provided', () => {
      const component = 'export default function Test() { return <div>Test</div>; }';
      const channels: Channel[] = [
        { event: 'testEvent', emit: 'onTestEvent' }
      ];

      const wrapped = adapter.wrapWithRuntime(component, channels);

      expect(wrapped).toContain('pubSubSystem');
      expect(wrapped).toContain('onTestEvent');
      expect(wrapped).toContain('testEvent');
      expect(wrapped).toContain(component);
    });
  });

  describe('setupSignalIntegration method', () => {
    it('should generate signal integration code', () => {
      const signalCode = adapter.setupSignalIntegration();

      expect(signalCode).toContain('useSignal');
      expect(signalCode).toContain('useMetamonSignal');
      expect(signalCode).toContain('signalManager');
      expect(signalCode).toContain('useState');
      expect(signalCode).toContain('useEffect');
      expect(signalCode).toContain('useCallback');
    });
  });

  describe('setupPubSubIntegration method', () => {
    it('should return empty string when no channels', () => {
      const pubSubCode = adapter.setupPubSubIntegration([]);
      expect(pubSubCode).toBe('');
    });

    it('should generate pub/sub integration code for channels', () => {
      const channels: Channel[] = [
        { event: 'userAction', emit: 'onUserAction' },
        { event: 'systemEvent', emit: 'onSystemEvent' }
      ];

      const pubSubCode = adapter.setupPubSubIntegration(channels);

      expect(pubSubCode).toContain('pubSubSystem');
      expect(pubSubCode).toContain('onUserAction');
      expect(pubSubCode).toContain('onSystemEvent');
      expect(pubSubCode).toContain('userAction');
      expect(pubSubCode).toContain('systemEvent');
      expect(pubSubCode).toContain('useCallback');
      expect(pubSubCode).toContain('useEffect');
    });
  });

  describe('injectRuntime method', () => {
    it('should inject runtime imports', () => {
      const component = 'export default function Test() {}';
      const injected = adapter.injectRuntime(component);

      expect(injected).toContain('useEffect');
      expect(injected).toContain('pubSubSystem');
      expect(injected).toContain(component);
    });
  });
});