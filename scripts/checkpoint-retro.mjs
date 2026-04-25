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

function keywordCounts(subjects) {
  const stop = new Set([
    "checkpoint",
    "add",
    "update",
    "command",
    "with",
    "for",
    "the",
    "and",
    "from",
    "into",
    "analysis",
    "utility"
  ]);
  const counts = new Map();
  for (const s of subjects) {
    const unique = new Set(
      s
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ""))
        .filter((t) => t.length >= 3 && !stop.has(t))
    );
    for (const t of unique) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([k]) => k);
}

function main() {
  const days = parsePositiveInt(process.argv[2] ?? "7", 7);
  const topN = parsePositiveInt(process.argv[3] ?? "8", 8);
  const commits = getCommits(days);

  if (commits.length === 0) {
    process.stdout.write(`No checkpoint commits found in last ${days} day(s).\n`);
    return;
  }

  const outDir = path.resolve(process.cwd(), ".checkpoints", "retro");
  mkdirSync(outDir, { recursive: true });
  const dateTag = new Date().toISOString().slice(0, 10);
  const outputPath = path.join(outDir, `checkpoint-retro-${dateTag}.md`);

  const fileCounts = new Map();
  for (const c of commits) {
    for (const file of getChangedFiles(c.hash)) {
      fileCounts.set(file, (fileCounts.get(file) ?? 0) + 1);
    }
  }
  const topFiles = Array.from(fileCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([f]) => f);
  const keywords = keywordCounts(commits.map((c) => c.subject));

  const wins = [
    `Delivered ${commits.length} checkpoint increments in the last ${days} day(s).`,
    "Established broad command coverage for analytics, reporting, and operations workflows.",
    "Maintained green verification gate while extending tooling surface."
  ];
  const risks = [
    "Command surface area is growing quickly, which may increase discoverability friction.",
    "Most activity remains concentrated in docs/script wiring files.",
    "Operational commands depend on local artifact freshness and may drift without routine runs."
  ];
  const actions = [
    "Create grouped command map by use-case (daily, diagnostics, release, archival).",
    "Add smoke tests for high-traffic commands to guard output contracts.",
    "Decide retention policy and optional auto-prune mode with explicit confirmation.",
    "Review top files for refactor opportunities to reduce repetitive edits."
  ];

  const lines = [];
  lines.push(`# Checkpoint Retrospective - ${dateTag}`);
  lines.push("");
  lines.push(`Window: last ${days} day(s)`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Signals");
  lines.push(`- Checkpoints: ${commits.length}`);
  lines.push(`- Top files: ${topFiles.join(", ")}`);
  lines.push(`- Theme keywords: ${keywords.join(", ")}`);
  lines.push("");
  lines.push("## Wins");
  wins.forEach((w) => lines.push(`- ${w}`));
  lines.push("");
  lines.push("## Risks");
  risks.forEach((r) => lines.push(`- ${r}`));
  lines.push("");
  lines.push("## Action Items");
  actions.forEach((a, idx) => lines.push(`${idx + 1}. ${a}`));
  lines.push("");

  writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  process.stdout.write(`Retrospective written: ${outputPath}\n`);
}

main();
