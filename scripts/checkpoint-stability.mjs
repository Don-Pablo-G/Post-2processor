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

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values, avg) {
  if (values.length <= 1) return 0;
  const variance =
    values.reduce((sum, value) => sum + (value - avg) * (value - avg), 0) / values.length;
  return Math.sqrt(variance);
}

function main() {
  const commitLimit = parsePositiveInt(process.argv[2] ?? "240", 240);
  const windowSize = parsePositiveInt(process.argv[3] ?? "12", 12);
  const minTouches = parsePositiveInt(process.argv[4] ?? "3", 3);
  const topN = parsePositiveInt(process.argv[5] ?? "15", 15);

  const hashes = getCheckpointHashes(commitLimit);
  if (hashes.length < windowSize * 2) {
    process.stdout.write(
      `Not enough checkpoints for stability analysis. Need at least ${windowSize * 2}, found ${hashes.length}.\n`
    );
    return;
  }

  const windows = [];
  for (let i = 0; i < hashes.length; i += windowSize) {
    const slice = hashes.slice(i, i + windowSize);
    if (slice.length < Math.max(2, Math.floor(windowSize / 2))) continue;
    windows.push(slice);
  }

  if (windows.length < 2) {
    process.stdout.write("Not enough windows to compare stability.\n");
    return;
  }

  const perWindowCounts = windows.map((windowHashes) => {
    const counts = new Map();
    for (const hash of windowHashes) {
      for (const file of getChangedFiles(hash)) {
        counts.set(file, (counts.get(file) ?? 0) + 1);
      }
    }
    return counts;
  });

  const files = new Set();
  perWindowCounts.forEach((counts) => counts.forEach((_, file) => files.add(file)));

  const rows = [];
  for (const file of files) {
    const series = perWindowCounts.map((counts) => counts.get(file) ?? 0);
    const touches = series.reduce((sum, value) => sum + value, 0);
    if (touches < minTouches) continue;

    const avg = mean(series);
    const sd = stdDev(series, avg);
    const coeffVar = avg > 0 ? sd / avg : 0;
    const activeWindows = series.filter((v) => v > 0).length;
    const presence = activeWindows / series.length;

    rows.push({
      file,
      touches,
      avg,
      sd,
      coeffVar,
      presence,
      stabilityScore: presence * (1 / (1 + coeffVar)),
      volatilityScore: coeffVar * (1 - presence / 2)
    });
  }

  if (rows.length === 0) {
    process.stdout.write("No files met minimum touch threshold for stability analysis.\n");
    return;
  }

  const stable = [...rows]
    .sort(
      (a, b) =>
        b.stabilityScore - a.stabilityScore || b.touches - a.touches || a.file.localeCompare(b.file)
    )
    .slice(0, topN);

  const volatile = [...rows]
    .sort(
      (a, b) =>
        b.volatilityScore - a.volatilityScore || b.sd - a.sd || a.file.localeCompare(b.file)
    )
    .slice(0, topN);

  process.stdout.write(
    `Checkpoint stability (scanned ${hashes.length} checkpoints, ${windows.length} windows x ~${windowSize}):\n`
  );
  process.stdout.write(
    `Filters: minTouches=${minTouches}, candidateFiles=${rows.length}\n`
  );

  process.stdout.write(`Most stable files (top ${stable.length}):\n`);
  stable.forEach((row, idx) => {
    process.stdout.write(
      `${String(idx + 1).padStart(2, " ")}. ${row.file}  touches=${row.touches}  presence=${(row.presence * 100).toFixed(1)}%  cv=${row.coeffVar.toFixed(3)}  stability=${row.stabilityScore.toFixed(3)}\n`
    );
  });

  process.stdout.write(`Most volatile files (top ${volatile.length}):\n`);
  volatile.forEach((row, idx) => {
    process.stdout.write(
      `${String(idx + 1).padStart(2, " ")}. ${row.file}  touches=${row.touches}  avg=${row.avg.toFixed(2)}  sd=${row.sd.toFixed(2)}  cv=${row.coeffVar.toFixed(3)}  volatility=${row.volatilityScore.toFixed(3)}\n`
    );
  });
}

main();
