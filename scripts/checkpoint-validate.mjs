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

function runJsonCommand(command, errorLabel) {
  try {
    const out = execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
    return { ok: true, value: JSON.parse(out), error: "" };
  } catch (error) {
    return { ok: false, value: null, error: `${errorLabel}: ${String(error)}` };
  }
}

function validateMeta(meta) {
  const errors = [];
  assert(isObj(meta), "meta root must be object", errors);
  if (!isObj(meta)) return errors;

  assert(typeof meta.generated_at === "string", "meta.generated_at must be string", errors);
  assert(isObj(meta.repo), "meta.repo must be object", errors);
  assert(isObj(meta.checkpoints), "meta.checkpoints must be object", errors);
  assert(isObj(meta.artifacts), "meta.artifacts must be object", errors);
  assert(
    ["GREEN", "YELLOW", "RED", "NO_CHECKPOINT"].includes(meta.pulse),
    "meta.pulse invalid enum",
    errors
  );

  if (isObj(meta.repo)) {
    assert(typeof meta.repo.branch === "string", "meta.repo.branch must be string", errors);
    assert(
      Number.isInteger(meta.repo.dirty_count) && meta.repo.dirty_count >= 0,
      "meta.repo.dirty_count must be non-negative integer",
      errors
    );
  }

  if (isObj(meta.checkpoints)) {
    assert(
      Number.isInteger(meta.checkpoints.count_24h) && meta.checkpoints.count_24h >= 0,
      "meta.checkpoints.count_24h must be non-negative integer",
      errors
    );
    assert(
      Number.isInteger(meta.checkpoints.count_7d) && meta.checkpoints.count_7d >= 0,
      "meta.checkpoints.count_7d must be non-negative integer",
      errors
    );
    assert(
      Number.isInteger(meta.checkpoints.count_30d) && meta.checkpoints.count_30d >= 0,
      "meta.checkpoints.count_30d must be non-negative integer",
      errors
    );
    const latest = meta.checkpoints.latest;
    assert(latest === null || isObj(latest), "meta.checkpoints.latest must be object|null", errors);
    if (isObj(latest)) {
      assert(typeof latest.hash === "string", "meta.checkpoints.latest.hash must be string", errors);
      assert(
        typeof latest.short_hash === "string",
        "meta.checkpoints.latest.short_hash must be string",
        errors
      );
      assert(Number.isInteger(latest.epoch), "meta.checkpoints.latest.epoch must be integer", errors);
      assert(typeof latest.subject === "string", "meta.checkpoints.latest.subject must be string", errors);
    }
  }

  if (isObj(meta.artifacts)) {
    assert(typeof meta.artifacts.index === "string", "meta.artifacts.index must be string", errors);
    assert(
      typeof meta.artifacts.digest_today === "string",
      "meta.artifacts.digest_today must be string",
      errors
    );
    assert(
      typeof meta.artifacts.weekly_current === "string",
      "meta.artifacts.weekly_current must be string",
      errors
    );
  }

  return errors;
}

