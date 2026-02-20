import { z } from 'zod'

export const ProviderTypeSchema = z.enum([
  'neon', 'turso', 'planetscale', 'supabase', 'postgres', 'managed'
])

export type ProviderType = z.infer<typeof ProviderTypeSchema>

export const BetterBaseConfigSchema = z.object({
  project: z.object({
    name: z.string().min(1),
  }),
  provider: z.object({
    type: ProviderTypeSchema,
    connectionString: z.string().optional(),
    url: z.string().optional(),           // Turso
    authToken: z.string().optional(),     // Turso
  }),
  storage: z.object({
    provider: z.enum(['s3', 'r2', 'backblaze', 'minio', 'managed']),
    bucket: z.string(),
    region: z.string().optional(),
    endpoint: z.string().optional(),
  }).optional(),
  webhooks: z.array(z.object({
    id: z.string(),
    table: z.string(),
    events: z.array(z.enum(['INSERT', 'UPDATE', 'DELETE'])),
    url: z.string(),
    secret: z.string(),
    enabled: z.boolean().default(true),
  })).optional(),
  graphql: z.object({
    enabled: z.boolean().default(true),
  }).optional(),
})

export type BetterBaseConfig = z.infer<typeof BetterBaseConfigSchema>

export function defineConfig(config: z.input<typeof BetterBaseConfigSchema>): BetterBaseConfig {
  return BetterBaseConfigSchema.parse(config)
}
