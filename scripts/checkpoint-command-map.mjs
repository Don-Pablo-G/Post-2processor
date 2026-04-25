import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

function classify(name) {
  if (name.includes(":doctor")) return "Diagnostics";
  if (name.includes(":status") || name.includes(":pulse")) return "Status";
  if (name.includes(":report") || name.includes(":digest") || name.includes(":weekly") || name.includes(":weekend") || name.includes(":retro") || name.includes(":timeline:md") || name.includes(":catalog:md") || name.includes(":roadmap") || name.includes(":handoff")) return "Reporting";
  if (name.includes(":suite") || name.includes(":ship") || name.includes(":release-ready") || name.includes(":all") || name.includes(":ops") || name.includes(":bootstrap") || name.includes(":morning") || name.includes(":nightly")) return "Operations";
  if (name.includes(":cleanup") || name.includes(":prune")) return "Maintenance";
  if (name.includes(":search") || name.includes(":stats") || name.includes(":streaks") || name.includes(":gaps") || name.includes(":velocity") || name.includes(":focus") || name.includes(":cochange") || name.includes(":scope") || name.includes(":touchmap") || name.includes(":entropy") || name.includes(":drift") || name.includes(":momentum") || name.includes(":radar") || name.includes(":anomalies") || name.includes(":clusters") || name.includes(":brief")) return "Analytics";
  return "General";
}

function main() {
  const root = process.cwd();
  const pkgPath = path.resolve(root, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const scripts = pkg?.scripts ?? {};

  const checkpointScripts = Object.entries(scripts)
    .filter(([name]) => name.startsWith("checkpoint:"))
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (checkpointScripts.length === 0) {
    process.stdout.write("No checkpoint scripts found in package.json.\n");
    return;
  }

  const groups = new Map();
  for (const [name, command] of checkpointScripts) {
    const key = classify(name);
    const list = groups.get(key) ?? [];
    list.push({ name, command });
    groups.set(key, list);
  }

  const orderedKeys = [
    "General",
    "Status",
    "Diagnostics",
    "Analytics",
    "Reporting",
    "Maintenance",
    "Operations"
  ];

  const lines = [];
  lines.push("# Checkpoint Command Map");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`Total checkpoint commands: ${checkpointScripts.length}`);
  lines.push("");

  for (const key of orderedKeys) {
    const entries = groups.get(key) ?? [];
    if (entries.length === 0) continue;
    lines.push(`## ${key}`);
    entries.forEach((entry) => {
      lines.push(`- \`${entry.name}\` -> \`${entry.command}\``);
    });
    lines.push("");
  }

  const outDir = path.resolve(root, ".checkpoints", "maps");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "checkpoint-command-map.md");
  writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
  process.stdout.write(`Command map written: ${outPath}\n`);
}

main();
