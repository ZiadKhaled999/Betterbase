**BetterBase**

**Core Platform — Agent Task Master Document**

Backend, Auth, Realtime, RLS, Storage, GraphQL, Functions, Observability

For Kilo Code Orchestrator  |  March 2026  |  Source: CODEBASE\_MAP.md

# **How To Use This Document**

This document is for the Kilo Code Orchestrator agent. Every task block is fully self-contained. The agent must not ask follow-up questions — all required context is provided inline.

**Rules:**

* Each task is independent unless DEPENDS ON lists a task ID — complete that task first.

* FILE PATHS are relative to the monorepo root (e.g., packages/core/src/...).

* Complete sub-tasks in the numbered order given.

* ACCEPTANCE CRITERIA define the exact conditions that mark a task complete.

* Do not edit files outside the listed FILE PATHS unless a sub-task explicitly says to.

* When a task says 'extend existing file' — read that file fully before touching it.

**Status Legend:**

* INCOMPLETE — scaffolding exists but feature is broken or non-functional

* PARTIAL — feature works in limited cases, needs depth or completion

* MISSING — does not exist anywhere in the codebase

Note: Dashboard tasks are maintained in a separate document (BetterBase\_Dashboard\_Tasks.docx) because the dashboard lives in a separate repository.

# **Task Summary**

| ID | Task Title | Area | Status | Priority |
| :---- | :---- | :---- | :---- | :---- |
| T-01 | Realtime: Replace manual broadcast with CDC | Realtime | **PARTIAL** | **P1 — CRITICAL** |
| T-02 | Realtime: Server-side event filtering | Realtime | **PARTIAL** | **P2 — HIGH** |
| T-03 | REST API: Auto-generate routes from schema | REST API | **PARTIAL** | **P1 — CRITICAL** |
| T-04 | RLS: Enforce policies on SQLite provider | RLS | **PARTIAL** | **P1 — CRITICAL** |
| T-05 | RLS: Apply RLS to storage bucket operations | RLS | **PARTIAL** | **P2 — HIGH** |
| T-06 | Auth: Magic Link / OTP authentication | Auth | **MISSING** | **P1 — CRITICAL** |
| T-07 | Auth: MFA / Two-Factor Authentication | Auth | **MISSING** | **P2 — HIGH** |
| T-08 | Auth: Phone / SMS authentication | Auth | **MISSING** | **P3 — MEDIUM** |
| T-09 | GraphQL: Complete resolver generation | GraphQL | **PARTIAL** | **P2 — HIGH** |
| T-10 | GraphQL: Implement subscription resolvers | GraphQL | **INCOMPLETE** | **P3 — MEDIUM** |
| T-11 | Edge Functions: Harden deployer pipeline | Functions | **PARTIAL** | **P2 — HIGH** |
| T-12 | Observability: Request logs and monitoring | Observability | **MISSING** | **P2 — HIGH** |
| T-13 | Storage: Bucket config and MIME validation | Storage | **PARTIAL** | **P2 — HIGH** |
| T-14 | Vector Search: pgvector / embedding support | Vector | **MISSING** | **P3 — MEDIUM** |
| T-15 | Branching: Preview environment support | DX | **MISSING** | **P3 — MEDIUM** |

# **Section 1 — Realtime**

**\[T-01\]  Realtime: Replace Manual Broadcast with Postgres CDC   ● PARTIAL**

| Priority | P1 — CRITICAL |
| :---- | :---- |
| **Area** | packages/core, templates/base |
| **Status** | **PARTIAL** |
| **Depends On** | None — can start immediately |

**Description**

The current realtime implementation uses a manual broadcast() pattern — developers must call realtime.broadcast() explicitly after each write. Supabase uses Change Data Capture (CDC) to fire events automatically on any INSERT, UPDATE, or DELETE. BetterBase needs equivalent automatic event emission. For SQLite (local dev), wrap the Drizzle ORM execute() layer. For Postgres providers, use LISTEN/NOTIFY triggers.

**File Paths to Edit / Create**

packages/core/src/providers/types.ts  
packages/core/src/providers/neon.ts  
packages/core/src/providers/postgres.ts  
packages/core/src/providers/turso.ts  
templates/base/src/lib/realtime.ts  
packages/client/src/realtime.ts

**Sub-Tasks (Complete in Order)**

1. In packages/core/src/providers/types.ts: add an onchange(callback: (event: DBEvent) \=\> void) method to the DatabaseConnection interface.

2. For SQLite/Turso: wrap the Drizzle execute() method to emit a DBEvent after every INSERT, UPDATE, or DELETE. Payload must include: table, type, record, old\_record, timestamp — matching the DBEvent type in packages/shared/src/types.ts exactly.

3. For Postgres (neon.ts, postgres.ts): install a generic pg\_notify trigger function on each table via a SQL migration helper. The trigger calls pg\_notify('db\_changes', row\_to\_json(NEW)::text) on every write.

