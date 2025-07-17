/**
 * MTM Compiler - Compiles .mtm files to framework-specific components
 */

import * as yaml from 'yaml';
import { CompilationError } from '../error-handling/compilation-error.js';

export interface MTMFrontmatter {
  target: 'reactjs' | 'vue' | 'solid' | 'svelte';
  channels?: Array<{
    event: string;
    emit: string;
  }>;
  props?: Record<string, string>;
  styles?: string[];
}

export interface MTMFile {
  frontmatter: MTMFrontmatter;
  content: string;
  filePath: string;
}

export interface CompilationResult {
  code: string;
  framework: string;
  dependencies: string[];
  exports: string[];
}

/**
 * Parses .mtm files and extracts frontmatter + content
 */
export class MTMParser {
  static parse(content: string, filePath: string): MTMFile {
    try {
      // Split frontmatter and content
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      
      if (!frontmatterMatch) {
        throw CompilationError.frontmatter(
          'Invalid .mtm file format. Expected frontmatter section with --- delimiters.',
          filePath
        );
      }

      const [, frontmatterYaml, componentContent] = frontmatterMatch;
      
      // Parse YAML frontmatter
      let frontmatter: MTMFrontmatter;
      try {
        frontmatter = yaml.parse(frontmatterYaml) as MTMFrontmatter;
      } catch (yamlError) {
        throw CompilationError.frontmatter(
          `Invalid YAML in frontmatter: ${yamlError instanceof Error ? yamlError.message : 'Unknown error'}`,
          filePath
        );
      }

      // Validate frontmatter
      this.validateFrontmatter(frontmatter, filePath);

      return {
        frontmatter,
        content: componentContent.trim(),
        filePath
      };
    } catch (error) {
      if (error instanceof CompilationError) {
        throw error;
      }
      throw CompilationError.syntax(
        `Failed to parse .mtm file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath
      );
    }
  }

  private static validateFrontmatter(frontmatter: MTMFrontmatter, filePath: string): void {
    const validTargets = ['reactjs', 'vue', 'solid', 'svelte'];
    
    if (!frontmatter.target) {
      throw CompilationError.frontmatter(
        'Missing required "target" field in frontmatter',
        filePath
      );
    }

    if (!validTargets.includes(frontmatter.target)) {
      throw CompilationError.frontmatter(
        `Invalid target "${frontmatter.target}". Must be one of: ${validTargets.join(', ')}`,
        filePath,
        [`Use one of: ${validTargets.join(', ')}`]
      );
    }

    // Validate channels if present
    if (frontmatter.channels) {
      for (const channel of frontmatter.channels) {
        if (!channel.event || !channel.emit) {
          throw CompilationError.frontmatter(
            'Channel configuration must have both "event" and "emit" fields',
            filePath,
            ['Example: { event: "user-action", emit: "onUserAction" }']
          );
        }
      }
    }
  }
}

/**
 * Compiles .mtm files to framework-specific components
 */
export class MTMCompiler {
  private adapters: Map<string, FrameworkAdapter> = new Map();

  constructor() {
    // Initialize framework adapters
    this.adapters.set('reactjs', new ReactMTMAdapter());
    this.adapters.set('vue', new VueMTMAdapter());
    this.adapters.set('solid', new SolidMTMAdapter());
    this.adapters.set('svelte', new SvelteMTMAdapter());
  }

  compile(mtmFile: MTMFile): CompilationResult {
    const adapter = this.adapters.get(mtmFile.frontmatter.target);
    
    if (!adapter) {
      throw CompilationError.framework(
        `No adapter found for target framework: ${mtmFile.frontmatter.target}`,
        mtmFile.filePath,
        mtmFile.frontmatter.target
      );
    }

    try {
      return adapter.compile(mtmFile);
    } catch (error) {
      throw CompilationError.framework(
        `Compilation failed for ${mtmFile.frontmatter.target}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        mtmFile.filePath,
        mtmFile.frontmatter.target,
        error instanceof Error ? error : undefined
      );
    }
  }
}

/**
 * Base class for framework adapters
 */
abstract class FrameworkAdapter {
  abstract compile(mtmFile: MTMFile): CompilationResult;

