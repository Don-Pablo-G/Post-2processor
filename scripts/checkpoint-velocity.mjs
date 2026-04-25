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

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function buildDailyBuckets(days) {
  const buckets = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    buckets.push({ key: toDateKey(d), count: 0 });
  }
  return buckets;
}

function makeBar(count, maxCount) {
  if (count <= 0 || maxCount <= 0) return "";
  const width = Math.max(1, Math.round((count / maxCount) * 20));
  return "#".repeat(width);
}

function main() {
  const days = parseDays(process.argv);
  const raw = run(
    `git log --since="${days} days ago" --pretty=format:%ad --date=format:%Y-%m-%d --grep="^checkpoint:"`
  );

  const buckets = buildDailyBuckets(days);
  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  if (raw) {
    for (const dateKey of raw.split("\n").map((entry) => entry.trim()).filter(Boolean)) {
      const bucket = bucketMap.get(dateKey);
      if (bucket) bucket.count += 1;
    }
  }

  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  const avg = (total / days).toFixed(2);
  const maxCount = Math.max(...buckets.map((b) => b.count), 0);

  process.stdout.write(`Checkpoint velocity (last ${days} day(s))\n`);
  process.stdout.write(`Total: ${total} | Avg/day: ${avg}\n`);
  process.stdout.write("Daily trend:\n");
  for (const bucket of buckets) {
    const bar = makeBar(bucket.count, maxCount);
    process.stdout.write(`${bucket.key}  ${String(bucket.count).padStart(2, " ")}  ${bar}\n`);
  }

  const weeklyEstimate = (Number(avg) * 7).toFixed(2);
  process.stdout.write(`Projected weekly pace: ${weeklyEstimate} checkpoints/week\n`);
}

main();
