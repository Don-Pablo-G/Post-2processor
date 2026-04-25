import { execSync } from "node:child_process";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function parseDays(argv) {
  const raw = Number(argv[2] ?? "30");
  if (!Number.isFinite(raw) || raw < 1) return 30;
  return Math.floor(raw);
}

function makeBar(value, maxValue) {
  if (value <= 0 || maxValue <= 0) return "";
  const width = Math.max(1, Math.round((value / maxValue) * 20));
  return "#".repeat(width);
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

  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekdayCounts = new Array(7).fill(0);
  const hourCounts = new Array(24).fill(0);

  const timestamps = raw.split("\n").map((line) => line.trim()).filter(Boolean);
  for (const stamp of timestamps) {
    const d = new Date(stamp);
    if (Number.isNaN(d.getTime())) continue;
    weekdayCounts[d.getDay()] += 1;
    hourCounts[d.getHours()] += 1;
  }

  const total = timestamps.length;
  const maxWeekday = Math.max(...weekdayCounts, 0);
  const maxHour = Math.max(...hourCounts, 0);

  process.stdout.write(`Checkpoint weekday/hour distribution (last ${days} day(s))\n`);
  process.stdout.write(`Total checkpoints: ${total}\n`);

  process.stdout.write("By weekday:\n");
  for (let i = 0; i < weekdayNames.length; i += 1) {
    const count = weekdayCounts[i];
    const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
    process.stdout.write(
      `${weekdayNames[i]}  ${String(count).padStart(2, " ")}  ${pct}%  ${makeBar(count, maxWeekday)}\n`
    );
  }

  process.stdout.write("By hour (0-23):\n");
  for (let h = 0; h < 24; h += 1) {
    const count = hourCounts[h];
    process.stdout.write(
      `${String(h).padStart(2, "0")}:00  ${String(count).padStart(2, " ")}  ${makeBar(count, maxHour)}\n`
    );
  }
}

main();
