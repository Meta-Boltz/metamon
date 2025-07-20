import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventHandlerParser, type EventHandlerInfo, SUPPORTED_EVENTS } from './event-handler-parser.js';

describe('EventHandlerParser', () => {
  let parser: EventHandlerParser;

  beforeEach(() => {
    parser = new EventHandlerParser();
  });

  describe('parseEventHandler', () => {
    it('should parse simple event handler', () => {
      const result = parser.parseEventHandler(
        'click',
        '$handleClick()',
        { line: 1, column: 1, index: 0 }
      );

      expect(result.eventName).toBe('click');
      expect(result.handlerFunction).toBe('$handleClick');
      expect(result.parameters).toEqual([]);
      expect(result.isInline).toBe(false);
    });

    it('should parse event handler with parameters', () => {
      const result = parser.parseEventHandler(
        'click',
        '$increment($counter, 1)',
        { line: 1, column: 1, index: 0 }
      );

      expect(result.eventName).toBe('click');
      expect(result.handlerFunction).toBe('$increment');
      expect(result.parameters).toEqual(['$counter', '1']);
      expect(result.isInline).toBe(true);
    });

    it('should parse event handler with multiple parameters', () => {
      const result = parser.parseEventHandler(
        'submit',
        '$handleSubmit($formData, $event, "test")',
        { line: 1, column: 1, index: 0 }
      );

      expect(result.eventName).toBe('submit');
      expect(result.handlerFunction).toBe('$handleSubmit');
      expect(result.parameters).toEqual(['$formData', '$event', '"test"']);
      expect(result.isInline).toBe(true);
    });

    it('should handle whitespace in parameters', () => {
      const result = parser.parseEventHandler(
        'change',
        '$handleChange( $value , $index )',
        { line: 1, column: 1, index: 0 }
      );

      expect(result.parameters).toEqual(['$value', '$index']);
    });

    it('should throw error for invalid handler format', () => {
      expect(() => {
        parser.parseEventHandler(
          'click',
          'handleClick', // Missing $ and ()
          { line: 1, column: 1, index: 0 }
        );
      }).toThrow('Invalid event handler expression');
    });

    it('should throw error for invalid event name', () => {
      expect(() => {
        parser.parseEventHandler(
          '', // Empty event name
          '$handleClick()',
          { line: 1, column: 1, index: 0 }
        );
      }).toThrow('Event name must be a non-empty string');
    });

    it('should warn for unsupported event names', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      parser.parseEventHandler(
        'customEvent',
        '$handleCustom()',
        { line: 1, column: 1, index: 0 }
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("'customEvent' is not a standard DOM event")
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('createEventBinding', () => {
    it('should create data binding node for event handler', () => {
      const eventInfo: EventHandlerInfo = {
        eventName: 'click',
        handlerFunction: '$handleClick',
        parameters: [],
        isInline: false,
        location: { line: 1, column: 1, index: 0 }
      };

      const binding = parser.createEventBinding(eventInfo);

      expect(binding.type).toBe('DataBinding');
      expect(binding.bindingType).toBe('event');
      expect(binding.source).toBe('$handleClick()');
      expect(binding.target).toBe('click');
      expect(binding.isReactive).toBe(false);
      expect(binding.updateStrategy).toBe('immediate');
    });

    it('should create binding with parameters', () => {
      const eventInfo: EventHandlerInfo = {
        eventName: 'submit',
        handlerFunction: '$handleSubmit',
        parameters: ['$data', 'true'],
        isInline: true,
        location: { line: 1, column: 1, index: 0 }
      };

      const binding = parser.createEventBinding(eventInfo);
      expect(binding.source).toBe('$handleSubmit($data, true)');
    });
  });

  describe('extractEventHandlers', () => {
    it('should extract single event handler', () => {
      const content = '<button click="$handleClick()">Click Me</button>';
      const handlers = parser.extractEventHandlers(content);

      expect(handlers).toHaveLength(1);
      expect(handlers[0].eventName).toBe('click');
      expect(handlers[0].handlerFunction).toBe('$handleClick');
    });

    it('should extract multiple event handlers', () => {
      const content = `
        <form submit="$handleSubmit($formData)">
          <input change="$handleChange($event)">
          <button click="$handleClick()" type="submit">Submit</button>
        </form>
      `;
      const handlers = parser.extractEventHandlers(content);

      expect(handlers).toHaveLength(3);
      expect(handlers[0].eventName).toBe('submit');
      expect(handlers[1].eventName).toBe('change');
      expect(handlers[2].eventName).toBe('click');
    });

    it('should handle different quote styles', () => {
      const content = `
        <div click='$handleClick()' dblclick="$handleDoubleClick()">
          Content
        </div>
      `;
      const handlers = parser.extractEventHandlers(content);

      expect(handlers).toHaveLength(2);
      expect(handlers[0].eventName).toBe('click');
      expect(handlers[1].eventName).toBe('dblclick');
    });

    it('should return empty array for content without handlers', () => {
      const content = '<div>No event handlers here</div>';
      const handlers = parser.extractEventHandlers(content);

      expect(handlers).toHaveLength(0);
    });
  });

  describe('validateEventHandler', () => {
    it('should validate correct event handler', () => {
      const eventInfo: EventHandlerInfo = {
        eventName: 'click',
        handlerFunction: '$handleClick',
        parameters: ['$param1', 'value'],
        isInline: true,
        location: { line: 1, column: 1, index: 0 }
      };

      const validation = parser.validateEventHandler(eventInfo);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing $ prefix', () => {
      const eventInfo: EventHandlerInfo = {
        eventName: 'click',
        handlerFunction: 'handleClick', // Missing $
        parameters: [],
        isInline: false,
        location: { line: 1, column: 1, index: 0 }
      };

      const validation = parser.validateEventHandler(eventInfo);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Handler function must start with $: handleClick');
    });

    it('should detect invalid function name format', () => {
      const eventInfo: EventHandlerInfo = {
        eventName: 'click',
        handlerFunction: '$handle-click', // Invalid character
        parameters: [],
        isInline: false,
        location: { line: 1, column: 1, index: 0 }
      };

      const validation = parser.validateEventHandler(eventInfo);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Invalid handler function name: $handle-click');
    });

    it('should detect invalid parameter format', () => {
      const eventInfo: EventHandlerInfo = {
        eventName: 'click',
        handlerFunction: '$handleClick',
        parameters: ['$invalid-param'], // Invalid character in parameter
        isInline: true,
        location: { line: 1, column: 1, index: 0 }
      };

      const validation = parser.validateEventHandler(eventInfo);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Invalid parameter format: $invalid-param');
    });
  });

  describe('generateFrameworkEventHandler', () => {
    const eventInfo: EventHandlerInfo = {
      eventName: 'click',
      handlerFunction: '$handleClick',
      parameters: [],
      isInline: false,
      location: { line: 1, column: 1, index: 0 }
    };

    const eventInfoWithParams: EventHandlerInfo = {
      eventName: 'submit',
      handlerFunction: '$handleSubmit',
      parameters: ['$data', 'true'],
      isInline: true,
      location: { line: 1, column: 1, index: 0 }
    };

    describe('React', () => {
      it('should generate React event handler without parameters', () => {
        const result = parser.generateFrameworkEventHandler(eventInfo, 'react');
        expect(result).toBe('onClick={handleClick}');
      });

      it('should generate React event handler with parameters', () => {
        const result = parser.generateFrameworkEventHandler(eventInfoWithParams, 'react');
        expect(result).toBe('onSubmit={() => handleSubmit(data, true)}');
      });
    });

    describe('Vue', () => {
      it('should generate Vue event handler without parameters', () => {
        const result = parser.generateFrameworkEventHandler(eventInfo, 'vue');
        expect(result).toBe('@click="handleClick"');
      });

      it('should generate Vue event handler with parameters', () => {
        const result = parser.generateFrameworkEventHandler(eventInfoWithParams, 'vue');
        expect(result).toBe('@submit="handleSubmit(data, true)"');
      });
    });

    describe('Svelte', () => {
      it('should generate Svelte event handler without parameters', () => {
        const result = parser.generateFrameworkEventHandler(eventInfo, 'svelte');
        expect(result).toBe('on:click={handleClick}');
      });

      it('should generate Svelte event handler with parameters', () => {
        const result = parser.generateFrameworkEventHandler(eventInfoWithParams, 'svelte');
        expect(result).toBe('on:submit={() => handleSubmit(data, true)}');
      });
    });

    it('should throw error for unsupported framework', () => {
      expect(() => {
        parser.generateFrameworkEventHandler(eventInfo, 'angular' as any);
      }).toThrow('Unsupported framework: angular');
    });
  });

  describe('utility methods', () => {
    it('should detect event handlers in content', () => {
      const contentWithHandlers = '<button click="$handleClick()">Click</button>';
      const contentWithoutHandlers = '<div>No handlers</div>';

      expect(parser.hasEventHandlers(contentWithHandlers)).toBe(true);
      expect(parser.hasEventHandlers(contentWithoutHandlers)).toBe(false);
    });

    it('should return supported events list', () => {
      const events = parser.getSupportedEvents();
      expect(events).toEqual(SUPPORTED_EVENTS);
      expect(events).toContain('click');
      expect(events).toContain('submit');
      expect(events).toContain('change');
    });
  });

  describe('edge cases', () => {
    it('should handle empty parameters gracefully', () => {
      const result = parser.parseEventHandler(
        'click',
        '$handleClick()',
        { line: 1, column: 1, index: 0 }
      );

      expect(result.parameters).toEqual([]);
    });

    it('should handle parameters with spaces', () => {
      const result = parser.parseEventHandler(
        'click',
        '$handleClick(  )',
        { line: 1, column: 1, index: 0 }
      );

      expect(result.parameters).toEqual([]);
    });

    it('should handle complex parameter expressions', () => {
      const result = parser.parseEventHandler(
        'click',
        '$handleClick($user.name, $items[0], "string value")',
        { line: 1, column: 1, index: 0 }
      );

      expect(result.parameters).toEqual(['$user.name', '$items[0]', '"string value"']);
    });

    it('should handle nested function calls in parameters', () => {
      const result = parser.parseEventHandler(
        'click',
        '$handleClick($getValue(), $transform($data))',
        { line: 1, column: 1, index: 0 }
      );

      expect(result.parameters).toEqual(['$getValue()', '$transform($data)']);
    });
  });
});