import { execSync } from "node:child_process";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function parseLimit(argv) {
  const raw = Number(argv[2] ?? "5");
  if (!Number.isFinite(raw) || raw < 1) return 5;
  return Math.floor(raw);
}

function parseDateKey(key) {
  return new Date(`${key}T00:00:00Z`);
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, delta) {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
}

function daysBetween(leftKey, rightKey) {
  const ms = parseDateKey(rightKey).getTime() - parseDateKey(leftKey).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function getCheckpointDays() {
  const raw = run(
    'git log --pretty=format:%ad --date=format:%Y-%m-%d --grep="^checkpoint:"'
  );
  if (!raw) return [];
  const unique = new Set(
    raw
      .split("\n")
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
  return Array.from(unique).sort();
}

function buildGaps(days) {
  const gaps = [];
  for (let i = 1; i < days.length; i += 1) {
    const prev = days[i - 1];
    const current = days[i];
    const delta = daysBetween(prev, current);
    const inactiveDays = Math.max(0, delta - 1);
    if (inactiveDays > 0) {
      const gapStart = toDateKey(addDays(parseDateKey(prev), 1));
      const gapEnd = toDateKey(addDays(parseDateKey(current), -1));
      gaps.push({
        before: prev,
        after: current,
        inactiveDays,
        gapStart,
        gapEnd
      });
    }
  }
  return gaps.sort((a, b) => b.inactiveDays - a.inactiveDays);
}

function main() {
  const topN = parseLimit(process.argv);
  const checkpointDays = getCheckpointDays();

  if (checkpointDays.length === 0) {
    process.stdout.write("No checkpoint commits found.\n");
    return;
  }

  if (checkpointDays.length === 1) {
    process.stdout.write("Only one checkpoint day exists; no inter-day gaps to report.\n");
    return;
  }

  const gaps = buildGaps(checkpointDays);
  if (gaps.length === 0) {
    process.stdout.write(
      `No inactive inter-day gaps found across ${checkpointDays.length} checkpoint day(s).\n`
    );
    return;
  }

  const shown = gaps.slice(0, topN);
  process.stdout.write(
    `Largest checkpoint gaps (top ${shown.length} of ${gaps.length} total):\n`
  );
  shown.forEach((gap, idx) => {
    process.stdout.write(
      `${String(idx + 1).padStart(2, " ")}. ${gap.inactiveDays} inactive day(s) (${gap.gapStart} -> ${gap.gapEnd}) between ${gap.before} and ${gap.after}\n`
    );
  });
}

main();
