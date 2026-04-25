import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

function runStep(name, command) {
  try {
    execSync(command, { stdio: "inherit" });
    return { name, ok: true, note: "" };
  } catch (error) {
    return { name, ok: false, note: error?.message ? String(error.message) : "failed" };
  }
}

function safeCopy(src, destDir, copied, missing) {
  if (!existsSync(src)) {
    missing.push(src);
    return;
  }
  const target = path.join(destDir, path.basename(src));
  copyFileSync(src, target);
  copied.push(target);
}

function isoWeekTag(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function main() {
  const root = process.cwd();
  const today = new Date().toISOString().slice(0, 10);
  const week = isoWeekTag();
  const timestamp = new Date().toISOString().replace(/[:]/g, "-");

  const baseDir = path.resolve(root, ".checkpoints", "release-bundles");
  const bundleDir = path.join(baseDir, `bundle-${timestamp}`);
  mkdirSync(bundleDir, { recursive: true });

  const prep = [];
  prep.push(runStep("checkpoint:contracts", "npm run checkpoint:contracts"));
  prep.push(runStep("checkpoint:meta", "npm run checkpoint:meta"));
  prep.push(runStep("checkpoint:webhook-payload", "npm run checkpoint:webhook-payload"));
  prep.push(runStep("checkpoint:notify-file", "npm run checkpoint:notify-file"));
  prep.push(runStep("checkpoint:index", "npm run checkpoint:index"));

  const failedPrep = prep.filter((s) => !s.ok);
  if (failedPrep.length > 0) {
    process.stdout.write("Release bundle aborted due to failed prep steps:\n");
    failedPrep.forEach((f) => process.stdout.write(`- ${f.name}: ${f.note}\n`));
    process.exit(1);
    return;
  }

  const copied = [];
  const missing = [];

  safeCopy(path.resolve(root, ".checkpoints", "meta", "checkpoint-meta.json"), bundleDir, copied, missing);
  safeCopy(
    path.resolve(root, ".checkpoints", "webhook", "checkpoint-webhook-payload.json"),
    bundleDir,
    copied,
    missing
  );
  safeCopy(
    path.resolve(root, ".checkpoints", "contracts", "checkpoint-meta.schema.json"),
    bundleDir,
    copied,
    missing
  );
  safeCopy(
    path.resolve(root, ".checkpoints", "contracts", "checkpoint-webhook-payload.schema.json"),
    bundleDir,
    copied,
    missing
  );
  safeCopy(
    path.resolve(root, ".checkpoints", "notify", `checkpoint-notify-preview-${today}.txt`),
    bundleDir,
    copied,
    missing
  );
  safeCopy(path.resolve(root, ".checkpoints", "INDEX.md"), bundleDir, copied, missing);
  safeCopy(
    path.resolve(root, ".checkpoints", "digests", `checkpoint-digest-${today}.md`),
    bundleDir,
    copied,
    missing
  );
  safeCopy(
    path.resolve(root, ".checkpoints", "weekly", `checkpoint-weekly-${week}.md`),
    bundleDir,
    copied,
    missing
  );

  const manifest = {
    generated_at: new Date().toISOString(),
    bundle_dir: bundleDir,
    copied_files: copied.map((p) => path.relative(root, p).replace(/\\/g, "/")),
    missing_files: missing.map((p) => path.relative(root, p).replace(/\\/g, "/")),
    prep_steps: prep
  };

  const manifestPath = path.join(bundleDir, "manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  process.stdout.write(`Release bundle created: ${bundleDir}\n`);
  process.stdout.write(`Manifest: ${manifestPath}\n`);
  process.stdout.write(`Copied: ${copied.length}, Missing: ${missing.length}\n`);
}

main();
