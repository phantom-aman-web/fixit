import { PrismaClient } from "@prisma/client";
import { getEnvConfig } from "../src/lib/env";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();
const config = getEnvConfig();

async function run() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run") || !args.includes("--execute");

  console.log(`🚀 Storage Migration (Local -> Supabase) ${isDryRun ? "[DRY RUN]" : "[EXECUTE MODE]"}`);
  
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey || !config.supabaseStorageBucket) {
    console.log("❌ Missing Supabase configuration.");
    process.exit(1);
  }

  const client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  const uploadDir = config.uploadDir;
  let localFiles: string[] = [];
  try {
    localFiles = await fs.readdir(uploadDir);
  } catch (e: any) {
    if (e.code === "ENOENT") {
      console.log("Local upload directory does not exist. Nothing to migrate.");
      process.exit(0);
    }
    throw e;
  }

  console.log(`Found ${localFiles.length} local files.`);

  for (const fileName of localFiles) {
    const filePath = path.join(uploadDir, fileName);
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) continue;

    console.log(`\nProcessing: ${fileName}`);

    // Check if it exists in DB
    const problemMedia = await prisma.problemMedia.findFirst({ where: { url: fileName } });
    const techDoc = await prisma.technicianDocument.findFirst({ where: { storageKey: fileName } });

    if (!problemMedia && !techDoc) {
      console.log(`  ⚠️ Skipping: No database record found for ${fileName}`);
      continue;
    }

    const newKey = `files/${randomUUID()}`;
    const mimeType = problemMedia ? problemMedia.mimeType : "application/octet-stream";

    console.log(`  ➡️ Mapped to new key: ${newKey}`);

    if (!isDryRun) {
      try {
        const buffer = await fs.readFile(filePath);
        const { error } = await client.storage.from(config.supabaseStorageBucket).upload(newKey, buffer, {
          contentType: mimeType,
          cacheControl: "3600",
          upsert: false,
        });

        if (error) {
          console.error(`  ❌ Failed to upload: ${error.message}`);
          continue;
        }
        
        console.log(`  ✅ Uploaded to Supabase.`);

        // Update database
        if (problemMedia) {
          await prisma.problemMedia.update({
            where: { id: problemMedia.id },
            data: { url: newKey },
          });
        } else if (techDoc) {
          await prisma.technicianDocument.update({
            where: { id: techDoc.id },
            data: { storageKey: newKey },
          });
        }
        console.log(`  ✅ Updated database record.`);
      } catch (e: any) {
        console.error(`  ❌ Error processing file: ${e.message}`);
      }
    }
  }

  if (isDryRun) {
    console.log(`\nℹ️ Run with --execute to perform actual migration.`);
  } else {
    console.log(`\n✅ Migration complete.`);
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
