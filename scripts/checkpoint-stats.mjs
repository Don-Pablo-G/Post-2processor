import { execSync } from "node:child_process";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function formatDuration(ms) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function main() {
  const raw = run('git log --date=iso-strict --pretty=format:"%H|%ad|%s" --grep="^checkpoint:"');
  if (!raw) {
    process.stdout.write("No checkpoint commits found.\n");
    process.exit(0);
  }

  const rows = raw
    .split("\n")
    .map((line) => {
      const [hash, isoDate, subject] = line.split("|");
      return {
        hash,
        date: new Date(isoDate),
        subject
      };
    })
    .filter((row) => Number.isFinite(row.date.getTime()));

  if (rows.length === 0) {
    process.stdout.write("No checkpoint commits found.\n");
    process.exit(0);
  }

  // git log returns newest -> oldest
  const newest = rows[0];
  const oldest = rows[rows.length - 1];
  const total = rows.length;

  const todayKey = new Date().toISOString().slice(0, 10);
  const byDay = new Map();
  for (const row of rows) {
    const day = row.date.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const todayCount = byDay.get(todayKey) ?? 0;

  let mostActiveDay = "";
  let mostActiveCount = 0;
  for (const [day, count] of byDay.entries()) {
    if (count > mostActiveCount) {
      mostActiveCount = count;
      mostActiveDay = day;
    }
  }

  let averageIntervalMs = 0;
  if (rows.length > 1) {
    let totalDelta = 0;
    let intervals = 0;
    for (let i = 0; i < rows.length - 1; i += 1) {
      const newer = rows[i].date.getTime();
      const older = rows[i + 1].date.getTime();
      if (Number.isFinite(newer) && Number.isFinite(older) && newer >= older) {
        totalDelta += newer - older;
        intervals += 1;
      }
    }
    averageIntervalMs = intervals > 0 ? totalDelta / intervals : 0;
  }

  process.stdout.write("Checkpoint statistics:\n");
  process.stdout.write(`- total checkpoints: ${total}\n`);
  process.stdout.write(`- checkpoints today (${todayKey}): ${todayCount}\n`);
  process.stdout.write(`- most active day: ${mostActiveDay || "n/a"} (${mostActiveCount})\n`);
  process.stdout.write(`- average interval: ${rows.length > 1 ? formatDuration(averageIntervalMs) : "n/a"}\n`);
  process.stdout.write(`- latest: ${newest.hash.slice(0, 7)} ${newest.subject}\n`);
  process.stdout.write(`- oldest: ${oldest.hash.slice(0, 7)} ${oldest.subject}\n`);
}

main();
