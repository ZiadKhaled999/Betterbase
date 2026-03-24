# Installation

This guide covers how to install and set up BetterBase in your development environment.

## Prerequisites

Before installing BetterBase, ensure you have the following:

- **Bun** (v1.0+) - The JavaScript runtime powering BetterBase
- **Git** - For version control
- **Node.js** (v18+) - Required for some optional tools

### Installing Bun

BetterBase requires Bun. Install it using one of the following methods:

```bash
# macOS/Linux (via curl)
curl -fsSL https://bun.sh/install | bash

# Windows (via PowerShell)
powershell -Command "irm bun.sh/install.ps1 | iex"

# Via npm
npm install -g bun

# Via brew
brew install bun
```

Verify the installation:

```bash
bun --version
```

## Installing BetterBase CLI

The BetterBase CLI (`bb`) is your primary tool for managing projects and deployments.

### Global Installation

```bash
# Install globally via Bun
bun add -g @betterbase/cli

# Verify installation
bb --version
```

### Local Installation

Alternatively, install locally in your project:

```bash
# Add as dev dependency
bun add -D @betterbase/cli

# Run via npx
npx bb --version
```

Or add to your `package.json` scripts:

```json
{
  "scripts": {
    "bb": "bb"
  }
}
```

Then run with `bun run bb`.

## Installing Core Packages

For backend development, install the core package:

```bash
bun add @betterbase/core
```

For frontend development, install the client SDK:

```bash
bun add @betterbase/client
```

## Project Initialization

Create your first BetterBase project:

```bash
# Create a new project
bb init my-app

# Navigate to the project
cd my-app

# Install dependencies
bun install
```

This creates the following project structure:

```
my-app/
├── betterbase.config.ts    # Project configuration
├── drizzle.config.ts       # Database configuration
├── src/
│   ├── db/
│   │   ├── schema.ts       # Database schema
│   │   └── migrate.ts      # Migration utilities
│   ├── functions/          # Serverless functions
│   ├── auth/               # Authentication setup
│   └── routes/             # API routes
└── package.json
```

## Environment Setup

### Development Environment

For local development, BetterBase uses SQLite by default:

```bash
# Start development server
bb dev
```

Your API will be available at `http://localhost:3000`.

### Production Environment

Set up environment variables for production:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/db

# Authentication
AUTH_SECRET=your-secret-key-min-32-chars
AUTH_URL=https://your-domain.com

# Storage (optional)
STORAGE_PROVIDER=s3
STORAGE_BUCKET=your-bucket
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

See the [Configuration Guide](./configuration.md) for all available options.

## Supported Databases

BetterBase supports multiple database providers:

| Provider | Use Case | Connection String |
|----------|----------|-------------------|
| **SQLite** | Local development | `file:./dev.db` |
| **PostgreSQL** | Production | `postgres://...` |
| **Neon** | Serverless | `postgres://...` |
| **Turso** | Edge/Serverless | libSQL URL |
| **PlanetScale** | Serverless MySQL | MySQL URL |
| **Supabase** | Supabase hosted | `postgres://...` |

## Verifying Your Setup

Run the health check to verify everything is working:

```bash
# The development server should show:
# - http://localhost:3000 - API root
# - http://localhost:3000/graphql - GraphQL playground
# - http://localhost:3000/api/auth/* - Auth endpoints
# - http://localhost:3000/storage/* - Storage endpoints
```

## Next Steps

- [Quick Start Guide](./quick-start.md) - Get running in 5 minutes
- [Your First Project](./your-first-project.md) - Build a complete application
- [Configuration](./configuration.md) - Customize your setup
