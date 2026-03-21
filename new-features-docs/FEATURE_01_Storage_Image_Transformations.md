# Feature 1: Storage Image Transformations

**Priority**: High (Week 5-7)  
**Complexity**: Medium  
**Dependencies**: Structured Logging  
**Estimated Effort**: 2-3 weeks

---

## Problem Statement

Currently, when users upload images to BetterBase storage, they receive the original file with no optimization. This creates several problems:

1. **Performance**: Users download full 2-3MB images even when they need thumbnails
2. **Bandwidth Waste**: Mobile users consume unnecessary data
3. **External Dependencies**: Developers bolt on Cloudinary/Imgix ($99+/month)
4. **Manual Work**: Developers pre-generate multiple sizes before upload

**Example Pain Point**:
```typescript
// User uploads profile photo (2MB, 3000x3000px)
await storage.from('avatars').upload('profile.jpg', file);

// Frontend needs 100x100 thumbnail
// ❌ Current: Downloads entire 2MB image, resizes in browser (slow!)
```

---

## Solution Overview

Implement **on-demand image transformations** using the Sharp library (industry standard used by Vercel, Netlify, Cloudflare). Transformations are applied via URL query parameters and cached in the storage bucket to avoid re-processing.

**After Implementation**:
```typescript
// Get optimized thumbnail
const url = storage.from('avatars').getPublicUrl('profile.jpg', {
  transform: { width: 100, height: 100, format: 'webp' }
});
// Returns: .../profile.jpg?width=100&height=100&format=webp
// Response: 5KB WebP image (vs 2MB original)
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Client Request                                             │
│  GET /storage/v1/object/public/avatars/user.jpg            │
│      ?width=400&height=300&format=webp&quality=80          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Storage Route Handler (Hono)                               │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 1. Parse query params → ImageTransformOptions      │    │
│  │ 2. Generate cache key (MD5 hash of options)        │    │
│  │ 3. Build cache path: cache/user_a1b2c3d4.webp     │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Check Cache in S3 Bucket                                   │
│  ┌─────────────────────┐                                    │
│  │ cache/user_a1b2c3d4.webp exists?                        │
│  └─────────────────────┘                                    │
│         │                                                    │
│         ├─ YES ──► Return cached file (instant response)   │
│         │                                                    │
│         └─ NO  ──► ┌───────────────────────────────────┐   │
│                    │ 1. Download original from S3      │   │
│                    │ 2. Transform with Sharp           │   │
│                    │ 3. Upload transformed to cache/   │   │
│                    │ 4. Return transformed image       │   │
│                    └───────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Key Design Decisions**:
- **Caching Strategy**: Store transformed images in `cache/` directory within the same bucket (not ephemeral memory)
- **Cache Key**: MD5 hash of transform options ensures deterministic filenames
- **URL Pattern**: Query params on existing storage URLs (backward compatible)
- **Supported Formats**: WebP (modern), JPEG (legacy), PNG (lossless), AVIF (future)

---

## Implementation Steps

### Step 1: Install Sharp Dependency

**File**: `packages/core/package.json`

**Action**: Install Sharp library

```bash
cd packages/core
bun add sharp
```

**Verification**:
```bash
# Check that sharp appears in dependencies
cat package.json | grep sharp
# Should output: "sharp": "^0.33.x"
```

**Important Notes**:
- Sharp uses native bindings - must be installed in the package that uses it
- Sharp is platform-specific (will auto-download correct binaries for your OS)
- If deployment fails, ensure Docker/deployment target matches dev architecture

---

### Step 2: Define Transform Types

**File**: `packages/core/src/storage/types.ts`

**Action**: Add type definitions at the END of the file (after existing types)

```typescript
// ============================================================================
// IMAGE TRANSFORMATION TYPES
// ============================================================================

/**
 * Supported image transformation operations
 * Applied via URL query parameters
 */
export type ImageTransformOptions = {
  /** Resize width in pixels. Maintains aspect ratio if height not specified. Max: 4000 */
  width?: number;
  
  /** Resize height in pixels. Maintains aspect ratio if width not specified. Max: 4000 */
  height?: number;
  
  /** Output format. Default: original format */
  format?: 'webp' | 'jpeg' | 'png' | 'avif';
  
  /** Quality 1-100. Default: 80 for lossy formats, 100 for PNG */
  quality?: number;
  
  /** How to resize the image to fit dimensions. Default: 'cover' */
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
};

