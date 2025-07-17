import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReactAdapter } from './react-adapter.js';
import type { MTMFile, Channel } from '@metamon/core';

describe('React Adapter Integration', () => {
  let adapter: ReactAdapter;

  beforeEach(() => {
    adapter = new ReactAdapter();
  });

  describe('end-to-end compilation', () => {
    it('should compile complete React component with signals and pub/sub', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'reactjs',
          channels: [
            { event: 'userLogin', emit: 'handleUserLogin' },
            { event: 'dataRefresh', emit: 'handleDataRefresh' }
          ],
          route: '/dashboard',
          layout: 'main'
        },
        content: `import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/dashboard');
      setData(response.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
    handleUserLogin(userData);
  };

  const refreshData = () => {
    loadInitialData();
    handleDataRefresh({ timestamp: Date.now() });
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      {user ? (
        <div>
          <p>Welcome, {user.name}!</p>
          <button onClick={refreshData}>Refresh Data</button>
          <div className="data-list">
            {data.map(item => (
              <div key={item.id} className="data-item">
                {item.title}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <button onClick={() => handleLogin({ name: 'Test User', id: 1 })}>
          Login
        </button>
      )}
    </div>
  );
}`,
        filePath: '/pages/dashboard.mtm'
      };

      const result = adapter.compile(mtmFile);

      // Verify the compilation result structure
      expect(result.code).toBeDefined();
      expect(result.dependencies).toContain('react');
      expect(result.dependencies).toContain('axios');
      expect(result.exports).toEqual(['default']);

      // Verify React imports are present
      expect(result.code).toContain('import React from \'react\';');
      expect(result.code).toContain('import { useState, useEffect, useCallback } from \'react\';');

      // Verify Metamon core imports
      expect(result.code).toContain('import { signalManager, pubSubSystem } from \'@metamon/core\';');

      // Verify signal integration
      expect(result.code).toContain('useSignal');
      expect(result.code).toContain('useMetamonSignal');

      // Verify pub/sub integration
      expect(result.code).toContain('handleUserLogin');
      expect(result.code).toContain('handleDataRefresh');
      expect(result.code).toContain('userLogin');
      expect(result.code).toContain('dataRefresh');

      // Verify original component code is preserved
      expect(result.code).toContain('Dashboard');
      expect(result.code).toContain('loadInitialData');
      expect(result.code).toContain('axios.get');
      expect(result.code).toContain('className="dashboard"');
    });

    it('should handle component with only signals (no pub/sub)', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'reactjs'
        },
        content: `import React from 'react';

export default function Counter() {
  const [count, setCount] = useSignal(0, 'globalCounter');

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
}`,
        filePath: '/components/counter.mtm'
      };

      const result = adapter.compile(mtmFile);

      expect(result.code).toContain('useSignal');
      expect(result.code).toContain('signalManager');
      expect(result.code).toContain('globalCounter');
      expect(result.code).toContain('Counter');
      
      // Should not contain pub/sub code when no channels
      expect(result.code).not.toContain('pubSubSystem.subscribe');
    });

    it('should handle component with complex imports', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'reactjs',
          channels: [{ event: 'modalOpen', emit: 'openModal' }]
        },
        content: `import React, { useState, useCallback, useMemo } from 'react';
import { debounce } from 'lodash';
import { formatDate } from '../utils/dateUtils';
import Button from '../components/Button';
import Modal from './Modal';

export default function UserList() {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  const debouncedSearch = useMemo(
    () => debounce((term) => {
      // Search logic here
    }, 300),
    []
  );

  const handleUserSelect = useCallback((user) => {
    setSelectedUser(user);
    openModal({ type: 'userDetails', user });
  }, []);

  return (
    <div>
      <input 
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          debouncedSearch(e.target.value);
        }}
        placeholder="Search users..."
      />
      {users.map(user => (
        <div key={user.id} onClick={() => handleUserSelect(user)}>
          <h3>{user.name}</h3>
          <p>Joined: {formatDate(user.createdAt)}</p>
        </div>
      ))}
      <Modal user={selectedUser} />
    </div>
  );
}`,
        filePath: '/components/user-list.mtm'
      };

      const result = adapter.compile(mtmFile);

      // Verify all imports are preserved
      expect(result.dependencies).toContain('lodash');
      expect(result.dependencies).toContain('../utils/dateUtils');
      expect(result.dependencies).toContain('../components/Button');
      expect(result.dependencies).toContain('./Modal');

      // Verify component functionality is preserved
      expect(result.code).toContain('debounce');
      expect(result.code).toContain('formatDate');
      expect(result.code).toContain('UserList');
      expect(result.code).toContain('handleUserSelect');

      // Verify pub/sub integration
      expect(result.code).toContain('openModal');
      expect(result.code).toContain('modalOpen');
    });
  });

  describe('error handling', () => {
    it('should provide helpful error for wrong target framework', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'vue' as any
        },
        content: 'export default function Test() {}',
        filePath: '/test/wrong-target.mtm'
      };

      expect(() => adapter.compile(mtmFile)).toThrow('Invalid target framework: vue. Expected \'reactjs\'');
    });

    it('should handle malformed frontmatter gracefully', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'reactjs',
          channels: null as any
        },
        content: 'export default function Test() {}',
        filePath: '/test/malformed.mtm'
      };

      const result = adapter.compile(mtmFile);
      expect(result.code).toBeDefined();
      // Should handle null channels gracefully
      expect(result.code).toContain('Test');
    });
  });

  describe('runtime integration verification', () => {
    it('should generate code that properly integrates with Metamon runtime', () => {
      const mtmFile: MTMFile = {
        frontmatter: {
          target: 'reactjs',
          channels: [{ event: 'test', emit: 'onTest' }]
        },
        content: `export default function TestComponent() {
  const [value, setValue] = useSignal('initial', 'testSignal');
  return <div>{value}</div>;
}`,
        filePath: '/test/runtime.mtm'
      };

      const result = adapter.compile(mtmFile);

      // Verify runtime hooks are properly set up
      expect(result.code).toMatch(/const onTest = useCallback\(\(payload\) => \{[\s\S]*pubSubSystem\.emit\('test', payload\);[\s\S]*\}, \[\]\);/);
      
      // Verify signal integration
      expect(result.code).toMatch(/useSignal.*subscribe.*setValue/s);
      
      // Verify cleanup integration
      expect(result.code).toMatch(/useEffect\(\(\) => \{[\s\S]*return \(\) => \{[\s\S]*pubSubSystem\.cleanup/s);
    });
  });
});