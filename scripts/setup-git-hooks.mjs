import { mkdir, writeFile, chmod, access } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const gitDir = path.join(root, ".git");
const hooksDir = path.join(gitDir, "hooks");
const hookPath = path.join(hooksDir, "pre-commit");

async function main() {
  try {
    await access(gitDir);
  } catch {
    process.stderr.write("No .git directory found. Run this from the repo root.\n");
    process.exit(1);
  }

  await mkdir(hooksDir, { recursive: true });

  const script = `#!/bin/sh
# Local repo hook (auto-generated)
node scripts/pre-commit-check.mjs
`;

  await writeFile(hookPath, script, "utf8");
  await chmod(hookPath, 0o755);
  process.stdout.write(`Installed pre-commit hook at ${hookPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
