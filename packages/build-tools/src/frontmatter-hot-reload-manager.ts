/**
 * Frontmatter Hot Reload Manager - Handles MTM frontmatter changes during hot reload
 * 
 * This class manages hot reload operations specifically for MTM frontmatter changes,
 * including target framework changes, channel configuration updates, and import resolution.
 */

import type { MTMFile, MTMFrontmatter } from '@metamon/core';
import { MTMParser as MTMFileParser } from '@metamon/core';
import { readFileSync, existsSync } from 'fs';
import { parse as parseYaml } from 'yaml';

export interface FrontmatterChangeResult {
  hasChanges: boolean;
  targetChanged: boolean;
  channelsChanged: boolean;
  importsChanged: boolean;
  routeChanged: boolean;
  layoutChanged: boolean;
  changes: FrontmatterChange[];
}

export interface FrontmatterChange {
  type: 'target' | 'channels' | 'imports' | 'route' | 'layout';
  field: string;
  oldValue: any;
  newValue: any;
  requiresRecompilation: boolean;
  requiresSubscriptionUpdate: boolean;
  requiresDependencyResolution: boolean;
}

export interface ChannelSubscriptionUpdate {
  added: Array<{ event: string; emit: string }>;
  removed: Array<{ event: string; emit: string }>;
  modified: Array<{ 
    old: { event: string; emit: string };
    new: { event: string; emit: string };
  }>;
}

export interface FrontmatterHotReloadConfig {
  /** Enable frontmatter change detection */
  enableFrontmatterDetection: boolean;
  /** Enable automatic channel subscription updates */
  enableChannelUpdates: boolean;
  /** Enable automatic dependency resolution */
  enableDependencyResolution: boolean;
  /** Enable target framework change handling */
  enableTargetFrameworkChanges: boolean;
  /** Debug logging */
  debugLogging: boolean;
}

/**
 * Frontmatter Hot Reload Manager implementation
 */
export class FrontmatterHotReloadManager {
  private config: FrontmatterHotReloadConfig;
  private frontmatterCache: Map<string, MTMFrontmatter> = new Map();
  private importCache: Map<string, string[]> = new Map();

  constructor(config: Partial<FrontmatterHotReloadConfig> = {}) {
    this.config = {
      enableFrontmatterDetection: true,
      enableChannelUpdates: true,
      enableDependencyResolution: true,
      enableTargetFrameworkChanges: true,
      debugLogging: false,
      ...config
    };
  }

