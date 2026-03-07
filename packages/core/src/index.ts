export { defineConfig, BetterBaseConfigSchema } from "./config/schema";
export type { BetterBaseConfig } from "./config/schema";
export type { ProviderAdapter, ProviderConfig } from "./providers/types";
export { mountAutoRest } from "./auto-rest";
export type { AutoRestOptions, DrizzleDB, DrizzleTable } from "./auto-rest";

// Webhooks
export * from "./webhooks";
