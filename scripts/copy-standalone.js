// Cross-platform standalone copy script.
// Replaces Unix-only `cp -r` in the build script.
// Copies .next/static and public into .next/standalone for production deployment.

const fs = require("fs");
const path = require("path");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`Warning: ${src} does not exist, skipping`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

const standaloneDir = path.join(process.cwd(), ".next", "standalone");
const staticSrc = path.join(process.cwd(), ".next", "static");
const staticDest = path.join(standaloneDir, ".next", "static");
const publicSrc = path.join(process.cwd(), "public");
const publicDest = path.join(standaloneDir, "public");

if (!fs.existsSync(standaloneDir)) {
  console.error("Error: .next/standalone does not exist. Run `next build` first.");
  process.exit(1);
}

console.log("Copying static files to standalone...");
copyDir(staticSrc, staticDest);

console.log("Copying public files to standalone...");
copyDir(publicSrc, publicDest);

console.log("Standalone copy complete.");
