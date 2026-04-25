import { execSync } from "node:child_process";

function runStep(name, command) {
  process.stdout.write(`\n[all] ${name}\n`);
  try {
    execSync(command, { stdio: "inherit" });
    process.stdout.write(`[all] ${name} OK\n`);
    return { ok: true };
  } catch (error) {
    process.stdout.write(`[all] ${name} FAILED\n`);
    if (error?.message) {
      process.stdout.write(`${error.message}\n`);
    }
    return { ok: false };
  }
}

function main() {
  const steps = [
    { name: "checkpoint:ops", command: "npm run checkpoint:ops", optional: false },
    { name: "checkpoint:ship", command: "npm run checkpoint:ship", optional: true },
    { name: "checkpoint:index", command: "npm run checkpoint:index", optional: false }
  ];

  process.stdout.write("Checkpoint all-cycle starting...\n");

  let hardFailures = 0;
  let softFailures = 0;

  for (const step of steps) {
    const result = runStep(step.name, step.command);
    if (result.ok) continue;
    if (step.optional) {
      softFailures += 1;
      continue;
    }
    hardFailures += 1;
  }

  process.stdout.write("\nCheckpoint all-cycle summary:\n");
  process.stdout.write(`- Hard failures: ${hardFailures}\n`);
  process.stdout.write(`- Soft failures: ${softFailures}\n`);

  if (hardFailures > 0) {
    process.stdout.write("- Result: FAILED (fix hard-failure steps).\n");
    process.exit(1);
    return;
  }

  if (softFailures > 0) {
    process.stdout.write(
      "- Result: PARTIAL (ship gate not clean yet; typically due dirty working tree).\n"
    );
    return;
  }

  process.stdout.write("- Result: SUCCESS.\n");
}

main();
