/**
 * GraphQL Schema Generator
 *
 * Auto-generates GraphQL schema from Drizzle ORM schema.
 * Creates types, queries, mutations, and subscriptions for each table.
 */

import type { AnyColumn, AnyTable } from "drizzle-orm";
import {
	GraphQLBoolean,
	GraphQLFieldConfig,
	type GraphQLFieldConfigArgumentMap,
	type GraphQLFieldConfigMap,
	GraphQLID,
	GraphQLInputObjectType,
	type GraphQLInputObjectTypeConfig,
	GraphQLInt,
	GraphQLList,
	GraphQLNonNull,
	GraphQLObjectType,
	GraphQLObjectTypeConfig,
	GraphQLScalarType,
	GraphQLSchema,
	type GraphQLSchemaConfig,
	GraphQLString,
} from "graphql";

/**
 * Type for Drizzle table objects - using a generic approach to avoid type issues
 */
type DrizzleTable = {
	name: string;
	columns: Record<string, AnyColumn>;
};

/**
 * Configuration for GraphQL generation
 */
export interface GraphQLGenerationConfig {
	/** Enable subscriptions (default: true) */
	subscriptions?: boolean;
	/** Enable mutations (default: true) */
	mutations?: boolean;
	/** Custom type mappings */
	typeMappings?: Record<string, string>;
	/** Prefix for generated types */
	typePrefix?: string;
}

/**
 * Default GraphQL configuration
 */
const defaultConfig: Required<GraphQLGenerationConfig> = {
	subscriptions: true,
	mutations: true,
	typeMappings: {},
	typePrefix: "",
};

/**
 * JSON Scalar type for GraphQL
 */
const GraphQLJSON = new GraphQLScalarType({
	name: "JSON",
	description: "Arbitrary JSON value",
	serialize: (value: unknown) => value,
	parseValue: (value: unknown) => value,
	parseLiteral: (ast: any) => {
		switch (ast.kind) {
			case "StringValue":
				return JSON.parse(ast.value || "null");
			case "IntValue":
				return Number.parseInt(ast.value || "0", 10);
			case "FloatValue":
				return Number.parseFloat(ast.value || "0");
			case "BooleanValue":
				return ast.value;
			default:
				return null;
		}
	},
});

/**
 * DateTime Scalar type for GraphQL
 */
const GraphQLDateTime = new GraphQLScalarType({
	name: "DateTime",
	description: "ISO 8601 DateTime string",
	serialize: (value: unknown) => (value instanceof Date ? value.toISOString() : value),
	parseValue: (value: unknown) => (typeof value === "string" ? new Date(value) : value),
	parseLiteral: (ast: any) => {
		if (ast.kind === "StringValue" && ast.value) {
			return new Date(ast.value);
		}
		return null;
	},
});

/**
 * Get the column type name from a Drizzle column
 */
function getColumnTypeName(column: AnyColumn): string {
	// Get the data type from the column
	const columnMap: Record<string, string> = {
		varchar: "varchar",
		text: "text",
		integer: "integer",
		boolean: "boolean",
		timestamp: "timestamp",
		uuid: "uuid",
		json: "json",
		jsonb: "jsonb",
		real: "real",
		double: "double",
		numeric: "numeric",
	};

	// Try to infer from the column constructor name
	const constructorName = column.constructor.name.toLowerCase();

	for (const [key, value] of Object.entries(columnMap)) {
		if (constructorName.includes(key)) {
			return value;
		}
	}

	return "text";
}

/**
 * Check if a column is not null
 */
function isNotNull(column: AnyColumn): boolean {
	return (column as unknown as { notNull: boolean }).notNull === true;
}

/**
 * Check if a column is a primary key
 */
function isPrimaryKey(column: AnyColumn): boolean {
	return (column as unknown as { primaryKey: boolean }).primaryKey === true;
}

/**
 * Get column mode (timestamp, json, etc.)
 */
function getColumnMode(column: AnyColumn): string | undefined {
	return (column as unknown as { mode?: string }).mode;
}

/**
 * Get column default value
 */
function getColumnDefault(column: AnyColumn): unknown {
	return (column as unknown as { default: unknown }).default;
}

/**
 * Type mapping from Drizzle column types to GraphQL types
 */
