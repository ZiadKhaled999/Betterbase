# BetterBase Templates

Pre-configured project templates for getting started quickly with BetterBase.

## Table of Contents
- [Overview](#overview)
- [Template Types](#template-types)
  - [Base Template](#base-template)
  - [Auth Template](#auth-template)
- [Usage](#usage)
- [Customization](#customization)
- [Best Practices](#best-practices)
- [Extending Templates](#extending-templates)

## Overview

BetterBase provides starter templates that include pre-configured project structures, development workflows, and common integrations. These templates help you get started quickly by providing:

- **Ready-to-run projects**: No configuration needed to start development
- **Best practices**: Follows BetterBase recommended project structure
- **Common integrations**: Pre-configured for database, auth, storage, etc.
- **Development tools**: Includes scripts for migrations, testing, and building
- **TypeScript support**: Full type safety with strict mode enabled
- **Modern tooling**: Uses Bun runtime for fast execution

Templates are located in the `/templates` directory and can be used as starting points for new projects or as references for project structure.

## Template Types

### Base Template
The Base Template provides a minimal BetterBase project with:
- Bun runtime for fast execution
- TypeScript strict mode for type safety
- Hono API server for lightweight, fast web APIs
- Drizzle ORM with SQLite default for easy local development
- Zod validation for request/response schema validation
- Realtime WebSocket support
- Environment variable validation
- Basic project structure with routes, middleware, and libs

**Location**: `/templates/base/`

**Features**:
- Simple CRUD API structure
- Health check endpoint
- User routes example
- Storage routes placeholder
- Middleware for validation
- Library utilities for env and realtime
- Database schema and migration files
- BetterBase and Drizzle configuration files

### Auth Template
The Auth Template extends the base template with complete authentication using BetterAuth:
- Email & password authentication (signup, signin, signout)
- Social OAuth providers (Google, GitHub, etc.) - ready to configure
- Session management with automatic handling
- Protected routes middleware
- TypeScript support with full type inference
- Complete API endpoints for auth flows
- Example protected routes

**Location**: `/templates/auth/`

**Features**:
- All base template features PLUS:
- Complete authentication system
- Auth middleware for route protection
- Auth API endpoints (signup, signin, signout, etc.)
- Session handling with cookies
- Environment variable configuration for auth
- Database schema including auth tables
- Example protected route implementation
- Client usage examples

## Usage

### Creating a Project from Template
```bash
# Clone the repository (if you haven't already)
git clone https://github.com/betterbase/betterbase.git
cd betterbase

# Use base template as starting point
cp -r templates/base ./my-new-project
cd my-new-project

# Install dependencies
bun install

# Set up environment variables (copy .env.example if exists)
cp .env.example .env  # or create .env manually

# Run database migrations
bun run db:generate   # Generate migration from schema
bun run db:push       # Apply migration to database

# Start development server
bun run dev

# For auth template, also set auth-specific env vars:
# AUTH_SECRET=your-secret-key
# AUTH_URL=http://localhost:3000
```

### Using as Reference
Templates can also be used as references for project structure:
```bash
# View base template structure
ls -la templates/base/

# View auth template structure  
ls -la templates/auth/

# Check specific files
cat templates/base/src/db/schema.ts
cat templates/auth/src/auth/index.ts
```

## Customization

### Environment Variables
Each template uses environment variables for configuration:

**Base Template** (`src/lib/env.ts`):
```typescript
export const NODE_ENV = process.env.NODE_ENV ?? 'development';
export const PORT = Number(process.env.PORT) ?? 3000;
export const DB_PATH = process.env.DB_PATH ?? 'local.db';
```

**Auth Template** (requires):
```env
AUTH_SECRET=your-secret-key-change-in-production
AUTH_URL=http://localhost:3000
```

### Database Configuration
Templates default to SQLite for easy local development:
- File-based storage (`local.db` by default)
- No external database required for development
- Easy to switch to PostgreSQL/MySQL/etc. for production

To change database provider:
1. Update `betterbase.config.ts` provider settings
2. Set appropriate environment variables (`DATABASE_URL`, etc.)
3. Update `drizzle.config.ts` if needed
4. Regenerate migrations: `bun run db:generate`

### Adding Features
Templates are designed to be extended:
- **Storage**: Uncomment and configure storage in `betterbase.config.ts`
- **Webhooks**: Uncomment and configure webhooks in `betterbase.config.ts`
- **GraphQL**: Already enabled in templates, customize as needed
- **Functions**: Add functions in `src/functions/` directory
- **Middleware**: Add custom middleware in `src/middleware/`
- **Routes**: Add new route files in `src/routes/`

## Best Practices

### Project Structure
1. **Follow Convention**: Keep the standard directory structure
2. **Separate Concerns**: Routes, middleware, libs, and db should be separate
3. **Group Related Code**: Keep related functionality together
4. **Name Consistently**: Use consistent naming for files and functions
5. **Keep it Simple**: Start minimal and add complexity as needed

### Development Workflow
1. **Use Dev Scripts**: Leverage `bun run dev` for auto-reload
2. **Generate Migrations**: Use `bun run db:generate` after schema changes
3. **Test Frequently**: Run tests with `bun run test` during development
4. **Watch Logs**: Monitor console output for errors and warnings
5. **Environment Separation**: Use different configs for dev/staging/prod

### Security
1. **Validate Inputs**: Use Zod middleware for request validation
2. **Use Environment Secrets**: Never hardcode secrets in code
3. **Implement Authentication**: Protect sensitive routes with auth middleware
4. **Keep Dependencies Updated**: Regularly update packages
5. **Use HTTPS**: Always use HTTPS in production

### Performance
1. **Database Indexes**: Add indexes for frequently queried columns
2. **Cache Appropriately**: Cache expensive operations when beneficial
3. **Optimize Assets**: Minify and compress static assets
4. **Connection Pooling**: Configure database connection pool size
5. **Enable Compression**: Use gzip/brotli for HTTP responses

### Maintainability
1. **Document Code**: Comment complex logic and public APIs
2. **Write Tests**: Test critical functionality
3. **Use Linting**: Implement code linting for consistency
4. **Review Dependencies**: Audit dependencies for security and maintenance
5. **Keep Changelog**: Document changes for future reference

## Extending Templates

### Adding New Features
To extend a template with new functionality:

#### Adding Storage Support
1. Uncomment storage section in `betterbase.config.ts`
2. Set storage provider and bucket:
   ```typescript
   storage: {
     provider: 's3',
     bucket: 'my-bucket',
     region: 'us-west-2'
   }
   ```
3. Set required environment variables:
   ```env
   STORAGE_PROVIDER=s3
   STORAGE_BUCKET=my-bucket
   AWS_ACCESS_KEY_ID=your-key
   AWS_SECRET_ACCESS_KEY=your-secret
   AWS_REGION=us-west-2
   ```

#### Adding Webhooks
1. Uncomment webhooks section in `betterbase.config.ts`
2. Configure webhook endpoints:
   ```typescript
   webhooks: [
     {
       id: 'user-events',
       table: 'users',
       events: ['INSERT', 'UPDATE', 'DELETE'],
       url: process.env.USER_WEBHOOK_URL!,
       secret: process.env.USER_WEBHOOK_SECRET!,
       enabled: true,
     }
   ]
   ```
3. Set environment variables:
   ```env
   USER_WEBHOOK_URL=https://example.com/webhook
   USER_WEBHOOK_SECRET=your-webhook-secret
   ```

#### Adding Custom Middleware
1. Create new middleware file in `src/middleware/`:
   ```typescript
   // src/middleware/logging.ts
   export const logger = async (c: Context, next: () => Promise<void>) => {
     const start = Date.now();
     await next();
     const ms = Date.now() - start;
     console.log(`${c.req.method} ${c.req.path} - ${ms}ms`);
   };
   ```
2. Import and use in routes:
   ```typescript
   // src/routes/index.ts
   import { logger } from '../middleware/logging';
   
   const app = new Hono()
     .basePath('/api')
     .use('*', logger)
     .route('/users', usersRoute);
   ```

#### Adding Environment Variables
1. Add to validation file (`src/lib/env.ts` for base template):
   ```typescript
   export const FEATURE_FLAG = process.env.FEATURE_FLAG ?? 'false';
   ```
2. Add to `.env.example`:
   ```env
   FEATURE_FLAG=true
   ```
3. Use in application code:
   ```typescript
   if (FEATURE_FLAG === 'true') {
     // Enable feature
   }
   ```

## Template Maintenance

### Keeping Templates Updated
Templates should be updated regularly to:
- Incorporate new BetterBase features
- Fix bugs and security issues
- Update dependencies to latest versions
- Improve documentation and examples
- Align with evolving best practices

### Version Compatibility
Templates are designed to work with:
- **BetterBase CLI**: Latest version
- **Core SDK**: Compatible version range
- **Client SDK**: Compatible version range
- **Node.js/Bun**: LTS versions
- **Database Drivers**: Latest stable versions

### Contributing to Templates
To contribute improvements to templates:
1. Fork the BetterBase repository
2. Make changes to template directories
3. Test changes thoroughly
4. Submit pull request with clear description
5. Follow contribution guidelines

## Related Resources

### BetterBase Documentation
- [Core SDK](./../core/overview.md) - Core functionality
- [Client SDK](./../client/overview.md) - Client-side SDK
- [CLI Reference](./../cli/overview.md) - Command-line interface
- [Shared Utilities](./../shared/overview.md) - Shared types and utilities

### Learning from Templates
- [Base Template Guide](https://betterbase.dev/docs/templates/base)
- [Auth Template Guide](https://betterbase.dev/docs/templates/auth)
- [Migration Guides](https://betterbase.dev/docs/migration)
- [Best Practices](https://betterbase.dev/docs/best-practices)

### Community Examples
- [Template Showcase](https://betterbase.dev/templates/showcase)
- [Starter Projects](https://betterbase.dev/examples/starter-projects)
- [Migration Examples](https://betterbase.dev/examples/migrations)

---

*This document is part of the BetterBase documentation suite.*
*Last updated: 2026-03-26*