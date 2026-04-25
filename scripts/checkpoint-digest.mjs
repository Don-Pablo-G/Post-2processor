import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
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

function getCommits(limit) {
  const raw = run(`git log --pretty=format:"%H|%ct|%s" --grep="^checkpoint:" -n ${limit}`);
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [hash, epochRaw, ...subjectParts] = line.split("|");
      const epoch = Number(epochRaw);
      if (!Number.isFinite(epoch)) return null;
      return { hash, epoch, subject: subjectParts.join("|") };
    })
    .filter(Boolean);
}

function getChangedFiles(hash) {
  const raw = run(`git show --pretty=format: --name-only ${hash}`);
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    )
  );
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

function main() {
  const commitLimit = parsePositiveInt(process.argv[2] ?? "120", 120);
  const recentN = parsePositiveInt(process.argv[3] ?? "20", 20);
  const outDir = path.resolve(process.cwd(), ".checkpoints", "digests");
  mkdirSync(outDir, { recursive: true });

  const commits = getCommits(commitLimit);
  if (commits.length === 0) {
    process.stdout.write("No checkpoint commits found.\n");
    return;
  }

  const window = commits.slice(0, Math.min(recentN, commits.length));
  const latest = window[0];
  const earliest = window[window.length - 1];

  const fileCounts = new Map();
  for (const commit of window) {
    for (const file of getChangedFiles(commit.hash)) {
      fileCounts.set(file, (fileCounts.get(file) ?? 0) + 1);
    }
  }

  const topFiles = Array.from(fileCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12);

  const totalTouches = Array.from(fileCounts.values()).reduce((sum, n) => sum + n, 0);
  const avgCadence =
    window.length > 1 ? (latest.epoch - earliest.epoch) / (window.length - 1) / 60 : 0;

  const dateTag = new Date().toISOString().slice(0, 10);
  const fileName = `checkpoint-digest-${dateTag}.md`;
  const outputPath = path.join(outDir, fileName);

  const lines = [];
  lines.push(`# Checkpoint Digest - ${dateTag}`);
  lines.push("");
  lines.push("## Snapshot");
  lines.push(`- Latest checkpoint: \`${latest.hash.slice(0, 7)}\` at ${fmt(latest.epoch)}`);
  lines.push(`- Latest subject: ${latest.subject}`);
  lines.push(`- Window analyzed: ${window.length} checkpoint(s)`);
  lines.push(`- Time span: ${fmt(earliest.epoch)} -> ${fmt(latest.epoch)}`);
  lines.push(
    `- Breadth: ${fileCounts.size} unique files, ${totalTouches} total file touches in selected window`
  );
  lines.push(`- Average cadence: ${avgCadence > 0 ? `${avgCadence.toFixed(1)} min/checkpoint` : "n/a"}`);
  lines.push("");
  lines.push("## Top Focus Files");
  if (topFiles.length === 0) {
    lines.push("- No changed files found.");
  } else {
    topFiles.forEach(([file, count]) => lines.push(`- ${file} (${count})`));
  }
  lines.push("");
  lines.push("## Recent Checkpoints");
  window.slice(0, 12).forEach((c) => {
    lines.push(`- \`${c.hash.slice(0, 7)}\` ${fmt(c.epoch)} - ${c.subject}`);
  });
  lines.push("");
  lines.push("## Suggested Next Action");
  lines.push("- Run `npm run verify` and continue with work around the top focus files.");
  lines.push("");

  writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  process.stdout.write(`Digest written: ${outputPath}\n`);
}

main();