function getGraphQLType(column: AnyColumn): GraphQLScalarType {
	const typeName = getColumnTypeName(column);
	const mode = getColumnMode(column);

	// Handle timestamp mode
	if (mode === "timestamp") {
		return GraphQLDateTime;
	}

	// Handle JSON mode
	if (mode === "json" || mode === "jsonb") {
		return GraphQLJSON;
	}

	// Handle boolean mode
	if (mode === "boolean") {
		return GraphQLBoolean;
	}

	// Map based on column type
	switch (typeName) {
		case "integer":
		case "serial":
			return GraphQLInt;
		case "varchar":
		case "text":
			return GraphQLString;
		case "boolean":
			return GraphQLBoolean;
		case "uuid":
			return GraphQLID;
		case "timestamp":
		case "date":
			return GraphQLDateTime;
		case "json":
		case "jsonb":
			return GraphQLJSON;
		case "real":
		case "double":
		case "numeric":
			return GraphQLString;
		default:
			return GraphQLString;
	}
}

/**
 * PascalCase conversion helper
 */
function pascalCase(str: string): string {
	return str
		.replace(/[-_](.)/g, (_match, c) => c.toUpperCase())
		.replace(/^(.)/, (_match, c) => c.toUpperCase());
}

/**
 * Singularize a plural word (simple implementation)
 */
function singularize(str: string): string {
	// Handle common English plural forms
	if (str.endsWith("ies")) {
		return `${str.slice(0, -3)}y`;
	}
	if (str.endsWith("es") && str.length > 2) {
		// Don't singularize words like "status", "statuses" -> "statuse"
		if (!str.endsWith("ses")) {
			return str.slice(0, -2);
		}
	}
	if (str.endsWith("s") && str.length > 1) {
		return str.slice(0, -1);
	}
	return str;
}

/**
 * Get column name from Drizzle column
 */
function getColumnName(column: AnyColumn): string {
	// Get the column name from the column itself
	return (column as unknown as { name: string }).name;
}

/**
 * Information about a table for GraphQL generation
 */
interface TableInfo {
	name: string;
	columns: AnyColumn[];
	primaryKey: AnyColumn | null;
}

/**
 * Extract table info from a Drizzle table
 */
function extractTableInfo(table: DrizzleTable): TableInfo {
	const columns: AnyColumn[] = [];
	let primaryKey: AnyColumn | null = null;

	// Get the columns from the table
	const tableColumns = table.columns;

	for (const column of Object.values(tableColumns)) {
		columns.push(column);
		if (isPrimaryKey(column)) {
			primaryKey = column;
		}
	}

	return {
		name: table.name,
		columns,
		primaryKey,
	};
}

/**
 * Generate GraphQL Object Type from a table info
 */
function generateObjectType(
	tableInfo: TableInfo,
	config: Required<GraphQLGenerationConfig>,
): GraphQLObjectType {
	// Use singular name for the type (e.g., "users" -> "User")
	const typeName = config.typePrefix + singularize(pascalCase(tableInfo.name));

	const fieldsConfig: GraphQLFieldConfigMap<unknown, unknown> = {};

	for (const column of tableInfo.columns) {
		const columnName = getColumnName(column);
		const graphqlType = getGraphQLType(column);

		fieldsConfig[columnName] = {
			type: isNotNull(column) ? new GraphQLNonNull(graphqlType) : graphqlType,
			description: `Field ${columnName} of table ${tableInfo.name}`,
		};
	}

	return new GraphQLObjectType({
		name: typeName,
		description: `Auto-generated type for table ${tableInfo.name}`,
		fields: fieldsConfig,
	});
}

/**
 * Generate Create Input Type for a table
 */
function generateCreateInputType(
	tableInfo: TableInfo,
	config: Required<GraphQLGenerationConfig>,
): GraphQLInputObjectType {
	const inputName = `Create${config.typePrefix + singularize(pascalCase(tableInfo.name))}Input`;

	const fieldsConfig: GraphQLInputObjectTypeConfig["fields"] = {};

	for (const column of tableInfo.columns) {
		const columnName = getColumnName(column);
		const defaultValue = getColumnDefault(column);

		// Skip auto-generated fields like UUID and timestamps
		if (columnName === "id" && defaultValue !== undefined) {
			continue;
		}
		if (columnName === "createdAt" || columnName === "updatedAt") {
			continue;
		}

		const graphqlType = getGraphQLType(column);

		// For create, make required fields non-null, optional fields stay optional
		fieldsConfig[columnName] = {
			type: isNotNull(column) ? new GraphQLNonNull(graphqlType) : graphqlType,
		};
	}

	return new GraphQLInputObjectType({
		name: inputName,
		description: `Input for creating a ${tableInfo.name} record`,
		fields: fieldsConfig,
	});
}

/**
 * Generate Update Input Type for a table
 */
