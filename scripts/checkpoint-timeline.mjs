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

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
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

function makeBar(value, maxValue) {
  if (value <= 0 || maxValue <= 0) return "";
  const width = Math.max(1, Math.round((value / maxValue) * 20));
  return "#".repeat(width);
}

function parseCommits(days) {
  const raw = run(
    `git log --since="${days} days ago" --pretty=format:"%H|%ad|%s" --date=iso-strict --grep="^checkpoint:"`
  );
  if (!raw) return [];

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [hash, stamp, ...subjectParts] = line.split("|");
      const subject = subjectParts.join("|");
      const date = new Date(stamp);
      if (Number.isNaN(date.getTime())) return null;
      return { hash, date, subject };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function summarizeDaily(commits) {
  const byDay = new Map();
  for (const commit of commits) {
    const dayKey = formatDateKey(commit.date);
    const existing = byDay.get(dayKey);
    if (!existing) {
      byDay.set(dayKey, {
        dayKey,
        count: 1,
        first: commit.date,
        last: commit.date,
        commits: [commit]
      });
      continue;
    }
    existing.count += 1;
    if (commit.date < existing.first) existing.first = commit.date;
    if (commit.date > existing.last) existing.last = commit.date;
    existing.commits.push(commit);
  }
  return Array.from(byDay.values()).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

function detectDayBurst(commits, windowMinutes = 30, minCount = 4) {
  if (commits.length < minCount) return null;
  const windowMs = windowMinutes * 60 * 1000;
  let start = 0;
  let best = null;

  for (let end = 0; end < commits.length; end += 1) {
    while (commits[end].date.getTime() - commits[start].date.getTime() > windowMs) {
      start += 1;
    }
    const count = end - start + 1;
    if (count < minCount) continue;

    const spanMs = commits[end].date.getTime() - commits[start].date.getTime();
    const candidate = {
      count,
      start: commits[start].date,
      end: commits[end].date,
      spanMs
    };

    if (!best) {
      best = candidate;
      continue;
    }

    if (candidate.count > best.count || (candidate.count === best.count && candidate.spanMs < best.spanMs)) {
      best = candidate;
    }
  }

  return best;
}

function main() {
  const days = parsePositiveInt(process.argv[2] ?? "14", 14);
  const commits = parseCommits(days);
  if (commits.length === 0) {
    process.stdout.write(`No checkpoint commits found in the last ${days} day(s).\n`);
    return;
  }

  const daily = summarizeDaily(commits);
  const maxDaily = Math.max(...daily.map((d) => d.count), 0);
  const total = commits.length;

  process.stdout.write(`Checkpoint timeline digest (last ${days} day(s))\n`);
  process.stdout.write(`Total checkpoints: ${total} | Active days: ${daily.length}\n`);
  process.stdout.write("Daily timeline:\n");

  for (const day of daily) {
    const spanMs = day.last.getTime() - day.first.getTime();
    const burst = detectDayBurst(day.commits, 30, 4);
    const burstLabel = burst
      ? ` | burst=${burst.count} in ${Math.round(burst.spanMs / 60000)}m`
      : "";
    process.stdout.write(
      `${day.dayKey}  count=${String(day.count).padStart(2, " ")}  first=${formatLocalTime(day.first)}  last=${formatLocalTime(day.last)}  span=${formatSpanMs(spanMs)}  ${makeBar(day.count, maxDaily)}${burstLabel}\n`
    );
  }

  const recent = commits.slice(-5).reverse();
  process.stdout.write("Recent checkpoints:\n");
  for (const commit of recent) {
    process.stdout.write(
      `- ${commit.hash.slice(0, 7)}  ${formatDateKey(commit.date)} ${formatLocalTime(commit.date)}  ${commit.subject}\n`
    );
  }
}

main();
