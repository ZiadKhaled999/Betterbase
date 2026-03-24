# BetterBase CLI

Command-line interface for BetterBase development and deployment.

## Table of Contents
- [Overview](#overview)
- [Installation](#installation)
- [Commands](#commands)
  - [Project Management](#project-management)
  - [Development](#development)
  - [Database](#database)
  - [Authentication](#authentication)
  - [Storage](#storage)
  - [Functions](#functions)
  - [Webhooks](#webhooks)
  - [Branching](#branching)
  - [GraphQL](#graphql)
  - [Code Generation](#code-generation)
- [Usage Examples](#usage-examples)
- [Configuration](#configuration)
- [Extending](#extending)
- [Best Practices](#best-practices)

## Overview

The BetterBase CLI (`bb`) is a powerful command-line tool for managing BetterBase projects. It provides commands for project initialization, development workflow, database operations, authentication, storage management, and more.

### Key Features
- **Project Initialization**: Scaffold new BetterBase projects
- **Development Workflow**: Watch files and auto-generate context
- **Database Management**: Generate and apply migrations
- **Authentication Helpers**: Install and configure authentication
- **Storage Management**: Manage buckets and file uploads
- **Function Deployment**: Bundle and deploy edge functions
- **Branching/Previews**: Create and manage preview environments
- **Code Generation**: Generate CRUD, GraphQL, and other boilerplate

## Installation

The CLI is installed globally via npm/yarn/bun:
```bash
bun add -g @betterbase/cli
```

Or install locally in a project:
```bash
bun add -D @betterbase/cli
```

Then run with `npx bb` or add to package.json scripts.

## Commands

### Project Management

#### init
Initialize a new BetterBase project
```bash
bb init [project-name]
bb init my-app
bb init my-app ./path/to/project
```

#### dev
Watch schema/routes and regenerate `.betterbase-context.json`
```bash
bb dev [project-root]
bb dev
bb dev ./my-project
```

### Database

#### migrate
Generate and apply migrations
```bash
bb migrate           # Apply migrations to local dev
bb migrate preview   # Preview migration diff
bb migrate production # Apply to production (confirmation required)
bb migrate rollback  # Rollback last migration
bb migrate rollback -s 3  # Rollback 3 migrations
bb migrate history   # Show migration history
```

### Authentication

#### auth setup
Install and scaffold BetterAuth integration
```bash
bb auth setup [project-root]
bb auth setup
bb auth setup ./my-project
```

#### auth add-provider
Add OAuth provider (google, github, discord, apple, microsoft, twitter, facebook)
```bash
bb auth add-provider google [project-root]
bb auth add-provider github ./my-project
```

#### login/logout
Authenticate CLI with app.betterbase.com
```bash
bb login
bb logout
```

### Storage

#### storage init
Initialize storage with a provider
```bash
bb storage init [project-root]
bb storage init
bb storage init ./my-project
```

#### storage list/buckets
List objects in storage bucket
```bash
bb storage list [project-root]
bb storage buckets [project-root]  # Alias for list
```

#### storage upload
Upload a file to storage
```bash
bb storage upload <file> [options]
bb storage upload ./image.jpg
bb storage upload ./doc.pdf -b my-bucket -p uploads/doc.pdf
bb storage upload ./file.txt -r ./my-project
```

### Functions

#### function create
Create a new edge function
```bash
bb function create <name> [project-root]
bb function create hello-world
bb function create api ./my-project
```

#### function dev
Run function locally with hot reload
```bash
bb function dev <name> [project-root]
bb function dev hello-world
```

#### function build
Bundle function for deployment
```bash
bb function build <name> [project-root]
bb function build hello-world
```

#### function list
List all functions
```bash
bb function list [project-root]
```

#### function logs
Show function logs
```bash
bb function logs <name> [project-root]
```

#### function deploy
Deploy function to cloud
```bash
bb function deploy <name> [options] [project-root]
bb function deploy hello-world
bb function deploy hello-world --sync-env
```

### Webhooks

#### webhook create
Create a new webhook
```bash
bb webhook create [project-root]
bb webhook create
bb webhook create ./my-project
```

#### webhook list
List all configured webhooks
```bash
bb webhook list [project-root]
```

#### webhook test
Test a webhook by sending a synthetic payload
```bash
bb webhook test <webhook-id> [project-root]
bb webhook test wh_12345
bb webhook test wh_12345 ./my-project
```

#### webhook logs
Show delivery logs for a webhook
```bash
bb webhook logs <webhook-id> [options] [project-root]
bb webhook logs wh_12345
bb webhook logs wh_12345 -l 100
```

### Branching/Previews

#### branch create
Create a new preview environment
```bash
bb branch create <name> [project-root]
bb branch create feature/login-form
bb branch create bugfix/auth ./my-project
```

#### branch list
List all preview environments
```bash
bb branch list [project-root]
```

#### branch delete
Delete a preview environment
```bash
bb branch delete <name> [project-root]
bb branch delete feature/login-form
```

#### branch sleep/wake
Put a preview environment to sleep or wake it
```bash
bb branch sleep <name> [project-root]
bb branch wake <name> [project-root]
```

#### branch status
Get status of a preview environment
```bash
bb branch status <name> [project-root]
```

#### branch (no subcommand)
Manage preview environments
```bash
bb branch [project-root]
bb branch ./my-project
```

### GraphQL

#### graphql generate
Generate GraphQL schema from database schema
```bash
bb graphql generate [project-root]
bb graphql generate
bb graphql generate ./my-project
```

#### graphql playground
Open GraphQL Playground in browser
```bash
bb graphql playground
```

### Code Generation

#### generate crud
Generate full CRUD routes for a table
```bash
bb generate crud <table-name> [project-root]
bb generate crud users
bb generate crud posts ./my-project
```

## Usage Examples

### Setting Up a New Project
```bash
# Create project directory
mkdir my-betterbase-app
cd my-betterbase-app

# Initialize BetterBase project
bb init my-betterbase-app

# Install auth helpers
bb auth setup

# Add GitHub OAuth
bb auth add-provider github

# Initialize storage
bb storage init

# Start development server
bb dev

# In another terminal, start the app
bun run dev
```

### Database Workflow
```bash
# Generate initial migration
bb migrate

# Preview changes before applying
bb migrate preview

# Apply to production (with confirmation)
bb migrate production

# Rollback if needed
bb migrate rollback
```

### Function Development
```bash
# Create new function
bb function create process-webhook

# Develop locally with hot reload
bb function dev process-webhook

# Build for deployment
bb function build process-webhook

# Deploy to cloud
bb function deploy process-webhook --sync-env
```

### Preview Environments
```bash
# Create preview for feature branch
bb branch create feature/payment-integration

# Work on feature...
# When ready, share preview URL with team

# When feature is merged, cleanup
bb branch delete feature/payment-integration
```

## Configuration

### Environment Variables
The CLI reads configuration from:
1. Command line arguments
2. `.betterbase-context.json` (auto-generated)
3. Environment variables
4. Project `betterbase.config.ts`

### .betterbase-context.json
This file is automatically generated and managed by the CLI. It contains:
- Project ID
- Environment configuration
- Database connection info
- Storage bucket names
- Webhook configurations
- Function definitions
- Branching settings

**Never manually edit this file** - it's managed by the CLI.

### betterbase.config.ts
Project-specific configuration lives in `betterbase.config.ts`:
```typescript
import { defineConfig } from '@betterbase/core'

export default defineConfig({
  project: { name: 'my-app' },
  provider: {
    type: 'postgres',
    connectionString: process.env.DATABASE_URL
  },
  storage: {
    provider: 's3',
    bucket: process.env.STORAGE_BUCKET,
    region: 'us-west-2'
  },
  webhooks: [
    {
      id: 'order-events',
      table: 'orders',
      events: ['INSERT', 'UPDATE', 'DELETE'],
      url: process.env.ORDER_WEBHOOK_URL,
      secret: process.env.ORDER_WEBHOOK_SECRET
    }
  ],
  branching: {
    enabled: true,
    maxPreviews: 10
  }
})
```

## Extending the CLI

### Creating Custom Commands
The CLI is built with Commander.js and can be extended:

```typescript
// In your project's cli-extensions.ts
import { Command } from 'commander'
import { createProgram } from '@betterbase/cli'

const program = createProgram()

program
  .command('custom')
  .description('My custom command')
  .argument('<arg>', 'An argument')
  .option('-o, --option <value>', 'An option')
  .action((arg, options) => {
    console.log(`Running custom command with ${arg} and ${options.option}`)
  })

program.parse()
```

### Hook System
The CLI provides hooks for extending functionality:
- `preAction`: Runs before any command (used for auth checking)
- `postAction`: Runs after any command
- `command:<name>`: Runs before specific command

### Adding New Commands
To add a new command to the core CLI:
1. Create command file in `src/commands/`
2. Implement the command logic
3. Export and register in `src/index.ts`
4. Update documentation

## Best Practices

### Authentication
1. **Login Regularly**: Run `bb login` to refresh authentication token
2. **Use Environment Variables**: Store sensitive config in env vars
3. **Check Permissions**: Ensure CLI has required permissions for operations
4. **Token Management**: CLI automatically handles token storage and refresh

### Project Structure
1. **Standard Layout**: Follow BetterBase project structure conventions
2. **Config Separation**: Keep secrets out of version control
3. **Consistent Naming**: Use consistent naming for resources
4. **Documentation**: Document custom configurations and extensions

### Development Workflow
1. **Use bb dev**: Keep development watcher running
2. **Preview Changes**: Use `bb migrate preview` before applying
3. **Test Functions Locally**: Use `bb function dev` before deploying
4. **Check Logs**: Use `bb function logs` and `bb webhook logs` for debugging

### Production Deployment
1. **Confirm Production Migrations**: Always confirm before running `bb migrate production`
2. **Use Sync Env**: Use `--sync-env` flag when deploying functions
3. **Monitor Previews**: Regularly clean up old preview environments
4. **Backup Data**: Always backup before destructive operations

### Troubleshooting
1. **Check Logs**: Use `bb function logs` and `bb webhook logs`
2. **Verify Auth**: Run `bb login` if getting authentication errors
3. **Check Context**: Delete `.betterbase-context.json` and re-run `bb dev` if needed
4. **Update CLI**: Keep CLI updated with `bun add -g @betterbase/cli@latest`

## Related Modules
- [Core SDK](./../core/overview.md): Core functionality accessed by CLI
- [Client SDK](./../client/overview.md): Client-side SDK
- [Shared Utilities](./../shared/overview.md): Shared types and utilities
- [Configuration](./../core/config.md): Configuration schema and validation

## Versioning

### CLI Version
Matches the `@betterbase/cli` package version
Check version with: `bb version` or `bb -v`

### Breaking Changes
- Major version bumps for breaking changes
- Deprecation warnings with migration paths
- Backward compatibility maintained for 6 months after deprecation

### Update Schedule
- Regular updates every 2-4 weeks
- Security patches as needed
- Feature releases monthly
- LTS versions quarterly

## Support

### Documentation
- [CLI Reference](https://betterbase.dev/docs/cli)
- [Command Guides](https://betterbase.dev/docs/cli/commands)
- [Examples](https://betterbase.dev/examples/cli)

### Community
- [GitHub Discussions](https://github.com/betterbase/cli/discussions)
- [Discord Channel](https://discord.gg/betterbase)
- [Twitter](https://twitter.com/betterbase)

### Reporting Issues
- [GitHub Issues](https://github.com/betterbase/cli/issues)
- [Bug Report Template](https://github.com/betterbase/cli/blob/main/.github/ISSUE_TEMPLATE/bug_report.md)
- [Feature Request Template](https://github.com/betterbase/cli/blob/main/.github/ISSUE_TEMPLATE/feature_request.md)

## License

[MIT License](LICENSE.md)

© 2023 BetterBase LLC.