import { execSync } from "node:child_process";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function parseArgs(argv) {
  const maxGapMin = Number(argv[2] ?? "5");
  const minClusterSize = Number(argv[3] ?? "4");
  return {
    maxGapMs: (Number.isFinite(maxGapMin) && maxGapMin > 0 ? maxGapMin : 5) * 60_000,
    minClusterSize: Number.isFinite(minClusterSize) && minClusterSize > 1 ? Math.floor(minClusterSize) : 4
  };
}

function readCheckpoints(limit = 200) {
  const raw = run(`git log --date=iso-strict --pretty=format:"%h|%ad|%s" --grep="^checkpoint:" -n ${limit}`);
  if (!raw) return [];
  // git log order: newest -> oldest
  return raw
    .split("\n")
    .map((line) => {
      const [hash, isoDate, subject] = line.split("|");
      const ms = new Date(isoDate).getTime();
      return { hash, isoDate, subject, ms };
    })
    .filter((row) => Number.isFinite(row.ms));
}

function formatMinutes(ms) {
  return `${Math.round(ms / 60000)}m`;
}

function buildClusters(rows, maxGapMs, minClusterSize) {
  if (rows.length === 0) return [];
  const clusters = [];
  let current = [rows[0]];

  for (let i = 1; i < rows.length; i += 1) {
    const prev = rows[i - 1];
    const next = rows[i];
    const gap = prev.ms - next.ms; // newer to older
    if (gap <= maxGapMs) {
      current.push(next);
    } else {
      if (current.length >= minClusterSize) clusters.push(current);
      current = [next];
    }
  }

  if (current.length >= minClusterSize) clusters.push(current);
  return clusters;
}

function main() {
  const { maxGapMs, minClusterSize } = parseArgs(process.argv);
  const rows = readCheckpoints();
  if (rows.length === 0) {
    process.stdout.write("No checkpoint commits found.\n");
    return;
  }

  const clusters = buildClusters(rows, maxGapMs, minClusterSize);
  if (clusters.length === 0) {
    process.stdout.write(
      `No dense checkpoint clusters found (max gap ${formatMinutes(maxGapMs)}, min size ${minClusterSize}).\n`
    );
    return;
  }

  process.stdout.write(
    `Prune suggestions (max gap ${formatMinutes(maxGapMs)}, min cluster ${minClusterSize} checkpoints):\n`
  );

  clusters.forEach((cluster, idx) => {
    const newest = cluster[0];
    const oldest = cluster[cluster.length - 1];
    const span = newest.ms - oldest.ms;
    process.stdout.write(
      `\n${idx + 1}) ${cluster.length} checkpoints over ${formatMinutes(span)}\n`
    );
    process.stdout.write(`   newest: ${newest.hash} ${newest.subject}\n`);
    process.stdout.write(`   oldest: ${oldest.hash} ${oldest.subject}\n`);
    process.stdout.write(
      `   inspect range: git log --oneline --reverse ${oldest.hash}^..${newest.hash}\n`
    );
    process.stdout.write(
      `   optional squash branch: git switch -c "checkpoint-squash-${oldest.hash}-${newest.hash}" ${newest.hash}\n`
    );
  });

  process.stdout.write(
    "\nNote: this command is advisory only. It does not rewrite history.\n"
  );
}

main();
