import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function latestCheckpoint() {
  const raw = run('git log -1 --pretty=format:"%H|%ct|%s" --grep="^checkpoint:"');
  if (!raw) return null;
  const [hash, epochRaw, ...subjectParts] = raw.split("|");
  const epoch = Number(epochRaw);
  if (!Number.isFinite(epoch)) return null;
  return { hash, epoch, subject: subjectParts.join("|") };
}

function countSince(hours) {
  const raw = run(`git log --since="${hours} hours ago" --pretty=format:%H --grep="^checkpoint:"`);
  if (!raw) return 0;
  return raw.split("\n").filter(Boolean).length;
}

function classifyPulse(latestEpoch, dirtyCount) {
  if (!latestEpoch) return "NO_CHECKPOINT";
  const ageH = Math.max(0, (Math.floor(Date.now() / 1000) - latestEpoch) / 3600);
  const freshness = ageH < 2 ? "fresh" : ageH < 8 ? "ok" : "stale";
  if (freshness === "fresh" && dirtyCount === 0) return "GREEN";
  if (freshness === "stale" && dirtyCount > 0) return "RED";
  return "YELLOW";
}

function main() {
  const root = process.cwd();
  const latest = latestCheckpoint();
  const dirtyRaw = run("git status --porcelain");
  const dirtyCount = dirtyRaw ? dirtyRaw.split("\n").filter(Boolean).length : 0;
  const branch = run("git rev-parse --abbrev-ref HEAD") || "unknown";

  const today = new Date().toISOString().slice(0, 10);
  const d = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  const weekTag = `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;

  const outDir = path.resolve(root, ".checkpoints", "meta");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "checkpoint-meta.json");

  const payload = {
    generated_at: new Date().toISOString(),
    repo: {
      branch,
      dirty_count: dirtyCount
    },
    checkpoints: {
      latest: latest
        ? {
            hash: latest.hash,
            short_hash: latest.hash.slice(0, 7),
            epoch: latest.epoch,
            subject: latest.subject
          }
        : null,
      count_24h: countSince(24),
      count_7d: countSince(24 * 7),
      count_30d: countSince(24 * 30)
    },
    artifacts: {
      index: ".checkpoints/INDEX.md",
      digest_today: `.checkpoints/digests/checkpoint-digest-${today}.md`,
      weekly_current: `.checkpoints/weekly/checkpoint-weekly-${weekTag}.md`
    },
    pulse: classifyPulse(latest?.epoch ?? 0, dirtyCount)
  };

  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  process.stdout.write(`Meta written: ${outPath}\n`);
  process.stdout.write(`Pulse: ${payload.pulse}\n`);
}

main();
