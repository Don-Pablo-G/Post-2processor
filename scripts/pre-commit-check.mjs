import { execSync } from "node:child_process";

function run(command) {
  try {
    execSync(command, { stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
}

function main() {
  process.stdout.write("\n[pre-commit] Running lightweight quality checks...\n");
  const importGuardOk = run("npm run guard:imports");

  if (importGuardOk) {
    process.stdout.write("[pre-commit] OK: import boundaries verified.\n");
  } else {
    process.stdout.write(
      "[pre-commit] WARNING: import boundary check failed. Commit will continue (non-blocking).\n"
    );
  }

  process.stdout.write("[pre-commit] Tip: run `npm run verify` before sharing/releasing.\n\n");
  process.exit(0);
}

main();
