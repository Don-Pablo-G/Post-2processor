import { execSync } from "node:child_process";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, delta) {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
}

function parseDateKey(key) {
  return new Date(`${key}T00:00:00Z`);
}

function getCheckpointDaySet() {
  const raw = run(
    'git log --pretty=format:%ad --date=format:%Y-%m-%d --grep="^checkpoint:"'
  );
  if (!raw) return new Set();
  return new Set(
    raw
      .split("\n")
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

function computeRuns(dayKeys) {
  const sorted = Array.from(dayKeys).sort();
  if (sorted.length === 0) return [];

  const runs = [];
  let runStart = sorted[0];
  let runEnd = sorted[0];
  let runLen = 1;

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = parseDateKey(sorted[i - 1]);
    const current = parseDateKey(sorted[i]);
    const expected = toDateKey(addDays(prev, 1));
    if (toDateKey(current) === expected) {
      runEnd = sorted[i];
      runLen += 1;
      continue;
    }
    runs.push({ start: runStart, end: runEnd, length: runLen });
    runStart = sorted[i];
    runEnd = sorted[i];
    runLen = 1;
  }
  runs.push({ start: runStart, end: runEnd, length: runLen });
  return runs;
}

function computeCurrentStreak(daySet) {
  if (daySet.size === 0) return 0;
  let cursor = new Date();
  let streak = 0;

  while (true) {
    const key = toDateKey(cursor);
    if (!daySet.has(key)) {
      if (streak === 0) {
        cursor = addDays(cursor, -1);
        const yesterdayKey = toDateKey(cursor);
        if (!daySet.has(yesterdayKey)) return 0;
        streak = 1;
        cursor = addDays(cursor, -1);
        continue;
      }
      return streak;
    }
    streak += 1;
    cursor = addDays(cursor, -1);
  }
}

function main() {
  const daySet = getCheckpointDaySet();
  if (daySet.size === 0) {
    process.stdout.write("No checkpoint commits found.\n");
    return;
  }

  const runs = computeRuns(daySet);
  const longest = runs.reduce((best, run) => (run.length > best.length ? run : best), runs[0]);
  const current = computeCurrentStreak(daySet);

  process.stdout.write("Checkpoint streaks:\n");
  process.stdout.write(`- Active checkpoint days: ${daySet.size}\n`);
  process.stdout.write(`- Current streak: ${current} day(s)\n`);
  process.stdout.write(
    `- Longest streak: ${longest.length} day(s) (${longest.start} to ${longest.end})\n`
  );

  const topRuns = [...runs].sort((a, b) => b.length - a.length).slice(0, 5);
  process.stdout.write("Top streaks:\n");
  topRuns.forEach((run, idx) => {
    process.stdout.write(
      `${String(idx + 1).padStart(2, " ")}. ${run.length} day(s)  ${run.start} -> ${run.end}\n`
    );
  });
}

main();
