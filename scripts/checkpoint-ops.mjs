import { execSync } from "node:child_process";

function runStep(name, command) {
  process.stdout.write(`\n[ops] ${name}\n`);
  try {
    execSync(command, { stdio: "inherit" });
    process.stdout.write(`[ops] ${name} OK\n`);
    return true;
  } catch (error) {
    process.stdout.write(`[ops] ${name} FAILED\n`);
    if (error?.message) {
      process.stdout.write(`${error.message}\n`);
    }
    return false;
  }
}

function main() {
  const steps = [
    { name: "checkpoint:status", command: "npm run checkpoint:status" },
    { name: "checkpoint:release-ready", command: "npm run checkpoint:release-ready" },
    { name: "checkpoint:cleanup", command: "npm run checkpoint:cleanup" }
  ];

  process.stdout.write("Checkpoint ops dashboard starting...\n");
  let failures = 0;
  for (const step of steps) {
    if (!runStep(step.name, step.command)) failures += 1;
  }

  process.stdout.write("\nCheckpoint ops dashboard complete.\n");
  process.stdout.write(`- Steps run: ${steps.length}\n`);
  process.stdout.write(`- Failures: ${failures}\n`);

  if (failures > 0) {
    process.stdout.write("- Action: inspect failed sections above.\n");
    process.exit(1);
  } else {
    process.stdout.write("- Action: run `npm run checkpoint:suite` when ready for full gate.\n");
  }
}

main();
