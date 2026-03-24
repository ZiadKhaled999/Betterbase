# CLI Commands

Complete reference for the BetterBase CLI (`bb`).

## Installation

```bash
bun add -g @betterbase/cli
```

Verify:

```bash
bb --version
```

## Global Options

| Option | Description |
|--------|-------------|
| `--version` | Show version |
| `--help` | Show help |
| `--project` | Specify project path |

## Project Management

### init

Initialize a new BetterBase project.

```bash
bb init [project-name]
bb init my-app
bb init my-app ./path
```

### dev

Start development server with auto-regeneration.

```bash
bb dev
bb dev ./my-project
```

## Database

### migrate

Manage database migrations.

```bash
# Apply pending migrations
bb migrate

# Preview changes
bb migrate preview

# Apply to production (with confirmation)
bb migrate production

# Rollback last migration
bb migrate rollback

# Rollback N migrations
bb migrate rollback -s 3

# Show migration history
bb migrate history
```

## Authentication

### auth setup

Install and configure BetterAuth.

```bash
bb auth setup
bb auth setup ./my-project
```

### auth add-provider

Add OAuth provider.

```bash
bb auth add-provider github
bb auth add-provider google
bb auth add-provider discord

# Available: google, github, discord, apple, microsoft, twitter, facebook
```

### login

Authenticate CLI with BetterBase.

```bash
bb login
```

### logout

Sign out CLI.

```bash
bb logout
```

## Storage

### storage init

Initialize storage.

```bash
bb storage init
bb storage init ./my-project
```

### storage list

List storage buckets.

```bash
bb storage list
bb storage buckets
```

### storage upload

Upload file to storage.

```bash
bb storage upload <file> [options]
bb storage upload ./image.jpg
bb storage upload ./doc.pdf -b my-bucket -p uploads/doc.pdf
```

Options:
- `-b, --bucket` - Bucket name
- `-p, --path` - Path in bucket

## Functions

### function create

Create new function.

```bash
bb function create <name>
bb function create hello-world
```

### function dev

Run function locally.

```bash
bb function dev <name>
bb function dev hello-world
```

### function build

Build function for deployment.

```bash
bb function build <name>
bb function build hello-world --target aws-lambda --minify
```

Options:
- `--target` - Build target (node, aws-lambda, vercel, etc.)
- `--minify` - Enable minification

### function deploy

Deploy function.

```bash
bb function deploy <name>
bb function deploy hello-world --sync-env
```

Options:
- `--sync-env` - Sync environment variables

### function list

List all functions.

```bash
bb function list
```

### function logs

View function logs.

```bash
bb function logs <name>
bb function logs hello-world -l 50
```

Options:
- `-l, --limit` - Number of log lines

## Webhooks

### webhook create

Create new webhook.

```bash
bb webhook create
bb webhook create ./my-project
```

### webhook list

List webhooks.

```bash
bb webhook list
```

### webhook test

Test webhook.

```bash
bb webhook test <webhook-id>
bb webhook test wh_12345
```

### webhook logs

View webhook logs.

```bash
bb webhook logs <webhook-id>
bb webhook logs wh_12345 -l 100
```

Options:
- `-l, --limit` - Number of log lines

## Branching

### branch create

Create preview environment.

```bash
bb branch create <name>
bb branch create feature/login-form
```

### branch list

List preview environments.

```bash
bb branch list
```

### branch delete

Delete preview environment.

```bash
bb branch delete <name>
bb branch delete feature/login-form
```

### branch status

Check branch status.

```bash
bb branch status <name>
```

### branch sleep

Sleep preview environment.

```bash
bb branch sleep <name>
```

### branch wake

Wake preview environment.

```bash
bb branch wake <name>
```

## GraphQL

### graphql generate

Generate GraphQL schema.

```bash
bb graphql generate
bb graphql generate ./my-project
```

### graphql playground

Open GraphQL Playground.

```bash
bb graphql playground
```

## Code Generation

### generate crud

Generate CRUD routes.

```bash
bb generate crud <table-name>
bb generate crud users
bb generate crud posts ./my-project
```

## RLS (Row Level Security)

### rls create

Create RLS policy.

```bash
bb rls create --table <name> --name <policy-name> --command <command> [--check <expression>]
bb rls create --table posts --name users-own-posts --command SELECT --check "user_id = auth.uid()"
```

### rls list

List RLS policies.

```bash
bb rls list
```

### rls enable

Enable RLS on table.

```bash
bb rls enable --table <name>
```

### rls disable

Disable RLS on table.

```bash
bb rls disable --table <name>
```

### rls test

Test RLS policies.

```bash
bb rls test --table <name>
bb rls test --table posts
```

## Quick Reference

| Command | Aliases | Description |
|---------|---------|-------------|
| `bb init` | | Initialize project |
| `bb dev` | | Start dev server |
| `bb migrate` | db | Database migrations |
| `bb auth setup` | | Setup auth |
| `bb auth add-provider` | | Add OAuth |
| `bb function create` | | Create function |
| `bb function dev` | | Run function locally |
| `bb function deploy` | | Deploy function |
| `bb storage upload` | | Upload file |
| `bb webhook create` | | Create webhook |
| `bb webhook test` | | Test webhook |
| `bb branch create` | | Create preview |
| `bb graphql generate` | | Generate schema |
| `bb generate crud` | | Generate CRUD |
| `bb rls create` | | Create policy |

## Environment Variables

The CLI respects:
- `BB_PROJECT` - Project path
- `BB_API_KEY` - API key for authentication

## Configuration

CLI reads from:
1. Command line arguments
2. `.betterbase-context.json`
3. `betterbase.config.ts`

## Related

- [CLI Overview](../cli/overview.md) - CLI introduction
- [Deployment](../guides/deployment.md) - Deployment guides
