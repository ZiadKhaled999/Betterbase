/**
 * Auth Bridge - PostgreSQL Function for RLS
 *
 * Creates the auth.uid() PostgreSQL function that RLS policies
 * can use to get the current user's ID.
 *
 * This function reads from a session setting that is set by the
 * RLS session middleware before executing queries.
 */

/**
 * Generate SQL to create the auth.uid() function
 *
 * This function allows RLS policies to access the authenticated
 * user's ID by reading from the app.current_user_id setting.
 *
 * @returns SQL statement to create the function
 *
 * @example
 * ```sql
 * CREATE OR REPLACE FUNCTION auth.uid()
 * RETURNS uuid AS $$
 *   SELECT current_setting('app.current_user_id', true)::uuid
 * $$ LANGUAGE sql STABLE;
 * ```
 */
export function generateAuthFunction(): string {
	return `CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid AS $$
  SELECT current_setting('app.current_user_id', true)::uuid
$$ LANGUAGE sql STABLE;`;
}

/**
 * Generate SQL to create the auth.uid() function with custom setting name
 * @param settingName - The setting name to read from (default: 'app.current_user_id')
 * @returns SQL statement to create the function
 * @throws Error if settingName contains invalid characters
 */
export function generateAuthFunctionWithSetting(settingName: string): string {
	// Validate setting name to prevent SQL injection
	// Only allow alphanumeric characters, underscores, and dots
	if (!/^[a-zA-Z0-9_.]+$/.test(settingName)) {
		throw new Error(
			`Invalid setting name: '${settingName}'. Only alphanumeric characters, underscores, and dots are allowed.`,
		);
	}
	return `CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid AS $
  SELECT current_setting('${settingName}', true)::uuid
$ LANGUAGE sql STABLE;`;
}

/**
 * Generate SQL to drop the auth.uid() function
 * @returns SQL statement to drop the function
 */
export function dropAuthFunction(): string {
	return "DROP FUNCTION IF EXISTS auth.uid();";
}

/**
 * SQL to set the current user ID for RLS
 * This should be called in each request after authentication
 * @param userId - The user's UUID
 * @returns SQL statement to set the session variable
 */
export function setCurrentUserId(userId: string): string {
	// Use single quotes escaped as '' for SQL
	const escapedUserId = userId.replace(/'/g, "''");
	return `SET LOCAL app.current_user_id = '${escapedUserId}';`;
}

/**
 * SQL to clear the current user ID (for logout)
 * @returns SQL statement to clear the session variable
 */
export function clearCurrentUserId(): string {
	return "SET LOCAL app.current_user_id = '';";
}

/**
 * SQL to check if a user is authenticated in RLS context
 * @returns SQL that returns true if a valid user ID is set
 */
export function generateIsAuthenticatedCheck(): string {
	return `CREATE OR REPLACE FUNCTION auth.authenticated()
RETURNS boolean AS $$
  SELECT current_setting('app.current_user_id', true) != ''
$$ LANGUAGE sql STABLE;`;
}

/**
 * Drop the is_authenticated function
 * @returns SQL to drop the function
 */
export function dropIsAuthenticatedCheck(): string {
	return "DROP FUNCTION IF EXISTS auth.authenticated();";
}

/**
 * All auth bridge functions to create
 * @returns Array of SQL statements
 */
export function generateAllAuthFunctions(): string[] {
	return [generateAuthFunction(), generateIsAuthenticatedCheck()];
}

/**
 * All auth bridge functions to drop
 * @returns Array of SQL statements
 */
export function dropAllAuthFunctions(): string[] {
	return [dropIsAuthenticatedCheck(), dropAuthFunction()];
}
