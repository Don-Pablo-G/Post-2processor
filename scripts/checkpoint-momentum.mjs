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
  const files = new Map();
  let touches = 0;
  for (const hash of hashes) {
    for (const file of getChangedFiles(hash)) {
      files.set(file, (files.get(file) ?? 0) + 1);
      touches += 1;
    }
  }
  return {
    checkpoints: hashes.length,
    uniqueFiles: files.size,
    touches
  };
}

function pctDelta(curr, prev) {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr - prev) / prev) * 100;
}

function classify(delta, threshold = 10) {
  if (delta >= threshold) return "accelerating";
  if (delta <= -threshold) return "decelerating";
  return "steady";
}

function main() {
  const commitLimit = parsePositiveInt(process.argv[2] ?? "120", 120);
  const windowSize = parsePositiveInt(process.argv[3] ?? "15", 15);

  const hashes = getCheckpointHashes(commitLimit);
  if (hashes.length < windowSize * 2) {
    process.stdout.write(
      `Not enough checkpoints for momentum analysis. Need at least ${windowSize * 2}, found ${hashes.length}.\n`
    );
    return;
  }

  const currentHashes = hashes.slice(0, windowSize);
  const previousHashes = hashes.slice(windowSize, windowSize * 2);

  const current = summarizeWindow(currentHashes);
  const previous = summarizeWindow(previousHashes);

  const checkpointDelta = pctDelta(current.checkpoints, previous.checkpoints);
  const fileBreadthDelta = pctDelta(current.uniqueFiles, previous.uniqueFiles);
  const touchDelta = pctDelta(current.touches, previous.touches);

  process.stdout.write(
    `Checkpoint momentum (current ${windowSize} vs previous ${windowSize}, scanned ${hashes.length}):\n`
  );
  process.stdout.write(
    `Checkpoints: ${previous.checkpoints} -> ${current.checkpoints} (${checkpointDelta.toFixed(2)}%, ${classify(
      checkpointDelta
    )})\n`
  );
  process.stdout.write(
    `Unique files touched: ${previous.uniqueFiles} -> ${current.uniqueFiles} (${fileBreadthDelta.toFixed(
      2
    )}%, ${classify(fileBreadthDelta)})\n`
  );
  process.stdout.write(
    `Total file touches: ${previous.touches} -> ${current.touches} (${touchDelta.toFixed(2)}%, ${classify(
      touchDelta
    )})\n`
  );

  const densityPrev = previous.checkpoints > 0 ? previous.touches / previous.checkpoints : 0;
  const densityCurr = current.checkpoints > 0 ? current.touches / current.checkpoints : 0;
  const densityDelta = pctDelta(densityCurr, densityPrev);
  process.stdout.write(
    `Touch density (touches/checkpoint): ${densityPrev.toFixed(2)} -> ${densityCurr.toFixed(
      2
    )} (${densityDelta.toFixed(2)}%, ${classify(densityDelta, 5)})\n`
  );
}

main();
