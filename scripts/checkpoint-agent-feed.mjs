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

function latestCheckpoint() {
  const raw = run('git log -1 --pretty=format:"%H|%ct|%s" --grep="^checkpoint:"');
  if (!raw) return null;
  const [hash, epochRaw, ...subjectParts] = raw.split("|");
  const epoch = Number(epochRaw);
  if (!Number.isFinite(epoch)) return null;
  return { hash, epoch, subject: subjectParts.join("|") };
}

function recentCheckpoints(limit) {
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
      return { hash, epoch, subject: subjectParts.join("|") };
    })
    .filter(Boolean);
}

function countSince(hours) {
  const raw = run(`git log --since="${hours} hours ago" --pretty=format:%H --grep="^checkpoint:"`);
  if (!raw) return 0;
  return raw.split("\n").filter(Boolean).length;
}

function pulse(latestEpoch, dirtyCount) {
  if (!latestEpoch) return "NO_CHECKPOINT";
  const ageH = Math.max(0, (Math.floor(Date.now() / 1000) - latestEpoch) / 3600);
  const freshness = ageH < 2 ? "fresh" : ageH < 8 ? "ok" : "stale";
  if (freshness === "fresh" && dirtyCount === 0) return "GREEN";
  if (freshness === "stale" && dirtyCount > 0) return "RED";
  return "YELLOW";
}

function emit(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

function main() {
  const limit = parsePositiveInt(process.argv[2] ?? "20", 20);
  const latest = latestCheckpoint();
  const recent = recentCheckpoints(limit);
  const dirtyRaw = run("git status --porcelain");
  const dirtyCount = dirtyRaw ? dirtyRaw.split("\n").filter(Boolean).length : 0;
  const branch = run("git rev-parse --abbrev-ref HEAD") || "unknown";

  emit({
    type: "checkpoint_meta",
    ts: new Date().toISOString(),
    branch,
    dirty_count: dirtyCount,
    pulse: pulse(latest?.epoch ?? 0, dirtyCount),
    count_24h: countSince(24),
    count_7d: countSince(24 * 7),
    latest: latest
      ? { hash: latest.hash, short_hash: latest.hash.slice(0, 7), epoch: latest.epoch, subject: latest.subject }
      : null
  });

  for (const cp of recent) {
    emit({
      type: "checkpoint_event",
      ts: new Date().toISOString(),
      hash: cp.hash,
      short_hash: cp.hash.slice(0, 7),
      epoch: cp.epoch,
      subject: cp.subject
    });
  }
}

main();
