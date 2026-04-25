import { execSync } from "node:child_process";

function runStep(name, command) {
  process.stdout.write(`\n[handoff:nightly] ${name}\n`);
  try {
    execSync(command, { stdio: "inherit" });
    process.stdout.write(`[handoff:nightly] ${name} OK\n`);
    return true;
  } catch (error) {
    process.stdout.write(`[handoff:nightly] ${name} FAILED\n`);
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
  const apply = process.argv.includes("--apply");
  const cleanupCommand = apply
    ? `node scripts/checkpoint-handoff-cleanup.mjs ${keep} --apply`
    : `node scripts/checkpoint-handoff-cleanup.mjs ${keep}`;

  const steps = [
    { name: "checkpoint:handoff-status", command: "npm run checkpoint:handoff-status" },
    { name: "checkpoint:handoff-list", command: "node scripts/checkpoint-handoff-list.mjs 10" },
    {
      name: `checkpoint:handoff-cleanup (${apply ? "apply" : "preview"})`,
      command: cleanupCommand
    },
    { name: "checkpoint:handoff-status (post)", command: "npm run checkpoint:handoff-status" }
  ];

  process.stdout.write("Checkpoint handoff nightly profile...\n");
  let failures = 0;
  for (const step of steps) {
    if (!runStep(step.name, step.command)) failures += 1;
  }

  process.stdout.write("\nHandoff nightly summary:\n");
  process.stdout.write(`- Steps run: ${steps.length}\n`);
  process.stdout.write(`- Failures: ${failures}\n`);
  process.stdout.write(`- Keep target: ${keep}\n`);
  process.stdout.write(`- Cleanup mode: ${apply ? "apply" : "preview"}\n`);

  if (failures > 0) process.exit(1);
}

main();
