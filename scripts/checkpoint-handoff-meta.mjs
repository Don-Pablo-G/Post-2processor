import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

function parseLimit(value, fallback) {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function listZipPackages(baseDir) {
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

function buildMeta(root, keepTarget, recentLimit) {
  const baseDir = path.resolve(root, ".checkpoints", "handoff-packages");
  const packages = listZipPackages(baseDir);
  const totalBytes = packages.reduce((sum, item) => sum + item.bytes, 0);
  const latest = packages[0] || null;
  const pruneCount = Math.max(0, packages.length - keepTarget);

  return {
    generated_at: new Date().toISOString(),
    repo_root: root,
    handoff_directory: baseDir,
    keep_target: keepTarget,
    package_count: packages.length,
    total_bytes: totalBytes,
    total_kb: Number((totalBytes / 1024).toFixed(2)),
    prune_candidates: pruneCount,
    retention_within_target: pruneCount === 0,
    latest_package: latest
      ? {
          name: latest.name,
          path: latest.full,
          updated_at: new Date(latest.mtimeMs).toISOString(),
          bytes: latest.bytes
        }
      : null,
    recent_packages: packages.slice(0, recentLimit).map((item) => ({
      name: item.name,
      path: item.full,
      updated_at: new Date(item.mtimeMs).toISOString(),
      bytes: item.bytes
    }))
  };
}

function main() {
  const root = process.cwd();
  const keepTarget = parseLimit(process.argv[2], 10);
  const recentLimit = parseLimit(process.argv[3], 10);
  const meta = buildMeta(root, keepTarget, recentLimit);
  process.stdout.write(`${JSON.stringify(meta, null, 2)}\n`);
}

main();
