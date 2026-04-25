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

function getCommits(limit) {
  const raw = run(`git log --pretty=format:"%H|%ct|%s" --grep="^checkpoint:" -n ${limit}`);
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [hash, epochRaw, ...subjectParts] = line.split("|");
      const epoch = Number(epochRaw);
      if (!Number.isFinite(epoch)) return null;
      return { hash, epoch, subject: subjectParts.join("|") };
    })
    .filter(Boolean);
}

function getChangedFiles(hash) {
  const raw = run(`git show --pretty=format: --name-only ${hash}`);
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    )
  );
}

function formatStamp(epoch) {
  const d = new Date(epoch * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function main() {
  const commitLimit = parsePositiveInt(process.argv[2] ?? "60", 60);
  const recentN = parsePositiveInt(process.argv[3] ?? "10", 10);

  const commits = getCommits(commitLimit);
  if (commits.length === 0) {
    process.stdout.write("No checkpoint commits found.\n");
    return;
  }

  const recent = commits.slice(0, Math.min(recentN, commits.length));
  const latest = recent[0];
  const oldest = recent[recent.length - 1];

  const fileCounts = new Map();
  for (const commit of recent) {
    for (const file of getChangedFiles(commit.hash)) {
      fileCounts.set(file, (fileCounts.get(file) ?? 0) + 1);
    }
  }

  const topFiles = Array.from(fileCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8);

  const cadenceMinutes =
    recent.length > 1 ? (latest.epoch - oldest.epoch) / 60 / (recent.length - 1) : 0;
  const totalTouched = Array.from(fileCounts.values()).reduce((sum, n) => sum + n, 0);
  const uniqueTouched = fileCounts.size;

  process.stdout.write("# Checkpoint Handoff\n\n");
  process.stdout.write(
    `- Latest checkpoint: ${latest.hash.slice(0, 7)} at ${formatStamp(latest.epoch)}\n`
  );
  process.stdout.write(`- Latest subject: ${latest.subject}\n`);
  process.stdout.write(
    `- Window analyzed: ${recent.length} checkpoint(s), ${formatStamp(oldest.epoch)} -> ${formatStamp(
      latest.epoch
    )}\n`
  );
  process.stdout.write(
    `- Change breadth: ${uniqueTouched} unique files, ${totalTouched} file touches in window\n`
  );
  process.stdout.write(
    `- Avg cadence: ${cadenceMinutes > 0 ? `${cadenceMinutes.toFixed(1)} min/checkpoint` : "n/a"}\n`
  );

  process.stdout.write("\n## Focus Areas\n");
  if (topFiles.length === 0) {
    process.stdout.write("- No file touches found for the selected window.\n");
  } else {
    topFiles.forEach(([file, count]) => {
      process.stdout.write(`- ${file} (${count})\n`);
    });
  }

  process.stdout.write("\n## Recent Checkpoints\n");
  recent.slice(0, 6).forEach((commit) => {
    process.stdout.write(
      `- ${commit.hash.slice(0, 7)}  ${formatStamp(commit.epoch)}  ${commit.subject}\n`
    );
  });

  process.stdout.write("\n## Suggested Next Step\n");
  process.stdout.write(
    "- Run `npm run verify`, then continue from the top focus area if all checks pass.\n"
  );
}

main();
