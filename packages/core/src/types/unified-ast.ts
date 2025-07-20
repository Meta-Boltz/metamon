/**
 * Unified AST structure that can represent both legacy and modern MTM syntax
 */

export interface SourceLocation {
  line: number;
  column: number;
  index: number;
}

export interface ASTNode {
  type: string;
  location?: SourceLocation;
}

/**
 * Type system interfaces
 */
export interface TypeInfo {
  baseType: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'function' | 'float' | 'any';
  nullable: boolean;
  generic?: TypeInfo[];
  properties?: Record<string, TypeInfo>;
  parameters?: TypeInfo[];
  returnType?: TypeInfo;
}

export interface TypeAnnotationNode extends ASTNode {
  type: 'TypeAnnotation';
  typeKind: 'primitive' | 'object' | 'array' | 'function' | 'generic';
  baseType: string;
  generics?: TypeAnnotationNode[];
  properties?: Record<string, TypeAnnotationNode>;
  parameters?: TypeAnnotationNode[];
  returnType?: TypeAnnotationNode;
}

/**
 * Expression nodes
 */
export interface ExpressionNode extends ASTNode {
  type: 'Expression' | 'Literal' | 'Identifier' | 'CallExpression' | 'MemberExpression' | 'ArrowFunctionExpression' | 'ArrayExpression' | 'ObjectExpression';
}

export interface LiteralNode extends ExpressionNode {
  type: 'Literal';
  value: string | number | boolean | null;
  raw: string;
}

export interface IdentifierNode extends ExpressionNode {
  type: 'Identifier';
  name: string;
}

export interface CallExpressionNode extends ExpressionNode {
  type: 'CallExpression';
  callee: ExpressionNode;
  arguments: ExpressionNode[];
}

export interface MemberExpressionNode extends ExpressionNode {
  type: 'MemberExpression';
  object: ExpressionNode;
  property: ExpressionNode;
  computed: boolean;
}

export interface ArrowFunctionExpressionNode extends ExpressionNode {
  type: 'ArrowFunctionExpression';
  parameters: ParameterNode[];
  body: BlockStatementNode | ExpressionNode;
  async: boolean;
  returnType?: TypeAnnotationNode;
}

export interface ArrayExpressionNode extends ExpressionNode {
  type: 'ArrayExpression';
  elements: (ExpressionNode | null)[];
}

export interface ObjectExpressionNode extends ExpressionNode {
  type: 'ObjectExpression';
  properties: PropertyNode[];
}

export interface PropertyNode extends ASTNode {
  type: 'Property';
  key: ExpressionNode;
  value: ExpressionNode;
  kind: 'init' | 'get' | 'set';
  method: boolean;
  shorthand: boolean;
  computed: boolean;
}

/**
 * Variable declaration nodes
 */
export interface VariableDeclarationNode extends ASTNode {
  type: 'VariableDeclaration';
  name: string;
  hasDollarPrefix: boolean;
  hasReactiveSuffix: boolean;
  typeAnnotation?: TypeAnnotationNode;
  initializer: ExpressionNode;
  inferredType?: TypeInfo;
  scope: 'local' | 'global';
  isReactive: boolean;
}

/**
 * Function declaration nodes
 */
export interface ParameterNode extends ASTNode {
  type: 'Parameter';
  name: string;
  typeAnnotation?: TypeAnnotationNode;
  defaultValue?: ExpressionNode;
  inferredType?: TypeInfo;
}

export interface FunctionDeclarationNode extends ASTNode {
  type: 'FunctionDeclaration';
  name: string;
  hasDollarPrefix: boolean;
  parameters: ParameterNode[];
  returnType?: TypeAnnotationNode;
  body: BlockStatementNode;
  isArrow: boolean;
  autoBindThis: boolean;
  async: boolean;
  inferredReturnType?: TypeInfo;
}

/**
 * Class declaration nodes
 */
export interface ClassPropertyNode extends ASTNode {
  type: 'ClassProperty';
  name: string;
  hasDollarPrefix: boolean;
  typeAnnotation?: TypeAnnotationNode;
  initializer?: ExpressionNode;
  isReactive: boolean;
  inferredType?: TypeInfo;
}

