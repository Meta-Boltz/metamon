/**
 * Type inference engine for MTM modern syntax
 */

import type { 
  ExpressionNode, 
  LiteralNode, 
  IdentifierNode, 
  TypeInfo, 
  TypeAnnotationNode,
  VariableDeclarationNode
} from './unified-ast.js';

// Re-export TypeInfo for external use
export type { TypeInfo } from './unified-ast.js';

/**
 * Type conflict information
 */
export interface TypeConflict {
  expected: TypeInfo;
  actual: TypeInfo;
  location?: { line: number; column: number; index: number };
  message: string;
}

/**
 * Type inference result
 */
export interface TypeInferenceResult {
  inferredType: TypeInfo;
  conflicts: TypeConflict[];
  suggestions: string[];
}

/**
 * Type validation result
 */
export interface TypeValidationResult {
  isValid: boolean;
  conflicts: TypeConflict[];
  warnings: string[];
}

/**
 * Enhanced type inference engine
 */
export class TypeInferenceEngine {
  private variableTypes: Map<string, TypeInfo> = new Map();

  /**
   * Infer type from expression with enhanced logic
   */
  inferType(expression: ExpressionNode): TypeInferenceResult {
    const conflicts: TypeConflict[] = [];
    const suggestions: string[] = [];

    let inferredType: TypeInfo;

    switch (expression.type) {
      case 'Literal':
        inferredType = this.inferLiteralType(expression as LiteralNode);
        break;
      
      case 'Identifier':
        const result = this.inferIdentifierType(expression as IdentifierNode);
        inferredType = result.type;
        if (result.suggestion) {
          suggestions.push(result.suggestion);
        }
        break;
      
      case 'ArrayExpression':
        const arrayResult = this.inferArrayType(expression as any);
        inferredType = arrayResult.type;
        suggestions.push(...arrayResult.suggestions);
        break;
      
      case 'ObjectExpression':
        const objectResult = this.inferObjectType(expression as any);
        inferredType = objectResult.type;
        suggestions.push(...objectResult.suggestions);
        break;
      
      case 'CallExpression':
        const callResult = this.inferCallExpressionType(expression as any);
        inferredType = callResult.type;
        suggestions.push(...callResult.suggestions);
        break;
      
      default:
        inferredType = { baseType: 'any', nullable: false };
        suggestions.push(`Unable to infer type for expression of type '${expression.type}'. Consider adding explicit type annotation.`);
    }

    return {
      inferredType,
      conflicts,
      suggestions
    };
  }

  /**
   * Infer type from literal values
   */
  private inferLiteralType(literal: LiteralNode): TypeInfo {
    if (typeof literal.value === 'string') {
      return { baseType: 'string', nullable: false };
    } else if (typeof literal.value === 'number') {
      // Check if it's a float by examining the raw token if available
      const isFloat = literal.raw ? literal.raw.includes('.') : (literal.value % 1 !== 0);
      return { baseType: isFloat ? 'float' : 'number', nullable: false };
    } else if (typeof literal.value === 'boolean') {
      return { baseType: 'boolean', nullable: false };
    } else if (literal.value === null) {
      return { baseType: 'any', nullable: true };
    }
    
    return { baseType: 'any', nullable: false };
  }

  /**
   * Infer type from identifier (variable reference)
   */
  private inferIdentifierType(identifier: IdentifierNode): { type: TypeInfo; suggestion?: string } {
    const varName = identifier.name.startsWith('$') ? identifier.name.substring(1) : identifier.name;
    
    if (this.variableTypes.has(varName)) {
      return { type: this.variableTypes.get(varName)! };
    }
    
    return {
      type: { baseType: 'any', nullable: false },
      suggestion: `Variable '${identifier.name}' is not defined. Consider declaring it first.`
    };
  }