function generateUpdateInputType(
	tableInfo: TableInfo,
	config: Required<GraphQLGenerationConfig>,
): GraphQLInputObjectType {
	const inputName = `Update${config.typePrefix + singularize(pascalCase(tableInfo.name))}Input`;

	const fieldsConfig: GraphQLInputObjectTypeConfig["fields"] = {};

	for (const column of tableInfo.columns) {
		const columnName = getColumnName(column);
		const defaultValue = getColumnDefault(column);

		// Skip primary key and auto-generated fields
		if (isPrimaryKey(column)) {
			continue;
		}
		if (columnName === "id" && defaultValue !== undefined) {
			continue;
		}
		if (columnName === "createdAt") {
			continue;
		}

		const graphqlType = getGraphQLType(column);

		// All fields are optional for update
		fieldsConfig[columnName] = {
			type: graphqlType,
		};
	}

	return new GraphQLInputObjectType({
		name: inputName,
		description: `Input for updating a ${tableInfo.name} record`,
		fields: fieldsConfig,
	});
}

/**
 * Generate Where Input Type for filtering
 */
function generateWhereInputType(
	tableInfo: TableInfo,
	config: Required<GraphQLGenerationConfig>,
): GraphQLInputObjectType {
	const inputName = `${config.typePrefix + singularize(pascalCase(tableInfo.name))}WhereInput`;

	const fieldsConfig: GraphQLInputObjectTypeConfig["fields"] = {};

	for (const column of tableInfo.columns) {
		const columnName = getColumnName(column);
		const graphqlType = getGraphQLType(column);
		const typeName = getColumnTypeName(column);

		// Add eq (equals) filter
		fieldsConfig[`${columnName}Eq`] = {
			type: graphqlType,
		};

		// Add contains filter for string types
		if (typeName.includes("text") || typeName.includes("varchar")) {
			fieldsConfig[`${columnName}Contains`] = {
				type: GraphQLString,
			};
		}
	}

	return new GraphQLInputObjectType({
		name: inputName,
		description: `Filter input for ${tableInfo.name} queries`,
		fields: fieldsConfig,
	});
}

/**
 * Generate a GraphQL schema from a Drizzle schema
 *
 * @param tables - Object mapping table names to Drizzle table definitions
 * @param config - Optional configuration for GraphQL generation
 * @returns A complete GraphQL schema with queries, mutations, and optionally subscriptions
 *
 * @example
 * ```typescript
 * import { users, posts } from './db/schema';
 *
 * const schema = generateGraphQLSchema({
 *   users,
 *   posts,
 * }, {
 *   mutations: true,
 *   subscriptions: true,
 * });
 * ```
 */
