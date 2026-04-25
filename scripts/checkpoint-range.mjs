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
  process.stdout.write("  npm run checkpoint:range -- <from-date|from-hash> <to-date|to-hash>\n");
  process.stdout.write("Examples:\n");
  process.stdout.write("  npm run checkpoint:range -- 2026-04-25 2026-04-26\n");
  process.stdout.write("  npm run checkpoint:range -- cd44137 e4631fd\n");
}

function isDateInput(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function resolveToIsoDate(input) {
  if (isDateInput(input)) {
    const d = new Date(input);
    return Number.isFinite(d.getTime()) ? d.toISOString() : "";
  }
  return run(`git show -s --format=%cI ${input}`);
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

function main() {
  const fromArg = (process.argv[2] ?? "").trim();
  const toArg = (process.argv[3] ?? "").trim();
  if (!fromArg || !toArg) {
    printUsage();
    process.exit(1);
  }

  const fromIso = resolveToIsoDate(fromArg);
  const toIso = resolveToIsoDate(toArg);
  if (!fromIso || !toIso) {
    process.stderr.write(`Invalid range inputs: from="${fromArg}" to="${toArg}"\n`);
    printUsage();
    process.exit(1);
  }

  const fromDate = new Date(fromIso);
  const toDate = new Date(toIso);
  const fromMs = fromDate.getTime();
  const toMs = toDate.getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    process.stderr.write("Could not parse resolved range timestamps.\n");
    process.exit(1);
  }

  const low = Math.min(fromMs, toMs);
  const high = Math.max(fromMs, toMs);
  const rows = readCheckpoints().filter((row) => row.dateMs >= low && row.dateMs <= high);

  if (rows.length === 0) {
    process.stdout.write("No checkpoints found in requested range.\n");
    return;
  }

  process.stdout.write(`Checkpoints in range [${fromIso} .. ${toIso}]:\n`);
  for (const row of rows) {
    process.stdout.write(`- ${row.hash}  ${row.isoDate}  ${row.subject}\n`);
  }
}

main();
