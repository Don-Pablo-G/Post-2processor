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

function getCommitEpoch(hash) {
  const raw = run(`git show -s --format=%ct ${hash}`);
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
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

function ageBucket(daysAgo) {
  if (daysAgo <= 1) return "0-1d";
  if (daysAgo <= 3) return "2-3d";
  if (daysAgo <= 7) return "4-7d";
  if (daysAgo <= 14) return "8-14d";
  if (daysAgo <= 30) return "15-30d";
  return "31d+";
}

function main() {
  const commitLimit = parsePositiveInt(process.argv[2] ?? "300", 300);
  const topN = parsePositiveInt(process.argv[3] ?? "25", 25);
  const hashes = getCheckpointHashes(commitLimit);

  if (hashes.length === 0) {
    process.stdout.write("No checkpoint commits found.\n");
    return;
  }

  const fileStats = new Map();
  let newestEpoch = 0;
  let oldestEpoch = Number.MAX_SAFE_INTEGER;

  for (const hash of hashes) {
    const epoch = getCommitEpoch(hash);
    if (epoch <= 0) continue;
    newestEpoch = Math.max(newestEpoch, epoch);
    oldestEpoch = Math.min(oldestEpoch, epoch);

    const files = getChangedFiles(hash);
    for (const file of files) {
      const entry = fileStats.get(file) ?? {
        touches: 0,
        lastEpoch: 0,
        firstEpoch: Number.MAX_SAFE_INTEGER
      };
      entry.touches += 1;
      entry.lastEpoch = Math.max(entry.lastEpoch, epoch);
      entry.firstEpoch = Math.min(entry.firstEpoch, epoch);
      fileStats.set(file, entry);
    }
  }

  if (fileStats.size === 0) {
    process.stdout.write("No changed files found in checkpoint commits.\n");
    return;
  }

  const nowEpoch = Math.floor(Date.now() / 1000);
  const span = Math.max(1, newestEpoch - Math.max(0, oldestEpoch));

  const scored = Array.from(fileStats.entries()).map(([file, stats]) => {
    const recencyNorm = Math.max(0, Math.min(1, (stats.lastEpoch - oldestEpoch) / span));
    const score = stats.touches * 0.7 + recencyNorm * 30;
    const daysAgo = Math.max(0, (nowEpoch - stats.lastEpoch) / 86400);
    return {
      file,
      touches: stats.touches,
      lastEpoch: stats.lastEpoch,
      daysAgo,
      bucket: ageBucket(daysAgo),
      score
    };
  });

  scored.sort((a, b) => b.score - a.score || b.touches - a.touches || a.file.localeCompare(b.file));
  const shown = scored.slice(0, topN);

  process.stdout.write(
    `Checkpoint touchmap (top ${shown.length}, scanned ${hashes.length} checkpoints):\n`
  );
  process.stdout.write("Ranked by blended score = touches weight + recency bonus.\n");
  for (let i = 0; i < shown.length; i += 1) {
    const row = shown[i];
    process.stdout.write(
      `${String(i + 1).padStart(2, " ")}. ${row.file}  touches=${row.touches}  recency=${row.bucket}  score=${row.score.toFixed(2)}\n`
    );
  }
}

main();
