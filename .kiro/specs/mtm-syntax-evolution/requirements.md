# Requirements Document

## Introduction

The MTM (MetaMon) syntax needs to evolve to become more modern, intuitive, and developer-friendly while maintaining its core reactive programming capabilities. This feature focuses on simplifying variable declarations, improving type inference, enhancing function syntax, and introducing reactive variables with cleaner template integration. The goal is to create a syntax that feels familiar to JavaScript/TypeScript developers while adding powerful reactive features that make UI development more efficient.

## Requirements

### Requirement 1

**User Story:** As a developer, I want to use a simplified variable declaration syntax with the $ prefix, so that I can write cleaner code with better type inference.

#### Acceptance Criteria

1. WHEN I declare a variable with `$a = 42` THEN the system SHALL infer the type as number automatically
2. WHEN I declare a variable with explicit type `$a: number = 42` THEN the system SHALL enforce the specified type
3. WHEN I declare a string variable `$name: string = "Thinh"` THEN the system SHALL validate string type assignment
4. IF I assign a value of wrong type to an explicitly typed variable THEN the system SHALL show a type error
5. WHEN I use $ prefix for variables THEN the system SHALL distinguish them from regular JavaScript variables

### Requirement 2

**User Story:** As a developer, I want to write functions with simplified arrow syntax and automatic type inference, so that I can create functions more efficiently.

#### Acceptance Criteria

1. WHEN I write `$sum = (a, b) => a + b` THEN the system SHALL infer parameter and return types automatically
2. WHEN I write `$sum: (a: number, b: number): number => a + b` THEN the system SHALL enforce explicit type annotations
3. WHEN I define async functions with `$fetchData = async (url) => {...}` THEN the system SHALL handle async/await syntax properly
4. WHEN I use arrow functions THEN the system SHALL automatically bind `this` context in class methods
5. IF function parameters don't match expected types THEN the system SHALL provide clear error messages

### Requirement 3

**User Story:** As a developer, I want reactive variables that automatically update the UI, so that I can build dynamic interfaces without manual DOM manipulation.

#### Acceptance Criteria

1. WHEN I declare `$counter! = 0` THEN the system SHALL create a reactive variable that triggers UI updates
2. WHEN I modify a reactive variable with `$counter++` THEN the system SHALL automatically update all UI elements that reference it
3. WHEN reactive variables change THEN the system SHALL batch updates for performance optimization
4. WHEN I use reactive variables in templates THEN the system SHALL establish automatic data binding
5. IF a reactive variable is used in multiple components THEN the system SHALL update all instances simultaneously

### Requirement 4

**User Story:** As a developer, I want clean template syntax with automatic data binding, so that I can create dynamic UIs with minimal boilerplate.

#### Acceptance Criteria

1. WHEN I write `<h1>Hello, {{$name}}</h1>` THEN the system SHALL bind the variable to the template and update automatically
2. WHEN I write `<button click="$increment()">Click Me</button>` THEN the system SHALL bind the event handler properly
3. WHEN template variables change THEN the system SHALL update only the affected DOM elements
4. WHEN I use expressions in templates THEN the system SHALL evaluate them reactively
5. IF template syntax is invalid THEN the system SHALL provide helpful error messages with line numbers

### Requirement 5

**User Story:** As a developer, I want enhanced class syntax with automatic method binding, so that I can write object-oriented code without worrying about `this` context issues.

#### Acceptance Criteria

1. WHEN I define class properties with `$name: string` THEN the system SHALL create properly typed instance variables
2. WHEN I write arrow methods like `$greet = () => \`Hi, I'm ${this.$name}\`` THEN the system SHALL automatically bind `this` context
3. WHEN I create class constructors THEN the system SHALL support parameter assignment to instance variables
4. WHEN I use class methods in event handlers THEN the system SHALL maintain proper `this` binding
5. IF class property types don't match assignments THEN the system SHALL show compilation errors

### Requirement 6

**User Story:** As a developer, I want flexible type system with optional inference and explicit annotations, so that I can choose the right level of type safety for my code.

#### Acceptance Criteria

1. WHEN I write `$price = 199.99` THEN the system SHALL infer the type as number automatically
2. WHEN I write `$price: float = 199.99` THEN the system SHALL support explicit float type annotation
3. WHEN type inference is ambiguous THEN the system SHALL provide helpful suggestions for explicit typing
4. WHEN I mix inferred and explicit types THEN the system SHALL maintain type consistency across the codebase
5. IF type annotations conflict with assigned values THEN the system SHALL show clear error messages

### Requirement 7

**User Story:** As a developer, I want optional semicolons and clean syntax rules, so that I can write code that looks modern and readable.

#### Acceptance Criteria

1. WHEN I write code without semicolons THEN the system SHALL parse it correctly using automatic semicolon insertion
2. WHEN I include semicolons explicitly THEN the system SHALL accept them without errors
3. WHEN there's ambiguity in statement termination THEN the system SHALL provide clear guidance
4. WHEN I format code THEN the system SHALL maintain consistent style preferences
5. IF syntax is ambiguous without semicolons THEN the system SHALL suggest where semicolons are needed