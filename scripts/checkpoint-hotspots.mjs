import { execSync } from "node:child_process";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function parseLimit(argv) {
  const candidate = Number(argv[2] ?? "15");
  if (!Number.isFinite(candidate) || candidate < 1) return 15;
  return Math.floor(candidate);
}

function getCheckpointCommits(limit = 300) {
  const raw = run(`git log --pretty=format:%H --grep="^checkpoint:" -n ${limit}`);
  return raw ? raw.split("\n").filter(Boolean) : [];
}

function main() {
  const topN = parseLimit(process.argv);
  const commits = getCheckpointCommits(300);
  if (commits.length === 0) {
    process.stdout.write("No checkpoint commits found.\n");
    return;
  }

  const counts = new Map();
  for (const hash of commits) {
    const filesRaw = run(`git show --pretty=format: --name-only ${hash}`);
    if (!filesRaw) continue;
    const uniqueFiles = new Set(
      filesRaw
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean)
    );
    for (const file of uniqueFiles) {
      counts.set(file, (counts.get(file) ?? 0) + 1);
    }
  }

  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, topN);
  if (ranked.length === 0) {
    process.stdout.write("No changed files detected in checkpoint commits.\n");
    return;
  }

  process.stdout.write(`Checkpoint hotspots (top ${topN} files across ${commits.length} checkpoints):\n`);
  ranked.forEach(([file, count], idx) => {
    process.stdout.write(`${String(idx + 1).padStart(2, " ")}. ${file} (${count})\n`);
  });
}

main();