4. In templates/base/src/lib/realtime.ts: remove the manual broadcast() requirement. At server startup, connect the provider's onchange event to the WebSocket broadcaster automatically.

5. Verify packages/core/src/webhooks/integrator.ts still receives db:change, db:insert, db:update, db:delete events correctly after the refactor — it must not be broken.

6. Write an integration test: insert a row via Drizzle, assert a WebSocket client receives the INSERT event within 500ms with no manual broadcast() call.

**Acceptance Criteria**

* ✓  Inserting a row via Drizzle ORM fires a WebSocket event automatically — no manual broadcast() call required.

* ✓  DBEvent payload matches packages/shared/src/types.ts DBEvent type exactly.

* ✓  Works for SQLite local dev and Neon Postgres.

* ✓  webhooks/integrator.ts still receives db:change events.

* ✓  No breaking changes to packages/client/src/realtime.ts public API.

**Agent Notes**

* The DBEvent type is in packages/shared/src/types.ts — use it exactly, do not define a new type.

* integrator.ts listens for 'db:change','db:insert','db:update','db:delete' — your emitter must use these exact event names.

* For SQLite: Bun's bun:sqlite has no built-in CDC — wrap the ORM layer, not the driver.

**\[T-02\]  Realtime: Add Server-Side Event Filtering on Subscriptions   ● PARTIAL**

| Priority | P2 — HIGH |
| :---- | :---- |
| **Area** | packages/core, packages/client, templates/base |
| **Status** | **PARTIAL** |
| **Depends On** | T-01 |

**Description**

Currently all database events are broadcast to all connected WebSocket clients — filtering happens on the client. This is wasteful and insecure. Server-side filtering must ensure a client subscribed to .from('posts').on('INSERT') only receives INSERT events for the posts table.

**File Paths to Edit / Create**

templates/base/src/lib/realtime.ts  
packages/client/src/realtime.ts

**Sub-Tasks (Complete in Order)**

7. In templates/base/src/lib/realtime.ts: each WebSocket connection must store its subscriptions as an array of { table: string, event: 'INSERT'|'UPDATE'|'DELETE'|'\*' }.

8. When a DBEvent fires, only push it to clients whose subscription list contains a matching { table, event } entry (or event \=== '\*').

9. Define the WebSocket message protocol: { type: 'subscribe', table: string, event: string } for subscribing, { type: 'unsubscribe', table: string, event: string } for unsubscribing.

10. In packages/client/src/realtime.ts: when .subscribe() is called, send the subscribe registration message to the server over WebSocket.

11. When .unsubscribe() is called, send the unsubscribe message and remove the local callback.

12. Write a test: subscribe client A to posts INSERT, client B to users UPDATE. Insert into posts — only client A receives the event.

**Acceptance Criteria**

* ✓  .from('posts').on('INSERT') delivers only posts INSERT events.

* ✓  .from('posts').on('\*') delivers all event types for posts.

* ✓  Unsubscribing stops delivery immediately.

* ✓  Clients with no matching subscription receive no events.

* ✓  Client SDK API is unchanged — purely a server-side implementation change.

**Agent Notes**

* Complete T-01 first — this builds on the CDC event stream T-01 establishes.

* Do not rewrite packages/client/src/realtime.ts — extend the existing subscribe/unsubscribe methods.

# **Section 2 — REST API**

**\[T-03\]  REST API: Auto-Generate Routes From Schema at Runtime   ● PARTIAL**

| Priority | P1 — CRITICAL |
| :---- | :---- |
| **Area** | packages/core, templates/base |
| **Status** | **PARTIAL** |
| **Depends On** | None — can start immediately |

**Description**

BetterBase requires developers to run 'bb generate crud \<table\>' manually per table. Supabase auto-generates a full REST API via PostgREST from the schema automatically. BetterBase needs a runtime route registration system: at server startup, read the Drizzle schema and dynamically mount CRUD routes for all tables. The CLI generate command stays for customisation but auto-REST must work with zero config.

**File Paths to Edit / Create**

packages/core/src/index.ts  
packages/core/src/config/schema.ts  
templates/base/src/index.ts  
templates/base/src/routes/index.ts  
packages/core/src/auto-rest.ts (CREATE)

**Sub-Tasks (Complete in Order)**

13. Create packages/core/src/auto-rest.ts. Export: mountAutoRest(app: Hono, db: DrizzleDB, schema: Record\<string, DrizzleTable\>, options?: AutoRestOptions).

14. For each table in the schema, register: GET /api/:table (list, paginated), GET /api/:table/:id (single), POST /api/:table (insert), PATCH /api/:table/:id (update), DELETE /api/:table/:id (delete).

15. Every route must apply the RLS session middleware from packages/core/src/middleware/rls-session.ts if RLS is enabled in config.

16. GET /api/:table must accept ?limit=20\&offset=0 query params. Response shape must be BetterBaseResponse\<T\[\]\> from packages/shared/src/types.ts including count and pagination fields.