export function generateGraphQLSchema(
	tables: Record<string, DrizzleTable>,
	config: GraphQLGenerationConfig = {},
): GraphQLSchema {
	const mergedConfig = { ...defaultConfig, ...config };

	// Extract table info from Drizzle tables
	const tableInfos: TableInfo[] = [];

	for (const [_tableName, table] of Object.entries(tables)) {
		tableInfos.push(extractTableInfo(table));
	}

	// Generate types
	const objectTypes: GraphQLObjectType[] = [];
	const createInputTypes: GraphQLInputObjectType[] = [];
	const updateInputTypes: GraphQLInputObjectType[] = [];
	const whereInputTypes: GraphQLInputObjectType[] = [];

	for (const tableInfo of tableInfos) {
		// Generate ObjectType
		objectTypes.push(generateObjectType(tableInfo, mergedConfig));

		// Generate CreateInput
		createInputTypes.push(generateCreateInputType(tableInfo, mergedConfig));

		// Generate UpdateInput
		updateInputTypes.push(generateUpdateInputType(tableInfo, mergedConfig));

		// Generate WhereInput
		whereInputTypes.push(generateWhereInputType(tableInfo, mergedConfig));
	}

	// Build query fields
	const queryFieldsConfig: GraphQLFieldConfigMap<unknown, unknown> = {};

	for (const tableInfo of tableInfos) {
		const typeName = mergedConfig.typePrefix + singularize(pascalCase(tableInfo.name));
		const typeRef = objectTypes.find((t) => t.name === typeName)!;

		// Get by ID query
		const pkColumn = tableInfo.primaryKey;
		const pkName = pkColumn ? getColumnName(pkColumn) : "id";

		queryFieldsConfig[tableInfo.name] = {
			type: typeRef,
			args: {
				[pkName]: { type: new GraphQLNonNull(GraphQLID) },
			} as GraphQLFieldConfigArgumentMap,
		};

		// List query
		queryFieldsConfig[`${tableInfo.name}List`] = {
			type: new GraphQLList(typeRef),
			args: {
				limit: { type: GraphQLInt },
				offset: { type: GraphQLInt },
				filter: { type: GraphQLJSON },
			} as GraphQLFieldConfigArgumentMap,
		};
	}

	// Build mutation fields
	const mutationFieldsConfig: GraphQLFieldConfigMap<unknown, unknown> = {};

	if (mergedConfig.mutations) {
		for (const tableInfo of tableInfos) {
			const typeName = mergedConfig.typePrefix + singularize(pascalCase(tableInfo.name));
			const typeRef = objectTypes.find((t) => t.name === typeName)!;
			const createInputName = `Create${mergedConfig.typePrefix + singularize(pascalCase(tableInfo.name))}Input`;
			const updateInputName = `Update${mergedConfig.typePrefix + singularize(pascalCase(tableInfo.name))}Input`;

			const createInput = createInputTypes.find((t) => t.name === createInputName)!;
			const updateInput = updateInputTypes.find((t) => t.name === updateInputName)!;

			const pkColumn = tableInfo.primaryKey;
			const pkName = pkColumn ? getColumnName(pkColumn) : "id";

			// Create mutation
			mutationFieldsConfig[`create${singularize(pascalCase(tableInfo.name))}`] = {
				type: typeRef,
				args: {
					input: { type: new GraphQLNonNull(createInput) },
				} as GraphQLFieldConfigArgumentMap,
			};

			// Update mutation
			mutationFieldsConfig[`update${singularize(pascalCase(tableInfo.name))}`] = {
				type: typeRef,
				args: {
					id: { type: new GraphQLNonNull(GraphQLID) },
					input: { type: new GraphQLNonNull(updateInput) },
				} as GraphQLFieldConfigArgumentMap,
			};

			// Delete mutation
			mutationFieldsConfig[`delete${singularize(pascalCase(tableInfo.name))}`] = {
				type: typeRef,
				args: {
					id: { type: new GraphQLNonNull(GraphQLID) },
				} as GraphQLFieldConfigArgumentMap,
			};
		}
	}

	// Build subscription fields
	const subscriptionFieldsConfig: GraphQLFieldConfigMap<unknown, unknown> = {};

	if (mergedConfig.subscriptions) {
		for (const tableInfo of tableInfos) {
			const typeName = mergedConfig.typePrefix + singularize(pascalCase(tableInfo.name));
			const typeRef = objectTypes.find((t) => t.name === typeName)!;

			// Subscribe to created records
			subscriptionFieldsConfig[`${tableInfo.name}Created`] = {
				type: typeRef,
				args: {},
			};

			// Subscribe to updated records
			subscriptionFieldsConfig[`${tableInfo.name}Updated`] = {
				type: typeRef,
				args: {},
			};

			// Subscribe to deleted records
			subscriptionFieldsConfig[`${tableInfo.name}Deleted`] = {
				type: typeRef,
				args: {},
			};
		}
	}

	// Create Query type
	const queryType = new GraphQLObjectType({
		name: "Query",
		description: "Auto-generated queries from Drizzle schema",
		fields: queryFieldsConfig,
	});

	// Create Mutation type
	const mutationType = new GraphQLObjectType({
		name: "Mutation",
		description: "Auto-generated mutations from Drizzle schema",
		fields: mutationFieldsConfig,
	});

	// Create Subscription type (optional)
	let subscriptionType: GraphQLObjectType | undefined;
	if (mergedConfig.subscriptions && Object.keys(subscriptionFieldsConfig).length > 0) {
		subscriptionType = new GraphQLObjectType({
			name: "Subscription",
			description: "Auto-generated subscriptions from Drizzle schema",
			fields: subscriptionFieldsConfig,
		});
	}

	// Build and return the schema
	const schemaConfig: GraphQLSchemaConfig = {
		query: queryType,
		mutation:
			mergedConfig.mutations && Object.keys(mutationFieldsConfig).length > 0 ? mutationType : null,
		types: [
			...objectTypes,
			...createInputTypes,
			...updateInputTypes,
			...whereInputTypes,
			GraphQLJSON,
			GraphQLDateTime,
		],
	};

	// Only add subscription type if subscriptions are enabled
	if (mergedConfig.subscriptions && Object.keys(subscriptionFieldsConfig).length > 0) {
		schemaConfig.subscription = subscriptionType;
	}

	return new GraphQLSchema(schemaConfig);
}

export { GraphQLJSON, GraphQLDateTime };