  protected extractImports(content: string): { imports: string[], cleanContent: string } {
    const importRegex = /^import\s+.*?from\s+['"][^'"]+['"];?\s*$/gm;
    const imports: string[] = [];
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[0].trim());
    }

    const cleanContent = content.replace(importRegex, '').trim();
    return { imports, cleanContent };
  }

  protected generateEventHandlers(channels: MTMFrontmatter['channels'] = []): string {
    return channels.map(channel => `
  const ${channel.emit} = (data) => {
    const { emit } = usePubSub();
    emit('${channel.event}', data);
  };`).join('\n');
  }

  protected convertTemplateCall(content: string, framework: string): string {
    // Find template() calls and convert them
    const templateRegex = /template\s*\(\s*`([^`]*)`\s*\)/gs;
    
    return content.replace(templateRegex, (match, templateContent) => {
      return this.compileTemplate(templateContent, framework);
    });
  }

  protected abstract compileTemplate(template: string, framework: string): string;
}

/**
 * React MTM Adapter
 */
class ReactMTMAdapter extends FrameworkAdapter {
  compile(mtmFile: MTMFile): CompilationResult {
    const { imports, cleanContent } = this.extractImports(mtmFile.content);
    const eventHandlers = this.generateEventHandlers(mtmFile.frontmatter.channels);
    
    // Convert template calls to JSX
    const processedContent = this.convertTemplateCall(cleanContent, 'react');
    
    const reactImports = [
      "import React from 'react';",
      "import { useSignal, usePubSub } from '@metamon/runtime';",
      ...imports
    ];

    const code = `${reactImports.join('\n')}

