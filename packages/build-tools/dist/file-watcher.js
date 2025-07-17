import { watch } from 'chokidar';
import { resolve } from 'path';
import { EventEmitter } from 'events';
/**
 * File watcher for .mtm files and their dependencies
 */
export class MetamonFileWatcher extends EventEmitter {
    constructor() {
        super(...arguments);
        this.watcher = null;
        this.watchedPaths = new Set();
        this.isWatching = false;
    }
    /**
     * Start watching files
     */
    start(paths, options = {}) {
        if (this.isWatching) {
            this.stop();
        }
        const watchPaths = Array.isArray(paths) ? paths : [paths];
        const { ignored = ['node_modules/**', '.git/**', 'dist/**', 'build/**'] } = options;
        this.watcher = watch(watchPaths, {
            ignored,
            persistent: true,
            ignoreInitial: true,
            followSymlinks: false,
            depth: 10
        });
        this.watcher
            .on('change', (filePath) => {
            if (this.shouldWatch(filePath)) {
                this.emit('file-changed', resolve(filePath));
            }
        })
            .on('add', (filePath) => {
            if (this.shouldWatch(filePath)) {
                this.watchedPaths.add(resolve(filePath));
                this.emit('file-added', resolve(filePath));
            }
        })
            .on('unlink', (filePath) => {
            const resolvedPath = resolve(filePath);
            if (this.watchedPaths.has(resolvedPath)) {
                this.watchedPaths.delete(resolvedPath);
                this.emit('file-removed', resolvedPath);
            }
        })
            .on('error', (error) => {
            this.emit('error', error);
        });
        this.isWatching = true;
    }
    /**
     * Stop watching files
     */
    stop() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
        this.watchedPaths.clear();
        this.isWatching = false;
    }
    /**
     * Add a file or directory to watch
     */
    addPath(path) {
        if (this.watcher) {
            const resolvedPath = resolve(path);
            this.watcher.add(resolvedPath);
            this.watchedPaths.add(resolvedPath);
        }
    }
    /**
     * Remove a file or directory from watching
     */
    removePath(path) {
        if (this.watcher) {
            const resolvedPath = resolve(path);
            this.watcher.unwatch(resolvedPath);
            this.watchedPaths.delete(resolvedPath);
        }
    }
    /**
     * Get all currently watched paths
     */
    getWatchedPaths() {
        return Array.from(this.watchedPaths);
    }
    /**
     * Check if currently watching files
     */
    get watching() {
        return this.isWatching;
    }
    /**
     * Check if a file should be watched
     */
    shouldWatch(filePath) {
        // Watch .mtm files and common dependency files
        return filePath.endsWith('.mtm') ||
            filePath.endsWith('.ts') ||
            filePath.endsWith('.tsx') ||
            filePath.endsWith('.js') ||
            filePath.endsWith('.jsx') ||
            filePath.endsWith('.vue') ||
            filePath.endsWith('.svelte');
    }
}
/**
 * Create a new file watcher instance
 */
export function createFileWatcher() {
    return new MetamonFileWatcher();
}