export interface ClassMethodNode extends ASTNode {
  type: 'ClassMethod';
  name: string;
  hasDollarPrefix: boolean;
  parameters: ParameterNode[];
  returnType?: TypeAnnotationNode;
  body: BlockStatementNode;
  isArrow: boolean;
  autoBindThis: boolean;
  async: boolean;
  kind: 'method' | 'constructor' | 'get' | 'set';
}

export interface ClassDeclarationNode extends ASTNode {
  type: 'ClassDeclaration';
  name: string;
  properties: ClassPropertyNode[];
  methods: ClassMethodNode[];
  constructor?: ClassMethodNode;
}

/**
 * Statement nodes
 */
export interface StatementNode extends ASTNode {
  type: 'Statement' | 'BlockStatement' | 'ExpressionStatement' | 'ReturnStatement' | 'IfStatement';
}

export interface BlockStatementNode extends StatementNode {
  type: 'BlockStatement';
  body: StatementNode[];
}

export interface ExpressionStatementNode extends StatementNode {
  type: 'ExpressionStatement';
  expression: ExpressionNode;
}

export interface ReturnStatementNode extends StatementNode {
  type: 'ReturnStatement';
  argument?: ExpressionNode;
}

export interface IfStatementNode extends StatementNode {
  type: 'IfStatement';
  test: ExpressionNode;
  consequent: StatementNode;
  alternate?: StatementNode;
}

/**
 * Template system nodes
 */
export interface TemplateNode extends ASTNode {
  type: 'Template';
  content: string;
  bindings: DataBindingNode[];
  expressions: TemplateExpressionNode[];
}

export interface DataBindingNode extends ASTNode {
  type: 'DataBinding';
  bindingType: 'variable' | 'expression' | 'event';
  source: string;
  target: string;
  isReactive: boolean;
  updateStrategy: 'immediate' | 'batched' | 'debounced';
}

export interface TemplateExpressionNode extends ASTNode {
  type: 'TemplateExpression';
  expression: ExpressionNode;
  raw: string;
}

/**
 * Reactive system nodes
 */
export interface ReactiveVariableNode extends VariableDeclarationNode {
  isReactive: true;
  updateTriggers: string[];
  dependencies: string[];
}

/**
 * Program node (root of AST)
 */
export interface ProgramNode extends ASTNode {
  type: 'Program';
  body: StatementNode[];
  frontmatter: any;
  syntaxVersion: 'legacy' | 'modern';
  modernFeatures?: {
    dollarPrefixVariables: boolean;
    reactiveVariables: boolean;
    enhancedTypeInference: boolean;
    optionalSemicolons: boolean;
    autoThisBinding: boolean;
  };
}

/**
 * Legacy AST representation (for backward compatibility)
 */
export interface LegacyAST {
  type: 'LegacyProgram';
  content: string;
  frontmatter: any;
  // Legacy AST can be extended as needed
}

/**
 * Modern AST representation
 */
export interface ModernAST extends ProgramNode {
  syntaxVersion: 'modern';
  modernFeatures: {
    dollarPrefixVariables: boolean;
    reactiveVariables: boolean;
    enhancedTypeInference: boolean;
    optionalSemicolons: boolean;
    autoThisBinding: boolean;
  };
}

/**
 * Unified AST that can represent both legacy and modern syntax
 */
export type UnifiedAST = ProgramNode | LegacyAST;

/**
 * AST visitor pattern interface
 */
export interface ASTVisitor {
  visitProgram?(node: ProgramNode): void;
  visitVariableDeclaration?(node: VariableDeclarationNode): void;
  visitFunctionDeclaration?(node: FunctionDeclarationNode): void;
  visitClassDeclaration?(node: ClassDeclarationNode): void;
  visitExpression?(node: ExpressionNode): void;
  visitStatement?(node: StatementNode): void;
  visitTemplate?(node: TemplateNode): void;
}

/**
 * AST transformation interface
 */
export interface ASTTransformer {
  transform(ast: UnifiedAST): UnifiedAST;
  transformNode(node: ASTNode): ASTNode;
}