function validateWebhook(payload) {
  const errors = [];
  assert(isObj(payload), "webhook root must be object", errors);
  if (!isObj(payload)) return errors;

  assert(payload.event === "checkpoint.update", "webhook.event must be checkpoint.update", errors);
  assert(typeof payload.generated_at === "string", "webhook.generated_at must be string", errors);
  assert(isObj(payload.repo), "webhook.repo must be object", errors);
  assert(
    ["GREEN", "YELLOW", "RED", "NO_CHECKPOINT"].includes(payload.pulse),
    "webhook.pulse invalid enum",
    errors
  );
  assert(isObj(payload.counters), "webhook.counters must be object", errors);
  assert(payload.latest === null || isObj(payload.latest), "webhook.latest must be object|null", errors);
  assert(Array.isArray(payload.recent), "webhook.recent must be array", errors);

  if (isObj(payload.repo)) {
    assert(typeof payload.repo.path === "string", "webhook.repo.path must be string", errors);
    assert(typeof payload.repo.branch === "string", "webhook.repo.branch must be string", errors);
    assert(
      Number.isInteger(payload.repo.dirty_count) && payload.repo.dirty_count >= 0,
      "webhook.repo.dirty_count must be non-negative integer",
      errors
    );
  }

  if (isObj(payload.counters)) {
    assert(
      Number.isInteger(payload.counters.checkpoint_24h) && payload.counters.checkpoint_24h >= 0,
      "webhook.counters.checkpoint_24h must be non-negative integer",
      errors
    );
    assert(
      Number.isInteger(payload.counters.checkpoint_7d) && payload.counters.checkpoint_7d >= 0,
      "webhook.counters.checkpoint_7d must be non-negative integer",
      errors
    );
    assert(
      Number.isInteger(payload.counters.checkpoint_30d) && payload.counters.checkpoint_30d >= 0,
      "webhook.counters.checkpoint_30d must be non-negative integer",
      errors
    );
  }

  if (isObj(payload.latest)) {
    assert(typeof payload.latest.hash === "string", "webhook.latest.hash must be string", errors);
    assert(
      typeof payload.latest.short_hash === "string",
      "webhook.latest.short_hash must be string",
      errors
    );
    assert(Number.isInteger(payload.latest.epoch), "webhook.latest.epoch must be integer", errors);
    assert(typeof payload.latest.subject === "string", "webhook.latest.subject must be string", errors);
  }

  if (Array.isArray(payload.recent)) {
    payload.recent.forEach((entry, idx) => {
      if (!isObj(entry)) {
        errors.push(`webhook.recent[${idx}] must be object`);
        return;
      }
      assert(typeof entry.hash === "string", `webhook.recent[${idx}].hash must be string`, errors);
      assert(
        typeof entry.short_hash === "string",
        `webhook.recent[${idx}].short_hash must be string`,
        errors
      );
      assert(Number.isInteger(entry.epoch), `webhook.recent[${idx}].epoch must be integer`, errors);
      assert(
        typeof entry.subject === "string",
        `webhook.recent[${idx}].subject must be string`,
        errors
      );
    });
  }

  return errors;
}

function validateHandoffMeta(meta) {
  const errors = [];
  assert(isObj(meta), "handoff meta root must be object", errors);
  if (!isObj(meta)) return errors;

  assert(typeof meta.generated_at === "string", "handoff.generated_at must be string", errors);
  assert(typeof meta.repo_root === "string", "handoff.repo_root must be string", errors);
  assert(typeof meta.handoff_directory === "string", "handoff.handoff_directory must be string", errors);
  assert(
    Number.isInteger(meta.keep_target) && meta.keep_target >= 1,
    "handoff.keep_target must be integer >= 1",
    errors
  );
  assert(
    Number.isInteger(meta.package_count) && meta.package_count >= 0,
    "handoff.package_count must be non-negative integer",
    errors
  );
  assert(
    Number.isInteger(meta.total_bytes) && meta.total_bytes >= 0,
    "handoff.total_bytes must be non-negative integer",
    errors
  );
  assert(typeof meta.total_kb === "number" && meta.total_kb >= 0, "handoff.total_kb must be number >= 0", errors);
  assert(
    Number.isInteger(meta.prune_candidates) && meta.prune_candidates >= 0,
    "handoff.prune_candidates must be non-negative integer",
    errors
  );
  assert(
    typeof meta.retention_within_target === "boolean",
    "handoff.retention_within_target must be boolean",
    errors
  );
  assert(meta.latest_package === null || isObj(meta.latest_package), "handoff.latest_package must be object|null", errors);
  assert(Array.isArray(meta.recent_packages), "handoff.recent_packages must be array", errors);

  if (isObj(meta.latest_package)) {
    assert(typeof meta.latest_package.name === "string", "handoff.latest_package.name must be string", errors);
    assert(typeof meta.latest_package.path === "string", "handoff.latest_package.path must be string", errors);
    assert(
      typeof meta.latest_package.updated_at === "string",
      "handoff.latest_package.updated_at must be string",
      errors
    );
    assert(
      Number.isInteger(meta.latest_package.bytes) && meta.latest_package.bytes >= 0,
      "handoff.latest_package.bytes must be non-negative integer",
      errors
    );
  }

  if (Array.isArray(meta.recent_packages)) {
    meta.recent_packages.forEach((entry, idx) => {
      if (!isObj(entry)) {
        errors.push(`handoff.recent_packages[${idx}] must be object`);
        return;
      }
      assert(typeof entry.name === "string", `handoff.recent_packages[${idx}].name must be string`, errors);
      assert(typeof entry.path === "string", `handoff.recent_packages[${idx}].path must be string`, errors);
      assert(
        typeof entry.updated_at === "string",
        `handoff.recent_packages[${idx}].updated_at must be string`,
        errors
      );
      assert(
        Number.isInteger(entry.bytes) && entry.bytes >= 0,
        `handoff.recent_packages[${idx}].bytes must be non-negative integer`,
        errors
      );
    });
  }

  return errors;
}

