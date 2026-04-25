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

function getCheckpointHashes(limit) {
  const raw = run(`git log --pretty=format:%H --grep="^checkpoint:" -n ${limit}`);
  if (!raw) return [];
  return raw.split("\n").map((line) => line.trim()).filter(Boolean);
}

function getChangedFiles(hash) {
  const raw = run(`git show --pretty=format: --name-only ${hash}`);
  if (!raw) return [];
  const unique = new Set(
    raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  );
  return Array.from(unique).sort();
}

function pairKey(a, b) {
  return `${a}|||${b}`;
}

function main() {
  const commitLimit = parsePositiveInt(process.argv[2] ?? "200", 200);
  const topN = parsePositiveInt(process.argv[3] ?? "20", 20);
  const hashes = getCheckpointHashes(commitLimit);

  if (hashes.length === 0) {
    process.stdout.write("No checkpoint commits found.\n");
    return;
  }

  const pairCounts = new Map();
  let commitsWithPairs = 0;

  for (const hash of hashes) {
    const files = getChangedFiles(hash);
    if (files.length < 2) continue;
    commitsWithPairs += 1;

    for (let i = 0; i < files.length; i += 1) {
      for (let j = i + 1; j < files.length; j += 1) {
        const key = pairKey(files[i], files[j]);
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }

  if (pairCounts.size === 0) {
    process.stdout.write(
      `No co-change pairs found across ${hashes.length} checkpoint commit(s).\n`
    );
    return;
  }

  const ranked = Array.from(pairCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN);

  process.stdout.write(
    `Checkpoint co-change pairs (top ${ranked.length}, scanned ${hashes.length} checkpoints, ${commitsWithPairs} with 2+ files):\n`
  );

  for (let i = 0; i < ranked.length; i += 1) {
    const [key, count] = ranked[i];
    const [left, right] = key.split("|||");
    process.stdout.write(
      `${String(i + 1).padStart(2, " ")}. ${left}  <->  ${right}  (${count})\n`
    );
  }
}

main();
