Verify each finding against the current code and only fix it if needed.

In `@CODEBASE_MAP.md` around lines 538 - 695, The CODEBASE_MAP.md tree and
module/command counts are out of sync with newly added modules
(rls/evaluator.ts, storage/policy-engine.ts, vector/*, branching/*,
auto-rest.ts) and the CLI command packages/cli/src/commands/branch.ts; update
the top-level monorepo tree and the summary counts to include these files and
their exported symbols (e.g. evaluatePolicy, evaluateStoragePolicy,
generateEmbedding/vectorSearch exports, BranchManager/createBranchManager,
mountAutoRest, and the branch CLI command) and remove or adjust any references
to deprecated module/command counts so the “Complete Codebase Map” consistently
lists these modules, their locations, and accurate totals.

---------

Verify each finding against the current code and only fix it if needed.

In `@packages/cli/test/auth-command.test.ts` around lines 81 - 84, The test
"creates src/auth/types.ts" uses a 60000ms timeout magic number; update it to
either include a brief explanatory comment next to the timeout describing that
bun add better-auth can be slow, or replace the literal with a shared constant
(e.g., BUN_ADD_TIMEOUT) and use that constant in the test invocation of
test("creates src/auth/types.ts", async () => { ... }, BUN_ADD_TIMEOUT);
reference the test name and the runAuthSetupCommand call when making the change
so other tests can reuse the constant for consistency.

--------
Verify each finding against the current code and only fix it if needed.

In `@packages/cli/test/auth-command.test.ts` around lines 75 - 147, Many tests
repeatedly call runAuthSetupCommand which re-runs heavy setup; instead run it
once per provider in a shared setup. Replace repeated runAuthSetupCommand calls
in the sqlite-related tests with a single beforeAll that calls
runAuthSetupCommand(tmpDir, "sqlite") (and similarly a separate beforeAll for
the "pg" provider test or group it), then have the individual it/tests only
read/assert files (use tmpDir and file paths like src/auth/index.ts,
src/db/auth-schema.ts, src/middleware/auth.ts, .env.example, src/index.ts); keep
the existing longer timeouts for the heavy beforeAll if needed and ensure
idempotency test still runs runAuthSetupCommand twice inside its own test to
validate behavior.
--------


Verify each finding against the current code and only fix it if needed.

In `@packages/core/src/graphql/resolvers.ts` around lines 604 - 605, The public
config field textColumn is never consumed; update generateVectorSearchResolver
to respect textColumn by using it when constructing the source text for
embedding/search (e.g., select/use the specified textColumn from the record or
query payload when creating embeddings or text-search input) so setting
textColumn actually changes which text is embedded/searched, or remove
textColumn from the public type/exports to avoid exposing a no-op; reference
generateVectorSearchResolver and the public config/interface that declares
textColumn (also apply the same fix where the config is surfaced at the other
locations noted around the later block) and ensure any downstream calls that
build embeddings or text-search queries accept and use the chosen column name.



----
Verify each finding against the current code and only fix it if needed.

Inline comments:
In `@packages/cli/src/index.ts`:
- Around line 341-385: The branch command group is missing the "status"
subcommand advertised in docs; add a new subcommand to the "branch" Command
instance that accepts "<name>" and optional "[project-root]" and calls
runBranchCommand(['status', name], projectRoot) in its action handler (mirror
the style of existing subcommands like create/delete/sleep/wake), using the
existing symbols branch and runBranchCommand so the CLI registers "bb branch
status <name> [project-root]".
- Around line 387-390: The parent command "branch" is missing its optional
argument declaration so its action handler receives a Command object instead of
a string; add an optional argument declaration for project root (e.g. call
.argument('[project-root]') on the branch Command) before the .action(...) so
the action receives the projectRoot string and runBranchCommand([], projectRoot)
is invoked with the correct parameter.

In `@packages/core/src/graphql/resolvers.ts`:
- Around line 672-675: The resolver currently uses || which treats 0 as missing
and ignores config.defaultOptions?.threshold; update the assignment of limit,
threshold and metric to use nullish coalescing (??) so explicit numeric values
like 0 are respected and include config.defaultOptions?.threshold for threshold
(e.g., derive threshold from args.threshold ?? config.defaultOptions?.threshold
?? undefined), apply the same change to the other resolver branch with the same
pattern (the assignments for limit, threshold, metric) so defaultOptions behaves
consistently.
- Around line 646-649: The example in the docs uses a non-existent resolver key
"search"; update it to use one of the actual exported resolver names from the
factory—either "searchByVector" or "searchByText"—so the example matches the
implementation (e.g., replace vectorResolvers.search with
vectorResolvers.searchByVector or vectorResolvers.searchByText wherever the
example shows Query: { search: ... }). Ensure the chosen key matches the
resolver you intended to demonstrate.

In `@README.md`:
- Around line 336-356: The README introduces a STORAGE_* env var contract but
later examples still reference AWS_* and S3_BUCKET, causing mismatch; update the
examples and any setup sections to consistently use the STORAGE_* names (e.g.,
STORAGE_PROVIDER, STORAGE_BUCKET, STORAGE_ALLOWED_MIME_TYPES,
STORAGE_MAX_FILE_SIZE) or explicitly document the aliases (map
AWS_ACCESS_KEY_ID→STORAGE_*, AWS_SECRET_ACCESS_KEY→STORAGE_*,
S3_BUCKET→STORAGE_BUCKET) so readers can configure storage correctly; locate and
change occurrences of AWS_* and S3_BUCKET in examples to the STORAGE_*
equivalents (or add a clear aliasing note) to ensure consistency.
- Around line 723-737: The table under the "#### Delete" heading is incorrect
and duplicates auth API docs (methods like signUp, signIn, signOut, getSession,
sendMagicLink, verifyMagicLink, sendOtp, verifyOtp, mfa.enable, mfa.verify,
mfa.disable, sendPhoneVerification, verifyPhone); restore the original
delete/query-builder documentation for the "Delete" section and remove the
duplicated auth table, and ensure the client surface documented matches the rest
of the README (use the same call style — e.g., object-style calls if the rest of
the auth examples use objects — and the same method names as elsewhere) so there
is a single consistent auth API surface.
- Around line 817-843: The README has inconsistent route prefixes: earlier
sections use /auth/* and /rest/v1/* while this new table shows /api/auth/* and
/api/:table, which will confuse users or cause 404s; update the docs to either
(a) standardize the tables to the actual server prefixes (e.g., change
/api/auth/* to /auth/* and /api/:table to /rest/v1/:table) or (b) add a clear
explanatory paragraph above these tables stating both surfaces exist and map
them (e.g., “Legacy/public API = /auth/* and /rest/v1/*;
reverse-proxy/internal/API gateway = /api/* — use /api/* when calling via the
gateway”), and then ensure the listed endpoints (authentication table and
Auto-REST table) match the canonical routes used by the server so readers aren’t
sent to 404s.

---

Outside diff comments:
In `@CODEBASE_MAP.md`:
- Around line 538-695: The CODEBASE_MAP.md tree and module/command counts are
out of sync with newly added modules (rls/evaluator.ts,
storage/policy-engine.ts, vector/*, branching/*, auto-rest.ts) and the CLI
command packages/cli/src/commands/branch.ts; update the top-level monorepo tree
and the summary counts to include these files and their exported symbols (e.g.
evaluatePolicy, evaluateStoragePolicy, generateEmbedding/vectorSearch exports,
BranchManager/createBranchManager, mountAutoRest, and the branch CLI command)
and remove or adjust any references to deprecated module/command counts so the
“Complete Codebase Map” consistently lists these modules, their locations, and
accurate totals.

---

Nitpick comments:
In `@packages/cli/test/auth-command.test.ts`:
- Around line 81-84: The test "creates src/auth/types.ts" uses a 60000ms timeout
magic number; update it to either include a brief explanatory comment next to
the timeout describing that bun add better-auth can be slow, or replace the
literal with a shared constant (e.g., BUN_ADD_TIMEOUT) and use that constant in
the test invocation of test("creates src/auth/types.ts", async () => { ... },
BUN_ADD_TIMEOUT); reference the test name and the runAuthSetupCommand call when
making the change so other tests can reuse the constant for consistency.
- Around line 75-147: Many tests repeatedly call runAuthSetupCommand which
re-runs heavy setup; instead run it once per provider in a shared setup. Replace
repeated runAuthSetupCommand calls in the sqlite-related tests with a single
beforeAll that calls runAuthSetupCommand(tmpDir, "sqlite") (and similarly a
separate beforeAll for the "pg" provider test or group it), then have the
individual it/tests only read/assert files (use tmpDir and file paths like
src/auth/index.ts, src/db/auth-schema.ts, src/middleware/auth.ts, .env.example,
src/index.ts); keep the existing longer timeouts for the heavy beforeAll if
needed and ensure idempotency test still runs runAuthSetupCommand twice inside
its own test to validate behavior.

In `@packages/core/src/graphql/resolvers.ts`:
- Around line 604-605: The public config field textColumn is never consumed;
update generateVectorSearchResolver to respect textColumn by using it when
constructing the source text for embedding/search (e.g., select/use the
specified textColumn from the record or query payload when creating embeddings
or text-search input) so setting textColumn actually changes which text is
embedded/searched, or remove textColumn from the public type/exports to avoid
exposing a no-op; reference generateVectorSearchResolver and the public
config/interface that declares textColumn (also apply the same fix where the
config is surfaced at the other locations noted around the later block) and
ensure any downstream calls that build embeddings or text-search queries accept
and use the chosen column name.



