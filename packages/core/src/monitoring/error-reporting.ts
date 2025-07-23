/**
 * Error Reporting System
 * 
 * This module provides error reporting and monitoring integration for Ultra-Modern MTM applications.
 * It supports various error reporting services and provides a unified API for error tracking.
 */

interface ErrorReportingOptions {
  service: 'console' | 'sentry' | 'rollbar' | 'newrelic' | 'custom';
  dsn?: string;
  environment?: string;
  release?: string;
  tags?: Record<string, string>;
  beforeSend?: (error: Error, context?: any) => Error | null;
  customHandler?: (error: Error, context?: any) => void;
}

interface ErrorContext {
  user?: {
    id?: string;
    username?: string;
    email?: string;
  };
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  [key: string]: any;
}

class ErrorReporter {
  private options: ErrorReportingOptions;
  private initialized: boolean = false;
  private sentryInstance: any = null;
  private rollbarInstance: any = null;
  private newrelicInstance: any = null;

  constructor(options: ErrorReportingOptions) {
    this.options = {
      environment: process.env.NODE_ENV || 'development',
      ...options
    };
  }

  /**
   * Initialize the error reporting service
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    try {
      switch (this.options.service) {
        case 'sentry':
          await this.initializeSentry();
          break;
        case 'rollbar':
          await this.initializeRollbar();
          break;
        case 'newrelic':
          await this.initializeNewRelic();
          break;
        case 'console':
          // Console logger doesn't need initialization
          break;
        case 'custom':
          if (!this.options.customHandler) {
            throw new Error('Custom error handler not provided');
          }
          break;
        default:
          throw new Error(`Unsupported error reporting service: ${this.options.service}`);
      }

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize error reporting:', error);
      // Fallback to console logging
      this.options.service = 'console';
      this.initialized = true;
      return false;
    }
  }

  /**
   * Report an error to the configured service
   */
  async reportError(error: Error, context?: ErrorContext): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Apply beforeSend hook if configured
    if (this.options.beforeSend) {
      const processedError = this.options.beforeSend(error, context);
      if (!processedError) {
        return; // Error was filtered out
      }
      error = processedError;
    }

