import { cp, readdir, stat } from "node:fs/promises";
import path from "node:path";

const SRC_DIR = path.resolve("src");
const DIST_DIR = path.resolve("dist");

const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
]);

async function copyAssets(srcDir, distDir) {
  const entries = await readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const distPath = path.join(distDir, entry.name);

    if (entry.isDirectory()) {
      await copyAssets(srcPath, distPath);
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();

    // Leave files handled by TypeScript alone.
    if (SOURCE_EXTENSIONS.has(extension)) {
      continue;
    }

    await cp(srcPath, distPath);
    console.log(`Copied: ${path.relative(SRC_DIR, srcPath)}`);
  }
}

await copyAssets(SRC_DIR, DIST_DIR);