/**
 * Layout Stability Module
 * Exports for layout stability controller and related components
 */

export { LayoutStabilityController } from './layout-stability-controller.js';
export { CLSMonitor } from './cls-monitor.js';
export { PlaceholderManager } from './placeholder-manager.js';

export type {
  LayoutReservation,
  CLSMetrics,
  LayoutShift,
  LayoutShiftSource,
  CLSTimelineEntry,
  ComponentDefinition,
  PlaceholderConfig,
  TransitionConfig,
  LayoutStabilityConfig,
  LayoutStabilityMetrics,
  LayoutStabilityEvent,
  LayoutStabilityEventType
} from './types.js';