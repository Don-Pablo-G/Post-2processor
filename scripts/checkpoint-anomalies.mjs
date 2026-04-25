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

function getCommitMeta(hash) {
  const raw = run(`git show -s --format="%H|%ct|%s" ${hash}`);
  if (!raw) return null;
  const [fullHash, epochRaw, ...subjectParts] = raw.split("|");
  const epoch = Number(epochRaw);
  if (!Number.isFinite(epoch)) return null;
  return {
    hash: fullHash,
    epoch,
    subject: subjectParts.join("|")
  };
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
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values, avg) {
  if (values.length <= 1) return 0;
  const variance = values.reduce((sum, v) => sum + (v - avg) * (v - avg), 0) / values.length;
  return Math.sqrt(variance);
}

function zScore(value, avg, sd) {
  if (sd <= 0) return 0;
  return (value - avg) / sd;
}

function formatDate(epoch) {
  const d = new Date(epoch * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

function main() {
  const commitLimit = parsePositiveInt(process.argv[2] ?? "180", 180);
  const baselineSize = parsePositiveInt(process.argv[3] ?? "40", 40);
  const zThreshold = Number(process.argv[4] ?? "1.8");

  const hashes = getCheckpointHashes(commitLimit);
  if (hashes.length < Math.max(10, baselineSize + 5)) {
    process.stdout.write(
      `Not enough checkpoints for anomaly detection. Need at least ${Math.max(
        10,
        baselineSize + 5
      )}, found ${hashes.length}.\n`
    );
    return;
  }

  const stats = [];
  for (const hash of hashes) {
    const meta = getCommitMeta(hash);
    if (!meta) continue;
    const files = getChangedFiles(hash);
    stats.push({
      ...meta,
      fileCount: files.length
    });
  }

  if (stats.length < Math.max(10, baselineSize + 5)) {
    process.stdout.write("Insufficient checkpoint metadata for anomaly detection.\n");
    return;
  }

  // stats is newest->oldest to match git log ordering
  const baseline = stats.slice(0, baselineSize);
  const baselineFileCounts = baseline.map((s) => s.fileCount);

  const baseAvg = mean(baselineFileCounts);
  const baseSd = stdDev(baselineFileCounts, baseAvg);

  const zeroVariance = baseSd <= 0;
  const anomalies = stats
    .map((entry) => {
      const z = zScore(entry.fileCount, baseAvg, baseSd);
      const absDelta = Math.abs(entry.fileCount - baseAvg);
      return {
        ...entry,
        z,
        absDelta
      };
    })
    .filter((entry) =>
      zeroVariance
        ? entry.absDelta >= 1 // fallback: at least 1 file away from flat baseline
        : Math.abs(entry.z) >= zThreshold
    )
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z) || b.fileCount - a.fileCount)
    .slice(0, 20);

  process.stdout.write(
    `Checkpoint anomalies (scanned ${stats.length}, baseline=${baselineSize}, threshold=|z|>=${zThreshold}):\n`
  );
  process.stdout.write(
    `Baseline file-count mean=${baseAvg.toFixed(2)}, sd=${baseSd.toFixed(2)}\n`
  );
  if (zeroVariance) {
    process.stdout.write(
      "Baseline variance is zero; using absolute delta fallback (>= 1 file).\n"
    );
  }

  if (anomalies.length === 0) {
    process.stdout.write("No anomalies exceeded the configured z-score threshold.\n");
    return;
  }

  anomalies.forEach((entry, idx) => {
    const direction = entry.fileCount >= baseAvg ? "larger" : "smaller";
    process.stdout.write(
      `${String(idx + 1).padStart(2, " ")}. ${entry.hash.slice(0, 7)}  ${formatDate(
        entry.epoch
      )}  files=${entry.fileCount}  z=${entry.z.toFixed(2)} (${direction})  ${entry.subject}\n`
    );
  });
}

main();
