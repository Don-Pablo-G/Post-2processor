import { execSync } from "node:child_process";

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

function getRecentCount(hours = 24) {
  const raw = run(`git log --since="${hours} hours ago" --pretty=format:%H --grep="^checkpoint:"`);
  if (!raw) return 0;
  return raw.split("\n").filter(Boolean).length;
}

function getTopFiles(limitCommits = 10, topN = 3) {
  const hashesRaw = run(`git log --pretty=format:%H --grep="^checkpoint:" -n ${limitCommits}`);
  if (!hashesRaw) return [];
  const hashes = hashesRaw.split("\n").filter(Boolean);
  const counts = new Map();
  for (const hash of hashes) {
    const filesRaw = run(`git show --pretty=format: --name-only ${hash}`);
    if (!filesRaw) continue;
    const files = new Set(filesRaw.split("\n").map((f) => f.trim()).filter(Boolean));
    for (const file of files) counts.set(file, (counts.get(file) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([file]) => file);
}

function fmt(epoch) {
  const d = new Date(epoch * 1000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mi}`;
}

function main() {
  const latest = getLatestCheckpoint();
  const recent24h = getRecentCount(24);
  const topFiles = getTopFiles(10, 3);
  const dirty = run("git status --porcelain");
  const dirtyCount = dirty ? dirty.split("\n").filter(Boolean).length : 0;

  process.stdout.write("Checkpoint brief:\n");
  if (latest) {
    process.stdout.write(`- Latest: ${latest.hash.slice(0, 7)} at ${fmt(latest.epoch)} - ${latest.subject}\n`);
  } else {
    process.stdout.write("- Latest: none\n");
  }
  process.stdout.write(`- Last 24h checkpoints: ${recent24h}\n`);
  process.stdout.write(`- Focus files: ${topFiles.length > 0 ? topFiles.join(", ") : "n/a"}\n`);
  process.stdout.write(`- Working tree: ${dirtyCount === 0 ? "clean" : `${dirtyCount} changed item(s)`}\n`);
}

main();