  /**
   * Detect frontmatter changes in an MTM file
   */
  async detectFrontmatterChanges(filePath: string, newContent?: string): Promise<FrontmatterChangeResult> {
    try {
      // Get current content
      const content = newContent || (existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '');
      
      if (!content) {
        return this.createEmptyChangeResult();
      }

      // Parse new frontmatter and content
      const { frontmatter: newFrontmatter, content: newComponentContent } = this.extractFrontmatterAndContent(content);
      const newImports = this.extractImports(newComponentContent);

      // Get cached frontmatter and imports
      const oldFrontmatter = this.frontmatterCache.get(filePath);
      const oldImports = this.importCache.get(filePath) || [];

      // If no cached version, this is the first time - cache and return no changes
      if (!oldFrontmatter) {
        this.frontmatterCache.set(filePath, newFrontmatter);
        this.importCache.set(filePath, newImports);
        return this.createEmptyChangeResult();
      }

      // Detect changes
      const changes: FrontmatterChange[] = [];

      // Check target framework change
      if (oldFrontmatter.target !== newFrontmatter.target) {
        changes.push({
          type: 'target',
          field: 'target',
          oldValue: oldFrontmatter.target,
          newValue: newFrontmatter.target,
          requiresRecompilation: true,
          requiresSubscriptionUpdate: false,
          requiresDependencyResolution: true
        });
      }

      // Check channels changes
      const channelsChanged = this.detectChannelsChanges(oldFrontmatter.channels, newFrontmatter.channels);
      if (channelsChanged.hasChanges) {
        changes.push({
          type: 'channels',
          field: 'channels',
          oldValue: oldFrontmatter.channels,
          newValue: newFrontmatter.channels,
          requiresRecompilation: true,
          requiresSubscriptionUpdate: true,
          requiresDependencyResolution: false
        });
      }

      // Check route changes
      if (oldFrontmatter.route !== newFrontmatter.route) {
        changes.push({
          type: 'route',
          field: 'route',
          oldValue: oldFrontmatter.route,
          newValue: newFrontmatter.route,
          requiresRecompilation: true,
          requiresSubscriptionUpdate: false,
          requiresDependencyResolution: false
        });
      }

      // Check layout changes
      if (oldFrontmatter.layout !== newFrontmatter.layout) {
        changes.push({
          type: 'layout',
          field: 'layout',
          oldValue: oldFrontmatter.layout,
          newValue: newFrontmatter.layout,
          requiresRecompilation: true,
          requiresSubscriptionUpdate: false,
          requiresDependencyResolution: true
        });
      }

      // Check imports changes
      const importsChanged = this.detectImportsChanges(oldImports, newImports);
      if (importsChanged) {
        changes.push({
          type: 'imports',
          field: 'imports',
          oldValue: oldImports,
          newValue: newImports,
          requiresRecompilation: true,
          requiresSubscriptionUpdate: false,
          requiresDependencyResolution: true
        });
      }

      // Update cache
      this.frontmatterCache.set(filePath, newFrontmatter);
      this.importCache.set(filePath, newImports);

      const result: FrontmatterChangeResult = {
        hasChanges: changes.length > 0,
        targetChanged: changes.some(c => c.type === 'target'),
        channelsChanged: changes.some(c => c.type === 'channels'),
        importsChanged: changes.some(c => c.type === 'imports'),
        routeChanged: changes.some(c => c.type === 'route'),
        layoutChanged: changes.some(c => c.type === 'layout'),
        changes
      };

      if (this.config.debugLogging && result.hasChanges) {
        console.log(`[FrontmatterHotReload] Detected changes in ${filePath}:`, result);
      }

      return result;

    } catch (error) {
      if (this.config.debugLogging) {
        console.error(`[FrontmatterHotReload] Error detecting changes in ${filePath}:`, error);
      }
      return this.createEmptyChangeResult();
    }
  }

  /**
   * Get channel subscription updates for channels changes
   */
  getChannelSubscriptionUpdates(oldChannels?: MTMFrontmatter['channels'], newChannels?: MTMFrontmatter['channels']): ChannelSubscriptionUpdate {
    const oldChannelMap = new Map((oldChannels || []).map(c => [`${c.event}:${c.emit}`, c]));
    const newChannelMap = new Map((newChannels || []).map(c => [`${c.event}:${c.emit}`, c]));

    const added: Array<{ event: string; emit: string }> = [];
    const removed: Array<{ event: string; emit: string }> = [];
    const modified: Array<{ old: { event: string; emit: string }; new: { event: string; emit: string } }> = [];

    // Find added channels
    for (const [key, channel] of newChannelMap) {
      if (!oldChannelMap.has(key)) {
        added.push(channel);
      }
    }

    // Find removed channels
    for (const [key, channel] of oldChannelMap) {
      if (!newChannelMap.has(key)) {
        removed.push(channel);
      }
    }

    // For this implementation, we consider channels as either added or removed
    // More complex modification detection could be added later if needed

    return { added, removed, modified };
  }

  /**
   * Handle target framework change
   */
  async handleTargetFrameworkChange(filePath: string, oldTarget: string, newTarget: string): Promise<boolean> {
    if (!this.config.enableTargetFrameworkChanges) {
      return false;
    }

    try {
      if (this.config.debugLogging) {
        console.log(`[FrontmatterHotReload] Handling target framework change: ${oldTarget} → ${newTarget} in ${filePath}`);
      }

      // The actual recompilation will be handled by the MTM plugin
      // This method can be extended to handle framework-specific cleanup or preparation
      
      return true;
    } catch (error) {
      if (this.config.debugLogging) {
        console.error(`[FrontmatterHotReload] Error handling target framework change in ${filePath}:`, error);
      }
      return false;
    }
  }

  /**
   * Handle channels configuration change
   */
  async handleChannelsChange(filePath: string, subscriptionUpdates: ChannelSubscriptionUpdate): Promise<boolean> {
    if (!this.config.enableChannelUpdates) {
      return false;
    }

    try {
      if (this.config.debugLogging) {
        console.log(`[FrontmatterHotReload] Handling channels change in ${filePath}:`, subscriptionUpdates);
      }

      // The actual subscription updates will be handled by the cross-framework synchronizer
      // This method provides the change information for other systems to use
      
      return true;
    } catch (error) {
      if (this.config.debugLogging) {
        console.error(`[FrontmatterHotReload] Error handling channels change in ${filePath}:`, error);
      }
      return false;
    }
  }

