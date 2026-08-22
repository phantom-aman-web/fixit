import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { StorageProvider, StoredFile } from "@/lib/providers";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

function safeKey(key: string): string {
  // Prevent path traversal: only allow alnum/dash.
  if (!/^[a-zA-Z0-9-]+$/.test(key)) throw new Error("Invalid storage key");
  return key;
}

export class LocalStorageProvider implements StorageProvider {
  private dir = UPLOAD_DIR;

  private async ensure() {
    await fs.mkdir(this.dir, { recursive: true });
  }

  async save(buffer: Buffer, fileName: string, mimeType: string): Promise<StoredFile> {
    await this.ensure();
    const key = randomUUID();
    await fs.writeFile(path.join(this.dir, key), buffer);
    return { key, fileName, mimeType, sizeBytes: buffer.byteLength };
  }

  async read(key: string) {
    const k = safeKey(key);
    try {
      const buffer = await fs.readFile(path.join(this.dir, k));
      // We do not persist mime/name on disk separately in Phase 1 — callers pass
      // them through the DB (ProblemMedia). For the authed download route we
      // also read metadata from DB before calling read(); the fallbacks below
      // keep the interface self-contained.
      return { buffer, fileName: k, mimeType: "application/octet-stream" };
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    const k = safeKey(key);
    try {
      await fs.unlink(path.join(this.dir, k));
    } catch {
      /* ignore */
    }
  }

  publicUrl(key: string): string {
    return `/api/uploads/${encodeURIComponent(safeKey(key))}`;
  }
}

import { getEnvConfig } from "@/lib/env";
import { SupabaseStorageProvider } from "./supabase";

export const storage: StorageProvider =
  getEnvConfig().storageProvider === "supabase"
    ? new SupabaseStorageProvider()
    : new LocalStorageProvider();
