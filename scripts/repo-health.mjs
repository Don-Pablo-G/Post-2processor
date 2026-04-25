import { execSync } from "node:child_process";

function run(command, options = {}) {
  try {
    const out = execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      ...options
    });
    return { ok: true, out: typeof out === "string" ? out.trim() : "" };
  } catch (error) {
    const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr ?? "") : "";
    const stdout = error && typeof error === "object" && "stdout" in error ? String(error.stdout ?? "") : "";
    return { ok: false, out: `${stdout}\n${stderr}`.trim() };
  }
}

function printSection(title) {
  process.stdout.write(`\n=== ${title} ===\n`);
}

function main() {
  const branch = run("git rev-parse --abbrev-ref HEAD");
  const status = run("git status --short");
  const lastCommit = run("git log -1 --oneline");
  const checkpoints = run('git log --oneline --grep="^checkpoint:" -5');

  printSection("Repository");
  process.stdout.write(`Branch: ${branch.ok ? branch.out : "unknown"}\n`);
  process.stdout.write(`Last commit: ${lastCommit.ok ? lastCommit.out : "unknown"}\n`);
  process.stdout.write(`Working tree: ${status.ok && status.out.length === 0 ? "clean" : "dirty"}\n`);
  if (status.ok && status.out.length > 0) {
    process.stdout.write(`${status.out}\n`);
  }

  printSection("Recent checkpoints");
  if (checkpoints.ok && checkpoints.out.length > 0) {
    process.stdout.write(`${checkpoints.out}\n`);
  } else {
    process.stdout.write("No checkpoint commits found.\n");
  }

  printSection("Verify gate");
  const verify = run("npm run verify", { stdio: "inherit" });
  process.stdout.write(verify.ok ? "VERIFY: PASS\n" : "VERIFY: FAIL\n");

  process.exit(verify.ok ? 0 : 1);
}

main();
