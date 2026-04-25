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

function getCommits(days) {
  const raw = run(
    `git log --since="${days} days ago" --pretty=format:"%H|%ct|%s" --grep="^checkpoint:"`
  );
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

function keywordCounts(subjects) {
  const stop = new Set([
    "checkpoint",
    "add",
    "update",
    "command",
    "with",
    "and",
    "for",
    "the",
    "from",
    "into",
    "analysis",
    "utility"
  ]);
  const counts = new Map();
  for (const s of subjects) {
    const tokens = new Set(
      s
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ""))
        .filter((t) => t.length >= 3 && !stop.has(t))
    );
    for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([k]) => k);
}

function buildPriorities(topFiles, topKeywords) {
  const items = [];
  items.push("Consolidate command taxonomy and reduce overlap among analytics/reporting scripts.");
  if (topFiles.some((f) => f.includes("README.md"))) {
    items.push("Restructure checkpoint docs into an operator playbook (daily, weekly, release sections).");
  }
  if (topFiles.some((f) => f.includes("package.json"))) {
    items.push("Group npm scripts by workflow stage and add aliases for common runbooks.");
  }
  if (topKeywords.includes("verify") || topKeywords.includes("doctor")) {
    items.push("Add automated smoke tests for the highest-use checkpoint commands.");
  }
  items.push("Define retention policy and automate optional cleanup execution mode behind confirmation flag.");
  return items.slice(0, 5);
}

function main() {
  const days = parsePositiveInt(process.argv[2] ?? "7", 7);
  const topN = parsePositiveInt(process.argv[3] ?? "12", 12);

  const commits = getCommits(days);
  if (commits.length === 0) {
    process.stdout.write(`No checkpoint commits found in last ${days} day(s).\n`);
    return;
  }

  const outDir = path.resolve(process.cwd(), ".checkpoints", "weekend");
  mkdirSync(outDir, { recursive: true });
  const dateTag = new Date().toISOString().slice(0, 10);
  const outputPath = path.join(outDir, `checkpoint-weekend-${dateTag}.md`);

  const fileCounts = new Map();
  const dayCounts = new Map();
  for (const c of commits) {
    const day = new Date(c.epoch * 1000).toISOString().slice(0, 10);
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    for (const file of getChangedFiles(c.hash)) {
      fileCounts.set(file, (fileCounts.get(file) ?? 0) + 1);
    }
  }

  const topFiles = Array.from(fileCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN);
  const topKeywords = keywordCounts(commits.map((c) => c.subject));
  const priorities = buildPriorities(topFiles.map(([f]) => f), topKeywords);

  const newest = commits[0];
  const oldest = commits[commits.length - 1];
  const totalTouches = Array.from(fileCounts.values()).reduce((sum, n) => sum + n, 0);

  const lines = [];
  lines.push(`# Weekend Checkpoint Recap - ${dateTag}`);
  lines.push("");
  lines.push(`Window: last ${days} day(s)`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Weekly Summary");
  lines.push(`- Checkpoints: ${commits.length}`);
  lines.push(`- Time span: ${fmt(oldest.epoch)} -> ${fmt(newest.epoch)}`);
  lines.push(`- Unique files touched: ${fileCounts.size}`);
  lines.push(`- Total file touches: ${totalTouches}`);
  lines.push("");
  lines.push("## Daily Throughput");
  for (const [day, count] of Array.from(dayCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`- ${day}: ${count}`);
  }
  lines.push("");
  lines.push("## Top Focus Files");
  topFiles.forEach(([file, count]) => lines.push(`- ${file} (${count})`));
  lines.push("");
  lines.push("## Dominant Themes");
  lines.push(`- ${topKeywords.join(", ")}`);
  lines.push("");
  lines.push("## Next-Week Priorities");
  priorities.forEach((p, idx) => lines.push(`${idx + 1}. ${p}`));
  lines.push("");
  lines.push("## Recent Highlights");
  commits.slice(0, 10).forEach((c) => {
    lines.push(`- \`${c.hash.slice(0, 7)}\` ${fmt(c.epoch)} - ${c.subject}`);
  });
  lines.push("");

  writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  process.stdout.write(`Weekend recap written: ${outputPath}\n`);
}

main();
