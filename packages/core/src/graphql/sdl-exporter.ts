/**
 * SDL Exporter
 * 
 * Exports a GraphQL schema as SDL (Schema Definition Language) string.
 */

import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLList,
  GraphQLNonNull,
} from 'graphql';

/**
 * Export a GraphQL schema as SDL (Schema Definition Language)
 * 
 * @param schema - The GraphQL schema to export
 * @param options - Optional configuration for SDL export
 * @returns The SDL string representation of the schema
 * 
 * @example
 * ```typescript
 * import { generateGraphQLSchema } from '@betterbase/core/graphql/schema-generator';
 * import { exportSDL } from '@betterbase/core/graphql/sdl-exporter';
 * 
 * const schema = generateGraphQLSchema({ users, posts });
 * const sdl = exportSDL(schema);
 * 
 * console.log(sdl);
 * // Will output the complete SDL representation
 * ```
 */
export function exportSDL(
  schema: GraphQLSchema,
  options: {
    /** Include description comments (default: true) */
    includeDescriptions?: boolean;
    /** Use comment syntax for descriptions (default: true) */
    useCommentSyntax?: boolean;
    /** Sort types alphabetically (default: false) */
    sortTypes?: boolean;
  } = {}
): string {
  const {
    includeDescriptions = true,
    useCommentSyntax = true,
    sortTypes = false,
  } = options;

  // Helper to convert Maybe<string> to string | undefined
  const toString = (val: string | null | undefined): string | undefined => val ?? undefined;

  const lines: string[] = [];

  // Helper to format descriptions
  const formatDescription = (description: string | null | undefined, indent: string = ''): string => {
    if (!includeDescriptions || !description) return '';
    
    if (useCommentSyntax) {
      return `${indent}# ${description}\n`;
    }
    return `${indent}\"\"\"\n${indent}${description}\n${indent}\"\"\"\n`;
  };

  // Helper to format type references
  const formatType = (type: unknown, indent: string = ''): string => {
    if (type instanceof GraphQLNonNull) {
      return `${formatType(type.ofType, indent)}!`;
    }
    if (type instanceof GraphQLList) {
      return `[${formatType(type.ofType, indent)}]`;
    }
    if (type instanceof GraphQLScalarType) {
      return type.name;
    }
    if (type instanceof GraphQLObjectType) {
      return type.name;
    }
    if (type instanceof GraphQLInputObjectType) {
      return type.name;
    }
    if (type instanceof GraphQLEnumType) {
      return type.name;
    }
    if (type instanceof GraphQLInterfaceType) {
      return type.name;
    }
    if (type instanceof GraphQLUnionType) {
      return type.name;
    }
    return 'Unknown';
  };

  // Get all types from schema
  const types = sortTypes
    ? Object.values(schema.getTypeMap()).sort((a, b) => a.name.localeCompare(b.name))
    : Object.values(schema.getTypeMap());

  // Filter and process types
  const objectTypes = types.filter(
    (t) => t instanceof GraphQLObjectType && !t.name.startsWith('__')
  ) as GraphQLObjectType[];

  const inputTypes = types.filter(
    (t) => t instanceof GraphQLInputObjectType && !t.name.startsWith('__')
  ) as GraphQLInputObjectType[];

  const enumTypes = types.filter(
    (t) => t instanceof GraphQLEnumType && !t.name.startsWith('__')
  ) as GraphQLEnumType[];

  const scalarTypes = types.filter(
    (t) => t instanceof GraphQLScalarType && 
           !t.name.startsWith('__') && 
           !['String', 'Int', 'Float', 'Boolean', 'ID'].includes(t.name)
  ) as GraphQLScalarType[];

  const interfaceTypes = types.filter(
    (t) => t instanceof GraphQLInterfaceType && !t.name.startsWith('__')
  ) as GraphQLInterfaceType[];

  const unionTypes = types.filter(
    (t) => t instanceof GraphQLUnionType && !t.name.startsWith('__')
  ) as GraphQLUnionType[];

  // Start output
  lines.push('# GraphQL Schema');
  lines.push(`# Generated at: ${new Date().toISOString()}`);
  lines.push('');

  // Custom scalars
  if (scalarTypes.length > 0) {
    lines.push('# Custom Scalar Types');
    for (const scalar of scalarTypes) {
      lines.push(formatDescription(toString(scalar.description)));
      lines.push(`scalar ${scalar.name}`);
      lines.push('');
    }
  }

  // Enum types
  if (enumTypes.length > 0) {
    lines.push('# Enum Types');
    for (const enumType of enumTypes) {
      lines.push(formatDescription(toString(enumType.description)));
      lines.push(`enum ${enumType.name} {`);
      for (const value of enumType.getValues()) {
        lines.push(formatDescription(toString(value.description), '  '));
        lines.push(`  ${value.name}`);
      }
      lines.push('}');
      lines.push('');
    }
  }

  // Interface types
  if (interfaceTypes.length > 0) {
    lines.push('# Interface Types');
    for (const interfaceType of interfaceTypes) {
      lines.push(formatDescription(toString(interfaceType.description)));
      const interfaces = interfaceType.getInterfaces();
      const interfaceStr = interfaces.length > 0 
        ? ` implements ${interfaces.map((i) => i.name).join(' & ')}` 
        : '';
      lines.push(`interface ${interfaceType.name}${interfaceStr} {`);
      
      const fields = interfaceType.getFields();
      for (const field of Object.values(fields)) {
        lines.push(formatDescription(toString(field.description), '  '));
        const args = field.args.length > 0 
          ? `(${field.args.map((a: any) => `${a.name}: ${formatType(a.type)}`).join(', ')})`
          : '';
        lines.push(`  ${field.name}${args}: ${formatType(field.type)}`);
      }
      lines.push('}');
      lines.push('');
    }
  }

  // Union types
  if (unionTypes.length > 0) {
    lines.push('# Union Types');
    for (const unionType of unionTypes) {
      lines.push(formatDescription(toString(unionType.description)));
      const types = unionType.getTypes().map((t) => t.name).join(' | ');
      lines.push(`union ${unionType.name} = ${types}`);
      lines.push('');
    }
  }

  // Input types
  if (inputTypes.length > 0) {
    lines.push('# Input Types');
    for (const inputType of inputTypes) {
      lines.push(formatDescription(toString(inputType.description)));
      lines.push(`input ${inputType.name} {`);
      
      const fields = inputType.getFields();
      for (const field of Object.values(fields)) {
        lines.push(formatDescription(toString(field.description), '  '));
        lines.push(`  ${field.name}: ${formatType(field.type)}`);
      }
      lines.push('}');
      lines.push('');
    }
  }

  // Object types (excluding Query, Mutation, Subscription)
  const regularObjectTypes = objectTypes.filter(
    (t) => t.name !== 'Query' && t.name !== 'Mutation' && t.name !== 'Subscription'
  );
  
  if (regularObjectTypes.length > 0) {
    lines.push('# Object Types');
    for (const objectType of regularObjectTypes) {
      lines.push(formatDescription(toString(objectType.description)));
      const interfaces = objectType.getInterfaces();
      const interfaceStr = interfaces.length > 0 
        ? ` implements ${interfaces.map((i) => i.name).join(' & ')}` 
        : '';
      lines.push(`type ${objectType.name}${interfaceStr} {`);
      
      const fields = objectType.getFields();
      for (const field of Object.values(fields)) {
        lines.push(formatDescription(toString(field.description), '  '));
        const args = field.args.length > 0 
          ? `(${field.args.map((a: any) => `${a.name}: ${formatType(a.type)}`).join(', ')})`
          : '';
        lines.push(`  ${field.name}${args}: ${formatType(field.type)}`);
      }
      lines.push('}');
      lines.push('');
    }
  }

  // Query type
  const queryType = schema.getQueryType();
  if (queryType) {
    lines.push('# Query Type');
    lines.push(formatDescription(toString(queryType.description)));
    lines.push(`type Query {`);
    
    const queryFields = queryType.getFields();
    for (const field of Object.values(queryFields)) {
      lines.push(formatDescription(toString(field.description), '  '));
      const args = field.args.length > 0 
        ? `(${field.args.map((a: any) => `${a.name}: ${formatType(a.type)}`).join(', ')})`
        : '';
      lines.push(`  ${field.name}${args}: ${formatType(field.type)}`);
    }
    lines.push('}');
    lines.push('');
  }

  // Mutation type
  const mutationType = schema.getMutationType();
  if (mutationType) {
    lines.push('# Mutation Type');
    lines.push(formatDescription(toString(mutationType.description)));
    lines.push(`type Mutation {`);
    
    const mutationFields = mutationType.getFields();
    for (const field of Object.values(mutationFields)) {
      lines.push(formatDescription(toString(field.description), '  '));
      const args = field.args.length > 0 
        ? `(${field.args.map((a: any) => `${a.name}: ${formatType(a.type)}`).join(', ')})`
        : '';
      lines.push(`  ${field.name}${args}: ${formatType(field.type)}`);
    }
    lines.push('}');
    lines.push('');
  }

  // Subscription type
  const subscriptionType = schema.getSubscriptionType();
  if (subscriptionType) {
    lines.push('# Subscription Type');
    lines.push(formatDescription(toString(subscriptionType.description)));
    lines.push(`type Subscription {`);
    
    const subscriptionFields = subscriptionType.getFields();
    for (const field of Object.values(subscriptionFields)) {
      lines.push(formatDescription(toString(field.description), '  '));
      const args = field.args.length > 0 
        ? `(${field.args.map((a: any) => `${a.name}: ${formatType(a.type)}`).join(', ')})`
        : '';
      lines.push(`  ${field.name}${args}: ${formatType(field.type)}`);
    }
    lines.push('}');
    lines.push('');
  }

  // Join all lines and clean up extra whitespace
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Export a specific type from the schema as SDL
 * 
 * @param schema - The GraphQL schema
 * @param typeName - The name of the type to export
 * @param options - Optional configuration for SDL export
 * @returns The SDL string representation of the type
 */
export function exportTypeSDL(
  schema: GraphQLSchema,
  typeName: string,
  options: {
    includeDescriptions?: boolean;
    useCommentSyntax?: boolean;
  } = {}
): string {
  const type = schema.getType(typeName);
  
  if (!type) {
    throw new Error(`Type "${typeName}" not found in schema`);
  }

  // Helper to convert Maybe<string> to string | undefined
  const toString = (val: string | null | undefined): string | undefined => val ?? undefined;

  // For single type export, we create a minimal schema
  const lines: string[] = [];
  
  const formatDescription = (description: string | null | undefined, indent: string = ''): string => {
    if (!options.includeDescriptions || !description) return '';
    if (options.useCommentSyntax !== false) {
      return `${indent}# ${description}\n`;
    }
    return `${indent}\"\"\"\n${indent}${description}\n${indent}\"\"\"\n`;
  };

  const formatType = (type: unknown): string => {
    if (type instanceof GraphQLNonNull) {
      return `${formatType(type.ofType)}!`;
    }
    if (type instanceof GraphQLList) {
      return `[${formatType(type.ofType)}]`;
    }
    if (type instanceof GraphQLScalarType || 
        type instanceof GraphQLObjectType || 
        type instanceof GraphQLInputObjectType ||
        type instanceof GraphQLEnumType) {
      return type.name;
    }
    return 'Unknown';
  };

  if (type instanceof GraphQLObjectType || type instanceof GraphQLInputObjectType) {
    const name = type.name;
    lines.push(formatDescription(toString(type.description)));
    
    if (type instanceof GraphQLInputObjectType) {
      lines.push(`input ${name} {`);
    } else {
      lines.push(`type ${name} {`);
    }
    
    const fields = type.getFields();
    for (const field of Object.values(fields)) {
      lines.push(formatDescription(toString(field.description), '  '));
      const args = field.args.length > 0 
        ? `(${field.args.map((a: any) => `${a.name}: ${formatType(a.type)}`).join(', ')})`
        : '';
      lines.push(`  ${field.name}${args}: ${formatType(field.type)}`);
    }
    lines.push('}');
  } else if (type instanceof GraphQLEnumType) {
    lines.push(formatDescription(toString(type.description)));
    lines.push(`enum ${type.name} {`);
    for (const value of type.getValues()) {
      lines.push(formatDescription(toString(value.description), '  '));
      lines.push(`  ${value.name}`);
    }
    lines.push('}');
  } else if (type instanceof GraphQLScalarType) {
    lines.push(formatDescription(toString(type.description)));
    lines.push(`scalar ${type.name}`);
  } else {
    throw new Error(`Type "${typeName}" is not an exportable type`);
  }

  return lines.join('\n').trim();
}

/**
 * Save SDL to a file
 * 
 * @param schema - The GraphQL schema
 * @param filePath - The path to save the SDL
 * @param options - Optional configuration for SDL export
 */
export async function saveSDL(
  schema: GraphQLSchema,
  filePath: string,
  options?: {
    includeDescriptions?: boolean;
    useCommentSyntax?: boolean;
    sortTypes?: boolean;
  }
): Promise<void> {
  const sdl = exportSDL(schema, options);
  
  // Dynamic import for file system operations
  const { writeFile } = await import('fs/promises');
  await writeFile(filePath, sdl, 'utf-8');
}
