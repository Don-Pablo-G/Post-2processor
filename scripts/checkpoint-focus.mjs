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

function normalizeWord(word) {
  return word.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
}

function getStopWords() {
  return new Set([
    "a",
    "an",
    "and",
    "as",
    "at",
    "by",
    "for",
    "from",
    "in",
    "into",
    "is",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
    "add",
    "update",
    "command",
    "checkpoint",
    "checkpoints"
  ]);
}

function extractSubjects(days) {
  const raw = run(
    `git log --since="${days} days ago" --pretty=format:"%s" --grep="^checkpoint:"`
  );
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseTokens(subject, stopWords) {
  return subject
    .split(/\s+/)
    .map(normalizeWord)
    .filter((word) => word.length >= 3 && !stopWords.has(word));
}

function main() {
  const days = parsePositiveInt(process.argv[2] ?? "30", 30);
  const topN = parsePositiveInt(process.argv[3] ?? "15", 15);
  const subjects = extractSubjects(days);

  if (subjects.length === 0) {
    process.stdout.write(`No checkpoint commits found in the last ${days} day(s).\n`);
    return;
  }

  const stopWords = getStopWords();
  const tokenCounts = new Map();

  for (const subject of subjects) {
    const uniqueTokens = new Set(parseTokens(subject, stopWords));
    for (const token of uniqueTokens) {
      tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
    }
  }

  const ranked = Array.from(tokenCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN);

  if (ranked.length === 0) {
    process.stdout.write("No focus keywords found after normalization filters.\n");
    return;
  }

  process.stdout.write(
    `Checkpoint focus keywords (last ${days} day(s), ${subjects.length} checkpoint subjects):\n`
  );
  for (let i = 0; i < ranked.length; i += 1) {
    const [token, count] = ranked[i];
    const pct = ((count / subjects.length) * 100).toFixed(1);
    process.stdout.write(
      `${String(i + 1).padStart(2, " ")}. ${token}  ${count} (${pct}% of subjects)\n`
    );
  }
}

main();
