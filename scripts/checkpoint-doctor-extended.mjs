import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

function run(command, timeoutMs = 20000) {
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

function latestHashes(count = 2) {
  const raw = run(`git log --oneline --grep="^checkpoint:" -${count}`);
  if (!raw.ok || !raw.out) return [];
  return raw.out
    .split("\n")
    .map((line) => line.split(" ")[0])
    .filter(Boolean);
}

function fileCheck(name, absolutePath) {
  return [name, { ok: existsSync(absolutePath), out: existsSync(absolutePath) ? "" : "missing file" }];
}

function main() {
  const root = process.cwd();
  const checks = [];
  const [latest, previous] = latestHashes(2);
  const today = new Date().toISOString().slice(0, 10);

  // Core diagnostics
  checks.push(["checkpoint:doctor", run("npm run checkpoint:doctor")]);
  checks.push(["checkpoint:status", run("npm run checkpoint:status")]);
  checks.push(["checkpoint:bootstrap", run("npm run checkpoint:bootstrap", 45000)]);

  // Reporting/export diagnostics
  checks.push(["checkpoint:index", run("npm run checkpoint:index")]);
  checks.push(["checkpoint:digest", run("npm run checkpoint:digest")]);
  checks.push(["checkpoint:weekly", run("npm run checkpoint:weekly")]);
  checks.push(["checkpoint:catalog:md", run("npm run checkpoint:catalog:md")]);
  checks.push(["checkpoint:cleanup", run("npm run checkpoint:cleanup")]);

  // Analytics spot checks
  checks.push(["checkpoint:radar", run("npm run checkpoint:radar")]);
  checks.push(["checkpoint:momentum", run("npm run checkpoint:momentum")]);
  checks.push(["checkpoint:anomalies", run("npm run checkpoint:anomalies")]);
  checks.push(["checkpoint:clusters", run("npm run checkpoint:clusters")]);
  checks.push(["checkpoint:backlog", run("npm run checkpoint:backlog")]);

  // Existing compatibility checks from doctor
  checks.push(["checkpoint:since(date)", run(`npm run checkpoint:since -- ${today}`)]);
  if (latest) {
    checks.push(["checkpoint:open(hash)", run(`node scripts/checkpoint-open.mjs ${latest}`)]);
    checks.push(["checkpoint:search(keyword)", run("npm run checkpoint:search -- checkpoint")]);
  } else {
    checks.push(["checkpoint:open(hash)", { ok: true, out: "skipped (no checkpoints)" }]);
    checks.push(["checkpoint:search(keyword)", { ok: true, out: "skipped (no checkpoints)" }]);
  }
  if (latest && previous) {
    checks.push(["checkpoint:diff(pair)", run(`npm run checkpoint:diff -- ${previous} ${latest}`)]);
  } else {
    checks.push(["checkpoint:diff(pair)", { ok: true, out: "skipped (need 2 checkpoints)" }]);
  }

  // Output artifact checks
  checks.push(
    fileCheck("artifact:.checkpoints/INDEX.md", path.resolve(root, ".checkpoints", "INDEX.md")),
    fileCheck(
      "artifact:digest(today)",
      path.resolve(root, ".checkpoints", "digests", `checkpoint-digest-${today}.md`)
    )
  );

  process.stdout.write("Checkpoint doctor extended report:\n");
  let failures = 0;
  for (const [name, result] of checks) {
    const extra = !result.ok ? "check failed" : result.out.startsWith("skipped") ? result.out : "";
    process.stdout.write(`- ${statusLine(name, result.ok, extra)}\n`);
    if (!result.ok) failures += 1;
  }

  if (failures > 0) {
    process.stdout.write(`\nExtended doctor detected ${failures} failing check(s).\n`);
    process.exit(1);
  }
  process.stdout.write("\nAll extended checkpoint diagnostics passed.\n");
}

main();
