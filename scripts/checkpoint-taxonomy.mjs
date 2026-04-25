import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function classify(name) {
  if (name.includes(":doctor")) return "diagnostics";
  if (name.includes(":status") || name.includes(":pulse") || name.includes(":brief")) return "status";
  if (
    name.includes(":report") ||
    name.includes(":digest") ||
    name.includes(":weekly") ||
    name.includes(":weekend") ||
    name.includes(":retro") ||
    name.includes(":timeline:md") ||
    name.includes(":catalog:md") ||
    name.includes(":roadmap") ||
    name.includes(":handoff")
  ) {
    return "reporting";
  }
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
    return "operations";
  }
  if (name.includes(":cleanup") || name.includes(":prune")) return "maintenance";
  if (
    name.includes(":search") ||
    name.includes(":stats") ||
    name.includes(":streaks") ||
    name.includes(":gaps") ||
    name.includes(":velocity") ||
    name.includes(":focus") ||
    name.includes(":cochange") ||
    name.includes(":scope") ||
    name.includes(":touchmap") ||
    name.includes(":entropy") ||
    name.includes(":drift") ||
    name.includes(":momentum") ||
    name.includes(":radar") ||
    name.includes(":anomalies") ||
    name.includes(":clusters") ||
    name.includes(":authors") ||
    name.includes(":first-last") ||
    name.includes(":weekday")
  ) {
    return "analytics";
  }
  return "general";
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
    process.stdout.write("No checkpoint scripts found.\n");
    return;
  }

  const taxonomy = {
    generated_at: new Date().toISOString(),
    total_commands: checkpointScripts.length,
    categories: {
      general: [],
      status: [],
      diagnostics: [],
      analytics: [],
      reporting: [],
      maintenance: [],
      operations: []
    }
  };

  for (const [name, command] of checkpointScripts) {
    const category = classify(name);
    taxonomy.categories[category].push({ name, command });
  }

  const outDir = path.resolve(root, ".checkpoints", "taxonomy");
  mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "checkpoint-taxonomy.json");
  const mdPath = path.join(outDir, "checkpoint-taxonomy.md");

  writeFileSync(jsonPath, `${JSON.stringify(taxonomy, null, 2)}\n`, "utf8");

  const lines = [];
  lines.push("# Checkpoint Taxonomy");
  lines.push("");
  lines.push(`Generated: ${taxonomy.generated_at}`);
  lines.push(`Total commands: ${taxonomy.total_commands}`);
  lines.push("");
  for (const [category, entries] of Object.entries(taxonomy.categories)) {
    if (entries.length === 0) continue;
    lines.push(`## ${category}`);
    for (const entry of entries) {
      lines.push(`- \`${entry.name}\` -> \`${entry.command}\``);
    }
    lines.push("");
  }
  writeFileSync(mdPath, `${lines.join("\n")}\n`, "utf8");

  process.stdout.write(`Taxonomy written: ${jsonPath}\n`);
  process.stdout.write(`Taxonomy written: ${mdPath}\n`);
}

main();
