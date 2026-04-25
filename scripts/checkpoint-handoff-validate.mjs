import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function readJson(filePath) {
  if (!existsSync(filePath)) return { ok: false, value: null, error: "missing file" };
  try {
    return { ok: true, value: JSON.parse(readFileSync(filePath, "utf8")), error: "" };
  } catch (error) {
    return { ok: false, value: null, error: `invalid json: ${String(error)}` };
  }
}

function isObj(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assert(cond, msg, errors) {
  if (!cond) errors.push(msg);
}

function runJson(command) {
  try {
    const out = execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
    return { ok: true, value: JSON.parse(out), error: "" };
  } catch (error) {
    return { ok: false, value: null, error: String(error?.message ?? error) };
  }
}

function validateHandoffMeta(meta) {
  const errors = [];
  assert(isObj(meta), "handoff meta root must be object", errors);
  if (!isObj(meta)) return errors;

  assert(typeof meta.generated_at === "string", "generated_at must be string", errors);
  assert(typeof meta.repo_root === "string", "repo_root must be string", errors);
  assert(typeof meta.handoff_directory === "string", "handoff_directory must be string", errors);
  assert(Number.isInteger(meta.keep_target) && meta.keep_target > 0, "keep_target must be integer >= 1", errors);
  assert(
    Number.isInteger(meta.package_count) && meta.package_count >= 0,
    "package_count must be non-negative integer",
    errors
  );
  assert(
    Number.isInteger(meta.total_bytes) && meta.total_bytes >= 0,
    "total_bytes must be non-negative integer",
    errors
  );
  assert(typeof meta.total_kb === "number" && meta.total_kb >= 0, "total_kb must be number >= 0", errors);
  assert(
    Number.isInteger(meta.prune_candidates) && meta.prune_candidates >= 0,
    "prune_candidates must be non-negative integer",
    errors
  );
  assert(
    typeof meta.retention_within_target === "boolean",
    "retention_within_target must be boolean",
    errors
  );
  assert(meta.latest_package === null || isObj(meta.latest_package), "latest_package must be object|null", errors);
  assert(Array.isArray(meta.recent_packages), "recent_packages must be array", errors);

  if (isObj(meta.latest_package)) {
    assert(typeof meta.latest_package.name === "string", "latest_package.name must be string", errors);
    assert(typeof meta.latest_package.path === "string", "latest_package.path must be string", errors);
    assert(
      typeof meta.latest_package.updated_at === "string",
      "latest_package.updated_at must be string",
      errors
    );
    assert(
      Number.isInteger(meta.latest_package.bytes) && meta.latest_package.bytes >= 0,
      "latest_package.bytes must be non-negative integer",
      errors
    );
  }

  if (Array.isArray(meta.recent_packages)) {
    meta.recent_packages.forEach((entry, idx) => {
      if (!isObj(entry)) {
        errors.push(`recent_packages[${idx}] must be object`);
        return;
      }
      assert(typeof entry.name === "string", `recent_packages[${idx}].name must be string`, errors);
      assert(typeof entry.path === "string", `recent_packages[${idx}].path must be string`, errors);
      assert(typeof entry.updated_at === "string", `recent_packages[${idx}].updated_at must be string`, errors);
      assert(
        Number.isInteger(entry.bytes) && entry.bytes >= 0,
        `recent_packages[${idx}].bytes must be non-negative integer`,
        errors
      );
    });
  }

  return errors;
}

function main() {
  const root = process.cwd();
  const schemaPath = path.resolve(root, ".checkpoints", "contracts", "checkpoint-handoff-meta.schema.json");
  const checks = [
    ["schema(handoff-meta)", readJson(schemaPath)],
    ["artifact(handoff-meta)", runJson("node scripts/checkpoint-handoff-meta.mjs")]
  ];

  let failures = 0;
  process.stdout.write("Handoff contract validation:\n");
  for (const [name, result] of checks) {
    const ok = result.ok;
    process.stdout.write(`- ${ok ? "OK" : "FAIL"} ${name}${ok ? "" : ` - ${result.error}`}\n`);
    if (!ok) failures += 1;
  }
  if (failures > 0) {
    process.stdout.write(`\nValidation stopped due to ${failures} missing/invalid input(s).\n`);
    process.exit(1);
    return;
  }

  const metaErrors = validateHandoffMeta(checks[1][1].value);
  if (metaErrors.length === 0) {
    process.stdout.write("- OK validate(handoff-meta payload)\n");
  } else {
    process.stdout.write("- FAIL validate(handoff-meta payload)\n");
    metaErrors.forEach((e) => process.stdout.write(`  - ${e}\n`));
  }

  if (metaErrors.length > 0) {
    process.stdout.write(`\nHandoff contract validation failed with ${metaErrors.length} error(s).\n`);
    process.exit(1);
    return;
  }
  process.stdout.write("\nAll handoff contract validations passed.\n");
}

main();