function main() {
  const root = process.cwd();
  const metaPath = path.resolve(root, ".checkpoints", "meta", "checkpoint-meta.json");
  const webhookPath = path.resolve(root, ".checkpoints", "webhook", "checkpoint-webhook-payload.json");
  const metaSchemaPath = path.resolve(root, ".checkpoints", "contracts", "checkpoint-meta.schema.json");
  const webhookSchemaPath = path.resolve(
    root,
    ".checkpoints",
    "contracts",
    "checkpoint-webhook-payload.schema.json"
  );
  const handoffSchemaPath = path.resolve(root, ".checkpoints", "contracts", "checkpoint-handoff-meta.schema.json");
  const handoffMetaRun = runJsonCommand(
    "node ./scripts/checkpoint-handoff-meta.mjs",
    "handoff meta generation failed"
  );

  const checks = [
    ["schema(meta)", readJson(metaSchemaPath)],
    ["schema(webhook)", readJson(webhookSchemaPath)],
    ["schema(handoff)", readJson(handoffSchemaPath)],
    ["artifact(meta)", readJson(metaPath)],
    ["artifact(webhook)", readJson(webhookPath)],
    ["artifact(handoff)", handoffMetaRun]
  ];

  let failures = 0;
  process.stdout.write("Checkpoint contract validation:\n");
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

  const metaErrors = validateMeta(checks[3][1].value);
  const webhookErrors = validateWebhook(checks[4][1].value);
  const handoffErrors = validateHandoffMeta(checks[5][1].value);

  if (metaErrors.length === 0) {
    process.stdout.write("- OK validate(meta payload)\n");
  } else {
    process.stdout.write("- FAIL validate(meta payload)\n");
    metaErrors.forEach((e) => process.stdout.write(`  - ${e}\n`));
  }

  if (webhookErrors.length === 0) {
    process.stdout.write("- OK validate(webhook payload)\n");
  } else {
    process.stdout.write("- FAIL validate(webhook payload)\n");
    webhookErrors.forEach((e) => process.stdout.write(`  - ${e}\n`));
  }

  if (handoffErrors.length === 0) {
    process.stdout.write("- OK validate(handoff payload)\n");
  } else {
    process.stdout.write("- FAIL validate(handoff payload)\n");
    handoffErrors.forEach((e) => process.stdout.write(`  - ${e}\n`));
  }

  const totalErrors = metaErrors.length + webhookErrors.length + handoffErrors.length;
  if (totalErrors > 0) {
    process.stdout.write(`\nContract validation failed with ${totalErrors} error(s).\n`);
    process.exit(1);
    return;
  }
  process.stdout.write("\nAll contract validations passed.\n");
}

main();
