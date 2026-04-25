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

function fmt(epoch) {
  const d = new Date(epoch * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function latestCheckpoint() {
  const raw = run('git log -1 --pretty=format:"%H|%ct|%s" --grep="^checkpoint:"');
  if (!raw) return null;
  const [hash, epochRaw, ...subjectParts] = raw.split("|");
  const epoch = Number(epochRaw);
  if (!Number.isFinite(epoch)) return null;
  return { hash, epoch, subject: subjectParts.join("|") };
}

function check(name, ok, detail = "") {
  const mark = ok ? "[x]" : "[ ]";
  return `${mark} ${name}${detail ? ` - ${detail}` : ""}`;
}

function main() {
  const root = process.cwd();
  const status = run("git status --porcelain");
  const dirtyCount = status ? status.split("\n").filter(Boolean).length : 0;
  const branch = run("git rev-parse --abbrev-ref HEAD") || "unknown";
  const latest = latestCheckpoint();

  const today = new Date().toISOString().slice(0, 10);
  const digestPath = path.resolve(root, ".checkpoints", "digests", `checkpoint-digest-${today}.md`);

  const d = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  const weekTag = `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  const weeklyPath = path.resolve(root, ".checkpoints", "weekly", `checkpoint-weekly-${weekTag}.md`);
  const indexPath = path.resolve(root, ".checkpoints", "INDEX.md");

  const hasIndex = existsSync(indexPath);
  const hasDigest = existsSync(digestPath);
  const hasWeekly = existsSync(weeklyPath);
  const hasCheckpoint = Boolean(latest);
  const cleanTree = dirtyCount === 0;

  process.stdout.write("Release readiness checklist:\n");
  process.stdout.write(`- Branch: ${branch}\n`);
  process.stdout.write(`- Working tree changes: ${dirtyCount}\n`);
  if (latest) {
    process.stdout.write(
      `- Latest checkpoint: ${latest.hash.slice(0, 7)} at ${fmt(latest.epoch)} (${latest.subject})\n`
    );
  } else {
    process.stdout.write("- Latest checkpoint: none found\n");
  }
  process.stdout.write("\nChecklist:\n");
  process.stdout.write(`${check("Working tree clean", cleanTree, cleanTree ? "ready" : "commit/stash pending changes first")}\n`);
  process.stdout.write(`${check("Checkpoint exists", hasCheckpoint)}\n`);
  process.stdout.write(`${check("Checkpoint index present", hasIndex, ".checkpoints/INDEX.md")}\n`);
  process.stdout.write(`${check("Today digest present", hasDigest, `.checkpoints/digests/checkpoint-digest-${today}.md`)}\n`);
  process.stdout.write(`${check("Current week rollup present", hasWeekly, `.checkpoints/weekly/checkpoint-weekly-${weekTag}.md`)}\n`);
  process.stdout.write(`${check("Run verification gate", false, "run: npm run verify")}\n`);
  process.stdout.write(`${check("Run suite gate (recommended)", false, "run: npm run checkpoint:suite")}\n`);
}

main();
