import { execSync } from "node:child_process";

function runStep(name, command) {
  process.stdout.write(`\n==> ${name}\n`);
  execSync(command, { stdio: "inherit" });
}

function parseKeep(value, fallback) {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function main() {
  const keep = parseKeep(process.argv[2], 10);
  process.stdout.write("Checkpoint handoff ship\n");
  process.stdout.write(`Retention target (apply): keep newest ${keep}\n`);

  runStep("Build handoff package", "node scripts/checkpoint-handoff-package.mjs");
  runStep("List recent handoff packages", "node scripts/checkpoint-handoff-list.mjs");
  runStep("Show handoff status", "node scripts/checkpoint-handoff-status.mjs");
  runStep("Apply cleanup", `node scripts/checkpoint-handoff-cleanup.mjs ${keep} --apply`);
  runStep("Post-cleanup status", "node scripts/checkpoint-handoff-status.mjs");

  process.stdout.write("\nHandoff ship complete.\n");
}

main();
