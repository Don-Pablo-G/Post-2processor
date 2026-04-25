import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const boundaryRules = [
  {
    label: "browser app imports",
    targetRoots: [path.join(root, "apps", "desktop", "src")],
    allowed: ['@cnc/core/browser'],
    forbidden: ['@cnc/core']
  },
  {
    label: "core tests imports",
    targetRoots: [path.join(root, "packages", "core", "tests")],
    allowed: ["../src/index.node.js"],
    forbidden: ["../src/index.js"]
  }
];

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

function hasImportRef(source, ref) {
  return (
    source.includes(`from "${ref}"`) ||
    source.includes(`from '${ref}'`) ||
    source.includes(`import("${ref}")`) ||
    source.includes(`import('${ref}')`)
  );
}

async function main() {
  const violations = [];

  for (const rule of boundaryRules) {
    for (const targetRoot of rule.targetRoots) {
      const files = await collectFiles(targetRoot);
      for (const file of files) {
        const source = await readFile(file, "utf8");
        const hasForbidden = rule.forbidden.some((ref) => hasImportRef(source, ref));
        const hasAllowed = rule.allowed.some((ref) => hasImportRef(source, ref));
        if (hasForbidden && !hasAllowed) {
          violations.push({
            file: path.relative(root, file),
            rule
          });
        }
      }
    }
  }

  const shadowedJsFiles = await findShadowedSourceJsFiles();
  if (shadowedJsFiles.length > 0) {
    process.stderr.write("Source JS shadowing violations found:\n");
    for (const file of shadowedJsFiles) {
      process.stderr.write(`- ${file} (remove checked-in .js sibling of a .ts source)\n`);
    }
    process.exit(1);
  }

  if (violations.length > 0) {
    process.stderr.write("Import boundary violations found:\n");
    for (const v of violations) {
      process.stderr.write(`- ${v.file} (${v.rule.label})\n`);
    }
    for (const rule of boundaryRules) {
      process.stderr.write(
        `Rule "${rule.label}": use ${rule.allowed.map((v) => `"${v}"`).join(" or ")} instead of ${rule.forbidden
          .map((v) => `"${v}"`)
          .join(" or ")}.\n`
      );
    }
    process.exit(1);
  }

  process.stdout.write("Import boundaries verified.\n");
}

async function findShadowedSourceJsFiles() {
  const shadowed = [];
  const forbiddenShadowedJsRelPaths = new Set([
    path.join("packages", "core", "src", "simulator", "simpleSimulator.js")
  ]);
  const candidateRoots = [path.join(root, "packages"), path.join(root, "apps")];

  for (const candidateRoot of candidateRoots) {
    let packageEntries = [];
    try {
      packageEntries = await readdir(candidateRoot, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of packageEntries) {
      if (!entry.isDirectory()) continue;
      const srcDir = path.join(candidateRoot, entry.name, "src");
      let srcFiles = [];
      try {
        srcFiles = await collectFiles(srcDir);
      } catch {
        continue;
      }
      for (const file of srcFiles) {
        if (!file.endsWith(".js")) continue;
        const siblingTs = `${file.slice(0, -3)}.ts`;
        const siblingTsx = `${file.slice(0, -3)}.tsx`;
        const allFiles = new Set(srcFiles);
        if (allFiles.has(siblingTs) || allFiles.has(siblingTsx)) {
          const rel = path.relative(root, file);
          if (forbiddenShadowedJsRelPaths.has(rel)) shadowed.push(rel);
        }
      }
    }
  }

  return shadowed.sort();
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