17. Add autoRest: { enabled: boolean, excludeTables: string\[\] } to BetterBaseConfigSchema in packages/core/src/config/schema.ts.

18. In templates/base/src/index.ts: call mountAutoRest() at startup if autoRest.enabled \=== true.

19. Manually generated routes (from bb generate crud) must override auto-generated routes for the same table path — register manual routes after mountAutoRest().

**Acceptance Criteria**

* ✓  Server with autoRest: { enabled: true } automatically exposes full CRUD for all schema tables on startup.

* ✓  GET /api/users?limit=10\&offset=0 returns paginated BetterBaseResponse\<User\[\]\> with pagination metadata.

* ✓  Tables in excludeTables are not exposed.

* ✓  RLS policies apply to auto-generated routes.

* ✓  Manual routes override auto-generated routes for the same path.

**Agent Notes**

* BetterBaseResponse\<T\> is in packages/shared/src/types.ts — all responses must match this shape exactly.

* RLS middleware is in packages/core/src/middleware/rls-session.ts — import it, do not rewrite.

* schema is a plain object — use Object.entries(schema) to iterate tables.

# **Section 3 — Row Level Security**

**\[T-04\]  RLS: Enforce Policies on SQLite Provider (Application-Layer Emulation)   ● PARTIAL**

| Priority | P1 — CRITICAL |
| :---- | :---- |
| **Area** | packages/core |
| **Status** | **PARTIAL** |
| **Depends On** | None — can start immediately |

**Description**

The RLS system generates PostgreSQL-native SQL policies (ALTER TABLE ... ENABLE ROW LEVEL SECURITY). SQLite has no native RLS. For the default local dev provider to be secure, RLS must be emulated at the application layer: intercept queries, evaluate the policy expression for the current user session, and allow/reject or post-filter results.

**File Paths to Edit / Create**

packages/core/src/rls/types.ts  
packages/core/src/rls/evaluator.ts (CREATE)  
packages/core/src/middleware/rls-session.ts  
packages/shared/src/errors.ts

**Sub-Tasks (Complete in Order)**

20. Create packages/core/src/rls/evaluator.ts. Export: evaluatePolicy(policy: PolicyDefinition, userId: string | null, operation: 'select'|'insert'|'update'|'delete', record?: Record\<string, unknown\>): boolean.

21. The evaluator must parse the policy expression string and evaluate it at runtime. Replace auth.uid() with the actual userId from the RLS session. Replace column references (e.g., 'id', 'user\_id') with the actual record field values.

22. For SELECT: fetch rows first, then filter through the evaluator — return only rows where evaluatePolicy returns true.

23. For INSERT/UPDATE/DELETE: evaluate before execution. If false, throw UnauthorizedError (already in packages/shared/src/errors.ts — use it, do not create a new class).

24. Integrate into packages/core/src/middleware/rls-session.ts: add an rlsEnforce(db, schema, policies) middleware that wraps query execution with the evaluator.

25. The evaluator must handle at minimum: auth.uid() \= column\_name, auth.role() \= 'value', true (public), false (deny all).

26. Write tests: policy 'auth.uid() \= user\_id', user 'user-123' — only sees rows where user\_id \= 'user-123'. Unauthenticated request returns 401\.

**Acceptance Criteria**

* ✓  SQLite route with policy 'auth.uid() \= user\_id' only returns rows belonging to the authenticated user.

* ✓  Unauthenticated request to RLS-protected route returns 401\.

* ✓  Authenticated user reading another user's rows gets empty result, not an error.

* ✓  INSERT with mismatched user\_id returns 403\.

* ✓  Evaluator handles: auth.uid() \= col, auth.role() \= 'x', true, false.

**Agent Notes**

* UnauthorizedError is in packages/shared/src/errors.ts — use it.

* Read packages/core/src/rls/auth-bridge.ts before writing the evaluator — it documents the auth.uid() pattern.

* Post-fetch filtering trades performance for correctness — correctness is the goal for this task.

**\[T-05\]  RLS: Apply RLS Policies to Storage Bucket Operations   ● PARTIAL**

| Priority | P2 — HIGH |
| :---- | :---- |
| **Area** | packages/core, templates/base |
| **Status** | **PARTIAL** |
| **Depends On** | T-04 |

**Description**

Storage routes in templates/base/src/routes/storage.ts only check if a user is authenticated — they do not apply RLS-style policies per operation or path. Supabase allows storage policies like 'users can only read files in their own folder'. BetterBase needs a storage policy engine that evaluates per-operation before allowing upload, download, list, or delete.

**File Paths to Edit / Create**

packages/core/src/storage/types.ts  
packages/core/src/storage/index.ts  
packages/core/src/storage/policy-engine.ts (CREATE)  
packages/core/src/config/schema.ts  
templates/base/src/routes/storage.ts

**Sub-Tasks (Complete in Order)**

