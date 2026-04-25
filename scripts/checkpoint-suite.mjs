import { execSync } from "node:child_process";

function runStep(name, command) {
  process.stdout.write(`\n[suite] ${name}\n`);
  try {
    execSync(command, { stdio: "inherit" });
    process.stdout.write(`[suite] ${name} OK\n`);
    return true;
  } catch (error) {
    process.stdout.write(`[suite] ${name} FAILED\n`);
    if (error?.message) {
      process.stdout.write(`${error.message}\n`);
    }
    return false;
  }
}

function main() {
  const steps = [
    { name: "checkpoint:bootstrap", command: "npm run checkpoint:bootstrap" },
    { name: "checkpoint:doctor:extended", command: "npm run checkpoint:doctor:extended" },
    { name: "verify", command: "npm run verify" }
  ];

  process.stdout.write("Checkpoint suite starting...\n");
  for (const step of steps) {
    if (!runStep(step.name, step.command)) {
      process.exitCode = 1;
      return;
    }
  }
  process.stdout.write("\nCheckpoint suite completed successfully.\n");
}

main();
