/**
 * Types for Layout Stability Controller
 */

export interface LayoutReservation {
  id: string;
  element: HTMLElement;
  dimensions: DOMRect;
  placeholder: HTMLElement;
  expiresAt: number;
  componentId?: string;
  framework?: string;
}

export interface CLSMetrics {
  score: number;
  shifts: LayoutShift[];
  worstShift: LayoutShift | null;
  timeline: CLSTimelineEntry[];
  measurementStartTime: number;
  measurementEndTime?: number;
}

export interface LayoutShift {
  value: number;
  sources: LayoutShiftSource[];
  hadRecentInput: boolean;
  lastInputTime: number;
  timestamp: number;
}

export interface LayoutShiftSource {
  node: Element;
  previousRect: DOMRect;
  currentRect: DOMRect;
}

export interface CLSTimelineEntry {
  timestamp: number;
  cumulativeScore: number;
  shiftValue: number;
  description: string;
}

export interface ComponentDefinition {
  id: string;
  framework: string;
  tagName: string;
  props?: Record<string, any>;
  children?: ComponentDefinition[];
  isInteractive: boolean;
  estimatedSize?: {
    width: number;
    height: number;
  };
}

export interface PlaceholderConfig {
  showLoadingIndicator: boolean;
  loadingIndicatorType: 'spinner' | 'skeleton' | 'pulse' | 'custom';
  customLoadingContent?: string;
  maintainAspectRatio: boolean;
  backgroundColor?: string;
  borderRadius?: string;
  animation?: {
    type: 'fade' | 'slide' | 'scale' | 'none';
    duration: number;
    easing: string;
  };
}

export interface TransitionConfig {
  duration: number;
  easing: string;
  fadeOut: boolean;
  fadeIn: boolean;
  crossFade: boolean;
  maintainPosition: boolean;
}

export interface LayoutStabilityConfig {
  clsThreshold: number;
  measurementDuration: number;
  reservationTimeout: number;
  enablePlaceholders: boolean;
  placeholderConfig: PlaceholderConfig;
  transitionConfig: TransitionConfig;
  enableMetrics: boolean;
  enableLogging: boolean;
}

export interface LayoutStabilityMetrics {
  totalReservations: number;
  activeReservations: number;
  expiredReservations: number;
  averageReservationDuration: number;
  clsScore: number;
  layoutShiftsCount: number;
  transitionsCount: number;
  averageTransitionDuration: number;
}

export type LayoutStabilityEventType = 
  | 'reservation-created'
  | 'reservation-released'
  | 'reservation-expired'
  | 'placeholder-created'
  | 'placeholder-replaced'
  | 'transition-started'
  | 'transition-completed'
  | 'cls-threshold-exceeded'
  | 'layout-shift-detected';

export interface LayoutStabilityEvent {
  type: LayoutStabilityEventType;
  timestamp: number;
  data: any;
  reservationId?: string;
  componentId?: string;
}