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

function normalizeToken(token) {
  return token.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
}

function topTokens(subjects, topN = 10) {
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
  for (const subject of subjects) {
    const unique = new Set(
      subject
        .split(/\s+/)
        .map(normalizeToken)
        .filter((t) => t.length >= 3 && !stop.has(t))
    );
    for (const token of unique) counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([k]) => k);
}

function main() {
  const days = parsePositiveInt(process.argv[2] ?? "14", 14);
  const topN = parsePositiveInt(process.argv[3] ?? "10", 10);
  const commits = getCommits(days);

  if (commits.length === 0) {
    process.stdout.write(`No checkpoint commits found in last ${days} day(s).\n`);
    return;
  }

  const outDir = path.resolve(process.cwd(), ".checkpoints", "roadmap");
  mkdirSync(outDir, { recursive: true });
  const dateTag = new Date().toISOString().slice(0, 10);
  const outputPath = path.join(outDir, `checkpoint-roadmap-${dateTag}.md`);

  const fileCounts = new Map();
  for (const c of commits) {
    for (const file of getChangedFiles(c.hash)) {
      fileCounts.set(file, (fileCounts.get(file) ?? 0) + 1);
    }
  }
  const topFiles = Array.from(fileCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([file, count]) => `${file} (${count})`);
  const tokens = topTokens(commits.map((c) => c.subject), 10);

  const priorities = [
    "Stabilize command discoverability with grouped docs and command matrix.",
    "Reduce script sprawl by introducing shared helper modules for git/time/report formatting.",
    "Add smoke-test harness for top checkpoint commands (`status`, `suite`, `ship`, `doctor:extended`).",
    "Define retention policy and optional confirmed cleanup executor mode.",
    "Create lightweight CI job that validates core checkpoint scripts on each change."
  ];

  const lines = [];
  lines.push(`# Checkpoint Roadmap (1-2 Weeks) - ${dateTag}`);
  lines.push("");
  lines.push(`Window analyzed: last ${days} day(s)`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Current Signals");
  lines.push(`- Checkpoints observed: ${commits.length}`);
  lines.push(`- Dominant themes: ${tokens.join(", ")}`);
  lines.push(`- Top files: ${topFiles.join(", ")}`);
  lines.push("");
  lines.push("## Proposed Priorities");
  priorities.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
  lines.push("");
  lines.push("## Suggested Weekly Plan");
  lines.push("- Week 1: docs grouping + helper refactor + smoke tests baseline.");
  lines.push("- Week 2: retention workflow + CI script checks + finalize release gate runbook.");
  lines.push("");
  lines.push("## Success Criteria");
  lines.push("- `npm run checkpoint:suite` remains green after refactors.");
  lines.push("- Onboarding command discovery time reduced (via command matrix/index).");
  lines.push("- At least core checkpoint commands covered by smoke tests.");
  lines.push("");

  writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  process.stdout.write(`Roadmap written: ${outputPath}\n`);
}

main();
