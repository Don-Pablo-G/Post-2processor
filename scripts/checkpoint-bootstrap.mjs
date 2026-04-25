import { execSync } from "node:child_process";

function runStep(name, command) {
  process.stdout.write(`\n[bootstrap] ${name}\n`);
  try {
    execSync(command, { stdio: "inherit" });
    process.stdout.write(`[bootstrap] ${name} OK\n`);
    return true;
  } catch (error) {
    process.stdout.write(`[bootstrap] ${name} FAILED\n`);
    if (error?.message) {
      process.stdout.write(`${error.message}\n`);
    }
    return false;
  }
}

function main() {
  const steps = [
    { name: "Generate index", command: "node ./scripts/checkpoint-index.mjs" },
    { name: "Generate digest", command: "node ./scripts/checkpoint-digest.mjs" },
    { name: "Generate weekly rollup", command: "node ./scripts/checkpoint-weekly.mjs" },
    { name: "Print status snapshot", command: "node ./scripts/checkpoint-status.mjs" }
  ];

  process.stdout.write("Checkpoint bootstrap starting...\n");
  for (const step of steps) {
    const ok = runStep(step.name, step.command);
    if (!ok) {
      process.exitCode = 1;
      return;
    }
  }
  process.stdout.write("\nCheckpoint bootstrap completed successfully.\n");
}

main();
