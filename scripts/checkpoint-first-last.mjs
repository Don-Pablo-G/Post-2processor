import { execSync } from "node:child_process";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function parseDays(argv) {
  const raw = Number(argv[2] ?? "14");
  if (!Number.isFinite(raw) || raw < 1) return 14;
  return Math.floor(raw);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatLocalTime(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatSpanMs(ms) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function main() {
  const days = parseDays(process.argv);
  const raw = run(
    `git log --since="${days} days ago" --pretty=format:%ad --date=iso-strict --grep="^checkpoint:"`
  );

  if (!raw) {
    process.stdout.write(`No checkpoint commits found in the last ${days} day(s).\n`);
    return;
  }

  const byDay = new Map();
  const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const stamp = new Date(line);
    if (Number.isNaN(stamp.getTime())) continue;
    const dayKey = stamp.toISOString().slice(0, 10);
    const entry = byDay.get(dayKey);
    if (!entry) {
      byDay.set(dayKey, { first: stamp, last: stamp, count: 1 });
      continue;
    }
    if (stamp < entry.first) entry.first = stamp;
    if (stamp > entry.last) entry.last = stamp;
    entry.count += 1;
  }

  const dayKeys = Array.from(byDay.keys()).sort();
  let totalSpanMs = 0;

  process.stdout.write(`Checkpoint first/last by day (last ${days} day(s)):\n`);
  for (const day of dayKeys) {
    const entry = byDay.get(day);
    const spanMs = entry.last.getTime() - entry.first.getTime();
    totalSpanMs += spanMs;
    process.stdout.write(
      `${day}  count=${String(entry.count).padStart(2, " ")}  first=${formatLocalTime(entry.first)}  last=${formatLocalTime(entry.last)}  span=${formatSpanMs(spanMs)}\n`
    );
  }

  const avgSpanMs = dayKeys.length > 0 ? totalSpanMs / dayKeys.length : 0;
  process.stdout.write(
    `Active days: ${dayKeys.length} | Avg daily span: ${formatSpanMs(avgSpanMs)}\n`
  );
}

main();
