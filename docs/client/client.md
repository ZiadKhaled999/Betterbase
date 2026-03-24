# @betterbase/client

Client-side SDK for BetterBase applications. Provides API client, real-time subscriptions, and storage management.

## Table of Contents
- [Overview](#overview)
- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
  - [Client](#client)
  - [Realtime](#realtime)
  - [Storage](#storage)
- [Examples](#examples)

## Overview

The client SDK enables developers to interact with BetterBase backends through a consistent interface. It provides:

### Key Features
- **API Client**: HTTP client with automatic authentication
- **Realtime Subscriptions**: Live updates via WebSockets
- **Storage Management**: File uploads/downloads with cloud storage integration
- **Error Handling**: Consistent error response format
- **Type Safety**: TypeScript definitions for all operations

### Installation
```bash
bun add @betterbase/client
```

## Usage

### Basic Setup
```typescript
import { createClient } from '@betterbase/client';

const client = createClient({
  url: 'https://api.betterbase.dev',
  key: 'your-api-key',
});
```

### API Client
```typescript
// Create client instance
const client = createClient({
  url: 'https://api.betterbase.dev',
  key: 'your-api-key',
});

// Make authenticated API request
const response = await client.fetch('/api/users', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${client.getToken()}` }
});
```

### Realtime Subscriptions
```typescript
// Subscribe to updates
const subscription = client.subscribe('users', (event) => {
  console.log('New user:', event.data);
});

// Unsubscribe
subscription.unsubscribe();
```

### Storage Management
```typescript
// Upload file
const upload = await client.upload('uploads', 'file.txt', file);

// Download file
const file = await client.download('uploads/file.txt');

// Remove file
await client.remove('uploads/file.txt');
```

## API Reference

### Client
```typescript
export interface Client {
  fetch(url: string, options?: RequestInit): Promise<Response>;
  
  realtime: Realtime;
  storage: Storage;
}
```

### Realtime
```typescript
export interface Realtime {
  subscribe(event: string, callback: (data: any) => void): () => void;
  unsubscribe(event: string, callback: (data: any) => void): void;
  
  unsubscribeAll(): void;
}
```

### Storage
```typescript
export interface Storage {
  upload(file: File): Promise<StorageResult>;
  download(path: string): Promise<Blob | null>;
  remove(path: string): Promise<void>;
  
  // Additional methods...
}
```

## Examples

### Basic Usage
```typescript
// Create client
const client = createClient({
  url: 'https://api.betterbase.dev',
  key: 'your-api-key',
});

// Make authenticated request
const response = await client.fetch('/api/users', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${client.getToken()}` }
});

// Handle response
if (response.ok) {
  const data = await response.json();
  console.log('Users:', data);
} else {
  console.error('Request failed:', await response.text());
}
```

### Real-time Updates
```typescript
// Subscribe to updates
const unsubscribe = client.subscribe('users', (event) => {
  console.log('New user:', event.data);
});

// Unsubscribe when done
unsubscribe();
```

### File Upload
```typescript
// Upload file
const upload = await client.upload('uploads', file);

// Download file
const file = await client.download('uploads/file.txt');

// Remove file
await client.remove('uploads/file.txt');
```

## Security Considerations

### Authentication
- All requests include authentication headers
- Token management through client instance
- Automatic token refresh

### Error Handling
- Consistent error format across all operations
- Detailed error messages for debugging
- Network error handling

### Data Validation
- Input validation for all API requests
- Type safety through TypeScript definitions
- Schema validation for storage operations

## Best Practices

### Error Handling
1. **Check response status**: Always check `response.ok` before processing
2. **Handle network errors**: Implement retry logic for transient errors
3. **Validate inputs**: Ensure all API requests have valid parameters

### Performance
1. **Batch requests**: Combine multiple operations into single requests
2. **Caching**: Implement client-side caching for frequently accessed data
3. **Connection pooling**: Reuse WebSocket connections
4. **Compression**: Enable gzip compression where possible

### Testing
1. **Unit tests**: Test individual methods in isolation
2. **Integration tests**: Test full API workflows
3. **Mocking**: Use mock responses for testing edge cases
4. **Performance testing**: Test under load conditions

## Related Modules
- [Configuration](./config.md): For BetterBase configuration
- [Realtime](./realtime.md): Real-time subscription management
- [Storage](./storage.md): File storage operations
- [Errors](./errors.md): Error handling utilities
- [Types](./types.md): TypeScript type definitions

## Versioning

### API Versioning
- All endpoints include version in path (e.g., `/api/v1/users`)
- Automatic versioning through client instance
- Backward compatibility maintained where possible

### Breaking Changes
- Major version bumps for breaking changes
- Deprecation warnings with migration paths
- Backward compatibility layers for 6 months

## Documentation Structure

### Public API
- Client class with public methods
- Real-time subscription management
- Storage operations

### Internal Implementation
- Private methods and utilities
- Error handling implementation
- Performance optimizations

## Maintenance

### Versioning
- Semantic versioning (SemVer)
- Major.minor.patch format
- Breaking changes documented in CHANGELOG.md

### Testing
- Unit tests for individual methods
- Integration tests for full workflows
- End-to-end tests for critical paths
- Performance regression tests

### Documentation Updates
- Automated documentation generation
- Versioned documentation for different API versions
- Changelog tracking
- Contributor guidelines

## Contributing

### Code of Conduct
- Follow BetterBase code standards
- Submit pull requests with tests
- Document changes in CHANGELOG.md
- Maintain backward compatibility

### Development Workflow
1. Fork repository
2. Create feature branch
3. Implement changes
4. Add tests
5. Submit pull request with description
6. Code review and approval
7. Merge into main branch

## Support

### Documentation
- [API Reference](https://betterbase.dev/docs/client)
- [Getting Started Guide](https://betterbase.dev/docs/getting-started)
- [FAQ](https://betterbase.dev/docs/faq)

### Community
- [GitHub Discussions](https://github.com/betterbase/client/discussions)
- [Discord Channel](https://discord.gg/betterbase)
- [Twitter](https://twitter.com/betterbase)

### Reporting Issues
- [GitHub Issues](https://github.com/betterbase/client/issues)
- [Bug Report Template](https://github.com/betterbase/client/blob/main/.github/ISSUE_TEMPLATE/bug_report.md)
- [Feature Request Template](https://github.com/betterbase/client/blob/main/.github/ISSUE_TEMPLATE/feature_request.md)

## License

[MIT License](LICENSE.md)

## Acknowledgments
- [BetterBase Team](https://betterbase.dev)
- [Contributors](https://github.com/betterbase/client/graphs/contributors)
- [Open Source Community](https://opensource.org)

---

Generated with [BetterBase CLI](https://betterbase.dev)

© 2023 BetterBase LLC.