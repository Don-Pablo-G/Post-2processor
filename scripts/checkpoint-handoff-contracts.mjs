import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function handoffMetaSchema() {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://cnc-workbench.local/schemas/checkpoint-handoff-meta.schema.json",
    title: "CheckpointHandoffMeta",
    type: "object",
    required: [
      "generated_at",
      "repo_root",
      "handoff_directory",
      "keep_target",
      "package_count",
      "total_bytes",
      "total_kb",
      "prune_candidates",
      "retention_within_target",
      "latest_package",
      "recent_packages"
    ],
    properties: {
      generated_at: { type: "string", format: "date-time" },
      repo_root: { type: "string" },
      handoff_directory: { type: "string" },
      keep_target: { type: "integer", minimum: 1 },
      package_count: { type: "integer", minimum: 0 },
      total_bytes: { type: "integer", minimum: 0 },
      total_kb: { type: "number", minimum: 0 },
      prune_candidates: { type: "integer", minimum: 0 },
      retention_within_target: { type: "boolean" },
      latest_package: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            required: ["name", "path", "updated_at", "bytes"],
            properties: {
              name: { type: "string" },
              path: { type: "string" },
              updated_at: { type: "string", format: "date-time" },
              bytes: { type: "integer", minimum: 0 }
            },
            additionalProperties: false
          }
        ]
      },
      recent_packages: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "path", "updated_at", "bytes"],
          properties: {
            name: { type: "string" },
            path: { type: "string" },
            updated_at: { type: "string", format: "date-time" },
            bytes: { type: "integer", minimum: 0 }
          },
          additionalProperties: false
        }
      }
    },
    additionalProperties: false
  };
}

function main() {
  const root = process.cwd();
  const outDir = path.resolve(root, ".checkpoints", "contracts");
  mkdirSync(outDir, { recursive: true });

  const handoffSchemaPath = path.join(outDir, "checkpoint-handoff-meta.schema.json");
  writeJson(handoffSchemaPath, handoffMetaSchema());
  process.stdout.write(`Contract written: ${handoffSchemaPath}\n`);
}

main();
