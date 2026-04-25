import { execSync } from "node:child_process";

function run(command) {
  try {
    const out = execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
    return { ok: true, out };
  } catch (error) {
    const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr ?? "") : "";
    const stdout = error && typeof error === "object" && "stdout" in error ? String(error.stdout ?? "") : "";
    return { ok: false, out: `${stdout}\n${stderr}`.trim() };
  }
}

function runStreaming(command) {
  try {
    execSync(command, { stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
}

function main() {
  process.stdout.write("Checkpoint ship gate starting...\n");

  process.stdout.write("\n[ship] Running checkpoint suite...\n");
  const suiteOk = runStreaming("npm run checkpoint:suite");
  process.stdout.write(`[ship] checkpoint:suite ${suiteOk ? "OK" : "FAILED"}\n`);

  process.stdout.write("\n[ship] Collecting release checklist...\n");
  const release = run("npm run checkpoint:release-ready");
  if (release.out) {
    process.stdout.write(`${release.out}\n`);
  }

  const dirtyRaw = run("git status --porcelain");
  const dirtyCount = dirtyRaw.ok && dirtyRaw.out ? dirtyRaw.out.split("\n").filter(Boolean).length : 0;
  const latest = run('git log -1 --pretty=format:"%h %s" --grep="^checkpoint:"');

  const go = suiteOk && dirtyCount === 0;
  process.stdout.write("\n[ship] Summary:\n");
  process.stdout.write(`- Suite: ${suiteOk ? "pass" : "fail"}\n`);
  process.stdout.write(`- Working tree changes: ${dirtyCount}\n`);
  process.stdout.write(`- Latest checkpoint: ${latest.ok && latest.out ? latest.out : "none"}\n`);
  process.stdout.write(`- Decision: ${go ? "GO" : "NO-GO"}\n`);

  if (!go) {
    process.stdout.write("- Next: clean working tree and rerun `npm run checkpoint:ship`.\n");
    process.exit(1);
  }
}

main();
