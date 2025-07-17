import { FrameworkCompiler, Channel } from '@metamon/core';
/**
 * Configuration for MTM files
 */
export interface MTMConfig {
    target: string;
    channels?: Channel[];
    route?: string;
    layout?: string;
}
/**
 * Base interface for framework adapters
 */
export interface FrameworkAdapter extends FrameworkCompiler {
    name: string;
    fileExtension: string;
    injectRuntime(component: string): string;
    setupSignalIntegration(): string;
    setupPubSubIntegration(channels: Channel[]): string;
}
