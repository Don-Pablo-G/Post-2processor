import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const targetRoots = [path.join(root, "apps", "desktop", "src")];
const allowed = '@cnc/core/browser';
const forbidden = '@cnc/core';

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(full)));
      continue;
    }
    if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function hasForbiddenImport(source) {
  return (
    source.includes(`from "${forbidden}"`) ||
    source.includes(`from '${forbidden}'`) ||
    source.includes(`import("${forbidden}")`) ||
    source.includes(`import('${forbidden}')`)
  );
}

function hasAllowedImport(source) {
  return (
    source.includes(`from "${allowed}"`) ||
    source.includes(`from '${allowed}'`) ||
    source.includes(`import("${allowed}")`) ||
    source.includes(`import('${allowed}')`)
  );
}

async function main() {
  const violations = [];
  for (const targetRoot of targetRoots) {
    const files = await collectFiles(targetRoot);
    for (const file of files) {
      const source = await readFile(file, "utf8");
      if (hasForbiddenImport(source) && !hasAllowedImport(source)) {
        violations.push(path.relative(root, file));
      }
    }
  }

  if (violations.length > 0) {
    process.stderr.write("Import boundary violations found:\n");
    for (const file of violations) {
      process.stderr.write(`- ${file}\n`);
    }
    process.stderr.write(
      `Use "${allowed}" for browser runtime code instead of "${forbidden}".\n`
    );
    process.exit(1);
  }

  process.stdout.write("Import boundaries verified.\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