27. In packages/core/src/storage/types.ts: add StoragePolicy type: { bucket: string, operation: 'upload'|'download'|'list'|'delete'|'\*', expression: string }.

28. Create packages/core/src/storage/policy-engine.ts. Export: evaluateStoragePolicy(policy: StoragePolicy, userId: string | null, path: string): boolean. Expression can reference: auth.uid(), path, filename (last segment of path).

29. In packages/core/src/config/schema.ts: add storagePolicies: StoragePolicy\[\] to the storage config section.

30. In templates/base/src/routes/storage.ts: before each operation, load applicable storage policies from config and call evaluateStoragePolicy. Return 403 if policy denies.

31. Default behaviour with no matching policy: DENY (fail-closed). Add a comment in policy-engine.ts documenting three example expressions: public read (true), owner-only write (auth.uid() \= path.split('/')\[1\]), folder-scoped (path.startsWith('public/')).

**Acceptance Criteria**

* ✓  Upload to avatars/user-456/photo.png while authenticated as user-123 is blocked when policy is 'auth.uid() \= path.split("/")\[1\]'.

* ✓  Public read policy (expression: 'true') allows unauthenticated downloads.

* ✓  No matching policy defaults to 403 deny.

* ✓  Returns 403 with descriptive message on policy denial.

**Agent Notes**

* Fail-closed is correct — if no policy matches, deny. This mirrors Supabase.

* The evaluator from T-04 may be partially reusable — check before writing a new parser.

# **Section 4 — Authentication**

**\[T-06\]  Auth: Implement Magic Link / OTP Authentication   ● MISSING**

| Priority | P1 — CRITICAL |
| :---- | :---- |
| **Area** | templates/base, templates/auth, packages/client |
| **Status** | **MISSING** |
| **Depends On** | None — can start immediately |

**Description**

BetterBase supports password and OAuth auth but not passwordless Magic Link or email OTP. These are core modern auth features. BetterAuth has plugins for both. This task wires them into BetterBase and exposes them through the client SDK.

**File Paths to Edit / Create**

templates/base/src/auth/index.ts  
templates/auth/src/routes/auth.ts  
packages/client/src/auth.ts  
packages/cli/src/commands/auth.ts

**Sub-Tasks (Complete in Order)**

32. In templates/base/src/auth/index.ts: add BetterAuth magicLink plugin. Accept SMTP config from env vars: SMTP\_HOST, SMTP\_PORT, SMTP\_USER, SMTP\_PASS, SMTP\_FROM.

33. Add routes in templates/auth/src/routes/auth.ts: POST /api/auth/magic-link (accepts { email }), GET /api/auth/magic-link/verify?token=xxx (verifies and creates session).

34. For OTP: add POST /api/auth/otp/send (accepts { email }) and POST /api/auth/otp/verify (accepts { email, code }).

35. In packages/client/src/auth.ts: add to AuthClient: sendMagicLink(email), verifyMagicLink(token), sendOtp(email), verifyOtp(email, code). All return BetterBaseResponse.

36. In packages/cli/src/commands/auth.ts: during 'bb auth setup', prompt if magic link is wanted. If yes, add SMTP env vars to .env.example.

37. In development (NODE\_ENV=development): log the magic link / OTP code to stdout — never send real emails in dev.

**Acceptance Criteria**

* ✓  POST /api/auth/magic-link returns 200 and logs link in dev.

* ✓  GET /api/auth/magic-link/verify?token=valid returns a session.

* ✓  Expired/invalid token returns 401\.

* ✓  POST /api/auth/otp/send \+ POST /api/auth/otp/verify with correct code returns a session.

* ✓  All four client SDK methods are callable and correctly typed.

* ✓  Dev mode logs token/code to stdout instead of sending email.

**Agent Notes**

* Use BetterAuth's built-in magicLink and emailOtp plugins — do not implement email delivery from scratch.

* AuthClient in packages/client/src/auth.ts wraps BetterAuth client — extend it following the existing signUp/signIn pattern.

**\[T-07\]  Auth: Implement MFA / Two-Factor Authentication (TOTP)   ● MISSING**

| Priority | P2 — HIGH |
| :---- | :---- |
| **Area** | templates/base, templates/auth, packages/client |
| **Status** | **MISSING** |
| **Depends On** | T-06 |

**Description**

TOTP-based MFA (Google Authenticator style) is missing from BetterBase. BetterAuth has a twoFactor plugin. This task wires it in and exposes it through the client SDK. The sign-in flow must change to support a two-step challenge when MFA is enabled.

**File Paths to Edit / Create**

templates/base/src/auth/index.ts  
templates/auth/src/routes/auth.ts  
packages/client/src/auth.ts  
packages/client/src/types.ts

**Sub-Tasks (Complete in Order)**

38. In templates/base/src/auth/index.ts: add BetterAuth twoFactor plugin.

