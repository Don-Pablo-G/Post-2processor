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

function main() {
  const commitLimit = parsePositiveInt(process.argv[2] ?? "300", 300);
  const topN = parsePositiveInt(process.argv[3] ?? "10", 10);
  const hashes = getCheckpointHashes(commitLimit);

  if (hashes.length === 0) {
    process.stdout.write("No checkpoint commits found.\n");
    return;
  }

  const fileCounts = new Map();
  let totalTouches = 0;
  let commitsWithFiles = 0;

  for (const hash of hashes) {
    const files = getChangedFiles(hash);
    if (files.length === 0) continue;
    commitsWithFiles += 1;
    for (const file of files) {
      fileCounts.set(file, (fileCounts.get(file) ?? 0) + 1);
      totalTouches += 1;
    }
  }

  if (fileCounts.size === 0) {
    process.stdout.write("No changed files found in checkpoint commits.\n");
    return;
  }

  const counts = Array.from(fileCounts.values());
  const entropy = shannonEntropy(counts);
  const maxEntropy = Math.log2(fileCounts.size);
  const normalized = maxEntropy > 0 ? entropy / maxEntropy : 0;

  const sorted = Array.from(fileCounts.entries()).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, topN);
  const topTouchSum = top.reduce((sum, [, count]) => sum + count, 0);
  const concentrationTopN = (topTouchSum / totalTouches) * 100;
  const top1Share = (sorted[0][1] / totalTouches) * 100;

  process.stdout.write(
    `Checkpoint entropy report (scanned ${hashes.length} checkpoints, ${commitsWithFiles} with file changes):\n`
  );
  process.stdout.write(`Unique files touched: ${fileCounts.size}\n`);
  process.stdout.write(`Total file touches: ${totalTouches}\n`);
  process.stdout.write(`Shannon entropy: ${entropy.toFixed(4)} bits\n`);
  process.stdout.write(`Normalized spread (0-1): ${normalized.toFixed(4)}\n`);
  process.stdout.write(`Top-1 concentration: ${top1Share.toFixed(2)}%\n`);
  process.stdout.write(
    `Top-${Math.min(topN, top.length)} concentration: ${concentrationTopN.toFixed(2)}%\n`
  );

  process.stdout.write(`Top ${Math.min(topN, top.length)} files by touches:\n`);
  top.forEach(([file, count], idx) => {
    const share = ((count / totalTouches) * 100).toFixed(2);
    process.stdout.write(`${String(idx + 1).padStart(2, " ")}. ${file}  ${count} (${share}%)\n`);
  });
}

main();
