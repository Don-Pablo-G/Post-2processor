import { execSync } from "node:child_process";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function main() {
  const latest = run('git log --oneline --grep="^checkpoint:" -1');
  if (!latest) {
    process.stdout.write("No checkpoint commits found.\n");
    process.exit(0);
  }

  const [hash, ...rest] = latest.split(" ");
  const message = rest.join(" ");

  process.stdout.write("Latest checkpoint:\n");
  process.stdout.write(`- hash: ${hash}\n`);
  process.stdout.write(`- message: ${message}\n\n`);

  process.stdout.write("Quick rollback options:\n");
  process.stdout.write(`- inspect checkpoint diff: git show ${hash}\n`);
  process.stdout.write(`- create safety branch at checkpoint: git branch "checkpoint-${hash}" ${hash}\n`);
  process.stdout.write(`- checkout checkpoint in detached mode: git switch --detach ${hash}\n`);
}

main();
