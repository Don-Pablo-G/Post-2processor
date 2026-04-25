import { execSync } from "node:child_process";
import { createServer } from "node:http";

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

function buildMeta() {
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

  return {
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
}

function json(res, code, body) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(body, null, 2)}\n`);
}

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function main() {
  if (hasFlag("--once")) {
    process.stdout.write(`${JSON.stringify(buildMeta(), null, 2)}\n`);
    return;
  }

  const host = arg("--host", "127.0.0.1");
  const portRaw = Number(arg("--port", "43123"));
  const port = Number.isFinite(portRaw) ? Math.floor(portRaw) : 43123;

  const server = createServer((req, res) => {
    const url = req.url ?? "/";
    if (url === "/meta") {
      json(res, 200, buildMeta());
      return;
    }
    if (url === "/health") {
      json(res, 200, { ok: true, service: "checkpoint-api", time: new Date().toISOString() });
      return;
    }
    json(res, 404, { ok: false, error: "Not found", endpoints: ["/health", "/meta"] });
  });

  server.listen(port, host, () => {
    process.stdout.write(`checkpoint-api listening on http://${host}:${port}\n`);
    process.stdout.write("endpoints: /health, /meta\n");
  });
}

main();
