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
  const commitLimit = parsePositiveInt(process.argv[2] ?? "200", 200);
  const topN = parsePositiveInt(process.argv[3] ?? "20", 20);

  const commits = getCommits(commitLimit);
  if (commits.length === 0) {
    process.stdout.write("No checkpoint commits found.\n");
    return;
  }

  const outDir = path.resolve(process.cwd(), ".checkpoints", "catalog");
  mkdirSync(outDir, { recursive: true });
  const outputPath = path.join(outDir, "checkpoint-catalog.md");

  const fileCounts = new Map();
  for (const c of commits) {
    for (const file of getChangedFiles(c.hash)) {
      fileCounts.set(file, (fileCounts.get(file) ?? 0) + 1);
    }
  }

  const topFiles = Array.from(fileCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN);

  const newest = commits[0];
  const oldest = commits[commits.length - 1];
  const totalTouches = Array.from(fileCounts.values()).reduce((sum, n) => sum + n, 0);

  const lines = [];
  lines.push("# Checkpoint Catalog (Markdown)");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Coverage");
  lines.push(`- Checkpoints scanned: ${commits.length}`);
  lines.push(`- Time span: ${fmt(oldest.epoch)} -> ${fmt(newest.epoch)}`);
  lines.push(`- Unique files touched: ${fileCounts.size}`);
  lines.push(`- Total file touches: ${totalTouches}`);
  lines.push("");
  lines.push("## Top Files");
  if (topFiles.length === 0) {
    lines.push("- None");
  } else {
    topFiles.forEach(([file, count]) => lines.push(`- ${file} (${count})`));
  }
  lines.push("");
  lines.push("## Recent Checkpoints");
  commits.slice(0, 25).forEach((c) => {
    lines.push(`- \`${c.hash.slice(0, 7)}\` ${fmt(c.epoch)} - ${c.subject}`);
  });
  lines.push("");

  writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  process.stdout.write(`Catalog markdown written: ${outputPath}\n`);
}

main();
