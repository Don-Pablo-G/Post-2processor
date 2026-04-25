import { execSync } from "node:child_process";

function run(command, timeoutMs = 15000) {
  try {
    const out = execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeoutMs
    }).trim();
    return { ok: true, out };
  } catch (error) {
    const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr ?? "") : "";
    const stdout = error && typeof error === "object" && "stdout" in error ? String(error.stdout ?? "") : "";
    return { ok: false, out: `${stdout}\n${stderr}`.trim() };
  }
}

function statusLine(name, ok, extra = "") {
  const mark = ok ? "OK" : "FAIL";
  return `${mark.padEnd(5)} ${name}${extra ? ` - ${extra}` : ""}`;
}

function main() {
  const checks = [];
  const latestRaw = run('git log --oneline --grep="^checkpoint:" -2');
  const hashes = latestRaw.ok
    ? latestRaw.out
        .split("\n")
        .map((line) => line.split(" ")[0])
        .filter(Boolean)
    : [];
  const latest = hashes[0] ?? "";
  const previous = hashes[1] ?? "";
  const today = new Date().toISOString().slice(0, 10);

  checks.push(["checkpoint:latest", run("npm run checkpoint:latest")]);
  checks.push(["checkpoint:list", run("npm run checkpoint:list")]);
  checks.push(["checkpoint:menu", run("npm run checkpoint:menu")]);
  checks.push(["checkpoint:stats", run("npm run checkpoint:stats")]);
  checks.push(["checkpoint:prune-suggestions", run("npm run checkpoint:prune-suggestions")]);
  checks.push(["checkpoint:since(date)", run(`npm run checkpoint:since -- ${today}`)]);

  if (latest) {
    checks.push(["checkpoint:open(hash)", run(`node scripts/checkpoint-open.mjs ${latest}`)]);
    checks.push(["checkpoint:since(hash)", run(`npm run checkpoint:since -- ${latest}`)]);
  } else {
    checks.push(["checkpoint:open(hash)", { ok: true, out: "skipped (no checkpoints)" }]);
    checks.push(["checkpoint:since(hash)", { ok: true, out: "skipped (no checkpoints)" }]);
  }

  if (latest && previous) {
    checks.push(["checkpoint:range(hash)", run(`npm run checkpoint:range -- ${previous} ${latest}`)]);
    checks.push(["checkpoint:diff(hash)", run(`npm run checkpoint:diff -- ${previous} ${latest}`)]);
  } else {
    checks.push(["checkpoint:range(hash)", { ok: true, out: "skipped (need 2 checkpoints)" }]);
    checks.push(["checkpoint:diff(hash)", { ok: true, out: "skipped (need 2 checkpoints)" }]);
  }

  process.stdout.write("Checkpoint doctor report:\n");
  let failures = 0;
  for (const [name, result] of checks) {
    const extra = !result.ok ? "command failed" : result.out.startsWith("skipped") ? result.out : "";
    process.stdout.write(`- ${statusLine(name, result.ok, extra)}\n`);
    if (!result.ok) failures += 1;
  }

  if (failures > 0) {
    process.stdout.write(`\nDoctor detected ${failures} failing check(s).\n`);
    process.exit(1);
  }
  process.stdout.write("\nAll checkpoint diagnostics passed.\n");
}

main();
