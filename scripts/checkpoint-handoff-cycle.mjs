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
  process.stdout.write("Checkpoint handoff cycle\n");
  process.stdout.write(`Retention target (preview): keep newest ${keep}\n`);

  runStep("Build handoff package", "node scripts/checkpoint-handoff-package.mjs");
  runStep("List recent handoff packages", "node scripts/checkpoint-handoff-list.mjs");
  runStep("Show handoff status", "node scripts/checkpoint-handoff-status.mjs");
  runStep("Preview cleanup plan", `node scripts/checkpoint-handoff-cleanup.mjs ${keep}`);

  process.stdout.write("\nHandoff cycle complete.\n");
}

main();
