// MTM File types
export type {
  MTMFile,
  ValidationResult,
  FileParser
} from './types/mtm-file.js';

// MTM Parser implementation
export { MTMParser } from './parser/mtm-parser.js';

// Enhanced MTM Parser with modern syntax support
export { 
  EnhancedMTMParser,
  type SyntaxVersion,
  type ModernSyntaxFeatures,
  type EnhancedMTMFile
} from './parser/enhanced-mtm-parser.js';

// Unified AST types for modern syntax support
export type {
  UnifiedAST,
  ProgramNode,
  VariableDeclarationNode,
  FunctionDeclarationNode,
  ClassDeclarationNode,
  ReactiveVariableNode,
  TypeInfo,
  TypeAnnotationNode,
  ASTVisitor,
  ASTTransformer
} from './types/unified-ast.js';

// Compiler types
export type {
  CompilationResult,
  Channel,
  FrameworkCompiler,
  CompilationError as ICompilationError
} from './types/compiler.js';

// PubSub types
export type {
  EventListener,
  PubSubSystem,
  EventSubscription
} from './types/pubsub.js';

// Signal types
export type {
  Signal,
  SignalManager,
  SignalCallback
} from './types/signals.js';

// Signal implementations
export {
  MetamonSignal,
  MetamonSignalManager,
  signalManager
} from './signals/index.js';

// PubSub implementations
export {
  MetamonPubSub,
  pubSubSystem
} from './pubsub/index.js';

// Router types
export type {
  RouteInfo,
  RouteChangeCallback,
  MetamonRouter,
  RouteRegistration
} from './types/router.js';

// Router implementation
export {
  MetamonRouterImpl,
  metamonRouter
} from './router/index.js';

// Import resolver types and implementation
export type {
  ImportResolver,
  ImportResolverConfig,
  MTMDependency,
  MTMFileInfo,
  DependencyGraph,
  ImportResolutionResult
} from './types/import-resolver.js';

export {
  MTMImportResolver
} from './import-resolver/index.js';

// Error handling and debugging
export {
  CompilationError,
  ErrorHandler,
  errorHandler,
  MTMSourceMapGenerator,
  DebugTools,
  DebugSession
} from './error-handling/index.js';

export type {
  DebugInfo
} from './error-handling/index.js';

// Runtime exports
export {
  MetamonRuntime,
  Signal as RuntimeSignal,
  PubSubAPI,
  ComponentTemplate
} from './runtime/metamon-runtime.js';

// MTM Compiler exports
export {
  MTMParser as MTMFileParser,
  MTMCompiler,
  MTMFrontmatter
} from './compiler/mtm-compiler.js';

// Framework-specific runtime adapters (exported separately to avoid conflicts)
export * as ReactRuntime from './runtime/adapters/react-runtime.js';
export * as VueRuntime from './runtime/adapters/vue-runtime.js';
export * as SolidRuntime from './runtime/adapters/solid-runtime.js';
export * as SvelteRuntime from './runtime/adapters/svelte-runtime.js';