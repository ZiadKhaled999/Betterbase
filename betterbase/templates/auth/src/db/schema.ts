import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * UUID primary-key helper.
 */
export const uuid = (name = 'id') =>
  text(name)
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

/**
 * Adds created_at and updated_at timestamp columns.
 * created_at is set on insert and updated_at is refreshed on updates.
 * Note: .$onUpdate(() => new Date()) applies when updates go through Drizzle.
 * Raw SQL writes will not auto-update this value without a DB trigger.
 *
 * @example
 * export const users = sqliteTable('users', {
 *   id: uuid(),
 *   email: text('email'),
 *   ...timestamps,
 * });
 */
export const timestamps = {
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .$defaultFn(() => new Date().toISOString())
    .$onUpdate(() => new Date().toISOString()),
};

/**
 * Shared status enum helper.
 */
export const statusEnum = (name = 'status') =>
  text(name, { enum: ['active', 'inactive', 'pending'] }).default('active');

/**
 * Soft-delete helper.
 */
export const softDelete = {
  deletedAt: text('deleted_at'),
};

export const users = sqliteTable('users', {
  id: uuid(),
  email: text('email').notNull().unique(),
  name: text('name'),
  status: statusEnum(),
  ...timestamps,
  ...softDelete,
});
