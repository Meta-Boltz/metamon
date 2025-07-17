import { describe, it, expect } from 'vitest';
import { ReactAdapter } from './react-adapter.js';
import { MTMParser } from '@metamon/core';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('React Adapter Demo', () => {
  it('should compile the example MTM file correctly', () => {
    const adapter = new ReactAdapter();
    const parser = new MTMParser();
    
    // Read the example MTM file
    const examplePath = join(__dirname, '../../examples/react-example.mtm');
    const mtmFile = parser.parse(examplePath);
    
    // Compile it with the React adapter
    const result = adapter.compile(mtmFile);
    
    // Verify the compilation result
    expect(result.code).toBeDefined();
    expect(result.code.length).toBeGreaterThan(0);
    
    // Verify React imports
    expect(result.code).toContain('import React from \'react\';');
    expect(result.code).toContain('import { useState, useEffect, useCallback } from \'react\';');
    
    // Verify Metamon imports
    expect(result.code).toContain('import { signalManager, pubSubSystem } from \'@metamon/core\';');
    
    // Verify signal integration
    expect(result.code).toContain('useSignal');
    expect(result.code).toContain('useMetamonSignal');
    
    // Verify pub/sub integration
    expect(result.code).toContain('onUserLogin');
    expect(result.code).toContain('onDataUpdate');
    expect(result.code).toContain('userLogin');
    expect(result.code).toContain('dataUpdate');
    
    // Verify original component code is preserved
    expect(result.code).toContain('Dashboard');
    expect(result.code).toContain('loadInitialData');
    expect(result.code).toContain('axios.get');
    expect(result.code).toContain('Global Counter');
    
    // Verify dependencies
    expect(result.dependencies).toContain('react');
    expect(result.dependencies).toContain('axios');
    
    console.log('Compiled React Component:');
    console.log('========================');
    console.log(result.code);
  });
});