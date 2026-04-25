import { execSync } from "node:child_process";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function getLatestCheckpointHash() {
  const line = run('git log --oneline --grep="^checkpoint:" -1');
  if (!line) return "";
  return line.split(" ")[0] ?? "";
}

function main() {
  const inputHash = (process.argv[2] ?? "").trim();
  const hash = inputHash || getLatestCheckpointHash();

  if (!hash) {
    process.stdout.write("No checkpoint commit found.\n");
    process.exit(0);
  }

  const details = run(`git show --stat --patch ${hash}`);
  if (!details) {
    process.stderr.write(`Could not read checkpoint commit: ${hash}\n`);
    process.exit(1);
  }

  process.stdout.write(`Checkpoint details for ${hash}:\n\n`);
  process.stdout.write(`${details}\n\n`);
  process.stdout.write("Safe next actions:\n");
  process.stdout.write(`- inspect only: git show ${hash}\n`);
  process.stdout.write(`- branch at checkpoint: git branch "checkpoint-${hash}" ${hash}\n`);
  process.stdout.write(`- detach at checkpoint: git switch --detach ${hash}\n`);
}

main();
