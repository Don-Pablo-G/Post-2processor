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
    .filter(Boolean)
    .sort((a, b) => a.epoch - b.epoch);
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
  const days = parsePositiveInt(process.argv[2] ?? "14", 14);
  const topN = parsePositiveInt(process.argv[3] ?? "12", 12);

  const commits = getCommits(days);
  if (commits.length === 0) {
    process.stdout.write(`No checkpoint commits found in last ${days} day(s).\n`);
    return;
  }

  const outDir = path.resolve(process.cwd(), ".checkpoints", "timeline");
  mkdirSync(outDir, { recursive: true });
  const dateTag = new Date().toISOString().slice(0, 10);
  const outputPath = path.join(outDir, `checkpoint-timeline-${dateTag}.md`);

  const byDay = new Map();
  const fileCounts = new Map();
  for (const c of commits) {
    const day = new Date(c.epoch * 1000).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
    for (const file of getChangedFiles(c.hash)) {
      fileCounts.set(file, (fileCounts.get(file) ?? 0) + 1);
    }
  }

  const topFiles = Array.from(fileCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN);

  const lines = [];
  lines.push(`# Checkpoint Timeline Snapshot - ${dateTag}`);
  lines.push("");
  lines.push(`Window: last ${days} day(s)`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Daily Volume");
  for (const [day, count] of Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`- ${day}: ${count}`);
  }
  lines.push("");
  lines.push("## Top Files");
  topFiles.forEach(([file, count]) => lines.push(`- ${file} (${count})`));
  lines.push("");
  lines.push("## Chronological Checkpoints");
  commits.forEach((c) => {
    lines.push(`- \`${c.hash.slice(0, 7)}\` ${fmt(c.epoch)} - ${c.subject}`);
  });
  lines.push("");

  writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  process.stdout.write(`Timeline markdown written: ${outputPath}\n`);
}

main();
