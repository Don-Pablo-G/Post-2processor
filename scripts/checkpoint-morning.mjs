import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function runStep(name, command) {
  process.stdout.write(`\n[morning] ${name}\n`);
  try {
    execSync(command, { stdio: "inherit" });
    process.stdout.write(`[morning] ${name} OK\n`);
    return true;
  } catch (error) {
    process.stdout.write(`[morning] ${name} FAILED\n`);
    if (error?.message) process.stdout.write(`${error.message}\n`);
    return false;
  }
}

function printDigestSummary(root) {
  const today = new Date().toISOString().slice(0, 10);
  const digestPath = path.resolve(root, ".checkpoints", "digests", `checkpoint-digest-${today}.md`);

  process.stdout.write("\n[morning] digest summary\n");
  if (!existsSync(digestPath)) {
    process.stdout.write("- no digest for today (run `npm run checkpoint:digest`)\n");
    return;
  }

  const text = readFileSync(digestPath, "utf8");
  const lines = text.split("\n").filter(Boolean);
  const summary = lines.filter((l) => l.startsWith("- ")).slice(0, 6);
  process.stdout.write(`- source: .checkpoints/digests/checkpoint-digest-${today}.md\n`);
  if (summary.length === 0) {
    process.stdout.write("- digest found, but no summary bullets parsed\n");
    return;
  }
  for (const line of summary) process.stdout.write(`${line}\n`);
}

function main() {
  const steps = [
    { name: "checkpoint:status", command: "npm run checkpoint:status" },
    { name: "checkpoint:handoff", command: "npm run checkpoint:handoff" },
    { name: "checkpoint:backlog", command: "npm run checkpoint:backlog" },
    { name: "checkpoint:handoff:daily", command: "npm run checkpoint:handoff:daily" }
  ];

  process.stdout.write("Checkpoint morning quick-start...\n");
  let failures = 0;
  for (const step of steps) {
    if (!runStep(step.name, step.command)) failures += 1;
  }

  printDigestSummary(process.cwd());

  process.stdout.write("\nCheckpoint morning summary:\n");
  process.stdout.write(`- Steps run: ${steps.length}\n`);
  process.stdout.write(`- Failures: ${failures}\n`);
  process.stdout.write(`- Next: ${failures > 0 ? "address failures above" : "run npm run verify when ready"}\n`);

  if (failures > 0) process.exit(1);
}

main();
