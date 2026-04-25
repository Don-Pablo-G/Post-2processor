import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

function parseLimit(value, fallback) {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function listHandoffPackages(baseDir) {
  if (!existsSync(baseDir)) return [];
  const entries = readdirSync(baseDir)
    .filter((name) => name.endsWith(".zip"))
    .map((name) => {
      const full = path.join(baseDir, name);
      const st = statSync(full);
      return {
        name,
        full,
        mtimeMs: st.mtimeMs,
        bytes: st.size
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return entries;
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
  const limit = parseLimit(process.argv[2], 10);
  const fullPathMode = process.argv.includes("--full-path");
  const items = listHandoffPackages(baseDir).slice(0, limit);

  if (items.length === 0) {
    process.stdout.write("No handoff packages found.\n");
    return;
  }

  process.stdout.write(`Latest handoff packages (${items.length}):\n`);
  for (const item of items) {
    const when = new Date(item.mtimeMs).toISOString();
    const fileLabel = fullPathMode ? item.full : path.relative(root, item.full);
    process.stdout.write(`- ${fileLabel}\n`);
    process.stdout.write(`  updated: ${when} | size: ${formatBytes(item.bytes)}\n`);
  }
}

main();