39. Add routes: POST /api/auth/mfa/enable (returns QR URI \+ backup codes), POST /api/auth/mfa/verify (activates MFA), POST /api/auth/mfa/disable, POST /api/auth/mfa/challenge (accepts { code } during login).

40. Modify sign-in flow: if user has MFA enabled, signIn() returns { requiresMFA: true } instead of a full session. Client must then call mfa.challenge(code) to complete.

41. Add requiresMFA: boolean to the Session type in packages/client/src/types.ts.

42. In packages/client/src/auth.ts: add client.auth.mfa object with methods: enable(), verify(code), disable(), challenge(code).

43. Backup codes: generate on enable, store hashed, one-time use, usable in place of TOTP code.

**Acceptance Criteria**

* ✓  User can enable TOTP MFA and receive a valid QR code URI.

* ✓  After enabling MFA, signIn() returns requiresMFA: true without a session.

* ✓  mfa.challenge(validCode) completes login and returns a full session.

* ✓  Invalid TOTP code returns 401\.

* ✓  User can disable MFA with current TOTP code.

* ✓  Backup codes are one-time use and stored hashed.

**Agent Notes**

* Complete T-06 first — the auth config pattern it establishes is required here.

* Use BetterAuth twoFactor plugin — do not implement TOTP from scratch.

**\[T-08\]  Auth: Implement Phone / SMS Authentication   ● MISSING**

| Priority | P3 — MEDIUM |
| :---- | :---- |
| **Area** | templates/base, templates/auth, packages/client |
| **Status** | **MISSING** |
| **Depends On** | T-06 |

**Description**

Phone/SMS OTP authentication is missing. Requires Twilio integration or a BetterAuth phone plugin. In development, codes are logged to stdout — no real SMS sent.

**File Paths to Edit / Create**

templates/base/src/auth/index.ts  
templates/auth/src/routes/auth.ts  
packages/client/src/auth.ts  
packages/client/src/types.ts

**Sub-Tasks (Complete in Order)**

44. Check if BetterAuth has a phone/SMS plugin. If yes, use it. If no, implement custom flow.

45. Custom flow: POST /api/auth/phone/send (accepts { phone in E.164 format }) — generate 6-digit code, store hashed with 10-min expiry, send via Twilio or log to stdout in dev.

46. POST /api/auth/phone/verify (accepts { phone, code }) — verify, create session, return session.

47. Env vars required: TWILIO\_ACCOUNT\_SID, TWILIO\_AUTH\_TOKEN, TWILIO\_PHONE\_NUMBER.

48. Add phone?: string to User type in packages/client/src/types.ts.

49. Add to AuthClient: sendPhoneOtp(phone), verifyPhoneOtp(phone, code).

50. In dev (NODE\_ENV=development): always console.log the code, never call Twilio.

**Acceptance Criteria**

* ✓  POST /api/auth/phone/send returns 200 and logs code in dev.

* ✓  POST /api/auth/phone/verify with correct code returns session.

* ✓  Expired code (\>10 min) returns 401\.

* ✓  Invalid code returns 401\.

* ✓  Phone numbers stored in E.164 format.

**Agent Notes**

* Dev mode must never make real SMS API calls.

* Phone stored as E.164 (e.g., \+15555555555).

# **Section 5 — GraphQL**

**\[T-09\]  GraphQL: Complete Resolver Generation Depth   ● PARTIAL**

| Priority | P2 — HIGH |
| :---- | :---- |
| **Area** | packages/core |
| **Status** | **PARTIAL** |
| **Depends On** | None — can start immediately |

**Description**

The GraphQL resolver generator in packages/core/src/graphql/resolvers.ts has stubs or placeholders for subscriptions, relationship resolvers, and before/after mutation hooks. This task audits resolvers.ts and completes all missing functionality: relationship resolvers (foreign key joins), pagination on list queries, and fully functional mutations.

**File Paths to Edit / Create**

packages/core/src/graphql/resolvers.ts  
packages/core/src/graphql/schema-generator.ts  
packages/core/src/graphql/server.ts

**Sub-Tasks (Complete in Order)**

51. Read resolvers.ts fully. Identify and list every resolver that returns placeholder data or a stub.

52. For each table, ensure these resolvers execute real Drizzle queries: Query: tableList (paginated), Query: tableById, Mutation: createTable, Mutation: updateTable, Mutation: deleteTable.

53. Add pagination args to all list queries: first: Int, offset: Int, orderBy: String, orderDir: asc|desc.

54. In schema-generator.ts: ensure generated schema includes CreateTableInput and UpdateTableInput types — exclude id, createdAt, updatedAt from create inputs.

55. Implement relationship resolvers: if a table has a foreign key column (e.g., posts.author\_id referencing users.id), generate a nested resolver so Post.author resolves the related User.

56. Verify beforeMutation and afterMutation hooks are called when provided in ResolverGenerationConfig — they must receive: operation type, input data, result.

**Acceptance Criteria**

