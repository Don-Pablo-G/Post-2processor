import { execSync } from "node:child_process";

function runCheck(name, command, optional = false) {
  process.stdout.write(`\n==> ${name}\n`);
  try {
    execSync(command, { stdio: "inherit" });
    process.stdout.write(`OK: ${name}\n`);
    return { ok: true, optional };
  } catch {
    if (optional) {
      process.stdout.write(`WARN: ${name} failed (optional)\n`);
      return { ok: false, optional: true };
    }
    process.stdout.write(`FAIL: ${name}\n`);
    return { ok: false, optional: false };
  }
}

function main() {
  process.stdout.write("Checkpoint handoff doctor\n");
  process.stdout.write("Running non-invasive checks for handoff tooling...\n");

  const checks = [
    runCheck("handoff status", "node scripts/checkpoint-handoff-status.mjs"),
    runCheck("handoff list", "node scripts/checkpoint-handoff-list.mjs 5"),
    runCheck("handoff cleanup preview", "node scripts/checkpoint-handoff-cleanup.mjs 10"),
    runCheck(
      "handoff validate (checkpoint:validate incl. handoff)",
      "node scripts/checkpoint-handoff-validate.mjs"
    ),
    runCheck(
      "handoff package build + verify",
      "node scripts/checkpoint-handoff-package.mjs",
      true
    )
  ];

  const hardFailures = checks.filter((c) => !c.ok && !c.optional).length;
  const optionalFailures = checks.filter((c) => !c.ok && c.optional).length;
  process.stdout.write("\nDoctor summary\n");
  process.stdout.write(`- hard failures: ${hardFailures}\n`);
  process.stdout.write(`- optional failures: ${optionalFailures}\n`);

  if (hardFailures > 0) {
    process.stdout.write("handoff doctor: FAIL\n");
    process.exit(1);
    return;
  }
  process.stdout.write("handoff doctor: PASS\n");
}

main();
