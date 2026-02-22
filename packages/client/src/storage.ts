import type { BetterBaseClient } from './client';
import type { BetterBaseResponse } from './types';
import { NetworkError } from './errors';

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface SignedUrlOptions {
  expiresIn?: number;
}

export interface StorageFile {
  name: string;
  size: number;
  lastModified: string;
}

export interface UploadResult {
  path: string;
  url: string;
}

export interface PublicUrlResult {
  publicUrl: string;
}

export interface SignedUrlResult {
  signedUrl: string;
}

export interface RemoveResult {
  message: string;
}

export class Storage {
  constructor(private client: BetterBaseClient) {}

  from(bucket: string): StorageBucketClient {
    return new StorageBucketClient(this.client, bucket);
  }
}

export class StorageBucketClient {
  constructor(
    private client: BetterBaseClient,
    private bucket: string
  ) {}

  /**
   * Upload a file to the storage bucket.
   * Makes HTTP request to the BetterBase API server (not directly to S3).
   */
  async upload(
    path: string,
    file: File | Blob | ArrayBuffer,
    options?: UploadOptions
  ): Promise<BetterBaseResponse<UploadResult>> {
    try {
      const headers: Record<string, string> = {};
      
      // Handle different file types
      let body: BodyInit;
      
      if (file instanceof ArrayBuffer) {
        // Convert ArrayBuffer to Blob if contentType is provided
        const blob = options?.contentType 
          ? new Blob([file], { type: options.contentType })
          : new Blob([file]);
        body = blob;
        if (options?.contentType) {
          headers['Content-Type'] = options.contentType;
        }
      } else if (file instanceof File) {
        body = file;
        if (options?.contentType) {
          headers['Content-Type'] = options.contentType;
        } else if (file.type) {
          headers['Content-Type'] = file.type;
        }
      } else {
        // It's a Blob
        body = file;
        if (options?.contentType) {
          headers['Content-Type'] = options.contentType;
        }
      }

      // Add metadata as custom headers if provided
      if (options?.metadata) {
        Object.entries(options.metadata).forEach(([key, value]) => {
          headers[`x-betterbase-meta-${key}`] = value;
        });
      }

      const response = await this.client.fetch(
        `${this.client.getUrl()}/api/storage/${encodeURIComponent(this.bucket)}/upload?path=${encodeURIComponent(path)}`,
        {
          method: 'POST',
          headers: {
            ...headers,
          },
          body,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          data: null,
          error: {
            message: errorData.message || `Upload failed with status ${response.status}`,
            name: 'UploadError',
          },
        };
      }

      const data = await response.json();
      return {
        data: {
          path: data.path,
          url: data.url,
        },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: new NetworkError(
          error instanceof Error ? error.message : 'Upload request failed',
          error
        ),
      };
    }
  }

  /**
   * Download a file from the storage bucket.
   * Makes HTTP request to the BetterBase API server (not directly to S3).
   */
  async download(path: string): Promise<BetterBaseResponse<Blob>> {
    try {
      const response = await this.client.fetch(
        `${this.client.getUrl()}/api/storage/${encodeURIComponent(this.bucket)}/${encodeURIComponent(path)}`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          data: null,
          error: {
            message: errorData.message || `Download failed with status ${response.status}`,
            name: 'DownloadError',
          },
        };
      }

      const blob = await response.blob();
      return {
        data: blob,
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: new NetworkError(
          error instanceof Error ? error.message : 'Download request failed',
          error
        ),
      };
    }
  }

  /**
   * Get the public URL for a file in the storage bucket.
   * Makes HTTP request to the BetterBase API server (not directly to S3).
   */
  async getPublicUrl(path: string): Promise<BetterBaseResponse<PublicUrlResult>> {
    try {
      const response = await this.client.fetch(
        `${this.client.getUrl()}/api/storage/${encodeURIComponent(this.bucket)}/${encodeURIComponent(path)}/public`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          data: null,
          error: {
            message: errorData.message || `Failed to get public URL with status ${response.status}`,
            name: 'PublicUrlError',
          },
        };
      }

      const data = await response.json();
      return {
        data: {
          publicUrl: data.publicUrl,
        },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: new NetworkError(
          error instanceof Error ? error.message : 'Public URL request failed',
          error
        ),
      };
    }
  }

  /**
   * Create a signed URL for a file in the storage bucket.
   * Makes HTTP request to the BetterBase API server (not directly to S3).
   */
  async createSignedUrl(
    path: string,
    options?: SignedUrlOptions
  ): Promise<BetterBaseResponse<SignedUrlResult>> {
    try {
      const url = new URL(
        `${this.client.getUrl()}/api/storage/${encodeURIComponent(this.bucket)}/${encodeURIComponent(path)}/sign`
      );
      
      if (options?.expiresIn) {
        url.searchParams.set('expiresIn', options.expiresIn.toString());
      }

      const response = await this.client.fetch(url.toString(), {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          data: null,
          error: {
            message: errorData.message || `Failed to create signed URL with status ${response.status}`,
            name: 'SignedUrlError',
          },
        };
      }

      const data = await response.json();
      return {
        data: {
          signedUrl: data.signedUrl,
        },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: new NetworkError(
          error instanceof Error ? error.message : 'Signed URL request failed',
          error
        ),
      };
    }
  }

  /**
   * Remove files from the storage bucket.
   * Makes HTTP request to the BetterBase API server (not directly to S3).
   */
  async remove(paths: string[]): Promise<BetterBaseResponse<RemoveResult>> {
    try {
      const response = await this.client.fetch(
        `${this.client.getUrl()}/api/storage/${encodeURIComponent(this.bucket)}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ paths }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          data: null,
          error: {
            message: errorData.message || `Remove failed with status ${response.status}`,
            name: 'RemoveError',
          },
        };
      }

      const data = await response.json();
      return {
        data: {
          message: data.message || 'Files removed successfully',
        },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: new NetworkError(
          error instanceof Error ? error.message : 'Remove request failed',
          error
        ),
      };
    }
  }

  /**
   * List files in the storage bucket with optional prefix filter.
   * Makes HTTP request to the BetterBase API server (not directly to S3).
   */
  async list(prefix?: string): Promise<BetterBaseResponse<StorageFile[]>> {
    try {
      const url = new URL(
        `${this.client.getUrl()}/api/storage/${encodeURIComponent(this.bucket)}`
      );
      
      if (prefix) {
        url.searchParams.set('prefix', prefix);
      }

      const response = await this.client.fetch(url.toString(), {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          data: null,
          error: {
            message: errorData.message || `List failed with status ${response.status}`,
            name: 'ListError',
          },
        };
      }

      const data = await response.json();
      return {
        data: data.files.map((file: { name: string; size: number; lastModified: string }) => ({
          name: file.name,
          size: file.size,
          lastModified: file.lastModified,
        })),
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: new NetworkError(
          error instanceof Error ? error.message : 'List request failed',
          error
        ),
      };
    }
  }
}
