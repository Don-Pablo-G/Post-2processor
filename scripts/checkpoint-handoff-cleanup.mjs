import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

function parseKeep(value, fallback) {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function listZipEntries(baseDir) {
  if (!existsSync(baseDir)) return [];
  return readdirSync(baseDir)
    .filter((name) => name.endsWith(".zip"))
    .map((name) => {
      const full = path.join(baseDir, name);
      const st = statSync(full);
      return { name, full, mtimeMs: st.mtimeMs, size: st.size };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function pairedNotePath(zipPath) {
  return zipPath.replace(/\.zip$/i, ".txt");
}

function main() {
  const root = process.cwd();
  const baseDir = path.resolve(root, ".checkpoints", "handoff-packages");
  const keep = parseKeep(process.argv[2], 10);
  const apply = process.argv.includes("--apply");

  const zips = listZipEntries(baseDir);
  if (zips.length === 0) {
    process.stdout.write("No handoff packages found.\n");
    return;
  }

  const toDelete = zips.slice(keep);
  process.stdout.write(`Handoff packages found: ${zips.length}\n`);
  process.stdout.write(`Keeping newest: ${Math.min(keep, zips.length)}\n`);

  if (toDelete.length === 0) {
    process.stdout.write("Nothing to prune.\n");
    return;
  }

  process.stdout.write(`Prune candidates: ${toDelete.length}\n`);
  let removed = 0;

  for (const entry of toDelete) {
    const relZip = path.relative(root, entry.full);
    const notePath = pairedNotePath(entry.full);
    const noteExists = existsSync(notePath);
    const relNote = path.relative(root, notePath);

    if (!apply) {
      process.stdout.write(`- would delete zip: ${relZip}\n`);
      if (noteExists) process.stdout.write(`- would delete note: ${relNote}\n`);
      continue;
    }

    unlinkSync(entry.full);
    removed += 1;
    process.stdout.write(`- deleted zip: ${relZip}\n`);

    if (noteExists) {
      unlinkSync(notePath);
      process.stdout.write(`- deleted note: ${relNote}\n`);
    }
  }

  if (!apply) {
    process.stdout.write("Preview only. Re-run with `--apply` to delete files.\n");
    return;
  }

  process.stdout.write(`Cleanup complete. Removed zip files: ${removed}\n`);
}

main();
