import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function runStrict(command) {
  execSync(command, { stdio: "inherit" });
}

function latestBundle(baseDir) {
  if (!existsSync(baseDir)) return "";
  const dirs = readdirSync(baseDir)
    .map((name) => {
      const full = path.join(baseDir, name);
      const st = statSync(full);
      return st.isDirectory() ? { full, mtimeMs: st.mtimeMs } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return dirs[0]?.full ?? "";
}

function latestCheckpointLine() {
  return run('git log -1 --pretty=format:"%h %s" --grep="^checkpoint:"') || "none";
}

function main() {
  const root = process.cwd();
  const bundlesBase = path.resolve(root, ".checkpoints", "release-bundles");
  const selected = process.argv[2] ? path.resolve(root, process.argv[2]) : latestBundle(bundlesBase);

  if (!selected) {
    process.stdout.write("No release bundle found. Run `npm run checkpoint:release-bundle` first.\n");
    process.exit(1);
    return;
  }

  // Verify bundle before packaging
  runStrict(`node scripts/checkpoint-bundle-verify.mjs "${selected}"`);

  const outDir = path.resolve(root, ".checkpoints", "handoff-packages");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:]/g, "-");
  const baseName = `checkpoint-handoff-${stamp}`;
  const zipPath = path.join(outDir, `${baseName}.zip`);
  const notePath = path.join(outDir, `${baseName}.txt`);

  const note = [
    "Checkpoint Handoff Package",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Source bundle: ${selected}`,
    `Latest checkpoint: ${latestCheckpointLine()}`,
    "",
    "Verification:",
    "- Source bundle passed checkpoint:bundle-verify before packaging.",
    "",
    "Contents:",
    "- Compressed copy of verified release bundle",
    "- This cover note"
  ].join("\n");
  writeFileSync(notePath, `${note}\n`, "utf8");

  // Use PowerShell native compression for Windows portability.
  const escapedSource = selected.replace(/'/g, "''");
  const escapedDest = zipPath.replace(/'/g, "''");
  runStrict(
    `powershell -NoProfile -Command "Compress-Archive -Path '${escapedSource}\\*' -DestinationPath '${escapedDest}' -Force"`
  );

  process.stdout.write(`Handoff package created: ${zipPath}\n`);
  process.stdout.write(`Cover note created: ${notePath}\n`);
}

main();
