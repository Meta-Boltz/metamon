/**
 * Tests for Hot Reload Notification System
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HotReloadNotificationSystem, type NotificationOptions, type NotificationAction } from '../hot-reload-notification-system.js';

// Mock DOM environment
const mockDocument = {
  createElement: vi.fn(),
  getElementById: vi.fn(),
  head: { appendChild: vi.fn() },
  body: { appendChild: vi.fn() }
};

const mockElement = {
  id: '',
  className: '',
  innerHTML: '',
  style: { animation: '' },
  remove: vi.fn(),
  appendChild: vi.fn(),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(),
  addEventListener: vi.fn(),
  parentNode: { removeChild: vi.fn() }
};

// Setup DOM mocks
beforeEach(() => {
  global.document = mockDocument as any;
  mockDocument.createElement.mockReturnValue(mockElement);
  mockDocument.getElementById.mockReturnValue(null);
  mockElement.querySelector.mockReturnValue(mockElement);
  mockElement.querySelectorAll.mockReturnValue([mockElement]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('HotReloadNotificationSystem', () => {
  let notificationSystem: HotReloadNotificationSystem;

  beforeEach(() => {
    notificationSystem = new HotReloadNotificationSystem();
  });

  afterEach(() => {
    notificationSystem.cleanup();
  });

  describe('initialization', () => {
    it('should initialize with default options', () => {
      const options = notificationSystem.getOptions();
      
      expect(options.duration).toBe(4000);
      expect(options.position).toBe('top-right');
      expect(options.showProgress).toBe(true);
      expect(options.allowDismiss).toBe(true);
      expect(options.maxNotifications).toBe(5);
      expect(options.enableSound).toBe(false);
      expect(options.debugLogging).toBe(false);
    });

    it('should initialize with custom options', () => {
      const customOptions: Partial<NotificationOptions> = {
        duration: 2000,
        position: 'bottom-left',
        showProgress: false,
        allowDismiss: false,
        maxNotifications: 3,
        enableSound: true,
        debugLogging: true
      };

      const customSystem = new HotReloadNotificationSystem(customOptions);
      const options = customSystem.getOptions();

      expect(options.duration).toBe(2000);
      expect(options.position).toBe('bottom-left');
      expect(options.showProgress).toBe(false);
      expect(options.allowDismiss).toBe(false);
      expect(options.maxNotifications).toBe(3);
      expect(options.enableSound).toBe(true);
      expect(options.debugLogging).toBe(true);

      customSystem.cleanup();
    });

    it('should create container on initialization', () => {
      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      expect(mockDocument.body.appendChild).toHaveBeenCalled();
    });
  });

  describe('success notifications', () => {
    it('should show success notification', () => {
      const id = notificationSystem.showSuccess('Test Success', 'Success message', 'test.mtm');
      
      expect(id).toBeTruthy();
      expect(mockElement.innerHTML).toContain('Test Success');
      expect(mockElement.innerHTML).toContain('Success message');
      expect(mockElement.innerHTML).toContain('test.mtm');
      expect(mockElement.innerHTML).toContain('✅');
    });

    it('should auto-hide success notifications', (done) => {
      const shortDuration = 100;
      notificationSystem.showSuccess('Test', undefined, undefined, shortDuration);
      
      setTimeout(() => {
        expect(mockElement.style.animation).toContain('slide-out');
        done();
      }, shortDuration + 50);
    });

    it('should log success when debug logging is enabled', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const debugSystem = new HotReloadNotificationSystem({ debugLogging: true });
      
      debugSystem.showSuccess('Test Success');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Success: Test Success'),
        expect.any(Object)
      );
      
      consoleSpy.mockRestore();
      debugSystem.cleanup();
    });
  });

  describe('error notifications', () => {
    it('should show error notification', () => {
      const actions: NotificationAction[] = [
        { label: 'Retry', action: vi.fn(), style: 'primary' },
        { label: 'Dismiss', action: vi.fn(), style: 'secondary' }
      ];

      const id = notificationSystem.showError('Test Error', 'Error details', 'test.mtm', actions);
      
      expect(id).toBeTruthy();
      expect(mockElement.innerHTML).toContain('Test Error');
      expect(mockElement.innerHTML).toContain('Error details');
      expect(mockElement.innerHTML).toContain('test.mtm');
      expect(mockElement.innerHTML).toContain('❌');
      expect(mockElement.innerHTML).toContain('Retry');
      expect(mockElement.innerHTML).toContain('Dismiss');
    });

    it('should not auto-hide error notifications', (done) => {
      notificationSystem.showError('Test Error');
      
      setTimeout(() => {
        expect(mockElement.style.animation).not.toContain('slide-out');
        done();
      }, 100);
    });
  });

  describe('warning notifications', () => {
    it('should show warning notification', () => {
      const id = notificationSystem.showWarning('Test Warning', 'Warning details', 'test.mtm');
      
      expect(id).toBeTruthy();
      expect(mockElement.innerHTML).toContain('Test Warning');
      expect(mockElement.innerHTML).toContain('Warning details');
      expect(mockElement.innerHTML).toContain('⚠️');
    });

    it('should auto-hide warning notifications with extended duration', (done) => {
      const shortDuration = 100;
      notificationSystem.showWarning('Test', undefined, undefined, shortDuration);
      
      setTimeout(() => {
        expect(mockElement.style.animation).toContain('slide-out');
        done();
      }, shortDuration + 50);
    });
  });

  describe('info notifications', () => {
    it('should show info notification', () => {
      const id = notificationSystem.showInfo('Test Info', 'Info details', 'test.mtm');
      
      expect(id).toBeTruthy();
      expect(mockElement.innerHTML).toContain('Test Info');
      expect(mockElement.innerHTML).toContain('Info details');
      expect(mockElement.innerHTML).toContain('ℹ️');
    });
  });

  describe('loading notifications', () => {
    it('should show loading notification', () => {
      const id = notificationSystem.showLoading('Loading Test', 'Loading message', 'test.mtm');
      
      expect(id).toBeTruthy();
      expect(mockElement.innerHTML).toContain('Loading Test');
      expect(mockElement.innerHTML).toContain('Loading message');
      expect(mockElement.innerHTML).toContain('⏳');
      expect(mockElement.innerHTML).toContain('0%'); // Initial progress
    });

    it('should update loading progress', () => {
      const id = notificationSystem.showLoading('Loading Test');
      
      notificationSystem.updateProgress(id, 50, 'Half way there');
      
      expect(mockElement.innerHTML).toContain('50%');
      expect(mockElement.innerHTML).toContain('Half way there');
    });

    it('should complete loading with success', () => {
      const id = notificationSystem.showLoading('Loading Test');
      
      notificationSystem.completeLoading(id, true, 'Completed successfully');
      
      expect(mockElement.innerHTML).toContain('Completed successfully');
      expect(mockElement.innerHTML).toContain('100%');
    });

    it('should complete loading with error', () => {
      const actions: NotificationAction[] = [
        { label: 'Retry', action: vi.fn() }
      ];
      
      const id = notificationSystem.showLoading('Loading Test');
      
      notificationSystem.completeLoading(id, false, 'Failed to load', actions);
      
      expect(mockElement.innerHTML).toContain('Failed to load');
      expect(mockElement.innerHTML).toContain('Retry');
    });

    it('should not update progress for non-loading notifications', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const debugSystem = new HotReloadNotificationSystem({ debugLogging: true });
      
      const id = debugSystem.showSuccess('Test');
      debugSystem.updateProgress(id, 50);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot update progress for notification')
      );
      
      consoleSpy.mockRestore();
      debugSystem.cleanup();
    });
  });

  describe('notification management', () => {
    it('should hide specific notification', () => {
      const id = notificationSystem.showSuccess('Test');
      
      notificationSystem.hideNotification(id);
      
      expect(mockElement.style.animation).toContain('slide-out');
    });

    it('should hide all notifications', () => {
      notificationSystem.showSuccess('Test 1');
      notificationSystem.showError('Test 2');
      
      notificationSystem.hideAll();
      
      expect(mockElement.style.animation).toContain('slide-out');
    });

    it('should hide notifications by type', () => {
      notificationSystem.showSuccess('Success');
      notificationSystem.showError('Error');
      
      notificationSystem.hideByType('success');
      
      // Should hide success but not error
      expect(mockElement.style.animation).toContain('slide-out');
    });

    it('should enforce max notifications limit', () => {
      const limitedSystem = new HotReloadNotificationSystem({ maxNotifications: 2 });
      
      limitedSystem.showSuccess('Test 1');
      limitedSystem.showSuccess('Test 2');
      limitedSystem.showSuccess('Test 3'); // Should remove first notification
      
      const notifications = limitedSystem.getNotifications();
      expect(notifications).toHaveLength(2);
      expect(notifications[0].title).toBe('Test 2');
      expect(notifications[1].title).toBe('Test 3');
      
      limitedSystem.cleanup();
    });
  });

  describe('event handling', () => {
    it('should attach close button event listener', () => {
      notificationSystem.showSuccess('Test', undefined, undefined, 0); // No auto-hide
      
      expect(mockElement.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should attach action button event listeners', () => {
      const action = vi.fn();
      const actions: NotificationAction[] = [
        { label: 'Test Action', action }
      ];
      
      notificationSystem.showError('Test', undefined, undefined, actions);
      
      expect(mockElement.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });

  describe('HTML escaping', () => {
    it('should escape HTML in notification content', () => {
      const maliciousContent = '<script>alert("xss")</script>';
      
      notificationSystem.showSuccess(maliciousContent, maliciousContent);
      
      expect(mockElement.innerHTML).not.toContain('<script>');
      expect(mockElement.innerHTML).toContain('&lt;script&gt;');
    });
  });

  describe('file name extraction', () => {
    it('should extract file names correctly', () => {
      const testCases = [
        { path: 'src/components/TestComponent.mtm', expected: 'TestComponent.mtm' },
        { path: 'src\\components\\TestComponent.mtm', expected: 'TestComponent.mtm' },
        { path: 'TestComponent.mtm', expected: 'TestComponent.mtm' }
      ];

      testCases.forEach(({ path, expected }) => {
        notificationSystem.showSuccess('Test', undefined, path);
        expect(mockElement.innerHTML).toContain(expected);
      });
    });
  });

  describe('options update', () => {
    it('should update options', () => {
      const newOptions: Partial<NotificationOptions> = {
        duration: 2000,
        position: 'bottom-left',
        debugLogging: true
      };

      notificationSystem.updateOptions(newOptions);
      
      const options = notificationSystem.getOptions();
      expect(options.duration).toBe(2000);
      expect(options.position).toBe('bottom-left');
      expect(options.debugLogging).toBe(true);
      // Other options should remain unchanged
      expect(options.showProgress).toBe(true);
      expect(options.allowDismiss).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', () => {
      notificationSystem.showSuccess('Test 1');
      notificationSystem.showError('Test 2');
      
      expect(notificationSystem.getNotifications()).toHaveLength(2);
      
      notificationSystem.cleanup();
      
      expect(notificationSystem.getNotifications()).toHaveLength(0);
      expect(mockElement.remove).toHaveBeenCalled();
    });
  });

  describe('notification data', () => {
    it('should return current notifications', () => {
      notificationSystem.showSuccess('Success Test');
      notificationSystem.showError('Error Test');
      
      const notifications = notificationSystem.getNotifications();
      
      expect(notifications).toHaveLength(2);
      expect(notifications[0].type).toBe('success');
      expect(notifications[0].title).toBe('Success Test');
      expect(notifications[1].type).toBe('error');
      expect(notifications[1].title).toBe('Error Test');
    });

    it('should generate unique notification IDs', () => {
      const id1 = notificationSystem.showSuccess('Test 1');
      const id2 = notificationSystem.showSuccess('Test 2');
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^mtm-notification-\d+-\d+$/);
      expect(id2).toMatch(/^mtm-notification-\d+-\d+$/);
    });
  });
});