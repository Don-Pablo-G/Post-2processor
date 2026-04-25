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

function main() {
  const days = parseDays(process.argv);
  const raw = run(
    `git log --since="${days} days ago" --pretty=format:%an --grep="^checkpoint:"`
  );

  if (!raw) {
    process.stdout.write(`No checkpoint commits found in the last ${days} day(s).\n`);
    return;
  }

  const counts = new Map();
  for (const author of raw.split("\n").map((entry) => entry.trim()).filter(Boolean)) {
    counts.set(author, (counts.get(author) ?? 0) + 1);
  }

  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const total = ranked.reduce((sum, [, count]) => sum + count, 0);

  process.stdout.write(
    `Checkpoint authors (last ${days} day(s), total ${total} checkpoints):\n`
  );
  ranked.forEach(([author, count], idx) => {
    const pct = ((count / total) * 100).toFixed(1);
    process.stdout.write(`${String(idx + 1).padStart(2, " ")}. ${author}: ${count} (${pct}%)\n`);
  });
}

main();
