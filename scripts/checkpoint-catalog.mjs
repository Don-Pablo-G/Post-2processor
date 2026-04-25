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

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function readCheckpoints(limit = 500) {
  const raw = run(`git log --date=iso-strict --pretty=format:"%H|%h|%ad|%s" --grep="^checkpoint:" -n ${limit}`);
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => {
      const [fullHash, shortHash, isoDate, subject] = line.split("|");
      const timeMs = new Date(isoDate).getTime();
      return {
        fullHash,
        shortHash,
        isoDate,
        subject,
        timeMs: Number.isFinite(timeMs) ? timeMs : null
      };
    })
    .filter((row) => row.timeMs !== null);
}

function buildStats(rows) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const perDay = {};
  for (const row of rows) {
    const day = row.isoDate.slice(0, 10);
    perDay[day] = (perDay[day] ?? 0) + 1;
  }
  const today = perDay[todayKey] ?? 0;

  let avgIntervalMinutes = null;
  if (rows.length > 1) {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < rows.length - 1; i += 1) {
      const newer = rows[i].timeMs;
      const older = rows[i + 1].timeMs;
      if (typeof newer === "number" && typeof older === "number" && newer >= older) {
        sum += newer - older;
        n += 1;
      }
    }
    avgIntervalMinutes = n > 0 ? Math.round(sum / n / 60000) : null;
  }

  return {
    total: rows.length,
    todayKey,
    today,
    avgIntervalMinutes,
    perDay
  };
}

function main() {
  const root = run("git rev-parse --show-toplevel") || process.cwd();
  const branch = run("git rev-parse --abbrev-ref HEAD") || "unknown";
  const head = run("git log -1 --oneline") || "unknown";
  const checkpoints = readCheckpoints();
  const stats = buildStats(checkpoints);

  const payload = {
    generatedAt: new Date().toISOString(),
    repository: {
      root,
      branch,
      head
    },
    stats,
    checkpoints: checkpoints.map((c) => ({
      fullHash: c.fullHash,
      shortHash: c.shortHash,
      isoDate: c.isoDate,
      subject: c.subject
    }))
  };

  const outDir = path.join(root, ".checkpoints", "catalog");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `checkpoint-catalog-${nowStamp()}.json`);
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  process.stdout.write(`Checkpoint catalog written: ${outPath}\n`);
}

main();
