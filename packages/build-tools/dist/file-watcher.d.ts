import { EventEmitter } from 'events';
/**
 * Events emitted by the file watcher
 */
export interface FileWatcherEvents {
    'file-changed': (filePath: string) => void;
    'file-added': (filePath: string) => void;
    'file-removed': (filePath: string) => void;
    'error': (error: Error) => void;
}
/**
 * File watcher for .mtm files and their dependencies
 */
export declare class MetamonFileWatcher extends EventEmitter {
    private watcher;
    private watchedPaths;
    private isWatching;
    /**
     * Start watching files
     */
    start(paths: string | string[], options?: {
        ignored?: string[];
    }): void;
    /**
     * Stop watching files
     */
    stop(): void;
    /**
     * Add a file or directory to watch
     */
    addPath(path: string): void;
    /**
     * Remove a file or directory from watching
     */
    removePath(path: string): void;
    /**
     * Get all currently watched paths
     */
    getWatchedPaths(): string[];
    /**
     * Check if currently watching files
     */
    get watching(): boolean;
    /**
     * Check if a file should be watched
     */
    private shouldWatch;
}
/**
 * Create a new file watcher instance
 */
export declare function createFileWatcher(): MetamonFileWatcher;