    try {
      switch (this.options.service) {
        case 'sentry':
          this.reportToSentry(error, context);
          break;
        case 'rollbar':
          this.reportToRollbar(error, context);
          break;
        case 'newrelic':
          this.reportToNewRelic(error, context);
          break;
        case 'custom':
          if (this.options.customHandler) {
            this.options.customHandler(error, context);
          }
          break;
        case 'console':
        default:
          this.reportToConsole(error, context);
          break;
      }
    } catch (reportingError) {
      // Fallback to console if reporting fails
      console.error('Error reporting failed:', reportingError);
      this.reportToConsole(error, context);
    }
  }

  /**
   * Set user information for error context
   */
  setUser(user: ErrorContext['user']): void {
    if (!user) return;

    if (this.sentryInstance) {
      this.sentryInstance.setUser(user);
    }

    if (this.rollbarInstance) {
      this.rollbarInstance.configure({
        payload: {
          person: {
            id: user.id,
            username: user.username,
            email: user.email
          }
        }
      });
    }

    // Store user info for other services
    this._currentUser = user;
  }

  /**
   * Clear user information
   */
  clearUser(): void {
    if (this.sentryInstance) {
      this.sentryInstance.setUser(null);
    }

    if (this.rollbarInstance) {
      this.rollbarInstance.configure({
        payload: {
          person: null
        }
      });
    }

    this._currentUser = null;
  }

  /**
   * Add global tags for all error reports
   */
  setTags(tags: Record<string, string>): void {
    if (!tags) return;

    if (this.sentryInstance) {
      this.sentryInstance.setTags(tags);
    }

    if (this.rollbarInstance) {
      this.rollbarInstance.configure({
        payload: {
          custom: {
            ...this.rollbarInstance.options.payload.custom,
            tags
          }
        }
      });
    }

    // Store tags for other services
    this._globalTags = {
      ...this._globalTags,
      ...tags
    };
  }

  /**
   * Create an error boundary component for React applications
   */
  createErrorBoundary(fallback: any): any {
    // This is a simplified implementation
    // In a real app, this would return a proper React error boundary component
    return {
      componentDidCatch: (error: Error, errorInfo: any) => {
        this.reportError(error, {
          extra: { componentStack: errorInfo.componentStack }
        });
      },
      render: (props: any, state: any) => {
        if (state.hasError) {
          return fallback;
        }
        return props.children;
      }
    };
  }

  // Private properties
  private _currentUser: ErrorContext['user'] | null = null;
  private _globalTags: Record<string, string> = {};

  // Private methods for service-specific initialization
  private async initializeSentry(): Promise<void> {
    try {
      // Dynamic import to avoid requiring Sentry as a dependency
      const Sentry = await import('@sentry/browser');
      
      Sentry.init({
        dsn: this.options.dsn,
        environment: this.options.environment,
        release: this.options.release,
        beforeSend: (event) => {
          // Additional processing
          return event;
        }
      });
      
      this.sentryInstance = Sentry;
      
      if (this.options.tags) {
        Sentry.setTags(this.options.tags);
      }
    } catch (error) {
      console.error('Failed to initialize Sentry:', error);
      throw error;
    }
  }

  private async initializeRollbar(): Promise<void> {
    try {
      // Dynamic import to avoid requiring Rollbar as a dependency
      const Rollbar = await import('rollbar');
      
      this.rollbarInstance = new Rollbar({
        accessToken: this.options.dsn,
        environment: this.options.environment,
        captureUncaught: true,
        captureUnhandledRejections: true,
        payload: {
          client: {
            javascript: {
              source_map_enabled: true,
              code_version: this.options.release
            }
          },
          custom: {
            tags: this.options.tags
          }
        }
      });
    } catch (error) {
      console.error('Failed to initialize Rollbar:', error);
      throw error;
    }
  }

  private async initializeNewRelic(): Promise<void> {
    try {
      // Dynamic import to avoid requiring New Relic as a dependency
      const newrelic = await import('newrelic');
      this.newrelicInstance = newrelic;
      
      // New Relic is typically initialized via its Node.js agent
      // This is just for additional configuration
      if (this.options.tags) {
        Object.entries(this.options.tags).forEach(([key, value]) => {
          newrelic.addCustomAttribute(key, value);
        });
      }
    } catch (error) {
      console.error('Failed to initialize New Relic:', error);
      throw error;
    }
  }

  // Private methods for service-specific reporting
  private reportToSentry(error: Error, context?: ErrorContext): void {
    if (!this.sentryInstance) {
      this.reportToConsole(error, context);
      return;
    }

    const scope = new this.sentryInstance.Scope();
    
    if (context) {
      if (context.user) {
        scope.setUser(context.user);
      }
      
      if (context.tags) {
        scope.setTags(context.tags);
      }
      
      if (context.extra) {
        Object.entries(context.extra).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }
      
      if (context.level) {
        scope.setLevel(context.level);
      }
    }
    
    this.sentryInstance.captureException(error, scope);
  }

  private reportToRollbar(error: Error, context?: ErrorContext): void {
    if (!this.rollbarInstance) {
      this.reportToConsole(error, context);
      return;
    }

    const rollbarLevel = context?.level || 'error';
    const payload = {
      ...context
    };
    
    this.rollbarInstance[rollbarLevel](error, payload);
  }

  private reportToNewRelic(error: Error, context?: ErrorContext): void {
    if (!this.newrelicInstance) {
      this.reportToConsole(error, context);
      return;
    }

    const attributes = {
      ...context?.extra,
      ...context?.tags
    };
    
    if (context?.user) {
      attributes.userId = context.user.id;
      attributes.username = context.user.username;
    }
    
    this.newrelicInstance.noticeError(error, attributes);
  }

  private reportToConsole(error: Error, context?: ErrorContext): void {
    const level = context?.level || 'error';
    const consoleMethod = level === 'fatal' ? 'error' : level;
    
    if (typeof console[consoleMethod] === 'function') {
      console[consoleMethod]('Error Report:', {
        error,
        message: error.message,
        stack: error.stack,
        context
      });
    } else {
      console.error('Error Report:', {
        error,
        message: error.message,
        stack: error.stack,
        context
      });
    }
  }
}

// Export the error reporter
export { ErrorReporter, ErrorReportingOptions, ErrorContext };

// Create a default instance for easy import
const defaultReporter = new ErrorReporter({ service: 'console' });

export default defaultReporter;