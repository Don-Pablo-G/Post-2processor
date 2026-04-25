import { execSync } from "node:child_process";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function latestCheckpoint() {
  const raw = run('git log -1 --pretty=format:"%h|%ct|%s" --grep="^checkpoint:"');
  if (!raw) return null;
  const [hash, epochRaw, ...subjectParts] = raw.split("|");
  const epoch = Number(epochRaw);
  if (!Number.isFinite(epoch)) return null;
  return { hash, epoch, subject: subjectParts.join("|") };
}

function hoursAgo(epoch) {
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, (now - epoch) / 3600);
}

function activity24h() {
  const raw = run('git log --since="24 hours ago" --pretty=format:%h --grep="^checkpoint:"');
  if (!raw) return 0;
  return raw.split("\n").filter(Boolean).length;
}

function main() {
  const cp = latestCheckpoint();
  const dirty = run("git status --porcelain");
  const dirtyCount = dirty ? dirty.split("\n").filter(Boolean).length : 0;
  const recent = activity24h();

  if (!cp) {
    process.stdout.write(`pulse=NO_CHECKPOINT dirty=${dirtyCount} c24h=${recent}\n`);
    return;
  }

  const ageH = hoursAgo(cp.epoch);
  const freshness = ageH < 2 ? "fresh" : ageH < 8 ? "ok" : "stale";
  const tree = dirtyCount === 0 ? "clean" : "dirty";
  const state =
    freshness === "fresh" && tree === "clean"
      ? "GREEN"
      : freshness === "stale" && tree === "dirty"
        ? "RED"
        : "YELLOW";

  process.stdout.write(
    `pulse=${state} cp=${cp.hash} age_h=${ageH.toFixed(1)} tree=${tree} dirty=${dirtyCount} c24h=${recent}\n`
  );
}

main();
