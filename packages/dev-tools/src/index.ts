export { MTMFileParser } from './mtm-parser';
export { MTMValidator } from './mtm-validator';
export { MTMCompletionProvider } from './completion-provider';
export { ErrorReporter } from './error-reporter';
export { StatePreservationManager } from './state-preservation-manager';

// State serialization utilities
export {
  serializeStateSnapshot,
  deserializeStateSnapshot,
  validateStateSnapshot,
  cloneStateSnapshot,
  mergeStateSnapshots,
  getSnapshotStats,
  isSnapshotStale,
  compressStateSnapshot
} from './state-serialization';

// Re-export types
export type { MTMFile } from './mtm-parser';
export type { ValidationError } from './mtm-validator';
export type { ErrorReport, ErrorReporterOptions } from './error-reporter';

// State preservation types
export type {
  StateSnapshot,
  SignalStateSnapshot,
  SubscriptionSnapshot,
  ComponentStateSnapshot,
  StatePreservationConfig,
  StatePreservationResult,
  StateRestorationResult,
  EventSubscriptionData,
  MetamonConnection
} from './types/state-preservation';