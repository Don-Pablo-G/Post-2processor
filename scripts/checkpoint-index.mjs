import { execSync } from "node:child_process";
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function parsePositiveInt(value, fallback) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw < 1) return fallback;
  return Math.floor(raw);
}

function listRecentFiles(dir, limit) {
  try {
    const entries = readdirSync(dir)
      .map((name) => {
        const full = path.join(dir, name);
        const stats = statSync(full);
        return stats.isFile() ? { name, full, mtimeMs: stats.mtimeMs } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, limit);
    return entries;
  } catch {
    return [];
  }
}

function getLatestCheckpoint() {
  const raw = run('git log -1 --pretty=format:"%H|%ct|%s" --grep="^checkpoint:"');
  if (!raw) return null;
  const [hash, epochRaw, ...subjectParts] = raw.split("|");
  const epoch = Number(epochRaw);
  if (!Number.isFinite(epoch)) return null;
  return { hash, epoch, subject: subjectParts.join("|") };
}

function fmt(epoch) {
  const d = new Date(epoch * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function relToRepo(absPath, repoRoot) {
  return path.relative(repoRoot, absPath).replace(/\\/g, "/");
}

function main() {
  const limit = parsePositiveInt(process.argv[2] ?? "12", 12);
  const repoRoot = process.cwd();
  const checkpointsDir = path.resolve(repoRoot, ".checkpoints");
  const digestDir = path.join(checkpointsDir, "digests");
  const weeklyDir = path.join(checkpointsDir, "weekly");
  mkdirSync(checkpointsDir, { recursive: true });

  const digestFiles = listRecentFiles(digestDir, limit);
  const weeklyFiles = listRecentFiles(weeklyDir, limit);
  const latest = getLatestCheckpoint();

  const lines = [];
  lines.push("# Checkpoint Index");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");

  lines.push("## Latest Checkpoint");
  if (!latest) {
    lines.push("- No checkpoint commit found.");
  } else {
    lines.push(`- Hash: \`${latest.hash.slice(0, 7)}\``);
    lines.push(`- Time: ${fmt(latest.epoch)}`);
    lines.push(`- Subject: ${latest.subject}`);
  }
  lines.push("");

  lines.push("## Recent Digests");
  if (digestFiles.length === 0) {
    lines.push("- None found.");
  } else {
    digestFiles.forEach((file) => {
      lines.push(`- [${file.name}](./${relToRepo(file.full, repoRoot)})`);
    });
  }
  lines.push("");

  lines.push("## Recent Weekly Rollups");
  if (weeklyFiles.length === 0) {
    lines.push("- None found.");
  } else {
    weeklyFiles.forEach((file) => {
      lines.push(`- [${file.name}](./${relToRepo(file.full, repoRoot)})`);
    });
  }
  lines.push("");

  lines.push("## Quick Commands");
  lines.push("- `npm run checkpoint:latest`");
  lines.push("- `npm run checkpoint:menu`");
  lines.push("- `npm run checkpoint:handoff`");
  lines.push("- `npm run checkpoint:digest`");
  lines.push("- `npm run checkpoint:weekly`");
  lines.push("- `npm run checkpoint:report`");
  lines.push("- `npm run repo:health`");
  lines.push("");

  const outputPath = path.join(checkpointsDir, "INDEX.md");
  writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  process.stdout.write(`Checkpoint index written: ${outputPath}\n`);
}

main();