* ✓  { users(first: 10, offset: 0\) { id name email } } returns real DB data paginated.

* ✓  { createUser(input: { name: "T", email: "t@t.com" }) { id } } inserts and returns row.

* ✓  { updateUser(id: "1", input: { name: "New" }) { id name } } updates row.

* ✓  { deleteUser(id: "1") } removes row.

* ✓  Post.author resolves the related User row via foreign key.

* ✓  beforeMutation and afterMutation hooks are invoked when configured.

**Agent Notes**

* Read resolvers.ts before writing — do not rewrite working resolvers, only complete stubs.

* All resolvers must be compatible with graphql-yoga's IResolvers type.

**\[T-10\]  GraphQL: Implement Subscription Resolvers   ● INCOMPLETE**

| Priority | P3 — MEDIUM |
| :---- | :---- |
| **Area** | packages/core |
| **Status** | **INCOMPLETE** |
| **Depends On** | T-01 |

**Description**

packages/core/src/graphql/resolvers.ts has a placeholder comment for subscriptions. GraphQL subscriptions allow clients to receive real-time updates via the GraphQL API. This task connects GraphQL subscriptions to the CDC event stream from T-01.

**File Paths to Edit / Create**

packages/core/src/graphql/resolvers.ts  
packages/core/src/graphql/schema-generator.ts  
packages/core/src/graphql/server.ts

**Sub-Tasks (Complete in Order)**

57. In schema-generator.ts: add a Subscription type to the generated schema with one subscription per table: onTableChange(event: INSERT|UPDATE|DELETE).

58. In resolvers.ts: for each table, implement an async iterator subscription resolver that listens to the db:change event emitter from T-01. Filter by table name and event type.

59. In server.ts: verify graphql-yoga is configured for subscription support (it supports SSE natively).

60. Closing the subscription connection must not cause errors or memory leaks — clean up the event listener.

**Acceptance Criteria**

* ✓  subscription { onUsersChange(event: INSERT) { id name } } delivers events when users rows are inserted.

* ✓  Correctly filters by table and event type.

* ✓  Unsubscribing/closing connection does not cause errors or listener leaks.

* ✓  Works with graphql-yoga's built-in subscription transport.

**Agent Notes**

* Complete T-01 first — the CDC event emitter is the data source.

* Use graphql-yoga's built-in createPubSub or async iterator — do not add a separate subscription library.

# **Section 6 — Edge Functions**

**\[T-11\]  Edge Functions: Verify and Harden Deployer Pipeline   ● PARTIAL**

| Priority | P2 — HIGH |
| :---- | :---- |
| **Area** | packages/core, packages/cli |
| **Status** | **PARTIAL** |
| **Depends On** | None — can start immediately |

**Description**

packages/core/src/functions/deployer.ts and bundler.ts exist but their completeness is unknown. The deployer references Wrangler CLI (Cloudflare) and Vercel CLI — external tools that may not be installed. This task hardens the pipeline: validate dependencies, handle missing CLIs gracefully, test bundle→deploy cycle, and add invoke \+ logs commands.

**File Paths to Edit / Create**

packages/core/src/functions/bundler.ts  
packages/core/src/functions/deployer.ts  
packages/cli/src/commands/function.ts

**Sub-Tasks (Complete in Order)**

61. Read bundler.ts fully. Verify bundleFunction() uses Bun.build() to produce a single-file self-contained JS output. If broken, fix it.

62. In deployer.ts: add checkDeployerDependencies(target: 'cloudflare'|'vercel'): { available: boolean, error?: string } using Bun.which() to check for wrangler / vercel on PATH.

63. If CLI tool not found, throw a descriptive error with install instructions: 'wrangler not found. Install with: bun install \-g wrangler'.

64. In packages/cli/src/commands/function.ts: call checkDeployerDependencies() before deploy. Show helpful error if not available — do not crash.

65. Implement 'bb function invoke \<name\> \--data {json}': POST to the deployed function URL, print response.

66. Implement 'bb function logs \<name\>': call getCloudflareLogs or getVercelLogs from deployer.ts and stream output.

67. Write a smoke test: bundle a hello-world function with an import, verify output is a single valid JS file with no external imports.

**Acceptance Criteria**

* ✓  'bb function deploy my-func' when wrangler not installed shows clear install instructions instead of a crash.

* ✓  bundleFunction() produces a single self-contained JS file for a function with imports.

* ✓  'bb function invoke \<name\>' sends a request and prints the response.

* ✓  'bb function logs \<name\>' prints recent log entries.

* ✓  Bundle output is valid JavaScript for Cloudflare Workers environment.

**Agent Notes**

* Use Bun.which('wrangler') to check CLI — returns null if not found.

* Do not auto-install tools — only show instructions.

* FunctionConfig type is in bundler.ts — read it before adding fields.

# **Section 7 — Observability**

**\[T-12\]  Observability: Implement Structured Request Logs and Log Query API   ● MISSING**

