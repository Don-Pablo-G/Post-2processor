import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const START = "<!-- checkpoint-commands:start -->";
const END = "<!-- checkpoint-commands:end -->";

function classify(name) {
  if (name.includes(":doctor")) return "Diagnostics";
  if (name.includes(":status") || name.includes(":pulse") || name.includes(":brief")) return "Status";
  if (name.includes(":cleanup") || name.includes(":prune")) return "Maintenance";
  if (
    name.includes(":suite") ||
    name.includes(":ship") ||
    name.includes(":release-ready") ||
    name.includes(":all") ||
    name.includes(":ops") ||
    name.includes(":bootstrap") ||
    name.includes(":morning") ||
    name.includes(":nightly") ||
    name.includes(":onboarding")
  ) {
    return "Operations";
  }
  if (
    name.includes(":report") ||
    name.includes(":digest") ||
    name.includes(":weekly") ||
    name.includes(":weekend") ||
    name.includes(":retro") ||
    name.includes(":timeline:md") ||
    name.includes(":catalog:md") ||
    name.includes(":roadmap") ||
    name.includes(":handoff") ||
    name.includes(":index")
  ) {
    return "Reporting";
  }
  if (name.startsWith("checkpoint:")) return "Analytics";
  return "General";
}

function buildGeneratedSection(pkg) {
  const scripts = pkg?.scripts ?? {};
  const entries = Object.entries(scripts)
    .filter(([name]) => name.startsWith("checkpoint:"))
    .sort((a, b) => a[0].localeCompare(b[0]));

  const groups = new Map();
  for (const [name, command] of entries) {
    const key = classify(name);
    const arr = groups.get(key) ?? [];
    arr.push({ name, command });
    groups.set(key, arr);
  }

  const order = ["Status", "Diagnostics", "Operations", "Reporting", "Maintenance", "Analytics", "General"];
  const lines = [];
  lines.push(START);
  lines.push("### Auto-generated Checkpoint Command Reference");
  lines.push("");
  lines.push(`_Generated from \`package.json\` scripts. Total: ${entries.length}_`);
  lines.push("");
  for (const key of order) {
    const arr = groups.get(key) ?? [];
    if (arr.length === 0) continue;
    lines.push(`#### ${key}`);
    for (const item of arr) {
      lines.push(`- \`${item.name}\` -> \`${item.command}\``);
    }
    lines.push("");
  }
  lines.push(END);
  return lines.join("\n");
}

function main() {
  const root = process.cwd();
  const pkgPath = path.resolve(root, "package.json");
  const readmePath = path.resolve(root, "README.md");

  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const readme = readFileSync(readmePath, "utf8");
  const generated = buildGeneratedSection(pkg);

  let next;
  if (readme.includes(START) && readme.includes(END)) {
    const startIdx = readme.indexOf(START);
    const endIdx = readme.indexOf(END) + END.length;
    next = `${readme.slice(0, startIdx)}${generated}${readme.slice(endIdx)}`;
  } else {
    next = `${readme.trimEnd()}\n\n## Checkpoint Command Matrix\n\n${generated}\n`;
  }

  if (next === readme) {
    process.stdout.write("README command reference already up to date.\n");
    return;
  }

  writeFileSync(readmePath, next, "utf8");
  process.stdout.write("README command reference synchronized.\n");
}

main();
