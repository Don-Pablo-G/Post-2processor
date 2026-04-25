import { readFile, access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const fixturesRoot = path.join(root, "packages", "test-fixtures");
const manifestPath = path.join(fixturesRoot, "shop-regressions", "manifest.json");

const ALLOWED_CONTROLLERS = new Set(["haas-ngc", "haas-legacy", "fanuc"]);

function fail(message) {
  throw new Error(message);
}

function assertBoolean(value, fieldPath) {
  if (typeof value !== "boolean") {
    fail(`${fieldPath} must be a boolean.`);
  }
}

function assertOptionalStringArray(value, fieldPath) {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    fail(`${fieldPath} must be an array of strings when provided.`);
  }
  const seen = new Set();
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    if (typeof item !== "string" || item.trim() === "") {
      fail(`${fieldPath}[${i}] must be a non-empty string.`);
    }
    if (seen.has(item)) {
      fail(`${fieldPath} contains duplicate code: ${item}`);
    }
    seen.add(item);
  }
}

async function ensureFileExists(filePath) {
  try {
    await access(filePath);
  } catch {
    fail(`Referenced fixture file not found: ${filePath}`);
  }
}

async function main() {
  const raw = await readFile(manifestPath, "utf8");
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (error) {
    fail(`Invalid JSON in manifest: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!manifest || typeof manifest !== "object" || !Array.isArray(manifest.fixtures)) {
    fail("Manifest must be an object with a fixtures array.");
  }
  if (manifest.fixtures.length === 0) {
    fail("Manifest fixtures array is empty.");
  }

  const ids = new Set();
  for (let i = 0; i < manifest.fixtures.length; i += 1) {
    const f = manifest.fixtures[i];
    const prefix = `fixtures[${i}]`;
    if (!f || typeof f !== "object") fail(`${prefix} must be an object.`);
    if (typeof f.id !== "string" || f.id.trim() === "") fail(`${prefix}.id must be a non-empty string.`);
    if (ids.has(f.id)) fail(`Duplicate fixture id: ${f.id}`);
    ids.add(f.id);

    if (typeof f.controller !== "string" || !ALLOWED_CONTROLLERS.has(f.controller)) {
      fail(`${prefix}.controller must be one of: haas-ngc, haas-legacy, fanuc.`);
    }
    if (typeof f.path !== "string" || f.path.trim() === "") {
      fail(`${prefix}.path must be a non-empty string.`);
    }
    const absoluteFixturePath = path.join(fixturesRoot, f.path);
    await ensureFileExists(absoluteFixturePath);

    if (!f.expectations || typeof f.expectations !== "object") {
      fail(`${prefix}.expectations must be an object.`);
    }
    assertBoolean(f.expectations.expectsMainM99, `${prefix}.expectations.expectsMainM99`);
    assertBoolean(f.expectations.expectsSimulationWarnings, `${prefix}.expectations.expectsSimulationWarnings`);
    assertBoolean(f.expectations.expectsSimulationFindings, `${prefix}.expectations.expectsSimulationFindings`);
    assertOptionalStringArray(f.expectations.expectedFindingCodes, `${prefix}.expectations.expectedFindingCodes`);
  }

  console.log(`Shop regression manifest OK (${manifest.fixtures.length} fixtures).`);
}

main().catch((error) => {
  console.error(`Shop regression manifest validation failed: ${error.message}`);
  process.exitCode = 1;
});