| Priority | P2 — HIGH |
| :---- | :---- |
| **Area** | packages/core, templates/base |
| **Status** | **MISSING** |
| **Depends On** | T-03 |

**Description**

BetterBase has no logging infrastructure. Supabase provides a log explorer showing all API requests, auth events, storage operations, and DB queries. BetterBase needs structured request logging, a queryable log store, and an API endpoint so the dashboard can display logs.

**File Paths to Edit / Create**

packages/core/src/logging/logger.ts (CREATE)  
packages/core/src/logging/log-store.ts (CREATE)  
packages/core/src/index.ts  
templates/base/src/routes/index.ts  
templates/base/src/index.ts

**Sub-Tasks (Complete in Order)**

68. Create packages/core/src/logging/logger.ts. Export a structured logger writing JSON entries with: timestamp, level (info|warn|error), type (request|auth|db|storage|function), message, metadata (object).

69. Create packages/core/src/logging/log-store.ts. For local dev: store entries in a SQLite table (log\_entries). Export: append(entry), query(filters: { type?, level?, from?, to?, limit? }): LogEntry\[\], clear(). Create the table automatically at startup if it doesn't exist.

70. In templates/base/src/routes/index.ts: add a Hono middleware that logs every HTTP request: method, path, status code, duration ms, authenticated userId if present.

71. Add GET /api/logs route returning log entries. Require admin authentication (check for service-level API key from config or admin role).

72. Log auth events from auth routes: sign in (success/failure), sign up, sign out.

73. Log database operations from auto-REST routes (T-03): table name, operation type, row count, duration ms.

74. Support query params on GET /api/logs: ?type=auth, ?level=error, ?from=ISO\_DATE\&to=ISO\_DATE, ?limit=100.

**Acceptance Criteria**

* ✓  Every HTTP request produces a structured JSON log entry.

* ✓  GET /api/logs returns last 100 entries by default.

* ✓  GET /api/logs?type=auth returns only auth entries.

* ✓  GET /api/logs?from=X\&to=Y filters by time range.

* ✓  Auth events appear in logs.

* ✓  log\_entries table is auto-created at startup.

**Agent Notes**

* Keep MVP simple — SQLite log store is fine. No Datadog/external integrations.

* Do not log request/response bodies — only metadata (privacy concern).

* The dashboard repo will consume GET /api/logs — ensure the response shape is consistent BetterBaseResponse\<LogEntry\[\]\>.

# **Section 8 — Storage**

**\[T-13\]  Storage: Bucket Configuration and MIME Type / Size Validation   ● PARTIAL**

| Priority | P2 — HIGH |
| :---- | :---- |
| **Area** | packages/core, templates/base |
| **Status** | **PARTIAL** |
| **Depends On** | None — can start immediately |

**Description**

The S3 storage adapter lacks bucket-level configuration: allowed MIME types, maximum file size, public vs private bucket, and CORS origins. These must be configurable per-bucket in betterbase.config.ts and enforced at upload time.

**File Paths to Edit / Create**

packages/core/src/storage/types.ts  
packages/core/src/storage/index.ts  
packages/core/src/storage/s3-adapter.ts  
packages/core/src/config/schema.ts  
templates/base/src/routes/storage.ts

**Sub-Tasks (Complete in Order)**

75. In packages/core/src/storage/types.ts: add BucketConfig: { name: string, public: boolean, allowedMimeTypes: string\[\], maxFileSizeBytes: number, corsOrigins: string\[\] }.

76. In packages/core/src/config/schema.ts: add buckets: BucketConfig\[\] to the storage config section.

77. In s3-adapter.ts upload method: validate file MIME type against allowedMimeTypes (support wildcards: 'image/\*' matches 'image/png'). Validate file size \<= maxFileSizeBytes. Return 400 with descriptive error if either fails.

78. For public buckets: set S3 object ACL to public-read on upload. For private: use private ACL.

79. Default if no allowedMimeTypes configured: allow all. Default maxFileSizeBytes: 50MB.

80. In templates/base/src/routes/storage.ts: pass bucket config to storage client and return 400 on validation failure with a clear error message.

**Acceptance Criteria**

* ✓  Uploading a .exe to a bucket with allowedMimeTypes: \['image/\*'\] returns 400\.

* ✓  Uploading a file over maxFileSizeBytes returns 400\.

* ✓  Public bucket upload sets object to public-read.

* ✓  Private bucket requires signed URL for download.

* ✓  Bucket config is read from betterbase.config.ts and applied automatically.

**Agent Notes**

* MIME wildcard matching: 'image/\*' must match 'image/png', 'image/jpeg', etc.

* If no config for a bucket, apply permissive defaults (allow all MIME, 50MB max).

# **Section 9 — Vector Search**

**\[T-14\]  Vector Search: Add pgvector / Embedding Column and Similarity Query   ● MISSING**

