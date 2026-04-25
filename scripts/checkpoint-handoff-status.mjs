import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

function listPackages(baseDir) {
  if (!existsSync(baseDir)) return [];
  return readdirSync(baseDir)
    .filter((name) => name.endsWith(".zip"))
    .map((name) => {
      const full = path.join(baseDir, name);
      const st = statSync(full);
      return { name, full, mtimeMs: st.mtimeMs, bytes: st.size };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function main() {
  const root = process.cwd();
  const baseDir = path.resolve(root, ".checkpoints", "handoff-packages");
  const keepTarget = 10;
  const items = listPackages(baseDir);
  const totalBytes = items.reduce((sum, item) => sum + item.bytes, 0);
  const latest = items[0];

  process.stdout.write("Handoff package status\n");
  process.stdout.write(`- directory: ${path.relative(root, baseDir)}\n`);
  process.stdout.write(`- package count: ${items.length}\n`);
  process.stdout.write(`- total size: ${formatBytes(totalBytes)}\n`);

  if (!latest) {
    process.stdout.write("- latest package: none\n");
    process.stdout.write("- suggestion: run `npm run checkpoint:handoff-package`\n");
    return;
  }

  process.stdout.write(`- latest package: ${latest.name}\n`);
  process.stdout.write(`- latest updated: ${new Date(latest.mtimeMs).toISOString()}\n`);

  if (items.length > keepTarget) {
    process.stdout.write(
      `- suggestion: run \`node scripts/checkpoint-handoff-cleanup.mjs ${keepTarget}\` to preview pruning\n`
    );
  } else {
    process.stdout.write("- suggestion: retention is within target\n");
  }
}

main();
