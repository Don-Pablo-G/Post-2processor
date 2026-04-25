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

function isoWeekTag(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function getCommitsSince(days) {
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

function main() {
  const days = parsePositiveInt(process.argv[2] ?? "7", 7);
  const topN = parsePositiveInt(process.argv[3] ?? "12", 12);
  const commits = getCommitsSince(days);

  if (commits.length === 0) {
    process.stdout.write(`No checkpoint commits found in last ${days} day(s).\n`);
    return;
  }

  const outDir = path.resolve(process.cwd(), ".checkpoints", "weekly");
  mkdirSync(outDir, { recursive: true });
  const week = isoWeekTag();
  const outputPath = path.join(outDir, `checkpoint-weekly-${week}.md`);

  const newest = commits[0];
  const oldest = commits[commits.length - 1];

  const fileCounts = new Map();
  const dayCounts = new Map();
  for (const commit of commits) {
    const day = new Date(commit.epoch * 1000).toISOString().slice(0, 10);
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    for (const file of getChangedFiles(commit.hash)) {
      fileCounts.set(file, (fileCounts.get(file) ?? 0) + 1);
    }
  }

  const topFiles = Array.from(fileCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN);
  const topDays = Array.from(dayCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const totalTouches = Array.from(fileCounts.values()).reduce((sum, n) => sum + n, 0);

  const lines = [];
  lines.push(`# Weekly Checkpoint Rollup - ${week}`);
  lines.push("");
  lines.push(`Window: last ${days} day(s)`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Summary");
  lines.push(`- Checkpoints: ${commits.length}`);
  lines.push(`- Time span: ${fmt(oldest.epoch)} -> ${fmt(newest.epoch)}`);
  lines.push(`- Unique files touched: ${fileCounts.size}`);
  lines.push(`- Total file touches: ${totalTouches}`);
  lines.push("");
  lines.push("## Daily Counts");
  topDays.forEach(([day, count]) => lines.push(`- ${day}: ${count}`));
  lines.push("");
  lines.push("## Top Files");
  if (topFiles.length === 0) {
    lines.push("- No changed files captured.");
  } else {
    topFiles.forEach(([file, count]) => lines.push(`- ${file} (${count})`));
  }
  lines.push("");
  lines.push("## Recent Highlights");
  commits.slice(0, Math.min(12, commits.length)).forEach((c) => {
    lines.push(`- \`${c.hash.slice(0, 7)}\` ${fmt(c.epoch)} - ${c.subject}`);
  });
  lines.push("");
  lines.push("## Suggested Follow-up");
  lines.push("- Run `npm run verify` and prioritize the top file hotspots.");
  lines.push("");

  writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  process.stdout.write(`Weekly rollup written: ${outputPath}\n`);
}

main();
