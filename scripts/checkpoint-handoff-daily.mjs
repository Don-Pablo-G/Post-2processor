import { execSync } from "node:child_process";

function runStep(name, command) {
  process.stdout.write(`\n[handoff:daily] ${name}\n`);
  try {
    execSync(command, { stdio: "inherit" });
    process.stdout.write(`[handoff:daily] ${name} OK\n`);
    return true;
  } catch (error) {
    process.stdout.write(`[handoff:daily] ${name} FAILED\n`);
    if (error?.message) process.stdout.write(`${error.message}\n`);
    return false;
  }
}

function parseKeep(value, fallback) {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function main() {
  const keep = parseKeep(process.argv[2], 10);
  const steps = [
    { name: "checkpoint:handoff-status", command: "npm run checkpoint:handoff-status" },
    { name: "checkpoint:handoff-list", command: "node scripts/checkpoint-handoff-list.mjs 5" },
    {
      name: "checkpoint:handoff-cleanup (preview)",
      command: `node scripts/checkpoint-handoff-cleanup.mjs ${keep}`
    }
  ];

  process.stdout.write("Checkpoint handoff daily profile...\n");
  let failures = 0;
  for (const step of steps) {
    if (!runStep(step.name, step.command)) failures += 1;
  }

  process.stdout.write("\nHandoff daily summary:\n");
  process.stdout.write(`- Steps run: ${steps.length}\n`);
  process.stdout.write(`- Failures: ${failures}\n`);
  process.stdout.write(`- Keep target (preview): ${keep}\n`);

  if (failures > 0) process.exit(1);
}

main();
