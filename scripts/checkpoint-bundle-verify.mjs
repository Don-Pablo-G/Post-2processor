import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

function listBundleDirs(baseDir) {
  if (!existsSync(baseDir)) return [];
  return readdirSync(baseDir)
    .map((name) => {
      const full = path.join(baseDir, name);
      const st = statSync(full);
      return st.isDirectory() ? { name, full, mtimeMs: st.mtimeMs } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function readJson(filePath) {
  if (!existsSync(filePath)) return { ok: false, value: null, error: "missing file" };
  try {
    return { ok: true, value: JSON.parse(readFileSync(filePath, "utf8")), error: "" };
  } catch (error) {
    return { ok: false, value: null, error: `invalid json: ${String(error)}` };
  }
}

function main() {
  const root = process.cwd();
  const bundlesBase = path.resolve(root, ".checkpoints", "release-bundles");
  const argPath = process.argv[2] ? path.resolve(root, process.argv[2]) : "";
  const bundleDir = argPath || (listBundleDirs(bundlesBase)[0]?.full ?? "");

  if (!bundleDir) {
    process.stdout.write("No release bundle found.\n");
    process.exit(1);
    return;
  }

  const manifestPath = path.join(bundleDir, "manifest.json");
  const manifestRes = readJson(manifestPath);
  process.stdout.write(`Verifying release bundle: ${bundleDir}\n`);

  if (!manifestRes.ok) {
    process.stdout.write(`- FAIL manifest: ${manifestRes.error}\n`);
    process.exit(1);
    return;
  }

  const manifest = manifestRes.value;
  let failures = 0;

  const copied = Array.isArray(manifest.copied_files) ? manifest.copied_files : [];
  const missing = Array.isArray(manifest.missing_files) ? manifest.missing_files : [];
  const prep = Array.isArray(manifest.prep_steps) ? manifest.prep_steps : [];

  const requiredInBundle = [
    "checkpoint-meta.json",
    "checkpoint-webhook-payload.json",
    "checkpoint-meta.schema.json",
    "checkpoint-webhook-payload.schema.json",
    "manifest.json"
  ];

  process.stdout.write(`- OK manifest parsed (${path.basename(manifestPath)})\n`);

  for (const req of requiredInBundle) {
    const filePath = path.join(bundleDir, req);
    const ok = existsSync(filePath);
    process.stdout.write(`- ${ok ? "OK" : "FAIL"} required file: ${req}\n`);
    if (!ok) failures += 1;
  }

  for (const rel of copied) {
    const fileName = path.basename(rel);
    const exists = existsSync(path.join(bundleDir, fileName));
    if (!exists) {
      process.stdout.write(`- FAIL copied entry missing in bundle: ${fileName}\n`);
      failures += 1;
    }
  }

  const failedPrep = prep.filter((s) => !s?.ok);
  if (failedPrep.length > 0) {
    process.stdout.write(`- FAIL prep steps: ${failedPrep.length} failed\n`);
    failedPrep.forEach((s) => process.stdout.write(`  - ${s.name}\n`));
    failures += failedPrep.length;
  } else {
    process.stdout.write(`- OK prep steps: ${prep.length} all successful\n`);
  }

  if (missing.length > 0) {
    process.stdout.write(`- WARN manifest missing files count: ${missing.length}\n`);
  } else {
    process.stdout.write("- OK manifest missing files: none\n");
  }

  if (failures > 0) {
    process.stdout.write(`\nBundle verification FAILED with ${failures} issue(s).\n`);
    process.exit(1);
    return;
  }
  process.stdout.write("\nBundle verification PASSED.\n");
}

main();
