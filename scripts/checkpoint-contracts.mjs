import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function metaSchema() {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://cnc-workbench.local/schemas/checkpoint-meta.schema.json",
    title: "CheckpointMeta",
    type: "object",
    required: ["generated_at", "repo", "checkpoints", "artifacts", "pulse"],
    properties: {
      generated_at: { type: "string", format: "date-time" },
      repo: {
        type: "object",
        required: ["branch", "dirty_count"],
        properties: {
          branch: { type: "string" },
          dirty_count: { type: "integer", minimum: 0 }
        },
        additionalProperties: false
      },
      checkpoints: {
        type: "object",
        required: ["latest", "count_24h", "count_7d", "count_30d"],
        properties: {
          latest: {
            anyOf: [
              { type: "null" },
              {
                type: "object",
                required: ["hash", "short_hash", "epoch", "subject"],
                properties: {
                  hash: { type: "string" },
                  short_hash: { type: "string" },
                  epoch: { type: "integer" },
                  subject: { type: "string" }
                },
                additionalProperties: false
              }
            ]
          },
          count_24h: { type: "integer", minimum: 0 },
          count_7d: { type: "integer", minimum: 0 },
          count_30d: { type: "integer", minimum: 0 }
        },
        additionalProperties: false
      },
      artifacts: {
        type: "object",
        required: ["index", "digest_today", "weekly_current"],
        properties: {
          index: { type: "string" },
          digest_today: { type: "string" },
          weekly_current: { type: "string" }
        },
        additionalProperties: false
      },
      pulse: {
        type: "string",
        enum: ["GREEN", "YELLOW", "RED", "NO_CHECKPOINT"]
      }
    },
    additionalProperties: false
  };
}

function webhookSchema() {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://cnc-workbench.local/schemas/checkpoint-webhook-payload.schema.json",
    title: "CheckpointWebhookPayload",
    type: "object",
    required: [
      "event",
      "generated_at",
      "repo",
      "pulse",
      "counters",
      "latest",
      "recent"
    ],
    properties: {
      event: { type: "string", const: "checkpoint.update" },
      generated_at: { type: "string", format: "date-time" },
      repo: {
        type: "object",
        required: ["path", "branch", "dirty_count"],
        properties: {
          path: { type: "string" },
          branch: { type: "string" },
          dirty_count: { type: "integer", minimum: 0 }
        },
        additionalProperties: false
      },
      pulse: {
        type: "string",
        enum: ["GREEN", "YELLOW", "RED", "NO_CHECKPOINT"]
      },
      counters: {
        type: "object",
        required: ["checkpoint_24h", "checkpoint_7d", "checkpoint_30d"],
        properties: {
          checkpoint_24h: { type: "integer", minimum: 0 },
          checkpoint_7d: { type: "integer", minimum: 0 },
          checkpoint_30d: { type: "integer", minimum: 0 }
        },
        additionalProperties: false
      },
      latest: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            required: ["hash", "short_hash", "epoch", "subject"],
            properties: {
              hash: { type: "string" },
              short_hash: { type: "string" },
              epoch: { type: "integer" },
              subject: { type: "string" }
            },
            additionalProperties: false
          }
        ]
      },
      recent: {
        type: "array",
        items: {
          type: "object",
          required: ["hash", "short_hash", "epoch", "subject"],
          properties: {
            hash: { type: "string" },
            short_hash: { type: "string" },
            epoch: { type: "integer" },
            subject: { type: "string" }
          },
          additionalProperties: false
        }
      }
    },
    additionalProperties: false
  };
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

  const metaPath = path.join(outDir, "checkpoint-meta.schema.json");
  const webhookPath = path.join(outDir, "checkpoint-webhook-payload.schema.json");
  const handoffPath = path.join(outDir, "checkpoint-handoff-meta.schema.json");

  writeJson(metaPath, metaSchema());
  writeJson(webhookPath, webhookSchema());
  writeJson(handoffPath, handoffMetaSchema());

  process.stdout.write(`Contract written: ${metaPath}\n`);
  process.stdout.write(`Contract written: ${webhookPath}\n`);
  process.stdout.write(`Contract written: ${handoffPath}\n`);
}

main();