  /**
   * Handle imports change for dependency resolution
   */
  async handleImportsChange(filePath: string, oldImports: string[], newImports: string[]): Promise<boolean> {
    if (!this.config.enableDependencyResolution) {
      return false;
    }

    try {
      if (this.config.debugLogging) {
        console.log(`[FrontmatterHotReload] Handling imports change in ${filePath}:`, {
          added: newImports.filter(i => !oldImports.includes(i)),
          removed: oldImports.filter(i => !newImports.includes(i))
        });
      }

      // The actual dependency resolution will be handled by Vite's module graph
      // This method can be extended to handle Metamon-specific dependency tracking
      
      return true;
    } catch (error) {
      if (this.config.debugLogging) {
        console.error(`[FrontmatterHotReload] Error handling imports change in ${filePath}:`, error);
      }
      return false;
    }
  }

  /**
   * Extract frontmatter and content from file content
   */
  private extractFrontmatterAndContent(content: string): { frontmatter: MTMFrontmatter; content: string } {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    if (!frontmatterMatch) {
      throw new Error('Invalid MTM file format - missing frontmatter');
    }

    const [, frontmatterYaml, componentContent] = frontmatterMatch;
    
    try {
      const frontmatter = parseYaml(frontmatterYaml) as MTMFrontmatter;
      return { frontmatter, content: componentContent };
    } catch (error) {
      throw new Error(`Invalid YAML in frontmatter: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract import statements from component content
   */
  private extractImports(content: string): string[] {
    const importRegex = /^import\s+.*?from\s+['"][^'"]+['"];?\s*$/gm;
    const imports: string[] = [];
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[0].trim());
    }

    return imports;
  }

  /**
   * Detect changes in channels configuration
   */
  private detectChannelsChanges(oldChannels?: MTMFrontmatter['channels'], newChannels?: MTMFrontmatter['channels']): { hasChanges: boolean } {
    // Convert to comparable format
    const oldChannelStrings = (oldChannels || []).map(c => `${c.event}:${c.emit}`).sort();
    const newChannelStrings = (newChannels || []).map(c => `${c.event}:${c.emit}`).sort();

    // Compare arrays
    if (oldChannelStrings.length !== newChannelStrings.length) {
      return { hasChanges: true };
    }

    for (let i = 0; i < oldChannelStrings.length; i++) {
      if (oldChannelStrings[i] !== newChannelStrings[i]) {
        return { hasChanges: true };
      }
    }

    return { hasChanges: false };
  }

  /**
   * Detect changes in imports
   */
  private detectImportsChanges(oldImports: string[], newImports: string[]): boolean {
    if (oldImports.length !== newImports.length) {
      return true;
    }

    const oldSorted = [...oldImports].sort();
    const newSorted = [...newImports].sort();

    for (let i = 0; i < oldSorted.length; i++) {
      if (oldSorted[i] !== newSorted[i]) {
        return true;
      }
    }

    return false;
  }

  /**
   * Create empty change result
   */
  private createEmptyChangeResult(): FrontmatterChangeResult {
    return {
      hasChanges: false,
      targetChanged: false,
      channelsChanged: false,
      importsChanged: false,
      routeChanged: false,
      layoutChanged: false,
      changes: []
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<FrontmatterHotReloadConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): FrontmatterHotReloadConfig {
    return { ...this.config };
  }

  /**
   * Clear cache for a specific file
   */
  clearFileCache(filePath: string): void {
    this.frontmatterCache.delete(filePath);
    this.importCache.delete(filePath);
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.frontmatterCache.clear();
    this.importCache.clear();
  }

  /**
   * Get cached frontmatter for a file
   */
  getCachedFrontmatter(filePath: string): MTMFrontmatter | undefined {
    return this.frontmatterCache.get(filePath);
  }

  /**
   * Get cached imports for a file
   */
  getCachedImports(filePath: string): string[] | undefined {
    return this.importCache.get(filePath);
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.clearAllCaches();
  }
}