  /**
   * Validate explicit type annotation against inferred type
   */
  validateTypeAnnotation(
    explicitType: TypeAnnotationNode,
    inferredType: TypeInfo,
    variableName: string
  ): TypeValidationResult {
    const conflicts: TypeConflict[] = [];
    const warnings: string[] = [];

    // Check if explicit type matches inferred type
    if (explicitType.baseType !== inferredType.baseType) {
      // Special case: number and float compatibility
      if ((explicitType.baseType === 'number' && inferredType.baseType === 'float') ||
          (explicitType.baseType === 'float' && inferredType.baseType === 'number')) {
        warnings.push(`Variable '${variableName}': Explicit type '${explicitType.baseType}' is compatible with inferred type '${inferredType.baseType}'`);
      } else {
        conflicts.push({
          expected: { baseType: explicitType.baseType as any, nullable: false },
          actual: inferredType,
          location: explicitType.location,
          message: `Type conflict for variable '${variableName}': explicit type '${explicitType.baseType}' does not match inferred type '${inferredType.baseType}'`
        });
      }
    }

    return {
      isValid: conflicts.length === 0,
      conflicts,
      warnings
    };
  }

  /**
   * Register a variable type for future reference
   */
  registerVariable(name: string, type: TypeInfo): void {
    this.variableTypes.set(name, type);
  }

  /**
   * Get registered variable type
   */
  getVariableType(name: string): TypeInfo | undefined {
    return this.variableTypes.get(name);
  }

  /**
   * Detect and resolve type conflicts
   */
  resolveTypeConflicts(conflicts: TypeConflict[]): string[] {
    const resolutions: string[] = [];

    for (const conflict of conflicts) {
      if (conflict.expected.baseType === 'number' && conflict.actual.baseType === 'float') {
        resolutions.push(`Consider changing type annotation from 'number' to 'float' for better precision`);
      } else if (conflict.expected.baseType === 'float' && conflict.actual.baseType === 'number') {
        resolutions.push(`Consider changing the value to include decimal places (e.g., '42.0') or change type to 'number'`);
      } else if (conflict.expected.baseType === 'string' && conflict.actual.baseType === 'any') {
        resolutions.push(`Consider adding quotes around the value to make it a string literal`);
      } else {
        resolutions.push(`Change either the type annotation to '${conflict.actual.baseType}' or the value to match type '${conflict.expected.baseType}'`);
      }
    }

    return resolutions;
  }

  /**
   * Infer type from array expression
   */
  private inferArrayType(arrayExpr: any): { type: TypeInfo; suggestions: string[] } {
    const suggestions: string[] = [];
    
    if (!arrayExpr.elements || arrayExpr.elements.length === 0) {
      suggestions.push('Empty array detected. Consider adding explicit type annotation for better type safety.');
      return {
        type: { baseType: 'array', nullable: false, generic: [{ baseType: 'any', nullable: false }] },
        suggestions
      };
    }

    // Infer element types
    const elementTypes: TypeInfo[] = [];
    for (const element of arrayExpr.elements) {
      if (element) {
        const elementResult = this.inferType(element);
        elementTypes.push(elementResult.inferredType);
        suggestions.push(...elementResult.suggestions);
      }
    }

    // Determine common element type
    const commonType = this.findCommonType(elementTypes);
    if (commonType.baseType === 'any' && elementTypes.length > 1) {
      suggestions.push('Mixed array element types detected. Consider using explicit type annotation or ensuring all elements have the same type.');
    }

    return {
      type: { baseType: 'array', nullable: false, generic: [commonType] },
      suggestions
    };
  }

  /**
   * Infer type from object expression
   */
  private inferObjectType(objectExpr: any): { type: TypeInfo; suggestions: string[] } {
    const suggestions: string[] = [];
    const properties: Record<string, TypeInfo> = {};

    if (!objectExpr.properties || objectExpr.properties.length === 0) {
      suggestions.push('Empty object detected. Consider adding explicit type annotation for better type safety.');
      return {
        type: { baseType: 'object', nullable: false, properties },
        suggestions
      };
    }

    // Infer property types
    for (const prop of objectExpr.properties) {
      if (prop.key && prop.value) {
        const keyName = prop.key.name || prop.key.value;
        const valueResult = this.inferType(prop.value);
        properties[keyName] = valueResult.inferredType;
        suggestions.push(...valueResult.suggestions);
      }
    }

    return {
      type: { baseType: 'object', nullable: false, properties },
      suggestions
    };
  }

