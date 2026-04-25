import { execSync } from "node:child_process";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function printUsage() {
  process.stdout.write("Usage:\n");
  process.stdout.write("  npm run checkpoint:since -- <YYYY-MM-DD>\n");
  process.stdout.write("  npm run checkpoint:since -- <checkpoint-hash>\n");
}

function isDateInput(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function resolveTimestampFromHash(hash) {
  return run(`git show -s --format=%cI ${hash}`);
}

function readCheckpoints() {
  const raw = run('git log --date=iso-strict --pretty=format:"%h|%ad|%s" --grep="^checkpoint:"');
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => {
      const [hash, isoDate, subject] = line.split("|");
      const date = new Date(isoDate);
      return {
        hash,
        isoDate,
        subject,
        dateMs: Number.isFinite(date.getTime()) ? date.getTime() : NaN
      };
    })
    .filter((row) => Number.isFinite(row.dateMs));
}

function listSinceDate(isoOrDate) {
  const sinceDate = new Date(isoOrDate);
  if (!Number.isFinite(sinceDate.getTime())) {
    process.stderr.write(`Invalid since value: ${isoOrDate}\n`);
    process.exit(1);
  }

  const rows = readCheckpoints().filter((row) => row.dateMs >= sinceDate.getTime());
  if (rows.length === 0) {
    process.stdout.write("No checkpoints found for requested range.\n");
    return;
  }

  process.stdout.write(`Checkpoints since ${isoOrDate}:\n`);
  for (const row of rows) {
    process.stdout.write(`- ${row.hash}  ${row.isoDate}  ${row.subject}\n`);
  }
}

function main() {
  const arg = (process.argv[2] ?? "").trim();
  if (!arg) {
    printUsage();
    process.exit(1);
  }

  if (isDateInput(arg)) {
    listSinceDate(arg);
    return;
  }

  const resolved = resolveTimestampFromHash(arg);
  if (!resolved) {
    process.stderr.write(`Invalid date/hash argument: ${arg}\n`);
    printUsage();
    process.exit(1);
  }

  listSinceDate(resolved);
}

main();