| Priority | P3 — MEDIUM |
| :---- | :---- |
| **Area** | packages/core, packages/client |
| **Status** | **MISSING** |
| **Depends On** | None — can start immediately |

**Description**

Supabase supports pgvector for AI/embedding use cases. BetterBase's AI-native positioning makes this a differentiator. This task adds a vector column type to the Drizzle schema helpers and a nearest-neighbor .similarTo() method to the query builder.

**File Paths to Edit / Create**

packages/core/src/config/drizzle-generator.ts  
packages/client/src/query-builder.ts  
packages/shared/src/types.ts

**Sub-Tasks (Complete in Order)**

81. For Postgres providers: add vector(dimensions: number) as a supported Drizzle column type mapping to Postgres vector(n) from pgvector.

82. Add a migration helper that runs CREATE EXTENSION IF NOT EXISTS vector when a Postgres provider is initialised.

83. In packages/client/src/query-builder.ts: add .similarTo(column: string, embedding: number\[\], limit: number) that generates a \<-\> cosine distance nearest-neighbour query.

84. Add VectorSearchResult\<T\> to packages/shared/src/types.ts: base record plus similarity: number field.

85. For SQLite: calling .similarTo() must throw a clear error: 'Vector search requires a Postgres provider. Current provider is SQLite.'

**Acceptance Criteria**

* ✓  Drizzle schema can define a column as vector(1536).

* ✓  .similarTo('embedding', \[...\], 10).execute() returns 10 most similar rows with similarity score.

* ✓  Calling .similarTo() on SQLite throws a descriptive error.

* ✓  pgvector extension auto-enabled on Postgres provider init.

**Agent Notes**

* Postgres-only feature — do not emulate on SQLite.

* Common dimensions: 1536 (OpenAI ada-002), 768 (open-source models).

# **Section 10 — Developer Experience**

**\[T-15\]  Branching: Git-Aware Preview Database Isolation   ● MISSING**

| Priority | P3 — MEDIUM |
| :---- | :---- |
| **Area** | packages/cli, packages/core, templates/base |
| **Status** | **MISSING** |
| **Depends On** | None — can start immediately |

**Description**

When running 'bb dev', BetterBase should detect the current Git branch name and use a branch-specific SQLite database file (e.g., local-feature-new-api.db) instead of the default local.db. This gives developers isolated databases per branch with zero cloud infrastructure.

**File Paths to Edit / Create**

packages/cli/src/commands/dev.ts  
packages/cli/src/commands/migrate.ts  
packages/shared/src/constants.ts  
templates/base/src/db/index.ts

**Sub-Tasks (Complete in Order)**

86. In packages/cli/src/commands/dev.ts: at startup, run git rev-parse \--abbrev-ref HEAD using Bun.spawn to get the current branch name. If git is unavailable or not a git repo, fall back to local.db with a warning log.

87. Sanitize branch name for filename use: lowercase, replace / and special chars with \-.

88. Set env var BETTERBASE\_BRANCH=\<sanitised-branch\> in the dev server process.

89. In templates/base/src/db/index.ts: if BETTERBASE\_BRANCH is set, use local-\<branch\>.db as DB\_PATH instead of default.

90. In packages/cli/src/commands/migrate.ts: use the same branch-aware DB path logic.

91. Add 'bb branch list': scan project root for local-\*.db files and list them.

92. Add 'bb branch delete \<name\>': delete the branch database file after a confirmation prompt.

**Acceptance Criteria**

* ✓  On branch 'main': database is local.db.

* ✓  On branch 'feature/new-api': database is local-feature-new-api.db.

* ✓  Switching branches and running 'bb dev' uses a separate database with no shared state.

* ✓  'bb branch list' shows all local branch databases.

* ✓  'bb branch delete \<name\>' removes the database after confirmation.

* ✓  Not a git repo: falls back to local.db with a warning.

**Agent Notes**

* Lazy init — do not create the DB file until the server actually starts.

* SQLite/local only — no cloud branch provisioning.

* If git not available: warn and continue with local.db, do not crash.

# **Appendix — Dependency Graph**

**Complete tasks in this order to avoid blockers:**

**Phase 1 — No dependencies, start immediately**

* T-01  Realtime CDC

* T-03  Auto REST API

* T-04  RLS SQLite Enforcement

* T-06  Magic Link Auth

* T-09  GraphQL Resolvers

* T-11  Edge Functions Hardening

* T-13  Storage Bucket Config

**Phase 2 — Depends on Phase 1**

* T-02  Realtime Filtering  (needs T-01)

* T-05  Storage RLS  (needs T-04)

* T-07  MFA Auth  (needs T-06)

* T-08  Phone Auth  (needs T-06)

* T-10  GraphQL Subscriptions  (needs T-01)

* T-12  Observability  (needs T-03)

**Phase 3 — Independent / Future**

* T-14  Vector Search

* T-15  Branching

End of BetterBase Core Platform Task Document.