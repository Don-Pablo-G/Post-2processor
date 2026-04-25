import { execSync } from "node:child_process";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function parseLimit(argv) {
  const candidate = Number(argv[2] ?? "10");
  if (!Number.isFinite(candidate) || candidate < 1) return 10;
  return Math.floor(candidate);
}

function main() {
  const limit = parseLimit(process.argv);
  const raw = run(`git log --date=iso --pretty=format:"%h|%ad|%s" --grep="^checkpoint:" -n ${limit}`);
  if (!raw) {
    process.stdout.write("No checkpoint commits found.\n");
    process.exit(0);
  }

  process.stdout.write(`Latest checkpoints (up to ${limit}):\n`);
  for (const line of raw.split("\n")) {
    const [hash, date, subject] = line.split("|");
    process.stdout.write(`- ${hash}  ${date}  ${subject}\n`);
  }
}

main();
