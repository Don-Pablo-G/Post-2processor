import { readdirSync, statSync } from "node:fs";
import path from "node:path";

function parsePositiveInt(value, fallback) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw < 1) return fallback;
  return Math.floor(raw);
}

function listFiles(dir) {
  try {
    return readdirSync(dir)
      .map((name) => {
        const full = path.join(dir, name);
        const stats = statSync(full);
        return stats.isFile() ? { name, full, mtimeMs: stats.mtimeMs } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  } catch {
    return [];
  }
}

function suggestPrune(files, keep) {
  const keepSet = new Set(files.slice(0, keep).map((f) => f.full));
  return files.filter((f) => !keepSet.has(f.full));
}

function rel(p, root) {
  return path.relative(root, p).replace(/\\/g, "/");
}

function main() {
  const keepDigests = parsePositiveInt(process.argv[2] ?? "14", 14);
  const keepWeekly = parsePositiveInt(process.argv[3] ?? "12", 12);
  const keepReports = parsePositiveInt(process.argv[4] ?? "20", 20);

  const repoRoot = process.cwd();
  const checkpoints = path.resolve(repoRoot, ".checkpoints");
  const digestDir = path.join(checkpoints, "digests");
  const weeklyDir = path.join(checkpoints, "weekly");
  const reportsDir = path.join(checkpoints, "reports");

  const digests = listFiles(digestDir);
  const weekly = listFiles(weeklyDir);
  const reports = listFiles(reportsDir);

  const pruneDigests = suggestPrune(digests, keepDigests);
  const pruneWeekly = suggestPrune(weekly, keepWeekly);
  const pruneReports = suggestPrune(reports, keepReports);

  const totalCandidates = pruneDigests.length + pruneWeekly.length + pruneReports.length;
  process.stdout.write("Checkpoint cleanup suggestions (non-destructive):\n");
  process.stdout.write(`- Digests: ${digests.length} total, keep ${keepDigests}, suggest ${pruneDigests.length}\n`);
  process.stdout.write(`- Weekly: ${weekly.length} total, keep ${keepWeekly}, suggest ${pruneWeekly.length}\n`);
  process.stdout.write(`- Reports: ${reports.length} total, keep ${keepReports}, suggest ${pruneReports.length}\n`);
  process.stdout.write(`- Total candidate files: ${totalCandidates}\n`);

  if (totalCandidates === 0) {
    process.stdout.write("No cleanup actions suggested.\n");
    return;
  }

  process.stdout.write("\nSuggested review commands:\n");
  process.stdout.write("- npm run checkpoint:index\n");
  process.stdout.write("- npm run checkpoint:reports:prune\n");

  process.stdout.write("\nSuggested manual removals (review before executing):\n");
  [...pruneDigests, ...pruneWeekly, ...pruneReports].slice(0, 25).forEach((f) => {
    process.stdout.write(`- del "${rel(f.full, repoRoot)}"\n`);
  });

  if (totalCandidates > 25) {
    process.stdout.write(`- ... and ${totalCandidates - 25} more\n`);
  }
}

main();
