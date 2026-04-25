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

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function getCheckpointHashes(limit) {
  const raw = run(`git log --pretty=format:%H --grep="^checkpoint:" -n ${limit}`);
  if (!raw) return [];
  return raw.split("\n").map((line) => line.trim()).filter(Boolean);
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

function summarizeWindow(hashes) {
  const fileCounts = new Map();
  let touches = 0;
  for (const hash of hashes) {
    for (const file of getChangedFiles(hash)) {
      fileCounts.set(file, (fileCounts.get(file) ?? 0) + 1);
      touches += 1;
    }
  }
  return {
    checkpoints: hashes.length,
    uniqueFiles: fileCounts.size,
    touches,
    fileCounts
  };
}

function shannonEntropy(values) {
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return 0;
  let entropy = 0;
  for (const value of values) {
    if (value <= 0) continue;
    const p = value / total;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function pctDelta(curr, prev) {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr - prev) / prev) * 100;
}

function scoreLabel(score) {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function bar(score) {
  const width = Math.round((score / 100) * 20);
  return "#".repeat(Math.max(0, width));
}

function main() {
  const commitLimit = parsePositiveInt(process.argv[2] ?? "180", 180);
  const windowSize = parsePositiveInt(process.argv[3] ?? "20", 20);

  const hashes = getCheckpointHashes(commitLimit);
  if (hashes.length < windowSize * 2) {
    process.stdout.write(
      `Not enough checkpoints for radar. Need at least ${windowSize * 2}, found ${hashes.length}.\n`
    );
    return;
  }

  const currentHashes = hashes.slice(0, windowSize);
  const previousHashes = hashes.slice(windowSize, windowSize * 2);
  const current = summarizeWindow(currentHashes);
  const previous = summarizeWindow(previousHashes);

  const totalTouches = current.touches;
  const counts = Array.from(current.fileCounts.values());
  const entropy = shannonEntropy(counts);
  const maxEntropy = Math.log2(Math.max(1, current.fileCounts.size));
  const entropyNorm = maxEntropy > 0 ? entropy / maxEntropy : 0;
  const concentrationScore = clamp01(1 - entropyNorm) * 100;

  const breadthDelta = pctDelta(current.uniqueFiles, previous.uniqueFiles);
  const touchDelta = pctDelta(current.touches, previous.touches);
  const momentumMagnitude = (Math.abs(breadthDelta) + Math.abs(touchDelta)) / 2;
  const momentumScore = clamp01(momentumMagnitude / 100) * 100;

  const filesUnion = new Set([...current.fileCounts.keys(), ...previous.fileCounts.keys()]);
  let driftAccumulator = 0;
  for (const file of filesUnion) {
    const currShare = totalTouches > 0 ? (current.fileCounts.get(file) ?? 0) / totalTouches : 0;
    const prevShare =
      previous.touches > 0 ? (previous.fileCounts.get(file) ?? 0) / previous.touches : 0;
    driftAccumulator += Math.abs(currShare - prevShare);
  }
  const driftScore = clamp01(driftAccumulator / 2) * 100;

  const overlapCount = Array.from(current.fileCounts.keys()).filter((f) =>
    previous.fileCounts.has(f)
  ).length;
  const overlapDen = Math.max(1, filesUnion.size);
  const stabilityScore = (overlapCount / overlapDen) * 100;

  const overall = (concentrationScore + momentumScore + driftScore + (100 - stabilityScore)) / 4;

  process.stdout.write(
    `Checkpoint radar (current ${windowSize} vs previous ${windowSize}, scanned ${hashes.length}):\n`
  );
  process.stdout.write(
    `Overall change intensity: ${overall.toFixed(1)} (${scoreLabel(overall)}) ${bar(overall)}\n`
  );
  process.stdout.write(
    `- Concentration: ${concentrationScore.toFixed(1)} (${scoreLabel(concentrationScore)}) ${bar(
      concentrationScore
    )}\n`
  );
  process.stdout.write(
    `- Momentum: ${momentumScore.toFixed(1)} (${scoreLabel(momentumScore)}) ${bar(momentumScore)}\n`
  );
  process.stdout.write(
    `- Drift: ${driftScore.toFixed(1)} (${scoreLabel(driftScore)}) ${bar(driftScore)}\n`
  );
  process.stdout.write(
    `- Instability: ${(100 - stabilityScore).toFixed(1)} (${scoreLabel(
      100 - stabilityScore
    )}) ${bar(100 - stabilityScore)}\n`
  );
  process.stdout.write(
    `Signals: breadthDelta=${breadthDelta.toFixed(2)}%, touchDelta=${touchDelta.toFixed(2)}%, overlap=${stabilityScore.toFixed(
      2
    )}%\n`
  );
}

main();