  /**
   * Infer type from call expression (function calls)
   */
  private inferCallExpressionType(callExpr: any): { type: TypeInfo; suggestions: string[] } {
    const suggestions: string[] = [];

    // For now, we can't infer return types without function definitions
    // This would be enhanced when function parsing is implemented
    suggestions.push('Function call detected. Return type inference requires function definition analysis. Consider adding explicit type annotation.');

    return {
      type: { baseType: 'any', nullable: false },
      suggestions
    };
  }

  /**
   * Find common type among multiple types
   */
  private findCommonType(types: TypeInfo[]): TypeInfo {
    if (types.length === 0) {
      return { baseType: 'any', nullable: false };
    }

    if (types.length === 1) {
      return types[0];
    }

    // Check if all types are the same
    const firstType = types[0];
    const allSame = types.every(type => 
      type.baseType === firstType.baseType && type.nullable === firstType.nullable
    );

    if (allSame) {
      return firstType;
    }

    // Check for number/float compatibility
    const allNumeric = types.every(type => 
      type.baseType === 'number' || type.baseType === 'float'
    );

    if (allNumeric) {
      const hasFloat = types.some(type => type.baseType === 'float');
      return { 
        baseType: hasFloat ? 'float' : 'number', 
        nullable: types.some(type => type.nullable) 
      };
    }

    // If types are mixed, return any
    return { 
      baseType: 'any', 
      nullable: types.some(type => type.nullable) 
    };
  }

  /**
   * Generate type hints for ambiguous cases
   */
  generateTypeHints(expression: ExpressionNode, context?: string): string[] {
    const hints: string[] = [];
    const result = this.inferType(expression);

    if (result.inferredType.baseType === 'any') {
      hints.push(`Consider adding explicit type annotation for ${context || 'this expression'}`);
      
      if (expression.type === 'Identifier') {
        hints.push(`If this is a variable, make sure it's declared with a $ prefix for modern syntax`);
      }
    }

    if (result.inferredType.baseType === 'array' && result.inferredType.generic?.[0]?.baseType === 'any') {
      hints.push(`Array with mixed or unknown element types. Consider: Array<string> | Array<number> | etc.`);
    }

    if (result.inferredType.baseType === 'object' && Object.keys(result.inferredType.properties || {}).length === 0) {
      hints.push(`Empty object type. Consider defining an interface or using Record<string, any>`);
    }

    hints.push(...result.suggestions);
    return hints;
  }

  /**
   * Check type consistency across multiple variables
   */
  checkTypeConsistency(variables: Array<{ name: string; type: TypeInfo }>): string[] {
    const warnings: string[] = [];
    const typeGroups = new Map<string, string[]>();

    // Group variables by base type
    for (const variable of variables) {
      const baseType = variable.type.baseType;
      if (!typeGroups.has(baseType)) {
        typeGroups.set(baseType, []);
      }
      typeGroups.get(baseType)!.push(variable.name);
    }

    // Check for potential inconsistencies
    if (typeGroups.has('number') && typeGroups.has('float')) {
      warnings.push(`Mixed number types detected. Variables using 'number': ${typeGroups.get('number')?.join(', ')}. Variables using 'float': ${typeGroups.get('float')?.join(', ')}. Consider standardizing on one type.`);
    }

    if (typeGroups.has('any') && typeGroups.size > 1) {
      warnings.push(`Variables with 'any' type detected: ${typeGroups.get('any')?.join(', ')}. Consider adding explicit types for better type safety.`);
    }

    return warnings;
  }

  /**
   * Clear all registered variable types (useful for testing)
   */
  clear(): void {
    this.variableTypes.clear();
  }
}