import { MTMFile } from './mtm-parser';

export interface ValidationError {
  message: string;
  offset?: number;
  length?: number;
  suggestions?: string[];
}

export class MTMValidator {
  private readonly supportedFrameworks = ['reactjs', 'vue', 'solid', 'svelte'];
  private readonly requiredChannelFields = ['event', 'emit'];

  validate(mtmFile: MTMFile): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate frontmatter structure
    if (mtmFile.frontmatter) {
      errors.push(...this.validateFrontmatter(mtmFile.frontmatter));
    }

    // Validate content based on target framework
    if (mtmFile.frontmatter.target) {
      errors.push(...this.validateContent(mtmFile.content, mtmFile.frontmatter.target));
    }

    return errors;
  }

  private validateFrontmatter(frontmatter: any): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate target framework
    if (frontmatter.target) {
      if (!this.supportedFrameworks.includes(frontmatter.target)) {
        errors.push({
          message: `Unsupported target framework: ${frontmatter.target}`,
          suggestions: [
            `Supported frameworks are: ${this.supportedFrameworks.join(', ')}`,
            'Consider using one of the supported frameworks'
          ]
        });
      }
    }

    // Validate channels
    if (frontmatter.channels) {
      if (!Array.isArray(frontmatter.channels)) {
        errors.push({
          message: 'Channels must be an array',
          suggestions: ['Use array syntax: channels: [{ event: "eventName", emit: "functionName" }]']
        });
      } else {
        frontmatter.channels.forEach((channel: any, index: number) => {
          errors.push(...this.validateChannel(channel, index));
        });
      }
    }

    // Validate route
    if (frontmatter.route) {
      if (typeof frontmatter.route !== 'string') {
        errors.push({
          message: 'Route must be a string',
          suggestions: ['Use string syntax: route: "/path/to/page"']
        });
      } else if (!frontmatter.route.startsWith('/')) {
        errors.push({
          message: 'Route must start with "/"',
          suggestions: ['Use absolute path syntax: route: "/path/to/page"']
        });
      }
    }

    // Validate layout
    if (frontmatter.layout && typeof frontmatter.layout !== 'string') {
      errors.push({
        message: 'Layout must be a string',
        suggestions: ['Use string syntax: layout: "layoutName"']
      });
    }

    return errors;
  }

  private validateChannel(channel: any, index: number): ValidationError[] {
    const errors: ValidationError[] = [];

    if (typeof channel !== 'object' || channel === null) {
      errors.push({
        message: `Channel ${index} must be an object`,
        suggestions: ['Use object syntax: { event: "eventName", emit: "functionName" }']
      });
      return errors;
    }

    // Check required fields
    for (const field of this.requiredChannelFields) {
      if (!channel[field]) {
        errors.push({
          message: `Channel ${index} is missing required field: ${field}`,
          suggestions: [`Add ${field} field to channel configuration`]
        });
      } else if (typeof channel[field] !== 'string') {
        errors.push({
          message: `Channel ${index} field ${field} must be a string`,
          suggestions: [`Use string value for ${field}`]
        });
      }
    }

    // Validate event name format
    if (channel.event && typeof channel.event === 'string') {
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(channel.event)) {
        errors.push({
          message: `Channel ${index} event name "${channel.event}" is invalid`,
          suggestions: [
            'Event names must start with a letter and contain only letters, numbers, and underscores',
            'Example: "userLogin", "dataUpdate", "form_submit"'
          ]
        });
      }
    }

    // Validate emit function name format
    if (channel.emit && typeof channel.emit === 'string') {
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(channel.emit)) {
        errors.push({
          message: `Channel ${index} emit function name "${channel.emit}" is invalid`,
          suggestions: [
            'Function names must start with a letter and contain only letters, numbers, and underscores',
            'Example: "onUserLogin", "handleDataUpdate", "on_form_submit"'
          ]
        });
      }
    }

    return errors;
  }

  private validateContent(content: string, target: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Basic content validation based on framework
    switch (target) {
      case 'reactjs':
        errors.push(...this.validateReactContent(content));
        break;
      case 'vue':
        errors.push(...this.validateVueContent(content));
        break;
      case 'solid':
        errors.push(...this.validateSolidContent(content));
        break;
      case 'svelte':
        errors.push(...this.validateSvelteContent(content));
        break;
    }

    return errors;
  }

  private validateReactContent(content: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for React import
    if (!content.includes('import React') && !content.includes('import { ') && !content.includes('import * as React')) {
      errors.push({
        message: 'React components should import React',
        suggestions: [
          'Add: import React from "react";',
          'Or: import { useState, useEffect } from "react";'
        ]
      });
    }

    // Check for export default
    if (!content.includes('export default')) {
      errors.push({
        message: 'React components should have a default export',
        suggestions: ['Add: export default function ComponentName() { ... }']
      });
    }

    return errors;
  }

  private validateVueContent(content: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for Vue composition API or options API structure
    const hasCompositionAPI = content.includes('setup(') || content.includes('<script setup');
    const hasOptionsAPI = content.includes('export default {');

    if (!hasCompositionAPI && !hasOptionsAPI) {
      errors.push({
        message: 'Vue components should use either Composition API or Options API',
        suggestions: [
          'Use Composition API: <script setup> or setup() function',
          'Use Options API: export default { ... }'
        ]
      });
    }

    return errors;
  }

  private validateSolidContent(content: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for Solid import
    if (!content.includes('solid-js')) {
      errors.push({
        message: 'Solid components should import from solid-js',
        suggestions: [
          'Add: import { createSignal, createEffect } from "solid-js";'
        ]
      });
    }

    return errors;
  }

  private validateSvelteContent(content: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Svelte has less strict requirements, but we can check for common patterns
    if (content.includes('export default')) {
      errors.push({
        message: 'Svelte components should not use export default',
        suggestions: [
          'Use named exports or component script without default export'
        ]
      });
    }

    return errors;
  }
}