/**
 * Result of image transformation operation
 */
export type TransformResult = {
  /** Transformed image buffer */
  buffer: Buffer;
  
  /** Output format (webp, jpeg, png, etc) */
  format: string;
  
  /** File size in bytes */
  size: number;
  
  /** Image width in pixels */
  width: number;
  
  /** Image height in pixels */
  height: number;
};

/**
 * Cache key components for transformed images
 */
export type TransformCacheKey = {
  /** Original file path */
  path: string;
  
  /** MD5 hash of transform options (first 8 chars) */
  hash: string;
};
```

**Verification**:
```bash
cd packages/core
bun run build
# Should compile without errors
```

---

### Step 3: Create Image Transformer Module

**File**: `packages/core/src/storage/image-transformer.ts` (NEW FILE)

**Action**: Create this new file with the image transformation engine

```typescript
import sharp from 'sharp';
import { createHash } from 'crypto';
import type { ImageTransformOptions, TransformResult, TransformCacheKey } from './types';

/**
 * Image transformation engine using Sharp
 * 
 * Handles:
 * - Resizing with aspect ratio preservation
 * - Format conversion (JPEG → WebP, etc)
 * - Quality optimization
 * - Cache key generation
 * 
 * @example
 * const transformer = new ImageTransformer();
 * const result = await transformer.transform(imageBuffer, {
 *   width: 400,
 *   format: 'webp',
 *   quality: 80
 * });
 */
