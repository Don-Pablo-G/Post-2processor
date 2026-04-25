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

function countTouches(hashes) {
  const counts = new Map();
  let total = 0;
  for (const hash of hashes) {
    for (const file of getChangedFiles(hash)) {
      counts.set(file, (counts.get(file) ?? 0) + 1);
      total += 1;
    }
  }
  return { counts, total };
}

function main() {
  const commitLimit = parsePositiveInt(process.argv[2] ?? "200", 200);
  const recentWindow = parsePositiveInt(process.argv[3] ?? "30", 30);
  const topN = parsePositiveInt(process.argv[4] ?? "15", 15);

  const hashes = getCheckpointHashes(commitLimit);
  if (hashes.length < 4) {
    process.stdout.write("Not enough checkpoint commits to compute drift (need at least 4).\n");
    return;
  }

  const split = Math.min(recentWindow, Math.max(1, Math.floor(hashes.length / 2)));
  const recent = hashes.slice(0, split);
  const baseline = hashes.slice(split);

  if (baseline.length === 0) {
    process.stdout.write("Baseline window is empty; increase commitLimit.\n");
    return;
  }

  const recentStats = countTouches(recent);
  const baseStats = countTouches(baseline);

  if (recentStats.total === 0 || baseStats.total === 0) {
    process.stdout.write("Insufficient changed-file data to compute drift.\n");
    return;
  }

  const files = new Set([...recentStats.counts.keys(), ...baseStats.counts.keys()]);
  const rows = [];
  for (const file of files) {
    const r = recentStats.counts.get(file) ?? 0;
    const b = baseStats.counts.get(file) ?? 0;
    const rShare = r / recentStats.total;
    const bShare = b / baseStats.total;
    const delta = rShare - bShare;
    rows.push({ file, r, b, rShare, bShare, delta });
  }

  const rising = [...rows]
    .filter((row) => row.delta > 0)
    .sort((a, b) => b.delta - a.delta || b.r - a.r || a.file.localeCompare(b.file))
    .slice(0, topN);
  const falling = [...rows]
    .filter((row) => row.delta < 0)
    .sort((a, b) => a.delta - b.delta || b.b - a.b || a.file.localeCompare(b.file))
    .slice(0, topN);

  process.stdout.write(
    `Checkpoint drift (recent ${recent.length} checkpoints vs baseline ${baseline.length}, scanned ${hashes.length}):\n`
  );
  process.stdout.write(
    `Recent touches=${recentStats.total} | Baseline touches=${baseStats.total}\n`
  );

  process.stdout.write(`Top rising files (up to ${rising.length}):\n`);
  if (rising.length === 0) {
    process.stdout.write("- none\n");
  } else {
    rising.forEach((row, idx) => {
      process.stdout.write(
        `${String(idx + 1).padStart(2, " ")}. ${row.file}  delta=${(row.delta * 100).toFixed(2)}pp  recent=${row.r} (${(row.rShare * 100).toFixed(2)}%)  baseline=${row.b} (${(row.bShare * 100).toFixed(2)}%)\n`
      );
    });
  }

  process.stdout.write(`Top falling files (up to ${falling.length}):\n`);
  if (falling.length === 0) {
    process.stdout.write("- none\n");
  } else {
    falling.forEach((row, idx) => {
      process.stdout.write(
        `${String(idx + 1).padStart(2, " ")}. ${row.file}  delta=${(row.delta * 100).toFixed(2)}pp  recent=${row.r} (${(row.rShare * 100).toFixed(2)}%)  baseline=${row.b} (${(row.bShare * 100).toFixed(2)}%)\n`
      );
    });
  }
}

main();
