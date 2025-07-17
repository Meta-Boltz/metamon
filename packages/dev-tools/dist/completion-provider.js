import { CompletionItemKind, InsertTextFormat } from 'vscode-languageserver/node';
import { MTMFileParser } from './mtm-parser';
export class MTMCompletionProvider {
    constructor() {
        this.parser = new MTMFileParser();
    }
    provideCompletions(document, position) {
        const text = document.getText();
        const offset = document.offsetAt(position);
        // Check if we're in frontmatter
        if (!this.parser.getFrontmatterPosition(text, position.line, position.character)) {
            return this.provideContentCompletions(text, position);
        }
        // Get YAML path for frontmatter completions
        const yamlPath = this.parser.getYamlPath(text, position.line, position.character);
        return this.provideFrontmatterCompletions(yamlPath, text, position);
    }
    provideFrontmatterCompletions(yamlPath, text, position) {
        const completions = [];
        if (yamlPath.length === 0) {
            // Root level completions
            completions.push({
                label: 'target',
                kind: CompletionItemKind.Property,
                detail: 'Target framework for the component',
                documentation: 'Specify which framework this component targets: reactjs, vue, solid, or svelte',
                insertText: 'target: ',
                insertTextFormat: InsertTextFormat.PlainText
            }, {
                label: 'channels',
                kind: CompletionItemKind.Property,
                detail: 'Event channels for pub/sub communication',
                documentation: 'Define event channels for cross-framework communication',
                insertText: 'channels:\n  - event: ${1:eventName}\n    emit: ${2:functionName}',
                insertTextFormat: InsertTextFormat.Snippet
            }, {
                label: 'route',
                kind: CompletionItemKind.Property,
                detail: 'Route path for page components',
                documentation: 'Define the route path for this page component',
                insertText: 'route: /${1:path}',
                insertTextFormat: InsertTextFormat.Snippet
            }, {
                label: 'layout',
                kind: CompletionItemKind.Property,
                detail: 'Layout component to wrap this component',
                documentation: 'Specify a layout component to wrap this component',
                insertText: 'layout: ${1:layoutName}',
                insertTextFormat: InsertTextFormat.Snippet
            });
        }
        else if (yamlPath[0] === 'target') {
            // Target framework completions
            const frameworks = ['reactjs', 'vue', 'solid', 'svelte'];
            frameworks.forEach(framework => {
                completions.push({
                    label: framework,
                    kind: CompletionItemKind.Value,
                    detail: `Target ${framework} framework`,
                    documentation: this.getFrameworkDocumentation(framework),
                    insertText: framework,
                    insertTextFormat: InsertTextFormat.PlainText
                });
            });
        }
        else if (yamlPath[0] === 'channels') {
            // Channel completions
            completions.push({
                label: 'event',
                kind: CompletionItemKind.Property,
                detail: 'Event name to listen for',
                documentation: 'Name of the event this component will listen for',
                insertText: 'event: ${1:eventName}',
                insertTextFormat: InsertTextFormat.Snippet
            }, {
                label: 'emit',
                kind: CompletionItemKind.Property,
                detail: 'Function name to call when event is received',
                documentation: 'Name of the function to call when the event is received',
                insertText: 'emit: ${1:functionName}',
                insertTextFormat: InsertTextFormat.Snippet
            });
        }
        return completions;
    }
    provideContentCompletions(text, position) {
        const completions = [];
        try {
            const parsed = this.parser.parse(text, 'current');
            const target = parsed.frontmatter.target;
            if (target) {
                completions.push(...this.getFrameworkSpecificCompletions(target));
            }
            // Add Metamon-specific completions
            completions.push(...this.getMetamonCompletions());
        }
        catch (error) {
            // If parsing fails, provide basic completions
            completions.push(...this.getBasicCompletions());
        }
        return completions;
    }
    getFrameworkSpecificCompletions(target) {
        const completions = [];
        switch (target) {
            case 'reactjs':
                completions.push({
                    label: 'useState',
                    kind: CompletionItemKind.Function,
                    detail: 'React useState hook',
                    documentation: 'React hook for managing component state',
                    insertText: 'const [${1:state}, set${1/(.*)/${1:/capitalize}/}] = useState(${2:initialValue});',
                    insertTextFormat: InsertTextFormat.Snippet
                }, {
                    label: 'useEffect',
                    kind: CompletionItemKind.Function,
                    detail: 'React useEffect hook',
                    documentation: 'React hook for side effects',
                    insertText: 'useEffect(() => {\n  ${1:// effect code}\n}, [${2:dependencies}]);',
                    insertTextFormat: InsertTextFormat.Snippet
                });
                break;
            case 'vue':
                completions.push({
                    label: 'ref',
                    kind: CompletionItemKind.Function,
                    detail: 'Vue ref function',
                    documentation: 'Vue Composition API ref for reactive values',
                    insertText: 'const ${1:value} = ref(${2:initialValue});',
                    insertTextFormat: InsertTextFormat.Snippet
                }, {
                    label: 'reactive',
                    kind: CompletionItemKind.Function,
                    detail: 'Vue reactive function',
                    documentation: 'Vue Composition API reactive for reactive objects',
                    insertText: 'const ${1:state} = reactive(${2:initialState});',
                    insertTextFormat: InsertTextFormat.Snippet
                });
                break;
            case 'solid':
                completions.push({
                    label: 'createSignal',
                    kind: CompletionItemKind.Function,
                    detail: 'Solid createSignal function',
                    documentation: 'Solid.js signal for reactive state',
                    insertText: 'const [${1:value}, set${1/(.*)/${1:/capitalize}/}] = createSignal(${2:initialValue});',
                    insertTextFormat: InsertTextFormat.Snippet
                }, {
                    label: 'createEffect',
                    kind: CompletionItemKind.Function,
                    detail: 'Solid createEffect function',
                    documentation: 'Solid.js effect for side effects',
                    insertText: 'createEffect(() => {\n  ${1:// effect code}\n});',
                    insertTextFormat: InsertTextFormat.Snippet
                });
                break;
            case 'svelte':
                completions.push({
                    label: 'writable',
                    kind: CompletionItemKind.Function,
                    detail: 'Svelte writable store',
                    documentation: 'Svelte writable store for reactive state',
                    insertText: 'const ${1:store} = writable(${2:initialValue});',
                    insertTextFormat: InsertTextFormat.Snippet
                }, {
                    label: 'onMount',
                    kind: CompletionItemKind.Function,
                    detail: 'Svelte onMount lifecycle',
                    documentation: 'Svelte lifecycle function called when component mounts',
                    insertText: 'onMount(() => {\n  ${1:// mount code}\n});',
                    insertTextFormat: InsertTextFormat.Snippet
                });
                break;
        }
        return completions;
    }
    getMetamonCompletions() {
        return [
            {
                label: 'useMetamonSignal',
                kind: CompletionItemKind.Function,
                detail: 'Metamon cross-framework signal hook',
                documentation: 'Hook for accessing Metamon signals across frameworks',
                insertText: 'const [${1:value}, set${1/(.*)/${1:/capitalize}/}] = useMetamonSignal("${2:signalKey}", ${3:initialValue});',
                insertTextFormat: InsertTextFormat.Snippet
            },
            {
                label: 'useMetamonPubSub',
                kind: CompletionItemKind.Function,
                detail: 'Metamon pub/sub hook',
                documentation: 'Hook for accessing Metamon pub/sub system',
                insertText: 'const { emit, subscribe } = useMetamonPubSub();',
                insertTextFormat: InsertTextFormat.Snippet
            },
            {
                label: 'MetamonRouter',
                kind: CompletionItemKind.Class,
                detail: 'Metamon router for navigation',
                documentation: 'Router for navigating between Metamon pages',
                insertText: 'MetamonRouter.navigate("${1:/path}");',
                insertTextFormat: InsertTextFormat.Snippet
            }
        ];
    }
    getBasicCompletions() {
        return [
            {
                label: 'export default',
                kind: CompletionItemKind.Keyword,
                detail: 'Default export',
                documentation: 'Export a default component',
                insertText: 'export default function ${1:ComponentName}() {\n  ${2:// component code}\n}',
                insertTextFormat: InsertTextFormat.Snippet
            }
        ];
    }
    getFrameworkDocumentation(framework) {
        const docs = {
            reactjs: 'React.js - A JavaScript library for building user interfaces',
            vue: 'Vue.js - The Progressive JavaScript Framework',
            solid: 'Solid.js - Simple and performant reactivity for building user interfaces',
            svelte: 'Svelte - Cybernetically enhanced web apps'
        };
        return docs[framework] || '';
    }
    resolveCompletion(item) {
        // Add additional details or documentation if needed
        return item;
    }
}
