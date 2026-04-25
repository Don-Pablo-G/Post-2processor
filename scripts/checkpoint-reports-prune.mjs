import { readdirSync, statSync, unlinkSync, existsSync } from "node:fs";
import path from "node:path";

function parseKeep(argv) {
  const candidate = Number(argv[2] ?? "20");
  if (!Number.isFinite(candidate) || candidate < 1) return 20;
  return Math.floor(candidate);
}

function main() {
  const keep = parseKeep(process.argv);
  const root = process.cwd();
  const reportsDir = path.join(root, ".checkpoints", "reports");

  if (!existsSync(reportsDir)) {
    process.stdout.write("No checkpoint reports directory found. Nothing to prune.\n");
    return;
  }

  const files = readdirSync(reportsDir)
    .filter((name) => /^checkpoint-report-.*\.md$/.test(name))
    .map((name) => {
      const fullPath = path.join(reportsDir, name);
      const mtimeMs = statSync(fullPath).mtimeMs;
      return { name, fullPath, mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (files.length <= keep) {
    process.stdout.write(`Reports count (${files.length}) is within keep limit (${keep}). Nothing removed.\n`);
    return;
  }

  const toDelete = files.slice(keep);
  for (const file of toDelete) {
    unlinkSync(file.fullPath);
  }

  process.stdout.write(
    `Pruned ${toDelete.length} report(s). Kept ${keep} newest report(s) in .checkpoints/reports.\n`
  );
}

main();