export class ImageTransformer {
  /**
   * Transform an image buffer according to options
   * 
   * @param buffer - Input image buffer (JPEG, PNG, WebP, AVIF)
   * @param options - Transformation options
   * @returns Transformed image with metadata
   * @throws Error if transformation fails (invalid format, corrupted image, etc)
   */
  async transform(
    buffer: Buffer,
    options: ImageTransformOptions
  ): Promise<TransformResult> {
    try {
      // Initialize Sharp pipeline
      let pipeline = sharp(buffer);

      // Step 1: Apply resize if width or height specified
      if (options.width || options.height) {
        pipeline = pipeline.resize({
          width: options.width,
          height: options.height,
          fit: options.fit || 'cover', // Default: crop to fit
          withoutEnlargement: true, // Don't upscale small images
        });
      }

      // Step 2: Apply format conversion
      if (options.format) {
        switch (options.format) {
          case 'webp':
            pipeline = pipeline.webp({ quality: options.quality || 80 });
            break;
          case 'jpeg':
            pipeline = pipeline.jpeg({ quality: options.quality || 80 });
            break;
          case 'png':
            // PNG is lossless, but we can still optimize compression
            pipeline = pipeline.png({ 
              quality: options.quality || 100,
              compressionLevel: 9 
            });
            break;
          case 'avif':
            // AVIF is newer format, better compression than WebP
            pipeline = pipeline.avif({ quality: options.quality || 80 });
            break;
        }
      }

      // Step 3: Execute transformation pipeline
      const outputBuffer = await pipeline.toBuffer({ resolveWithObject: true });

      return {
        buffer: outputBuffer.data,
        format: outputBuffer.info.format,
        size: outputBuffer.info.size,
        width: outputBuffer.info.width,
        height: outputBuffer.info.height,
      };
    } catch (error) {
      throw new Error(
        `Image transformation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate deterministic cache key for transformed image
   * 
   * Format: { path: "user.jpg", hash: "a1b2c3d4" }
   * 
   * Hash is MD5 of JSON-serialized options (first 8 chars for brevity)
   * Same options always produce same hash
   * 
   * @param path - Original file path
   * @param options - Transform options
   * @returns Cache key components
   */
  generateCacheKey(path: string, options: ImageTransformOptions): TransformCacheKey {
    // Create deterministic options object (sorted keys)
    const optionsString = JSON.stringify({
      w: options.width,
      h: options.height,
      f: options.format,
      q: options.quality,
      fit: options.fit,
    });
    
    // MD5 hash (first 8 chars is sufficient for cache key)
    const hash = createHash('md5')
      .update(optionsString)
      .digest('hex')
      .substring(0, 8);
    
    return { path, hash };
  }

  /**
   * Build full cache path from cache key
   * 
   * Examples:
   * - avatars/user.jpg + hash "a1b2c3d4" + format "webp" 
   *   → cache/avatars/user_a1b2c3d4.webp
   * - user.jpg + hash "x9y8z7" + format "jpeg"
   *   → cache/user_x9y8z7.jpeg
   * 
   * @param cacheKey - Cache key components
   * @param format - Output format (webp, jpeg, png, avif)
   * @returns Full cache path
   */
  buildCachePath(cacheKey: TransformCacheKey, format: string): string {
    const pathParts = cacheKey.path.split('/');
    const filename = pathParts.pop() || '';
    
    // Remove original extension
    const filenameWithoutExt = filename.replace(/\.[^.]+$/, '');
    
    const directory = pathParts.join('/');
    
    // Build: filename_hash.format
    const cachedFilename = `${filenameWithoutExt}_${cacheKey.hash}.${format}`;
    
    // Prepend cache/ directory
    return directory 
      ? `cache/${directory}/${cachedFilename}`
      : `cache/${cachedFilename}`;
  }

  /**
   * Parse transform options from URL query parameters
   * 
   * Validates all inputs to prevent abuse:
   * - Width/height must be 1-4000 (prevent memory exhaustion)
   * - Format must be whitelisted (prevent arbitrary file execution)
   * - Quality must be 1-100
   * - Fit must be valid Sharp option
   * 
   * @param queryParams - URL query parameters object
   * @returns Parsed options or null if no valid transforms
   * 
   * @example
   * parseTransformOptions({ width: "400", format: "webp" })
   * // Returns: { width: 400, format: "webp" }
   * 
   * parseTransformOptions({ width: "99999" }) 
   * // Returns: null (width exceeds limit)
   */
  parseTransformOptions(queryParams: Record<string, string>): ImageTransformOptions | null {
    const options: ImageTransformOptions = {};
    let hasOptions = false;

    // Parse width
    if (queryParams.width) {
      const width = parseInt(queryParams.width, 10);
      if (!isNaN(width) && width > 0 && width <= 4000) {
        options.width = width;
        hasOptions = true;
      }
    }

    // Parse height
    if (queryParams.height) {
      const height = parseInt(queryParams.height, 10);
      if (!isNaN(height) && height > 0 && height <= 4000) {
        options.height = height;
        hasOptions = true;
      }
    }

    // Parse format (whitelist only)
    if (queryParams.format && ['webp', 'jpeg', 'png', 'avif'].includes(queryParams.format)) {
      options.format = queryParams.format as 'webp' | 'jpeg' | 'png' | 'avif';
      hasOptions = true;
    }

    // Parse quality
    if (queryParams.quality) {
      const quality = parseInt(queryParams.quality, 10);
      if (!isNaN(quality) && quality >= 1 && quality <= 100) {
        options.quality = quality;
        hasOptions = true;
      }
    }

    // Parse fit mode (whitelist only)
    if (queryParams.fit && ['cover', 'contain', 'fill', 'inside', 'outside'].includes(queryParams.fit)) {
      options.fit = queryParams.fit as ImageTransformOptions['fit'];
      hasOptions = true;
    }

    return hasOptions ? options : null;
  }

  /**
   * Check if content type is an image that Sharp can process
   * 
   * Excludes:
   * - SVG (vector, not raster)
   * - Non-image types
   * 
   * @param contentType - MIME type (e.g., "image/jpeg")
   * @returns True if processable image
   */
  isImage(contentType: string | undefined): boolean {
    if (!contentType) return false;
    return contentType.startsWith('image/') && !contentType.includes('svg');
  }
}

/**
 * Singleton instance for convenience
 * Import this directly: `import { imageTransformer } from './image-transformer'`
 */
export const imageTransformer = new ImageTransformer();
```

**Verification**:
```bash
cd packages/core
bun run build
# Should compile without errors

# Optional: Test the transformer
bun test src/storage/image-transformer.test.ts
```

---

### Step 4: Update S3 Storage Adapter

**File**: `packages/core/src/storage/s3-adapter.ts`

**Action**: Add transform-aware download method

**FIND** the existing `download` method (around line 80-120):

```typescript
async download(bucket: string, path: string): Promise<Buffer> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: path,
    });

    const response = await this.client.send(command);
    // ... existing code to convert stream to buffer
  } catch (error) {
    // ... existing error handling
  }
}
```

**ADD** this new method **AFTER** the existing `download` method:

```typescript
/**
 * Download file with optional image transformation
 * 
 * Flow:
 * 1. If no transform options → return original file
 * 2. If transform options → check cache first
 * 3. If cached → return cached version
 * 4. If not cached → transform original, cache result, return
 * 
 * @param bucket - S3 bucket name
 * @param path - File path in bucket
 * @param transformOptions - Optional image transformation options
 * @returns Buffer and content type
 */
async downloadWithTransform(
  bucket: string,
  path: string,
  transformOptions?: ImageTransformOptions
): Promise<{ buffer: Buffer; contentType: string }> {
  // Import transformer (lazy import to avoid circular dependencies)
  const { imageTransformer } = await import('./image-transformer');

  // No transform requested - return original file
  if (!transformOptions) {
    const buffer = await this.download(bucket, path);
    
    // Get content type from S3 metadata
    const headCommand = new HeadObjectCommand({ Bucket: bucket, Key: path });
    const metadata = await this.client.send(headCommand);
    
    return { 
      buffer, 
      contentType: metadata.ContentType || 'application/octet-stream' 
    };
  }

  // Generate cache key for this transform
  const cacheKey = imageTransformer.generateCacheKey(path, transformOptions);
  const outputFormat = transformOptions.format || 'webp'; // Default to WebP
  const cachePath = imageTransformer.buildCachePath(cacheKey, outputFormat);

  // Try to get cached version first
  try {
    const cachedBuffer = await this.download(bucket, cachePath);
    const contentType = `image/${outputFormat}`;
    return { buffer: cachedBuffer, contentType };
  } catch (error) {
    // Cache miss - continue to transform
  }

  // Download original file
  const originalBuffer = await this.download(bucket, path);

  // Transform image
  const transformed = await imageTransformer.transform(originalBuffer, transformOptions);

  // Upload transformed image to cache (fire-and-forget, don't wait)
  // If upload fails, we still return the transformed image
  this.upload(bucket, cachePath, transformed.buffer, {
    contentType: `image/${transformed.format}`,
  }).catch((err) => {
    console.error('Failed to cache transformed image:', err);
  });

  return {
    buffer: transformed.buffer,
    contentType: `image/${transformed.format}`,
  };
}
```

**Verification**:
```bash
cd packages/core
bun run build
# Should compile without errors
```

---

### Step 5: Create Storage Routes (or Update Existing)

**File**: `apps/test-project/src/routes/storage.ts` (create if doesn't exist)

**Action**: Create Hono routes for storage access with transform support

```typescript
import { Hono } from 'hono';
import { storage } from '../lib/storage'; // Adjust import path
import { imageTransformer } from '@betterbase/core/storage/image-transformer';

const app = new Hono();

/**
 * GET /storage/v1/object/public/:bucket/*
 * Public file download with optional image transformations
 * 
 * Examples:
 * - /storage/v1/object/public/avatars/user.jpg
 *   → Returns original file
 * 
 * - /storage/v1/object/public/avatars/user.jpg?width=400&format=webp
 *   → Returns 400px wide WebP image
 * 
 * - /storage/v1/object/public/avatars/user.jpg?width=100&height=100&fit=cover
 *   → Returns 100x100 cropped thumbnail
 */
app.get('/storage/v1/object/public/:bucket/*', async (c) => {
  const bucket = c.req.param('bucket');
  const path = c.req.param('*'); // Wildcard captures rest of path
  const queryParams = c.req.query();

  try {
    // Parse transform options from query params
    const transformOptions = imageTransformer.parseTransformOptions(queryParams);

    // Get bucket client
    const bucketClient = storage.from(bucket);

    // Download with optional transform
    // Note: This assumes your storage client has the adapter exposed
    // You may need to adjust based on your actual storage implementation
    const result = await bucketClient.adapter.downloadWithTransform(
      bucket,
      path,
      transformOptions || undefined
    );

    // Set response headers
    c.header('Content-Type', result.contentType);
    c.header('Cache-Control', 'public, max-age=31536000, immutable'); // Cache for 1 year
    c.header('Content-Length', String(result.buffer.length));

    return c.body(result.buffer);
  } catch (error) {
    console.error('Storage download error:', error);
    return c.json({ error: 'File not found' }, 404);
  }
});

/**
 * GET /storage/v1/object/authenticated/:bucket/*
 * Authenticated file download with optional transforms
 * 
 * TODO: Add auth middleware to verify user has access
 */
app.get('/storage/v1/object/authenticated/:bucket/*', async (c) => {
  // For now, return 501 Not Implemented
  // You'll add auth middleware here later
  return c.json({ error: 'Authenticated downloads not yet implemented' }, 501);
});

export default app;
```

**Then register this route in your main app**:

**File**: `apps/test-project/src/routes/index.ts`

```typescript
import storageRoutes from './storage';

// ... existing routes ...

// Mount storage routes
app.route('/', storageRoutes);
```

**Verification**:
```bash
cd apps/test-project
bun run dev
# Server should start without errors

# Test in browser or curl:
# 1. Upload an image first
# 2. Access: http://localhost:3000/storage/v1/object/public/bucket/test.jpg
# 3. Access with transform: http://localhost:3000/storage/v1/object/public/bucket/test.jpg?width=400&format=webp
```

---

### Step 6: Update Client SDK

**File**: `packages/client/src/storage.ts`

**Action**: Add transform options to `getPublicUrl` method

**FIND** the `StorageBucketClient` class and the `getPublicUrl` method:

```typescript
getPublicUrl(path: string): PublicUrlResult {
  const publicUrl = `${this.baseUrl}/storage/v1/object/public/${this.bucketId}/${path}`;
  return { data: { publicUrl }, error: null };
}
```

**REPLACE** with this enhanced version:

```typescript
/**
 * Get public URL for a file with optional image transformations
 * 
 * @param path - File path in bucket
 * @param options - Optional transform options
 * @returns Public URL result
 * 
 * @example
 * // Original image
 * bucket.getPublicUrl('user.jpg')
 * // Returns: { data: { publicUrl: ".../user.jpg" }, error: null }
 * 
 * // Transformed image
 * bucket.getPublicUrl('user.jpg', {
 *   transform: { width: 400, format: 'webp' }
 * })
 * // Returns: { data: { publicUrl: ".../user.jpg?width=400&format=webp" }, error: null }
 */
getPublicUrl(
  path: string,
  options?: {
    transform?: {
      width?: number;
      height?: number;
      format?: 'webp' | 'jpeg' | 'png' | 'avif';
      quality?: number;
      fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
    };
  }
): PublicUrlResult {
  const baseUrl = `${this.baseUrl}/storage/v1/object/public/${this.bucketId}/${path}`;
  
  // No transforms - return base URL
  if (!options?.transform) {
    return { data: { publicUrl: baseUrl }, error: null };
  }

  // Build query string from transform options
  const params = new URLSearchParams();
  
  if (options.transform.width) {
    params.set('width', String(options.transform.width));
  }
  
  if (options.transform.height) {
    params.set('height', String(options.transform.height));
  }
  
  if (options.transform.format) {
    params.set('format', options.transform.format);
  }
  
  if (options.transform.quality) {
    params.set('quality', String(options.transform.quality));
  }
  
  if (options.transform.fit) {
    params.set('fit', options.transform.fit);
  }

  const urlWithTransforms = `${baseUrl}?${params.toString()}`;
  
  return { data: { publicUrl: urlWithTransforms }, error: null };
}
```

**Verification**:
```bash
cd packages/client
bun run build
# Should compile without errors
```

---

## Testing

### Manual Testing Checklist

1. **Upload test image**:
```bash
# Upload a large image (e.g., 2MB JPEG)
curl -X POST http://localhost:3000/storage/v1/object/public/test-bucket/large.jpg \
  -F "file=@large-image.jpg"
```

2. **Test original image** (no transform):
```bash
curl http://localhost:3000/storage/v1/object/public/test-bucket/large.jpg \
  --output original.jpg
  
# Check file size
ls -lh original.jpg
# Should be ~2MB
```

3. **Test width-only transform**:
```bash
curl "http://localhost:3000/storage/v1/object/public/test-bucket/large.jpg?width=400" \
  --output resized-400.jpg
  
ls -lh resized-400.jpg
# Should be significantly smaller
```

4. **Test WebP conversion**:
```bash
curl "http://localhost:3000/storage/v1/object/public/test-bucket/large.jpg?format=webp" \
  --output converted.webp
  
file converted.webp
# Should output: "converted.webp: RIFF (little-endian) data, Web/P image"
```

5. **Test combined (resize + format)**:
```bash
curl "http://localhost:3000/storage/v1/object/public/test-bucket/large.jpg?width=400&height=300&format=webp&quality=80" \
  --output optimized.webp
  
ls -lh optimized.webp
# Should be very small (e.g., 20-50KB)
```

6. **Test caching** (performance):
```bash
# First request (transform + cache)
time curl "http://localhost:3000/storage/v1/object/public/test-bucket/large.jpg?width=400&format=webp" > /dev/null

# Second request (cached)
time curl "http://localhost:3000/storage/v1/object/public/test-bucket/large.jpg?width=400&format=webp" > /dev/null

# Second request should be significantly faster
```

7. **Test invalid params** (should gracefully ignore):
```bash
# Invalid width (exceeds limit)
curl "http://localhost:3000/storage/v1/object/public/test-bucket/large.jpg?width=99999"
# Should return original image or error

# Invalid format
curl "http://localhost:3000/storage/v1/object/public/test-bucket/large.jpg?format=exe"
# Should ignore invalid format, return original
```

---

## Acceptance Criteria

- [ ] Sharp dependency installed in `packages/core/package.json`
- [ ] Transform types defined in `packages/core/src/storage/types.ts`
- [ ] `ImageTransformer` class created in `packages/core/src/storage/image-transformer.ts`
- [ ] S3 adapter has `downloadWithTransform` method
- [ ] Storage routes handle query params: `?width=X&height=Y&format=F&quality=Q&fit=M`
- [ ] Transformed images cached in `cache/` directory within bucket
- [ ] Cache uses deterministic MD5 hash keys
- [ ] Client SDK `getPublicUrl()` accepts optional `transform` object
- [ ] Test: Upload 2MB JPEG → request `?width=400&format=webp` → receive ~50KB WebP
- [ ] Test: Second request for same transform returns cached version (instant)
- [ ] Test: Invalid params (width=99999) ignored gracefully
- [ ] Test: Non-image files return original (no transformation)
- [ ] Test: SVG files return original (Sharp doesn't process SVG)

---

## Common Issues & Solutions

### Issue: "Sharp installation failed"
**Solution**: 
```bash
rm -rf node_modules
bun install --force
```

### Issue: "Image transformation timeout"
**Cause**: Very large images (>10MB)  
**Solution**: Add timeout to Sharp pipeline or reject large files upfront

### Issue: "Cache directory not created"
**Cause**: S3 doesn't have directory concept  
**Solution**: Verify first upload to `cache/` creates the "virtual directory"

### Issue: "Transformed images larger than original"
**Cause**: PNG quality too high  
**Solution**: Use WebP or JPEG for photos, reserve PNG for graphics/logos

---

## Performance Notes

- **First Request**: Transform time ~100-500ms depending on image size
- **Cached Requests**: <10ms (served directly from S3)
- **Memory Usage**: Sharp uses ~100MB per concurrent transformation
- **Recommendation**: Limit concurrent transformations or add queue for high traffic

---

## Next Steps After Implementation

1. **Add CDN** (optional): CloudFront/Cloudflare in front of storage URLs
2. **Monitoring**: Log slow transforms (>500ms) for optimization
3. **Cleanup**: Add cron job to delete old cached images (>30 days)
4. **Presets**: Add common size presets (`thumbnail`, `small`, `medium`, `large`)

---

**Feature Status**: Ready for implementation  
**Estimated Time**: 2-3 weeks  
**Start Date**: Week 5 (after Logging and Migrations are complete)
