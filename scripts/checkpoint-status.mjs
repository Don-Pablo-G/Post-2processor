import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
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

function rel(p, root) {
  return path.relative(root, p).replace(/\\/g, "/");
}

function main() {
  const repoRoot = process.cwd();
  const latest = getLatestCheckpoint();
  const branch = run("git rev-parse --abbrev-ref HEAD") || "unknown";
  const dirty = run("git status --porcelain");
  const dirtyCount = dirty ? dirty.split("\n").filter(Boolean).length : 0;

  const indexPath = path.resolve(repoRoot, ".checkpoints", "INDEX.md");
  const digestPath = path.resolve(
    repoRoot,
    ".checkpoints",
    "digests",
    `checkpoint-digest-${new Date().toISOString().slice(0, 10)}.md`
  );
  const week = (() => {
    const d = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  })();
  const weeklyPath = path.resolve(
    repoRoot,
    ".checkpoints",
    "weekly",
    `checkpoint-weekly-${week}.md`
  );

  process.stdout.write("Checkpoint status snapshot:\n");
  process.stdout.write(`- Branch: ${branch}\n`);
  process.stdout.write(`- Working tree: ${dirtyCount === 0 ? "clean" : `${dirtyCount} changed item(s)`}\n`);
  if (!latest) {
    process.stdout.write("- Latest checkpoint: none found\n");
  } else {
    process.stdout.write(
      `- Latest checkpoint: ${latest.hash.slice(0, 7)} at ${fmt(latest.epoch)}\n`
    );
    process.stdout.write(`- Latest subject: ${latest.subject}\n`);
  }

  process.stdout.write("- Report links:\n");
  process.stdout.write(
    `  - Index: ${existsSync(indexPath) ? rel(indexPath, repoRoot) : "(missing)"}\n`
  );
  process.stdout.write(
    `  - Digest: ${existsSync(digestPath) ? rel(digestPath, repoRoot) : "(missing)"}\n`
  );
  process.stdout.write(
    `  - Weekly: ${existsSync(weeklyPath) ? rel(weeklyPath, repoRoot) : "(missing)"}\n`
  );

  process.stdout.write("- Quick actions:\n");
  process.stdout.write("  - npm run verify\n");
  process.stdout.write("  - npm run checkpoint:handoff\n");
  process.stdout.write("  - npm run checkpoint:index\n");
}

main();
