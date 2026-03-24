# Storage

BetterBase provides file storage with S3-compatible API and built-in policy engine.

## Features

- **S3-Compatible** - Works with AWS S3, Cloudflare R2, Backblaze B2, MinIO
- **Policy Engine** - Fine-grained access control
- **Image Transformations** - On-the-fly resizing, cropping, format conversion
- **Signed URLs** - Secure access to private files
- **Bucket Management** - Multiple buckets per project

## Quick Setup

```bash
# Initialize storage
bb storage init
```

## Configuration

```typescript
// betterbase.config.ts
export default defineConfig({
  storage: {
    provider: 's3',  // s3, r2, backblaze, minio, managed
    bucket: 'my-app-uploads',
    region: 'us-west-2',
    policies: [
      {
        bucket: 'avatars',
        operation: 'upload',
        expression: 'auth.uid() != null'
      },
      {
        bucket: 'avatars',
        operation: 'download',
        expression: 'true'
      }
    ]
  }
})
```

## Using the Client SDK

### Upload File

```typescript
import { createClient } from '@betterbase/client'

const client = createClient({ url: 'http://localhost:3000' })

// Upload file
const { data, error } = await client.storage.upload('avatars', 'user.png', fileBlob)

// Upload with custom path
const { data, error } = await client.storage.upload('documents', 'folder/file.pdf', file)
```

### Download File

```typescript
// Download file
const { data, error } = await client.storage.download('avatars/user.png')

// Get blob
const blob = data
```

### Get Public URL

```typescript
// Get public URL for a file
const { data: { url } } = client.storage.getPublicUrl('avatars', 'user.png')
```

### Delete File

```typescript
// Delete file
await client.storage.remove('avatars/user.png')
```

### List Files

```typescript
// List files in bucket
const { data, error } = await client.storage.list('avatars')
```

## Server-Side Usage

```typescript
import { storage } from '@betterbase/core/storage'

// Upload
await storage.upload('avatars', 'user.png', fileBuffer)

// Download
const file = await storage.download('avatars', 'user.png')

// Generate signed URL
const signedUrl = await storage.signUrl('avatars', 'user.png', {
  expiresIn: 3600 // seconds
})

// Delete
await storage.remove('avatars', 'user.png')
```

## Image Transformations

Transform images on-the-fly:

```typescript
// Resize
const url = client.storage.getPublicUrl('images', 'photo.jpg', {
  transform: {
    width: 800,
    height: 600,
    fit: 'cover'
  }
})

// Crop
const url = client.storage.getPublicUrl('images', 'photo.jpg', {
  transform: {
    width: 200,
    height: 200,
    fit: 'crop',
    position: 'center'
  }
})

// Format conversion
const url = client.storage.getPublicUrl('images', 'photo.jpg', {
  transform: {
    format: 'webp',
    quality: 80
  }
})
```

Transform options:
- `width`, `height` - Target dimensions
- `fit` - `cover`, `contain`, `fill`, `inside`, `outside`
- `position` - `top`, `bottom`, `left`, `right`, `center`
- `format` - `webp`, `jpg`, `png`, `avif`
- `quality` - 1-100

## Storage Policies

Define access policies in configuration:

```typescript
storage: {
  policies: [
    // Allow authenticated users to upload avatars
    {
      bucket: 'avatars',
      operation: 'upload',
      expression: 'auth.uid() != null'
    },
    // Allow public read access
    {
      bucket: 'avatars',
      operation: 'download',
      expression: 'true'
    },
    // Only owner can delete
    {
      bucket: 'documents',
      operation: 'delete',
      expression: 'auth.uid() == resource.userId'
    }
  ]
}
```

Policy expressions support:
- `auth.uid()` - Current user ID
- `auth.role()` - User role (admin, user)
- `resource.*` - File metadata

## Environment Variables

```bash
# Storage provider
STORAGE_PROVIDER=s3

# S3 configuration
STORAGE_BUCKET=my-bucket
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

# Or use R2 (Cloudflare)
STORAGE_PROVIDER=r2
```

## CLI Commands

```bash
# Initialize storage
bb storage init

# List buckets
bb storage list

# Upload file
bb storage upload ./image.jpg -b avatars

# Download file
bb storage download avatars/image.jpg -o ./downloaded.jpg
```

## Best Practices

1. **Use policies** - Always define access policies
2. **Validate file types** - Restrict allowed MIME types
3. **Set size limits** - Configure max file size
4. **Use CDN** - Consider CDN for public assets
5. **Compress images** - Use transformations for optimization

## Related

- [Configuration](../getting-started/configuration.md) - Storage config
- [Client SDK](../api-reference/client-sdk.md) - Storage API
- [Functions](./functions.md) - Process uploaded files
