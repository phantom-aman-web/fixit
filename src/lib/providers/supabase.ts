import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import type { StorageProvider, StoredFile } from "@/lib/providers";
import { getEnvConfig } from "@/lib/env";

export class SupabaseStorageProvider implements StorageProvider {
  private client: SupabaseClient;
  private bucket: string;

  constructor() {
    const config = getEnvConfig();
    if (!config.supabaseUrl || !config.supabaseServiceRoleKey || !config.supabaseStorageBucket) {
      throw new Error("Missing Supabase configuration for StorageProvider");
    }

    // Initialize the Supabase client with the Service Role Key.
    // This provides full access to the project's storage without requiring RLS bypass per request,
    // because FixIt handles all authorization itself via PostgreSQL relationships and RBAC before this is called.
    this.client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });
    this.bucket = config.supabaseStorageBucket;
  }

  private safeKey(key: string): string {
    // Only allow alphanumeric, dashes, and slashes (for folders). No directory traversal allowed.
    if (!/^[a-zA-Z0-9-\/]+$/.test(key) || key.includes("..")) {
      throw new Error("Invalid storage key");
    }
    return key;
  }

  async save(buffer: Buffer, fileName: string, mimeType: string): Promise<StoredFile> {
    const key = `files/${randomUUID()}`;
    // Security: Only allow safe image and document mime types
    const allowedMimeTypes = [
      "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif",
      "application/pdf", "text/plain"
    ];
    if (!allowedMimeTypes.includes(mimeType)) {
      throw new Error(`Unsupported MIME type: ${mimeType}`);
    }

    const { error } = await this.client.storage.from(this.bucket).upload(key, buffer, {
      contentType: mimeType,
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    return { key, fileName, mimeType, sizeBytes: buffer.byteLength };
  }

  async read(key: string): Promise<{ buffer: Buffer; fileName: string; mimeType: string } | null> {
    const k = this.safeKey(key);
    const { data, error } = await this.client.storage.from(this.bucket).download(k);

    if (error || !data) {
      return null;
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = data.type || "application/octet-stream";

    return { buffer, fileName: k, mimeType };
  }

  async delete(key: string): Promise<void> {
    const k = this.safeKey(key);
    const { error } = await this.client.storage.from(this.bucket).remove([k]);
    
    if (error) {
      throw new Error(`Supabase delete failed: ${error.message}`);
    }
  }

  publicUrl(key: string): string {
    const k = this.safeKey(key);
    // Returns a signed URL valid for 5 minutes (300 seconds)
    // We cannot do this synchronously using the Supabase async API, so publicUrl won't work perfectly.
    // Since publicUrl must be synchronous in the interface, we'll throw an error and force async signed URL generation via an API route.
    throw new Error("Synchronous publicUrl is unsupported for Supabase private buckets. Use signed URLs via the API.");
  }

  async getSignedUrl(key: string, expiresIn: number = 300): Promise<string> {
    const k = this.safeKey(key);
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUrl(k, expiresIn);
    
    if (error || !data) {
      throw new Error(`Failed to generate signed URL: ${error?.message || "Unknown error"}`);
    }
    
    return data.signedUrl;
  }
}
