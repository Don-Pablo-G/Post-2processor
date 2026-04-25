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

function getCheckpointCommits(limit) {
  const raw = run(`git log --pretty=format:"%H|%ct|%s" --grep="^checkpoint:" -n ${limit}`);
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [hash, epochRaw, ...subjectParts] = line.split("|");
      const epoch = Number(epochRaw);
      if (!Number.isFinite(epoch)) return null;
      return {
        hash,
        epoch,
        subject: subjectParts.join("|")
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.epoch - b.epoch);
}

function formatStamp(epoch) {
  const d = new Date(epoch * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function formatDuration(seconds) {
  const mins = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function clusterByGap(commits, gapMinutes) {
  const clusters = [];
  if (commits.length === 0) return clusters;

  const gapSec = gapMinutes * 60;
  let current = [commits[0]];

  for (let i = 1; i < commits.length; i += 1) {
    const prev = commits[i - 1];
    const next = commits[i];
    if (next.epoch - prev.epoch <= gapSec) {
      current.push(next);
    } else {
      clusters.push(current);
      current = [next];
    }
  }
  clusters.push(current);
  return clusters;
}

function main() {
  const commitLimit = parsePositiveInt(process.argv[2] ?? "240", 240);
  const gapMinutes = parsePositiveInt(process.argv[3] ?? "45", 45);
  const topN = parsePositiveInt(process.argv[4] ?? "12", 12);

  const commits = getCheckpointCommits(commitLimit);
  if (commits.length === 0) {
    process.stdout.write("No checkpoint commits found.\n");
    return;
  }

  const clusters = clusterByGap(commits, gapMinutes);
  const ranked = [...clusters]
    .map((cluster) => {
      const start = cluster[0].epoch;
      const end = cluster[cluster.length - 1].epoch;
      return {
        count: cluster.length,
        start,
        end,
        spanSec: Math.max(0, end - start),
        firstHash: cluster[0].hash,
        lastHash: cluster[cluster.length - 1].hash,
        firstSubject: cluster[0].subject,
        lastSubject: cluster[cluster.length - 1].subject
      };
    })
    .sort((a, b) => b.count - a.count || b.spanSec - a.spanSec)
    .slice(0, topN);

  const avgSize =
    clusters.reduce((sum, cluster) => sum + cluster.length, 0) / Math.max(1, clusters.length);

  process.stdout.write(
    `Checkpoint clusters (scanned ${commits.length}, gap=${gapMinutes}m, total clusters=${clusters.length}, avg size=${avgSize.toFixed(
      2
    )}):\n`
  );

  ranked.forEach((cluster, idx) => {
    process.stdout.write(
      `${String(idx + 1).padStart(2, " ")}. commits=${cluster.count} span=${formatDuration(
        cluster.spanSec
      )} start=${formatStamp(cluster.start)} end=${formatStamp(cluster.end)}\n`
    );
    process.stdout.write(
      `    first=${cluster.firstHash.slice(0, 7)} ${cluster.firstSubject}\n`
    );
    process.stdout.write(
      `    last=${cluster.lastHash.slice(0, 7)} ${cluster.lastSubject}\n`
    );
  });
}

main();
