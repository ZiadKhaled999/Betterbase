# BetterBase Documentation

Comprehensive documentation for the BetterBase platform, covering all packages, modules, and development workflows.

## Table of Contents
- [Getting Started](#getting-started)
- [Features](#features)
- [Guides](#guides)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Contributing](#contributing)

## Documentation Structure

The documentation is organized into logical sections for easy navigation:

```
/docs
├── getting-started/           # Getting started guides
│   ├── installation.md
│   ├── quick-start.md
│   ├── your-first-project.md
│   └── configuration.md
├── features/                  # Feature documentation
│   ├── authentication.md
│   ├── database.md
│   ├── storage.md
│   ├── realtime.md
│   ├── graphql.md
│   ├── functions.md
│   ├── webhooks.md
│   └── rls.md
├── guides/                    # Development guides
│   ├── deployment.md
│   ├── production-checklist.md
│   ├── monitoring.md
│   ├── scaling.md
│   └── security-best-practices.md
├── api-reference/             # API documentation
│   ├── client-sdk.md
│   ├── cli-commands.md
│   ├── rest-api.md
│   └── graphql-api.md
└── examples/                   # Example applications
    ├── todo-app.md
    ├── chat-app.md
    ├── blog.md
    └── ecommerce.md
```

## Getting Started

New to BetterBase? Start here:

1. [Installation](./getting-started/installation.md) - Install Bun and BetterBase CLI
2. [Quick Start](./getting-started/quick-start.md) - Get running in 5 minutes
3. [Your First Project](./getting-started/your-first-project.md) - Build a complete application
4. [Configuration](./getting-started/configuration.md) - Customize your setup

## Features

Learn about all BetterBase features:

- [Authentication](./features/authentication.md) - Email/password, OAuth, MFA
- [Database](./features/database.md) - Multi-provider database support
- [Storage](./features/storage.md) - S3-compatible file storage
- [Realtime](./features/realtime.md) - WebSocket subscriptions
- [GraphQL](./features/graphql.md) - Auto-generated GraphQL API
- [Functions](./features/functions.md) - Serverless functions
- [Webhooks](./features/webhooks.md) - Event-driven webhooks
- [RLS](./features/rls.md) - Row Level Security

## Guides

Development guides for production:

- [Deployment](./guides/deployment.md) - Deploy to various platforms
- [Production Checklist](./guides/production-checklist.md) - Pre-deployment checklist
- [Monitoring](./guides/monitoring.md) - Set up logging and metrics
- [Scaling](./guides/scaling.md) - Scale your application
- [Security Best Practices](./guides/security-best-practices.md) - Security hardening

## API Reference

Detailed API documentation:

- [Client SDK](./api-reference/client-sdk.md) - TypeScript client library
- [CLI Commands](./api-reference/cli-commands.md) - Command-line interface
- [REST API](./api-reference/rest-api.md) - REST API endpoints
- [GraphQL API](./api-reference/graphql-api.md) - GraphQL reference

## Examples

Complete example applications:

- [Todo App](./examples/todo-app.md) - Simple todo list with real-time sync
- [Chat App](./examples/chat-app.md) - Real-time messaging with presence
- [Blog](./examples/blog.md) - Blog with posts, comments, categories
- [E-commerce](./examples/ecommerce.md) - Store with cart, orders, payments

## Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- Git
- Node.js (v18+ for some optional tools)

## Installation

```bash
# Clone the repository
git clone https://github.com/betterbase/betterbase.git
cd betterbase

# Install dependencies
bun install
```

## First Steps

1. Review the [Installation Guide](./getting-started/installation.md)
2. Follow the [Quick Start](./getting-started/quick-start.md)
3. Build your first project with the [Your First Project](./getting-started/your-first-project.md) guide
4. Explore [Examples](./examples/) for complete applications

## Contributing

We welcome contributions to improve the documentation! To contribute:

1. Fork the repository
2. Make your changes to the appropriate markdown files in `/docs`
3. Ensure your changes are clear, accurate, and follow the existing style
4. Submit a pull request with a clear description of your changes

### Documentation Guidelines

- Use clear, concise language
- Provide code examples where appropriate
- Include links to related documentation
- Mark deprecated features clearly
- Keep examples up-to-date with current code
- Follow Markdown best practices

### Reporting Issues

If you find errors or omissions in the documentation:

- Check if the issue has already been reported
- Create a new issue with details about the problem
- Include the documentation page and section
- Suggest improvements if possible

## Versioning

This documentation corresponds to the current version of the BetterBase platform. For specific version documentation:

- Check the git tags for released versions
- Refer to the CHANGELOG.md for version-specific changes
- Documentation for older versions is available in the git history

## License

This documentation is part of the BetterBase platform and is licensed under the MIT License.

© 2026 BetterBase LLC. All rights reserved.