${processedContent}${eventHandlers}`;

    return {
      code,
      framework: 'react',
      dependencies: ['react', '@metamon/runtime'],
      exports: ['default']
    };
  }

  protected compileTemplate(template: string, framework: string): string {
    // Convert universal template to JSX
    let jsxTemplate = template;
    
    // Convert {{variable}} to {variable}
    jsxTemplate = jsxTemplate.replace(/\{\{([^}]+)\}\}/g, '{$1}');
    
    // Convert event handlers
    jsxTemplate = jsxTemplate.replace(/onclick="([^"]+)"/g, 'onClick={$1}');
    jsxTemplate = jsxTemplate.replace(/oninput="([^"]+)"/g, 'onInput={$1}');
    jsxTemplate = jsxTemplate.replace(/onkeyup="([^"]+)"/g, 'onKeyUp={$1}');
    
    // Convert class to className
    jsxTemplate = jsxTemplate.replace(/class="/g, 'className="');
    
    // Convert conditional rendering
    jsxTemplate = jsxTemplate.replace(/\{\{#if\s+([^}]+)\}\}/g, '{$1 && (');
    jsxTemplate = jsxTemplate.replace(/\{\{\/if\}\}/g, ')}');
    jsxTemplate = jsxTemplate.replace(/\{\{else\}\}/g, ') : (');
    
    // Convert loops
    jsxTemplate = jsxTemplate.replace(/\{\{#each\s+([^}]+)\s+as\s+([^}]+)\}\}/g, '{$1.map($2 => (');
    jsxTemplate = jsxTemplate.replace(/\{\{\/each\}\}/g, '))}');
    
    // Wrap in return statement
    return `return (\n    ${jsxTemplate.trim()}\n  );`;
  }
}

/**
 * Vue MTM Adapter
 */
class VueMTMAdapter extends FrameworkAdapter {
  compile(mtmFile: MTMFile): CompilationResult {
    const { imports, cleanContent } = this.extractImports(mtmFile.content);
    const eventHandlers = this.generateEventHandlers(mtmFile.frontmatter.channels);
    
    // Extract template from template() call
    const templateMatch = cleanContent.match(/template\s*\(\s*`([^`]*)`\s*\)/s);
    const templateContent = templateMatch ? templateMatch[1] : '';
    
    // Extract script content (everything except template call)
    const scriptContent = cleanContent.replace(/return\s+template\s*\(\s*`[^`]*`\s*\)\s*;?/s, '').trim();
    
    const vueTemplate = this.compileTemplate(templateContent, 'vue');
    
    const vueImports = [
      "import { useSignal, usePubSub } from '@metamon/runtime';",
      ...imports
    ];

    const code = `<template>
${vueTemplate}
</template>

<script setup>
${vueImports.join('\n')}

${scriptContent}${eventHandlers}
</script>`;

    return {
      code,
      framework: 'vue',
      dependencies: ['vue', '@metamon/runtime'],
      exports: ['default']
    };
  }

  protected compileTemplate(template: string, framework: string): string {
    let vueTemplate = template;
    
    // Convert {{variable}} to {{ variable }}
    vueTemplate = vueTemplate.replace(/\{\{([^}]+)\}\}/g, '{{ $1 }}');
    
    // Convert event handlers
    vueTemplate = vueTemplate.replace(/onclick="([^"]+)"/g, '@click="$1"');
    vueTemplate = vueTemplate.replace(/oninput="([^"]+)"/g, '@input="$1"');
    vueTemplate = vueTemplate.replace(/onkeyup="([^"]+)"/g, '@keyup="$1"');
    
    // Convert conditional rendering
    vueTemplate = vueTemplate.replace(/\{\{#if\s+([^}]+)\}\}/g, '<template v-if="$1">');
    vueTemplate = vueTemplate.replace(/\{\{\/if\}\}/g, '</template>');
    vueTemplate = vueTemplate.replace(/\{\{else\}\}/g, '</template><template v-else>');
    
    // Convert loops
    vueTemplate = vueTemplate.replace(/\{\{#each\s+([^}]+)\s+as\s+([^}]+)\}\}/g, '<template v-for="$2 in $1" :key="$2.id || $2">');
    vueTemplate = vueTemplate.replace(/\{\{\/each\}\}/g, '</template>');
    
    return vueTemplate.trim();
  }
}

/**
 * Solid MTM Adapter
 */
class SolidMTMAdapter extends FrameworkAdapter {
  compile(mtmFile: MTMFile): CompilationResult {
    const { imports, cleanContent } = this.extractImports(mtmFile.content);
    const eventHandlers = this.generateEventHandlers(mtmFile.frontmatter.channels);
    
    const processedContent = this.convertTemplateCall(cleanContent, 'solid');
    
    const solidImports = [
      "import { useSignal, usePubSub } from '@metamon/runtime';",
      ...imports
    ];

    const code = `${solidImports.join('\n')}

${processedContent}${eventHandlers}`;

    return {
      code,
      framework: 'solid',
      dependencies: ['solid-js', '@metamon/runtime'],
      exports: ['default']
    };
  }

  protected compileTemplate(template: string, framework: string): string {
    let solidTemplate = template;
    
    // Convert {{variable}} to {variable()}
    solidTemplate = solidTemplate.replace(/\{\{([^}]+)\}\}/g, '{$1}');
    
    // Convert event handlers
    solidTemplate = solidTemplate.replace(/onclick="([^"]+)"/g, 'onClick={$1}');
    solidTemplate = solidTemplate.replace(/oninput="([^"]+)"/g, 'onInput={$1}');
    solidTemplate = solidTemplate.replace(/onkeyup="([^"]+)"/g, 'onKeyUp={$1}');
    
    // Convert conditional rendering
    solidTemplate = solidTemplate.replace(/\{\{#if\s+([^}]+)\}\}/g, '<Show when={$1}>');
    solidTemplate = solidTemplate.replace(/\{\{\/if\}\}/g, '</Show>');
    solidTemplate = solidTemplate.replace(/\{\{else\}\}/g, '</Show><Show when={!($1)}>');
    
    // Convert loops
    solidTemplate = solidTemplate.replace(/\{\{#each\s+([^}]+)\s+as\s+([^}]+)\}\}/g, '<For each={$1}>{$2 => (');
    solidTemplate = solidTemplate.replace(/\{\{\/each\}\}/g, ')}</For>');
    
    return `return (\n    ${solidTemplate.trim()}\n  );`;
  }
}

/**
 * Svelte MTM Adapter
 */
class SvelteMTMAdapter extends FrameworkAdapter {
  compile(mtmFile: MTMFile): CompilationResult {
    const { imports, cleanContent } = this.extractImports(mtmFile.content);
    const eventHandlers = this.generateEventHandlers(mtmFile.frontmatter.channels);
    
    // Extract template from template() call
    const templateMatch = cleanContent.match(/template\s*\(\s*`([^`]*)`\s*\)/s);
    const templateContent = templateMatch ? templateMatch[1] : '';
    
    // Extract script content
    const scriptContent = cleanContent.replace(/return\s+template\s*\(\s*`[^`]*`\s*\)\s*;?/s, '').trim();
    
    const svelteTemplate = this.compileTemplate(templateContent, 'svelte');
    
    const svelteImports = [
      "import { useSignal, usePubSub } from '@metamon/runtime';",
      ...imports
    ];

    const code = `<script>
${svelteImports.join('\n')}

${scriptContent}${eventHandlers}
</script>

${svelteTemplate}`;

    return {
      code,
      framework: 'svelte',
      dependencies: ['svelte', '@metamon/runtime'],
      exports: ['default']
    };
  }

  protected compileTemplate(template: string, framework: string): string {
    let svelteTemplate = template;
    
    // Convert {{variable}} to {variable}
    svelteTemplate = svelteTemplate.replace(/\{\{([^}]+)\}\}/g, '{$1}');
    
    // Convert event handlers
    svelteTemplate = svelteTemplate.replace(/onclick="([^"]+)"/g, 'on:click={$1}');
    svelteTemplate = svelteTemplate.replace(/oninput="([^"]+)"/g, 'on:input={$1}');
    svelteTemplate = svelteTemplate.replace(/onkeyup="([^"]+)"/g, 'on:keyup={$1}');
    
    // Convert conditional rendering
    svelteTemplate = svelteTemplate.replace(/\{\{#if\s+([^}]+)\}\}/g, '{#if $1}');
    svelteTemplate = svelteTemplate.replace(/\{\{\/if\}\}/g, '{/if}');
    svelteTemplate = svelteTemplate.replace(/\{\{else\}\}/g, '{:else}');
    
    // Convert loops
    svelteTemplate = svelteTemplate.replace(/\{\{#each\s+([^}]+)\s+as\s+([^}]+)\}\}/g, '{#each $1 as $2}');
    svelteTemplate = svelteTemplate.replace(/\{\{\/each\}\}/g, '{/each}');
    
    return svelteTemplate.trim();
  }
}