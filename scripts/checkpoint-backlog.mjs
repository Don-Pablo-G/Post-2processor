import { execSync } from "node:child_process";

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

function normalizeToken(token) {
  return token.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
}

function tokenScoreBoost(token) {
  if (token.includes("fix") || token.includes("bug")) return 1.4;
  if (token.includes("verify") || token.includes("test")) return 1.2;
  if (token.includes("report") || token.includes("diagnostic")) return 1.1;
  return 1.0;
}

function buildTaskText(topTokens, topFiles) {
  const tokenPart = topTokens.length > 0 ? topTokens.join(", ") : "checkpoint tooling";
  const filePart = topFiles.length > 0 ? topFiles.join(", ") : "core scripts";
  return `Continue improving ${tokenPart}; prioritize follow-up work around ${filePart}.`;
}

function main() {
  const commitLimit = parsePositiveInt(process.argv[2] ?? "80", 80);
  const recentN = parsePositiveInt(process.argv[3] ?? "14", 14);
  const topN = parsePositiveInt(process.argv[4] ?? "8", 8);

  const commits = getCommits(commitLimit);
  if (commits.length === 0) {
    process.stdout.write("No checkpoint commits found.\n");
    return;
  }

  const recent = commits.slice(0, Math.min(recentN, commits.length));
  const tokenCounts = new Map();
  const fileCounts = new Map();
  const stop = new Set([
    "checkpoint",
    "add",
    "update",
    "command",
    "for",
    "with",
    "and",
    "the",
    "from",
    "into",
    "across",
    "analysis",
    "utility"
  ]);

  for (const commit of recent) {
    const tokens = commit.subject
      .split(/\s+/)
      .map(normalizeToken)
      .filter((token) => token.length >= 3 && !stop.has(token));

    const uniqueTokens = new Set(tokens);
    for (const token of uniqueTokens) {
      const boost = tokenScoreBoost(token);
      tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + boost);
    }

    for (const file of getChangedFiles(commit.hash)) {
      fileCounts.set(file, (fileCounts.get(file) ?? 0) + 1);
    }
  }

  const topTokens = Array.from(tokenCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([token]) => token);

  const topFiles = Array.from(fileCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([file]) => file);

  process.stdout.write(
    `Checkpoint backlog suggestions (from ${recent.length} recent checkpoint commits):\n`
  );

  const suggestions = [];
  suggestions.push({
    title: "Consolidate recurring checkpoint tooling updates",
    detail: buildTaskText(topTokens.slice(0, 4), topFiles.slice(0, 3)),
    score: 100
  });

  if (topFiles.some((file) => file.includes("README.md"))) {
    suggestions.push({
      title: "Tighten docs and command discoverability",
      detail: "Group related checkpoint commands into themed sections and add quick decision guide.",
      score: 85
    });
  }

  if (topFiles.some((file) => file.includes("package.json"))) {
    suggestions.push({
      title: "Rationalize script surface area",
      detail:
        "Review script naming consistency and consider umbrella commands for analytics categories.",
      score: 82
    });
  }

  if (topTokens.some((token) => token.includes("verify") || token.includes("drift"))) {
    suggestions.push({
      title: "Add regression checks for analytics scripts",
      detail:
        "Create lightweight smoke tests for key checkpoint utilities to prevent silent output regressions.",
      score: 80
    });
  }

  suggestions.push({
    title: "Create weekly checkpoint summary artifact",
    detail:
      "Automate one markdown report that combines momentum, drift, anomalies, and handoff in a single output.",
    score: 76
  });

  suggestions
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, topN)
    .forEach((item, idx) => {
      process.stdout.write(`${idx + 1}. [${item.score}] ${item.title}\n`);
      process.stdout.write(`   - ${item.detail}\n`);
    });

  process.stdout.write("\nSignals:\n");
  process.stdout.write(`- Top tokens: ${topTokens.slice(0, 8).join(", ")}\n`);
  process.stdout.write(`- Top files: ${topFiles.slice(0, 8).join(", ")}\n`);
}

main();
