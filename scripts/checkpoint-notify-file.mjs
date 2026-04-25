import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

function run(command) {
  try {
    return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function main() {
  const root = process.cwd();
  const output = run("npm run -s checkpoint:notify-preview");
  if (!output) {
    process.stdout.write("Failed to generate notification preview content.\n");
    process.exit(1);
    return;
  }

  const outDir = path.resolve(root, ".checkpoints", "notify");
  mkdirSync(outDir, { recursive: true });
  const dateTag = new Date().toISOString().slice(0, 10);
  const outPath = path.join(outDir, `checkpoint-notify-preview-${dateTag}.txt`);

  writeFileSync(outPath, `${output}\n`, "utf8");
  process.stdout.write(`Notification preview file written: ${outPath}\n`);
}

main();
