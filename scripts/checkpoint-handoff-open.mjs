import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

function latestZip(baseDir) {
  if (!existsSync(baseDir)) return "";
  const files = readdirSync(baseDir)
    .filter((name) => name.endsWith(".zip"))
    .map((name) => {
      const full = path.join(baseDir, name);
      const st = statSync(full);
      return { full, mtimeMs: st.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files[0]?.full ?? "";
}

function openPath(targetPath) {
  const escaped = targetPath.replace(/'/g, "''");
  execSync(`powershell -NoProfile -Command "Start-Process '${escaped}'"`, { stdio: "inherit" });
}

function main() {
  const root = process.cwd();
  const baseDir = path.resolve(root, ".checkpoints", "handoff-packages");
  const mode = process.argv[2] === "--folder" ? "folder" : "file";

  const zipPath = latestZip(baseDir);
  if (!zipPath) {
    process.stdout.write("No handoff package found.\n");
    process.exit(1);
    return;
  }

  if (mode === "folder") {
    openPath(baseDir);
    process.stdout.write(`Opened handoff package folder: ${baseDir}\n`);
    return;
  }

  openPath(zipPath);
  process.stdout.write(`Opened latest handoff package: ${zipPath}\n`);
}

main();
