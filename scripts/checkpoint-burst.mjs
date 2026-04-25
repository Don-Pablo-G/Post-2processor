import { execSync } from "node:child_process";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function parsePositiveInt(value, fallback) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw < 1) return fallback;
  return Math.floor(raw);
}

function formatLocalStamp(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function getCheckpointTimestamps(days) {
  const raw = run(
    `git log --since="${days} days ago" --pretty=format:%ad --date=iso-strict --grep="^checkpoint:"`
  );
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => new Date(line.trim()))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
}

function detectBursts(timestamps, windowMinutes, minCount) {
  const bursts = [];
  const windowMs = windowMinutes * 60 * 1000;
  let start = 0;

  for (let end = 0; end < timestamps.length; end += 1) {
    while (timestamps[end].getTime() - timestamps[start].getTime() > windowMs) {
      start += 1;
    }
    const count = end - start + 1;
    if (count < minCount) continue;

    bursts.push({
      start: timestamps[start],
      end: timestamps[end],
      count,
      spanMinutes: Math.max(0, Math.round((timestamps[end] - timestamps[start]) / 60000))
    });
  }

  const deduped = [];
  for (const burst of bursts) {
    const prev = deduped[deduped.length - 1];
    if (
      prev &&
      prev.start.getTime() === burst.start.getTime() &&
      prev.end.getTime() === burst.end.getTime()
    ) {
      continue;
    }
    deduped.push(burst);
  }
  return deduped;
}

function main() {
  const days = parsePositiveInt(process.argv[2] ?? "14", 14);
  const windowMinutes = parsePositiveInt(process.argv[3] ?? "30", 30);
  const minCount = parsePositiveInt(process.argv[4] ?? "4", 4);

  const timestamps = getCheckpointTimestamps(days);
  if (timestamps.length === 0) {
    process.stdout.write(`No checkpoint commits found in the last ${days} day(s).\n`);
    return;
  }

  const bursts = detectBursts(timestamps, windowMinutes, minCount);
  process.stdout.write(
    `Checkpoint bursts (last ${days} day(s), window ${windowMinutes}m, min ${minCount} checkpoints):\n`
  );

  if (bursts.length === 0) {
    process.stdout.write("No bursts matched the current thresholds.\n");
    return;
  }

  const top = [...bursts]
    .sort((a, b) => b.count - a.count || a.spanMinutes - b.spanMinutes)
    .slice(0, 15);

  top.forEach((burst, idx) => {
    process.stdout.write(
      `${String(idx + 1).padStart(2, " ")}. ${burst.count} checkpoints in ${burst.spanMinutes}m  ${formatLocalStamp(burst.start)} -> ${formatLocalStamp(burst.end)}\n`
    );
  });
}

main();
