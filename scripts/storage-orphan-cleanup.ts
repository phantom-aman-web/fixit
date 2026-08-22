import { PrismaClient } from "@prisma/client";
import { getEnvConfig } from "../src/lib/env";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import fs from "fs/promises";

const prisma = new PrismaClient();
const config = getEnvConfig();

async function getSupabaseKeys(bucket: string): Promise<string[]> {
  const client = createClient(config.supabaseUrl!, config.supabaseServiceRoleKey!);
  // Note: Supabase list() returns max 100 by default, pagination needed for large buckets.
  // For this script, we'll assume a single page or use pagination.
  let allFiles: string[] = [];
  
  // List files inside 'files' folder since our SupabaseStorageProvider uses `files/${uuid}`
  const { data, error } = await client.storage.from(bucket).list("files", { limit: 1000 });
  
  if (error) {
    throw new Error(`Failed to list files: ${error.message}`);
  }
  
  if (data) {
    allFiles = data.filter(f => f.name !== ".emptyFolderPlaceholder").map(f => `files/${f.name}`);
  }
  return allFiles;
}

async function getLocalKeys(dir: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dir);
    return files;
  } catch (e: any) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

async function run() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run") || !args.includes("--execute");

  console.log(`🧹 Storage Orphan Cleanup ${isDryRun ? "[DRY RUN]" : "[EXECUTE MODE]"}`);
  
  if (config.storageProvider !== "supabase" && config.storageProvider !== "local") {
    console.log(`Unsupported provider for cleanup: ${config.storageProvider}`);
    process.exit(1);
  }

  // Collect DB keys
  const problemMedias = await prisma.problemMedia.findMany({ select: { url: true } });
  const techDocs = await prisma.technicianDocument.findMany({ select: { storageKey: true } });
  
  const dbKeys = new Set([
    ...problemMedias.map(m => m.url),
    ...techDocs.map(d => d.storageKey)
  ]);
  
  console.log(`📊 Found ${dbKeys.size} file records in database.`);

  // Collect Storage keys
  let storageKeys: string[] = [];
  if (config.storageProvider === "supabase") {
    if (!config.supabaseStorageBucket) throw new Error("Missing bucket config");
    storageKeys = await getSupabaseKeys(config.supabaseStorageBucket);
  } else {
    storageKeys = await getLocalKeys(config.uploadDir);
  }
  
  console.log(`📊 Found ${storageKeys.length} files in storage.`);

  // Find orphans in storage (exists in storage, but not in DB)
  const orphanedStorageFiles = storageKeys.filter(k => !dbKeys.has(k));
  console.log(`\n🔍 Found ${orphanedStorageFiles.length} orphaned files in storage.`);
  
  if (orphanedStorageFiles.length > 0) {
    console.log(orphanedStorageFiles.slice(0, 5).map(k => `  - ${k}`).join("\n"));
    if (orphanedStorageFiles.length > 5) console.log(`  ... and ${orphanedStorageFiles.length - 5} more.`);
    
    if (!isDryRun) {
      console.log(`🗑️ Deleting ${orphanedStorageFiles.length} files from storage...`);
      if (config.storageProvider === "supabase") {
        const client = createClient(config.supabaseUrl!, config.supabaseServiceRoleKey!);
        const { error } = await client.storage.from(config.supabaseStorageBucket!).remove(orphanedStorageFiles);
        if (error) console.error(`❌ Failed to delete files: ${error.message}`);
        else console.log(`✅ Successfully deleted files.`);
      } else {
        for (const k of orphanedStorageFiles) {
          await fs.unlink(path.join(config.uploadDir, k)).catch(() => {});
        }
        console.log(`✅ Successfully deleted local files.`);
      }
    }
  }

  // Find missing objects (exists in DB, but not in storage)
  const storageKeysSet = new Set(storageKeys);
  const missingObjects = Array.from(dbKeys).filter(k => !storageKeysSet.has(k));
  console.log(`\n🔍 Found ${missingObjects.length} missing objects (in DB, not in storage).`);
  
  if (missingObjects.length > 0) {
    console.log(missingObjects.slice(0, 5).map(k => `  - ${k}`).join("\n"));
    if (missingObjects.length > 5) console.log(`  ... and ${missingObjects.length - 5} more.`);
    
    if (!isDryRun) {
      console.log(`⚠️ You must manually clean up the database records for missing objects, or they will cause 404s.`);
    }
  }

  if (isDryRun) {
    console.log(`\nℹ️ Run with --execute to perform actual cleanup.`);
  } else {
    console.log(`\n✅ Cleanup complete.`);
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
