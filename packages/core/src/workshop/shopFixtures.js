import * as fs from "node:fs/promises";
import path from "node:path";
import { simpleParse } from "../parser/simpleParser.js";
import { runJobCheckWorkflow } from "./runJobCheck.js";
const ALLOWED_CONTROLLERS = new Set(["haas-ngc", "haas-legacy", "fanuc"]);
export async function importShopFixture(input) {
    const manifestPath = path.join(input.fixturesRootDirectory, "shop-regressions", "manifest.json");
    const controllerDir = path.join(input.fixturesRootDirectory, "shop-regressions", input.controller);
    await fs.mkdir(controllerDir, { recursive: true });
    const filename = sanitizeFilename(input.filename && input.filename.trim().length > 0 ? input.filename : input.id);
    const fixtureFilePath = path.join(controllerDir, `${filename}.nc`);
    const relativeFixturePath = toPosixPath(path.relative(input.fixturesRootDirectory, fixtureFilePath).replace(/\\/g, "/"));
    const manifestRaw = await fs.readFile(manifestPath, "utf8");
    const manifest = JSON.parse(manifestRaw);
    if (!manifest.fixtures || !Array.isArray(manifest.fixtures)) {
        throw new Error("Invalid shop-regressions manifest format.");
    }
    if (manifest.fixtures.some((f) => f.id === input.id)) {
        throw new Error(`Fixture id already exists: ${input.id}`);
    }
    if (!input.overwriteExistingFile && (await pathExists(fixtureFilePath))) {
        throw new Error(`Fixture file already exists: ${fixtureFilePath}`);
    }
    await fs.writeFile(fixtureFilePath, input.code.replace(/\r\n/g, "\n"), "utf8");
    manifest.fixtures.push({
        id: input.id,
        controller: input.controller,
        path: relativeFixturePath,
        expectations: input.expectations
    });
    manifest.fixtures.sort((a, b) => a.id.localeCompare(b.id));
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    return {
        fixturePath: fixtureFilePath,
        manifestPath,
        fixtureId: input.id
    };
}
export async function validateShopFixturesManifest(input) {
    const manifestPath = path.join(input.fixturesRootDirectory, "shop-regressions", "manifest.json");
    const manifestRaw = await fs.readFile(manifestPath, "utf8");
    const manifest = JSON.parse(manifestRaw);
    if (!manifest || typeof manifest !== "object" || !Array.isArray(manifest.fixtures)) {
        throw new Error("Manifest must be an object with a fixtures array.");
    }
    if (manifest.fixtures.length === 0) {
        throw new Error("Manifest fixtures array is empty.");
    }
    const ids = new Set();
    for (let i = 0; i < manifest.fixtures.length; i += 1) {
        const fixture = manifest.fixtures[i];
        const prefix = `fixtures[${i}]`;
        if (!fixture || typeof fixture !== "object")
            throw new Error(`${prefix} must be an object.`);
        if (typeof fixture.id !== "string" || fixture.id.trim() === "") {
            throw new Error(`${prefix}.id must be a non-empty string.`);
        }
        if (ids.has(fixture.id))
            throw new Error(`Duplicate fixture id: ${fixture.id}`);
        ids.add(fixture.id);
        if (typeof fixture.controller !== "string" || !ALLOWED_CONTROLLERS.has(fixture.controller)) {
            throw new Error(`${prefix}.controller must be one of: haas-ngc, haas-legacy, fanuc.`);
        }
        if (typeof fixture.path !== "string" || fixture.path.trim() === "") {
            throw new Error(`${prefix}.path must be a non-empty string.`);
        }
        const absoluteFixturePath = path.join(input.fixturesRootDirectory, fixture.path);
        await fs.readFile(absoluteFixturePath, "utf8");
        if (!fixture.expectations || typeof fixture.expectations !== "object") {
            throw new Error(`${prefix}.expectations must be an object.`);
        }
        assertBoolean(fixture.expectations.expectsMainM99, `${prefix}.expectations.expectsMainM99`);
        assertBoolean(fixture.expectations.expectsSimulationWarnings, `${prefix}.expectations.expectsSimulationWarnings`);
        assertBoolean(fixture.expectations.expectsSimulationFindings, `${prefix}.expectations.expectsSimulationFindings`);
        assertOptionalStringArray(fixture.expectations.expectedFindingCodes, `${prefix}.expectations.expectedFindingCodes`);
    }
    return {
        fixtureCount: manifest.fixtures.length,
        manifestPath
    };
}
export async function runShopRegressionTests(input) {
    const command = "npm run --workspace @cnc/core test -- shop-regression";
    const cp = await import("node:child_process");
    const output = await new Promise((resolve, reject) => {
        const child = cp.spawn("npm", ["run", "--workspace", "@cnc/core", "test", "--", "shop-regression"], {
            cwd: input.workspaceRootDirectory,
            shell: true
        });
        let combined = "";
        child.stdout.on("data", (chunk) => {
            combined += String(chunk);
        });
        child.stderr.on("data", (chunk) => {
            combined += String(chunk);
        });
        child.on("error", (error) => {
            reject(error);
        });
        child.on("close", (code) => {
            if (code === 0) {
                resolve(combined);
                return;
            }
            reject(new Error(combined || `Command failed with exit code ${code ?? -1}.`));
        });
    });
    return {
        ok: true,
        command,
        output
    };
}
export async function analyzeShopFixtures(input) {
    const manifestPath = path.join(input.fixturesRootDirectory, "shop-regressions", "manifest.json");
    const manifestRaw = await fs.readFile(manifestPath, "utf8");
    const manifest = JSON.parse(manifestRaw);
    if (!manifest || typeof manifest !== "object" || !Array.isArray(manifest.fixtures)) {
        throw new Error("Manifest must be an object with a fixtures array.");
    }
    const byController = {
        "haas-ngc": 0,
        "haas-legacy": 0,
        fanuc: 0
    };
    const items = [];
    for (const fixture of manifest.fixtures) {
        byController[fixture.controller] += 1;
        const strictMode = Boolean(fixture.expectations.expectedFindingCodes && fixture.expectations.expectedFindingCodes.length > 0);
        const fixtureAbsPath = path.join(input.fixturesRootDirectory, fixture.path);
        const fixtureCode = await fs.readFile(fixtureAbsPath, "utf8");
        const detected = detectControllerProfile(fixtureCode);
        const issues = [];
        if (!strictMode) {
            issues.push("No strict expectedFindingCodes configured.");
        }
        if (detected !== fixture.controller) {
            issues.push(`Controller mismatch: detected=${detected}, manifest=${fixture.controller}.`);
        }
        items.push({
            id: fixture.id,
            controller: fixture.controller,
            path: fixture.path,
            strictMode,
            score: 100,
            issues
        });
    }
    // Flag similarly named fixture IDs as a triage warning.
    for (let i = 0; i < items.length; i += 1) {
        for (let j = i + 1; j < items.length; j += 1) {
            const a = normalizeFixtureId(items[i].id);
            const b = normalizeFixtureId(items[j].id);
            if (a === b || a.startsWith(b) || b.startsWith(a)) {
                items[i].issues.push(`Similar fixture id to ${items[j].id}.`);
                items[j].issues.push(`Similar fixture id to ${items[i].id}.`);
            }
        }
    }
    for (const item of items) {
        item.score = Math.max(0, 100 - item.issues.length * 20);
    }
    const strictFixtures = items.filter((i) => i.strictMode).length;
    const expectedWarningsFixtures = manifest.fixtures.filter((f) => f.expectations.expectsSimulationWarnings).length;
    const expectedFindingsFixtures = manifest.fixtures.filter((f) => f.expectations.expectsSimulationFindings).length;
    const nonStrictFixtures = items.length - strictFixtures;
    const summaryTxt = buildSummaryText({
        fixtureCount: items.length,
        byController,
        strictFixtures,
        nonStrictFixtures,
        expectedWarningsFixtures,
        expectedFindingsFixtures,
        items
    });
    const summaryMarkdown = buildSummaryMarkdown({
        fixtureCount: items.length,
        byController,
        strictFixtures,
        nonStrictFixtures,
        expectedWarningsFixtures,
        expectedFindingsFixtures,
        items
    });
    return {
        manifestPath,
        fixtureCount: items.length,
        byController,
        strictFixtures,
        nonStrictFixtures,
        expectedWarningsFixtures,
        expectedFindingsFixtures,
        items,
        summaryTxt,
        summaryMarkdown
    };
}
export async function previewShopFixtureAutoFixes(input) {
    const manifestPath = path.join(input.fixturesRootDirectory, "shop-regressions", "manifest.json");
    const manifestRaw = await fs.readFile(manifestPath, "utf8");
    const manifest = JSON.parse(manifestRaw);
    if (!manifest || typeof manifest !== "object" || !Array.isArray(manifest.fixtures)) {
        throw new Error("Manifest must be an object with a fixtures array.");
    }
    const includeControllerMismatchFixes = input.includeControllerMismatchFixes ?? true;
    const includeStrictFromSimulationFixes = input.includeStrictFromSimulationFixes ?? true;
    const changes = [];
    for (const fixture of manifest.fixtures) {
        const fixturePath = path.join(input.fixturesRootDirectory, fixture.path);
        const fixtureCode = await fs.readFile(fixturePath, "utf8");
        if (includeControllerMismatchFixes) {
            const detection = detectControllerProfileWithConfidence(fixtureCode);
            const detected = detection.controller;
            if (detected !== fixture.controller) {
                changes.push({
                    fixtureId: fixture.id,
                    kind: "controller_mismatch",
                    confidence: detection.confidence,
                    field: "controller",
                    from: fixture.controller,
                    to: detected
                });
                fixture.controller = detected;
            }
        }
        if (includeStrictFromSimulationFixes) {
            const currentCodes = fixture.expectations.expectedFindingCodes ?? [];
            if (currentCodes.length === 0) {
                const ast = simpleParse(fixtureCode, fixture.controller);
                const job = await runJobCheckWorkflow({
                    ast,
                    simulationLimits: { controllerMode: fixture.controller },
                    exportOptions: { enabled: false, baseDirectory: ".", baseName: fixture.id }
                });
                const codes = [...new Set(job.simulationFindings.map((f) => f.code))].sort();
                if (codes.length > 0) {
                    changes.push({
                        fixtureId: fixture.id,
                        kind: "strict_codes_from_simulation",
                        field: "expectations.expectedFindingCodes",
                        from: "[]",
                        to: JSON.stringify(codes)
                    });
                    fixture.expectations.expectedFindingCodes = codes;
                }
            }
        }
    }
    return {
        manifestPath,
        changes,
        updatedManifestJson: `${JSON.stringify(manifest, null, 2)}\n`,
        fingerprint: buildAutoFixFingerprint(input, changes)
    };
}
export async function applyShopFixtureAutoFixes(input) {
    const preview = await previewShopFixtureAutoFixes(input);
    if (input.expectedPreviewFingerprint && input.expectedPreviewFingerprint !== preview.fingerprint) {
        throw new Error("Auto-fix preview is stale. Please refresh preview before apply.");
    }
    const minConfidence = input.minimumControllerFixConfidence ?? "high";
    const filteredChanges = preview.changes.filter((change) => {
        if (change.kind !== "controller_mismatch")
            return true;
        return confidenceRank(change.confidence ?? "low") >= confidenceRank(minConfidence);
    });
    const changesToApply = new Set(filteredChanges.map((c) => `${c.fixtureId}:${c.kind}:${c.field}:${c.from}:${c.to}`));
    const parsed = JSON.parse(preview.updatedManifestJson);
    for (const fixture of parsed.fixtures) {
        // Reconstruct and revert low-confidence controller changes that were filtered out.
        const fixtureChanges = preview.changes.filter((c) => c.fixtureId === fixture.id && c.kind === "controller_mismatch");
        for (const change of fixtureChanges) {
            const key = `${change.fixtureId}:${change.kind}:${change.field}:${change.from}:${change.to}`;
            if (!changesToApply.has(key)) {
                fixture.controller = change.from;
            }
        }
    }
    const finalJson = `${JSON.stringify(parsed, null, 2)}\n`;
    const backupPath = buildBackupPath(preview.manifestPath, filteredChanges.length);
    if ((input.createBackup ?? true) && (await pathExists(preview.manifestPath))) {
        const current = await fs.readFile(preview.manifestPath, "utf8");
        await fs.writeFile(backupPath, current, "utf8");
    }
    await fs.writeFile(preview.manifestPath, finalJson, "utf8");
    return {
        manifestPath: preview.manifestPath,
        backupPath: input.createBackup ?? true ? backupPath : undefined,
        appliedChanges: filteredChanges.length,
        appliedFingerprint: buildAutoFixFingerprint(input, filteredChanges)
    };
}
export async function restoreShopFixtureManifestBackup(input) {
    const backup = await fs.readFile(input.backupPath, "utf8");
    await fs.writeFile(input.manifestPath, backup, "utf8");
    return {
        manifestPath: input.manifestPath,
        restoredFrom: input.backupPath
    };
}
function sanitizeFilename(value) {
    const cleaned = value
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
    return cleaned || "fixture";
}
function toPosixPath(value) {
    return value.replace(/\\/g, "/");
}
function assertBoolean(value, fieldPath) {
    if (typeof value !== "boolean") {
        throw new Error(`${fieldPath} must be a boolean.`);
    }
}
function assertOptionalStringArray(value, fieldPath) {
    if (value === undefined)
        return;
    if (!Array.isArray(value)) {
        throw new Error(`${fieldPath} must be an array of strings when provided.`);
    }
    const seen = new Set();
    for (let i = 0; i < value.length; i += 1) {
        const item = value[i];
        if (typeof item !== "string" || item.trim() === "") {
            throw new Error(`${fieldPath}[${i}] must be a non-empty string.`);
        }
        if (seen.has(item)) {
            throw new Error(`${fieldPath} contains duplicate code: ${item}`);
        }
        seen.add(item);
    }
}
function detectControllerProfile(code) {
    const header = code.toUpperCase().split(/\r?\n/).slice(0, 40).join("\n");
    if (/\bFANUC\b/.test(header))
        return "fanuc";
    if (/\bNGC\b/.test(header) || /\bG234\b/.test(header) || /\bDWO\b/.test(header))
        return "haas-ngc";
    if (/\bHAAS\b/.test(header))
        return "haas-legacy";
    return "haas-ngc";
}
function detectControllerProfileWithConfidence(code) {
    const header = code.toUpperCase().split(/\r?\n/).slice(0, 40).join("\n");
    if (/\bFANUC\b/.test(header))
        return { controller: "fanuc", confidence: "high" };
    if (/\bNGC\b/.test(header) || /\bG234\b/.test(header) || /\bDWO\b/.test(header)) {
        return { controller: "haas-ngc", confidence: "high" };
    }
    if (/\bHAAS\b/.test(header))
        return { controller: "haas-legacy", confidence: "medium" };
    return { controller: "haas-ngc", confidence: "low" };
}
function normalizeFixtureId(id) {
    return id.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function buildSummaryText(input) {
    const lines = [
        "SHOP FIXTURE HEALTH SUMMARY",
        `Total fixtures: ${input.fixtureCount}`,
        `By controller: haas-ngc=${input.byController["haas-ngc"]}, haas-legacy=${input.byController["haas-legacy"]}, fanuc=${input.byController.fanuc}`,
        `Strict fixtures: ${input.strictFixtures}`,
        `Non-strict fixtures: ${input.nonStrictFixtures}`,
        `Fixtures expecting warnings: ${input.expectedWarningsFixtures}`,
        `Fixtures expecting findings: ${input.expectedFindingsFixtures}`,
        "",
        "Fixture details:"
    ];
    for (const item of input.items) {
        lines.push(`- ${item.id} [${item.controller}] score=${item.score} strict=${item.strictMode ? "yes" : "no"}`);
        for (const issue of item.issues) {
            lines.push(`  * ${issue}`);
        }
    }
    return lines.join("\n");
}
function buildSummaryMarkdown(input) {
    const lines = [
        "# Shop Fixture Health Summary",
        "",
        `- Total fixtures: ${input.fixtureCount}`,
        `- By controller: haas-ngc=${input.byController["haas-ngc"]}, haas-legacy=${input.byController["haas-legacy"]}, fanuc=${input.byController.fanuc}`,
        `- Strict fixtures: ${input.strictFixtures}`,
        `- Non-strict fixtures: ${input.nonStrictFixtures}`,
        `- Fixtures expecting warnings: ${input.expectedWarningsFixtures}`,
        `- Fixtures expecting findings: ${input.expectedFindingsFixtures}`,
        "",
        "## Fixture details"
    ];
    for (const item of input.items) {
        lines.push(`- \`${item.id}\` [${item.controller}] score=${item.score} strict=${item.strictMode ? "yes" : "no"}`);
        for (const issue of item.issues) {
            lines.push(`  - ${issue}`);
        }
    }
    return lines.join("\n");
}
async function pathExists(targetPath) {
    try {
        await fs.access(targetPath);
        return true;
    }
    catch {
        return false;
    }
}
function buildAutoFixFingerprint(input, changes) {
    const payload = JSON.stringify({
        root: input.fixturesRootDirectory,
        includeControllerMismatchFixes: input.includeControllerMismatchFixes ?? true,
        includeStrictFromSimulationFixes: input.includeStrictFromSimulationFixes ?? true,
        changes
    });
    return simpleHash(payload);
}
function simpleHash(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
}
function confidenceRank(confidence) {
    if (confidence === "high")
        return 3;
    if (confidence === "medium")
        return 2;
    return 1;
}
function buildBackupPath(manifestPath, changesCount) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${manifestPath}.${stamp}.${changesCount}changes.backup`;
}
//# sourceMappingURL=shopFixtures.js.map