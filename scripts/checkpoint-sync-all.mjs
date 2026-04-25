import { execSync } from "node:child_process";

function runStep(name, command) {
  process.stdout.write(`\n[sync-all] ${name}\n`);
  try {
    execSync(command, { stdio: "inherit" });
    process.stdout.write(`[sync-all] ${name} OK\n`);
    return true;
  } catch (error) {
    process.stdout.write(`[sync-all] ${name} FAILED\n`);
    if (error?.message) process.stdout.write(`${error.message}\n`);
    return false;
  }
}

function main() {
  const steps = [
    ["checkpoint:taxonomy", "npm run checkpoint:taxonomy"],
    ["checkpoint:command-map", "npm run checkpoint:command-map"],
    ["checkpoint:onboarding", "npm run checkpoint:onboarding"],
    ["checkpoint:sync-docs", "npm run checkpoint:sync-docs"]
  ];

  process.stdout.write("Checkpoint sync-all starting...\n");
  let failures = 0;
  for (const [name, command] of steps) {
    if (!runStep(name, command)) failures += 1;
  }

  process.stdout.write("\nCheckpoint sync-all summary:\n");
  process.stdout.write(`- Steps: ${steps.length}\n`);
  process.stdout.write(`- Failures: ${failures}\n`);

  if (failures > 0) {
    process.stdout.write("- Result: FAILED\n");
    process.exit(1);
    return;
  }
  process.stdout.write("- Result: SUCCESS\n");
}

main();
